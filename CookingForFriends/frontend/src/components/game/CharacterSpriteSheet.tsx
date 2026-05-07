/** Generic 48x96 character sprite-sheet renderer. */

import type { CSSProperties } from 'react'
import type { FacingDir } from '../../utils/waypointGraph'
import type { AnimationState } from '../../stores/characterStore'

export type CharacterSpriteId =
  | 'avatar'
  | 'mei'
  | 'sophia'
  | 'benjamin'
  | 'courier'
  | 'sam_tutorial'

const FRAME_RATE = 8

const SPRITE_FILES: Record<CharacterSpriteId, Partial<Record<AnimationState | 'phone', string>>> = {
  avatar: {
    idle: '/assets/characters/Avatar_idle.png',
    walk: '/assets/characters/Avatar_walk.png',
    sit: '/assets/characters/Avatar_sit.png',
    phone: '/assets/characters/Avatar_phone.png',
  },
  mei: {
    idle: '/assets/characters/Mei_idle.png',
    walk: '/assets/characters/Mei_walk.png',
    sit: '/assets/characters/Mei_sit.png',
  },
  sophia: {
    idle: '/assets/characters/Sophia_idle.png',
    walk: '/assets/characters/Sophia_walk.png',
    sit: '/assets/characters/Sophia_sit.png',
  },
  benjamin: {
    idle: '/assets/characters/Benjamin_idle.png',
    walk: '/assets/characters/Benjamin_walk.png',
    sit: '/assets/characters/Benjamin_sit.png',
    phone: '/assets/characters/Benjamin_phone.png',
  },
  courier: {
    idle: '/assets/characters/courier_idle.png',
    walk: '/assets/characters/courier_walk.png',
    phone: '/assets/characters/courier_phone.png',
  },
  sam_tutorial: {
    idle: '/assets/characters/Sam_tutorial_idle.png',
    walk: '/assets/characters/Sam_tutorial_walk.png',
  },
}

const FRAME_START: Record<AnimationState | 'phone', Partial<Record<FacingDir, number>>> = {
  idle: { right: 0, up: 6, left: 12, down: 18 },
  walk: { right: 0, up: 6, left: 12, down: 18 },
  sit: { right: 0, left: 6 },
  phone: { right: 0, left: 6 },
}

const FRAME_COUNT: Record<AnimationState | 'phone', number> = {
  idle: 6,
  walk: 6,
  sit: 6,
  phone: 6,
}

interface CharacterSpriteSheetProps {
  character: CharacterSpriteId
  animation?: AnimationState | 'phone'
  facing?: FacingDir
  scale?: number
  className?: string
}

export default function CharacterSpriteSheet({
  character,
  animation = 'idle',
  facing = 'down',
  scale = 1,
  className = '',
}: CharacterSpriteSheetProps) {
  const sheet = SPRITE_FILES[character][animation] ?? SPRITE_FILES[character].idle
  const effectiveFacing: FacingDir =
    animation === 'sit' || animation === 'phone'
      ? (facing === 'left' ? 'left' : 'right')
      : facing
  const startFrame = FRAME_START[animation][effectiveFacing] ?? 0
  const frameCount = FRAME_COUNT[animation]
  const w = 48
  const h = 96
  const endX = -(startFrame + frameCount) * w

  const style = {
    width: w,
    height: h,
    backgroundImage: `url(${sheet})`,
    backgroundRepeat: 'no-repeat',
    backgroundSize: `auto ${h}px`,
    backgroundPosition: `${-startFrame * w}px 0px`,
    imageRendering: 'pixelated',
    animation: `avatar-sprite-frames ${frameCount / FRAME_RATE}s steps(${frameCount}) infinite`,
    overflow: 'hidden',
    transform: scale === 1 ? undefined : `scale(${scale})`,
    transformOrigin: '50% 100%',
    '--avatar-sprite-end-x': `${endX}px`,
  } as CSSProperties

  return <div key={`${character}-${animation}-${effectiveFacing}-${scale}`} className={className} style={style} />
}
