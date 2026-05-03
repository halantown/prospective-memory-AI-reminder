/**
 * characterStore — Zustand store for avatar movement and animation.
 *
 * Coordinates are % of the full floorplan image (matching waypointGraph.ts).
 * Movement uses requestAnimationFrame for smooth per-frame interpolation.
 */

import { create } from 'zustand'
import waypointData from '../data/waypoints.json'
import { buildAdjacency, bfsPath, getFacing, dist, type FacingDir, type WaypointData } from '../utils/waypointGraph'

const WALK_SPEED = 12 // % image units per second
const TURN_DURATION = 400 // ms — brief facing animation on station arrival

// ── Types ─────────────────────────────────────────────────────────────────────

export type AnimationState = 'idle' | 'walk' | 'sit'
type CharacterPosition = { x: number; y: number }
type PositionSubscriber = (position: CharacterPosition) => void

interface CharacterState {
  position: CharacterPosition
  facing: FacingDir
  animation: AnimationState
  isMoving: boolean
  currentWaypointId: string | null
  /** Remaining waypoint IDs to walk toward (head = immediate next target) */
  path: string[]
  /** Station ID to interact with after arriving at destination */
  pendingInteraction: string | null
  /** Callback invoked on arrival at final waypoint */
  onArrival: (() => void) | null
  /** Whether a "Nothing to do here" bubble should show */
  showIdleBubble: boolean

  // ── Actions ─────────────────────────────────────────────────────────────────
  moveToWaypoint: (targetId: string, onArrival?: () => void) => void
  moveToStation: (stationId: string, onArrival?: () => void) => void
  teleportTo: (waypointId: string) => void
  stopMovement: () => void
  setFacing: (facing: FacingDir) => void
  setAnimation: (animation: AnimationState) => void
  dismissIdleBubble: () => void
  /** Called each rAF tick by the movement loop (internal use) */
  _tick: (deltaMs: number) => void
}

// ── Waypoint graph (module-level, constructed once) ───────────────────────────

const wpData = waypointData as unknown as WaypointData
const adjacency = buildAdjacency(wpData)

function getWaypoint(id: string) {
  return wpData.waypoints[id] ?? null
}

let transientPosition: CharacterPosition = { x: 28.5, y: 17.5 }
const positionSubscribers = new Set<PositionSubscriber>()

export function subscribeCharacterPosition(subscriber: PositionSubscriber) {
  positionSubscribers.add(subscriber)
  subscriber(transientPosition)
  return () => {
    positionSubscribers.delete(subscriber)
  }
}

function setTransientPosition(position: CharacterPosition) {
  transientPosition = position
  for (const subscriber of positionSubscribers) {
    subscriber(position)
  }
}

// ── Store ─────────────────────────────────────────────────────────────────────

