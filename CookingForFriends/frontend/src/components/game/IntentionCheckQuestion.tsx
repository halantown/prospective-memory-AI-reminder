/** IntentionCheckQuestion — MC question for encoding intention check (no gate on wrong). */

import { useState } from 'react'

interface IntentionCheckQuestionProps {
  taskId: string
  data: { question: string; options: string[]; correctIndex: number }
  position: number
  onComplete: (selectedIndex: number) => void
  /** Override the outer wrapper class. Defaults to full-screen gradient layout. */
  className?: string
}

export default function IntentionCheckQuestion({ taskId, data, position, onComplete, className }: IntentionCheckQuestionProps) {
  const [selected, setSelected] = useState<number | null>(null)

  const handleConfirm = () => {
    if (selected === null) return
    onComplete(selected)
  }

  return (
    <div className={className ?? 'min-h-screen bg-slate-950 flex items-center justify-center p-6'}>
      <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full p-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="text-3xl">🤔</div>
            <div>
              <p className="text-xs font-semibold text-sky-600 uppercase tracking-wider">
                Intention Check — Task {taskId}
              </p>
              <p className="text-sm text-slate-500">
                {position} / 4
              </p>
            </div>
          </div>
          <div className="flex gap-1">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className={`w-2 h-2 rounded-full ${i < position ? 'bg-sky-500' : 'bg-slate-200'}`}
              />
            ))}
          </div>
        </div>

        <p className="text-slate-800 font-semibold text-base mb-5">{data.question}</p>

        <div className="space-y-2 mb-8">
          {data.options.map((opt, idx) => {
            const cls =
              'w-full text-left px-4 py-3 rounded-xl border-2 transition-all text-sm font-medium ' +
              (selected === idx
                ? 'border-sky-500 bg-sky-50 text-sky-800'
                : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-400 hover:bg-slate-100')
            return (
              <button key={idx} className={cls} onClick={() => setSelected(idx)}>
                <span className="inline-block w-6 text-center font-bold mr-2">
                  {String.fromCharCode(65 + idx)}.
                </span>
                {opt}
              </button>
            )
          })}
        </div>

        <button
          onClick={handleConfirm}
          disabled={selected === null}
          className="w-full py-3 bg-sky-600 hover:bg-sky-700 disabled:bg-slate-200
                     disabled:text-slate-400 text-white font-semibold rounded-xl transition-colors text-base"
        >
          Confirm →
        </button>
      </div>
    </div>
  )
}
