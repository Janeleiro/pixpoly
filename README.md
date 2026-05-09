# PixPoly

Aplicação web para gerenciar partidas de Banco Imobiliário com saldo digital, Pix entre jogadores, painel do banqueiro e sincronização em tempo real via WebSocket.

## Stack

- Backend: Go + Fiber + WebSocket + PostgreSQL
- Frontend: React + Vite + Tailwind CSS
- Infra local: Docker Compose

## Como rodar

1. Crie seu arquivo de ambiente a partir do exemplo:

   ```bash
   cp .env.example .env
   ```

2. Ajuste as variáveis em `.env` se necessário.

3. Suba a aplicação:

   ```bash
   docker compose up --build
   ```

4. Acesse:

- Frontend: http://localhost:8080
- Backend: http://localhost:3000

## Variáveis principais

- `POSTGRES_DB`
- `POSTGRES_USER`
- `POSTGRES_PASSWORD`
- `DATABASE_URL`
- `VITE_API_URL`
- `VITE_WS_URL`

## Estrutura

- `backend/`: API, WebSocket e persistência
- `frontend/`: interface React
- `docker-compose.yml`: orquestração local

## Observações para o repositório

- O arquivo `.env` fica ignorado pelo Git.
- Os contextos Docker ignoram `node_modules`, `dist`, binários e logs locais.
- Use `.env.example` como referência para configuração sem publicar credenciais reais.
