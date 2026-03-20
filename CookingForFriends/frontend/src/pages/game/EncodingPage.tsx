/** Encoding page — display PM task cards + structured MC quiz before each block.
 *
 * Flow per task card:
 *   1. Show encoding card (trigger, room, target, action)
 *   2. Quiz: 3 MC questions (trigger, target, action)
 *   3. Wrong answer → re-show card → re-quiz that question
 *   4. After 2 failures on same Q → forced re-display with emphasis
 *   5. All correct → next card (or start game)
 */

import { useState, useEffect, useRef } from 'react'
import { useGameStore } from '../../stores/gameStore'
import { getBlockEncoding, submitQuiz } from '../../services/api'
import type { PMEncodingCard } from '../../types'

// ── Quiz option generation ──

const TRIGGER_OPTIONS = [
  { value: 'doorbell', label: 'The doorbell rings' },
  { value: 'email_dentist', label: 'You receive a dentist email' },
  { value: 'washing_done', label: 'The washing machine beeps' },
  { value: 'clock_6pm', label: 'The clock reaches 6:00 PM' },
  { value: 'knock', label: 'Someone knocks on the door' },
  { value: 'phone_message', label: 'A phone message arrives' },
  { value: 'plant_reminder', label: 'A plant watering reminder sounds' },
  { value: 'tv_on', label: 'The TV turns on' },
]

const TARGET_OPTIONS = [
  { value: 'red_book', label: 'A red book with mountain illustration' },
  { value: 'blue_book', label: 'A blue book with ocean illustration' },
  { value: 'calendar', label: 'A wall calendar with blue label' },
  { value: 'notebook', label: 'A spiral notebook' },
  { value: 'black_sweater', label: 'A black wool sweater' },
  { value: 'gray_sweater', label: 'A gray cotton sweater' },
  { value: 'red_medicine_bottle', label: 'A red medicine bottle' },
  { value: 'orange_vitamin_bottle', label: 'An orange vitamin bottle' },
]

const ACTION_OPTIONS = [
  { value: 'give_to_friend', label: 'Give it to the friend' },
  { value: 'mark_appointment', label: 'Mark the appointment' },
  { value: 'hang_to_dry', label: 'Hang it to dry' },
  { value: 'take_medicine', label: 'Take one tablet' },
  { value: 'put_on_shelf', label: 'Put it on the shelf' },
  { value: 'throw_away', label: 'Throw it away' },
]

// Trigger event → correct option value mapping
const TRIGGER_EVENT_MAP: Record<string, string> = {
  'When the doorbell rings (a friend arrives)': 'doorbell',
  'When you receive a dentist confirmation email': 'email_dentist',
  'When the washing machine beeps (laundry done)': 'washing_done',
  'When the game clock reaches 6:00 PM': 'clock_6pm',
}

interface QuizState {
  questionType: 'trigger' | 'target' | 'action'
  selected: string | null
  startTime: number
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
  const [quiz, setQuiz] = useState<QuizState>({
    questionType: 'trigger',
    selected: null,
    startTime: Date.now(),
  })
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null)
  const [attempts, setAttempts] = useState<Record<string, number>>({})
  const [reShowCard, setReShowCard] = useState(false)
  const [emphasize, setEmphasize] = useState(false)
  // Track which question types have been passed for the current card
  const [passedQuestions, setPassedQuestions] = useState<Set<string>>(new Set())

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

  // Build quiz options for current question type
  const getOptions = (type: string) => {
    if (type === 'trigger') return TRIGGER_OPTIONS
    if (type === 'target') return TARGET_OPTIONS
    return ACTION_OPTIONS
  }

  const getQuestionText = (type: string) => {
    if (type === 'trigger') return 'What event should trigger this task?'
    if (type === 'target') return 'What item do you need to find?'
    return 'What action should you perform?'
  }

  const getAttemptKey = (trialNum: number, qType: string) => `${trialNum}_${qType}`

  const handleSelectOption = (value: string) => {
    if (feedback) return // Prevent double-click during feedback
    setQuiz((q) => ({ ...q, selected: value }))
  }

  const handleConfirmAnswer = async () => {
    if (!quiz.selected || !card || !sessionId) return

    const elapsed = Date.now() - quiz.startTime
    const key = getAttemptKey(card.trial_number, quiz.questionType)

    try {
      const resp = await submitQuiz(sessionId, blockNumber, [{
        trial_number: card.trial_number,
        question_type: quiz.questionType,
        selected_answer: quiz.selected,
        response_time_ms: elapsed,
      }])

      const result = resp.results[0]
      if (result?.is_correct) {
        setFeedback('correct')
        const newPassed = new Set(passedQuestions)
        newPassed.add(quiz.questionType)

        setTimeout(() => {
          setFeedback(null)
          setPassedQuestions(newPassed)

          // Determine next question
          const qOrder: Array<'trigger' | 'target' | 'action'> = ['trigger', 'target', 'action']
          const nextQ = qOrder.find((q) => !newPassed.has(q))

          if (nextQ) {
            // More questions for this card
            setQuiz({ questionType: nextQ, selected: null, startTime: Date.now() })
          } else {
            // All questions passed — move to next card
            setQuizMode(false)
            setPassedQuestions(new Set())
            setEmphasize(false)

            if (currentCard < cards.length - 1) {
              setCurrentCard(currentCard + 1)
            } else {
              setPhase('playing')
            }
          }
        }, 800)
      } else {
        setFeedback('wrong')
        const newAttempts = { ...attempts, [key]: (attempts[key] || 0) + 1 }
        setAttempts(newAttempts)

        setTimeout(() => {
          setFeedback(null)

          if (newAttempts[key] >= 2) {
            // 2+ failures — force re-show with emphasis
            setReShowCard(true)
            setEmphasize(true)
            setQuizMode(false)
          } else {
            // First failure — re-show card normally
            setReShowCard(true)
            setQuizMode(false)
          }
          setQuiz((q) => ({ ...q, selected: null }))
        }, 1200)
      }
    } catch (err) {
      console.error('Quiz submit error:', err)
    }
  }

  const handleStartQuiz = () => {
    const qOrder: Array<'trigger' | 'target' | 'action'> = ['trigger', 'target', 'action']
    const nextQ = qOrder.find((q) => !passedQuestions.has(q)) || 'trigger'
    setQuizMode(true)
    setReShowCard(false)
    setQuiz({ questionType: nextQ, selected: null, startTime: Date.now() })
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
                {reShowCard ? 'I\'ve reviewed it — Test me again' : 'I remember — Test me'}
              </button>
            </>
          ) : (
            <>
              {/* MC Quiz */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-semibold text-slate-800">Quick Check</h3>
                  <div className="flex gap-1">
                    {(['trigger', 'target', 'action'] as const).map((q) => (
                      <div
                        key={q}
                        className={`w-2 h-2 rounded-full ${
                          passedQuestions.has(q) ? 'bg-green-400' :
                          q === quiz.questionType ? 'bg-blue-500' : 'bg-slate-200'
                        }`}
                      />
                    ))}
                  </div>
                </div>

                <p className="text-slate-600 font-medium">
                  {getQuestionText(quiz.questionType)}
                </p>

                <div className="space-y-2">
                  {getOptions(quiz.questionType).map((opt) => {
                    const isSelected = quiz.selected === opt.value
                    const showCorrect = feedback === 'wrong' && !isSelected
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
                  disabled={!quiz.selected}
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
