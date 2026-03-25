import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useGameStore } from '../../store/gameStore'

const SCENE_ROOMS = [
  {
    id: 'study', label: 'Study',
    style: { left: '0.5%', top: '0.5%', width: '29%', height: '48%' },
    color: '#e0f2fe', borderColor: '#93c5fd',
    furniture: [
      { emoji: '💻', left: '30%', top: '30%' },
      { emoji: '📚', left: '72%', top: '20%' },
      { emoji: '🪑', left: '42%', top: '58%' },
      { emoji: '💡', left: '78%', top: '55%' },
      { emoji: '📝', left: '18%', top: '68%' },
    ],
  },
  {
    id: 'kitchen', label: 'Kitchen',
    style: { left: '30.5%', top: '0.5%', width: '29%', height: '48%' },
    color: '#fef3c7', borderColor: '#fcd34d',
    furniture: [
      { emoji: '🍳', left: '20%', top: '28%' },
      { emoji: '🍽️', left: '55%', top: '48%', triggerId: 'dinner_table' },
      { emoji: '⏲️', left: '82%', top: '22%', triggerId: 'kitchen_timer' },
      { emoji: '☕', left: '35%', top: '70%' },
    ],
  },
  {
    id: 'living', label: 'Living Room',
    style: { left: '60.5%', top: '0.5%', width: '39%', height: '54%' },
    color: '#fef9ef', borderColor: '#d4a574',
    furniture: [
      { emoji: '🛋️', left: '22%', top: '48%' },
      { emoji: '📺', left: '72%', top: '20%', triggerId: 'tv_weather' },
      { emoji: '☕', left: '48%', top: '68%' },
      { emoji: '💬', left: '85%', top: '58%', triggerId: 'friend_leaving' },
      { emoji: '🕐', left: '8%', top: '12%', triggerId: 'clock_3pm' },
    ],
  },
  {
    id: 'laundry', label: 'Laundry',
    style: { left: '0.5%', top: '50.5%', width: '29%', height: '49%' },
    color: '#f3f4f6', borderColor: '#9ca3af',
    furniture: [
      { emoji: '🫧', left: '35%', top: '38%', triggerId: 'washing_machine' },
      { emoji: '🧺', left: '72%', top: '60%' },
      { emoji: '🧴', left: '18%', top: '68%' },
    ],
  },
  {
    id: 'entrance', label: 'Entrance',
    style: { left: '30.5%', top: '50.5%', width: '29%', height: '49%' },
    color: '#ecfdf5', borderColor: '#6ee7b7',
    furniture: [
      { emoji: '🚪', left: '50%', top: '25%', triggerId: 'doorbell' },
      { emoji: '📱', left: '18%', top: '62%', triggerId: 'phone_notification' },
      { emoji: '👟', left: '78%', top: '65%' },
      { emoji: '🧥', left: '82%', top: '28%' },
    ],
  },
  {
    id: 'balcony', label: 'Balcony',
    style: { left: '60.5%', top: '56.5%', width: '39%', height: '43%' },
    color: '#fefce8', borderColor: '#fde047',
    furniture: [
      { emoji: '🪑', left: '22%', top: '32%' },
      { emoji: '🌱', left: '68%', top: '28%' },
      { emoji: '🌤️', left: '48%', top: '65%' },
      { emoji: '🌸', left: '85%', top: '62%' },
    ],
  },
]

function getRoomCenter(roomId) {
  const room = SCENE_ROOMS.find(r => r.id === roomId)
  if (!room) return { x: 15, y: 25 }
  const left = parseFloat(room.style.left)
  const top = parseFloat(room.style.top)
  const width = parseFloat(room.style.width)
  const height = parseFloat(room.style.height)
  return { x: left + width * 0.4, y: top + height * 0.55 }
}

function SceneTrigger({ emoji, style, trigger, onClick }) {
  if (!trigger) {
    return (
      <span className="absolute text-xl select-none opacity-50 pointer-events-none" style={style}>
        {emoji}
      </span>
    )
  }

  const isFired = trigger.state === 'fired'
  const isAmbient = trigger.state === 'ambient'

  return (
    <span
      className={`absolute text-xl select-none transition-all duration-300 ${
        isFired
          ? 'scene-trigger-fired cursor-pointer z-10 scale-125 opacity-100'
          : isAmbient
            ? 'scene-trigger-ambient opacity-70 pointer-events-none'
            : 'opacity-50 pointer-events-none'
      }`}
      style={style}
      onClick={isFired ? onClick : undefined}
    >
      {emoji}
      {isFired && (
        <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-white scene-trigger-dot" />
      )}
    </span>
  )
}

