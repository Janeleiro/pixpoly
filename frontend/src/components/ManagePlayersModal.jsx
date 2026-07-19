import { useEffect, useState } from 'react'
import { useGame } from '../context/GameContext.jsx'

export default function ManagePlayersModal({ players, onClose }) {
  const { deactivatePlayer } = useGame()
  const [confirming, setConfirming] = useState(null)
  const [busy, setBusy] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const handleDeactivate = async (name) => {
    setBusy(name)
    setError(null)
    try {
      await deactivatePlayer(name)
      setConfirming(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(null)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm bg-[#141929] border border-white/10 rounded-3xl overflow-hidden shadow-2xl max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 pt-5 pb-3 flex-shrink-0">
          <h2 className="text-lg font-bold text-white">Gerenciar jogadores</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white font-bold text-lg leading-none"
          >
            ×
          </button>
        </div>

        {error && (
          <div className="mx-5 mb-2 bg-red-500/10 border border-red-500/30 text-red-400 rounded-2xl p-3 text-sm">
            {error}
          </div>
        )}

        <div className="px-5 pb-5 space-y-2 overflow-y-auto">
          {players.length === 0 ? (
            <p className="text-sm text-slate-500 py-6 text-center">Nenhum jogador na sala ainda.</p>
          ) : (
            players.map((p) => {
              const inactive = p.active === false
              return (
                <div
                  key={p.name}
                  className="flex items-center bg-[#0f1420] rounded-2xl px-4 py-3 border border-white/5"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{p.name}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {p.isPlayer ? 'Jogador' : 'Não jogador'}
                    </p>
                  </div>
                  {inactive ? (
                    <span className="text-xs bg-slate-600/30 text-slate-400 font-semibold px-3 py-1.5 rounded-full flex-shrink-0">
                      Inativado
                    </span>
                  ) : confirming === p.name ? (
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <button
                        onClick={() => handleDeactivate(p.name)}
                        disabled={busy === p.name}
                        className="text-xs bg-red-500 hover:bg-red-400 disabled:opacity-50 text-white font-semibold px-3 py-1.5 rounded-full transition-colors"
                      >
                        {busy === p.name ? '...' : 'Confirmar'}
                      </button>
                      <button
                        onClick={() => setConfirming(null)}
                        className="text-xs bg-white/5 hover:bg-white/10 text-slate-300 font-semibold px-3 py-1.5 rounded-full transition-colors"
                      >
                        Cancelar
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirming(p.name)}
                      className="text-xs bg-red-500/10 hover:bg-red-500/20 text-red-400 font-semibold px-3 py-1.5 rounded-full border border-red-500/20 transition-colors flex-shrink-0"
                    >
                      Inativar
                    </button>
                  )}
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
