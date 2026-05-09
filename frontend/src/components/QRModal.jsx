import { useEffect } from 'react'
import QRCode from 'react-qr-code'

export default function QRModal({ roomCode, onClose }) {
  const url = `${window.location.origin}/room/${roomCode}`

  // Close on Escape key
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center p-6"
      onClick={onClose}
    >
      <p className="text-slate-400 text-xs uppercase tracking-widest mb-6">Escanear para entrar</p>

      <div
        className="bg-white p-5 rounded-3xl shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <QRCode value={url} size={220} />
      </div>

      <div className="mt-6 text-center" onClick={(e) => e.stopPropagation()}>
        <p className="text-slate-400 text-xs mb-1">Código da sala</p>
        <p className="font-mono font-bold text-3xl tracking-[0.4em] text-white">{roomCode}</p>
        <p className="text-slate-500 text-xs mt-2 break-all max-w-xs">{url}</p>
      </div>

      <button
        onClick={onClose}
        className="mt-10 px-8 py-3 bg-white/10 hover:bg-white/20 text-white rounded-2xl text-sm font-medium transition-colors"
      >
        Fechar
      </button>
    </div>
  )
}
