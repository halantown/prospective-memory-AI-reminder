/**
 * SpriteSheet — generic spritesheet animation component.
 *
 * Renders one animation from a sprite atlas by setting CSS
 * background-position and a dynamically injected @keyframes rule.
 * Supports any frame count; no hardcoded values.
 *
 * Usage:
 *   <SpriteSheet
 *     src="/assets/character_01.png"
 *     sheetCols={56}
 *     frameW={48}
 *     frameH={48}
 *     animation={{ row: 2, frameCount: 24, fps: 12 }}
 *   />
 */

import { useEffect, useRef } from 'react'
import { ensureSpriteKeyframe } from './spriteUtils'

export interface AnimationDef {
  /** Zero-based row index in the spritesheet */
  row: number
  /** Number of frames in this animation */
  frameCount: number
  /** Playback speed in frames per second */
  fps?: number
  /** Whether to loop; defaults to true */
  loop?: boolean
  /** Frame to start from (default 0) — for animations that don't start at column 0 */
  startCol?: number
}

interface SpriteSheetProps {
  src: string
  /** Total number of columns in the full sheet (needed to compute backgroundSize) */
  sheetCols: number
  frameW: number
  frameH: number
  animation: AnimationDef
  /** Optional CSS scale via transform (keeps pixel-perfect rendering) */
  scale?: number
  className?: string
  style?: React.CSSProperties
}

export default function SpriteSheet({
  src,
  sheetCols,
  frameW,
  frameH,
  animation,
  scale = 1,
  className,
  style,
}: SpriteSheetProps) {
  const { row, frameCount, fps = 10, loop = true, startCol = 0 } = animation
  const ref = useRef<HTMLDivElement>(null)

  // Ensure @keyframes exists for this frameCount × frameW combination
  const keyframeName = ensureSpriteKeyframe(frameCount, frameW)

  useEffect(() => {
    // Nothing to do — ensureSpriteKeyframe handles injection at render time.
    // This effect exists as a hook dependency boundary in case src changes.
  }, [src, frameCount, frameW])

  const durationSec = frameCount / (fps || 10)
  const iterationCount = loop ? 'infinite' : '1'

  // Native-size sprite div (animation always runs at 1× pixel coordinates)
  const spriteInner: React.CSSProperties = {
    width:  frameW,
    height: frameH,
    backgroundImage:     `url(${src})`,
    backgroundRepeat:    'no-repeat',
    backgroundPositionX: -(startCol * frameW),
    backgroundPositionY: -(row * frameH),
    backgroundSize:      `${sheetCols * frameW}px auto`,
    imageRendering:      'pixelated',
    animation: `${keyframeName} ${durationSec}s steps(${frameCount}) ${iterationCount}`,
    willChange: 'background-position',
  }

  if (scale === 1) {
    return <div ref={ref} className={className} style={{ ...spriteInner, ...style }} />
  }

  // For scaled rendering: outer div owns the layout size, inner div animates at 1×
  return (
    <div
      ref={ref}
      className={className}
      style={{ width: frameW * scale, height: frameH * scale, overflow: 'hidden', ...style }}
    >
      <div style={{ ...spriteInner, transform: `scale(${scale})`, transformOrigin: 'top left' }} />
    </div>
  )
}
