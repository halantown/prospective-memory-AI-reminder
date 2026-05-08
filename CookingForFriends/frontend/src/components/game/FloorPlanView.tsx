/**
 * FloorPlanView — Image-based floor plan with zoomable rooms and virtual character.
 *
 * Image: 1536×1024 pixel-art apartment top-down view.
 * Rooms: Kitchen (top-left), Dining Hall (top-right), Bedroom (bottom-left),
 *         Bathroom (bottom-center), Living Room (bottom-right).
 *
 * Overview mode: full image visible, click any room to zoom in.
 * Zoomed mode: 1.6× scale centered on current room, clamped so the image
 *              never exceeds viewport bounds (no black borders).
 * Character: small sprite that teleports between rooms with a 1.5s delay.
 * Robot (Pepper): follows the user with a 2s delay, rendered on the map.
 *
 * Zoom math (transform-origin: 0 0):
 *   transform: translate(tx%, ty%) scale(S)
 *   → scale expands image from top-left, then translate shifts result
 *   → no-border constraints: tx ∈ [(1−S)·100%, 0%]  (same for ty)
 *   → to center room (cx, cy) in viewport: rawT = (0.5 − S·c)·100
 *   → clamped: tx = clamp(rawTx, (1−S)·100, 0)
 */

import { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useGameStore } from '../../stores/gameStore'
import KitchenRoom, { KitchenStationOverlay } from './rooms/KitchenRoom'
import KitchenFurniture from './rooms/KitchenFurniture'
import WaypointEditor from './debug/WaypointEditor'
import PlayerAvatar from './PlayerAvatar'
import CharacterSpriteSheet, { type CharacterSpriteId } from './CharacterSpriteSheet'
import { useCharacterStore } from '../../stores/characterStore'
import waypointData from '../../data/waypoints.json'
import type { WaypointData } from '../../utils/waypointGraph'
import { resolveRoomPoint } from '../../utils/waypointGraph'
import { getActiveTriggerEncounterConfig, getTriggerEncounterConfig } from '../../data/triggerEncounters'

const wpData = waypointData as unknown as WaypointData

// ── Types ─────────────────────────────────────────────────────────────────────

export type FloorRoom = 'kitchen' | 'dining_hall' | 'bedroom' | 'living_room'

interface FloorPlanViewProps {
  initialRoom?: FloorRoom | null
  initialCharRoom?: FloorRoom
  initialRobotRoom?: FloorRoom
  disableNavigation?: boolean
  highlightedRoom?: FloorRoom | null
  scriptedDoorEncounterId?: string | null
}

interface RoomDef {
  id: FloorRoom
  label: string
  emoji: string
  /** Center of the room as % of image dimensions */
  cx: number
  cy: number
  /** Bounding box as % of image dimensions */
  x: number
  y: number
  w: number
  h: number
}

type NavDirection = 'top' | 'bottom' | 'left' | 'right' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'

interface NavLink {
  direction: NavDirection
  target: FloorRoom
  label: string
}

// ── Room definitions (% of 1536×1024 image) ──────────────────────────────────

const ROOM_DEFS: Record<FloorRoom, RoomDef> = {
  kitchen: {
    id: 'kitchen', label: 'Kitchen', emoji: '🍳',
    cx: 21, cy: 18,
    x: 0, y: 0, w: 49.5, h: 41,
  },
  dining_hall: {
    id: 'dining_hall', label: 'Dining Hall', emoji: '🍽️',
    cx: 78, cy: 16,
    x: 56, y: 0, w: 44, h: 33,
  },
  bedroom: {
    id: 'bedroom', label: 'Bedroom / Bathroom', emoji: '🛏️',
    cx: 29, cy: 76,
    x: 0, y: 52, w: 58, h: 48,  // covers both bedroom + bathroom area
  },
  living_room: {
    id: 'living_room', label: 'Living Room', emoji: '🛋️',
    cx: 77, cy: 65,
    x: 56, y: 34, w: 44, h: 66,
  },
}

const ALL_ROOMS: FloorRoom[] = ['kitchen', 'dining_hall', 'bedroom', 'living_room']

function encounterCharacterId(npcId: string | undefined): CharacterSpriteId {
  if (npcId === 'mei' || npcId === 'sophia' || npcId === 'courier' || npcId === 'sam_tutorial') return npcId
  if (npcId === 'benjamin') return 'benjamin'
  return 'courier'
}

// ── Adjacency map — buttons reflect the relative position of neighboring rooms ──

