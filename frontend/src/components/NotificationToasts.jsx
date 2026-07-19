const META = {
  pix:         { emoji: '💸', accent: 'border-emerald-500/30' },
  bank_credit: { emoji: '⬆️', accent: 'border-blue-500/30' },
  bank_debit:  { emoji: '⬇️', accent: 'border-red-500/30' },
}

export default function NotificationToasts({ toasts }) {
  if (toasts.length === 0) return null

  return (
    <div
      className="fixed top-0 inset-x-0 z-[70] flex flex-col items-center gap-2 px-4 max-w-lg mx-auto pointer-events-none"
      style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}
    >
      {toasts.map((toast) => (
        <ToastCard key={toast.id} toast={toast} />
      ))}
    </div>
  )
}

function ToastCard({ toast }) {
  const meta = META[toast.kind] ?? META.pix
  return (
    <div
      className={`w-full bg-[#141929]/95 backdrop-blur border ${meta.accent} rounded-2xl shadow-2xl shadow-black/40 px-4 py-3 flex items-start gap-3 pointer-events-auto ${
        toast.leaving ? 'animate-slide-up' : 'animate-slide-down'
      }`}
    >
      <span className="text-xl leading-none flex-shrink-0">{meta.emoji}</span>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-white truncate">{toast.title}</p>
        <p className="text-xs text-slate-400 mt-0.5">{toast.message}</p>
      </div>
    </div>
  )
}
