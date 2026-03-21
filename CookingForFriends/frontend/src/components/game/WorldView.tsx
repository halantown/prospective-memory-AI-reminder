/** World View — home panorama with rooms, activation/dimming, click to navigate. */

import { useCallback } from 'react'
import { motion } from 'framer-motion'
import { useGameStore } from '../../stores/gameStore'
import KitchenRoom from './rooms/KitchenRoom'
import DiningRoom from './rooms/DiningRoom'
import LivingRoom from './rooms/LivingRoom'
import StudyRoom from './rooms/StudyRoom'
import BalconyRoom from './rooms/BalconyRoom'
import KitchenFurniture from './rooms/KitchenFurniture'
import DiningFurniture from './rooms/DiningFurniture'
import LivingFurniture from './rooms/LivingFurniture'
import StudyFurniture from './rooms/StudyFurniture'
import BalconyFurniture from './rooms/BalconyFurniture'
import { FLOOR_STYLES } from './rooms/furniture/styles'
import { TriggerRoomGlow } from './TriggerEffects'
import type { RoomId } from '../../types'

interface RoomDef {
  id: RoomId
  label: string
  emoji: string
  x: string
  y: string
  w: string
  h: string
}

const ROOMS: RoomDef[] = [
  { id: 'kitchen', label: 'Kitchen', emoji: '🍳', x: '2%', y: '2%', w: '46%', h: '55%' },
  { id: 'dining', label: 'Dining Room', emoji: '🍽️', x: '52%', y: '2%', w: '46%', h: '55%' },
  { id: 'living_room', label: 'Living Room', emoji: '🛋️', x: '2%', y: '60%', w: '30%', h: '38%' },
  { id: 'study', label: 'Study', emoji: '📚', x: '35%', y: '60%', w: '30%', h: '38%' },
  { id: 'balcony', label: 'Balcony', emoji: '🌿', x: '68%', y: '60%', w: '30%', h: '38%' },
]

const FURNITURE_MAP: Record<RoomId, React.ComponentType> = {
  kitchen: KitchenFurniture,
  dining: DiningFurniture,
  living_room: LivingFurniture,
  study: StudyFurniture,
  balcony: BalconyFurniture,
}

const ROOM_CONTENT: Record<RoomId, React.ComponentType> = {
  kitchen: KitchenRoom,
  dining: DiningRoom,
  living_room: LivingRoom,
  study: StudyRoom,
  balcony: BalconyRoom,
}

export default function WorldView() {
  const currentRoom = useGameStore((s) => s.currentRoom)
  const avatarMoving = useGameStore((s) => s.avatarMoving)
  const setCurrentRoom = useGameStore((s) => s.setCurrentRoom)
  const setAvatarMoving = useGameStore((s) => s.setAvatarMoving)

  const handleRoomClick = useCallback((roomId: RoomId) => {
    if (roomId === currentRoom || avatarMoving) return

    setAvatarMoving(true)
    setTimeout(() => {
      setCurrentRoom(roomId)
      setAvatarMoving(false)
    }, 800)
  }, [currentRoom, avatarMoving, setCurrentRoom, setAvatarMoving])

  return (
    <div className="absolute inset-0 bg-gradient-to-b from-slate-800 to-slate-900 p-3">
      <div className="relative w-full h-full">
        {ROOMS.map((room) => {
          const isActive = room.id === currentRoom
          const FurnitureComp = FURNITURE_MAP[room.id]
          const RoomContent = ROOM_CONTENT[room.id]
          const floor = FLOOR_STYLES[room.id]

          return (
            <motion.div
              key={room.id}
              className={`absolute rounded-xl border-2 cursor-pointer overflow-hidden
                transition-all duration-400 ${
                  isActive
                    ? 'border-cooking-400 shadow-lg shadow-cooking-400/20 room-active'
                    : 'border-slate-600 room-dimmed hover:border-slate-500'
                }`}
              style={{
                left: room.x, top: room.y,
                width: room.w, height: room.h,
              }}
              onClick={() => handleRoomClick(room.id)}
              whileHover={!isActive ? { scale: 1.01 } : {}}
            >
              {/* Floor background + furniture (always visible) */}
              <div className="absolute inset-0" style={floor}>
                <FurnitureComp />
              </div>

              {/* Room label badge */}
              <div className="absolute top-1.5 left-1.5 z-[2] pointer-events-none">
                <div className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1
                  ${isActive ? 'bg-slate-900/70' : 'bg-slate-900/50'}`}
                >
                  <span className="text-sm">{room.emoji}</span>
                  <span className={`text-xs font-semibold ${
                    isActive ? 'text-cooking-300' : 'text-slate-400'
                  }`}>
                    {room.label}
                  </span>
                  {isActive && (
                    <span className="text-[10px] bg-cooking-500 text-white px-1.5 py-0.5 rounded-full">
                      HERE
                    </span>
                  )}
                </div>
              </div>

              {/* Interactive content overlay (active room only) */}
              {isActive && (
                <div className="absolute inset-0 z-[3]">
                  <RoomContent />
                </div>
              )}

              {/* Trigger room glow effect */}
              <TriggerRoomGlow room={room.id} />

              {/* Avatar indicator */}
              {isActive && !avatarMoving && (
                <motion.div
                  className="absolute bottom-2 right-2 text-2xl z-[4]"
                  animate={{ y: [0, -4, 0] }}
                  transition={{ repeat: Infinity, duration: 2 }}
                >
                  🧑
                </motion.div>
              )}
            </motion.div>
          )
        })}

        {/* Walking animation overlay */}
        {avatarMoving && (
          <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
            <motion.div
              className="text-3xl"
              animate={{ x: [0, 20, 0], y: [0, -10, 0] }}
              transition={{ duration: 0.8 }}
            >
              🚶
            </motion.div>
          </div>
        )}
      </div>
    </div>
  )
}
