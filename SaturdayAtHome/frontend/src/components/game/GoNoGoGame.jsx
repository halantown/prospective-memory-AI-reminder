import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useGameStore } from '../../store/gameStore'

/**
 * Visual Go/No-Go task — response inhibition paradigm.
 *
 * Go stimulus:   green circle → press SPACEBAR within 500 ms
 * No-Go stimulus: red circle  → withhold response
 * 75:25 Go:No-Go ratio · ISI 800-1200 ms (random) · stimulus 500 ms
 */

const STIMULUS_MS = 500
const ISI_MIN = 800
const ISI_MAX = 1200
const FEEDBACK_MS = 250

function randomISI() {
  return ISI_MIN + Math.random() * (ISI_MAX - ISI_MIN)
}

export default function GoNoGoGame() {
  const gameItems = useGameStore(s => s.gameItems)
  const itemIndex = useGameStore(s => s.itemIndex)
  const recordResponse = useGameStore(s => s.recordResponse)
  const gamePaused = useGameStore(s => s.gamePaused)
  const currentSkin = useGameStore(s => s.currentSkin)

  // 'isi' → 'stimulus' → 'feedback' → next trial
  const [trialPhase, setTrialPhase] = useState('isi')
  const [feedback, setFeedback] = useState(null)
  const respondedRef = useRef(false)
  const stimOnsetRef = useRef(0)
  const timerRef = useRef(null)
  const pausedRemainRef = useRef(null)
  const phaseStartRef = useRef(Date.now())

  const item = gameItems[itemIndex] || null
  const isGo = item?.type === 'go'

  // Skin-specific labels
  const skinLabel = currentSkin?.includes('laundry') ? '👕 Laundry Sorting'
    : currentSkin?.includes('recycling') ? '♻️ Recycling Sort'
    : currentSkin?.includes('wardrobe') ? '👔 Wardrobe Sort'
    : '🛒 Quick Sort'

  const goHint = currentSkin?.includes('laundry') ? 'Colored item → SPACE'
    : currentSkin?.includes('recycling') ? 'Recyclable → SPACE'
    : currentSkin?.includes('wardrobe') ? 'Keep → SPACE'
    : 'Green tag → SPACE'

  const nogoHint = currentSkin?.includes('laundry') ? 'White item → skip'
    : currentSkin?.includes('recycling') ? 'Trash → skip'
    : currentSkin?.includes('wardrobe') ? 'Donate → skip'
    : 'Red tag → skip'

  // ── Trial pipeline (ISI → stimulus → feedback → advance) ──
  useEffect(() => {
    if (!item || gamePaused) return
    respondedRef.current = false
    setTrialPhase('isi')
    setFeedback(null)
    phaseStartRef.current = Date.now()

    const isiMs = pausedRemainRef.current ?? randomISI()
    pausedRemainRef.current = null

    timerRef.current = setTimeout(() => {
      setTrialPhase('stimulus')
      stimOnsetRef.current = Date.now()
      phaseStartRef.current = Date.now()

      // Auto-expire stimulus after STIMULUS_MS
      timerRef.current = setTimeout(() => {
        if (respondedRef.current) return
        const outcome = isGo ? 'miss' : 'correct_reject'
        setFeedback(outcome)
        setTrialPhase('feedback')

        recordResponse({
          item_index: itemIndex,
          item_id: item.id,
          selected: null,
          correct: !isGo,
          skipped: isGo,
          response_time_ms: STIMULUS_MS,
          outcome,
          client_ts: Date.now(),
        })

        timerRef.current = setTimeout(() => {
          setFeedback(null)
          setTrialPhase('isi')
        }, FEEDBACK_MS)
      }, STIMULUS_MS)
    }, isiMs)

    return () => {
      if (timerRef.current) {
        if (useGameStore.getState().gamePaused && trialPhase === 'isi') {
          pausedRemainRef.current = Math.max(50, isiMs - (Date.now() - phaseStartRef.current))
        }
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
    }
  }, [itemIndex, item, gamePaused]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── SPACEBAR handler ──
  const handleGo = useCallback(() => {
    if (!item || gamePaused || trialPhase !== 'stimulus' || respondedRef.current) return
    respondedRef.current = true
    clearTimeout(timerRef.current)

    const rt = Date.now() - stimOnsetRef.current
    const outcome = item.type === 'go' ? 'hit' : 'false_alarm'
    setFeedback(outcome)
    setTrialPhase('feedback')

    recordResponse({
      item_index: itemIndex,
      item_id: item.id,
      selected: 'go',
      correct: item.type === 'go',
      skipped: false,
      response_time_ms: rt,
      outcome,
      client_ts: Date.now(),
    })

    timerRef.current = setTimeout(() => {
      setFeedback(null)
      setTrialPhase('isi')
    }, FEEDBACK_MS)
  }, [item, gamePaused, trialPhase, itemIndex, recordResponse])

  useEffect(() => {
    const onKey = (e) => {
      if (e.code === 'Space' || e.key === ' ') {
        e.preventDefault()
        handleGo()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [handleGo])

  if (!item) {
    return (
      <div className="h-full flex items-center justify-center text-slate-400">
        <p className="text-lg">Waiting for items…</p>
      </div>
    )
  }

  const stimColor = isGo ? '#22c55e' : '#ef4444'
  const fbBg = feedback === 'hit' ? 'bg-green-50'
    : feedback === 'false_alarm' ? 'bg-red-50'
    : feedback === 'miss' ? 'bg-amber-50'
    : 'bg-white'

  return (
    <div className={`h-full flex flex-col items-center justify-center p-6 transition-colors duration-150 ${fbBg}`}>
      <div className="text-xs text-slate-400 uppercase tracking-wider mb-2 font-medium">{skinLabel}</div>

      {/* Legend */}
      <div className="flex gap-6 mb-6 text-xs text-slate-500">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-green-500 inline-block" /> {goHint}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-red-500 inline-block" /> {nogoHint}
        </span>
      </div>

      {/* Stimulus area */}
      <div className="w-48 h-48 flex items-center justify-center mb-6">
        <AnimatePresence mode="wait">
          {trialPhase === 'stimulus' && (
            <motion.div
              key={`s-${itemIndex}`}
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.5, opacity: 0 }}
              transition={{ duration: 0.06 }}
              className="w-36 h-36 rounded-full shadow-lg flex items-center justify-center"
              style={{ backgroundColor: stimColor }}
            >
              <span className="text-white text-4xl font-bold select-none">
                {isGo ? '✓' : '✗'}
              </span>
            </motion.div>
          )}

          {trialPhase === 'feedback' && feedback && (
            <motion.div key={`f-${itemIndex}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-center">
              {feedback === 'hit' && <span className="text-green-500 text-3xl font-bold">✓ Hit!</span>}
              {feedback === 'false_alarm' && <span className="text-red-500 text-3xl font-bold">✗ False Alarm</span>}
              {feedback === 'miss' && <span className="text-amber-500 text-2xl font-semibold">— Miss</span>}
              {feedback === 'correct_reject' && <span className="text-slate-400 text-2xl">✓ Correct</span>}
            </motion.div>
          )}

          {trialPhase === 'isi' && (
            <motion.div key="fix" initial={{ opacity: 0 }} animate={{ opacity: 0.4 }} className="text-slate-300 text-5xl select-none">+</motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* SPACE prompt */}
      <div className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors ${
        trialPhase === 'stimulus' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-400'
      }`}>
        Press <kbd className="bg-white border border-slate-300 px-2 py-0.5 rounded font-mono text-xs shadow-sm">SPACE</kbd> for green circle
      </div>

      <div className="mt-3 text-xs text-slate-400">
        Trial {itemIndex + 1} / {gameItems.length}
      </div>
    </div>
  )
}
