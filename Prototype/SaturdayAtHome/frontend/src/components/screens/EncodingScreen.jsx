import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useGameStore } from '../../store/gameStore'
import { getBlockConfig } from '../../utils/api'
import EncodingCard from '../pm/EncodingCard'
import EncodingQuiz from '../pm/EncodingQuiz'

// Steps: card_a → quiz_a → card_b → quiz_b → done
const STEPS = ['card_a', 'quiz_a', 'card_b', 'quiz_b']

export default function EncodingScreen({ embedded = false }) {
  const sessionId = useGameStore(s => s.sessionId)
  const blockNumber = useGameStore(s => s.blockNumber)
  const setPhase = useGameStore(s => s.setPhase)
  const submitEncoding = useGameStore(s => s.submitEncoding)
  const [tasks, setTasks] = useState([])
  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!sessionId || !blockNumber) return
    setLoading(true)
    getBlockConfig(sessionId, blockNumber)
      .then(data => {
        setTasks(data.pm_tasks || [data.task_a, data.task_b].filter(Boolean))
        setStep(0)
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [sessionId, blockNumber])

  const taskA = tasks[0] || null
  const taskB = tasks[1] || null
  const currentStep = STEPS[step]

  const advance = () => {
    if (step < STEPS.length - 1) {
      setStep(s => s + 1)
    } else {
      setPhase('playing')
    }
  }

  const wrapperClass = embedded
    ? 'h-full flex flex-col items-center justify-center p-4 overflow-auto'
    : 'min-h-screen bg-gradient-to-br from-slate-50 to-purple-50 flex flex-col items-center justify-center p-4'

  if (loading) {
    return (
      <div className={wrapperClass}>
        <p className="text-slate-400 text-lg">Loading tasks…</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className={wrapperClass}>
        <div className="text-center">
          <p className="text-red-500 mb-2">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={wrapperClass}>
      <div className="mb-4 text-center">
        <div className="text-xs text-slate-400 uppercase tracking-wider font-medium">
          Block {blockNumber} — Task {currentStep.includes('a') ? 'A' : 'B'}
        </div>
        <div className="flex gap-1 justify-center mt-2">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`w-8 h-1.5 rounded-full transition-colors ${
                i <= step ? 'bg-purple-500' : 'bg-slate-200'
              }`}
            />
          ))}
        </div>
      </div>

      <motion.div key={step} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        {currentStep === 'card_a' && (
          <EncodingCard task={taskA} onNext={advance} />
        )}
        {currentStep === 'quiz_a' && (
          <EncodingQuiz
            task={taskA}
            onComplete={(attempts) => {
              submitEncoding(taskA.task_id || taskA.id, attempts)
              advance()
            }}
          />
        )}
        {currentStep === 'card_b' && (
          <EncodingCard task={taskB} onNext={advance} />
        )}
        {currentStep === 'quiz_b' && (
          <EncodingQuiz
            task={taskB}
            onComplete={(attempts) => {
              submitEncoding(taskB.task_id || taskB.id, attempts)
              advance()
            }}
          />
        )}
      </motion.div>
    </div>
  )
}
