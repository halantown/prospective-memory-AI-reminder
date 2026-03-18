import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useGameStore } from '../../store/gameStore'

const CATEGORIES = ['Work', 'Personal', 'Spam']
const KEY_LABELS = { Work: '1', Personal: '2', Spam: '3' }
const CATEGORY_COLORS = {
  Work: 'bg-blue-500 hover:bg-blue-600',
  Personal: 'bg-emerald-500 hover:bg-emerald-600',
  Spam: 'bg-red-500 hover:bg-red-600',
}

export default function SemanticCatGame() {
  const gameItems = useGameStore(s => s.gameItems)
  const itemIndex = useGameStore(s => s.itemIndex)
  const recordResponse = useGameStore(s => s.recordResponse)
  const gamePaused = useGameStore(s => s.gamePaused)
  const [feedback, setFeedback] = useState(null)
  const timerRef = useRef(null)
  const shownAtRef = useRef(Date.now())
  const pauseRemainingRef = useRef(null)

  const currentItem = gameItems[itemIndex] || null

  // Track when each new item appears
  useEffect(() => {
    shownAtRef.current = Date.now()
    pauseRemainingRef.current = null
  }, [itemIndex])

  // Auto-advance after timeout (pausable)
  useEffect(() => {
    if (!currentItem || gamePaused) return
    const timeout = currentItem.timeout_ms || 4000
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
          pauseRemainingRef.current = Math.max(100, (currentItem?.timeout_ms || 4000) - elapsed)
        } else {
          pauseRemainingRef.current = null
        }
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
    }
  }, [itemIndex, currentItem, recordResponse, gamePaused])

  const handleSelect = useCallback((category) => {
    if (!currentItem || gamePaused) return
    clearTimeout(timerRef.current)

    const isCorrect = category === (currentItem.category || currentItem.correct_category)
    setFeedback(isCorrect ? 'correct' : 'wrong')

    recordResponse({
      item_index: itemIndex,
      item_id: currentItem.id,
      selected: category,
      correct: isCorrect,
      skipped: false,
      response_time_ms: Date.now() - shownAtRef.current,
      client_ts: Date.now(),
    })

    setTimeout(() => setFeedback(null), 300)
  }, [currentItem, itemIndex, recordResponse, gamePaused])

  // Keyboard: 1/A=Work, 2/S=Personal, 3/D=Spam
  useEffect(() => {
    const onKey = (e) => {
      if (gamePaused) return
      const map = { '1': 0, '2': 1, '3': 2, 'a': 0, 's': 1, 'd': 2 }
      const idx = map[e.key.toLowerCase()]
      if (idx !== undefined && CATEGORIES[idx]) {
        e.preventDefault()
        handleSelect(CATEGORIES[idx])
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [handleSelect, gamePaused])

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
        📧 Sort this email
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={itemIndex}
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -40 }}
          className={`
            w-full max-w-md bg-white rounded-xl shadow-lg border-2 p-5 transition-colors
            ${feedback === 'correct' ? 'border-green-400 bg-green-50' :
              feedback === 'wrong' ? 'border-red-400 bg-red-50' :
              'border-slate-200'}
          `}
        >
          <div className="text-xs text-slate-400 mb-1">
            From: {currentItem.sender || 'inbox'}
          </div>
          <h3 className="text-lg font-semibold text-slate-800 mb-2">
            {currentItem.stimulus || currentItem.subject || currentItem.text || 'Email'}
          </h3>
          {currentItem.preview && (
            <p className="text-sm text-slate-500 leading-relaxed line-clamp-2">
              {currentItem.preview}
            </p>
          )}
        </motion.div>
      </AnimatePresence>

      <div className={`flex gap-3 mt-6 ${gamePaused ? 'opacity-50 pointer-events-none' : ''}`}>
        {CATEGORIES.map((cat, i) => (
          <button
            key={cat}
            onClick={() => handleSelect(cat)}
            className={`
              px-6 py-3 rounded-lg text-white font-medium text-sm shadow
              transition-transform active:scale-95
              ${CATEGORY_COLORS[cat]}
            `}
          >
            <kbd className="bg-white/20 px-1.5 py-0.5 rounded text-xs font-mono mr-1.5">{KEY_LABELS[cat]}</kbd>
            {cat}
          </button>
        ))}
      </div>

      <div className="mt-4 text-xs text-slate-400">
        {itemIndex + 1} / {gameItems.length}
      </div>
    </div>
  )
}
