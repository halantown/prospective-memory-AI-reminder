import { useGameStore } from '../../store/gameStore'

export default function TopBar() {
  const blockNumber = useGameStore((s) => s.blockNumber)
  const totalBlocks = useGameStore((s) => s.totalBlocks)
  const condition = useGameStore((s) => s.condition)
  const worldClockLabel = useGameStore((s) => s.worldClockLabel)

  return (
    <div className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-6 z-30 shadow-sm">
      <div className="flex items-center gap-2">
        <span className="text-sm text-slate-500 font-medium">Simulated time</span>
        <span className="text-xl font-black text-slate-800 tabular-nums">{worldClockLabel}</span>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-sm text-slate-500 font-medium">Block</span>
        <span className="text-lg font-bold text-slate-700">{blockNumber} / {totalBlocks}</span>
      </div>

      <div className="text-sm font-semibold text-indigo-700">{condition || '—'}</div>
    </div>
  )
}
