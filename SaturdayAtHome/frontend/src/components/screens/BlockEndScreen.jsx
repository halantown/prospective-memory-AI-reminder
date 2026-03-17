import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useGameStore } from '../../store/gameStore'

const TOTAL_BLOCKS = 4
const REST_DURATION_S = 30

export default function BlockEndScreen() {
  const blockNumber = useGameStore(s => s.blockNumber)
  const setBlockNumber = useGameStore(s => s.setBlockNumber)
  const setPhase = useGameStore(s => s.setPhase)
  const resetBlock = useGameStore(s => s.resetBlock)
  const [countdown, setCountdown] = useState(REST_DURATION_S)
  const [canContinue, setCanContinue] = useState(false)

  const isLastBlock = blockNumber >= TOTAL_BLOCKS

  useEffect(() => {
    if (countdown <= 0) {
      setCanContinue(true)
      return
    }
    const timer = setTimeout(() => setCountdown(c => c - 1), 1000)
    return () => clearTimeout(timer)
  }, [countdown])

  const handleNext = () => {
    if (isLastBlock) {
      setPhase('complete')
    } else {
      resetBlock()
      setBlockNumber(blockNumber + 1)
      setPhase('encoding')
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-emerald-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 text-center"
      >
        <div className="text-4xl mb-4">☕</div>
        <h2 className="text-2xl font-bold text-slate-800 mb-2">
          Block {blockNumber} Complete
        </h2>
        <p className="text-slate-500 mb-6">
          {isLastBlock
            ? 'You have finished all blocks!'
            : 'Take a short rest before the next block.'}
        </p>

        {!isLastBlock && !canContinue && (
          <div className="mb-4">
            <div className="text-3xl font-mono font-bold text-slate-700 mb-2">{countdown}s</div>
            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-emerald-400 rounded-full"
                initial={{ width: '100%' }}
                animate={{ width: '0%' }}
                transition={{ duration: REST_DURATION_S, ease: 'linear' }}
              />
            </div>
          </div>
        )}

        <button
          onClick={handleNext}
          disabled={!canContinue && !isLastBlock}
          className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-semibold rounded-lg transition-colors"
        >
          {isLastBlock ? 'Finish Experiment' : 'Continue to Next Block'}
        </button>
      </motion.div>
    </div>
  )
}
