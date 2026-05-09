import { useState } from 'react'
import { useGame } from '../context/GameContext.jsx'

export default function BankPanel({ players }) {
  const { bankCredit, bankDebit } = useGame()
  const [op, setOp] = useState('credit')
  const [targetPlayer, setTargetPlayer] = useState('')
  const [amount, setAmount] = useState('')
  const [localError, setLocalError] = useState(null)
  const [success, setSuccess] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLocalError(null)
    setSuccess('')
    if (!targetPlayer) return setLocalError('Selecione um jogador.')
    const val = parseFloat(amount)
    if (!val || val <= 0) return setLocalError('Informe um valor válido.')

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
    }
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
          className={`w-full font-bold py-4 rounded-2xl transition-colors text-white shadow-lg mt-1 ${
            op === 'credit'
              ? 'bg-emerald-500 hover:bg-emerald-400 shadow-emerald-500/20'
              : 'bg-red-500 hover:bg-red-400 shadow-red-500/20'
          }`}
        >
          {op === 'credit' ? 'Creditar Jogador' : 'Debitar Jogador'}
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