export default function HomeScene() {
  const currentRoom = useGameStore(s => s.currentRoom)
  const triggers = useGameStore(s => s.triggers)
  const clickTrigger = useGameStore(s => s.clickTrigger)
  const robotText = useGameStore(s => s.robotText)
  const robotStatus = useGameStore(s => s.robotStatus)

  const [avatarPos, setAvatarPos] = useState(() => getRoomCenter(currentRoom))
  const [pepperPos, setPepperPos] = useState(() => getRoomCenter(currentRoom))

  useEffect(() => {
    const newPos = getRoomCenter(currentRoom)
    setAvatarPos(newPos)
    const timer = setTimeout(() => setPepperPos(newPos), 400)
    return () => clearTimeout(timer)
  }, [currentRoom])

  const pepperScreenPos = {
    x: pepperPos.x + 3,
    y: pepperPos.y - 4,
  }

  return (
    <div className="absolute inset-0 bg-slate-400 overflow-hidden">
      {/* Room divs */}
      {SCENE_ROOMS.map(room => {
        const isActive = currentRoom === room.id
        return (
          <div
            key={room.id}
            className="absolute rounded-sm"
            style={{
              ...room.style,
              backgroundColor: isActive ? room.color : `${room.color}cc`,
              border: `2px solid ${isActive ? room.borderColor : '#94a3b8'}`,
              transition: 'background-color 0.5s, border-color 0.5s',
            }}
          >
            {/* Active room highlight */}
            {isActive && (
              <div
                className="absolute inset-0 pointer-events-none"
                style={{ boxShadow: `inset 0 0 20px ${room.borderColor}44` }}
              />
            )}

            {/* Room label */}
            <div className={`absolute top-1.5 left-2.5 text-[11px] font-bold uppercase tracking-wider ${
              isActive ? 'text-slate-700' : 'text-slate-500/80'
            }`}>
              {room.label}
            </div>

            {/* Furniture & triggers */}
            {room.furniture.map((item, i) => {
              const trigger = item.triggerId
                ? triggers.find(t => t.id === item.triggerId)
                : null
              return (
                <SceneTrigger
                  key={`${room.id}-${i}`}
                  emoji={item.emoji}
                  style={{ left: item.left, top: item.top }}
                  trigger={trigger}
                  onClick={() => trigger && clickTrigger(trigger.id)}
                />
              )
            })}
          </div>
        )
      })}

      {/* Avatar — blue circle */}
      <motion.div
        className="absolute z-20 flex flex-col items-center pointer-events-none"
        animate={{ left: `${avatarPos.x}%`, top: `${avatarPos.y}%` }}
        transition={{ duration: 2, ease: 'easeInOut' }}
        style={{ transform: 'translate(-50%, -50%)' }}
      >
        <div className="w-5 h-5 bg-blue-500 rounded-full border-2 border-white shadow-lg" />
        <span className="text-[9px] text-blue-800 font-bold mt-0.5 bg-white/70 px-1 rounded">You</span>
      </motion.div>

      {/* Pepper — robot emoji */}
      <motion.div
        className="absolute z-20 pointer-events-none"
        animate={{ left: `${pepperScreenPos.x}%`, top: `${pepperScreenPos.y}%` }}
        transition={{ duration: 2, ease: 'easeInOut', delay: 0.2 }}
        style={{ transform: 'translate(-50%, -50%)' }}
      >
        <motion.span
          className="text-base inline-block"
          animate={robotStatus === 'speaking' ? { scale: [1, 1.15, 1] } : {}}
          transition={robotStatus === 'speaking' ? { duration: 0.5, repeat: Infinity } : {}}
        >
          🤖
        </motion.span>
      </motion.div>

      {/* Robot speech bubble — near Pepper */}
      <AnimatePresence>
        {robotText && (
          <motion.div
            className="absolute z-30"
            style={{
              left: `${pepperScreenPos.x + 4}%`,
              top: `${pepperScreenPos.y - 6}%`,
              transform: 'translate(-50%, -100%)',
            }}
            initial={{ opacity: 0, scale: 0.85, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.85, y: 8 }}
            transition={{ duration: 0.3 }}
          >
            <div className="bg-white/95 backdrop-blur-sm border border-slate-200 rounded-xl shadow-lg px-3 py-2 max-w-[220px] pointer-events-none">
              <div className="flex items-start gap-1.5">
                <span className="text-sm leading-none shrink-0 mt-0.5">🤖</span>
                <p className="text-xs text-slate-700 leading-relaxed">{robotText}</p>
              </div>
              <div className="absolute -bottom-1.5 left-6 w-3 h-3 bg-white border-r border-b border-slate-200 rotate-45" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
