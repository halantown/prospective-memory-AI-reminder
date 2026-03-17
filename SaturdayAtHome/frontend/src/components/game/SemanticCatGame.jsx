import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useGameStore } from '../../store/gameStore'

const CATEGORIES = ['Work', 'Personal', 'Spam']
const CATEGORY_COLORS = {
  Work: 'bg-blue-500 hover:bg-blue-600',
  Personal: 'bg-emerald-500 hover:bg-emerald-600',
  Spam: 'bg-red-500 hover:bg-red-600',
}

export default function SemanticCatGame() {
  const gameItems = useGameStore(s => s.gameItems)
  const itemIndex = useGameStore(s => s.itemIndex)
  const recordResponse = useGameStore(s => s.recordResponse)
  const [feedback, setFeedback] = useState(null)
  const timerRef = useRef(null)
  const shownAtRef = useRef(Date.now())

  const currentItem = gameItems[itemIndex] || null

  // Track when each new item appears
  useEffect(() => {
    shownAtRef.current = Date.now()
  }, [itemIndex])

  // Auto-advance after timeout
  useEffect(() => {
    if (!currentItem) return
    const timeout = currentItem.timeout_ms || 4000

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
    }, timeout)

    return () => clearTimeout(timerRef.current)
  }, [itemIndex, currentItem, recordResponse])

  const handleSelect = useCallback((category) => {
    if (!currentItem) return
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
  }, [currentItem, itemIndex, recordResponse])

  if (!currentItem) {
    return (
      <div className="h-full flex items-center justify-center text-slate-400">
        <p className="text-lg">Waiting for items…</p>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col items-center justify-center p-8">
      {/* Email skin header */}
      <div className="text-xs text-slate-400 uppercase tracking-wider mb-4 font-medium">
        📧 Sort this email
      </div>

      {/* Email card */}
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

      {/* Category buttons */}
      <div className="flex gap-3 mt-6">
        {CATEGORIES.map(cat => (
          <button
            key={cat}
            onClick={() => handleSelect(cat)}
            className={`
              px-6 py-3 rounded-lg text-white font-medium text-sm shadow
              transition-transform active:scale-95
              ${CATEGORY_COLORS[cat]}
            `}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Progress indicator */}
      <div className="mt-4 text-xs text-slate-400">
        {itemIndex + 1} / {gameItems.length}
      </div>
    </div>
  )
}
