import { useState } from 'react'
import { motion } from 'framer-motion'
import { useGameStore } from '../../store/gameStore'

const SCALE_LABELS = ['1 — Not at all', '2', '3', '4 — Moderate', '5', '6', '7 — Very much']

function LikertScale({ label, value, onChange }) {
  return (
    <div className="mb-6">
      <p className="text-base font-medium text-slate-700 mb-3">{label}</p>
      <div className="flex gap-2 flex-wrap">
        {SCALE_LABELS.map((text, i) => {
          const val = i + 1
          return (
            <button
              key={val}
              onClick={() => onChange(val)}
              className={`
                flex-1 min-w-[4rem] py-2 rounded-lg border-2 text-sm font-medium transition-colors
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

export default function QuestionnaireScreen({ embedded = false }) {
  const submitQuestionnaire = useGameStore(s => s.submitQuestionnaire)
  const blockNumber = useGameStore(s => s.blockNumber)
  const [intrusiveness, setIntrusiveness] = useState(null)
  const [helpfulness, setHelpfulness] = useState(null)

  const canSubmit = intrusiveness !== null && helpfulness !== null

  const handleSubmit = () => {
    if (!canSubmit) return
    submitQuestionnaire({
      intrusiveness,
      helpfulness,
      submitted_at: Date.now(),
    })
  }

  const wrapperClass = embedded
    ? 'h-full flex items-center justify-center p-4 overflow-auto'
    : 'min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-4'

  return (
    <div className={wrapperClass}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-xl w-full bg-white rounded-xl shadow-lg p-8"
      >
        <div className="text-center mb-6">
          <div className="text-xs text-slate-400 uppercase tracking-wider font-medium mb-1">
            Block {blockNumber} — Quick Questions
          </div>
          <h2 className="text-xl font-bold text-slate-800">How was that block?</h2>
        </div>

        <LikertScale
          label="How intrusive did you find the robot's comments?"
          value={intrusiveness}
          onChange={setIntrusiveness}
        />

        <LikertScale
          label="How helpful did you find the robot's comments for remembering your tasks?"
          value={helpfulness}
          onChange={setHelpfulness}
        />

        <button
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white font-semibold rounded-lg transition-colors mt-2"
        >
          Submit
        </button>
      </motion.div>
    </div>
  )
}