const ADJACENCY: Record<FloorRoom, NavLink[]> = {
  kitchen: [
    { direction: 'right', target: 'dining_hall', label: 'Dining Hall' },
    { direction: 'bottom', target: 'bedroom', label: 'Bedroom / Bathroom' },
    { direction: 'bottom-right', target: 'living_room', label: 'Living Room' },
  ],
  dining_hall: [
    { direction: 'left', target: 'kitchen', label: 'Kitchen' },
    { direction: 'bottom', target: 'living_room', label: 'Living Room' },
  ],
  bedroom: [
    { direction: 'top', target: 'kitchen', label: 'Kitchen' },
    { direction: 'right', target: 'living_room', label: 'Living Room' },
  ],
  living_room: [
    { direction: 'top', target: 'dining_hall', label: 'Dining Hall' },
    { direction: 'left', target: 'bedroom', label: 'Bedroom / Bathroom' },
    { direction: 'top-left', target: 'kitchen', label: 'Kitchen' },
  ],
}

// ── Arrow glyphs ──────────────────────────────────────────────────────────────

const ARROWS: Record<NavDirection, string> = {
  top: '↑', bottom: '↓', left: '←', right: '→',
  'top-left': '↖', 'top-right': '↗', 'bottom-left': '↙', 'bottom-right': '↘',
}

// ── Button edge positions ─────────────────────────────────────────────────────

function edgeStyle(dir: NavDirection): React.CSSProperties {
  const base: React.CSSProperties = { position: 'absolute' }
  switch (dir) {
    case 'top':          return { ...base, top: 18, left: '50%', transform: 'translateX(-50%)' }
    case 'bottom':       return { ...base, bottom: 18, left: '50%', transform: 'translateX(-50%)' }
    case 'left':         return { ...base, left: 18, top: '50%', transform: 'translateY(-50%)' }
    case 'right':        return { ...base, right: 18, top: '50%', transform: 'translateY(-50%)' }
    case 'top-left':     return { ...base, top: 76, left: 18 }
    case 'top-right':    return { ...base, top: 18, right: 18 }
    case 'bottom-left':  return { ...base, bottom: 18, left: 18 }
    case 'bottom-right': return { ...base, bottom: 18, right: 18 }
  }
}

function navButtonStyle(nav: NavLink): React.CSSProperties {
  if (nav.target === 'bedroom') {
    return { position: 'absolute', bottom: 18, left: 18 }
  }
  return edgeStyle(nav.direction)
}

// ── Zoom constants ────────────────────────────────────────────────────────────

const ZOOM_SCALE = 1.6
const ZOOM_SCALE_KITCHEN = 1.7
const ENCOUNTER_ZOOM_SCALE = 2.75
const DOOR_ENCOUNTER_FOCUS = { cx: 67.2, cy: 80.4 }
// Max positive translate (%) allowed for kitchen — creates a small controlled gap
// so kitchen content isn't pinned to top-left corner of the view.
const KITCHEN_MAX_OFFSET_X = 10
const KITCHEN_MAX_OFFSET_Y = 25
// Bedroom/bathroom sit at the bottom of the source image. Allow a small
// over-pan so the camera can frame them higher with a visible bottom edge.
const BEDROOM_BOTTOM_EDGE_GAP = 8
const TRANSIT_DELAY_MS = 1500
const ROBOT_FOLLOW_DELAY_MS = 2200

function snapToDevicePixel(value: number) {
  const dpr = window.devicePixelRatio || 1
  return Math.round(value * dpr) / dpr
}

