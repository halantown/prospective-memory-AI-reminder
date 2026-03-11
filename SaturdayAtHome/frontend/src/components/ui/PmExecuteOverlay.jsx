import { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useGameStore } from '../../store/gameStore'

export default function PmExecuteOverlay() {
  const pmOverlayOpen = useGameStore((s) => s.pmOverlayOpen)
  const pmTaskId = useGameStore((s) => s.pmTaskId)
  const pmCountdown = useGameStore((s) => s.pmCountdown)
  const closePmOverlay = useGameStore((s) => s.closePmOverlay)
  const hideReportTask = useGameStore((s) => s.hideReportTask)

  const handleConfirm = () => {
    // TODO: POST action to backend with selected options
    hideReportTask()
  }

  const handleNotSure = () => {
    hideReportTask()
  }

  return (
    <AnimatePresence>
      {pmOverlayOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center"
        >
          <motion.div
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 20 }}
            className="bg-white rounded-2xl p-6 w-[480px] shadow-2xl"
          >
            <h2 className="text-lg font-bold text-slate-800 mb-4">
              Task Execution
            </h2>

            {/* Task-specific content placeholder */}
            <div className="bg-slate-50 rounded-xl p-6 mb-4 min-h-[200px] flex items-center justify-center">
              <p className="text-slate-400 text-center">
                Task: {pmTaskId || 'Unknown'}<br />
                <span className="text-sm">Execution UI will be loaded here</span>
              </p>
            </div>

            {/* Countdown bar */}
            <div className="w-full h-3 bg-slate-200 rounded-full overflow-hidden mb-4">
              <motion.div
                className="h-full bg-orange-500 rounded-full"
                initial={{ width: '100%' }}
                animate={{ width: `${(pmCountdown / 30) * 100}%` }}
                transition={{ duration: 1, ease: 'linear' }}
              />
            </div>
            <p className="text-xs text-slate-500 text-center mb-4">{pmCountdown}s remaining</p>

            {/* Action buttons */}
            <div className="flex gap-3">
              <button
                onClick={handleConfirm}
                className="flex-1 py-3 bg-green-500 hover:bg-green-600 text-white font-bold rounded-xl transition-colors"
              >
                Confirm
              </button>
              <button
                onClick={handleNotSure}
                className="flex-1 py-3 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-xl transition-colors"
              >
                Not sure
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
