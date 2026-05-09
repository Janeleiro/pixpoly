package handlers

import (
	"encoding/json"
	"log"

	fiberws "github.com/gofiber/websocket/v2"
)

// Client represents a connected WebSocket client.
type Client struct {
	conn     *fiberws.Conn
	roomCode string
	name     string
	send     chan []byte
	accepted chan bool // receives the registration result from the hub
}

// BroadcastMessage carries a payload to all clients in a room.
type BroadcastMessage struct {
	RoomCode string
	Data     []byte
}

type activeClientQuery struct {
	roomCode string
	name     string
	result   chan bool
}

// Hub manages all active WebSocket clients, grouped by room code.
// All map mutations happen inside the single Run() goroutine — no mutex needed.
type Hub struct {
	rooms      map[string]map[*Client]bool
	names      map[string]map[string]*Client // roomCode -> playerName -> client
	register   chan *Client
	unregister chan *Client
	broadcast  chan *BroadcastMessage
	active     chan activeClientQuery
}

func NewHub() *Hub {
	return &Hub{
		rooms:      make(map[string]map[*Client]bool),
		names:      make(map[string]map[string]*Client),
		register:   make(chan *Client, 32),
		unregister: make(chan *Client, 32),
		broadcast:  make(chan *BroadcastMessage, 256),
		active:     make(chan activeClientQuery, 32),
	}
}

func (h *Hub) HasActiveClient(roomCode, name string) bool {
	result := make(chan bool, 1)
	h.active <- activeClientQuery{roomCode: roomCode, name: name, result: result}
	return <-result
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

// Run is the hub's main event loop. Must be started in its own goroutine.
func (h *Hub) Run() {
	for {
		select {
		case client := <-h.register:
			if _, ok := h.rooms[client.roomCode]; !ok {
				h.rooms[client.roomCode] = make(map[*Client]bool)
			}
			if _, ok := h.names[client.roomCode]; !ok {
				h.names[client.roomCode] = make(map[string]*Client)
			}
			if _, ok := h.names[client.roomCode][client.name]; ok {
				// Jogador já tem conexão ativa — rejeita a nova
				client.accepted <- false
			} else {
				h.rooms[client.roomCode][client] = true
				h.names[client.roomCode][client.name] = client
				client.accepted <- true
			}

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

		case query := <-h.active:
			roomNames, ok := h.names[query.roomCode]
			if !ok {
				query.result <- false
				continue
			}
			_, active := roomNames[query.name]
			query.result <- active
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
	defer c.conn.Close()
	for msg := range c.send {
		if err := c.conn.WriteMessage(fiberws.TextMessage, msg); err != nil {
			log.Printf("ws write error [%s/%s]: %v", c.roomCode, c.name, err)
			break
		}
	}
}
