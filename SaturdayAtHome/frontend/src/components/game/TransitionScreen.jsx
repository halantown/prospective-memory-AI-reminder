import { motion } from 'framer-motion'
import { useGameStore } from '../../store/gameStore'

export default function TransitionScreen() {
  const activityLabel = useGameStore(s => s.activityLabel)
  const currentRoom = useGameStore(s => s.currentRoom)

  return (
    <div className="h-full flex flex-col items-center justify-center p-8 text-center">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="space-y-4"
      >
        <div className="text-4xl mb-2">🚶</div>
        <h2 className="text-xl font-semibold text-slate-700">
          {activityLabel || `Moving to ${currentRoom}…`}
        </h2>
        <p className="text-sm text-slate-400">Next activity starting soon</p>

        {/* Animated progress dots */}
        <div className="flex justify-center gap-2 pt-4">
          {[0, 1, 2].map(i => (
            <motion.div
              key={i}
              className="w-2.5 h-2.5 bg-blue-400 rounded-full"
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.3 }}
            />
          ))}
        </div>
      </motion.div>
    </div>
  )
}
