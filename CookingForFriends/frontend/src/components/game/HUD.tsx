/** HUD — game clock + kitchen score. */

import { useGameStore } from '../../stores/gameStore'

export default function HUD() {
  const gameClock = useGameStore((s) => s.gameClock)
  const kitchenScore = useGameStore((s) => s.kitchenScore)
  const blockNumber = useGameStore((s) => s.blockNumber)

  return (
    <div className="absolute top-3 left-3 right-3 z-10 flex items-center justify-between pointer-events-none">
      {/* Block + Clock */}
      <div className="bg-slate-800/80 backdrop-blur rounded-lg px-4 py-2 flex items-center gap-4">
        <span className="text-cooking-300 text-xs font-medium">Block {blockNumber}</span>
        <span className="text-white text-sm font-mono font-bold">{gameClock}</span>
      </div>

      {/* Score */}
      <div className="bg-slate-800/80 backdrop-blur rounded-lg px-4 py-2">
        <span className="text-yellow-300 text-sm font-bold">⭐ {kitchenScore}</span>
      </div>
    </div>
  )
}
