import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useGameStore } from '../../store/gameStore'

export default function TransitionOverlay() {
  const gameActive = useGameStore(s => s.gameActive)
  const currentRoom = useGameStore(s => s.currentRoom)
  const activityLabel = useGameStore(s => s.activityLabel)
  const simulatedTime = useGameStore(s => s.simulatedTime)

  const [visible, setVisible] = useState(false)
  const prevRoom = useRef(currentRoom)
  const hasStarted = useRef(false)

  useEffect(() => {
    // Track that we've seen at least one game start
    if (gameActive) hasStarted.current = true
  }, [gameActive])

  useEffect(() => {
    // Only show transition when room actually changes (not initial state)
    if (currentRoom !== prevRoom.current && hasStarted.current) {
      prevRoom.current = currentRoom
      setVisible(true)
      const timer = setTimeout(() => setVisible(false), 3000)
      return () => clearTimeout(timer)
    }
    prevRoom.current = currentRoom
  }, [currentRoom])

  return (
    <AnimatePresence>
      {visible && !gameActive && (
        <motion.div
          className="absolute inset-0 z-50 flex items-center justify-center bg-black/25 pointer-events-none"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          <motion.div
            className="bg-white/95 backdrop-blur-md rounded-2xl shadow-xl px-10 py-6 text-center max-w-md"
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            transition={{ duration: 0.4, delay: 0.1 }}
          >
            <div className="text-2xl mb-2">🚶</div>
            <div className="text-lg font-bold text-stone-700 mb-1">
              {simulatedTime}
            </div>
            <div className="text-sm text-stone-500">
              {activityLabel || `Moving to next activity…`}
            </div>

            {/* Animated walking dots */}
            <div className="flex justify-center gap-1.5 mt-4">
              {[0, 1, 2].map(i => (
                <motion.div
                  key={i}
                  className="w-2 h-2 bg-blue-400 rounded-full"
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{ duration: 1, repeat: Infinity, delay: i * 0.25 }}
                />
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
