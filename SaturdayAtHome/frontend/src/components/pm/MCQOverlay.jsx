import { useState, useEffect, useRef } from 'react'
import { useGameStore } from '../../store/gameStore'

export default function MCQOverlay() {
  const mcqData = useGameStore(s => s.mcqData)
  const submitMCQ = useGameStore(s => s.submitMCQ)
  const [timeLeft, setTimeLeft] = useState(30)
  const intervalRef = useRef(null)

  useEffect(() => {
    if (!mcqData) return
    setTimeLeft(30)
    intervalRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(intervalRef.current)
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(intervalRef.current)
  }, [mcqData])

  if (!mcqData) return null

  const urgentColor = timeLeft <= 10 ? 'text-red-500' : 'text-slate-400'

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl p-6 max-w-lg w-full mx-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-slate-800">{mcqData.question}</h3>
          <span className={`text-sm font-mono font-bold ${urgentColor}`}>{timeLeft}s</span>
        </div>
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
