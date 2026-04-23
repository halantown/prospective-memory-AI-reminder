/**
 * CharacterSprite — the player character rendered on the WorldView.
 *
 * Combines:
 *  - Framer Motion for smooth position transitions (% of container)
 *  - SpriteSheet for directional walk / idle animation
 *  - useCharacterSprite hook for state management
 */

import { motion } from 'framer-motion'
import SpriteSheet from './sprites/SpriteSheet'
import { CHAR_SHEET, getCharAnimation } from './sprites/characterAnimations'
import type { CharacterSpriteState } from '../../hooks/useCharacterSprite'

interface CharacterSpriteProps {
  state: CharacterSpriteState
}

const FRAME_DISPLAY_SIZE = 48 // native sprite size; scale via CSS if needed

export default function CharacterSprite({ state }: CharacterSpriteProps) {
  const { pos, dir, walking } = state
  const animation = getCharAnimation(dir, walking)

  return (
    <motion.div
      className="absolute z-30 pointer-events-none"
      // Offset by half the sprite size so the character is centered on its position
      style={{
        marginLeft: -(FRAME_DISPLAY_SIZE / 2),
        marginTop:  -(FRAME_DISPLAY_SIZE / 2),
      }}
      animate={{ left: `${pos.x}%`, top: `${pos.y}%` }}
      transition={{ duration: 0.8, ease: 'linear' }}
    >
      <SpriteSheet
        src={CHAR_SHEET.src}
        sheetCols={CHAR_SHEET.sheetCols}
        frameW={CHAR_SHEET.frameW}
        frameH={CHAR_SHEET.frameH}
        animation={animation}
      />
    </motion.div>
  )
}
