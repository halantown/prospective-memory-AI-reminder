import { useState } from 'react'
import { useGameStore } from '../../store/gameStore'
import { fetchBlockConfig, reportQuestionnaire } from '../../utils/api'

export default function BlockEndScreen() {
  const sessionId = useGameStore((s) => s.sessionId)
  const blockNumber = useGameStore((s) => s.blockNumber)
  const totalBlocks = useGameStore((s) => s.totalBlocks)
  const questionnaire = useGameStore((s) => s.questionnaire)
  const setQuestionnaireField = useGameStore((s) => s.setQuestionnaireField)
  const startBlockEncoding = useGameStore((s) => s.startBlockEncoding)
  const setPhase = useGameStore((s) => s.setPhase)

  const isLast = blockNumber >= totalBlocks
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  const submitAndContinue = async () => {
    if (!sessionId) return
    setSubmitting(true)
    setError(null)

    try {
      await reportQuestionnaire(sessionId, {
        block_number: blockNumber,
        intrusiveness: questionnaire.intrusiveness,
        helpfulness: questionnaire.helpfulness,
        ongoing_interaction_count: questionnaire.ongoingInteractionCount,
        comment: questionnaire.comment,
      })

      if (isLast) {
        setPhase('session_complete')
      } else {
        const nextBlock = blockNumber + 1
        const nextConfig = await fetchBlockConfig(sessionId, nextBlock)
        startBlockEncoding(nextConfig)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow-xl w-[560px] overflow-hidden">
        <div className="bg-gradient-to-r from-emerald-500 to-teal-500 px-8 py-6 text-white">
          <h1 className="text-2xl font-bold">Block {blockNumber} complete</h1>
          <p className="text-emerald-100 text-sm mt-1">Please answer two quick items before continuing.</p>
        </div>

        <div className="px-8 py-7 space-y-5">
          <label className="block">
            <span className="text-sm font-semibold text-slate-700">How intrusive were the reminders? (1-7)</span>
            <input
              type="range"
              min="1"
              max="7"
              value={questionnaire.intrusiveness}
              onChange={(e) => setQuestionnaireField('intrusiveness', Number(e.target.value))}
              className="w-full mt-2"
            />
            <span className="text-xs text-slate-500">Selected: {questionnaire.intrusiveness}</span>
          </label>

          <label className="block">
            <span className="text-sm font-semibold text-slate-700">How helpful were the reminders? (1-7)</span>
            <input
              type="range"
              min="1"
              max="7"
              value={questionnaire.helpfulness}
              onChange={(e) => setQuestionnaireField('helpfulness', Number(e.target.value))}
              className="w-full mt-2"
            />
            <span className="text-xs text-slate-500">Selected: {questionnaire.helpfulness}</span>
          </label>

          <label className="block">
            <span className="text-sm font-semibold text-slate-700">Optional comment</span>
            <textarea
              value={questionnaire.comment}
              onChange={(e) => setQuestionnaireField('comment', e.target.value)}
              rows={3}
              className="w-full mt-2 border border-slate-300 rounded-xl px-3 py-2 text-sm"
              placeholder="Anything notable about this block?"
            />
          </label>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            onClick={submitAndContinue}
            disabled={submitting}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl disabled:bg-slate-300"
          >
            {submitting
              ? 'Submitting…'
              : isLast
                ? 'Finish session'
                : `Continue to block ${blockNumber + 1}`}
          </button>
        </div>
      </div>
    </div>
  )
}
