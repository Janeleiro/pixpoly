package handlers

import (
	"encoding/json"
	"log"
	"net/url"

	"github.com/gofiber/fiber/v2"
	fiberws "github.com/gofiber/websocket/v2"

	"pixpoly/models"
	"pixpoly/store"
)

// Handler wires together the HTTP/WS handlers with the store and hub.
type Handler struct {
	store *store.RoomStore
	hub   *Hub
}

func NewHandler(store *store.RoomStore, hub *Hub) *Handler {
	return &Handler{store: store, hub: hub}
}

// ── HTTP Handlers ────────────────────────────────────────────────────────────

type createRoomRequest struct {
	BankerName     string  `json:"bankerName"`
	InitialBalance float64 `json:"initialBalance"`
	BankerIsPlayer bool    `json:"bankerIsPlayer"`
}

// CreateRoom POST /api/rooms
func (h *Handler) CreateRoom(c *fiber.Ctx) error {
	var req createRoomRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "payload inválido"})
	}
	if req.BankerName == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "nome do banqueiro obrigatório"})
	}
	if req.InitialBalance <= 0 {
		req.InitialBalance = 1500
	}

	room, err := h.store.CreateRoom(req.InitialBalance)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "erro ao criar sala"})
	}

	player, err := h.store.AddPlayer(room.Code, req.BankerName, true, req.BankerIsPlayer)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"code":   room.Code,
		"player": player,
	})
}

type joinRoomRequest struct {
	PlayerName string `json:"playerName"`
}

// JoinRoom POST /api/rooms/:code/join
func (h *Handler) JoinRoom(c *fiber.Ctx) error {
	code := c.Params("code")
	var req joinRoomRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "payload inválido"})
	}
	if req.PlayerName == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "nome do jogador obrigatório"})
	}

	player, err := h.store.AddPlayer(code, req.PlayerName, false, true)
	if err != nil {
		// "nome já em uso" — só permite reconexão se não houver socket ativo no hub
		if existing, ok := h.store.GetPlayer(code, req.PlayerName); ok {
			if h.hub.HasActiveClient(code, req.PlayerName) {
				return c.Status(fiber.StatusConflict).JSON(fiber.Map{"error": "este nome já está em uso por outro dispositivo"})
			}
			// Jogador sem socket ativo: permite retomar a sessão
			return c.JSON(fiber.Map{"code": code, "player": existing})
		}
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	h.broadcastState(code)
	return c.JSON(fiber.Map{"code": code, "player": player})
}

// GetRoom GET /api/rooms/:code
func (h *Handler) GetRoom(c *fiber.Ctx) error {
	code := c.Params("code")
	room, ok := h.store.GetRoom(code)
	if !ok {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "sala não encontrada"})
	}
	return c.JSON(room)
}

// ── WebSocket Handler ────────────────────────────────────────────────────────

type wsIncomingMsg struct {
	RequestID string          `json:"requestId"`
	Type    string          `json:"type"`
	Payload json.RawMessage `json:"payload"`
}

// HandleWebSocket manages a single WebSocket connection for the given room/player.
func (h *Handler) HandleWebSocket(c *fiberws.Conn) {
	code := c.Params("code")
	name, err := url.PathUnescape(c.Params("name"))
	if err != nil {
		name = c.Params("name")
	}

	client := &Client{
		conn:     c,
		roomCode: code,
		name:     name,
		send:     make(chan []byte, 256),
		accepted: make(chan bool, 1),
	}

	h.hub.register <- client

	if !<-client.accepted {
		data, _ := json.Marshal(models.WSMessage{Type: "error", Payload: "jogador já conectado em outro dispositivo"})
		c.WriteMessage(fiberws.TextMessage, data)
		return
	}

	// Marca como conectado (cobre reconexão após queda de rede)
	h.store.SetPlayerConnected(code, name, true)
	go client.WritePump()

	// Immediately push the current room state to the new client.
	if room, ok := h.store.GetRoom(code); ok {
		if data, err := json.Marshal(models.WSMessage{Type: "state", Payload: room}); err == nil {
			select {
			case client.send <- data:
			default:
			}
		}
	}

	defer func() {
		h.hub.unregister <- client
		h.store.SetPlayerConnected(code, name, false)
		h.broadcastState(code)
	}()

	for {
		_, msg, err := c.ReadMessage()
		if err != nil {
			log.Printf("ws read closed [%s/%s]: %v", code, name, err)
			break
		}

		var incoming wsIncomingMsg
		if err := json.Unmarshal(msg, &incoming); err != nil {
			sendErrorTo(client, "", "mensagem inválida")
			continue
		}

		switch incoming.Type {
		case "pix":
			var p struct {
				To     string  `json:"to"`
				Amount float64 `json:"amount"`
			}
			if err := json.Unmarshal(incoming.Payload, &p); err != nil {
				sendErrorTo(client, incoming.RequestID, "payload inválido")
				continue
			}
			if _, err := h.store.ExecutePix(code, name, p.To, p.Amount); err != nil {
				sendErrorTo(client, incoming.RequestID, err.Error())
				continue
			}
			sendSuccessTo(client, incoming.RequestID)
			h.broadcastState(code)

		case "bank_credit":
			var p struct {
				Player string  `json:"player"`
				Amount float64 `json:"amount"`
			}
			if err := json.Unmarshal(incoming.Payload, &p); err != nil {
				sendErrorTo(client, incoming.RequestID, "payload inválido")
				continue
			}
			if _, err := h.store.BankCredit(code, name, p.Player, p.Amount); err != nil {
				sendErrorTo(client, incoming.RequestID, err.Error())
				continue
			}
			sendSuccessTo(client, incoming.RequestID)
			h.broadcastState(code)

		case "bank_debit":
			var p struct {
				Player string  `json:"player"`
				Amount float64 `json:"amount"`
			}
			if err := json.Unmarshal(incoming.Payload, &p); err != nil {
				sendErrorTo(client, incoming.RequestID, "payload inválido")
				continue
			}
			if _, err := h.store.BankDebit(code, name, p.Player, p.Amount); err != nil {
				sendErrorTo(client, incoming.RequestID, err.Error())
				continue
			}
			sendSuccessTo(client, incoming.RequestID)
			h.broadcastState(code)

		default:
			sendErrorTo(client, incoming.RequestID, "tipo de mensagem desconhecido")
		}
	}
}

// broadcastState fetches the latest room snapshot and broadcasts it to all clients.
func (h *Handler) broadcastState(roomCode string) {
	room, ok := h.store.GetRoom(roomCode)
	if !ok {
		return
	}
	h.hub.Broadcast(roomCode, models.WSMessage{Type: "state", Payload: room})
}

func sendErrorTo(client *Client, requestID, message string) {
	data, _ := json.Marshal(models.WSMessage{RequestID: requestID, Type: "error", Payload: message})
	select {
	case client.send <- data:
	default:
	}
}

func sendSuccessTo(client *Client, requestID string) {
	if requestID == "" {
		return
	}
	data, _ := json.Marshal(models.WSMessage{RequestID: requestID, Type: "action_result", Payload: "ok"})
	select {
	case client.send <- data:
	default:
	}
}
