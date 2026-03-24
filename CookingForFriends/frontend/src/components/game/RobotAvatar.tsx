/** Robot avatar — sprite + speech bubble. No is_reminder distinction. */

import { motion, AnimatePresence } from 'framer-motion'
import { useGameStore } from '../../stores/gameStore'

export default function RobotAvatar() {
  const robot = useGameStore((s) => s.robot)
  const currentRoom = useGameStore((s) => s.currentRoom)

  // Robot is only fully visible in the current room
  const inCurrentRoom = robot.room === currentRoom

  return (
    <div className={`absolute bottom-4 left-4 z-20 flex items-end gap-2
                     ${inCurrentRoom ? 'opacity-100' : 'opacity-30'}`}>
      {/* Robot sprite */}
      <motion.div
        className="flex flex-col items-center"
        animate={robot.speaking ? { y: [0, -3, 0] } : {}}
        transition={{ repeat: Infinity, duration: 1.5 }}
      >
        <div className="text-4xl">🤖</div>
        <span className="text-[9px] text-slate-400 mt-0.5">Pepper</span>
      </motion.div>

      {/* Speech bubble */}
      <AnimatePresence>
        {robot.speaking && robot.text && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.95 }}
            className="speech-bubble bg-white text-slate-800 text-xs rounded-xl
                       px-3 py-2 max-w-[200px] shadow-lg relative"
          >
            {robot.text}
            {/* Bubble tail */}
            <div className="absolute bottom-0 left-3 w-3 h-3 bg-white
                            transform rotate-45 translate-y-1" />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
