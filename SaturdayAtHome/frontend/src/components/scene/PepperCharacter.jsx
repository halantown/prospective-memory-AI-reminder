import { motion, AnimatePresence } from 'framer-motion'
import { useGameStore } from '../../store/gameStore'
import { ROOMS } from './sceneConstants'

export default function PepperCharacter() {
  const currentRoom = useGameStore(s => s.currentRoom)
  const robotStatus = useGameStore(s => s.robotStatus)
  const robotText = useGameStore(s => s.robotText)
  const room = ROOMS[currentRoom] || ROOMS.study

  // Offset from avatar position (stands next to participant)
  const targetX = room.x + (room.workSpot?.x || room.w / 2) + 30
  const targetY = room.y + (room.workSpot?.y || room.h / 2) - 16

  return (
    <motion.div
      className="absolute z-30 flex flex-col items-center pointer-events-none select-none"
      animate={{ left: targetX, top: targetY }}
      transition={{ duration: 2.8, ease: 'easeInOut', delay: 0.3 }}
    >
      {/* Speech bubble — identical style for neutral comments AND reminders */}
      <AnimatePresence>
        {robotText && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.8 }}
            className="absolute -top-2 left-1/2 -translate-x-1/2 -translate-y-full
                       bg-white border border-stone-300 rounded-lg shadow-lg px-3 py-2
                       text-xs text-stone-700 leading-relaxed max-w-48 min-w-24 text-center z-40"
          >
            {robotText}
            {/* Speech bubble arrow */}
            <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-white border-r border-b border-stone-300 rotate-45" />
          </motion.div>
        )}
      </AnimatePresence>

      <motion.span
        className="text-2xl leading-none drop-shadow-md"
        animate={robotStatus === 'speaking' ? { scale: [1, 1.05, 1] } : {}}
        transition={robotStatus === 'speaking' ? { duration: 0.4, repeat: Infinity } : {}}
      >
        🤖
      </motion.span>
      <span className="text-[7px] text-stone-500 font-medium bg-white/70 px-1 rounded mt-0.5">Pepper</span>
    </motion.div>
  )
}
