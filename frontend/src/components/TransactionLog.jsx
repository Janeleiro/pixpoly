import { useState } from 'react'

const TX_META = {
  pix:         { label: 'Pix',           emoji: '💸', badge: 'bg-emerald-500/10 text-emerald-400', amount: 'text-emerald-400' },
  bank_credit: { label: 'Crédito Banco', emoji: '⬆️', badge: 'bg-blue-500/10 text-blue-400',    amount: 'text-blue-400'    },
  bank_debit:  { label: 'Débito Banco',  emoji: '⬇️', badge: 'bg-red-500/10 text-red-400',      amount: 'text-red-400'     },
}

const involves = (tx, name) => tx.from === name || tx.to === name

export default function TransactionLog({ transactions, myName, isBanker = false, isBankerOnly = false, visibleBalance = true }) {
  const showMine = !isBankerOnly
  const tabs = [
    ...(showMine ? [{ value: 'meu', label: 'Meu' }] : []),
    ...(visibleBalance ? [{ value: 'geral', label: 'Geral' }] : []),
    ...(isBanker ? [{ value: 'banco', label: 'Banco' }] : []),
  ]
  const [tab, setTab] = useState(showMine ? 'meu' : 'geral')
  const activeTab = tabs.some((t) => t.value === tab) ? tab : tabs[0].value

  const filtered = transactions.filter((tx) => {
    if (activeTab === 'meu') return involves(tx, myName)
    if (activeTab === 'banco') return tx.from === 'Banco' || tx.to === 'Banco'
    return true
  })
  const sorted = [...filtered].reverse()

  return (
    <div className="space-y-4">
      {tabs.length > 1 && (
        <div className="flex p-1 gap-1 bg-[#141929] border border-white/5 rounded-2xl">
          {tabs.map((t) => (
            <button
              key={t.value}
              onClick={() => setTab(t.value)}
              className={`flex-1 py-2 text-sm font-semibold rounded-xl transition-all ${
                activeTab === t.value
                  ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      <div className="space-y-2">
        {sorted.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-slate-500">
            <span className="text-4xl mb-3">📋</span>
            <p className="text-sm">Nenhuma transação ainda.</p>
          </div>
        ) : (
          sorted.map((tx) => {
            const meta = TX_META[tx.type] ?? TX_META.pix
            const highlight = activeTab === 'geral' && involves(tx, myName)
            return (
              <div
                key={tx.id}
                className={`rounded-2xl p-4 border transition-colors ${
                  highlight
                    ? 'bg-emerald-500/5 border-emerald-500/40'
                    : 'bg-[#141929] border-white/5'
                }`}
              >
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
    </div>
  )
}