export const useCharacterStore = create<CharacterState>((set, get) => ({
  position: { x: 28.5, y: 17.5 }, // kitchen_center
  facing: 'down' as FacingDir,
  animation: 'idle' as AnimationState,
  isMoving: false,
  currentWaypointId: 'kitchen_center',
  path: [],
  pendingInteraction: null,
  onArrival: null,
  showIdleBubble: false,

  // ── Movement API ─────────────────────────────────────────────────────────────

  moveToWaypoint(targetId, onArrival) {
    const { currentWaypointId } = get()
    const position = transientPosition

    // Determine BFS start: if we're at a known waypoint use it, else find nearest
    let fromId = currentWaypointId
    if (!fromId || !wpData.waypoints[fromId]) {
      fromId = findNearestWaypoint(position)
    }
    if (!fromId) {
      // No graph yet (waypoints.json empty) — just teleport
      const target = getWaypoint(targetId)
      if (target) {
        const nextPosition = { x: target.x, y: target.y }
        setTransientPosition(nextPosition)
        set({ position: nextPosition, currentWaypointId: targetId })
        onArrival?.()
      }
      return
    }

    const path = bfsPath(adjacency, fromId, targetId)
    if (!path || path.length === 0) return

    // Skip first node if it's current position
    const remainingPath = path.slice(1)
    if (remainingPath.length === 0) {
      onArrival?.()
      return
    }

    set({
      path: remainingPath,
      isMoving: true,
      animation: 'walk',
      onArrival: onArrival ?? null,
    })
    startMovementLoop()
  },

  moveToStation(stationId, onArrival) {
    const { moveToWaypoint } = get()
    if (!wpData.waypoints[stationId]) {
      // Station not in waypoint graph yet — trigger interaction directly
      onArrival?.()
      return
    }
    moveToWaypoint(stationId, onArrival)
    set({ pendingInteraction: stationId })
  },

  teleportTo(waypointId) {
    const node = getWaypoint(waypointId)
    if (!node) return
    const nextPosition = { x: node.x, y: node.y }
    setTransientPosition(nextPosition)
    set({
      position: nextPosition,
      facing: node.facing ?? 'down',
      currentWaypointId: waypointId,
      isMoving: false,
      animation: 'idle',
      path: [],
    })
    stopMovementLoop()
  },

  stopMovement() {
    set({ position: transientPosition, isMoving: false, animation: 'idle', path: [], onArrival: null })
    stopMovementLoop()
  },

  setFacing(facing) {
    set({ facing })
  },

  setAnimation(animation) {
    set({ animation })
  },

  dismissIdleBubble() {
    set({ showIdleBubble: false })
  },

  // ── Per-frame tick (called by movement loop) ──────────────────────────────────

  _tick(deltaMs) {
    const state = get()
    if (!state.isMoving || state.path.length === 0) return

    const nextId = state.path[0]
    const nextNode = getWaypoint(nextId)
    if (!nextNode) {
      set({ isMoving: false, animation: 'idle', path: [] })
      return
    }

    const position = transientPosition
    const dx = nextNode.x - position.x
    const dy = nextNode.y - position.y
    const distance = Math.sqrt(dx * dx + dy * dy)
    const step = (WALK_SPEED * deltaMs) / 1000

    const facing = getFacing(position, nextNode)

    if (step >= distance) {
      // Arrived at this waypoint
      const newPath = state.path.slice(1)
      const newPos = { x: nextNode.x, y: nextNode.y }
      setTransientPosition(newPos)

      if (newPath.length === 0) {
        // Reached final destination
        const arrivalFacing = nextNode.facing ?? facing
        const { onArrival, pendingInteraction } = state

        set({
          position: newPos,
          facing: arrivalFacing,
          currentWaypointId: nextId,
          path: [],
          isMoving: false,
          animation: 'idle',
          pendingInteraction: null,
          onArrival: null,
        })

        if (onArrival) {
          // Brief turn delay before triggering interaction
          setTimeout(() => {
            onArrival()
          }, TURN_DURATION)
        } else if (pendingInteraction) {
          // Station had no active step
          set({ showIdleBubble: true })
          setTimeout(() => {
            get().dismissIdleBubble()
          }, 1500)
        }
        } else {
        set({
          facing,
          currentWaypointId: nextId,
          path: newPath,
        })
      }
    } else {
      // Still walking toward next waypoint
      const ratio = step / distance
      setTransientPosition({ x: position.x + dx * ratio, y: position.y + dy * ratio })
      if (facing !== state.facing) {
        set({ facing })
      }
    }
  },
}))

// ── Movement loop ─────────────────────────────────────────────────────────────

let rafId: number | null = null
let lastTime: number | null = null

function startMovementLoop() {
  if (rafId !== null) return
  lastTime = null
  rafId = requestAnimationFrame(tick)
}

function stopMovementLoop() {
  if (rafId !== null) {
    cancelAnimationFrame(rafId)
    rafId = null
  }
  lastTime = null
}

function tick(now: number) {
  rafId = null
  const deltaMs = lastTime !== null ? Math.min(now - lastTime, 100) : 16
  lastTime = now
  useCharacterStore.getState()._tick(deltaMs)

  const state = useCharacterStore.getState()
  if (state.isMoving && state.path.length > 0) {
    rafId = requestAnimationFrame(tick)
  } else {
    lastTime = null
  }
}

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    stopMovementLoop()
    positionSubscribers.clear()
  })
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function findNearestWaypoint(pos: { x: number; y: number }): string | null {
  const entries = Object.entries(wpData.waypoints)
  if (entries.length === 0) return null
  let bestId = entries[0][0]
  let bestDist = Infinity
  for (const [id, node] of entries) {
    const d = dist(pos, node)
    if (d < bestDist) {
      bestDist = d
      bestId = id
    }
  }
  return bestId
}
