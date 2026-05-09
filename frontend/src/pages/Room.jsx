import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useGame, loadSession } from '../context/GameContext.jsx'
import PixForm from '../components/PixForm.jsx'
import BankPanel from '../components/BankPanel.jsx'
import TransactionLog from '../components/TransactionLog.jsx'
import QRModal from '../components/QRModal.jsx'

export default function Room() {
  const { code } = useParams()
  const { room, player, wsError, isDisconnected, clearError, reconnect } = useGame()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('home')
  const [showQR, setShowQR] = useState(false)
  const [reconnecting, setReconnecting] = useState(false)
  const [selectedPlayerName, setSelectedPlayerName] = useState('')
  const [transferToast, setTransferToast] = useState(null)

  const attemptReconnect = useCallback(({ preserveState = false, navigateOnFailure = false } = {}) => {
    const session = loadSession()

    if (reconnecting) {
      return Promise.resolve(false)
    }

    if (!session || session.roomCode !== code) {
      if (navigateOnFailure) {
        navigate(`/?code=${code}`, { replace: true })
      }
      return Promise.resolve(false)
    }

    setReconnecting(true)
    return reconnect(session.roomCode, session.playerName, { preserveState })
      .then(() => true)
      .catch(() => {
        if (navigateOnFailure) {
          navigate(`/?code=${code}`, { replace: true })
        }
        return false
      })
      .finally(() => setReconnecting(false))
  }, [code, navigate, reconnect, reconnecting])

  useEffect(() => {
    if (player || reconnecting) return

    attemptReconnect({ navigateOnFailure: true })
  }, [attemptReconnect, player, reconnecting])

  useEffect(() => {
    if (!player || !isDisconnected || reconnecting) {
      return
    }

    const reconnectTimer = window.setTimeout(() => {
      attemptReconnect({ preserveState: true })
    }, 1500)

    return () => window.clearTimeout(reconnectTimer)
  }, [attemptReconnect, isDisconnected, player, reconnecting])

  useEffect(() => {
    if (!player || !isDisconnected) {
      return
    }

    const handleResume = () => {
      if (document.visibilityState !== 'visible' || reconnecting) {
        return
      }

      attemptReconnect({ preserveState: true })
    }

    document.addEventListener('visibilitychange', handleResume)
    window.addEventListener('focus', handleResume)

    return () => {
      document.removeEventListener('visibilitychange', handleResume)
      window.removeEventListener('focus', handleResume)
    }
  }, [attemptReconnect, isDisconnected, player, reconnecting])

  useEffect(() => {
    if (!transferToast) {
      return
    }

    const toastTimer = window.setTimeout(() => {
      setTransferToast(null)
    }, 3000)

    return () => window.clearTimeout(toastTimer)
  }, [transferToast])

  if (!player) return null

  const myPlayer = room?.players?.[player.name] ?? player
  const isBanker = myPlayer.isBanker
  const isBankerOnly = isBanker && !myPlayer.isPlayer
  const allPlayers = room ? Object.values(room.players) : []
  const otherPlayers = allPlayers.filter((p) => p.name !== player.name)

  const handlePixSuccess = ({ to, amount }) => {
    setSelectedPlayerName('')
    setTransferToast(`Transferência de ${formatBRL(amount)} para ${to} enviada com sucesso.`)
    setActiveTab('home')
  }

  const tabs = [
    { value: 'home', icon: HomeIcon, label: 'Início' },
    { value: 'pix', icon: PixIcon, label: 'Pix' },
    ...(isBanker ? [{ value: 'bank', icon: BankIcon, label: 'Banco' }] : []),
    { value: 'log', icon: LogIcon, label: 'Extrato' },
  ]

  return (
    <div className="min-h-screen bg-[#0a0e1a] flex flex-col max-w-lg mx-auto relative">
      {showQR && <QRModal roomCode={code} onClose={() => setShowQR(false)} />}

      {/* ── Header ─────────────────────────────────────────────────── */}
      <header className="flex items-center justify-between px-4 pt-5 pb-3 flex-shrink-0">
        <div>
          <p className="text-slate-500 text-xs font-medium uppercase tracking-widest">PixPoly</p>
          <p className="text-white font-semibold mt-0.5">{player.name}</p>
        </div>
        <div className="flex items-center gap-2">
          {isBanker && (
            <span className="text-xs bg-amber-400/15 text-amber-400 font-semibold px-2.5 py-1 rounded-full border border-amber-400/20">
              Banqueiro
            </span>
          )}
        </div>
      </header>

      {/* ── Error Toast ──────────────────────────────────────────────── */}
      {wsError && (
        <div className="mx-4 mb-2 bg-red-500/10 border border-red-500/20 text-red-400 text-sm px-4 py-2.5 rounded-2xl flex justify-between items-center">
          <span>{wsError}</span>
          <button onClick={clearError} className="ml-3 text-red-400 hover:text-red-300 font-bold text-lg leading-none">×</button>
        </div>
      )}

      {transferToast && (
        <div className="mx-4 mb-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm px-4 py-2.5 rounded-2xl">
          {transferToast}
        </div>
      )}

      {/* ── Scrollable Content ───────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto pb-24">
        {activeTab === 'home' && (
          <HomeTab
            myPlayer={myPlayer}
            isBankerOnly={isBankerOnly}
            code={code}
            otherPlayers={otherPlayers}
            onShowQR={() => setShowQR(true)}
            onPixClick={() => {
              setSelectedPlayerName('')
              setActiveTab('pix')
            }}
            onLogClick={() => setActiveTab('log')}
            onBankClick={() => setActiveTab('bank')}
            onPlayerSelect={(selectedPlayer) => {
              setSelectedPlayerName(selectedPlayer.name)
              setActiveTab('pix')
            }}
            isBanker={isBanker}
            transactions={room?.transactions ?? []}
          />
        )}
        {activeTab === 'pix' && (
          <div className="px-4 pt-2">
            <h2 className="text-xl font-bold text-white mb-4">Enviar Pix</h2>
            <PixForm players={otherPlayers} selectedPlayerName={selectedPlayerName} onSuccess={handlePixSuccess} />
          </div>
        )}
        {activeTab === 'bank' && isBanker && (
          <div className="px-4 pt-2">
            <h2 className="text-xl font-bold text-amber-400 mb-4">Painel do Banco</h2>
            <BankPanel players={allPlayers} />
          </div>
        )}
        {activeTab === 'log' && (
          <div className="px-4 pt-2">
            <h2 className="text-xl font-bold text-white mb-4">Extrato</h2>
            <TransactionLog transactions={room?.transactions ?? []} />
          </div>
        )}
      </div>

      {/* ── Bottom Navigation ────────────────────────────────────────── */}
      <nav className="fixed bottom-0 inset-x-0 max-w-lg mx-auto bg-[#0f1420]/95 backdrop-blur border-t border-white/5 flex z-40">
        {tabs.map((t) => {
          const Icon = t.icon
          const isActive = activeTab === t.value
          return (
            <button
              key={t.value}
              onClick={() => setActiveTab(t.value)}
              className={`flex-1 flex flex-col items-center py-3 gap-1 transition-colors ${
                isActive ? 'text-emerald-400' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              <Icon active={isActive} />
              <span className="text-[10px] font-medium">{t.label}</span>
            </button>
          )
        })}
      </nav>
    </div>
  )
}

/* ── Home Tab ────────────────────────────────────────────────────────────── */
function HomeTab({ myPlayer, isBankerOnly, code, otherPlayers, onShowQR, onPixClick, onLogClick, onBankClick, onPlayerSelect, isBanker, transactions }) {
  return (
    <div className="px-4 space-y-5 pt-1">
      {isBankerOnly ? (
        <BankerCard code={code} onShowQR={onShowQR} />
      ) : (
        <BalanceCard myPlayer={myPlayer} code={code} onShowQR={onShowQR} />
      )}

      <div className={`grid gap-3 ${isBanker ? 'grid-cols-3' : 'grid-cols-2'}`}>
        <QuickAction icon={<PixIcon active />} label="Pix" onClick={onPixClick} color="emerald" />
        {isBanker && <QuickAction icon={<BankIcon active />} label="Banco" onClick={onBankClick} color="amber" />}
        <QuickAction icon={<LogIcon active />} label="Extrato" onClick={onLogClick} color="blue" />
      </div>

      {otherPlayers.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Jogadores</p>
            <span className="text-xs text-slate-500">{otherPlayers.length + 1} na sala</span>
          </div>
          <div className="space-y-2">
            {otherPlayers.map((p) => (
              <PlayerRow key={p.name} player={p} onClick={onPlayerSelect} />
            ))}
          </div>
        </section>
      )}

      {transactions.length > 0 && (
        <section>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">Últimas transações</p>
          <div className="space-y-2">
            {[...transactions].reverse().slice(0, 3).map((tx) => (
              <MiniTx key={tx.id} tx={tx} myName={myPlayer.name} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

function BalanceCard({ myPlayer, code, onShowQR }) {
  return (
    <div className="bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-800 rounded-3xl p-5 shadow-2xl shadow-emerald-900/40 relative overflow-hidden">
      <div className="absolute -right-8 -top-8 w-40 h-40 rounded-full bg-white/5" />
      <div className="absolute -right-4 -bottom-12 w-32 h-32 rounded-full bg-white/5" />
      <div className="relative">
        <div className="flex justify-between items-start">
          <div>
            <p className="text-emerald-200 text-xs font-medium uppercase tracking-widest">Saldo disponível</p>
            <p className="text-4xl font-extrabold text-white mt-2 tabular-nums">
              {formatBRL(myPlayer.balance)}
            </p>
          </div>
          <button
            onClick={onShowQR}
            className="bg-white/15 hover:bg-white/25 text-white rounded-2xl px-3 py-2 text-xs font-semibold flex items-center gap-1.5 transition-colors flex-shrink-0"
          >
            <QrIcon />
            QR
          </button>
        </div>
        <div className="flex justify-between items-end mt-5">
          <p className="text-emerald-200 text-sm font-medium">{myPlayer.name}</p>
          <div className="text-right">
            <p className="text-emerald-300 text-[10px] uppercase tracking-widest">Sala</p>
            <p className="font-mono font-bold text-white tracking-[0.3em] text-sm">{code}</p>
          </div>
        </div>
      </div>
    </div>
  )
}

function BankerCard({ code, onShowQR }) {
  return (
    <div className="bg-gradient-to-br from-amber-600 via-amber-700 to-orange-800 rounded-3xl p-5 shadow-2xl shadow-amber-900/40 relative overflow-hidden">
      <div className="absolute -right-8 -top-8 w-40 h-40 rounded-full bg-white/5" />
      <div className="relative">
        <div className="flex justify-between items-start">
          <div>
            <p className="text-amber-200 text-xs font-medium uppercase tracking-widest">Modo Banqueiro</p>
            <p className="text-2xl font-extrabold text-white mt-2">Banco Central</p>
            <p className="text-amber-200 text-sm mt-1">Emissão de moeda ilimitada</p>
          </div>
          <button
            onClick={onShowQR}
            className="bg-white/15 hover:bg-white/25 text-white rounded-2xl px-3 py-2 text-xs font-semibold flex items-center gap-1.5 transition-colors flex-shrink-0"
          >
            <QrIcon />
            QR
          </button>
        </div>
        <div className="flex justify-end mt-4">
          <div className="text-right">
            <p className="text-amber-300 text-[10px] uppercase tracking-widest">Sala</p>
            <p className="font-mono font-bold text-white tracking-[0.3em] text-sm">{code}</p>
          </div>
        </div>
      </div>
    </div>
  )
}

function QuickAction({ icon, label, onClick, color }) {
  const colors = {
    emerald: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20',
    amber:   'bg-amber-500/10 border-amber-500/20 text-amber-400 hover:bg-amber-500/20',
    blue:    'bg-blue-500/10 border-blue-500/20 text-blue-400 hover:bg-blue-500/20',
  }
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-2 py-4 rounded-2xl border font-medium text-sm transition-colors ${colors[color]}`}
    >
      <span className="text-xl">{icon}</span>
      {label}
    </button>
  )
}

function PlayerRow({ player, onClick }) {
  return (
    <button
      type="button"
      onClick={() => onClick(player)}
      className="w-full flex items-center bg-[#141929] rounded-2xl px-4 py-3 border border-white/5 text-left transition-colors hover:bg-[#171d31] hover:border-emerald-500/20"
    >
      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-slate-600 to-slate-700 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
        {player.name[0].toUpperCase()}
      </div>
      <div className="ml-3 flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="text-sm font-semibold text-white truncate">{player.name}</p>
          {player.isBanker && <span className="text-amber-400 text-xs">★</span>}
        </div>
        {player.isPlayer ? (
          <p className="text-emerald-400 text-xs font-medium tabular-nums mt-0.5">
            {formatBRL(player.balance)}
          </p>
        ) : (
          <p className="text-amber-400 text-xs font-medium mt-0.5">Banqueiro</p>
        )}
      </div>
      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${player.connected ? 'bg-emerald-400' : 'bg-slate-600'}`} />
    </button>
  )
}

const TX_TYPE = {
  pix:         { label: 'Pix',           color: 'text-emerald-400' },
  bank_credit: { label: 'Crédito Banco', color: 'text-blue-400'    },
  bank_debit:  { label: 'Débito Banco',  color: 'text-red-400'     },
}

function MiniTx({ tx, myName }) {
  const meta = TX_TYPE[tx.type] ?? TX_TYPE.pix
  const incoming = tx.to === myName
  return (
    <div className="flex items-center bg-[#141929] rounded-2xl px-4 py-3 border border-white/5 gap-3">
      <div className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center text-base flex-shrink-0">
        {tx.type === 'pix' ? '💸' : tx.type === 'bank_credit' ? '⬆️' : '⬇️'}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white truncate">{tx.from} → {tx.to}</p>
        <p className="text-xs text-slate-500">{meta.label}</p>
      </div>
      <p className={`text-sm font-bold tabular-nums ${incoming ? 'text-emerald-400' : 'text-white'}`}>
        {incoming ? '+' : ''}{formatBRL(tx.amount)}
      </p>
    </div>
  )
}

/* ── Helpers ─────────────────────────────────────────────────────────────── */
export function formatBRL(value = 0) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

/* ── Icons ───────────────────────────────────────────────────────────────── */
function HomeIcon({ active }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={active ? 0 : 1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H5a1 1 0 01-1-1V9.5z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 21V12h6v9" />
    </svg>
  )
}

function PixIcon({ active }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14M15 8l4 4-4 4" />
    </svg>
  )
}

function BankIcon({ active }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 21h18M3 10h18M5 6l7-3 7 3M4 10v11M8 10v11M12 10v11M16 10v11M20 10v11" />
    </svg>
  )
}

function LogIcon({ active }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2M9 12h6M9 16h4" />
    </svg>
  )
}

function QrIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
      <path d="M14 14h3v3M17 21h4M21 17h-4" />
    </svg>
  )
}

