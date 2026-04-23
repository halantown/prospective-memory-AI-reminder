/**
 * useCharacterSprite — manages character position, direction, and walk state.
 *
 * Position is stored as % of the WorldView container (matching FLOOR_PLAN units).
 * Walking state drives the animation selection in CharacterSprite.
 */

import { useCallback, useRef, useState } from 'react'
import type { WalkDir } from '../components/game/sprites/characterAnimations'
import type { RoomId } from '../types'

/** Center of each room in % of the WorldView container.
 *  Derived from FLOOR_PLAN: center = left + width/2, top + height/2. */
const ROOM_CENTERS: Record<RoomId, { x: number; y: number }> = {
  kitchen:     { x: 0  + 42/2,       y: 0  + 64/2      }, // (21, 32)
  living_room: { x: 43 + 57/2,       y: 0  + 38/2      }, // (71.5, 19)
  study:       { x: 43 + 28/2,       y: 39 + 25/2      }, // (57, 51.5)
  bathroom:    { x: 72 + 28/2,       y: 39 + 25/2      }, // (86, 51.5)
  dining_room: { x: 0  + 42/2,       y: 65 + 35/2      }, // (21, 82.5)
  hallway:     { x: 43 + 57/2,       y: 65 + 35/2      }, // (71.5, 82.5)
}

/** Duration of the walk animation in ms. Should match Framer Motion transition duration. */
const WALK_DURATION_MS = 800

export interface CharacterSpriteState {
  /** Position as % of the WorldView container */
  pos: { x: number; y: number }
  dir: WalkDir
  walking: boolean
  walkTo: (roomId: RoomId) => void
}

export function useCharacterSprite(initialRoom: RoomId = 'kitchen'): CharacterSpriteState {
  const [pos, setPos]     = useState(ROOM_CENTERS[initialRoom])
  const [dir, setDir]     = useState<WalkDir>('down')
  const [walking, setWalking] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const walkTo = useCallback((roomId: RoomId) => {
    const target = ROOM_CENTERS[roomId]

    setPos(current => {
      const dx = target.x - current.x
      const dy = target.y - current.y

      // Pick direction based on dominant axis
      if (Math.abs(dx) >= Math.abs(dy)) {
        setDir(dx >= 0 ? 'right' : 'left')
      } else {
        setDir(dy >= 0 ? 'down' : 'up')
      }
      return current // position is updated below
    })

    setPos(target)
    setWalking(true)

    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      setWalking(false)
      timerRef.current = null
    }, WALK_DURATION_MS)
  }, [])

  return { pos, dir, walking, walkTo }
}
