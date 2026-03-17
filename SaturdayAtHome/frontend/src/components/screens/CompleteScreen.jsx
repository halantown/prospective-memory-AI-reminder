import { useState } from 'react'
import { motion } from 'framer-motion'
import { useGameStore } from '../../store/gameStore'

function LikertScale({ label, value, onChange, labels }) {
  return (
    <div className="mb-5">
      <p className="text-sm font-medium text-slate-700 mb-2">{label}</p>
      <div className="flex gap-1.5 flex-wrap">
        {labels.map((text, i) => {
          const val = i + 1
          return (
            <button
              key={val}
              onClick={() => onChange(val)}
              className={`
                flex-1 min-w-[3.5rem] py-1.5 rounded-lg border-2 text-xs font-medium transition-colors
                ${value === val
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-slate-200 hover:border-slate-300 text-slate-500'
                }
              `}
            >
              {text}
            </button>
          )
        })}
      </div>
    </div>
  )
}

const MSE_LABELS = ['1 — Never', '2', '3', '4 — Sometimes', '5', '6', '7 — Always']

export default function CompleteScreen() {
  const wsSend = useGameStore(s => s.wsSend)
  const [phase, setPhase] = useState('questionnaire') // questionnaire → done
  const [mse, setMse] = useState(null)
  const [strategyUse, setStrategyUse] = useState(null)
  const [feedback, setFeedback] = useState('')
  const [submitted, setSubmitted] = useState(false)

  const canSubmit = mse !== null && strategyUse !== null

  const handleSubmit = () => {
    if (!canSubmit) return
    if (wsSend) {
      wsSend({
        type: 'questionnaire',
        data: {
          block: 'final',
          mse_score: mse,
          strategy_use: strategyUse,
          open_feedback: feedback,
          submitted_at: Date.now(),
        },
      })
    }
    setSubmitted(true)
    setPhase('done')
  }

  if (phase === 'done') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-blue-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 text-center"
        >
          <div className="text-5xl mb-4">🎉</div>
          <h2 className="text-2xl font-bold text-slate-800 mb-3">
            Thank you for participating!
          </h2>
          <p className="text-slate-500 leading-relaxed mb-4">
            You have completed all blocks of the experiment. Your responses have been saved.
          </p>
          <p className="text-slate-400 text-sm">
            Please let the experimenter know you have finished.
          </p>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-xl w-full bg-white rounded-xl shadow-lg p-8"
      >
        <div className="text-center mb-6">
          <div className="text-xs text-slate-400 uppercase tracking-wider font-medium mb-1">
            Final Questions
          </div>
          <h2 className="text-xl font-bold text-slate-800">Almost done!</h2>
          <p className="text-sm text-slate-500 mt-1">Please answer a few final questions about your experience.</p>
        </div>

        <LikertScale
          label="How often did you use a specific strategy to remember the tasks you needed to do?"
          value={mse}
          onChange={setMse}
          labels={MSE_LABELS}
        />

        <LikertScale
          label="How often did you find yourself remembering a task without any external help?"
          value={strategyUse}
          onChange={setStrategyUse}
          labels={MSE_LABELS}
        />

        <div className="mb-5">
          <p className="text-sm font-medium text-slate-700 mb-2">
            Any other thoughts or feedback about the experiment? (optional)
          </p>
          <textarea
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            rows={3}
            placeholder="Type your thoughts here…"
            className="w-full border-2 border-slate-200 rounded-lg p-3 text-sm focus:border-blue-400 focus:outline-none resize-none"
          />
        </div>

        <button
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white font-semibold rounded-lg transition-colors"
        >
          Submit & Finish
        </button>
      </motion.div>
    </div>
  )
}
