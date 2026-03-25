import { motion, AnimatePresence } from 'framer-motion'
import { useGameStore } from '../../store/gameStore'

export default function RobotSpeechToast() {
  const robotText = useGameStore(s => s.robotText)
  const robotStatus = useGameStore(s => s.robotStatus)

  return (
    <AnimatePresence>
      {robotText && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          transition={{ duration: 0.3 }}
          className="absolute bottom-4 left-4 right-4 z-20 pointer-events-none"
        >
          <div className="max-w-xl mx-auto bg-white/95 backdrop-blur-sm border border-slate-200 rounded-xl shadow-lg px-4 py-3 flex items-start gap-3">
            <motion.span
              className="text-2xl leading-none shrink-0 mt-0.5"
              animate={robotStatus === 'speaking' ? { scale: [1, 1.1, 1] } : {}}
              transition={robotStatus === 'speaking' ? { duration: 0.5, repeat: Infinity } : {}}
            >
              🤖
            </motion.span>
            <p className="text-sm text-slate-700 leading-relaxed">{robotText}</p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
