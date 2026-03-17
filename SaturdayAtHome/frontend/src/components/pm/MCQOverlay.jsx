import { useGameStore } from '../../store/gameStore'

export default function MCQOverlay() {
  const mcqData = useGameStore(s => s.mcqData)
  const submitMCQ = useGameStore(s => s.submitMCQ)

  if (!mcqData) return null

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl p-6 max-w-lg w-full mx-4">
        <h3 className="text-lg font-semibold text-slate-800 mb-4">{mcqData.question}</h3>
        <div className="space-y-3">
          {mcqData.options.map((option, i) => (
            <button
              key={i}
              onClick={() => submitMCQ(i)}
              className="w-full text-left p-3 rounded-lg border-2 border-slate-200 hover:border-blue-400 hover:bg-blue-50 transition-colors"
            >
              <span className="font-medium text-slate-500 mr-2">{String.fromCharCode(65 + i)}.</span>
              {option}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
