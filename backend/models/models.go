package models

import "time"

type Player struct {
	Name      string  `json:"name"`
	Balance   float64 `json:"balance"`
	IsBanker  bool    `json:"isBanker"`
	IsPlayer  bool    `json:"isPlayer"`
	Connected bool    `json:"connected"`
	PinHash   string  `json:"-"`
	Active    bool    `json:"active"`
}

type TransactionType string

const (
	TxPix        TransactionType = "pix"
	TxBankCredit TransactionType = "bank_credit"
	TxBankDebit  TransactionType = "bank_debit"
)

type Transaction struct {
	ID        string          `json:"id"`
	From      string          `json:"from"`
	To        string          `json:"to"`
	Amount    float64         `json:"amount"`
	Type      TransactionType `json:"type"`
	Timestamp time.Time       `json:"timestamp"`
}

type Room struct {
	Code           string             `json:"code"`
	Players        map[string]*Player `json:"players"`
	Transactions   []Transaction      `json:"transactions"`
	InitialBalance float64            `json:"initialBalance"`
	VisibleBalance bool               `json:"visibleBalance"`
}

// WSMessage is the envelope sent over WebSocket.
type WSMessage struct {
	RequestID string      `json:"requestId,omitempty"`
	Type      string      `json:"type"`
	Payload   interface{} `json:"payload"`
}
