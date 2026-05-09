# ── Stage 1: Build ──────────────────────────────────────────────────────────
FROM golang:1.21-alpine AS builder

WORKDIR /app

COPY go.mod ./
COPY . .
RUN go mod tidy
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o server .

# ── Stage 2: Run ────────────────────────────────────────────────────────────
FROM alpine:latest

RUN apk --no-cache add ca-certificates

WORKDIR /root/

COPY --from=builder /app/server .

EXPOSE 3000

CMD ["./server"]
