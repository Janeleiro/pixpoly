import { useEffect, useState } from 'react'
import { useGame } from '../context/GameContext.jsx'

export default function PixForm({ players, selectedPlayerName = '', onSuccess }) {
  const { sendPix } = useGame()
  const [to, setTo] = useState('')
  const [amount, setAmount] = useState('')
  const [localError, setLocalError] = useState(null)

  useEffect(() => {
    if (selectedPlayerName) {
      const hasSelectedPlayer = players.some((player) => player.name === selectedPlayerName)
      setTo(hasSelectedPlayer ? selectedPlayerName : '')
      return
    }

    setTo((currentTo) => (players.some((player) => player.name === currentTo) ? currentTo : ''))
  }, [players, selectedPlayerName])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLocalError(null)
    if (!to) return setLocalError('Selecione um destinatário.')
    const val = parseFloat(amount)
    if (!val || val <= 0) return setLocalError('Informe um valor válido.')

    try {
      await sendPix(to, val)
      setAmount('')
      if (typeof onSuccess === 'function') {
        onSuccess({ to, amount: val })
      } else {
        setTo('')
      }
    } catch (error) {
      setLocalError(error.message)
    }
  }

  return (
    <div className="space-y-4">
      {localError && <Alert variant="error">{localError}</Alert>}

      <form onSubmit={handleSubmit} className="space-y-3">
        <Field label="Para">
          <select value={to} onChange={(e) => setTo(e.target.value)} className={selectClass}>
            <option value="">Selecione um jogador</option>
            {players.map((p) => (
              <option key={p.name} value={p.name}>
                {p.name}{p.isBanker ? ' ★' : ''}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Valor (R$)">
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0,00"
            min="1"
            step="1"
            className={inputClass}
          />
        </Field>

        <button
          type="submit"
          className="w-full bg-emerald-500 hover:bg-emerald-400 text-white font-bold py-4 rounded-2xl transition-colors shadow-lg shadow-emerald-500/20 mt-1"
        >
          Enviar Pix
        </button>
      </form>
    </div>
  )
}

const inputClass =
  'w-full bg-[#141929] border border-white/10 text-white placeholder-slate-500 rounded-2xl px-4 py-3.5 outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition'
const selectClass =
  'w-full bg-[#141929] border border-white/10 text-white rounded-2xl px-4 py-3.5 outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition'

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
        {label}
      </label>
      {children}
    </div>
  )
}

function Alert({ variant, children }) {
  const styles = {
    error: 'bg-red-500/10 border-red-500/30 text-red-400',
    success: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
  }
  return (
    <div className={`border rounded-2xl p-3 text-sm ${styles[variant]}`}>
      {children}
    </div>
  )
}
