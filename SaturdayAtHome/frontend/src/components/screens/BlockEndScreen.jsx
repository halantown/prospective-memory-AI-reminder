import { useGameStore } from '../../store/gameStore'

/**
 * Block end screen — shown when a block's timeline completes.
 * Shows score summary, then allows proceeding to next block or finishing.
 */
export default function BlockEndScreen() {
  const score = useGameStore((s) => s.score)
  const blockNumber = useGameStore((s) => s.blockNumber)
  const totalBlocks = useGameStore((s) => s.totalBlocks)
  const conditionOrder = useGameStore((s) => s.conditionOrder)
  const startBlockEncoding = useGameStore((s) => s.startBlockEncoding)
  const setPhase = useGameStore((s) => s.setPhase)

  const isLast = blockNumber >= totalBlocks

  const handleNext = () => {
    const nextBlock = blockNumber + 1
    const conditions = conditionOrder || ['HighAF_HighCB', 'LowAF_LowCB', 'HighAF_LowCB', 'LowAF_HighCB']
    startBlockEncoding({
      blockNumber: nextBlock,
      condition: conditions[nextBlock - 1] || 'HighAF_HighCB',
      taskPairId: nextBlock,
    })
  }

  const handleFinish = () => {
    setPhase('session_complete')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow-xl w-[500px] overflow-hidden text-center">
        <div className="bg-gradient-to-r from-emerald-500 to-teal-500 px-8 py-6 text-white">
          <div className="text-4xl mb-2">🎉</div>
          <h1 className="text-2xl font-bold">Block {blockNumber} Complete!</h1>
        </div>

        <div className="px-8 py-8 space-y-6">
          <div className="bg-slate-50 rounded-xl p-6">
            <div className="text-5xl font-bold text-slate-800">{score}</div>
            <div className="text-sm text-slate-500 mt-1">Ongoing Task Score</div>
          </div>

          <div className="text-sm text-slate-500">
            Block {blockNumber} of {totalBlocks}
          </div>

          {isLast ? (
            <button
              onClick={handleFinish}
              className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-lg rounded-xl transition-colors"
            >
              ✅ Finish Experiment
            </button>
          ) : (
            <button
              onClick={handleNext}
              className="w-full py-3 bg-blue-500 hover:bg-blue-600 text-white font-bold text-lg rounded-xl transition-colors"
            >
              ▶ Next Block ({blockNumber + 1} of {totalBlocks})
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
