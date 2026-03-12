import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useGameStore } from '../../store/gameStore'
import { MEDICINE_TASKS, getMedicineConfig } from '../../config/taskConfigs'

/**
 * CSS-drawn medicine cabinet icon.
 * White box with a cross, hinged door look.
 */
function CabinetIcon({ size = 40, active = false }) {
  const s = size
  const cross = Math.round(s * 0.28)
  const crossW = Math.max(2, Math.round(s * 0.08))
  return (
    <div
      className="relative flex items-center justify-center"
      style={{ width: s, height: s }}
    >
      {/* Outer box */}
      <div
        className={`absolute inset-0 rounded-md border-2 transition-colors duration-300 ${
          active ? 'border-emerald-500 bg-white' : 'border-slate-300 bg-slate-50'
        }`}
        style={{ boxShadow: active ? '0 0 8px rgba(16,185,129,0.3)' : 'inset 0 1px 3px rgba(0,0,0,0.08)' }}
      />
      {/* Door line (hinged left) */}
      <div
        className={`absolute top-[15%] bottom-[15%] left-[12%] border-l transition-colors ${
          active ? 'border-emerald-400' : 'border-slate-300'
        }`}
      />
      {/* Cross (horizontal) */}
      <div
        className={`absolute transition-colors ${active ? 'bg-emerald-500' : 'bg-red-400'}`}
        style={{
          width: cross,
          height: crossW,
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          borderRadius: 1,
        }}
      />
      {/* Cross (vertical) */}
      <div
        className={`absolute transition-colors ${active ? 'bg-emerald-500' : 'bg-red-400'}`}
        style={{
          width: crossW,
          height: cross,
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          borderRadius: 1,
        }}
      />
      {/* Door knob */}
      <div
        className={`absolute rounded-full transition-colors ${active ? 'bg-emerald-400' : 'bg-slate-400'}`}
        style={{
          width: Math.max(2, Math.round(s * 0.08)),
          height: Math.max(2, Math.round(s * 0.08)),
          right: '14%',
          top: '50%',
          transform: 'translateY(-50%)',
        }}
      />
    </div>
  )
}

/**
 * Medicine cabinet — sits on the kitchen table, always visible.
 *
 * Clickable anytime:
 * - No PM trigger: opens to show contents (informational, greyed out)
 * - PM trigger active: highlighted, opens the two-step selection flow
 *
 * GDD A1: No countdown visible, no score feedback.
 */
