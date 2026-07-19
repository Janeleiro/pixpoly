import { useEffect, useState } from 'react'
import { useGame } from '../context/GameContext.jsx'

export default function BankPanel({ players, selectedPlayerName = '', disabled = false }) {
  const { bankCredit, bankDebit } = useGame()
  const [op, setOp] = useState('credit')
  const [targetPlayer, setTargetPlayer] = useState('')
  const [amount, setAmount] = useState('')
  const [localError, setLocalError] = useState(null)
  const [success, setSuccess] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Aplica uma seleção nova vinda do pai (ex: toque num jogador na Home) uma
  // única vez, só quando `selectedPlayerName` muda — não a cada re-render —
  // para não sobrescrever uma troca manual no <select> quando `players`
  // ganha uma referência nova por causa de um broadcast qualquer da sala.
  useEffect(() => {
    if (!selectedPlayerName) return
    const hasSelectedPlayer = players.some((player) => player.name === selectedPlayerName)
    setTargetPlayer(hasSelectedPlayer ? selectedPlayerName : '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPlayerName])

  // Se o jogador selecionado sumir da lista (ex: foi inativado), limpa a seleção.
  useEffect(() => {
    setTargetPlayer((current) => (current && !players.some((player) => player.name === current) ? '' : current))
  }, [players])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (submitting) return
    setLocalError(null)
    setSuccess('')
    if (!targetPlayer) return setLocalError('Selecione um jogador.')
    const val = parseFloat(amount)
    if (!val || val <= 0) return setLocalError('Informe um valor válido.')

    setSubmitting(true)
    try {
      if (op === 'credit') {
        await bankCredit(targetPlayer, val)
        setSuccess(`Crédito de R$ ${val.toLocaleString('pt-BR')} enviado para ${targetPlayer}.`)
      } else {
        await bankDebit(targetPlayer, val)
        setSuccess(`Débito de R$ ${val.toLocaleString('pt-BR')} cobrado de ${targetPlayer}.`)
      }
      setAmount('')
      setTargetPlayer('')
      setTimeout(() => setSuccess(''), 3000)
    } catch (error) {
      setLocalError(error.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (disabled) {
    return (
      <Alert variant="error">
        Sua conta foi inativada pelo banqueiro. Você não pode realizar operações bancárias.
      </Alert>
    )
  }

  return (
    <div className="space-y-4">
      {localError && <Alert variant="error">{localError}</Alert>}
      {success && <Alert variant="success">{success}</Alert>}

      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="flex gap-2">
          <OpBtn label="Creditar" value="credit" active={op} setActive={setOp} color="emerald" />
          <OpBtn label="Debitar" value="debit" active={op} setActive={setOp} color="red" />
        </div>

        <Field label="Jogador">
          <select
            value={targetPlayer}
            onChange={(e) => setTargetPlayer(e.target.value)}
            className={selectClass}
          >
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
          className={`w-full font-bold py-4 rounded-2xl transition-colors text-white shadow-lg mt-1 flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed ${
            op === 'credit'
              ? 'bg-emerald-500 hover:bg-emerald-400 shadow-emerald-500/20'
              : 'bg-red-500 hover:bg-red-400 shadow-red-500/20'
          }`}
        >
          {submitting && <Spinner />}
          {submitting ? 'Enviando...' : op === 'credit' ? 'Creditar Jogador' : 'Debitar Jogador'}
        </button>
      </form>
    </div>
  )
}

function OpBtn({ label, value, active, setActive, color }) {
  const activeColors = {
    emerald: 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400',
    red: 'bg-red-500/15 border-red-500/40 text-red-400',
  }
  return (
    <button
      type="button"
      onClick={() => setActive(value)}
      className={`flex-1 py-3 rounded-2xl font-semibold border transition-colors ${
        active === value
          ? activeColors[color]
          : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'
      }`}
    >
      {label}
    </button>
  )
}

const inputClass =
  'w-full bg-[#141929] border border-white/10 text-white placeholder-slate-500 rounded-2xl px-4 py-3.5 outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition'
const selectClass =
  'w-full bg-[#141929] border border-white/10 text-white rounded-2xl px-4 py-3.5 outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition'

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
