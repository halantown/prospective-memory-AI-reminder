/**
 * PlayerAvatar — Positions the avatar sprite on the floorplan.
 *
 * Placed as a direct child of the zoom div (absolute, % coordinates).
 * Foot of the sprite anchors to the (x, y) coordinate point.
 * transform: translate(-50%, -100%) → horizontal center + foot at bottom.
 *
 * Renders an optional "Nothing to do here" idle bubble when showIdleBubble=true.
 */

import { useCallback, useEffect, useRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { subscribeCharacterPosition, useCharacterStore } from '../../stores/characterStore'
import AvatarSprite from './AvatarSprite'

export default function PlayerAvatar() {
  const facing      = useCharacterStore(s => s.facing)
  const animation   = useCharacterStore(s => s.animation)
  const showIdleBubble = useCharacterStore(s => s.showIdleBubble)
  const avatarRef = useRef<HTMLDivElement>(null)

  const updateAvatarTransform = useCallback((position: { x: number; y: number }) => {
    const el = avatarRef.current
    const parent = el?.parentElement
    if (!el || !parent) return

    const xPx = (position.x / 100) * parent.clientWidth
    const yPx = (position.y / 100) * parent.clientHeight
    el.style.transform = `translate3d(${xPx}px, ${yPx}px, 0) translate(-50%, -100%)`
  }, [])

  useEffect(() => {
    const unsubscribe = subscribeCharacterPosition(updateAvatarTransform)

    const parent = avatarRef.current?.parentElement
    const resizeObserver = parent && typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(() => updateAvatarTransform(useCharacterStore.getState().position))
      : null
    if (parent && resizeObserver) resizeObserver.observe(parent)

    return () => {
      unsubscribe()
      resizeObserver?.disconnect()
    }
  }, [updateAvatarTransform])

  return (
    <>
      {/* Avatar sprite */}
      <div
        ref={avatarRef}
        className="absolute pointer-events-none"
        style={{
          left: 0,
          top: 0,
          transform: 'translate3d(0, 0, 0) translate(-50%, -100%)',
          willChange: 'transform',
          zIndex: 30,
        }}
      >
        <AvatarSprite animation={animation} facing={facing} />

        {/* Idle bubble */}
        <AnimatePresence>
          {showIdleBubble && (
            <motion.div
              className="absolute bottom-full left-1/2 mb-1 px-2 py-1 rounded-lg bg-slate-800/90 text-white text-xs whitespace-nowrap shadow-lg pointer-events-none"
              style={{ transform: 'translateX(-50%)' }}
              initial={{ opacity: 0, y: 4, scale: 0.85 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.85 }}
              transition={{ duration: 0.2 }}
            >
              Nothing to do here
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  )
}
