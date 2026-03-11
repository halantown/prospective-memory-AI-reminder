import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { MEDICINE_TASKS } from '../../config/taskConfigs'

/**
 * Medicine task UI — two-step selection:
 * Step 1: Choose bottle (round vs square)
 * Step 2: Choose amount/dosage
 * Both steps must be completed to enable confirm button.
 */
export default function MedicineTask({ taskId, onSelectionChange }) {
  const [selectedBottle, setSelectedBottle] = useState(null)
  const [selectedAmount, setSelectedAmount] = useState(null)

  const config = MEDICINE_TASKS[taskId]
  if (!config) {
    return <p className="text-slate-400 text-sm text-center">Unknown medicine task: {taskId}</p>
  }

  const handleBottleSelect = (bottleId) => {
    setSelectedBottle(bottleId)
    // Reset amount when bottle changes
    setSelectedAmount(null)
    onSelectionChange({ bottle: bottleId, amount: null, complete: false })
  }

  const handleAmountSelect = (amount) => {
    setSelectedAmount(amount)
    onSelectionChange({ bottle: selectedBottle, amount, complete: true })
  }

  return (
    <div className="space-y-5">
      {/* Step 1: Bottle selection */}
      <div>
        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
          Step 1 — Choose the bottle
        </p>
        <div className="flex gap-4 justify-center">
          {config.bottles.map((bottle) => {
            const isSelected = selectedBottle === bottle.id
            return (
              <button
                key={bottle.id}
                onClick={() => handleBottleSelect(bottle.id)}
                className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all w-36 ${
                  isSelected
                    ? 'border-indigo-500 bg-indigo-50 shadow-md scale-105'
                    : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm'
                }`}
              >
                {/* CSS bottle shape */}
                <div
                  className="w-16 h-20 flex items-center justify-center shadow-inner"
                  style={{
                    backgroundColor: bottle.color,
                    borderRadius: bottle.shape === 'round' ? '50%' : '8px',
                  }}
                >
                  <span className="text-white text-2xl font-bold opacity-80">💊</span>
                </div>
                <span className={`text-xs font-medium text-center ${isSelected ? 'text-indigo-700' : 'text-slate-600'}`}>
                  {bottle.label}
                </span>
                {isSelected && (
                  <span className="text-[10px] font-bold text-indigo-500">✓ Selected</span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Step 2: Amount selection (slide in after bottle selected) */}
      <AnimatePresence>
        {selectedBottle && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
          >
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
              Step 2 — Choose the amount
            </p>
            <div className="flex gap-3 justify-center">
              {config.amounts.map((amount) => {
                const isSelected = selectedAmount === amount
                return (
                  <button
                    key={amount}
                    onClick={() => handleAmountSelect(amount)}
                    className={`px-5 py-3 rounded-lg border-2 font-bold text-sm transition-all ${
                      isSelected
                        ? 'border-indigo-500 bg-indigo-500 text-white shadow-md scale-105'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
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

      {/* Visual feedback when both selected */}
      {selectedBottle && selectedAmount && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center text-xs text-green-600 font-medium mt-2"
        >
          ✓ Selection complete — press Confirm below
        </motion.div>
      )}
    </div>
  )
}