export default function MedicineCabinet({ isExpanded = true }) {
  const interactableTasks = useGameStore((s) => s.interactableTasks)
  const openCabinetTask = useGameStore((s) => s.openCabinetTask)
  const remoteConfig = useGameStore((s) => s.remoteConfig)
  const openCabinet = useGameStore((s) => s.openCabinet)
  const closeCabinet = useGameStore((s) => s.closeCabinet)
  const submitCabinetAction = useGameStore((s) => s.submitCabinetAction)
  const sessionId = useGameStore((s) => s.sessionId)
  const blockNumber = useGameStore((s) => s.blockNumber)

  const [selectedBottle, setSelectedBottle] = useState(null)
  const [selectedAmount, setSelectedAmount] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [browseOpen, setBrowseOpen] = useState(false)

  const activeMedicineTask = interactableTasks.find(t => t.startsWith('medicine_'))
  const isActive = !!activeMedicineTask
  const isOpen = !!openCabinetTask
  const medicineConfigs = getMedicineConfig(remoteConfig)

  // Get config for the open task, or first medicine task for browse mode
  const config = openCabinetTask
    ? medicineConfigs[openCabinetTask]
    : medicineConfigs.medicine_a

  const handleCabinetClick = () => {
    if (isActive && !isOpen) {
      setSelectedBottle(null)
      setSelectedAmount(null)
      openCabinet(activeMedicineTask)
      setBrowseOpen(false)
    } else if (!isActive && !browseOpen) {
      setBrowseOpen(true)
    }
  }

  const handleClose = () => {
    if (isOpen) closeCabinet()
    setBrowseOpen(false)
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

  const isComplete = selectedBottle && selectedAmount
  const showPanel = isOpen || browseOpen

  return (
    <div className="relative">
      {/* Cabinet icon — always visible on kitchen table */}
      <div className="flex flex-col items-center gap-1">
        <motion.button
          onClick={handleCabinetClick}
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.95 }}
          className="relative"
        >
          <CabinetIcon size={isExpanded ? 48 : 28} active={isActive} />
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

      {/* Floating panel — opens either for PM task selection or browse mode */}
      <AnimatePresence>
        {showPanel && config && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.25 }}
            className="absolute bottom-full right-0 mb-2 z-30 bg-white rounded-2xl shadow-xl border border-slate-200 p-5 w-80"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <CabinetIcon size={20} active={isActive} />
                <span className="text-sm font-bold text-slate-700">Medicine Cabinet</span>
              </div>
              <button
                onClick={handleClose}
                className="text-slate-400 hover:text-slate-600 text-lg leading-none"
              >
                ×
              </button>
            </div>

            {isActive && isOpen ? (
              /* ── PM Task Mode: two-step selection ── */
              <>
                <p className="text-xs text-emerald-700 font-medium mb-3 bg-emerald-50 rounded-lg px-3 py-2">
                  {config.prompt}
                </p>

                {/* Step 1: Bottles */}
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                  Step 1 — Choose bottle
                </p>
                <div className="flex gap-2 mb-3">
                  {config.bottles.map((bottle) => {
                    const isSel = selectedBottle === bottle.id
                    return (
                      <button
                        key={bottle.id}
                        onClick={() => { setSelectedBottle(bottle.id); setSelectedAmount(null) }}
                        className={`flex flex-col items-center gap-1 p-2.5 rounded-xl border-2 transition-all flex-1 ${
                          isSel
                            ? 'border-emerald-500 bg-emerald-50 shadow-md'
                            : 'border-slate-200 bg-white hover:border-slate-300'
                        }`}
                      >
                        <div
                          className="w-10 h-14 flex items-center justify-center shadow-inner"
                          style={{
                            backgroundColor: bottle.color,
                            borderRadius: bottle.shape === 'round' ? '50%' : '6px',
                          }}
                        >
                          <span className="text-white text-sm font-bold opacity-80">💊</span>
                        </div>
                        <span className={`text-[10px] font-medium ${isSel ? 'text-emerald-700' : 'text-slate-500'}`}>
                          {bottle.label}
                        </span>
                      </button>
                    )
                  })}
                </div>

                {/* Step 2: Amount */}
                <AnimatePresence>
                  {selectedBottle && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="mb-3"
                    >
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                        Step 2 — Choose amount
                      </p>
                      <div className="flex gap-2">
                        {config.amounts.map((amount) => {
                          const isSel = selectedAmount === amount
                          return (
                            <button
                              key={amount}
                              onClick={() => setSelectedAmount(amount)}
                              className={`flex-1 px-3 py-2 rounded-lg border-2 font-bold text-xs transition-all ${
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

                {/* Done / Close */}
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={handleDone}
                    disabled={!isComplete || submitting}
                    className={`flex-1 py-2 rounded-xl font-bold text-sm transition-all ${
                      isComplete
                        ? 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg'
                        : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                    }`}
                  >
                    {submitting ? 'Submitting…' : 'Done'}
                  </button>
                </div>
              </>
            ) : (
              /* ── Browse Mode: show contents informational ── */
              <div className="opacity-60">
                <p className="text-xs text-slate-500 mb-3 italic">
                  Your medicines are stored here.
                </p>
                <div className="flex gap-2">
                  {Object.values(medicineConfigs).map((task, i) => (
                    <div key={i} className="flex flex-col items-center gap-1 flex-1 p-2 rounded-lg bg-slate-50">
                      <div className="flex gap-1">
                        {task.bottles?.map((b) => (
                          <div
                            key={b.id}
                            className="w-6 h-9 shadow-inner"
                            style={{
                              backgroundColor: b.color,
                              borderRadius: b.shape === 'round' ? '50%' : '4px',
                              opacity: 0.5,
                            }}
                          />
                        ))}
                      </div>
                      <span className="text-[9px] text-slate-400">{task.prompt}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
