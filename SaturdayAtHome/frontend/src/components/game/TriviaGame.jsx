import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useGameStore } from '../../store/gameStore'

export default function TriviaGame() {
  const gameItems = useGameStore(s => s.gameItems)
  const itemIndex = useGameStore(s => s.itemIndex)
  const recordResponse = useGameStore(s => s.recordResponse)
  const gamePaused = useGameStore(s => s.gamePaused)
  const [feedback, setFeedback] = useState(null)
  const timerRef = useRef(null)
  const shownAtRef = useRef(Date.now())
  const pauseRemainingRef = useRef(null)

  const currentItem = gameItems[itemIndex] || null

  useEffect(() => {
    shownAtRef.current = Date.now()
    pauseRemainingRef.current = null
  }, [itemIndex])

  // Auto-advance after timeout (pausable)
  useEffect(() => {
    if (!currentItem || gamePaused) return
    const timeout = currentItem.timeout_ms || 7000
    const remaining = pauseRemainingRef.current ?? timeout

    if (pauseRemainingRef.current !== null) {
      shownAtRef.current = Date.now() - (timeout - remaining)
      pauseRemainingRef.current = null
    }

    timerRef.current = setTimeout(() => {
      recordResponse({
        item_index: itemIndex,
        item_id: currentItem.id,
        selected: null,
        correct: false,
        skipped: true,
        response_time_ms: timeout,
        client_ts: Date.now(),
      })
      setFeedback(null)
    }, remaining)

    return () => {
      if (timerRef.current) {
        const isPausing = useGameStore.getState().gamePaused
        if (isPausing) {
          const elapsed = Date.now() - shownAtRef.current
          pauseRemainingRef.current = Math.max(100, (currentItem?.timeout_ms || 7000) - elapsed)
        } else {
          pauseRemainingRef.current = null
        }
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
    }
  }, [itemIndex, currentItem, recordResponse, gamePaused])

  const handleAnswer = useCallback((answer) => {
    if (!currentItem || gamePaused) return
    clearTimeout(timerRef.current)

    const isCorrect = answer === (currentItem.answer !== undefined ? currentItem.answer : currentItem.correct_answer)
    setFeedback(isCorrect ? 'correct' : 'wrong')

    recordResponse({
      item_index: itemIndex,
      item_id: currentItem.id,
      selected: answer,
      correct: isCorrect,
      skipped: false,
      response_time_ms: Date.now() - shownAtRef.current,
      client_ts: Date.now(),
    })

    setTimeout(() => setFeedback(null), 300)
  }, [currentItem, itemIndex, recordResponse, gamePaused])

  // Keyboard: 1/A=True, 2/S=False
  useEffect(() => {
    const onKey = (e) => {
      if (gamePaused) return
      const key = e.key.toLowerCase()
      if (key === '1' || key === 'a') { e.preventDefault(); handleAnswer(true) }
      else if (key === '2' || key === 's') { e.preventDefault(); handleAnswer(false) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [handleAnswer, gamePaused])

  if (!currentItem) {
    return (
      <div className="h-full flex items-center justify-center text-slate-400">
        <p className="text-lg">Waiting for items…</p>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col items-center justify-center p-8">
      <div className="text-xs text-slate-400 uppercase tracking-wider mb-4 font-medium">
        🎧 Podcast Quiz
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={itemIndex}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className={`
            w-full max-w-lg bg-white rounded-xl shadow-lg border-2 p-6 transition-colors
            ${feedback === 'correct' ? 'border-green-400 bg-green-50' :
              feedback === 'wrong' ? 'border-red-400 bg-red-50' :
              'border-slate-200'}
          `}
        >
          <p className="text-base text-slate-700 leading-relaxed text-center">
            "{currentItem.question || currentItem.statement || currentItem.text || 'Statement'}"
          </p>
        </motion.div>
      </AnimatePresence>

      <div className={`flex gap-4 mt-6 ${gamePaused ? 'opacity-50 pointer-events-none' : ''}`}>
        <button
          onClick={() => handleAnswer(true)}
          className="px-8 py-3 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-lg shadow transition-transform active:scale-95"
        >
          <kbd className="bg-white/20 px-1.5 py-0.5 rounded text-xs font-mono mr-1.5">1</kbd>
          ✓ True
        </button>
        <button
          onClick={() => handleAnswer(false)}
          className="px-8 py-3 bg-orange-500 hover:bg-orange-600 text-white font-medium rounded-lg shadow transition-transform active:scale-95"
        >
          <kbd className="bg-white/20 px-1.5 py-0.5 rounded text-xs font-mono mr-1.5">2</kbd>
          ✗ False
        </button>
      </div>

      <div className="mt-4 text-xs text-slate-400">
        {itemIndex + 1} / {gameItems.length}
      </div>
    </div>
  )
}
