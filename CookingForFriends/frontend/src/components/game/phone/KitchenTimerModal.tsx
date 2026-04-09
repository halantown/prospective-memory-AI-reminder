/** Kitchen timer modal — blocking overlay that must be manually dismissed.
 *  Queues multiple timers; shows one at a time.
 *  On dismiss: triggers recipe tab bounce + sends WS event with reactionTime. */

import { motion, AnimatePresence } from 'framer-motion'
import { useGameStore } from '../../../stores/gameStore'

export default function KitchenTimerModal() {
  const queue = useGameStore((s) => s.kitchenTimerQueue)
  const dismissTimer = useGameStore((s) => s.dismissKitchenTimer)
  const setRecipeTabBounce = useGameStore((s) => s.setRecipeTabBounce)
  const wsSend = useGameStore((s) => s.wsSend)

  const current = queue.length > 0 ? queue[0] : null

  const handleDismiss = () => {
    if (!current) return

    const reactionTime = (Date.now() - current.appearedAt) / 1000

    if (wsSend) {
      wsSend({
        type: 'kitchen_timer_acknowledged',
        data: {
          timerId: current.id,
          timestamp: Date.now() / 1000,
          reactionTime,
        },
      })
    }

    dismissTimer()

    // Trigger recipe tab bounce
    setRecipeTabBounce(true)
    setTimeout(() => setRecipeTabBounce(false), 2000)
  }

  return (
    <AnimatePresence>
      {current && (
        <motion.div
          key={current.id}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm rounded-[37px]"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className="w-[80%] bg-slate-800 border border-slate-600/60 rounded-3xl p-6
                       shadow-2xl shadow-black/50 flex flex-col items-center gap-4 text-center"
          >
            <span className="text-4xl">{current.icon || '🍳'}</span>

            <p className="text-sm text-slate-100 leading-relaxed font-medium px-2">
              {current.message}
            </p>

            <button
              onClick={handleDismiss}
              className="w-full py-3 text-sm font-bold text-white bg-blue-600 rounded-2xl
                         hover:bg-blue-500 active:scale-95 transition-all"
            >
              Got it ✓
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
