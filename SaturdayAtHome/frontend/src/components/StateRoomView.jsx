import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { useGameStore } from '../store/gameStore'

const roomTheme = {
  kitchen: 'from-orange-100 to-amber-50 border-orange-200',
  living_room: 'from-sky-100 to-cyan-50 border-sky-200',
  balcony: 'from-emerald-100 to-green-50 border-emerald-200',
  entrance: 'from-violet-100 to-purple-50 border-violet-200',
}

const roomLabel = {
  kitchen: 'Kitchen',
  living_room: 'Living Room',
  balcony: 'Balcony',
  entrance: 'Entrance',
}

const roomOrder = ['kitchen', 'living_room', 'balcony', 'entrance']

export default function StateRoomView() {
  const remoteConfig = useGameStore((s) => s.remoteConfig)
  const currentRoom = useGameStore((s) => s.currentRoom)
  const currentActivity = useGameStore((s) => s.currentActivity)
  const roomTransitioning = useGameStore((s) => s.roomTransitioning)
  const ongoingState = useGameStore((s) => s.ongoingState)
  const markOngoingInteraction = useGameStore((s) => s.markOngoingInteraction)

  const { activityLabel, prompt } = useMemo(() => {
    const templates = remoteConfig?.rooms?.[currentRoom]?.activity_templates || {}
    const template = templates[currentActivity] || {}
    const prompts = Array.isArray(template.prompts) ? template.prompts : []
    const completed = ongoingState?.[currentRoom]?.completed || 0
    const promptItem = prompts.length > 0 ? prompts[completed % prompts.length] : null

    return {
      activityLabel: template.label || currentActivity?.replace(/_/g, ' ') || 'Activity',
      prompt: promptItem,
    }
  }, [remoteConfig, currentRoom, currentActivity, ongoingState])

  const bgTheme = roomTheme[currentRoom] || roomTheme.kitchen

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <motion.div
        key={`${currentRoom}:${currentActivity}`}
        initial={{ opacity: 0.25, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: roomTransitioning ? 0.35 : 0.2 }}
        className={`mx-6 mt-5 rounded-3xl border bg-gradient-to-br ${bgTheme} p-6 shadow-sm`}
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-2xl font-bold text-slate-800">{roomLabel[currentRoom] || currentRoom}</h2>
          <span className="text-sm font-semibold text-slate-600">{activityLabel}</span>
        </div>

        <p className="text-sm text-slate-600 mb-4">
          Complete lightweight decisions naturally. There is no urgency penalty.
        </p>

        {prompt ? (
          <div className="bg-white/80 border border-white rounded-2xl p-4">
            <p className="text-base font-medium text-slate-800 mb-3">{prompt.instruction}</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {(prompt.options || []).map((opt, idx) => (
                <button
                  key={`${opt}-${idx}`}
                  onClick={() => markOngoingInteraction(currentRoom, idx)}
                  className="px-3 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-left text-sm font-medium text-slate-700"
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="bg-white/80 border border-white rounded-2xl p-4 text-slate-500 text-sm">
            No prompt configured for this activity.
          </div>
        )}
      </motion.div>

      <div className="mx-6 mt-4 mb-5 grid grid-cols-4 gap-2">
        {roomOrder.map((roomId) => {
          const active = roomId === currentRoom
          const completed = ongoingState?.[roomId]?.completed || 0
          return (
            <div
              key={roomId}
              className={`rounded-xl border px-3 py-2 ${active ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-700 border-slate-200'}`}
            >
              <div className="text-xs font-semibold uppercase tracking-wide">{roomLabel[roomId]}</div>
              <div className={`text-xs mt-1 ${active ? 'text-indigo-100' : 'text-slate-500'}`}>
                interactions: {completed}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