function waypointStyle(id: string, fallback: { x: number; y: number }): React.CSSProperties {
  const point = wpData.waypoints[id] ?? fallback
  return {
    left: `${point.x}%`,
    top: `${point.y}%`,
    transform: 'translate(-50%, -100%)',
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function FloorPlanView({
  initialRoom = null,
  initialCharRoom = 'living_room',
  initialRobotRoom = 'living_room',
  disableNavigation = false,
  highlightedRoom = null,
  scriptedDoorEncounterId = null,
}: FloorPlanViewProps = {}) {
  const viewRef = useRef<HTMLDivElement>(null)
  const pointerInsideGameAreaRef = useRef(true)
  const doorbellSequenceWasActiveRef = useRef(false)
  const doorbellAlreadyAnsweredRef = useRef(false)
  const [viewSize, setViewSize] = useState({ width: 0, height: 0 })
  const [currentRoom, setCurrentRoom] = useState<FloorRoom | null>(initialRoom)
  const [charRoom, setCharRoom] = useState<FloorRoom>(initialCharRoom)
  const [isMoving, setIsMoving] = useState(false)
  const [stationPopupAnchor, setStationPopupAnchor] = useState<{ x: number; y: number } | null>(null)

  // DEV-only: waypoint annotation tool
  const [showWaypointEditor, setShowWaypointEditor] = useState(false)

  // Robot state: follows user with a delay
  const [robotRoom, setRobotRoom] = useState<FloorRoom>(initialRobotRoom)
  const [isRobotMoving, setIsRobotMoving] = useState(false)
  const robotTimers = useRef<ReturnType<typeof setTimeout>[]>([])

  const clearRobotTimers = useCallback(() => {
    robotTimers.current.forEach(clearTimeout)
    robotTimers.current = []
  }, [])

  const scheduleRobotFollow = useCallback((target: FloorRoom, initialDelay: number) => {
    clearRobotTimers()
    setIsRobotMoving(false)
    const t1 = setTimeout(() => {
      setIsRobotMoving(true)
      const t2 = setTimeout(() => {
        setRobotRoom(target)
        setIsRobotMoving(false)
      }, 800)
      robotTimers.current.push(t2)
    }, initialDelay)
    robotTimers.current.push(t1)
  }, [clearRobotTimers])

  // Robot speech from game store
  const robotState = useGameStore((s) => s.robot)
  const setActiveStation = useGameStore((s) => s.setActiveStation)
  const activeStation = useGameStore((s) => s.activeStation)

  // Doorbell PM trigger → highlight living room navigation and front-door area.
  const pmPipelineState = useGameStore((s) => s.pmPipelineState)
  const doorbellActive = pmPipelineState?.step === 'trigger_event'
    && pmPipelineState.triggerType === 'doorbell'
  const encounterConfig = getActiveTriggerEncounterConfig({
    taskId: pmPipelineState?.taskId,
    triggerType: pmPipelineState?.triggerType,
    isFake: pmPipelineState?.isFake,
  })
  const scriptedDoorEncounterConfig = scriptedDoorEncounterId
    ? getTriggerEncounterConfig(scriptedDoorEncounterId)
    : null
  const activeDoorEncounterConfig = scriptedDoorEncounterConfig
    ?? (pmPipelineState?.triggerType === 'doorbell' ? encounterConfig : null)
  const encounterFocusActive = Boolean(
    scriptedDoorEncounterConfig
    || (encounterConfig
      && pmPipelineState?.step !== 'trigger_event'
      && pmPipelineState?.step !== 'completed')
  )
  const visitorVisible = Boolean(scriptedDoorEncounterConfig)
    || (pmPipelineState?.triggerType === 'doorbell'
    && (pmPipelineState.step === 'greeting'
      || pmPipelineState.step === 'reminder'
      || pmPipelineState.step === 'item_selection'
      || pmPipelineState.step === 'confidence_rating'
      || pmPipelineState.step === 'auto_execute'
      || pmPipelineState.step === 'fake_resolution'
      || pmPipelineState.step === 'direct_request'))

  const moveToWaypoint  = useCharacterStore((s) => s.moveToWaypoint)
  const teleportTo      = useCharacterStore((s) => s.teleportTo)
  const isCharMoving    = useCharacterStore((s) => s.isMoving)

  const isZoomed = currentRoom !== null

  useEffect(() => {
    if (doorbellActive) return
    doorbellAlreadyAnsweredRef.current = false
  }, [doorbellActive])

  useEffect(() => {
    if (!doorbellActive || currentRoom !== 'living_room' || doorbellAlreadyAnsweredRef.current) return
    doorbellAlreadyAnsweredRef.current = true
    moveToWaypoint('door_avatar', () => {
      window.dispatchEvent(new CustomEvent('pm:doorbell_answered'))
    })
  }, [currentRoom, doorbellActive, moveToWaypoint])

  useEffect(() => {
    if (pmPipelineState?.triggerType === 'doorbell') {
      doorbellSequenceWasActiveRef.current = true
      return
    }
    if (!doorbellSequenceWasActiveRef.current) return
    doorbellSequenceWasActiveRef.current = false
    setCurrentRoom('kitchen')
    setCharRoom('kitchen')
    setRobotRoom('kitchen')
    const entryId = resolveRoomPoint(wpData.room_meta?.kitchen?.entry, 'kitchen')
    if (entryId) teleportTo(entryId)
  }, [pmPipelineState, teleportTo])

  useEffect(() => {
    setCurrentRoom(initialRoom)
    setCharRoom(initialCharRoom)
    setRobotRoom(initialRobotRoom)

    const roomMeta = initialRoom ? wpData.room_meta?.[initialRoom] : null
    const entryId = resolveRoomPoint(roomMeta?.entry, initialRoom ?? undefined)
    if (entryId) {
      teleportTo(entryId)
    }
  }, [initialCharRoom, initialRobotRoom, initialRoom, teleportTo])

  // Navigate to a room: walk avatar to exit waypoint → camera cut → teleport to entry
  const navigateToRoom = useCallback((target: FloorRoom) => {
    if (disableNavigation) return
    if (isMoving) return
    if (target === currentRoom) return
    setActiveStation(null)
    setStationPopupAnchor(null)

    const currentMeta = currentRoom ? wpData.room_meta?.[currentRoom] : null
    const targetMeta  = wpData.room_meta?.[target] ?? null
    const exitId  = resolveRoomPoint(currentMeta?.exit, target)
    const entryId = resolveRoomPoint(targetMeta?.entry, currentRoom ?? undefined)

    const doTransition = () => {
      setIsMoving(true)
      setCurrentRoom(target)

      // Teleport avatar to entry after camera transition
      setTimeout(() => {
        if (entryId) {
          teleportTo(entryId)
        }
        setCharRoom(target)
        setIsMoving(false)
        if (doorbellActive && target === 'living_room') {
          doorbellAlreadyAnsweredRef.current = true
          window.dispatchEvent(new CustomEvent('pm:doorbell_answered'))
        }
      }, TRANSIT_DELAY_MS)

      scheduleRobotFollow(target, TRANSIT_DELAY_MS + 600)
    }

    if (exitId && !isCharMoving) {
      // Walk to exit first, then do transition
      moveToWaypoint(exitId, doTransition)
    } else {
      doTransition()
    }
  }, [currentRoom, disableNavigation, doorbellActive, isMoving, isCharMoving, moveToWaypoint, scheduleRobotFollow, setActiveStation, teleportTo])

  // Enter a room from overview — robot follows immediately with delay
  const enterRoom = useCallback((room: FloorRoom) => {
    if (disableNavigation) return
    setActiveStation(null)
    setStationPopupAnchor(null)
    setCurrentRoom(room)
    setCharRoom(room)
    if (doorbellActive && room === 'living_room') {
      doorbellAlreadyAnsweredRef.current = true
      window.dispatchEvent(new CustomEvent('pm:doorbell_answered'))
    }

    scheduleRobotFollow(room, ROBOT_FOLLOW_DELAY_MS)
  }, [disableNavigation, doorbellActive, setActiveStation, scheduleRobotFollow])

  useEffect(() => clearRobotTimers, [clearRobotTimers])

  useEffect(() => {
    const el = viewRef.current
    if (!el || typeof ResizeObserver === 'undefined') return

    const updateSize = () => {
      setViewSize({
        width: el.clientWidth,
        height: el.clientHeight,
      })
    }
    updateSize()

    const observer = new ResizeObserver(updateSize)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  // Station popup belongs only to the kitchen view.
  useEffect(() => {
    if (currentRoom !== 'kitchen') {
      setActiveStation(null)
      setStationPopupAnchor(null)
    }
  }, [currentRoom, setActiveStation])

  useEffect(() => {
    if (!activeStation) setStationPopupAnchor(null)
  }, [activeStation])

  const openStationPopup = useCallback((point: { clientX: number; clientY: number }) => {
    if (!pointerInsideGameAreaRef.current) return false
    const rect = viewRef.current?.getBoundingClientRect()
    if (!rect) return false
    setStationPopupAnchor({
      x: point.clientX - rect.left,
      y: point.clientY - rect.top,
    })
    return true
  }, [])

  const handleGameAreaMouseEnter = useCallback(() => {
    pointerInsideGameAreaRef.current = true
  }, [])

  const handleGameAreaMouseLeave = useCallback(() => {
    pointerInsideGameAreaRef.current = false
    setActiveStation(null)
    setStationPopupAnchor(null)
  }, [setActiveStation])

  // Compute clamped CSS transform: transform-origin 0 0, translate then scale.
  // Formula: tx = clamp((0.5 − S·cx/100)·100, (1−S)·100, 0)
  // This ensures the image always fills the container with no black borders.
  const floorTransform = useMemo(() => {
    if (!isZoomed) return 'translate3d(0px, 0px, 0) scale(1)'
    const room = encounterFocusActive && activeDoorEncounterConfig
      ? { ...ROOM_DEFS.living_room, ...DOOR_ENCOUNTER_FOCUS }
      : encounterFocusActive && currentRoom
        ? ROOM_DEFS[currentRoom]
      : ROOM_DEFS[currentRoom!]
    const isKitchen = currentRoom === 'kitchen'
    const S = encounterFocusActive ? ENCOUNTER_ZOOM_SCALE : isKitchen ? ZOOM_SCALE_KITCHEN : ZOOM_SCALE
    const minT = (1 - S) * 100
    const minTy = currentRoom === 'bedroom' && !encounterFocusActive ? minT - BEDROOM_BOTTOM_EDGE_GAP : minT
    const rawTx = (0.5 - S * room.cx / 100) * 100
    const rawTy = (0.5 - S * room.cy / 100) * 100
    const maxTx = isKitchen ? KITCHEN_MAX_OFFSET_X : 0
    const maxTy = isKitchen ? KITCHEN_MAX_OFFSET_Y : 0
    const tx = Math.min(maxTx, Math.max(minT, rawTx))
    const ty = Math.min(maxTy, Math.max(minTy, rawTy))
    const txPx = snapToDevicePixel((tx / 100) * viewSize.width)
    const tyPx = snapToDevicePixel((ty / 100) * viewSize.height)
    return `translate3d(${txPx}px, ${tyPx}px, 0) scale(${S})`
  }, [activeDoorEncounterConfig, encounterFocusActive, isZoomed, currentRoom, viewSize.height, viewSize.width])

  // Always keep transform-origin at top-left so the clamped math above is exact.
  const transformOrigin = '0% 0%'

  // Character position
  const charDef = ROOM_DEFS[charRoom]
  const robotDef = ROOM_DEFS[robotRoom]
  const robotMapPosition = encounterFocusActive && activeDoorEncounterConfig
    ? { cx: 60.5, cy: 81.8 }
    : robotDef

  return (
    <div
      ref={viewRef}
      className="absolute inset-0 overflow-hidden bg-slate-950 select-none"
      onMouseEnter={handleGameAreaMouseEnter}
      onMouseLeave={handleGameAreaMouseLeave}
    >

      {/* ── Floor plan layer (zoomable) ── */}
      <div
        className="absolute inset-0"
        style={{
          transform: floorTransform,
          transformOrigin,
          transition: 'transform 0.7s cubic-bezier(0.4, 0, 0.2, 1), transform-origin 0.7s cubic-bezier(0.4, 0, 0.2, 1)',
          willChange: 'transform',
        }}
      >
        {/* Background image — fills container without letterboxing */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            transform: 'translateZ(0)',
            backfaceVisibility: 'hidden',
            contain: 'paint',
          }}
        >
          <img
            src="/assets/floorplan.png"
            alt="Floor plan"
            draggable={false}
            className="absolute inset-0 w-full h-full pointer-events-none"
            style={{ objectFit: 'fill', imageRendering: 'pixelated' }}
          />
        </div>

        {/* ── Kitchen overlay — furniture sprites + interactive hotspots ── */}
        {(() => {
          const k = ROOM_DEFS.kitchen
          const inKitchen = currentRoom === 'kitchen'
          return (
            <div
              className="absolute"
              style={{ left: `${k.x}%`, top: `${k.y}%`, width: `${k.w}%`, height: `${k.h}%` }}
            >
              {/* Sprite layer — transparent placeholders until PNGs added */}
              <KitchenFurniture />
              {/* Interactive hotspot layer — only when zoomed into kitchen */}
              {inKitchen && <KitchenRoom isActive={true} onStationOpen={openStationPopup} />}
            </div>
          )
        })()}

        {/* Room click targets (overview mode) */}
        {!isZoomed && !disableNavigation && ALL_ROOMS.map((rid) => {
          const r = ROOM_DEFS[rid]
          const isHighlightedTarget = highlightedRoom === rid
          return (
            <div
              key={rid}
              className="absolute cursor-pointer group"
              style={{ left: `${r.x}%`, top: `${r.y}%`, width: `${r.w}%`, height: `${r.h}%` }}
              onClick={() => enterRoom(rid)}
            >
              {/* Hover highlight */}
              <div className={`absolute inset-0 rounded-sm transition-colors duration-200 border-2 ${
                isHighlightedTarget
                  ? 'bg-amber-400/20 border-amber-300/80 shadow-[0_0_24px_rgba(251,191,36,0.55)]'
                  : 'bg-amber-400/0 border-transparent group-hover:bg-amber-400/15 group-hover:border-amber-400/40'
              }`} />
              {/* Room label */}
              <div className="absolute top-2 left-2 pointer-events-none">
                <div className="inline-flex items-center gap-1 bg-slate-900/70 backdrop-blur-sm rounded-md px-2 py-1">
                  <span className="text-sm">{r.emoji}</span>
                  <span className="text-xs font-semibold text-slate-200">{ROOM_DEFS[rid].label}</span>
                </div>
              </div>
            </div>
          )
        })}

        {/* Doorbell trigger pulse near the living-room/front-door area. */}
        <AnimatePresence>
          {doorbellActive && (
            <motion.div
              className="absolute z-30 pointer-events-none"
              style={{ left: '59%', top: '50%' }}
              initial={{ opacity: 0, scale: 0.4 }}
              animate={{ opacity: 1, scale: [1, 1.2, 1] }}
              exit={{ opacity: 0, scale: 0.4 }}
              transition={{ scale: { repeat: Infinity, duration: 0.9 }, opacity: { duration: 0.2 } }}
            >
              <div className="rounded-full bg-amber-300/30 p-3 text-4xl shadow-[0_0_30px_rgba(251,191,36,0.9)]">
                🔔
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {visitorVisible && activeDoorEncounterConfig && (
            <motion.div
              className="absolute z-sprite-player pointer-events-none"
              style={waypointStyle('door_visitor', { x: 69.8, y: 81.8 })}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.3 }}
            >
              <CharacterSpriteSheet character={encounterCharacterId(activeDoorEncounterConfig.npcId)} facing="left" scale={1} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Player Avatar (sprite-based, movement-driven) ── */}
        <PlayerAvatar />

        {/* ── Robot (Pepper) — follows user with delay ── */}
        <AnimatePresence mode="wait">
          {!isRobotMoving && (
            <motion.div
              key={`robot-${robotRoom}`}
              className="absolute z-sprite-robot pointer-events-none"
              style={{
                left: `${robotMapPosition.cx}%`,
                top: `${robotMapPosition.cy}%`,
                transform: 'translate(-50%, -50%)',
              }}
              initial={{ opacity: 0, scale: 0.3 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.3 }}
              transition={{ duration: 0.35 }}
            >
              <RobotSprite speaking={robotState.speaking} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Robot walking indicator */}
        <AnimatePresence>
          {isRobotMoving && (
            <motion.div
              className="absolute z-sprite-robot pointer-events-none"
              style={{
                left: `${robotMapPosition.cx}%`,
                top: `${robotMapPosition.cy}%`,
                transform: 'translate(-50%, -50%)',
              }}
              initial={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <motion.div
                className="text-2xl drop-shadow-lg"
                animate={{ x: [0, 5, 0], y: [0, -4, 0] }}
                transition={{ repeat: Infinity, duration: 0.4 }}
              >
                🤖
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Waypoint Editor overlay (DEV only, inside zoom div) ── */}
        {import.meta.env.DEV && (
          <WaypointEditor currentRoom={currentRoom} isActive={showWaypointEditor} />
        )}
      </div>

      {/* Kitchen station popup is rendered at game-area level so it can follow the hotspot click position. */}
      {currentRoom === 'kitchen' && <KitchenStationOverlay anchor={stationPopupAnchor} />}

      {/* ── Robot speech bubble (viewport overlay so it's always readable) ── */}
      <AnimatePresence>
        {robotState.speaking && robotState.text && !isRobotMoving && (
          <motion.div
            className="absolute z-50 pointer-events-none"
            style={{ bottom: 80, left: 24 }}
            initial={{ opacity: 0, y: 10, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.95 }}
          >
            <div className="relative bg-white text-slate-800 text-xs rounded-xl px-3 py-2 max-w-[200px] shadow-xl speech-bubble">
              {robotState.text}
              <div className="absolute bottom-0 left-4 w-3 h-3 bg-white transform rotate-45 translate-y-1" />
            </div>
            {/* Robot label below bubble */}
            <div className="mt-3 flex items-center gap-1">
              <RobotSprite speaking={true} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Doorbell navigation prompt (only visible during PM trigger) ── */}
      {doorbellActive && currentRoom && currentRoom !== 'living_room' && !disableNavigation && !isMoving && !isCharMoving && (
        ADJACENCY[currentRoom].map((nav) => {
          const isDoorbellTarget = doorbellActive && nav.target === 'living_room'
          if (!isDoorbellTarget) return null
          return (
            <button
              key={nav.target}
              className="absolute z-40 flex items-center gap-2 px-5 py-3
                         bg-amber-500 text-slate-950 border-2 border-amber-100
                         rounded-lg shadow-2xl shadow-amber-950/40 whitespace-nowrap
                         transition-all duration-200 hover:scale-105 active:scale-95
                         cursor-pointer animate-pulse ring-4 ring-amber-400/35"
              style={navButtonStyle(nav)}
              onClick={() => navigateToRoom(nav.target)}
            >
              <span className="text-base font-bold">{ARROWS[nav.direction]}</span>
              <span className="text-sm font-bold">Front Door</span>
              <span className="text-base">🔔</span>
            </button>
          )
        })
      )}

      {/* ── Room navigation buttons (zoomed mode) ── */}
      {isZoomed && currentRoom && !doorbellActive && !disableNavigation && !isMoving && !isCharMoving && (
        ADJACENCY[currentRoom].filter((nav) => nav.target !== 'living_room').map((nav) => {
          const isHighlightedTarget = highlightedRoom === nav.target
          return (
            <button
              key={nav.target}
              className={`absolute z-40 flex items-center gap-2 px-4 py-2.5
                         rounded-lg border shadow-xl whitespace-nowrap
                         transition-all duration-200 hover:scale-105 active:scale-95
                         cursor-pointer ${
                           isHighlightedTarget
                             ? 'bg-amber-500 text-slate-950 border-amber-100 shadow-amber-950/40 animate-pulse ring-4 ring-amber-400/35'
                             : 'bg-slate-900/85 text-amber-100 border-amber-500/35 shadow-slate-950/40 hover:bg-slate-800/90 hover:border-amber-300/60'
                         }`}
              style={navButtonStyle(nav)}
              onClick={() => navigateToRoom(nav.target)}
            >
              <span className="text-base font-bold">{ARROWS[nav.direction]}</span>
              <span className="text-sm font-bold">{nav.label}</span>
            </button>
          )
        })
      )}

      {/* ── Room label badge (zoomed mode) ── */}
      {isZoomed && currentRoom && (
        <div className="absolute top-5 left-5 z-40 pointer-events-none">
          <motion.div
            key={currentRoom}
            className="bg-slate-900/85 backdrop-blur-sm rounded-xl px-5 py-2 border border-amber-500/30 shadow-lg"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <div className="flex items-center gap-2">
              <span className="text-lg">{ROOM_DEFS[currentRoom].emoji}</span>
              <span className="text-base font-semibold text-amber-100">{ROOM_DEFS[currentRoom].label}</span>
            </div>
          </motion.div>
        </div>
      )}


      {/* ── DEV: Waypoint editor toggle ── */}
      {import.meta.env.DEV && (
        <button
          className={`absolute bottom-5 right-5 z-40 text-xs px-3 py-1.5 rounded-lg border font-mono shadow-lg transition-colors
            ${showWaypointEditor
              ? 'bg-amber-500/30 border-amber-400/80 text-amber-200 hover:bg-amber-500/50'
              : 'bg-slate-800/80 border-slate-600/50 text-slate-400 hover:bg-slate-700/80 hover:text-slate-200'
            }`}
          onClick={() => setShowWaypointEditor(v => !v)}
        >
          {showWaypointEditor ? '⚙ WP Editor ON' : '⚙ WP Editor'}
        </button>
      )}
    </div>
  )
}

// ── Robot Sprite (Pepper) ─────────────────────────────────────────────────────

function RobotSprite({ speaking }: { speaking: boolean }) {
  return (
    <motion.div
      className="relative"
      animate={speaking ? { y: [0, -4, 0] } : { y: [0, -2, 0] }}
      transition={{ repeat: Infinity, duration: speaking ? 1.2 : 2.5, ease: 'easeInOut' }}
    >
      {/* Shadow */}
      <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-5 h-1.5 bg-black/25 rounded-full blur-sm" />
      {/* Body */}
      <svg width="26" height="38" viewBox="0 0 26 38" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Head — rounded robot head */}
        <rect x="5" y="1" width="16" height="14" rx="5" fill="#E8EEF4" stroke="#9BB0C8" strokeWidth="1.2" />
        {/* Visor / eye strip */}
        <rect x="7" y="5" width="12" height="5" rx="2" fill="#1A2A4A" />
        {/* Eye LEDs */}
        <circle cx="10" cy="7.5" r="1.5" fill={speaking ? '#00FFAA' : '#4FC3F7'} />
        <circle cx="16" cy="7.5" r="1.5" fill={speaking ? '#00FFAA' : '#4FC3F7'} />
        {/* Antenna */}
        <line x1="13" y1="1" x2="13" y2="-3" stroke="#9BB0C8" strokeWidth="1.2" strokeLinecap="round" />
        <circle cx="13" cy="-4" r="1.5" fill={speaking ? '#FFD700' : '#90CAF9'} />
        {/* Neck */}
        <rect x="10" y="15" width="6" height="3" rx="1" fill="#CBD5E1" />
        {/* Body / torso */}
        <rect x="4" y="18" width="18" height="12" rx="4" fill="#CBD5E1" stroke="#9BB0C8" strokeWidth="1" />
        {/* Chest panel */}
        <rect x="8" y="21" width="10" height="6" rx="2" fill="#E2E8F0" stroke="#90A4B8" strokeWidth="0.8" />
        {/* Chest LED row */}
        <circle cx="10" cy="24" r="1" fill={speaking ? '#00FFAA' : '#90CAF9'} />
        <circle cx="13" cy="24" r="1" fill="#90CAF9" />
        <circle cx="16" cy="24" r="1" fill="#90CAF9" />
        {/* Arms */}
        <rect x="0" y="19" width="4" height="9" rx="2" fill="#CBD5E1" stroke="#9BB0C8" strokeWidth="0.8" />
        <rect x="22" y="19" width="4" height="9" rx="2" fill="#CBD5E1" stroke="#9BB0C8" strokeWidth="0.8" />
        {/* Legs */}
        <rect x="7" y="30" width="5" height="7" rx="2" fill="#B0BEC5" stroke="#90A4AE" strokeWidth="0.8" />
        <rect x="14" y="30" width="5" height="7" rx="2" fill="#B0BEC5" stroke="#90A4AE" strokeWidth="0.8" />
        {/* Feet */}
        <rect x="6" y="35" width="7" height="3" rx="1.5" fill="#78909C" />
        <rect x="13" y="35" width="7" height="3" rx="1.5" fill="#78909C" />
      </svg>
      {/* "Pepper" label */}
      <div className="text-center text-[8px] text-cyan-300 font-semibold mt-0.5 drop-shadow">Pepper</div>
    </motion.div>
  )
}

function CharacterSprite() {
  return (
    <motion.div
      className="relative"
      animate={{ y: [0, -3, 0] }}
      transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
    >
      {/* Shadow */}
      <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-6 h-2 bg-black/30 rounded-full blur-sm" />
      {/* Body */}
      <svg width="28" height="40" viewBox="0 0 28 40" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Head */}
        <circle cx="14" cy="9" r="7" fill="#FBBF68" stroke="#D4922B" strokeWidth="1.5" />
        {/* Hair */}
        <path d="M7 8C7 4 10 2 14 2C18 2 21 4 21 8" fill="#5B3A1A" stroke="#3E2712" strokeWidth="0.8" />
        {/* Eyes */}
        <circle cx="11" cy="9" r="1.2" fill="#2D2D2D" />
        <circle cx="17" cy="9" r="1.2" fill="#2D2D2D" />
        {/* Smile */}
        <path d="M11.5 12C12.5 13.5 15.5 13.5 16.5 12" stroke="#D4922B" strokeWidth="0.8" strokeLinecap="round" fill="none" />
        {/* Body/Shirt */}
        <rect x="8" y="16" width="12" height="12" rx="3" fill="#4F8CFF" stroke="#3366CC" strokeWidth="1" />
        {/* Legs */}
        <rect x="9" y="28" width="4" height="9" rx="2" fill="#4A5568" stroke="#2D3748" strokeWidth="0.8" />
        <rect x="15" y="28" width="4" height="9" rx="2" fill="#4A5568" stroke="#2D3748" strokeWidth="0.8" />
        {/* Shoes */}
        <rect x="8" y="35" width="6" height="4" rx="2" fill="#C0392B" />
        <rect x="14" y="35" width="6" height="4" rx="2" fill="#C0392B" />
      </svg>
    </motion.div>
  )
}
