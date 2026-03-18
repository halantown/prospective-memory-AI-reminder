import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useGameStore } from '../../store/gameStore'
import Clock from '../sidebar/Clock'

// Minimap room layout (percentage-based within the SVG viewBox)
const MAP_ROOMS = [
  { id: 'study',    label: 'Study',   x: 2,  y: 2,  w: 48, h: 32, color: '#e0f2fe', border: '#93c5fd',
    furniture: [{ emoji: '💻', x: 16, y: 14 }],
  },
  { id: 'kitchen',  label: 'Kitchen', x: 52, y: 2,  w: 46, h: 32, color: '#fef3c7', border: '#fcd34d',
    furniture: [
      { emoji: '🍳', x: 60, y: 10 },
      { emoji: '🍽️', x: 70, y: 22, triggerId: 'dinner_table' },
      { emoji: '⏲️', x: 88, y: 10, triggerId: 'kitchen_timer' },
    ],
  },
  { id: 'living',   label: 'Living Room', x: 2, y: 36, w: 96, h: 28, color: '#fef9ef', border: '#d4a574',
    furniture: [
      { emoji: '🛋️', x: 16, y: 48 },
      { emoji: '📺', x: 60, y: 40, triggerId: 'tv_weather' },
      { emoji: '💬', x: 80, y: 50, triggerId: 'friend_leaving' },
      { emoji: '🕐', x: 8,  y: 38, triggerId: 'clock_3pm' },
    ],
  },
  { id: 'laundry',  label: 'Laundry', x: 2,  y: 66, w: 48, h: 16, color: '#f3f4f6', border: '#9ca3af',
    furniture: [
      { emoji: '🫧', x: 20, y: 72, triggerId: 'washing_machine' },
    ],
  },
  { id: 'entrance', label: 'Entry',   x: 52, y: 66, w: 46, h: 16, color: '#ecfdf5', border: '#6ee7b7',
    furniture: [
      { emoji: '🚪', x: 70, y: 70 },
      { emoji: '🔔', x: 60, y: 76, triggerId: 'doorbell' },
      { emoji: '📱', x: 88, y: 76, triggerId: 'phone_notification' },
    ],
  },
  { id: 'balcony',  label: 'Balcony', x: 2,  y: 84, w: 96, h: 14, color: '#fefce8', border: '#fde047',
    furniture: [
      { emoji: '🌱', x: 50, y: 89 },
    ],
  },
]

function MinimapTrigger({ emoji, x, y, trigger, onClick }) {
  if (!trigger) {
    return (
      <text x={x} y={y} fontSize="5" textAnchor="middle" dominantBaseline="central" className="select-none">
        {emoji}
      </text>
    )
  }

  const isFired = trigger.state === 'fired'
  const isAmbient = trigger.state === 'ambient'

  return (
    <g
      onClick={isFired ? onClick : undefined}
      style={{ cursor: isFired ? 'pointer' : 'default' }}
    >
      {/* Glow ring for fired state */}
      {isFired && (
        <circle cx={x} cy={y} r="5" fill="none" stroke="#f59e0b" strokeWidth="1"
          className="minimap-trigger-fired" />
      )}
      {/* Ambient pulse ring */}
      {isAmbient && (
        <circle cx={x} cy={y} r="4" fill="none" stroke="#60a5fa" strokeWidth="0.5"
          className="minimap-trigger-ambient" />
      )}
      <text
        x={x} y={y}
        fontSize={isFired ? '6' : '5'}
        textAnchor="middle"
        dominantBaseline="central"
        className="select-none"
        style={{ filter: isFired ? 'drop-shadow(0 0 2px #f59e0b)' : 'none' }}
      >
        {emoji}
      </text>
      {/* Red notification dot for fired */}
      {isFired && (
        <circle cx={x + 3} cy={y - 3} r="1.5" fill="#ef4444" className="minimap-trigger-dot" />
      )}
    </g>
  )
}

