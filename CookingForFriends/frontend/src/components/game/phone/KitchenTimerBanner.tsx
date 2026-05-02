/** Kitchen timer banner — persistent primary cue for active cooking steps. */

import { motion, AnimatePresence } from 'framer-motion'
import { useGameStore } from '../../../stores/gameStore'

export default function KitchenTimerBanner() {
  const queue = useGameStore((s) => s.kitchenTimerQueue)
  const visible = queue.slice(-2)

  return (
    <AnimatePresence initial={false}>
      {visible.length > 0 && (
        <motion.div
          key="kitchen-timer-banner"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.18 }}
          className="relative z-40 px-4 pb-2 flex flex-col gap-1.5"
        >
          {visible.map((timer) => {
            const warning = timer.status === 'warning'
            return (
              <motion.div
                key={timer.id}
                layout
                className={`flex items-center gap-2 rounded-full px-3 py-2 shadow-lg border ${
                  warning
                    ? 'bg-red-600/95 border-red-300/50 text-white shadow-red-950/40'
                    : 'bg-orange-500/95 border-orange-200/50 text-white shadow-orange-950/30'
                }`}
              >
                <span className="text-base">{timer.icon || '🍳'}</span>
                <span className="text-[13px] font-semibold leading-tight truncate">
                  {timer.message}
                </span>
              </motion.div>
            )
          })}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
