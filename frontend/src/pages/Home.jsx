import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useGame } from '../context/GameContext.jsx'

export default function Home() {
  const { createRoom, joinRoom } = useGame()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const preCode = searchParams.get('code') || ''
  const [tab, setTab] = useState(preCode ? 'join' : 'create')
  const [bankerName, setBankerName] = useState('')
  const [initialBalance, setInitialBalance] = useState(1500)
  const [bankerIsPlayer, setBankerIsPlayer] = useState(true)
  const [joinCode, setJoinCode] = useState(preCode)
  const [joinName, setJoinName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleCreate = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const code = await createRoom(bankerName.trim(), Number(initialBalance), bankerIsPlayer)
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
      const code = joinCode.trim().toUpperCase()
      await joinRoom(code, joinName.trim())
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
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 rounded-2xl p-3 mb-4 text-sm text-center">
            {error}
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
                <Field label="Saldo inicial (R$)">
                  <input
                    type="number"
                    value={initialBalance}
                    onChange={(e) => setInitialBalance(e.target.value)}
                    min="1"
                    required
                    className={inputClass}
                  />
                </Field>

                {/* Toggle: também será jogador */}
                <button
                  type="button"
                  onClick={() => setBankerIsPlayer((v) => !v)}
                  className="w-full flex items-center justify-between bg-white/5 hover:bg-white/8 rounded-xl px-4 py-3 transition-colors"
                >
                  <div className="text-left">
                    <p className="text-sm font-medium text-white">Participar como jogador</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {bankerIsPlayer ? 'Você terá saldo e poderá enviar Pix' : 'Apenas gerencia o banco'}
                    </p>
                  </div>
                  <div className={`w-11 h-6 rounded-full transition-colors flex-shrink-0 ml-3 relative ${bankerIsPlayer ? 'bg-emerald-500' : 'bg-slate-600'}`}>
                    <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${bankerIsPlayer ? 'translate-x-5' : 'translate-x-0.5'}`} />
                  </div>
                </button>

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