function MiniMap() {
  const currentRoom = useGameStore(s => s.currentRoom)
  const triggers = useGameStore(s => s.triggers)
  const clickTrigger = useGameStore(s => s.clickTrigger)
  const [avatarRoom, setAvatarRoom] = useState(currentRoom)
  const [pepperRoom, setPepperRoom] = useState(currentRoom)
  const prevRoom = useRef(currentRoom)

  // Avatar transitions with slight delay for Pepper
  useEffect(() => {
    if (currentRoom !== prevRoom.current) {
      prevRoom.current = currentRoom
      setAvatarRoom(currentRoom)
      const timer = setTimeout(() => setPepperRoom(currentRoom), 300)
      return () => clearTimeout(timer)
    }
  }, [currentRoom])

  const getAvatarPos = (roomId) => {
    const room = MAP_ROOMS.find(r => r.id === roomId) || MAP_ROOMS[0]
    return { x: room.x + room.w * 0.4, y: room.y + room.h * 0.6 }
  }

  const getPepperPos = (roomId) => {
    const room = MAP_ROOMS.find(r => r.id === roomId) || MAP_ROOMS[0]
    return { x: room.x + room.w * 0.55, y: room.y + room.h * 0.6 }
  }

  const avatarPos = getAvatarPos(avatarRoom)
  const pepperPos = getPepperPos(pepperRoom)

  return (
    <div className="bg-slate-800/60 rounded-lg p-2">
      <div className="text-[10px] text-slate-500 font-medium mb-1 text-center uppercase tracking-wider">
        Floor Plan
      </div>
      <svg viewBox="0 0 100 100" className="w-full" style={{ maxHeight: 340 }}>
        {/* Room rectangles */}
        {MAP_ROOMS.map(room => {
          const isActive = currentRoom === room.id
          return (
            <g key={room.id}>
              <rect
                x={room.x} y={room.y}
                width={room.w} height={room.h}
                rx={2}
                fill={isActive ? room.color : `${room.color}88`}
                stroke={isActive ? room.border : '#475569'}
                strokeWidth={isActive ? 1.2 : 0.4}
                className="transition-all duration-500"
              />
              {/* Room label */}
              <text
                x={room.x + room.w / 2}
                y={room.y + 5}
                textAnchor="middle"
                fontSize="3.5"
                fill={isActive ? '#334155' : '#64748b'}
                fontWeight={isActive ? 'bold' : 'normal'}
                className="select-none"
              >
                {room.label}
              </text>

              {/* Furniture + triggers */}
              {room.furniture.map((item, i) => {
                const trigger = item.triggerId
                  ? triggers.find(t => t.id === item.triggerId)
                  : null
                return (
                  <MinimapTrigger
                    key={`${room.id}-${i}`}
                    emoji={item.emoji}
                    x={item.x}
                    y={item.y}
                    trigger={trigger}
                    onClick={() => trigger && clickTrigger(trigger.id)}
                  />
                )
              })}
            </g>
          )
        })}

        {/* Avatar — blue dot */}
        <motion.circle
          cx={avatarPos.x}
          cy={avatarPos.y}
          r="2.5"
          fill="#3b82f6"
          stroke="white"
          strokeWidth="0.8"
          animate={{ cx: avatarPos.x, cy: avatarPos.y }}
          transition={{ duration: 0.8, ease: 'easeInOut' }}
        />
        <motion.text
          x={avatarPos.x}
          y={avatarPos.y + 5}
          textAnchor="middle"
          fontSize="2.5"
          fill="#93c5fd"
          className="select-none"
          animate={{ x: avatarPos.x, y: avatarPos.y + 5 }}
          transition={{ duration: 0.8, ease: 'easeInOut' }}
        >
          You
        </motion.text>

        {/* Pepper — robot emoji */}
        <motion.text
          x={pepperPos.x}
          y={pepperPos.y}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize="5"
          className="select-none"
          animate={{ x: pepperPos.x, y: pepperPos.y }}
          transition={{ duration: 0.8, ease: 'easeInOut', delay: 0.15 }}
        >
          🤖
        </motion.text>
      </svg>
    </div>
  )
}

function RobotStatus() {
  const robotStatus = useGameStore(s => s.robotStatus)

  return (
    <div className="bg-slate-800/60 rounded-lg p-2 flex items-center gap-2">
      <motion.span
        className="text-xl leading-none"
        animate={robotStatus === 'speaking' ? { scale: [1, 1.15, 1] } : {}}
        transition={robotStatus === 'speaking' ? { duration: 0.6, repeat: Infinity } : {}}
      >
        🤖
      </motion.span>
      <div className="flex-1 min-w-0">
        <div className="text-[11px] font-medium text-slate-400">Pepper</div>
        <div className={`text-[10px] ${robotStatus === 'speaking' ? 'text-blue-400' : 'text-slate-500'}`}>
          {robotStatus === 'speaking' ? 'Speaking…' : 'Idle'}
        </div>
      </div>
      {robotStatus === 'speaking' && (
        <div className="flex gap-0.5 items-end h-3">
          {[0, 1, 2].map(i => (
            <motion.div
              key={i}
              className="w-0.5 bg-blue-400 rounded-full"
              animate={{ height: [3, 10, 3] }}
              transition={{ duration: 0.5, repeat: Infinity, delay: i * 0.12 }}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function ActivityLabel() {
  const activityLabel = useGameStore(s => s.activityLabel)
  const currentRoom = useGameStore(s => s.currentRoom)

  const roomEmoji = {
    study: '📧', kitchen: '🍳', living: '🎧', laundry: '🫧', entrance: '🚪', balcony: '🛒',
  }

  return (
    <div className="bg-slate-800/60 rounded-lg px-3 py-2 text-center">
      <div className="text-xs text-slate-500 uppercase tracking-wider font-medium">
        {roomEmoji[currentRoom] || '🏠'} {currentRoom}
      </div>
      {activityLabel && (
        <div className="text-sm text-slate-300 mt-0.5 leading-snug">
          {activityLabel}
        </div>
      )}
    </div>
  )
}

export default function HomeMapSidebar() {
  return (
    <div className="w-[280px] shrink-0 h-full flex flex-col bg-slate-900 border-l border-slate-800 overflow-y-auto">
      <Clock />
      <div className="flex flex-col gap-2.5 p-3 flex-1">
        <ActivityLabel />
        <MiniMap />
        <RobotStatus />
      </div>
    </div>
  )
}
