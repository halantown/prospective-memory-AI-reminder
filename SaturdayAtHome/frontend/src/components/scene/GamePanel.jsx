import { motion, AnimatePresence } from 'framer-motion'
import { useGameStore } from '../../store/gameStore'
import SemanticCatGame from '../game/SemanticCatGame'
import GoNoGoGame from '../game/GoNoGoGame'
import TriviaGame from '../game/TriviaGame'
import { ROOMS, SCENE_WIDTH, SCENE_HEIGHT } from './sceneConstants'

export default function GamePanel() {
  const gameActive = useGameStore(s => s.gameActive)
  const gameType = useGameStore(s => s.currentGameType)
  const gameDimmed = useGameStore(s => s.gameDimmed)
  const currentRoom = useGameStore(s => s.currentRoom)
  const activityLabel = useGameStore(s => s.activityLabel)

  const room = ROOMS[currentRoom] || ROOMS.study

  // Panel size: ~60% of scene
  const panelW = SCENE_WIDTH * 0.58
  const panelH = SCENE_HEIGHT * 0.65

  // Position: center on the current room, clamped to scene bounds
  const centerX = room.x + room.w / 2
  const centerY = room.y + room.h / 2
  const panelX = Math.max(10, Math.min(centerX - panelW / 2, SCENE_WIDTH - panelW - 10))
  const panelY = Math.max(10, Math.min(centerY - panelH / 2, SCENE_HEIGHT - panelH - 10))

  const roomEmoji = {
    study: '📧', kitchen: '🍳', living: '🎧', laundry: '🫧', entrance: '🚪', balcony: '🛒'
  }

  return (
    <AnimatePresence>
      {gameActive && (
        <motion.div
          className={`absolute z-30 rounded-2xl shadow-2xl border border-stone-200 overflow-hidden flex flex-col
            ${gameDimmed ? 'opacity-30 pointer-events-none' : ''} transition-opacity`}
          style={{
            left: panelX,
            top: panelY,
            width: panelW,
            height: panelH,
            backgroundColor: 'rgba(255, 255, 255, 0.92)',
            backdropFilter: 'blur(8px)',
          }}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          transition={{ duration: 0.3 }}
        >
          {/* Title bar */}
          <div className="flex items-center gap-2 px-4 py-2 bg-stone-50 border-b border-stone-200">
            <span className="text-lg">{roomEmoji[currentRoom] || '🏠'}</span>
            <span className="text-sm font-semibold text-stone-700">
              {activityLabel || room.label}
            </span>
            <span className="text-xs text-stone-400 ml-auto">{room.label}</span>
          </div>

          {/* Game content area */}
          <div className="flex-1 min-h-0 overflow-auto">
            {gameType === 'semantic_cat' && <SemanticCatGame />}
            {gameType === 'go_nogo' && <GoNoGoGame />}
            {gameType === 'trivia' && <TriviaGame />}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
