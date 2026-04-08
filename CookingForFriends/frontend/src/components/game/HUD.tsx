/** HUD — game clock + combined score (kitchen + dining). */

import { useGameStore } from '../../stores/gameStore'
import { ClockTriggerEffect } from './TriggerEffects'

export default function HUD() {
  const gameClock = useGameStore((s) => s.gameClock)
  const kitchenScore = useGameStore((s) => s.kitchenScore)
  const diningScore = useGameStore((s) => s.diningScore)
  const totalScore = kitchenScore + diningScore

  return (
    <div className="absolute top-3 left-3 right-3 z-10 flex items-center justify-between pointer-events-none">
      {/* Clock */}
      <div className="bg-slate-800/80 backdrop-blur rounded-lg px-4 py-2 flex items-center">
        <span className="text-white text-sm font-mono font-bold relative">
          {gameClock}
          <ClockTriggerEffect />
        </span>
      </div>

      {/* Score */}
      {false && (
      <div className="bg-slate-800/80 backdrop-blur rounded-lg px-4 py-2 flex items-center gap-3">
        <span className="text-yellow-300 text-sm font-bold">⭐ {totalScore}</span>
        <span className="text-slate-500 text-[9px]">🍳{kitchenScore} 🍽️{diningScore}</span>
      </div>
      )}
    </div>
  )
}
