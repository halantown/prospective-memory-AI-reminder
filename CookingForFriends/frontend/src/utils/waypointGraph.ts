/**
 * waypointGraph.ts — Waypoint data types, graph construction, and BFS pathfinding.
 *
 * Coordinates are expressed as percentage of the full floorplan image
 * (0–100 for both x and y), matching the coordinate system used in FloorPlanView.
 */

export type FacingDir = 'up' | 'down' | 'left' | 'right'

export interface WaypointNode {
  /** % of image width */
  x: number
  /** % of image height */
  y: number
  room: string | null
  /** If true, this waypoint corresponds to an interactable kitchen station */
  station?: boolean
  /** Direction avatar should face when arriving at this station */
  facing?: FacingDir
}

/** A room_meta exit/entry point can be a single waypoint ID, or a map from target-room → waypoint ID. */
export type RoomPointSpec = string | Record<string, string> | null

export interface WaypointData {
  waypoints: Record<string, WaypointNode>
  /** Undirected edges as pairs of waypoint IDs */
  edges: [string, string][]
  room_meta?: Record<string, { exit?: RoomPointSpec; entry?: RoomPointSpec }>
}

/**
 * Resolve a room_meta exit/entry field, optionally for a specific other room.
 * Supports both single waypoint IDs and per-destination maps.
 */
export function resolveRoomPoint(
  field: RoomPointSpec | undefined,
  otherRoom?: string
): string | null {
  if (!field) return null
  if (typeof field === 'string') return field
  if (otherRoom && field[otherRoom]) return field[otherRoom]
  const vals = Object.values(field)
  return vals[0] ?? null
}

// ── Graph construction ────────────────────────────────────────────────────────

export function buildAdjacency(data: WaypointData): Record<string, string[]> {
  const adj: Record<string, string[]> = {}
  for (const id of Object.keys(data.waypoints)) {
    adj[id] = []
  }
  for (const [a, b] of data.edges) {
    if (adj[a]) adj[a].push(b)
    if (adj[b]) adj[b].push(a)
  }
  return adj
}

// ── BFS pathfinding ───────────────────────────────────────────────────────────

/**
 * Returns an ordered list of waypoint IDs from `from` to `to`, inclusive.
 * Returns null if no path exists or either node is missing.
 */
export function bfsPath(
  adj: Record<string, string[]>,
  from: string,
  to: string,
): string[] | null {
  if (from === to) return [from]
  if (!adj[from] || !adj[to]) return null

  const visited = new Set<string>([from])
  const queue: { id: string; path: string[] }[] = [{ id: from, path: [from] }]

  while (queue.length > 0) {
    const { id, path } = queue.shift()!
    for (const neighbor of adj[id] ?? []) {
      if (neighbor === to) return [...path, neighbor]
      if (!visited.has(neighbor)) {
        visited.add(neighbor)
        queue.push({ id: neighbor, path: [...path, neighbor] })
      }
    }
  }
  return null
}

// ── Direction helpers ─────────────────────────────────────────────────────────

/** Returns the primary facing direction when moving from one point to another. */
export function getFacing(
  from: { x: number; y: number },
  to: { x: number; y: number },
): FacingDir {
  const dx = to.x - from.x
  const dy = to.y - from.y
  return Math.abs(dx) >= Math.abs(dy)
    ? dx >= 0 ? 'right' : 'left'
    : dy >= 0 ? 'down' : 'up'
}

/** Euclidean distance between two image-% points. */
export function dist(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2)
}
