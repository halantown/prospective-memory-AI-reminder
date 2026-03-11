import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useGameStore } from '../../store/gameStore'
import { Clock, Check, HelpCircle } from 'lucide-react'

const TASK_PROMPTS = {
  medicine_a: { text: 'You had a medicine to take after dinner. Which one and how?', icon: '💊' },
  medicine_b: { text: 'You had a vitamin to take after dinner. Which one and how?', icon: '🍊' },
  laundry_c:  { text: 'The washing machine finished. Where does each item go?', icon: '👕' },
  laundry_d:  { text: 'It\'s getting dark. What should you bring inside?', icon: '🌅' },
  comm_e:     { text: 'Someone came online. Who should you message and about what?', icon: '📱' },
  comm_f:     { text: 'The doorbell rang. What should you tell the visitor?', icon: '🚪' },
  chores_g:   { text: 'The slow cooker timer ended. What should you do?', icon: '🍲' },
  chores_h:   { text: 'The rubbish truck arrived. Which bag should you take out?', icon: '🗑️' },
}

export default function PmExecuteOverlay() {
  const pmExecution = useGameStore((s) => s.pmExecution)
  const submitPmAction = useGameStore((s) => s.submitPmAction)
  const closePmOverlay = useGameStore((s) => s.closePmOverlay)
  const sessionId = useGameStore((s) => s.sessionId)
  const blockNumber = useGameStore((s) => s.blockNumber)

  const [countdownStarted, setCountdownStarted] = useState(false)
  const [remainingMs, setRemainingMs] = useState(30000)
  const [submitting, setSubmitting] = useState(false)
  const intervalRef = useRef(null)

  const { active, taskId, windowOpenAt, timeLimit } = pmExecution
  const prompt = TASK_PROMPTS[taskId] || { text: 'Complete the task.', icon: '📋' }

  // Start countdown animation when overlay opens
  useEffect(() => {
    if (active && windowOpenAt) {
      setCountdownStarted(false)
      setRemainingMs(timeLimit)
      // Trigger CSS transition on next frame
      requestAnimationFrame(() => setCountdownStarted(true))
      // Update remaining text every 500ms
      intervalRef.current = setInterval(() => {
        const elapsed = Date.now() - windowOpenAt
        const remaining = Math.max(0, timeLimit - elapsed)
        setRemainingMs(remaining)
      }, 500)
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [active, windowOpenAt, timeLimit])

  const postAction = useCallback(async (actionData) => {
    if (!sessionId || !blockNumber || !taskId) return
    setSubmitting(true)
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 3000)
      await fetch(`/api/session/${sessionId}/block/${blockNumber}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task_id: taskId, ...actionData }),
        signal: controller.signal,
      })
      clearTimeout(timeout)
    } catch (err) {
      console.error('[PM] POST action failed (network timeout or error)', err)
    } finally {
      setSubmitting(false)
    }
  }, [sessionId, blockNumber, taskId])

  const handleConfirm = async () => {
    // TODO T14: collect actual selection from task-specific UI
    await postAction({ action: 'confirm' })
    submitPmAction()
  }

  const handleNotSure = async () => {
    await postAction({ action: 'not_sure' })
    closePmOverlay()
  }

  const remainingSec = Math.ceil(remainingMs / 1000)

  return (
    <AnimatePresence>
      {active && (
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
            className="bg-white rounded-2xl shadow-2xl w-[520px] overflow-hidden"
          >
            {/* Header with task prompt */}
            <div className="bg-slate-50 border-b border-slate-200 px-6 py-4">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{prompt.icon}</span>
                <div>
                  <h2 className="text-lg font-bold text-slate-800">Task Execution</h2>
                  <p className="text-slate-600 text-sm">{prompt.text}</p>
                </div>
              </div>
            </div>

            {/* Task interaction area (placeholder for T14) */}
            <div className="px-6 py-6">
              <div className="bg-slate-50 rounded-xl p-8 min-h-[200px] flex items-center justify-center border-2 border-dashed border-slate-200">
                <p className="text-slate-400 text-center text-sm">
                  Task-specific UI will be loaded here<br />
                  <span className="text-xs text-slate-300">(Task: {taskId})</span>
                </p>
              </div>
            </div>

            {/* Bottom: countdown bar + buttons */}
            <div className="px-6 pb-6 space-y-4">
              {/* Countdown progress bar (CSS transition) */}
              <div className="space-y-1">
                <div className="w-full h-2.5 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: countdownStarted ? '0%' : '100%',
                      transitionProperty: 'width, background-color',
                      transitionDuration: `${timeLimit}ms`,
                      transitionTimingFunction: 'linear',
                      backgroundColor: remainingSec > 10 ? '#f97316' : '#ef4444',
                    }}
                  />
                </div>
                <div className="flex items-center justify-center gap-1 text-xs text-slate-500">
                  <Clock size={12} />
                  <span>{remainingSec}s remaining</span>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex gap-3">
                <button
                  onClick={handleConfirm}
                  disabled={submitting}
                  className="flex-1 py-3 bg-green-500 hover:bg-green-600 disabled:bg-green-300 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2"
                >
                  <Check size={18} />
                  Confirm
                </button>
                <button
                  onClick={handleNotSure}
                  disabled={submitting}
                  className="flex-1 py-3 bg-slate-200 hover:bg-slate-300 disabled:bg-slate-100 text-slate-700 font-bold rounded-xl transition-colors flex items-center justify-center gap-2"
                >
                  <HelpCircle size={18} />
                  Not sure
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
