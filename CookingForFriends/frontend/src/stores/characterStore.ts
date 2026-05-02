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

interface CharacterState {
  position: { x: number; y: number }
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

const wpData = waypointData as WaypointData
const adjacency = buildAdjacency(wpData)

function getWaypoint(id: string) {
  return wpData.waypoints[id] ?? null
}

// ── Store ─────────────────────────────────────────────────────────────────────

export const useCharacterStore = create<CharacterState>((set, get) => ({
  position: { x: 35, y: 35 }, // placeholder until waypoints are annotated
  facing: 'down',
  animation: 'idle',
  isMoving: false,
  currentWaypointId: null,
  path: [],
  pendingInteraction: null,
  onArrival: null,
  showIdleBubble: false,

  // ── Movement API ─────────────────────────────────────────────────────────────

  moveToWaypoint(targetId, onArrival) {
    const { currentWaypointId, position } = get()

    // Determine BFS start: if we're at a known waypoint use it, else find nearest
    let fromId = currentWaypointId
    if (!fromId || !wpData.waypoints[fromId]) {
      fromId = findNearestWaypoint(position)
    }
    if (!fromId) {
      // No graph yet (waypoints.json empty) — just teleport
      const target = getWaypoint(targetId)
      if (target) {
        set({ position: { x: target.x, y: target.y }, currentWaypointId: targetId })
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
    set({
      position: { x: node.x, y: node.y },
      facing: node.facing ?? 'down',
      currentWaypointId: waypointId,
      isMoving: false,
      animation: 'idle',
      path: [],
    })
  },

  stopMovement() {
    set({ isMoving: false, animation: 'idle', path: [], onArrival: null })
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

    const { position } = state
    const dx = nextNode.x - position.x
    const dy = nextNode.y - position.y
    const distance = Math.sqrt(dx * dx + dy * dy)
    const step = (WALK_SPEED * deltaMs) / 1000

    const facing = getFacing(position, nextNode)

    if (step >= distance) {
      // Arrived at this waypoint
      const newPath = state.path.slice(1)
      const newPos = { x: nextNode.x, y: nextNode.y }

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
          position: newPos,
          facing,
          currentWaypointId: nextId,
          path: newPath,
        })
      }
    } else {
      // Still walking toward next waypoint
      const ratio = step / distance
      set({
        position: { x: position.x + dx * ratio, y: position.y + dy * ratio },
        facing,
      })
    }
  },
}))

// ── Movement loop ─────────────────────────────────────────────────────────────

let rafId: number | null = null
let lastTime: number | null = null

function tick(now: number) {
  const deltaMs = lastTime !== null ? Math.min(now - lastTime, 100) : 16
  lastTime = now
  useCharacterStore.getState()._tick(deltaMs)
  rafId = requestAnimationFrame(tick)
}

// Start the loop immediately (it's a no-op when isMoving=false)
rafId = requestAnimationFrame(tick)

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
