import { useState } from 'react'
import { motion } from 'framer-motion'
import { useGameStore } from '../../store/gameStore'
import { reportEncoding } from '../../utils/api'

function TaskCard({ slot, task }) {
  if (!task) return null
  return (
    <div className="bg-slate-50 rounded-2xl p-5 border-2 border-slate-200">
      <div className="text-xs font-semibold uppercase tracking-wide text-indigo-600 mb-2">Slot {slot}</div>
      <h3 className="font-bold text-lg text-slate-800 mb-2">{task.title}</h3>
      <p className="text-sm text-slate-600 mb-2"><span className="font-semibold">Room:</span> {task.room}</p>
      <p className="text-sm text-slate-600 mb-2"><span className="font-semibold">Trigger:</span> {task.trigger}</p>
      <p className="text-sm text-slate-600"><span className="font-semibold">Step cue:</span> {task.preparation_step}</p>
    </div>
  )
}

export default function EncodingScreen() {
  const blockConfig = useGameStore((s) => s.currentBlockConfig)
  const sessionId = useGameStore((s) => s.sessionId)
  const blockNumber = useGameStore((s) => s.blockNumber)
  const confirmEncoding = useGameStore((s) => s.confirmEncoding)

  const taskA = blockConfig?.task_slots?.A?.task || blockConfig?.task_a_config
  const taskB = blockConfig?.task_slots?.B?.task || blockConfig?.task_b_config

  const quiz = taskA?.encoding_card?.quiz || {
    question: 'Which option is correct?',
    options: ['Option 1', 'Option 2'],
    correct_index: 0,
  }

  const [selectedAnswer, setSelectedAnswer] = useState(null)
  const [status, setStatus] = useState('idle')
  const [attempts, setAttempts] = useState(0)
  const [submitting, setSubmitting] = useState(false)

  const handleQuizCheck = () => {
    if (selectedAnswer === null) return
    const nextAttempts = attempts + 1
    setAttempts(nextAttempts)

    if (selectedAnswer === quiz.correct_index) {
      setStatus('correct')
    } else {
      setStatus('wrong')
      setTimeout(() => {
        setStatus('idle')
        setSelectedAnswer(null)
      }, 1200)
    }
  }

  const handleStart = async () => {
    if (!sessionId || !blockNumber) return
    setSubmitting(true)
    try {
      await reportEncoding(sessionId, blockNumber, Math.max(1, attempts || 1))
    } catch (err) {
      console.warn('[Encoding] report failed:', err)
    } finally {
      confirmEncoding(Math.max(1, attempts || 1))
      setSubmitting(false)
    }
  }

  return (
    <div className="w-full h-screen bg-gradient-to-br from-indigo-50 to-blue-50 flex items-center justify-center font-sans">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-3xl shadow-2xl p-8 max-w-4xl w-full mx-4"
      >
        <div className="text-center mb-7">
          <h1 className="text-2xl font-black text-slate-800 mb-2">Block {blockNumber} Encoding</h1>
          <p className="text-slate-500">Read both PM tasks carefully. No reference will be available during this block.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <TaskCard slot="A" task={taskA} />
          <TaskCard slot="B" task={taskB} />
        </div>

        <div className="border-t border-slate-200 pt-5">
          <h3 className="font-bold text-slate-800 mb-3">Verification question</h3>
          <p className="text-sm text-slate-600 mb-3">{quiz.question}</p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-3">
            {(quiz.options || []).map((opt, idx) => (
              <button
                key={`${opt}-${idx}`}
                onClick={() => setSelectedAnswer(idx)}
                className={`text-left px-3 py-2 rounded-xl border text-sm ${
                  selectedAnswer === idx
                    ? 'border-indigo-500 bg-indigo-50 text-indigo-800'
                    : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                {opt}
              </button>
            ))}
          </div>

          {status === 'wrong' && (
            <p className="text-red-600 text-sm mb-2">Incorrect. Please read again and retry.</p>
          )}
          {status === 'correct' && (
            <p className="text-emerald-700 text-sm mb-2">Correct. You can start the block now.</p>
          )}

          {status !== 'correct' ? (
            <button
              onClick={handleQuizCheck}
              disabled={selectedAnswer === null}
              className="w-full py-3 bg-indigo-500 hover:bg-indigo-600 disabled:bg-slate-300 text-white font-bold rounded-xl"
            >
              Check answer
            </button>
          ) : (
            <button
              onClick={handleStart}
              disabled={submitting}
              className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl"
            >
              {submitting ? 'Starting…' : 'Start block'}
            </button>
          )}
        </div>
      </motion.div>
    </div>
  )
}
