import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useGameStore } from '../../store/gameStore'

/**
 * Pressure cooker PM task — appears on Kitchen burner 4.
 *
 * Two-step execution:
 *  1. Release steam (click valve)  — partial credit if skipped
 *  2. Open lid (click lid)         — required for any credit
 *
 * Scoring: 2 = steam + lid, 1 = lid only (skipped steam), 0 = not executed
 */

const PRESSURE_COOKER_TASKS = ['chores_g']

function CookerIcon({ size = 56, active = false }) {
  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      {/* Pot body */}
      <div className={`absolute bottom-0 rounded-b-xl border-2 transition-colors ${
        active ? 'border-orange-500 bg-orange-100' : 'border-slate-300 bg-slate-100'
      }`} style={{ width: size * 0.8, height: size * 0.55, left: size * 0.1 }} />
      {/* Lid */}
      <div className={`absolute rounded-t-full border-2 border-b-0 transition-colors ${
        active ? 'border-orange-500 bg-orange-200' : 'border-slate-300 bg-slate-200'
      }`} style={{ width: size * 0.85, height: size * 0.3, top: size * 0.12, left: size * 0.075 }} />
      {/* Valve knob */}
      <div className={`absolute rounded-full transition-colors ${
        active ? 'bg-red-500' : 'bg-slate-400'
      }`} style={{ width: size * 0.15, height: size * 0.15, top: size * 0.02, left: '50%', transform: 'translateX(-50%)' }} />
      {/* Handles */}
      <div className={`absolute rounded-full border-2 transition-colors ${
        active ? 'border-orange-500' : 'border-slate-300'
      }`} style={{ width: size * 0.12, height: size * 0.08, top: size * 0.55, left: 0 }} />
      <div className={`absolute rounded-full border-2 transition-colors ${
        active ? 'border-orange-500' : 'border-slate-300'
      }`} style={{ width: size * 0.12, height: size * 0.08, top: size * 0.55, right: 0 }} />
      {/* Steam wisps when active */}
      {active && (
        <>
          <div className="absolute animate-bounce" style={{ top: -4, left: '35%', fontSize: size * 0.18 }}>💨</div>
          <div className="absolute animate-bounce" style={{ top: -6, left: '55%', fontSize: size * 0.15, animationDelay: '0.3s' }}>💨</div>
        </>
      )}
    </div>
  )
}

