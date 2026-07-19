import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useGame } from '../context/GameContext.jsx'

const digitsOnly = (value) => value.replace(/\D/g, '')

export default function Home() {
  const { createRoom, joinRoom, wsError } = useGame()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const preCode = searchParams.get('code') || ''
  const [tab, setTab] = useState(preCode ? 'join' : 'create')
  const [bankerName, setBankerName] = useState('')
  const [bankerPin, setBankerPin] = useState('')
  const [initialBalance, setInitialBalance] = useState('1500')
  const [bankerIsPlayer, setBankerIsPlayer] = useState(true)
  const [visibleBalance, setVisibleBalance] = useState(true)
  const [joinCode, setJoinCode] = useState(preCode)
  const [joinName, setJoinName] = useState('')
  const [joinPin, setJoinPin] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleCreate = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      if (bankerPin.length !== 4) throw new Error('O PIN deve ter 4 dígitos.')
      if (!initialBalance || Number(initialBalance) < 1) throw new Error('Informe um saldo inicial válido.')
      const code = await createRoom(bankerName.trim(), Number(initialBalance), bankerIsPlayer, bankerPin, visibleBalance)
      navigate(`/room/${code}`)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleJoin = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      if (joinPin.length !== 4) throw new Error('O PIN deve ter 4 dígitos.')
      const code = joinCode.trim().toUpperCase()
      await joinRoom(code, joinName.trim(), joinPin)
      navigate(`/room/${code}`)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0e1a] flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-emerald-500 flex items-center justify-center mx-auto mb-3 shadow-lg shadow-emerald-500/30">
            <span className="text-3xl">🏦</span>
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">PixPoly</h1>
          <p className="text-slate-400 mt-1 text-sm">Banco Imobiliário Digital</p>
        </div>

        {/* Error banner */}
        {(error || wsError) && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 rounded-2xl p-3 mb-4 text-sm text-center">
            {error || wsError}
          </div>
        )}

        {/* Card */}
        <div className="bg-[#141929] border border-white/5 rounded-3xl overflow-hidden shadow-2xl">
          {/* Tabs */}
          <div className="flex p-1.5 gap-1 bg-[#0a0e1a]">
            {[
              { value: 'create', label: 'Nova Sala' },
              { value: 'join', label: 'Entrar' },
            ].map((t) => (
              <button
                key={t.value}
                onClick={() => { setTab(t.value); setError(null) }}
                className={`flex-1 py-2.5 text-sm font-semibold rounded-xl transition-all ${
                  tab === t.value
                    ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="p-5">
            {tab === 'create' ? (
              <form onSubmit={handleCreate} className="space-y-4">
                <Field label="Seu nome (Banqueiro)">
                  <input
                    type="text"
                    value={bankerName}
                    onChange={(e) => setBankerName(e.target.value)}
                    placeholder="Ex: João"
                    required
                    maxLength={20}
                    className={inputClass}
                  />
                </Field>
                <PinField
                  label="Crie um PIN de 4 dígitos"
                  value={bankerPin}
                  onChange={(value) => setBankerPin(value)}
                />
                <Field label="Saldo inicial (R$)">
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={initialBalance}
                    onChange={(e) => setInitialBalance(digitsOnly(e.target.value))}
                    required
                    className={inputClass}
                  />
                </Field>

                <ToggleField
                  label="Participar como jogador"
                  description={bankerIsPlayer ? 'Você terá saldo e poderá enviar Pix' : 'Apenas gerencia o banco'}
                  checked={bankerIsPlayer}
                  onToggle={() => setBankerIsPlayer((v) => !v)}
                />

                <ToggleField
                  label="Saldo visível"
                  description={visibleBalance ? 'Todos veem o saldo e o extrato de todos' : 'Cada jogador só vê o próprio saldo e extrato'}
                  checked={visibleBalance}
                  onToggle={() => setVisibleBalance((v) => !v)}
                />

                <SubmitBtn loading={loading} label="Criar Sala" loadingLabel="Criando..." />
              </form>
            ) : (
              <form onSubmit={handleJoin} className="space-y-4">
                <Field label="Código da Sala">
                  <input
                    type="text"
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                    placeholder="ABCXYZ"
                    maxLength={6}
                    required
                    className={`${inputClass} text-center tracking-[0.4em] text-xl font-mono uppercase`}
                  />
                </Field>
                <Field label="Seu nome">
                  <input
                    type="text"
                    value={joinName}
                    onChange={(e) => setJoinName(e.target.value)}
                    placeholder="Ex: Maria"
                    required
                    maxLength={20}
                    className={inputClass}
                  />
                </Field>
                <PinField
                  label="Seu PIN de 4 dígitos"
                  value={joinPin}
                  onChange={(value) => setJoinPin(value)}
                />
                <p className="text-xs text-slate-500 -mt-2">
                  Já jogou nesta sala? Use o mesmo nome e PIN para retomar sua conta (o dispositivo antigo será desconectado).
                </p>
                <SubmitBtn loading={loading} label="Entrar na Sala" loadingLabel="Entrando..." />
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

const inputClass =
  'w-full bg-white/5 border border-white/10 text-white placeholder-slate-500 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition'

function PinField({ label, value, onChange }) {
  return (
    <Field label={label}>
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        autoComplete="off"
        value={value}
        onChange={(e) => onChange(digitsOnly(e.target.value).slice(0, 4))}
        placeholder="••••"
        maxLength={4}
        required
        style={{ WebkitTextSecurity: 'disc', textSecurity: 'disc' }}
        className={`${inputClass} text-center tracking-[0.5em]`}
      />
    </Field>
  )
}

function ToggleField({ label, description, checked, onToggle }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="w-full flex items-center justify-between bg-white/5 hover:bg-white/8 rounded-xl px-4 py-3 transition-colors"
    >
      <div className="text-left">
        <p className="text-sm font-medium text-white">{label}</p>
        <p className="text-xs text-slate-400 mt-0.5">{description}</p>
      </div>
      <div className={`w-11 h-6 rounded-full transition-colors flex-shrink-0 ml-3 relative ${checked ? 'bg-emerald-500' : 'bg-slate-600'}`}>
        <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${checked ? 'translate-x-5' : 'translate-x-0.5'}`} />
      </div>
    </button>
  )
}

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

function SubmitBtn({ loading, label, loadingLabel }) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-4 rounded-xl transition-colors shadow-lg shadow-emerald-500/20 mt-1"
    >
      {loading ? loadingLabel : label}
    </button>
  )
}

