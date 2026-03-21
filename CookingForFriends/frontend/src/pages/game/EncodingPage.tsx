/** Encoding page — display PM task cards + single MC quiz before each block.
 *
 * Flow per task card:
 *   1. Show encoding card (trigger, room, target, action)
 *   2. Quiz: 1 MC question — "What event should trigger this task?"
 *      Options = the 4 triggers from this block (mutual distractors)
 *   3. Wrong answer → re-show card → re-quiz
 *   4. After 2 failures → forced re-display with emphasis, then auto-pass
 *   5. Correct → next card (or start game)
 */

import { useState, useEffect } from 'react'
import { useGameStore } from '../../stores/gameStore'
import { getBlockEncoding, submitQuiz } from '../../services/api'
import type { PMEncodingCard } from '../../types'

// ── Trigger event value lookup ──

const TRIGGER_EVENT_MAP: Record<string, string> = {
  'When the doorbell rings (a friend arrives)': 'doorbell',
  'When you receive a dentist confirmation email': 'email_dentist',
  'When the washing machine beeps (laundry done)': 'washing_done',
  'When the game clock reaches 6:00 PM': 'clock_6pm',
  'When someone knocks on the door': 'knock',
  'When a phone message arrives': 'phone_message',
  'When a plant watering reminder sounds': 'plant_reminder',
  'When the TV turns on': 'tv_on',
}

