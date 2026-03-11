import { motion, AnimatePresence } from 'framer-motion'
import { useGameStore } from '../../store/gameStore'
import { Bot } from 'lucide-react'

export default function RobotAvatar() {
  const robotSpeaking = useGameStore((s) => s.robotSpeaking)
  const robotText = useGameStore((s) => s.robotText)

  return (
    <div className="absolute bottom-20 right-6 z-30 flex flex-col items-end pointer-events-none">
      {/* Speech bubble */}
      <AnimatePresence>
        {robotSpeaking && robotText && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            className="bg-white rounded-2xl px-4 py-3 shadow-lg border border-slate-200 max-w-[280px] mb-3 pointer-events-auto"
          >
            <p className="text-sm text-slate-700 leading-relaxed">{robotText}</p>
            <div className="absolute -bottom-2 right-6 w-4 h-4 bg-white border-r border-b border-slate-200 transform rotate-45" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Robot avatar */}
      <motion.div
        animate={robotSpeaking ? { scale: [1, 1.05, 1] } : { y: [0, -2, 0] }}
        transition={robotSpeaking
          ? { duration: 0.4, repeat: Infinity }
          : { duration: 3, repeat: Infinity, ease: 'easeInOut' }
        }
        className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl shadow-lg flex items-center justify-center pointer-events-auto cursor-default"
      >
        <Bot size={32} className="text-white" />
      </motion.div>
    </div>
  )
}
