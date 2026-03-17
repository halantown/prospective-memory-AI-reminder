import { useGameStore } from '../../store/gameStore'

export default function Clock() {
  const time = useGameStore(s => s.simulatedTime)
  return (
    <div className="text-center p-2 bg-slate-100 rounded-lg">
      <div className="text-2xl font-mono font-bold text-slate-700">{time}</div>
      <div className="text-xs text-slate-400 mt-0.5">Saturday</div>
    </div>
  )
}
