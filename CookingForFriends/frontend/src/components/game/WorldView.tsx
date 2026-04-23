/** World View — fixed house floor plan with all rooms always visible.
 *
 *  Layout: 6 rooms at fixed positions, no zoom/overview modes.
 *  ┌──────────────────┬─────────────────────┐
 *  │                  │                     │
 *  │     Kitchen      │    Living Room      │
 *  │  (largest room)  │                     │
 *  │                  ├──────────┬──────────┤
 *  │                  │  Study   │ Bathroom │
 *  │                  │          │          │
 *  ├──────────────────┼──────────┴──────────┤
 *  │   Dining Room    │     Hallway         │
 *  │                  │              [DOOR]  │
 *  └──────────────────┴─────────────────────┘
 *
 *  Navigation: click any room to move character there.
 *  Active room gets a highlight border; inactive rooms slightly dimmed.
 */

import { useCallback, useRef, useEffect } from 'react'
import { useGameStore } from '../../stores/gameStore'
import CharacterSprite from './CharacterSprite'
import { useCharacterSprite } from '../../hooks/useCharacterSprite'
import KitchenRoom from './rooms/KitchenRoom'
import DiningRoom from './rooms/DiningRoom'
import LivingRoom from './rooms/LivingRoom'
import StudyRoom from './rooms/StudyRoom'
import BathroomRoom from './rooms/BathroomRoom'
import HallwayRoom from './rooms/HallwayRoom'
import KitchenFurniture from './rooms/KitchenFurniture'
import DiningFurniture from './rooms/DiningFurniture'
import LivingFurniture from './rooms/LivingFurniture'
import StudyFurniture from './rooms/StudyFurniture'
import BathroomFurniture from './rooms/BathroomFurniture'
import HallwayFurniture from './rooms/HallwayFurniture'
import { FLOOR_STYLES } from './rooms/furniture/styles'
import { TriggerRoomGlow } from './TriggerEffects'
import type { RoomId } from '../../types'

interface RoomDef {
  id: RoomId
  label: string
  emoji: string
}

const ROOMS: RoomDef[] = [
  { id: 'kitchen',     label: 'Kitchen',     emoji: '🍳' },
  { id: 'living_room', label: 'Living Room', emoji: '🛋️' },
  { id: 'study',       label: 'Study',       emoji: '📚' },
  { id: 'bathroom',    label: 'Bathroom',    emoji: '🚿' },
  { id: 'dining_room', label: 'Dining Room', emoji: '🍽️' },
  { id: 'hallway',     label: 'Hallway',     emoji: '🚪' },
]

/** Fixed floor-plan positions (% of container width / height).
 *  Kitchen is largest (top-left, spanning full left height of top section).
 *  Living room shares top row with kitchen.
 *  Study and Bathroom are mid-right, below living room.
 *  Dining room is bottom-left.
 *  Hallway is bottom-right, with front door.
 */
const FLOOR_PLAN: Record<RoomId, { left: number; top: number; width: number; height: number }> = {
  kitchen:     { left: 0,    top: 0,    width: 42,   height: 64 },
  living_room: { left: 43,   top: 0,    width: 57,   height: 38 },
  study:       { left: 43,   top: 39,   width: 28,   height: 25 },
  bathroom:    { left: 72,   top: 39,   width: 28,   height: 25 },
  dining_room: { left: 0,    top: 65,   width: 42,   height: 35 },
  hallway:     { left: 43,   top: 65,   width: 57,   height: 35 },
}

/** Character transit duration in ms */
const TRANSIT_DURATION = 500

const FURNITURE_MAP: Record<RoomId, React.ComponentType> = {
  kitchen:     KitchenFurniture,
  dining_room: DiningFurniture,
  living_room: LivingFurniture,
  study:       StudyFurniture,
  bathroom:    BathroomFurniture,
  hallway:     HallwayFurniture,
}

const ROOM_CONTENT: Record<RoomId, React.ComponentType<{ isActive: boolean }>> = {
  kitchen:     KitchenRoom,
  dining_room: DiningRoom,
  living_room: LivingRoom,
  study:       StudyRoom,
  bathroom:    BathroomRoom,
  hallway:     HallwayRoom,
}

// ── Main component ────────────────────────────────────────────────────────────

export default function WorldView() {
  const currentRoom    = useGameStore((s) => s.currentRoom)
  const avatarMoving   = useGameStore((s) => s.avatarMoving)
  const setCurrentRoom = useGameStore((s) => s.setCurrentRoom)
  const setAvatarMoving = useGameStore((s) => s.setAvatarMoving)

  const character = useCharacterSprite(currentRoom)

  const switchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => { if (switchTimeout.current) clearTimeout(switchTimeout.current) }, [])

  const navigateToRoom = useCallback((roomId: RoomId) => {
    if (roomId === currentRoom || avatarMoving) return
    if (switchTimeout.current) clearTimeout(switchTimeout.current)

    setAvatarMoving(true)
    setCurrentRoom(roomId)
    character.walkTo(roomId)

    switchTimeout.current = setTimeout(() => {
      setAvatarMoving(false)
      switchTimeout.current = null
    }, TRANSIT_DURATION)
  }, [currentRoom, avatarMoving, setCurrentRoom, setAvatarMoving])

  return (
    <div className="absolute inset-0 bg-slate-950 overflow-hidden">
      {/* ── House container — fixed layout, no scaling ── */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-slate-700" />

        {ROOMS.map((room) => {
          const isActive      = room.id === currentRoom
          const FurnitureComp = FURNITURE_MAP[room.id]
          const RoomContent   = ROOM_CONTENT[room.id]
          const floor         = FLOOR_STYLES[room.id]
          const fp            = FLOOR_PLAN[room.id]

          return (
            <div
              key={room.id}
              className={`absolute cursor-pointer ${isActive ? 'z-20' : 'z-10'}`}
              style={{ left: `${fp.left}%`, top: `${fp.top}%`, width: `${fp.width}%`, height: `${fp.height}%` }}
              onClick={() => navigateToRoom(room.id)}
            >
              <div className={`relative w-full h-full overflow-hidden border-2 transition-all duration-300 ${
                isActive
                  ? 'border-cooking-400/70 shadow-[0_0_15px_rgba(217,119,6,0.3)]'
                  : 'border-slate-600/40 hover:border-slate-500/60'
              }`}>
                {/* Floor + furniture layer */}
                <div className="absolute inset-0 overflow-hidden" style={floor}>
                  <FurnitureComp />
                </div>

                {/* Room content layer */}
                <div className="absolute inset-0 z-[2]">
                  <RoomContent isActive={isActive} />
                </div>

                {/* Dim overlay for inactive rooms */}
                {!isActive && (
                  <div className="absolute inset-0 z-[3] bg-black/30 pointer-events-none transition-opacity duration-300" />
                )}

                {/* Room label */}
                <div className="absolute top-1.5 left-1.5 z-[5] pointer-events-none">
                  <div className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 ${
                    isActive ? 'bg-slate-900/80' : 'bg-slate-900/60'
                  }`}>
                    <span className="text-xs">{room.emoji}</span>
                    <span className={`text-[11px] font-semibold ${
                      isActive ? 'text-cooking-300' : 'text-slate-400'
                    }`}>{room.label}</span>
                  </div>
                </div>

                {/* PM trigger glow effect */}
                <TriggerRoomGlow room={room.id} />
              </div>
            </div>
          )
        })}
      </div>

      {/* Character sprite — floats over all rooms, position driven by useCharacterSprite */}
      <CharacterSprite state={character} />
    </div>
  )
}
