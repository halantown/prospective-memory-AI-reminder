import { useGameStore } from '../../store/gameStore'

export default function ActivityLabel() {
  const activityLabel = useGameStore(s => s.activityLabel)
  const currentRoom = useGameStore(s => s.currentRoom)

  return (
    <div className="text-center px-2 py-1.5">
      <div className="text-xs text-slate-400 uppercase tracking-wider font-medium">
        {currentRoom}
      </div>
      {activityLabel && (
        <div className="text-sm text-slate-600 mt-0.5 leading-snug">
          {activityLabel}
        </div>
      )}
    </div>
  )
}
