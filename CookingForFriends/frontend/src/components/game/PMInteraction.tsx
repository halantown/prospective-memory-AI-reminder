/** PM Interaction — trigger notification + room navigation + target selection. */

import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useGameStore } from '../../stores/gameStore'

export default function PMInteraction() {
  const pmTriggered = useGameStore((s) => s.pmTriggered)
  const pmTriggerEvent = useGameStore((s) => s.pmTriggerEvent)
  const executionWindowActive = useGameStore((s) => s.executionWindowActive)
  const currentRoom = useGameStore((s) => s.currentRoom)
  const clearPMTrigger = useGameStore((s) => s.clearPMTrigger)
  const wsSend = useGameStore((s) => s.wsSend)

  const [showTargetSelection, setShowTargetSelection] = useState(false)
  const [selectedTarget, setSelectedTarget] = useState<string | null>(null)

  const handleTriggerResponse = useCallback(() => {
    if (!pmTriggered) return
    setShowTargetSelection(true)
  }, [pmTriggered])

  const handleTargetSelect = useCallback((target: string) => {
    setSelectedTarget(target)

    // Send PM attempt to backend
    if (wsSend) {
      wsSend({
        type: 'pm_attempt',
        data: {
          action: 'select_target',
          target_selected: target,
          room: currentRoom,
          timestamp: Date.now() / 1000,
        },
      })
    }

    // Close after brief feedback
    setTimeout(() => {
      setShowTargetSelection(false)
      setSelectedTarget(null)
      clearPMTrigger()
    }, 1500)
  }, [wsSend, currentRoom, clearPMTrigger])

  return (
    <>
      {/* PM Trigger notification banner */}
      <AnimatePresence>
        {pmTriggered && executionWindowActive && !showTargetSelection && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute top-16 left-1/2 -translate-x-1/2 z-40"
          >
            <div className="bg-amber-500/90 backdrop-blur text-white rounded-xl
                            px-6 py-3 shadow-xl flex items-center gap-3 trigger-active">
              <span className="text-xl">⚡</span>
              <div>
                <p className="font-bold text-sm">{_triggerLabel(pmTriggerEvent)}</p>
                <p className="text-xs text-amber-100 mt-0.5">
                  Do you need to do something?
                </p>
              </div>
              <button
                onClick={handleTriggerResponse}
                className="ml-4 bg-white text-amber-600 font-bold text-xs
                           px-4 py-2 rounded-lg hover:bg-amber-50 transition-colors"
              >
                Act Now
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Target selection overlay */}
      <AnimatePresence>
        {showTargetSelection && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 bg-black/60 backdrop-blur-sm
                       flex items-center justify-center"
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              className="bg-white rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl"
            >
              <h3 className="text-lg font-bold text-slate-800 mb-1">
                Select the correct item
              </h3>
              <p className="text-sm text-slate-500 mb-4">
                Choose the item you need for this task:
              </p>

              {/* Placeholder target options — in real implementation
                  these come from the PM trial's task_config */}
              <div className="grid grid-cols-2 gap-3">
                {['Item A', 'Item B'].map((item) => (
                  <button
                    key={item}
                    onClick={() => handleTargetSelect(item)}
                    disabled={selectedTarget !== null}
                    className={`p-4 rounded-xl border-2 transition-all text-center
                      ${selectedTarget === item
                        ? 'border-green-500 bg-green-50'
                        : selectedTarget
                        ? 'border-slate-200 bg-slate-50 opacity-50'
                        : 'border-slate-200 hover:border-cooking-400 hover:bg-cooking-50 cursor-pointer'
                      }`}
                  >
                    <div className="text-3xl mb-1">📦</div>
                    <span className="text-sm font-medium text-slate-700">{item}</span>
                  </button>
                ))}
              </div>

              {selectedTarget && (
                <p className="text-center text-sm text-green-600 mt-3 font-medium">
                  ✓ Selected! Continuing...
                </p>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

function _triggerLabel(event: string | null): string {
  const labels: Record<string, string> = {
    doorbell: '🔔 The doorbell is ringing!',
    email_dentist: '📧 New email from Dentist Office',
    washing_done: '🫧 Washing machine finished!',
    clock_6pm: '🕕 It\'s 6:00 PM!',
  }
  return labels[event || ''] || '⚡ Something just happened!'
}
