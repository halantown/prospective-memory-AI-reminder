import { useGameStore } from '../../store/gameStore'

const roomLabel = {
  kitchen: 'Kitchen',
  living_room: 'Living Room',
  balcony: 'Balcony',
  entrance: 'Entrance',
}

const roomOrder = ['kitchen', 'living_room', 'balcony', 'entrance']

export default function Sidebar() {
  const currentRoom = useGameStore((s) => s.currentRoom)
  const currentActivity = useGameStore((s) => s.currentActivity)
  const dayPhase = useGameStore((s) => s.dayPhase)
  const sseConnected = useGameStore((s) => s.sseConnected)
  const trigger = useGameStore((s) => s.trigger)
  const ongoingInteractions = useGameStore((s) => s.questionnaire.ongoingInteractionCount)
  const ongoingState = useGameStore((s) => s.ongoingState)

  return (
    <div className="w-60 bg-slate-900 text-slate-200 border-l border-slate-800 p-4 flex flex-col gap-4 overflow-y-auto">
      <div className="rounded-xl bg-slate-800 p-3 border border-slate-700">
        <div className="text-xs uppercase tracking-wider text-slate-400 mb-1">System status</div>
        <div className="text-sm">Stream: <span className={sseConnected ? 'text-emerald-300' : 'text-red-300'}>{sseConnected ? 'connected' : 'reconnecting'}</span></div>
        <div className="text-sm">Day phase: <span className="text-slate-100">{dayPhase}</span></div>
      </div>

      <div className="rounded-xl bg-slate-800 p-3 border border-slate-700">
        <div className="text-xs uppercase tracking-wider text-slate-400 mb-1">Current state</div>
        <div className="text-sm font-semibold text-slate-100">{roomLabel[currentRoom] || currentRoom}</div>
        <div className="text-xs text-slate-300 mt-1">{currentActivity?.replace(/_/g, ' ')}</div>
      </div>

      <div className="rounded-xl bg-slate-800 p-3 border border-slate-700">
        <div className="text-xs uppercase tracking-wider text-slate-400 mb-2">Room strip (system-controlled)</div>
        <div className="space-y-2">
          {roomOrder.map((room) => {
            const active = room === currentRoom
            const interactions = ongoingState?.[room]?.completed || 0
            return (
              <div
                key={room}
                className={`rounded-lg px-3 py-2 border ${active ? 'bg-indigo-600/40 border-indigo-400 text-white' : 'bg-slate-900 border-slate-700 text-slate-300'}`}
              >
                <div className="text-sm font-semibold">{roomLabel[room]}</div>
                <div className="text-xs opacity-90">interactions: {interactions}</div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="rounded-xl bg-slate-800 p-3 border border-slate-700">
        <div className="text-xs uppercase tracking-wider text-slate-400 mb-1">PM trigger</div>
        {trigger.visible ? (
          <div>
            <div className="text-sm font-semibold text-amber-300">Task active · Slot {trigger.slot}</div>
            <div className="text-xs text-slate-300 mt-1">{trigger.taskId}</div>
          </div>
        ) : (
          <div className="text-sm text-slate-400">No active trigger window</div>
        )}
      </div>

      <div className="rounded-xl bg-slate-800 p-3 border border-slate-700">
        <div className="text-xs uppercase tracking-wider text-slate-400 mb-1">Engagement count</div>
        <div className="text-xl font-bold text-slate-100">{ongoingInteractions}</div>
      </div>
    </div>
  )
}
