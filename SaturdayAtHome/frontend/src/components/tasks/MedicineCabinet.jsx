import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useGameStore } from '../../store/gameStore'
import { MEDICINE_TASKS } from '../../config/taskConfigs'
import { Pill } from 'lucide-react'

/**
 * Medicine cabinet — a natural game element in the kitchen.
 *
 * GDD A1: inactive=grey icon (not clickable), active=highlighted (clickable).
 * When clicked, opens an inline panel (not an overlay) showing bottles → dose → Done.
 * No countdown visible, no score feedback. Participant feels like "I took my medicine".
 */
export default function MedicineCabinet({ isExpanded = true }) {
  const interactableTasks = useGameStore((s) => s.interactableTasks)
  const openCabinetTask = useGameStore((s) => s.openCabinetTask)
  const openCabinet = useGameStore((s) => s.openCabinet)
  const closeCabinet = useGameStore((s) => s.closeCabinet)
  const submitCabinetAction = useGameStore((s) => s.submitCabinetAction)
  const sessionId = useGameStore((s) => s.sessionId)
  const blockNumber = useGameStore((s) => s.blockNumber)

  const [selectedBottle, setSelectedBottle] = useState(null)
  const [selectedAmount, setSelectedAmount] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  // Which medicine tasks are currently interactable?
  const activeMedicineTask = interactableTasks.find(t => t.startsWith('medicine_'))
  const isActive = !!activeMedicineTask
  const isOpen = !!openCabinetTask

  const config = openCabinetTask ? MEDICINE_TASKS[openCabinetTask] : null

  const handleCabinetClick = () => {
    if (!isActive || isOpen || !isExpanded) return
    setSelectedBottle(null)
    setSelectedAmount(null)
    openCabinet(activeMedicineTask)
  }

  const handleBottleSelect = (bottleId) => {
    setSelectedBottle(bottleId)
    setSelectedAmount(null)
  }

  const handleAmountSelect = (amount) => {
    setSelectedAmount(amount)
  }

  const handleDone = useCallback(async () => {
    if (!selectedBottle || !selectedAmount || !openCabinetTask) return
    setSubmitting(true)
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 3000)
      await fetch(`/api/session/${sessionId}/block/${blockNumber}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          task_id: openCabinetTask,
          action: 'confirm',
          choice: { bottle: selectedBottle, amount: selectedAmount },
          client_ts: Date.now(),
        }),
        signal: controller.signal,
      })
      clearTimeout(timeout)
    } catch (err) {
      console.error('[Cabinet] POST action failed:', err)
    } finally {
      setSubmitting(false)
      submitCabinetAction()
    }
  }, [selectedBottle, selectedAmount, openCabinetTask, sessionId, blockNumber, submitCabinetAction])

  const handleClose = () => {
    closeCabinet()
  }

  const isComplete = selectedBottle && selectedAmount

  return (
    <>
      {/* Cabinet icon — always visible in kitchen */}
      <div className="flex flex-col items-center gap-1">
        <motion.button
          onClick={handleCabinetClick}
          disabled={!isActive || !isExpanded}
          whileHover={isActive && isExpanded ? { scale: 1.08 } : {}}
          whileTap={isActive && isExpanded ? { scale: 0.95 } : {}}
          className={`relative rounded-xl flex items-center justify-center transition-all duration-300 ${
            isExpanded ? 'w-14 h-14' : 'w-9 h-9'
          } ${
            isActive
              ? 'bg-emerald-100 border-2 border-emerald-400 shadow-lg cursor-pointer'
              : 'bg-slate-100 border-2 border-slate-200 opacity-50 cursor-default'
          }`}
        >
          <Pill size={isExpanded ? 24 : 16} className={isActive ? 'text-emerald-600' : 'text-slate-400'} />
          {isActive && (
            <motion.div
              animate={{ scale: [1, 1.3, 1] }}
              transition={{ repeat: Infinity, duration: 2 }}
              className={`absolute bg-emerald-400 rounded-full ${isExpanded ? '-top-1 -right-1 w-3 h-3' : '-top-0.5 -right-0.5 w-2 h-2'}`}
            />
          )}
        </motion.button>
        {isExpanded && (
          <span className={`text-[10px] font-medium ${isActive ? 'text-emerald-700' : 'text-slate-400'}`}>
            Medicine
          </span>
        )}
      </div>

      {/* Inline cabinet panel — slides open when clicked */}
      <AnimatePresence>
        {isOpen && config && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.25 }}
            className="absolute inset-0 z-20 bg-white/95 backdrop-blur-sm rounded-2xl flex flex-col items-center justify-center p-6"
          >
            {/* Cabinet header */}
            <div className="flex items-center gap-2 mb-5">
              <Pill size={20} className="text-emerald-600" />
              <span className="text-sm font-bold text-slate-700">Medicine Cabinet</span>
            </div>

            {/* Step 1: Bottles */}
            <div className="mb-4 w-full max-w-sm">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 text-center">
                Choose bottle
              </p>
              <div className="flex gap-3 justify-center">
                {config.bottles.map((bottle) => {
                  const isSel = selectedBottle === bottle.id
                  return (
                    <button
                      key={bottle.id}
                      onClick={() => handleBottleSelect(bottle.id)}
                      className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all w-28 ${
                        isSel
                          ? 'border-emerald-500 bg-emerald-50 shadow-md'
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      <div
                        className="w-12 h-16 flex items-center justify-center shadow-inner"
                        style={{
                          backgroundColor: bottle.color,
                          borderRadius: bottle.shape === 'round' ? '50%' : '6px',
                        }}
                      >
                        <span className="text-white text-lg font-bold opacity-80">💊</span>
                      </div>
                      <span className={`text-[10px] font-medium ${isSel ? 'text-emerald-700' : 'text-slate-500'}`}>
                        {bottle.label}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Step 2: Amount (only after bottle selected) */}
            <AnimatePresence>
              {selectedBottle && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mb-4 w-full max-w-sm"
                >
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 text-center">
                    Choose amount
                  </p>
                  <div className="flex gap-2 justify-center">
                    {config.amounts.map((amount) => {
                      const isSel = selectedAmount === amount
                      return (
                        <button
                          key={amount}
                          onClick={() => handleAmountSelect(amount)}
                          className={`px-4 py-2 rounded-lg border-2 font-bold text-xs transition-all ${
                            isSel
                              ? 'border-emerald-500 bg-emerald-500 text-white shadow-md'
                              : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                          }`}
                        >
                          {amount}
                        </button>
                      )
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Action buttons */}
            <div className="flex gap-3 mt-2">
              <button
                onClick={handleDone}
                disabled={!isComplete || submitting}
                className={`px-6 py-2.5 rounded-xl font-bold text-sm transition-all ${
                  isComplete
                    ? 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                }`}
              >
                Done
              </button>
              <button
                onClick={handleClose}
                className="px-5 py-2.5 rounded-xl font-bold text-sm bg-slate-100 hover:bg-slate-200 text-slate-600"
              >
                Close
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
