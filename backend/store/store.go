package store

import (
	"context"
	"errors"
	"fmt"
	"math/rand"
	"time"

	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"

	"pixpoly/models"
)

type RoomStore struct {
	db *pgxpool.Pool
}

func NewRoomStore(db *pgxpool.Pool) *RoomStore {
	return &RoomStore{db: db}
}

func (s *RoomStore) InitSchema(ctx context.Context) error {
	_, err := s.db.Exec(ctx, `
		CREATE TABLE IF NOT EXISTS rooms (
			code            VARCHAR(6)     PRIMARY KEY,
			initial_balance DECIMAL(12,2)  NOT NULL,
			created_at      TIMESTAMPTZ    DEFAULT NOW()
		);
		CREATE TABLE IF NOT EXISTS players (
			room_code  VARCHAR(6)    NOT NULL REFERENCES rooms(code) ON DELETE CASCADE,
			name       VARCHAR(100)  NOT NULL,
			balance    DECIMAL(12,2) NOT NULL,
			is_banker  BOOLEAN       NOT NULL DEFAULT false,
			is_player  BOOLEAN       NOT NULL DEFAULT true,
			connected  BOOLEAN       NOT NULL DEFAULT false,
			PRIMARY KEY (room_code, name)
		);
		CREATE TABLE IF NOT EXISTS transactions (
			id         VARCHAR(50)   PRIMARY KEY,
			room_code  VARCHAR(6)    NOT NULL REFERENCES rooms(code) ON DELETE CASCADE,
			from_name  VARCHAR(100)  NOT NULL,
			to_name    VARCHAR(100)  NOT NULL,
			amount     DECIMAL(12,2) NOT NULL,
			tx_type    VARCHAR(20)   NOT NULL,
			created_at TIMESTAMPTZ   DEFAULT NOW()
		);
	`)
	return err
}

func (s *RoomStore) CreateRoom(initialBalance float64) (*models.Room, error) {
	ctx := context.Background()
	code := generateCode()
	for {
		var exists bool
		if err := s.db.QueryRow(ctx,
			"SELECT EXISTS(SELECT 1 FROM rooms WHERE code=$1)", code,
		).Scan(&exists); err != nil {
			return nil, err
		}
		if !exists {
			break
		}
		code = generateCode()
	}

	if _, err := s.db.Exec(ctx,
		"INSERT INTO rooms (code, initial_balance) VALUES ($1, $2)", code, initialBalance,
	); err != nil {
		return nil, err
	}

	return &models.Room{
		Code:           code,
		Players:        make(map[string]*models.Player),
		Transactions:   []models.Transaction{},
		InitialBalance: initialBalance,
	}, nil
}

func (s *RoomStore) GetRoom(code string) (*models.Room, bool) {
	ctx := context.Background()

	var initialBalance float64
	if err := s.db.QueryRow(ctx,
		"SELECT initial_balance FROM rooms WHERE code=$1", code,
	).Scan(&initialBalance); err != nil {
		return nil, false
	}

	room := &models.Room{
		Code:           code,
		InitialBalance: initialBalance,
		Players:        make(map[string]*models.Player),
		Transactions:   []models.Transaction{},
	}

	rows, err := s.db.Query(ctx,
		"SELECT name, balance, is_banker, is_player, connected FROM players WHERE room_code=$1", code)
	if err != nil {
		return nil, false
	}
	defer rows.Close()
	for rows.Next() {
		p := &models.Player{}
		if err := rows.Scan(&p.Name, &p.Balance, &p.IsBanker, &p.IsPlayer, &p.Connected); err != nil {
			return nil, false
		}
		room.Players[p.Name] = p
	}

	txRows, err := s.db.Query(ctx,
		"SELECT id, from_name, to_name, amount, tx_type, created_at FROM transactions WHERE room_code=$1 ORDER BY created_at ASC", code)
	if err != nil {
		return nil, false
	}
	defer txRows.Close()
	for txRows.Next() {
		var tx models.Transaction
		if err := txRows.Scan(&tx.ID, &tx.From, &tx.To, &tx.Amount, &tx.Type, &tx.Timestamp); err != nil {
			return nil, false
		}
		room.Transactions = append(room.Transactions, tx)
	}

	return room, true
}

func (s *RoomStore) GetPlayer(roomCode, playerName string) (*models.Player, bool) {
	ctx := context.Background()
	p := &models.Player{}
	err := s.db.QueryRow(ctx,
		"SELECT name, balance, is_banker, is_player, connected FROM players WHERE room_code=$1 AND name=$2",
		roomCode, playerName,
	).Scan(&p.Name, &p.Balance, &p.IsBanker, &p.IsPlayer, &p.Connected)
	if err != nil {
		return nil, false
	}
	return p, true
}

func (s *RoomStore) AddPlayer(roomCode, playerName string, isBanker bool, isPlayer bool) (*models.Player, error) {
	ctx := context.Background()

	var initialBalance float64
	if err := s.db.QueryRow(ctx,
		"SELECT initial_balance FROM rooms WHERE code=$1", roomCode,
	).Scan(&initialBalance); err != nil {
		return nil, fmt.Errorf("Sala não encontrada")
	}

	bal := initialBalance
	if !isPlayer {
		bal = 0
	}

	_, err := s.db.Exec(ctx,
		"INSERT INTO players (room_code, name, balance, is_banker, is_player, connected) VALUES ($1, $2, $3, $4, $5, true)",
		roomCode, playerName, bal, isBanker, isPlayer,
	)
	if err != nil {
		if isUniqueViolation(err) {
			return nil, fmt.Errorf("Nome já em uso nesta sala")
		}
		return nil, err
	}

	return &models.Player{
		Name:      playerName,
		Balance:   bal,
		IsBanker:  isBanker,
		IsPlayer:  isPlayer,
		Connected: true,
	}, nil
}

