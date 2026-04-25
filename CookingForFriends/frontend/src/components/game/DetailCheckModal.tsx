/** DetailCheckModal — multiple-choice question modal with correct/incorrect feedback. */

import { useState } from 'react'

interface DetailCheckModalProps {
  question: string
  options: string[]
  correctIndex: number
  onComplete: (correct: boolean, selectedIndex: number) => void
}

export default function DetailCheckModal({ question, options, correctIndex, onComplete }: DetailCheckModalProps) {
  const [selected, setSelected] = useState<number | null>(null)
  const [submitted, setSubmitted] = useState(false)

  const isCorrect = selected === correctIndex

  const handleSelect = (idx: number) => {
    if (submitted) return
    setSelected(idx)
  }

  const handleSubmit = () => {
    if (selected === null || submitted) return
    setSubmitted(true)
  }

  const handleContinue = () => {
    if (selected === null) return
    onComplete(isCorrect, selected)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-6">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-8">
        <div className="text-3xl mb-4 text-center">🧐</div>
        <h2 className="text-lg font-bold text-slate-800 mb-6 text-center">
          Detail Check
        </h2>

        <p className="text-slate-700 mb-5 font-medium">{question}</p>

        <div className="space-y-2 mb-6">
          {options.map((opt, idx) => {
            let cls = 'w-full text-left px-4 py-3 rounded-xl border-2 transition-all text-sm font-medium '
            if (!submitted) {
              cls += selected === idx
                ? 'border-blue-500 bg-blue-50 text-blue-800'
                : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-400 hover:bg-slate-100'
            } else {
              if (idx === correctIndex) {
                cls += 'border-green-500 bg-green-50 text-green-800'
              } else if (idx === selected && idx !== correctIndex) {
                cls += 'border-red-400 bg-red-50 text-red-700'
              } else {
                cls += 'border-slate-200 bg-slate-50 text-slate-400'
              }
            }
            return (
              <button key={idx} className={cls} onClick={() => handleSelect(idx)}>
                <span className="inline-block w-6 text-center font-bold mr-2">
                  {String.fromCharCode(65 + idx)}.
                </span>
                {opt}
              </button>
            )
          })}
        </div>

        {submitted && (
          <div className={`mb-4 p-3 rounded-xl text-sm font-medium ${
            isCorrect ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
          }`}>
            {isCorrect ? '✓ Correct!' : `✗ The correct answer was: ${options[correctIndex]}`}
          </div>
        )}

        {!submitted ? (
          <button
            onClick={handleSubmit}
            disabled={selected === null}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200
                       disabled:text-slate-400 text-white font-semibold rounded-xl transition-colors"
          >
            Submit Answer
          </button>
        ) : (
          <button
            onClick={handleContinue}
            className="w-full py-3 bg-slate-800 hover:bg-slate-900 text-white
                       font-semibold rounded-xl transition-colors"
          >
            Continue →
          </button>
        )}
      </div>
    </div>
  )
}
