const TX_META = {
  pix:         { label: 'Pix',           emoji: '💸', badge: 'bg-emerald-500/10 text-emerald-400', amount: 'text-emerald-400' },
  bank_credit: { label: 'Crédito Banco', emoji: '⬆️', badge: 'bg-blue-500/10 text-blue-400',    amount: 'text-blue-400'    },
  bank_debit:  { label: 'Débito Banco',  emoji: '⬇️', badge: 'bg-red-500/10 text-red-400',      amount: 'text-red-400'     },
}

export default function TransactionLog({ transactions }) {
  const sorted = [...transactions].reverse()

  return (
    <div className="space-y-2">
      {sorted.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-slate-500">
          <span className="text-4xl mb-3">📋</span>
          <p className="text-sm">Nenhuma transação ainda.</p>
        </div>
      ) : (
        sorted.map((tx) => {
          const meta = TX_META[tx.type] ?? TX_META.pix
          return (
            <div key={tx.id} className="bg-[#141929] border border-white/5 rounded-2xl p-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-2xl bg-white/5 flex items-center justify-center text-lg flex-shrink-0">
                  {meta.emoji}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start">
                    <p className="text-sm font-semibold text-white truncate pr-2">
                      {tx.from} → {tx.to}
                    </p>
                    <p className={`font-bold text-sm tabular-nums flex-shrink-0 ${meta.amount}`}>
                      {tx.amount?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${meta.badge}`}>
                      {meta.label}
                    </span>
                    <span className="text-xs text-slate-500">
                      {new Date(tx.timestamp).toLocaleTimeString('pt-BR', {
                        hour: '2-digit', minute: '2-digit', second: '2-digit',
                      })}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )
        })
      )}
    </div>
  )
}
