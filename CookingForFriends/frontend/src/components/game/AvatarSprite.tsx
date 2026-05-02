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

import { useEffect, useRef, useState } from 'react'
import type { FacingDir } from '../../utils/waypointGraph'
import type { AnimationState } from '../../stores/characterStore'

// ── Constants ─────────────────────────────────────────────────────────────────

const FRAME_RATE = 8 // fps

const SPRITE_SHEETS: Record<AnimationState, string> = {
  idle: '/assets/characters/avatar1/test1_idle.png',
  walk: '/assets/characters/avatar1/test1_walk.png',
  sit:  '/assets/characters/avatar1/test1_sit.png',
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
  const [frame, setFrame] = useState(0)
  const prevAnimRef = useRef(animation)

  // Reset frame on animation change
  useEffect(() => {
    if (prevAnimRef.current !== animation) {
      setFrame(0)
      prevAnimRef.current = animation
    }
  }, [animation])

  // Advance frame at FRAME_RATE fps
  useEffect(() => {
    const id = setInterval(() => {
      setFrame(f => (f + 1) % FRAME_COUNT[animation])
    }, 1000 / FRAME_RATE)
    return () => clearInterval(id)
  }, [animation])

  // Resolve direction — sit only has right/left
  const effectiveFacing: FacingDir =
    animation === 'sit'
      ? (facing === 'left' ? 'left' : 'right')
      : facing

  const startFrame = FRAME_START[animation][effectiveFacing] ?? 0
  const frameIndex = startFrame + frame

  const w = 48 * scale
  const h = 96 * scale

  return (
    <div
      className={className}
      style={{
        width: w,
        height: h,
        backgroundImage: `url(${SPRITE_SHEETS[animation]})`,
        backgroundRepeat: 'no-repeat',
        backgroundSize: `auto ${h}px`,
        backgroundPosition: `calc(${frameIndex} * ${-w}px) 0px`,
        imageRendering: 'pixelated',
      }}
    />
  )
}
