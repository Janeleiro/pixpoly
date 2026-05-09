package main

import (
	"context"
	"log"
	"os"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	fiberws "github.com/gofiber/websocket/v2"
	"github.com/jackc/pgx/v5/pgxpool"

	"pixpoly/handlers"
	"pixpoly/store"
)

func main() {
	ctx := context.Background()

	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		log.Fatal("DATABASE_URL não definida")
	}

	pool, err := pgxpool.New(ctx, dbURL)
	if err != nil {
		log.Fatalf("erro ao conectar ao banco: %v", err)
	}
	defer pool.Close()

	roomStore := store.NewRoomStore(pool)
	if err := roomStore.InitSchema(ctx); err != nil {
		log.Fatalf("erro ao inicializar schema: %v", err)
	}

	app := fiber.New(fiber.Config{AppName: "PixPoly"})

	app.Use(cors.New(cors.Config{
		AllowOrigins: "*",
		AllowHeaders: "Origin, Content-Type, Accept",
	}))

	hub := handlers.NewHub()
	go hub.Run()

	h := handlers.NewHandler(roomStore, hub)

	api := app.Group("/api")
	api.Post("/rooms", h.CreateRoom)
	api.Post("/rooms/:code/join", h.JoinRoom)
	api.Get("/rooms/:code", h.GetRoom)

	app.Use("/ws", func(c *fiber.Ctx) error {
		if fiberws.IsWebSocketUpgrade(c) {
			c.Locals("allowed", true)
			return c.Next()
		}
		return fiber.ErrUpgradeRequired
	})

	app.Get("/ws/:code/:name", fiberws.New(h.HandleWebSocket))

	port := os.Getenv("PORT")
	if port == "" {
		port = "3000"
	}

	log.Printf("PixPoly backend iniciando na porta %s", port)
	log.Fatal(app.Listen(":" + port))
}
