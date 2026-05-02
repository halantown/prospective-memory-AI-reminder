/**
 * PlayerAvatar — Positions the avatar sprite on the floorplan.
 *
 * Placed as a direct child of the zoom div (absolute, % coordinates).
 * Foot of the sprite anchors to the (x, y) coordinate point.
 * transform: translate(-50%, -100%) → horizontal center + foot at bottom.
 *
 * Renders an optional "Nothing to do here" idle bubble when showIdleBubble=true.
 */

import { AnimatePresence, motion } from 'framer-motion'
import { useCharacterStore } from '../../stores/characterStore'
import AvatarSprite from './AvatarSprite'

export default function PlayerAvatar() {
  const position    = useCharacterStore(s => s.position)
  const facing      = useCharacterStore(s => s.facing)
  const animation   = useCharacterStore(s => s.animation)
  const showIdleBubble = useCharacterStore(s => s.showIdleBubble)

  return (
    <>
      {/* Avatar sprite */}
      <div
        className="absolute pointer-events-none"
        style={{
          left: `${position.x}%`,
          top:  `${position.y}%`,
          transform: 'translate(-50%, -100%)',
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
