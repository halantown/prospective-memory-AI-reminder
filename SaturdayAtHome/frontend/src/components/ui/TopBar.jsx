import { useGameStore } from '../../store/gameStore'
import { HelpCircle } from 'lucide-react'

export default function TopBar() {
  const score = useGameStore((s) => s.score)
  const blockNumber = useGameStore((s) => s.blockNumber)
  const totalBlocks = useGameStore((s) => s.totalBlocks)
  return (
    <div className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-6 z-30 shadow-sm">
      <div className="flex items-center gap-2">
        <span className="text-sm text-slate-500 font-medium">Score</span>
        <span className="text-xl font-black text-slate-800 tabular-nums">{score} pts</span>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-sm text-slate-500 font-medium">Block</span>
        <span className="text-lg font-bold text-slate-700">{blockNumber} / {totalBlocks}</span>
      </div>

      <button className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
        <HelpCircle size={20} />
      </button>
    </div>
  )
}
