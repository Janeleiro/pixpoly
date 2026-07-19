import { createContext, useContext, useState, useRef, useCallback } from 'react'

const GameContext = createContext(null)

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'
const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:3000'
export const DISCONNECTED_MESSAGE = 'Conexão perdida com o servidor.'

const SESSION_KEY = 'pixpoly_session'

export function saveSession(roomCode, playerName, pin) {
  localStorage.setItem(SESSION_KEY, JSON.stringify({ roomCode, playerName, pin }))
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY)
}

export function loadSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function GameProvider({ children }) {
  const [room, setRoom] = useState(null)
  const [player, setPlayer] = useState(null)
  const [wsError, setWsError] = useState(null)
  const [isDisconnected, setIsDisconnected] = useState(false)
  const wsRef = useRef(null)
  const pendingActionsRef = useRef(new Map())

  const rejectPendingActions = useCallback((message) => {
    for (const [, pending] of pendingActionsRef.current) {
      pending.reject(new Error(message))
    }
    pendingActionsRef.current.clear()
  }, [])

  const connectWS = useCallback((roomCode, playerName) => {
    if (wsRef.current) {
      wsRef.current.onclose = null // prevent old reconnect timers
      wsRef.current.close()
      wsRef.current = null
      rejectPendingActions('Conexão encerrada.')
    }

    setIsDisconnected(false)

    return new Promise((resolve, reject) => {
      const ws = new WebSocket(`${WS_URL}/ws/${roomCode}/${encodeURIComponent(playerName)}`)
      let handshakeComplete = false
      let settled = false
      let kicked = false

      const rejectConnection = (message) => {
        if (settled) {
          return
        }
        settled = true
        if (wsRef.current === ws) {
          wsRef.current = null
        }
        reject(new Error(message))
      }

      ws.onmessage = (event) => {
        let msg
        try {
          msg = JSON.parse(event.data)
        } catch {
          ws.close()
          rejectConnection('Mensagem inválida do servidor.')
          return
        }

        if (msg.type === 'state') {
          handshakeComplete = true
          setRoom(msg.payload)
          setWsError(null)
          setIsDisconnected(false)
          if (!settled) {
            settled = true
            resolve()
          }
          return
        }

        if (msg.type === 'kicked') {
          handshakeComplete = true
          kicked = true
          ws.close()
          if (wsRef.current !== ws) {
            // Esta conexão já foi substituída por uma mais nova deste mesmo
            // dispositivo (ex: reconexão própria) — a mensagem é sobre a
            // conexão antiga, não sobre a sessão atual. Ignorar.
            return
          }
          clearSession()
          rejectPendingActions(msg.payload || DISCONNECTED_MESSAGE)
          setRoom(null)
          setPlayer(null)
          setWsError(msg.payload || 'Você foi desconectado porque este usuário entrou em outro dispositivo.')
          return
        }

        if (msg.type === 'action_result') {
          const pending = pendingActionsRef.current.get(msg.requestId)
          if (pending) {
            pendingActionsRef.current.delete(msg.requestId)
            pending.resolve(msg.payload)
          }
          return
        }

        if (msg.type === 'error') {
          const pending = pendingActionsRef.current.get(msg.requestId)
          if (pending) {
            pendingActionsRef.current.delete(msg.requestId)
            pending.reject(new Error(msg.payload || 'Operação recusada pelo servidor.'))
            return
          }
          if (!handshakeComplete) {
            ws.close()
            rejectConnection(msg.payload || 'Conexão recusada pelo servidor.')
            return
          }
          setWsError(msg.payload)
        }
      }

      ws.onerror = () => {
        if (!handshakeComplete) {
          rejectConnection(DISCONNECTED_MESSAGE)
        }
      }

      ws.onclose = () => {
        if (wsRef.current === ws) {
          wsRef.current = null
        }
        if (kicked) {
          return
        }
        if (!handshakeComplete) {
          rejectConnection('Conexão recusada pelo servidor.')
          return
        }
        rejectPendingActions(DISCONNECTED_MESSAGE)
        setIsDisconnected(true)
        setWsError(DISCONNECTED_MESSAGE)
      }

      wsRef.current = ws
    })
  }, [rejectPendingActions])

  const createRoom = async (bankerName, initialBalance, bankerIsPlayer, pin, visibleBalance) => {
    setPlayer(null)
    setRoom(null)
    setWsError(null)
    setIsDisconnected(false)
    const res = await fetch(`${API_URL}/api/rooms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bankerName, initialBalance, bankerIsPlayer, pin, visibleBalance }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error)
    await connectWS(data.code, bankerName)
    setPlayer(data.player)
    saveSession(data.code, bankerName, pin)
    return data.code
  }

  const joinRoom = async (code, playerName, pin) => {
    setPlayer(null)
    setRoom(null)
    setWsError(null)
    setIsDisconnected(false)
    const res = await fetch(`${API_URL}/api/rooms/${code}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerName, pin }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error)
    await connectWS(code, playerName)
    setPlayer(data.player)
    saveSession(code, playerName, pin)
  }

  // Reconexão silenciosa (página atualizada, localStorage existente)
  const reconnect = useCallback(async (roomCode, playerName, pin, options = {}) => {
    const { preserveState = false } = options

    if (!preserveState) {
      setPlayer(null)
      setRoom(null)
    }
    setWsError(null)
    try {
      const res = await fetch(`${API_URL}/api/rooms/${roomCode}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerName, pin }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      await connectWS(roomCode, playerName)
      setPlayer(data.player)
      setIsDisconnected(false)
      return data.player
    } catch (error) {
      const reconnectError = error instanceof Error ? error : new Error(DISCONNECTED_MESSAGE)
      setWsError(reconnectError.message)
      throw reconnectError
    }
  }, [connectWS])

  const sendWS = useCallback((type, payload) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      setIsDisconnected(true)
      setWsError(DISCONNECTED_MESSAGE)
      return Promise.reject(new Error(DISCONNECTED_MESSAGE))
    }

    const requestId = crypto.randomUUID()

    return new Promise((resolve, reject) => {
      pendingActionsRef.current.set(requestId, { resolve, reject })

      try {
        wsRef.current.send(JSON.stringify({ requestId, type, payload }))
      } catch (error) {
        pendingActionsRef.current.delete(requestId)
        reject(error instanceof Error ? error : new Error('Falha ao enviar a operação.'))
      }
    })
  }, [])

  const sendPix = (to, amount) =>
    sendWS('pix', { to, amount })

  const bankCredit = (targetPlayer, amount) =>
    sendWS('bank_credit', { player: targetPlayer, amount })

  const bankDebit = (targetPlayer, amount) =>
    sendWS('bank_debit', { player: targetPlayer, amount })

  const deactivatePlayer = (targetPlayer) =>
    sendWS('deactivate_player', { player: targetPlayer })

  const clearError = () => setWsError(null)

  return (
    <GameContext.Provider
      value={{
        room,
        player,
        wsError,
        isDisconnected,
        clearError,
        createRoom,
        joinRoom,
        reconnect,
        sendPix,
        bankCredit,
        bankDebit,
        deactivatePlayer,
      }}
    >
      {children}
    </GameContext.Provider>
  )
}

export const useGame = () => useContext(GameContext)
