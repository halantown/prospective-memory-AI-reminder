/** World View — fixed house floor plan with zoom-into-room navigation.
 *
 *  Layout: all 5 rooms stay at their fixed floor-plan positions at all times.
 *  Modes:
 *    overview  — see the whole house; click a room to enter it
 *    zoomed    — the selected room is scaled up to fill the viewport via CSS
 *                transform on the house container (other rooms shift out of view)
 *
 *  Navigation in zoomed mode: directional arrow strips positioned at the edges
 *  of the viewport, pointing toward adjacent rooms in floor-plan space.
 *  e.g. Kitchen has Living Room to its right → right-edge vertical strip with →
 */

import { useCallback, useRef, useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
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
  { id: 'kitchen',     label: 'Kitchen',     emoji: '🍳' },
  { id: 'living_room', label: 'Living Room', emoji: '🛋️' },
  { id: 'bedroom',     label: 'Bedroom',     emoji: '🛏️' },
  { id: 'study',       label: 'Study',       emoji: '📚' },
  { id: 'bathroom',    label: 'Bathroom',    emoji: '🚿' },
]

const ROOM_INFO: Record<RoomId, { label: string; emoji: string }> = {
  kitchen:     { label: 'Kitchen',     emoji: '🍳' },
  living_room: { label: 'Living Room', emoji: '🛋️' },
  bedroom:     { label: 'Bedroom',     emoji: '🛏️' },
  study:       { label: 'Study',       emoji: '📚' },
  bathroom:    { label: 'Bathroom',    emoji: '🚿' },
}

/** Fixed floor-plan positions (% of container width / height).
 *  Top row:    Kitchen (left 45%) | Living Room (right 55%)
 *  Bottom row: Bedroom (30%) | Study (40%) | Bathroom (30%)
 *  A 2px gap between rooms represents walls.
 */
const FLOOR_PLAN: Record<RoomId, { left: number; top: number; width: number; height: number }> = {
  kitchen:     { left: 0,    top: 0,    width: 44.5, height: 54.5 },
  living_room: { left: 45.5, top: 0,    width: 54.5, height: 54.5 },
  bedroom:     { left: 0,    top: 55.5, width: 29.5, height: 44.5 },
  study:       { left: 30.5, top: 55.5, width: 39,   height: 44.5 },
  bathroom:    { left: 70.5, top: 55.5, width: 29.5, height: 44.5 },
}

type NavDirection = 'left' | 'right' | 'top' | 'bottom'

interface NavArrow {
  roomId: RoomId
  direction: NavDirection
  /** Position along the perpendicular axis (0–100%).
   *  left/right buttons: vertical position on that edge.
   *  top/bottom buttons: horizontal position on that edge. */
  axisPct: number
}

/** Adjacency derived from floor plan geometry.
 *  axisPct places buttons proportionally along the shared wall. */
const NAV_ARROWS: Record<RoomId, NavArrow[]> = {
  kitchen: [
    { roomId: 'living_room', direction: 'right',  axisPct: 50 },
    { roomId: 'bedroom',     direction: 'bottom', axisPct: 20 },
    { roomId: 'study',       direction: 'bottom', axisPct: 68 },
  ],
  living_room: [
    { roomId: 'kitchen',  direction: 'left',   axisPct: 50 },
    { roomId: 'study',    direction: 'bottom', axisPct: 30 },
    { roomId: 'bathroom', direction: 'bottom', axisPct: 72 },
  ],
  bedroom: [
    { roomId: 'study',   direction: 'right', axisPct: 50 },
    { roomId: 'kitchen', direction: 'top',   axisPct: 30 },
  ],
  study: [
    { roomId: 'bedroom',     direction: 'left',   axisPct: 50 },
    { roomId: 'bathroom',    direction: 'right',  axisPct: 50 },
    { roomId: 'kitchen',     direction: 'top',    axisPct: 25 },
    { roomId: 'living_room', direction: 'top',    axisPct: 72 },
  ],
  bathroom: [
    { roomId: 'study',       direction: 'left', axisPct: 50 },
    { roomId: 'living_room', direction: 'top',  axisPct: 50 },
  ],
}

const ARROW_ICON: Record<NavDirection, string> = {
  left: '←', right: '→', top: '↑', bottom: '↓',
}

