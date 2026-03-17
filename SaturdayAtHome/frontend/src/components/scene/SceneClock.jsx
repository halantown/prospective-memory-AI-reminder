import { useGameStore } from '../../store/gameStore'

export default function SceneClock() {
  const time = useGameStore(s => s.simulatedTime)

  return (
    <div className="absolute top-2 right-4 z-40 bg-white/90 backdrop-blur-sm rounded-lg shadow-md border border-stone-200 px-3 py-1.5 flex items-center gap-2">
      <span className="text-lg">🕐</span>
      <div>
        <div className="text-sm font-mono font-bold text-stone-800 leading-none">
          {time || '--:--'}
        </div>
        <div className="text-[9px] text-stone-400">Saturday</div>
      </div>
    </div>
  )
}
