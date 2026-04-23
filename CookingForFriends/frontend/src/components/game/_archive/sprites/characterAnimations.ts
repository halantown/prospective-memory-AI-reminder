/**
 * Character spritesheet animation definitions.
 *
 * Spritesheet: Premade_Character_48x48_01.png — 56 cols × 41 rows, each frame 48×48px.
 *
 * Row mapping (calibrated visually):
 *   Row 0  — idle_up    (4 frames, overhead view)
 *   Row 1  — idle_down  (4 frames, front-facing)
 *   Row 2  — walk_up    (24 frames, overhead)
 *   Row 3  — walk_down  (24 frames, front-facing)
 *   Row 4  — walk_left  (24 frames)
 *   Row 5  — walk_right (24 frames)
 */
import type { AnimationDef } from './SpriteSheet'

export const CHAR_SHEET = {
  src:       '/assets/characters/character_01.png',
  sheetCols: 56,
  frameW:    48,
  frameH:    48,
} as const

export type WalkDir = 'down' | 'up' | 'left' | 'right'

/** All named animations for the character. */
export const CHAR_ANIMATIONS: Record<`idle_${WalkDir}` | `walk_${WalkDir}`, AnimationDef> = {
  idle_up:    { row: 0, frameCount: 4,  fps: 4  },
  idle_down:  { row: 1, frameCount: 4,  fps: 4  },
  idle_left:  { row: 0, frameCount: 4,  fps: 4  }, // fallback to idle_up until calibrated
  idle_right: { row: 1, frameCount: 4,  fps: 4  }, // fallback to idle_down until calibrated
  walk_up:    { row: 2, frameCount: 24, fps: 12 },
  walk_down:  { row: 3, frameCount: 24, fps: 12 },
  walk_left:  { row: 4, frameCount: 24, fps: 12 },
  walk_right: { row: 5, frameCount: 24, fps: 12 },
}

/** Pick the correct AnimationDef for a given walking/idle state. */
export function getCharAnimation(dir: WalkDir, walking: boolean): AnimationDef {
  const key = walking ? (`walk_${dir}` as const) : (`idle_${dir}` as const)
  return CHAR_ANIMATIONS[key]
}