const FURNITURE_MAP: Record<RoomId, React.ComponentType> = {
  kitchen:     KitchenFurniture,
  bedroom:     BedroomFurniture,
  living_room: LivingFurniture,
  study:       StudyFurniture,
  bathroom:    BathroomFurniture,
}

const ROOM_CONTENT: Record<RoomId, React.ComponentType<{ isActive: boolean }>> = {
  kitchen:     KitchenRoom,
  bedroom:     BedroomRoom,
  living_room: LivingRoom,
  study:       StudyRoom,
  bathroom:    BathroomRoom,
}

/** Compute the translate + scale to bring `roomId` to fill the container. */
function computeZoom(container: HTMLDivElement, roomId: RoomId) {
  const W = container.clientWidth
  const H = container.clientHeight
  const fp = FLOOR_PLAN[roomId]
  const rx = (fp.left   / 100) * W
  const ry = (fp.top    / 100) * H
  const rw = (fp.width  / 100) * W
  const rh = (fp.height / 100) * H
  const scale = Math.min(W / rw, H / rh) * 0.98
  const cx = rx + rw / 2
  const cy = ry + rh / 2
  return { x: W / 2 - cx * scale, y: H / 2 - cy * scale, scale }
}

// ── Directional nav arrow button ─────────────────────────────────────────────

