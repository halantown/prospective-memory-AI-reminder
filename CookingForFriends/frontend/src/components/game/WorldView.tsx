/** World View — home panorama with rooms, activation/dimming, click to navigate.
 *  Active room expands to ~64% width (left column). Inactive rooms stack in a
 *  right column at ~24% height each. Inactive rooms are dimmed with a
 *  semi-transparent overlay but content remains visible for monitoring.
 */

import { useCallback, useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useGameStore } from '../../stores/gameStore'
import KitchenRoom from './rooms/KitchenRoom'
import BedroomRoom from './rooms/BedroomRoom'
import LivingRoom from './rooms/LivingRoom'
import StudyRoom from './rooms/StudyRoom'
import BathroomRoom from './rooms/BathroomRoom'
import KitchenFurniture from './rooms/KitchenFurniture'
import BedroomFurniture from './rooms/BedroomFurniture'
import LivingFurniture from './rooms/LivingFurniture'
import StudyFurniture from './rooms/StudyFurniture'
import BathroomFurniture from './rooms/BathroomFurniture'
import { FLOOR_STYLES } from './rooms/furniture/styles'
import { TriggerRoomGlow } from './TriggerEffects'
import type { RoomId } from '../../types'

interface RoomDef {
  id: RoomId
  label: string
  emoji: string
}

const ROOMS: RoomDef[] = [
  { id: 'kitchen', label: 'Kitchen', emoji: '🍳' },
  { id: 'bedroom', label: 'Bedroom', emoji: '🛏️' },
  { id: 'living_room', label: 'Living Room', emoji: '🛋️' },
  { id: 'study', label: 'Study', emoji: '📚' },
  { id: 'bathroom', label: 'Bathroom', emoji: '🚿' },
]

/** Compute absolute position/size for a room based on which room is active.
 *  Active room: left column ~64% wide, full height (~64% of total area).
 *  Inactive rooms: right column, 4 rooms stacked with small gaps. */
function getRoomStyle(roomId: RoomId, currentRoom: RoomId): React.CSSProperties {
  if (roomId === currentRoom) {
    return { left: '0%', top: '0%', width: '64%', height: '100%' }
  }
  const inactiveRooms = ROOMS.filter(r => r.id !== currentRoom)
  const idx = inactiveRooms.findIndex(r => r.id === roomId)
  const count = inactiveRooms.length // always 4
  const rowH = 24 // % height per inactive room
  const gap = (100 - count * rowH) / (count - 1) // distribute remaining space as gaps
  return {
    left: '65.5%',
    top: `${idx * (rowH + gap)}%`,
    width: '34.5%',
    height: `${rowH}%`,
  }
}

const FURNITURE_MAP: Record<RoomId, React.ComponentType> = {
  kitchen: KitchenFurniture,
  bedroom: BedroomFurniture,
  living_room: LivingFurniture,
  study: StudyFurniture,
  bathroom: BathroomFurniture,
}

const ROOM_CONTENT: Record<RoomId, React.ComponentType<{ isActive: boolean }>> = {
  kitchen: KitchenRoom,
  bedroom: BedroomRoom,
  living_room: LivingRoom,
  study: StudyRoom,
  bathroom: BathroomRoom,
}

export default function WorldView() {
  const currentRoom = useGameStore((s) => s.currentRoom)
  const avatarMoving = useGameStore((s) => s.avatarMoving)
  const setCurrentRoom = useGameStore((s) => s.setCurrentRoom)
  const setAvatarMoving = useGameStore((s) => s.setAvatarMoving)
  const roomTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (roomTimeoutRef.current) clearTimeout(roomTimeoutRef.current)
    }
  }, [])

  const handleRoomClick = useCallback((roomId: RoomId) => {
    if (roomId === currentRoom || avatarMoving) return

    if (roomTimeoutRef.current) clearTimeout(roomTimeoutRef.current)
    setAvatarMoving(true)
    roomTimeoutRef.current = setTimeout(() => {
      setCurrentRoom(roomId)
      setAvatarMoving(false)
      roomTimeoutRef.current = null
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
          const posStyle = getRoomStyle(room.id, currentRoom)

          return (
            <div
              key={room.id}
              className={`absolute cursor-pointer room-card-transition ${
                isActive ? 'z-20' : 'z-[1]'
              }`}
              style={{
                ...posStyle,
                filter: isActive ? 'brightness(1.05) saturate(1.1)' : undefined,
              }}
              onClick={() => handleRoomClick(room.id)}
            >
              <motion.div
                className={`relative w-full h-full rounded-xl border-2
                  transition-all duration-400 ${
                    isActive
                      ? 'border-cooking-400 shadow-[0_0_20px_4px_rgba(251,146,60,0.25)] ring-1 ring-cooking-400/20 room-active'
                      : 'border-slate-700/60 hover:border-slate-500'
                  }`}
                whileHover={!isActive ? { scale: 1.01 } : {}}
              >
                {/* Floor background + furniture — clipped to rounded corners */}
                <div className="absolute inset-0 rounded-[inherit] overflow-hidden" style={floor}>
                  <FurnitureComp />
                </div>

                {/* Room content — ALWAYS rendered for monitoring */}
                <div className="absolute inset-0 z-[2]">
                  <RoomContent isActive={isActive} />
                </div>

                {/* Dim overlay for inactive rooms — 50% black, sits above content */}
                {!isActive && (
                  <div className="absolute inset-0 z-[3] rounded-[inherit] bg-black/50 pointer-events-none" />
                )}

                {/* Room label badge — always on top of everything */}
                <div className="absolute top-1.5 left-1.5 z-[4] pointer-events-none">
                  <div className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1
                    ${isActive ? 'bg-slate-900/70' : 'bg-slate-900/60'}`}
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
            </div>
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
