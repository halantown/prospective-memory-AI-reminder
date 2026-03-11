import { motion, AnimatePresence } from 'framer-motion'
import { useGameStore } from '../../store/gameStore'
import { AlertTriangle } from 'lucide-react'

export default function ReportTaskButton() {
  const reportTaskVisible = useGameStore((s) => s.reportTaskVisible)
  const openPmOverlay = useGameStore((s) => s.openPmOverlay)

  return (
    <AnimatePresence>
      {reportTaskVisible && (
        <motion.button
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={openPmOverlay}
          className="absolute top-4 right-6 z-40 bg-orange-500 hover:bg-orange-600 text-white font-bold px-6 py-3 rounded-2xl shadow-lg flex items-center gap-2"
        >
          <motion.div
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          >
            <AlertTriangle size={20} />
          </motion.div>
          Report Task
        </motion.button>
      )}
    </AnimatePresence>
  )
}
