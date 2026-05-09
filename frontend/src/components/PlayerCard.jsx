export default function PlayerCard({ player }) {
  return (
    <div className="bg-gray-800 rounded-2xl p-3 min-w-[130px] flex-shrink-0 border border-white/5">
      <div className="flex items-center gap-1.5 mb-1.5">
        <span className="w-2 h-2 rounded-full bg-green-400 flex-shrink-0" />
        <p className="text-sm font-semibold text-white truncate max-w-[90px]">{player.name}</p>
        {player.isBanker && <span className="text-yellow-400 text-xs ml-auto">★</span>}
      </div>
      <p className="text-green-400 font-bold text-sm tabular-nums">
        {player.balance?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
      </p>
    </div>
  )
}
