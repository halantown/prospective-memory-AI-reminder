import { motion, AnimatePresence } from 'framer-motion'
import { useGameStore } from '../../store/gameStore'

export default function RobotStatus() {
  const robotStatus = useGameStore(s => s.robotStatus)
  const robotText = useGameStore(s => s.robotText)

  return (
    <div className="bg-slate-50 rounded-lg p-2">
      <div className="flex items-center gap-2">
        <span className="text-2xl" role="img" aria-label="robot">🤖</span>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-medium text-slate-500">Pepper</div>
          <div className={`text-[11px] ${robotStatus === 'speaking' ? 'text-blue-600' : 'text-slate-400'}`}>
            {robotStatus === 'speaking' ? 'Speaking…' : 'Idle'}
          </div>
        </div>
        {robotStatus === 'speaking' && (
          <div className="flex gap-0.5 items-end h-4">
            {[0, 1, 2].map(i => (
              <motion.div
                key={i}
                className="w-1 bg-blue-400 rounded-full"
                animate={{ height: [4, 12, 4] }}
                transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Speech bubble — identical style for neutral + reminder (participant cannot tell apart) */}
      <AnimatePresence>
        {robotText && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="mt-2 bg-white border border-slate-200 rounded-lg p-2 text-xs text-slate-700 leading-relaxed shadow-sm"
          >
            {robotText}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