function NavArrowBtn({
  arrow,
  onEnter,
}: {
  arrow: NavArrow
  onEnter: (id: RoomId) => void
}) {
  const { label, emoji } = ROOM_INFO[arrow.roomId]
  const icon = ARROW_ICON[arrow.direction]
  const isLR = arrow.direction === 'left' || arrow.direction === 'right'

  // Position on the edge
  const edgeStyle: React.CSSProperties = isLR
    ? {
        top: `${arrow.axisPct}%`,
        transform: 'translateY(-50%)',
        ...(arrow.direction === 'left' ? { left: 0 } : { right: 0 }),
      }
    : {
        left: `${arrow.axisPct}%`,
        transform: 'translateX(-50%)',
        ...(arrow.direction === 'top' ? { top: 0 } : { bottom: 0 }),
      }

  return (
    <motion.button
      className={`absolute z-50 flex items-center justify-center gap-2
        bg-black/40 hover:bg-black/65 backdrop-blur-sm text-white/90 hover:text-white
        transition-colors select-none
        ${isLR
          ? 'flex-col w-16 py-8 rounded-none'       // tall vertical strip
          : 'flex-row h-16 px-6 rounded-none'       // wide horizontal strip
        }`}
      style={edgeStyle}
      onClick={() => onEnter(arrow.roomId)}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      whileHover={{ backgroundColor: 'rgba(0,0,0,0.7)' }}
    >
      {arrow.direction === 'right' && (
        <>
          <span className="text-base leading-tight">{emoji}</span>
          <span style={{ writingMode: 'vertical-rl', textOrientation: 'mixed', fontSize: '11px', opacity: 0.85, letterSpacing: '0.05em' }}>
            {label}
          </span>
          <span className="text-3xl font-thin leading-none">{icon}</span>
        </>
      )}
      {arrow.direction === 'left' && (
        <>
          <span className="text-3xl font-thin leading-none">{icon}</span>
          <span style={{ writingMode: 'vertical-rl', textOrientation: 'mixed', fontSize: '11px', opacity: 0.85, letterSpacing: '0.05em' }}>
            {label}
          </span>
          <span className="text-base leading-tight">{emoji}</span>
        </>
      )}
      {arrow.direction === 'top' && (
        <>
          <span className="text-3xl font-thin leading-none">{icon}</span>
          <span className="text-base">{emoji}</span>
          <span className="text-xs font-medium opacity-90 whitespace-nowrap">{label}</span>
        </>
      )}
      {arrow.direction === 'bottom' && (
        <>
          <span className="text-base">{emoji}</span>
          <span className="text-xs font-medium opacity-90 whitespace-nowrap">{label}</span>
          <span className="text-3xl font-thin leading-none">{icon}</span>
        </>
      )}
    </motion.button>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function WorldView() {
  const currentRoom    = useGameStore((s) => s.currentRoom)
  const avatarMoving   = useGameStore((s) => s.avatarMoving)
  const setCurrentRoom = useGameStore((s) => s.setCurrentRoom)
  const setAvatarMoving = useGameStore((s) => s.setAvatarMoving)

  const containerRef  = useRef<HTMLDivElement>(null)
  const switchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  // null = overview mode; non-null = zoomed into a room
  const [zoom, setZoom] = useState<{ x: number; y: number; scale: number } | null>(null)
  const isOverview = zoom === null

  useEffect(() => () => { if (switchTimeout.current) clearTimeout(switchTimeout.current) }, [])

  const goOverview = useCallback(() => setZoom(null), [])

  const enterRoom = useCallback((roomId: RoomId) => {
    if (!containerRef.current) return
    setZoom(computeZoom(containerRef.current, roomId))
    if (roomId === currentRoom) return
    if (switchTimeout.current) clearTimeout(switchTimeout.current)
    setCurrentRoom(roomId)
    setAvatarMoving(true)
    switchTimeout.current = setTimeout(() => {
      setAvatarMoving(false)
      switchTimeout.current = null
    }, 400)
  }, [currentRoom, setCurrentRoom, setAvatarMoving])

  return (
    <div ref={containerRef} className="absolute inset-0 bg-slate-950 overflow-hidden">

      {/* ── House container — the only element that gets scaled ── */}
      <motion.div
        className="absolute inset-0"
        style={{ transformOrigin: '0 0' }}
        animate={zoom ? { x: zoom.x, y: zoom.y, scale: zoom.scale } : { x: 0, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 220, damping: 32 }}
      >
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
              className={`absolute ${isActive ? 'z-20' : 'z-10'} ${isOverview ? 'cursor-pointer' : ''}`}
              style={{ left: `${fp.left}%`, top: `${fp.top}%`, width: `${fp.width}%`, height: `${fp.height}%` }}
              onClick={isOverview ? () => enterRoom(room.id) : undefined}
            >
              <div className={`relative w-full h-full overflow-hidden border-2 transition-colors duration-300 ${
                isActive ? 'border-cooking-400/70' : 'border-slate-600/40'
              }`}>
                <div className="absolute inset-0 overflow-hidden" style={floor}>
                  <FurnitureComp />
                </div>
                <div className="absolute inset-0 z-[2]">
                  <RoomContent isActive={isActive} />
                </div>
                {isOverview && !isActive && (
                  <div className="absolute inset-0 z-[3] bg-black/45 pointer-events-none" />
                )}
                {isOverview && !isActive && (
                  <motion.div
                    className="absolute inset-0 z-[4] bg-white/0 pointer-events-none"
                    whileHover={{ backgroundColor: 'rgba(255,255,255,0.06)' }}
                  />
                )}
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
                <TriggerRoomGlow room={room.id} />
                {isActive && !isOverview && !avatarMoving && (
                  <motion.div
                    className="absolute bottom-2 right-2 text-2xl z-[5] pointer-events-none"
                    animate={{ y: [0, -4, 0] }}
                    transition={{ repeat: Infinity, duration: 2 }}
                  >
                    🧑
                  </motion.div>
                )}
              </div>
            </div>
          )
        })}
      </motion.div>

      {/* ── Zoomed HUD — outside the scaled container, always sharp ── */}
      <AnimatePresence>
        {!isOverview && (
          <>
            {/* Floor plan button — top left */}
            <motion.button
              key="overview-btn"
              className="absolute top-3 left-3 z-50 flex items-center gap-2
                bg-slate-900/80 hover:bg-slate-700 backdrop-blur-sm
                text-white text-sm font-semibold
                px-5 py-3 rounded-xl transition-colors shadow-lg"
              onClick={goOverview}
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              🏠 <span>Floor plan</span>
            </motion.button>

            {/* Directional nav arrows — one per adjacent room */}
            {NAV_ARROWS[currentRoom].map((arrow) => (
              <NavArrowBtn
                key={`${arrow.roomId}-${arrow.direction}`}
                arrow={arrow}
                onEnter={enterRoom}
              />
            ))}
          </>
        )}
      </AnimatePresence>

      {/* Walking animation */}
      <AnimatePresence>
        {avatarMoving && (
          <motion.div
            className="absolute inset-0 flex items-center justify-center z-30 pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="text-4xl drop-shadow-lg"
              animate={{ x: [0, 30, 0], y: [0, -12, 0] }}
              transition={{ duration: 0.4, ease: 'easeInOut' }}
            >
              🚶
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
