import { motion } from 'framer-motion'
import { useGameStore } from '../../store/gameStore'

export default function TransitionScreen() {
  const activityLabel = useGameStore(s => s.activityLabel)
  const simulatedTime = useGameStore(s => s.simulatedTime)
  const currentRoom = useGameStore(s => s.currentRoom)

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-black/30 backdrop-blur-[3px] rounded-2xl px-10 py-7 text-center shadow-2xl max-w-md"
    >
      <div className="text-3xl mb-3">🚶</div>
      <div className="text-white text-lg font-semibold drop-shadow-md">
        {simulatedTime && <span className="text-white/90">{simulatedTime} — </span>}
        {activityLabel || `Moving to ${currentRoom}…`}
      </div>
      <div className="text-white/60 text-sm mt-2">Next activity starting soon</div>

      <div className="flex justify-center gap-2 pt-4">
        {[0, 1, 2].map(i => (
          <motion.div
            key={i}
            className="w-2 h-2 bg-white/70 rounded-full"
            animate={{ opacity: [0.3, 1, 0.3] }}
            transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.3 }}
          />
        ))}
      </div>
    </motion.div>
  )
}
