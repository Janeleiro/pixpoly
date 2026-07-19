import { useEffect, useState } from 'react'
import { useGame } from '../context/GameContext.jsx'

export default function PixForm({ players, selectedPlayerName = '', onSuccess, disabled = false }) {
  const { sendPix } = useGame()
  const [to, setTo] = useState('')
  const [amount, setAmount] = useState('')
  const [localError, setLocalError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  // Aplica uma seleção nova vinda do pai (ex: toque num jogador na Home) uma
  // única vez, só quando `selectedPlayerName` muda — não a cada re-render —
  // para não sobrescrever uma troca manual no <select> quando `players`
  // ganha uma referência nova por causa de um broadcast qualquer da sala.
  useEffect(() => {
    if (!selectedPlayerName) return
    const hasSelectedPlayer = players.some((player) => player.name === selectedPlayerName)
    setTo(hasSelectedPlayer ? selectedPlayerName : '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPlayerName])

  // Se o jogador selecionado sumir da lista (ex: foi inativado), limpa a seleção.
  useEffect(() => {
    setTo((currentTo) => (currentTo && !players.some((player) => player.name === currentTo) ? '' : currentTo))
  }, [players])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (submitting) return
    setLocalError(null)
    if (!to) return setLocalError('Selecione um destinatário.')
    const val = parseFloat(amount)
    if (!val || val <= 0) return setLocalError('Informe um valor válido.')

    setSubmitting(true)
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
    } finally {
      setSubmitting(false)
    }
  }

  if (disabled) {
    return (
      <Alert variant="error">
        Sua conta foi inativada pelo banqueiro. Você não pode enviar Pix.
      </Alert>
    )
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
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))}
            placeholder="0"
            className={inputClass}
          />
        </Field>

        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold py-4 rounded-2xl transition-colors shadow-lg shadow-emerald-500/20 mt-1 flex items-center justify-center gap-2"
        >
          {submitting && <Spinner />}
          {submitting ? 'Enviando...' : 'Enviar Pix'}
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

function Spinner() {
  return (
    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  )
}
