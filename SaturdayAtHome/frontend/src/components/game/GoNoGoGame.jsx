import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useGameStore } from '../../store/gameStore'

export default function GoNoGoGame() {
  const gameItems = useGameStore(s => s.gameItems)
  const itemIndex = useGameStore(s => s.itemIndex)
  const recordResponse = useGameStore(s => s.recordResponse)
  const [feedback, setFeedback] = useState(null)
  const timerRef = useRef(null)
  const shownAtRef = useRef(Date.now())

  const currentItem = gameItems[itemIndex] || null

  useEffect(() => {
    shownAtRef.current = Date.now()
  }, [itemIndex])

  // Auto-advance (no-go items pass after timeout)
  useEffect(() => {
    if (!currentItem) return
    const timeout = currentItem.timeout_ms || 2500

    timerRef.current = setTimeout(() => {
      const isNoGo = currentItem.type === 'nogo'
      recordResponse({
        item_index: itemIndex,
        item_id: currentItem.id,
        selected: null,
        correct: isNoGo, // not responding to nogo = correct
        skipped: !isNoGo,
        response_time_ms: timeout,
        client_ts: Date.now(),
      })
      setFeedback(isNoGo ? 'correct' : null)
      setTimeout(() => setFeedback(null), 200)
    }, timeout)

    return () => clearTimeout(timerRef.current)
  }, [itemIndex, currentItem, recordResponse])

  const handleAddToCart = useCallback(() => {
    if (!currentItem) return
    clearTimeout(timerRef.current)

    const isGo = currentItem.type === 'go'
    setFeedback(isGo ? 'correct' : 'wrong')

    recordResponse({
      item_index: itemIndex,
      item_id: currentItem.id,
      selected: 'add_to_cart',
      correct: isGo,
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
      <div className="text-xs text-slate-400 uppercase tracking-wider mb-4 font-medium">
        🛒 Grocery Shopping
      </div>

      {/* Item card */}
      <AnimatePresence mode="wait">
        <motion.div
          key={itemIndex}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          className={`
            w-64 h-64 flex flex-col items-center justify-center bg-white rounded-2xl shadow-lg border-2 transition-colors
            ${feedback === 'correct' ? 'border-green-400 bg-green-50' :
              feedback === 'wrong' ? 'border-red-400 bg-red-50' :
              'border-slate-200'}
          `}
        >
          <span className="text-6xl mb-3">{currentItem.icon || currentItem.emoji || '🍎'}</span>
          <span className="text-lg font-semibold text-slate-700">
            {currentItem.name || currentItem.text || 'Item'}
          </span>
        </motion.div>
      </AnimatePresence>

      {/* Action button — only for go items, but always shown for naturalness */}
      <button
        onClick={handleAddToCart}
        className="mt-6 px-8 py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-medium rounded-lg shadow transition-transform active:scale-95"
      >
        🛒 Add to Cart
      </button>

      <div className="mt-3 text-xs text-slate-400">
        {itemIndex + 1} / {gameItems.length}
      </div>
    </div>
  )
}