func (s *RoomStore) SetPlayerConnected(roomCode, playerName string, connected bool) error {
	ctx := context.Background()
	_, err := s.db.Exec(ctx,
		"UPDATE players SET connected=$1 WHERE room_code=$2 AND name=$3",
		connected, roomCode, playerName,
	)
	return err
}

func (s *RoomStore) ExecutePix(roomCode, from, to string, amount float64) (*models.Transaction, error) {
	ctx := context.Background()

	tx, err := s.db.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	var senderBalance float64
	if err := tx.QueryRow(ctx,
		"SELECT balance FROM players WHERE room_code=$1 AND name=$2 FOR UPDATE",
		roomCode, from,
	).Scan(&senderBalance); err != nil {
		return nil, fmt.Errorf("Remetente não encontrado")
	}
	if senderBalance < amount {
		return nil, fmt.Errorf("Saldo insuficiente")
	}

	var receiverExists bool
	if err := tx.QueryRow(ctx,
		"SELECT EXISTS(SELECT 1 FROM players WHERE room_code=$1 AND name=$2)",
		roomCode, to,
	).Scan(&receiverExists); err != nil || !receiverExists {
		return nil, fmt.Errorf("Destinatário não encontrado")
	}

	if _, err := tx.Exec(ctx,
		"UPDATE players SET balance = balance - $1 WHERE room_code=$2 AND name=$3",
		amount, roomCode, from,
	); err != nil {
		return nil, err
	}
	if _, err := tx.Exec(ctx,
		"UPDATE players SET balance = balance + $1 WHERE room_code=$2 AND name=$3",
		amount, roomCode, to,
	); err != nil {
		return nil, err
	}

	txID := generateTxID()
	txTime := time.Now()
	if _, err := tx.Exec(ctx,
		"INSERT INTO transactions (id, room_code, from_name, to_name, amount, tx_type, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7)",
		txID, roomCode, from, to, amount, string(models.TxPix), txTime,
	); err != nil {
		return nil, err
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}

	return &models.Transaction{ID: txID, From: from, To: to, Amount: amount, Type: models.TxPix, Timestamp: txTime}, nil
}

func (s *RoomStore) BankCredit(roomCode, bankerName, to string, amount float64) (*models.Transaction, error) {
	ctx := context.Background()

	var isBanker bool
	if err := s.db.QueryRow(ctx,
		"SELECT is_banker FROM players WHERE room_code=$1 AND name=$2", roomCode, bankerName,
	).Scan(&isBanker); err != nil {
		return nil, fmt.Errorf("Banqueiro não encontrado")
	}
	if !isBanker {
		return nil, fmt.Errorf("Apenas o banqueiro pode emitir crédito")
	}

	var exists bool
	s.db.QueryRow(ctx,
		"SELECT EXISTS(SELECT 1 FROM players WHERE room_code=$1 AND name=$2)", roomCode, to,
	).Scan(&exists)
	if !exists {
		return nil, fmt.Errorf("Destinatário não encontrado")
	}

	if _, err := s.db.Exec(ctx,
		"UPDATE players SET balance = balance + $1 WHERE room_code=$2 AND name=$3",
		amount, roomCode, to,
	); err != nil {
		return nil, err
	}

	txID := generateTxID()
	txTime := time.Now()
	s.db.Exec(ctx,
		"INSERT INTO transactions (id, room_code, from_name, to_name, amount, tx_type, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7)",
		txID, roomCode, "Banco", to, amount, string(models.TxBankCredit), txTime,
	)

	return &models.Transaction{ID: txID, From: "Banco", To: to, Amount: amount, Type: models.TxBankCredit, Timestamp: txTime}, nil
}

func (s *RoomStore) BankDebit(roomCode, bankerName, from string, amount float64) (*models.Transaction, error) {
	ctx := context.Background()

	var isBanker bool
	if err := s.db.QueryRow(ctx,
		"SELECT is_banker FROM players WHERE room_code=$1 AND name=$2", roomCode, bankerName,
	).Scan(&isBanker); err != nil {
		return nil, fmt.Errorf("Banqueiro não encontrado")
	}
	if !isBanker {
		return nil, fmt.Errorf("Apenas o banqueiro pode debitar")
	}

	var targetBalance float64
	if err := s.db.QueryRow(ctx,
		"SELECT balance FROM players WHERE room_code=$1 AND name=$2", roomCode, from,
	).Scan(&targetBalance); err != nil {
		return nil, fmt.Errorf("Jogador não encontrado")
	}
	if targetBalance < amount {
		return nil, fmt.Errorf("Saldo insuficiente")
	}

	if _, err := s.db.Exec(ctx,
		"UPDATE players SET balance = balance - $1 WHERE room_code=$2 AND name=$3",
		amount, roomCode, from,
	); err != nil {
		return nil, err
	}

	txID := generateTxID()
	txTime := time.Now()
	s.db.Exec(ctx,
		"INSERT INTO transactions (id, room_code, from_name, to_name, amount, tx_type, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7)",
		txID, roomCode, from, "Banco", amount, string(models.TxBankDebit), txTime,
	)

	return &models.Transaction{ID: txID, From: from, To: "Banco", Amount: amount, Type: models.TxBankDebit, Timestamp: txTime}, nil
}

func isUniqueViolation(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == "23505"
}

func generateCode() string {
	const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
	b := make([]byte, 6)
	for i := range b {
		b[i] = chars[rand.Intn(len(chars))]
	}
	return string(b)
}

func generateTxID() string {
	return fmt.Sprintf("%d", time.Now().UnixNano())
}