export default function PressureCooker({ isExpanded }) {
  const interactableTasks = useGameStore(s => s.interactableTasks)
  const sessionId = useGameStore(s => s.sessionId)
  const blockNumber = useGameStore(s => s.blockNumber)
  const submitCabinetAction = useGameStore(s => s.submitCabinetAction)

  const [panelOpen, setPanelOpen] = useState(false)
  const [steamReleased, setSteamReleased] = useState(false)
  const [lidOpened, setLidOpened] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const activeTask = interactableTasks.find(t => PRESSURE_COOKER_TASKS.includes(t))
  const isActive = !!activeTask

  const handleCookerClick = () => {
    if (isActive && !panelOpen) {
      setSteamReleased(false)
      setLidOpened(false)
      setPanelOpen(true)
    }
  }

  const handleReleaseSteam = () => {
    setSteamReleased(true)
  }

  const handleOpenLid = () => {
    setLidOpened(true)
  }

  const handleSubmit = useCallback(async () => {
    if (!activeTask || !lidOpened) return
    setSubmitting(true)
    try {
      const action = steamReleased ? 'release_steam_open_lid' : 'open_lid_only'
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 3000)
      await fetch(`/api/session/${sessionId}/block/${blockNumber}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          task_id: activeTask,
          action,
          choice: { steam_released: steamReleased, lid_opened: lidOpened },
          client_ts: Date.now(),
        }),
        signal: controller.signal,
      })
      clearTimeout(timeout)
    } catch (err) {
      console.error('[PressureCooker] POST action failed:', err)
    } finally {
      setSubmitting(false)
      setPanelOpen(false)
      submitCabinetAction()
    }
  }, [activeTask, steamReleased, lidOpened, sessionId, blockNumber, submitCabinetAction])

  const cookerSize = isExpanded ? 56 : 32

  return (
    <div className="flex flex-col items-center relative">
      {/* Burner ring */}
      <button
        onClick={handleCookerClick}
        disabled={!isActive}
        className={`rounded-full flex items-center justify-center transition-all relative ${
          isExpanded ? 'w-24 h-24' : 'w-14 h-14'
        } ${isActive
          ? 'border-[3px] border-orange-500 bg-orange-50 cursor-pointer shadow-lg shadow-orange-200'
          : 'border-2 border-dashed border-slate-300 bg-slate-50'
        }`}
      >
        {isActive ? (
          <CookerIcon size={cookerSize} active />
        ) : (
          <CookerIcon size={cookerSize} active={false} />
        )}
        {/* Pulsing indicator when active */}
        {isActive && (
          <span className="absolute -top-1 -right-1 flex h-4 w-4">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-4 w-4 bg-orange-500" />
          </span>
        )}
      </button>

      {isExpanded && (
        <span className={`text-xs mt-2 font-medium ${isActive ? 'text-orange-600' : 'text-slate-400'}`}>
          {isActive ? 'Pressure Cooker!' : 'Burner 4'}
        </span>
      )}

      {/* Expanded interaction panel */}
      <AnimatePresence>
        {panelOpen && isExpanded && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: -10 }}
            className="absolute top-full mt-3 left-1/2 -translate-x-1/2 z-50 w-64 bg-white rounded-2xl shadow-2xl border-2 border-orange-200 p-4"
          >
            <div className="text-sm font-bold text-orange-700 mb-3 text-center">
              🍲 Pressure Cooker
            </div>

            {/* Step 1: Release Steam */}
            <div className="mb-3">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                Step 1 — Release steam
              </p>
              <button
                onClick={handleReleaseSteam}
                disabled={steamReleased}
                className={`w-full py-2.5 rounded-xl font-bold text-sm transition-all ${
                  steamReleased
                    ? 'bg-green-100 text-green-700 border-2 border-green-400'
                    : 'bg-red-50 hover:bg-red-100 text-red-700 border-2 border-red-300 hover:border-red-400'
                }`}
              >
                {steamReleased ? '✓ Steam released' : '🔴 Turn valve to release steam'}
              </button>
            </div>

            {/* Step 2: Open Lid */}
            <div className="mb-3">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                Step 2 — Open lid
              </p>
              <button
                onClick={handleOpenLid}
                disabled={lidOpened}
                className={`w-full py-2.5 rounded-xl font-bold text-sm transition-all ${
                  lidOpened
                    ? 'bg-green-100 text-green-700 border-2 border-green-400'
                    : 'bg-orange-50 hover:bg-orange-100 text-orange-700 border-2 border-orange-300 hover:border-orange-400'
                }`}
              >
                {lidOpened ? '✓ Lid opened' : '🫕 Open the lid'}
              </button>
              {!steamReleased && lidOpened && (
                <p className="text-[10px] text-amber-600 mt-1 italic">
                  ⚠ You opened the lid without releasing steam first
                </p>
              )}
            </div>

            {/* Submit */}
            <div className="flex gap-2">
              <button
                onClick={handleSubmit}
                disabled={!lidOpened || submitting}
                className={`flex-1 py-2 rounded-xl font-bold text-sm transition-all ${
                  lidOpened
                    ? 'bg-orange-500 hover:bg-orange-600 text-white shadow-lg'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                }`}
              >
                {submitting ? 'Submitting…' : 'Done'}
              </button>
              <button
                onClick={() => setPanelOpen(false)}
                className="px-3 py-2 rounded-xl text-sm text-slate-500 hover:bg-slate-100 border border-slate-200"
              >
                Cancel
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
