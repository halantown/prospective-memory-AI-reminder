import { useState, useCallback } from 'react'
import { motion } from 'framer-motion'

export default function EncodingQuiz({ task, onComplete }) {
  const [selected, setSelected] = useState(null)
  const [showError, setShowError] = useState(false)
  const [attempts, setAttempts] = useState(0)

  const question = task?.quiz?.question || 'What should you do when the event occurs?'
  const options = task?.quiz?.options || []
  const correctIndex = task?.quiz?.correct ?? 0

  const handleSubmit = useCallback(() => {
    if (selected === null) return

    const newAttempts = attempts + 1
    setAttempts(newAttempts)

    if (selected === correctIndex) {
      onComplete(newAttempts)
    } else {
      setShowError(true)
      setSelected(null)
      setTimeout(() => setShowError(false), 2000)
    }
  }, [selected, attempts, correctIndex, onComplete])

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-lg w-full bg-white rounded-xl shadow-lg p-6 mx-auto"
    >
      <div className="text-xs text-purple-600 uppercase tracking-wider font-medium mb-3">
        Quick Check
      </div>

      <h3 className="text-lg font-semibold text-slate-800 mb-4">{question}</h3>

      {showError && (
        <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600 text-center">
          Not quite — please try again.
        </div>
      )}

      <div className="space-y-2 mb-4">
        {options.map((option, i) => (
          <button
            key={i}
            onClick={() => setSelected(i)}
            className={`
              w-full text-left p-3 rounded-lg border-2 transition-colors
              ${selected === i
                ? 'border-purple-400 bg-purple-50'
                : 'border-slate-200 hover:border-slate-300'
              }
            `}
          >
            <span className="font-medium text-slate-500 mr-2">{String.fromCharCode(65 + i)}.</span>
            {option}
          </button>
        ))}
      </div>

      <button
        onClick={handleSubmit}
        disabled={selected === null}
        className="w-full py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-slate-300 text-white font-medium rounded-lg transition-colors"
      >
        Confirm
      </button>
    </motion.div>
  )
}