export default function EncodingPage() {
  const sessionId = useGameStore((s) => s.sessionId)
  const blockNumber = useGameStore((s) => s.blockNumber)
  const setPhase = useGameStore((s) => s.setPhase)
  const resetBlock = useGameStore((s) => s.resetBlock)

  const [cards, setCards] = useState<PMEncodingCard[]>([])
  const [dayStory, setDayStory] = useState('')
  const [currentCard, setCurrentCard] = useState(0)
  const [loading, setLoading] = useState(true)

  // Quiz state
  const [quizMode, setQuizMode] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)
  const [quizStartTime, setQuizStartTime] = useState(Date.now())
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null)
  const [failCount, setFailCount] = useState(0)
  const [reShowCard, setReShowCard] = useState(false)
  const [emphasize, setEmphasize] = useState(false)

  useEffect(() => {
    if (!sessionId) return
    resetBlock()
    setLoading(true)

    getBlockEncoding(sessionId, blockNumber)
      .then((data) => {
        setDayStory(data.day_story)
        setCards(data.pm_tasks)
        setLoading(false)
      })
      .catch((err) => {
        console.error('Failed to load encoding:', err)
        setLoading(false)
      })
  }, [sessionId, blockNumber, resetBlock])

  const card = cards[currentCard]

  // Build 4 trigger options from this block's tasks (shuffled deterministically)
  const getTriggerOptions = () => {
    if (cards.length === 0) return []
    const opts = cards.map(c => ({
      value: TRIGGER_EVENT_MAP[c.trigger_description] || c.trigger_description,
      label: c.trigger_description,
    }))
    // Deterministic shuffle seeded by current card's trial number
    const shuffled = [...opts]
    let seed = (card?.trial_number ?? 0) * 7 + 42
    for (let i = shuffled.length - 1; i > 0; i--) {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff
      const j = seed % (i + 1);
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
    }
    return shuffled
  }

  const handleSelectOption = (value: string) => {
    if (feedback) return
    setSelected(value)
  }

  const advanceToNextCard = () => {
    setQuizMode(false)
    setReShowCard(false)
    setEmphasize(false)
    setFailCount(0)
    setSelected(null)

    if (currentCard < cards.length - 1) {
      setCurrentCard(currentCard + 1)
    } else {
      setPhase('playing')
    }
  }

  const handleConfirmAnswer = async () => {
    if (!selected || !card || !sessionId) return

    const elapsed = Date.now() - quizStartTime

    try {
      const resp = await submitQuiz(sessionId, blockNumber, [{
        trial_number: card.trial_number,
        question_type: 'trigger',
        selected_answer: selected,
        response_time_ms: elapsed,
      }])

      const result = resp.results[0]
      if (result?.is_correct) {
        setFeedback('correct')
        setTimeout(() => {
          setFeedback(null)
          advanceToNextCard()
        }, 800)
      } else {
        setFeedback('wrong')
        const newFails = failCount + 1
        setFailCount(newFails)

        setTimeout(() => {
          setFeedback(null)
          setSelected(null)

          if (newFails >= 2) {
            // 2+ failures → force re-show with emphasis, then auto-pass
            setReShowCard(true)
            setEmphasize(true)
            setQuizMode(false)
          } else {
            // First failure → re-show card normally
            setReShowCard(true)
            setQuizMode(false)
          }
        }, 1200)
      }
    } catch (err) {
      console.error('Quiz submit error:', err)
    }
  }

  const handleStartQuiz = () => {
    // After 2 failures + re-show, auto-advance
    if (emphasize && reShowCard) {
      advanceToNextCard()
      return
    }
    setQuizMode(true)
    setReShowCard(false)
    setSelected(null)
    setQuizStartTime(Date.now())
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-slate-400 text-lg">Loading task cards...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex flex-col items-center justify-center p-6">
      {/* Day story header */}
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-bold text-slate-800">Block {blockNumber}</h1>
        <p className="text-slate-600 mt-1">{dayStory}</p>
        <p className="text-sm text-slate-400 mt-2">
          Please remember the following tasks. You will need to do them during the game.
        </p>
      </div>

      {/* Progress dots */}
      <div className="flex gap-2 mb-4">
        {cards.map((_, i) => (
          <div
            key={i}
            className={`w-3 h-3 rounded-full ${
              i < currentCard ? 'bg-green-400' :
              i === currentCard ? 'bg-blue-500' : 'bg-slate-200'
            }`}
          />
        ))}
      </div>

      {/* Card + Quiz area */}
      {card && (
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-blue-600 bg-blue-50 px-3 py-1 rounded-full">
              Task {currentCard + 1} of {cards.length}
            </span>
            {emphasize && (
              <span className="text-xs font-medium text-red-500 bg-red-50 px-2 py-1 rounded-full">
                ⚠ Please read carefully
              </span>
            )}
          </div>

          {!quizMode ? (
            <>
              {/* Encoding card display */}
              <div className={`space-y-3 ${emphasize ? 'ring-2 ring-red-300 rounded-xl p-2' : ''}`}>
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                  <p className="text-sm font-medium text-amber-800 mb-1">When this happens:</p>
                  <p className="text-amber-900 font-semibold">{card.trigger_description}</p>
                </div>

                <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                  <p className="text-sm font-medium text-green-800 mb-1">Go to:</p>
                  <p className="text-green-900 font-semibold">{card.target_room}</p>
                </div>

                <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
                  <p className="text-sm font-medium text-purple-800 mb-1">Find this item:</p>
                  <p className="text-purple-900 font-semibold">{card.target_description}</p>
                  {card.visual_cues && Object.keys(card.visual_cues).length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {Object.entries(card.visual_cues).map(([key, val]) => (
                        <span key={key} className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded">
                          {key}: {val}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                  <p className="text-sm font-medium text-blue-800 mb-1">Do this:</p>
                  <p className="text-blue-900 font-semibold">{card.action_description}</p>
                </div>
              </div>

              <button
                onClick={handleStartQuiz}
                className="w-full py-3 bg-blue-500 hover:bg-blue-600
                           text-white font-bold rounded-xl transition-colors"
              >
                {emphasize ? 'I understand — Continue'
                  : reShowCard ? 'I\'ve reviewed it — Test me again'
                  : 'I remember — Test me'}
              </button>
            </>
          ) : (
            <>
              {/* Single MC Quiz — trigger identification */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-slate-800">Quick Check</h3>
                <p className="text-slate-600 font-medium">
                  What event should trigger this task?
                </p>

                <div className="space-y-2">
                  {getTriggerOptions().map((opt) => {
                    const isSelected = selected === opt.value
                    const showWrong = feedback === 'wrong' && isSelected
                    const showSuccess = feedback === 'correct' && isSelected

                    return (
                      <button
                        key={opt.value}
                        onClick={() => handleSelectOption(opt.value)}
                        disabled={!!feedback}
                        className={`w-full text-left px-4 py-3 rounded-xl border transition-all
                          ${showSuccess ? 'bg-green-100 border-green-400 text-green-800' :
                            showWrong ? 'bg-red-100 border-red-400 text-red-800' :
                            isSelected ? 'bg-blue-100 border-blue-400 text-blue-800' :
                            'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                          }
                          ${feedback ? 'cursor-default' : 'cursor-pointer'}
                        `}
                      >
                        {opt.label}
                      </button>
                    )
                  })}
                </div>

                {feedback === 'wrong' && (
                  <p className="text-red-600 text-sm font-medium">
                    ✗ Incorrect. Let's review the task card again.
                  </p>
                )}
                {feedback === 'correct' && (
                  <p className="text-green-600 text-sm font-medium">
                    ✓ Correct!
                  </p>
                )}
              </div>

              {!feedback && (
                <button
                  onClick={handleConfirmAnswer}
                  disabled={!selected}
                  className="w-full py-3 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-200
                             text-white font-bold rounded-xl transition-colors"
                >
                  Confirm
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
