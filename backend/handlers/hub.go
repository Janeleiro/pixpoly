package handlers

import (
	"encoding/json"
	"log"
	"sync/atomic"
	"time"

	fiberws "github.com/gofiber/websocket/v2"

	"pixpoly/models"
)

// Client represents a connected WebSocket client.
type Client struct {
	conn       *fiberws.Conn
	roomCode   string
	name       string
	send       chan []byte
	registered chan struct{} // closed by the hub once the client is registered
	superseded atomic.Bool   // true when a relogin evicted this client
}

// BroadcastMessage carries a payload to all clients in a room.
type BroadcastMessage struct {
	RoomCode string
	Data     []byte
}

// Hub manages all active WebSocket clients, grouped by room code.
// All map mutations happen inside the single Run() goroutine — no mutex needed.
type Hub struct {
	rooms      map[string]map[*Client]bool
	names      map[string]map[string]*Client // roomCode -> playerName -> client
	register   chan *Client
	unregister chan *Client
	broadcast  chan *BroadcastMessage
}

func NewHub() *Hub {
	return &Hub{
		rooms:      make(map[string]map[*Client]bool),
		names:      make(map[string]map[string]*Client),
		register:   make(chan *Client, 32),
		unregister: make(chan *Client, 32),
		broadcast:  make(chan *BroadcastMessage, 256),
	}
}

func (h *Hub) removeClient(client *Client) {
	clients, ok := h.rooms[client.roomCode]
	if !ok {
		return
	}
	if _, ok := clients[client]; ok {
		delete(clients, client)
		close(client.send)
	}
	if byName, ok := h.names[client.roomCode]; ok {
		if byName[client.name] == client {
			delete(byName, client.name)
		}
	}
	if len(clients) == 0 {
		delete(h.rooms, client.roomCode)
		delete(h.names, client.roomCode)
	}
}

// roomMaps returns the client/name maps for a room, lazily creating them.
// Must only be called from the Run() goroutine.
func (h *Hub) roomMaps(roomCode string) (map[*Client]bool, map[string]*Client) {
	if _, ok := h.rooms[roomCode]; !ok {
		h.rooms[roomCode] = make(map[*Client]bool)
	}
	if _, ok := h.names[roomCode]; !ok {
		h.names[roomCode] = make(map[string]*Client)
	}
	return h.rooms[roomCode], h.names[roomCode]
}

// evict kicks an existing client, e.g. because a relogin from another device
// is taking over the same player. It may empty and remove the room's maps
// (via removeClient) if the evicted client was the only one connected —
// callers must fetch/recreate room maps with roomMaps() AFTER calling this.
func (h *Hub) evict(client *Client) {
	client.superseded.Store(true)
	kicked, _ := json.Marshal(models.WSMessage{
		Type:    "kicked",
		Payload: "Você foi desconectado porque este usuário entrou em outro dispositivo.",
	})
	select {
	case client.send <- kicked:
	default:
	}
	h.removeClient(client)
}

// Run is the hub's main event loop. Must be started in its own goroutine.
func (h *Hub) Run() {
	for {
		select {
		case client := <-h.register:
			if old, ok := h.names[client.roomCode][client.name]; ok {
				// Relogin: o novo dispositivo assume o jogador; o antigo é desconectado.
				h.evict(old)
			}
			clients, names := h.roomMaps(client.roomCode)
			clients[client] = true
			names[client.name] = client
			close(client.registered)

		case client := <-h.unregister:
			h.removeClient(client)

		case msg := <-h.broadcast:
			if clients, ok := h.rooms[msg.RoomCode]; ok {
				for client := range clients {
					select {
					case client.send <- msg.Data:
					default:
						// Slow client — drop and disconnect.
						h.removeClient(client)
					}
				}
			}
		}
	}
}

// Broadcast serializes v and sends it to every client in the room.
func (h *Hub) Broadcast(roomCode string, v interface{}) {
	data, err := json.Marshal(v)
	if err != nil {
		log.Printf("hub broadcast marshal error: %v", err)
		return
	}
	h.broadcast <- &BroadcastMessage{RoomCode: roomCode, Data: data}
}

// WritePump drains the client's send channel and writes to the WebSocket.
// Must be run in a dedicated goroutine.
func (c *Client) WritePump() {
	defer func() {
		// fasthttp's connection doesn't unblock a concurrently-running ReadMessage
		// (in HandleWebSocket's goroutine) on a plain Close() from here — an expired
		// read deadline is what actually interrupts it.
		c.conn.SetReadDeadline(time.Now())
		c.conn.Close()
	}()
	for msg := range c.send {
		if err := c.conn.WriteMessage(fiberws.TextMessage, msg); err != nil {
			log.Printf("ws write error [%s/%s]: %v", c.roomCode, c.name, err)
			break
		}
	}
}
