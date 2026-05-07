/**
 * AvatarSprite — CSS sprite sheet animation for the player avatar.
 *
 * Sprite sheets (48×96px per frame):
 *   idle.png  — 24 frames: right 0–5, up 6–11, left 12–17, down 18–23
 *   walk.png  — 24 frames: same layout
 *   sit.png   — 12 frames: right 0–5, left 6–10
 *
 * CSS technique:
 *   background-size: auto 96px  (keep native height, width scales with sheet)
 *   background-position: calc(frameIndex * -48px) 0px
 *   element: 48×96px
 */

import type { CSSProperties } from 'react'
import type { FacingDir } from '../../utils/waypointGraph'
import type { AnimationState } from '../../stores/characterStore'

// ── Constants ─────────────────────────────────────────────────────────────────

const FRAME_RATE = 8 // fps

const SPRITE_SHEETS: Record<AnimationState, string> = {
  idle: '/assets/characters/Avatar_idle.png',
  walk: '/assets/characters/Avatar_walk.png',
  sit:  '/assets/characters/Avatar_sit.png',
}

/** First frame index for each direction × animation combination */
const FRAME_START: Record<AnimationState, Partial<Record<FacingDir, number>>> = {
  idle: { right: 0, up: 6, left: 12, down: 18 },
  walk: { right: 0, up: 6, left: 12, down: 18 },
  sit:  { right: 0, left: 6 },
}

const FRAME_COUNT: Record<AnimationState, number> = {
  idle: 6,
  walk: 6,
  sit:  6,
}

// ── Component ─────────────────────────────────────────────────────────────────

interface AvatarSpriteProps {
  animation: AnimationState
  facing: FacingDir
  /** Scale multiplier — 1 = 48×96 native, 2 = 96×192, etc. */
  scale?: number
  className?: string
}

export default function AvatarSprite({ animation, facing, scale = 1, className = '' }: AvatarSpriteProps) {
  // Resolve direction — sit only has right/left
  const effectiveFacing: FacingDir =
    animation === 'sit'
      ? (facing === 'left' ? 'left' : 'right')
      : facing

  const startFrame = FRAME_START[animation][effectiveFacing] ?? 0
  const frameCount = FRAME_COUNT[animation]

  const w = 48 * scale
  const h = 96 * scale
  const startX = -startFrame * w
  const endX = -(startFrame + frameCount) * w
  const durationS = frameCount / FRAME_RATE
  const style = {
    width: w,
    height: h,
    backgroundImage: `url(${SPRITE_SHEETS[animation]})`,
    backgroundRepeat: 'no-repeat',
    backgroundSize: `auto ${h}px`,
    backgroundPosition: `${startX}px 0px`,
    imageRendering: 'pixelated',
    animation: `avatar-sprite-frames ${durationS}s steps(${frameCount}) infinite`,
    '--avatar-sprite-end-x': `${endX}px`,
  } as CSSProperties

  return (
    <div
      key={`${animation}-${effectiveFacing}-${scale}`}
      className={className}
      style={style}
    />
  )
}
