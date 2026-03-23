/** Encoding page — display PM task cards + multi-question quiz before each block.
 *
 * Flow per task card:
 *   1. Show encoding card (story paragraph + trigger, room, target, action boxes)
 *   2. 10-second read timer before the "I've memorized this" button enables
 *   3. Quiz: 3 sequential MC questions — trigger, target object, action
 *   4. Wrong answer → re-show card with highlighted section → re-quiz same question
 *   5. After 2 consecutive failures on same question → auto-pass with "Let's move on"
 *   6. After all cards quizzed → completion summary → start game
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { useGameStore } from '../../stores/gameStore'
import { getBlockEncoding, submitEncodingQuiz } from '../../services/api'
import type { PMEncodingCard } from '../../types'

type QuestionType = 'trigger' | 'target' | 'action'

const QUESTION_TYPES: QuestionType[] = ['trigger']

/** Deterministic shuffle seeded by a number. */
function seededShuffle<T>(arr: T[], seed: number): T[] {
  const shuffled = [...arr]
  let s = seed
  for (let i = shuffled.length - 1; i > 0; i--) {
    s = (s * 1103515245 + 12345) & 0x7fffffff
    const j = s % (i + 1);
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

export default function EncodingPage() {
  const sessionId = useGameStore((s) => s.sessionId)
  const blockNumber = useGameStore((s) => s.blockNumber)
  const setPhase = useGameStore((s) => s.setPhase)
  const resetBlock = useGameStore((s) => s.resetBlock)
  const wsSend = useGameStore((s) => s.wsSend)

  const [cards, setCards] = useState<PMEncodingCard[]>([])
  const [dayStory, setDayStory] = useState('')
  const [currentCardIndex, setCurrentCardIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Read timer
  const [readCountdown, setReadCountdown] = useState(10)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Quiz state
  const [quizMode, setQuizMode] = useState(false)
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [selected, setSelected] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null)
  const [quizStartTime, setQuizStartTime] = useState(0)
  const [failCount, setFailCount] = useState(0)
  const [attemptNumber, setAttemptNumber] = useState(1)
  const [autoPassMessage, setAutoPassMessage] = useState(false)

  // Re-show state
  const [reShowCard, setReShowCard] = useState(false)
  const [highlightSection, setHighlightSection] = useState<QuestionType | null>(null)

  // Completion
  const [allDone, setAllDone] = useState(false)

  // ── Read timer helpers ──

  const clearReadTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const startReadTimer = useCallback(() => {
    setReadCountdown(10)
    clearReadTimer()
    timerRef.current = setInterval(() => {
      setReadCountdown((prev) => {
        if (prev <= 1) {
          clearReadTimer()
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }, [clearReadTimer])

  useEffect(() => clearReadTimer, [clearReadTimer])

  // ── Load encoding data ──

  useEffect(() => {
    if (!sessionId) return
    resetBlock()
    setLoading(true)

    getBlockEncoding(sessionId, blockNumber)
      .then((data) => {
        setDayStory(data.day_story)
        setCards(data.cards)
        setLoading(false)
        startReadTimer()
      })
      .catch((err) => {
        console.error('Failed to load encoding:', err)
        setError(err.message || 'Failed to load task cards')
        setLoading(false)
      })
  }, [sessionId, blockNumber, resetBlock, startReadTimer])

  // ── Derived values ──

  const card = cards[currentCardIndex]
  const ec = card?.encoding_card

  // ── Quiz question builder ──

  const getQuestionData = useCallback(
    (qIndex: number) => {
      if (!card || !ec) return { question: '', options: [] as string[], correct: '' }

      const seed = (card.trial_number * 7 + 42) + qIndex * 13

      if (qIndex === 0) {
        const allTriggers = cards.map((c) => c.encoding_card.trigger_description)
        return {
          question: 'What event should trigger this task?',
          options: seededShuffle(allTriggers, seed),
          correct: ec.trigger_description,
        }
      } else if (qIndex === 1) {
        return {
          question: ec.quiz_question,
          options: [...ec.quiz_options],
          correct: ec.quiz_options[ec.quiz_correct_index],
        }
      } else {
        const allActions = cards.map((c) => c.encoding_card.action_description)
        return {
          question: 'What should you do with the item?',
          options: seededShuffle(allActions, seed),
          correct: ec.action_description,
        }
      }
    },
    [card, ec, cards],
  )

  // ── Quiz attempt logging (fire-and-forget) ──

  const logQuizAttempt = useCallback(
    (
      qType: QuestionType,
      attempt: number,
      selectedAnswer: string,
      correctAnswer: string,
      isCorrect: boolean,
      responseTimeMs: number,
    ) => {
      if (!sessionId || !card) return
      submitEncodingQuiz(sessionId, blockNumber, {
        trial_number: card.trial_number,
        question_type: qType,
        attempt_number: attempt,
        selected_answer: selectedAnswer,
        correct_answer: correctAnswer,
        is_correct: isCorrect,
        response_time_ms: responseTimeMs,
      }).catch(() => {
        // Non-critical — endpoint may not exist yet
      })
    },
    [sessionId, blockNumber, card],
  )

  // ── Navigation helpers ──

  const advanceToNextCard = useCallback(() => {
    setQuizMode(false)
    setReShowCard(false)
    setHighlightSection(null)
    setFailCount(0)
    setAttemptNumber(1)
    setCurrentQuestionIndex(0)
    setSelected(null)
    setFeedback(null)
    setAutoPassMessage(false)

    if (currentCardIndex < cards.length - 1) {
      setCurrentCardIndex(currentCardIndex + 1)
      startReadTimer()
    } else {
      setAllDone(true)
    }
  }, [currentCardIndex, cards.length, startReadTimer])

  const advanceQuestion = useCallback(() => {
    setAutoPassMessage(false)
    setFailCount(0)
    setReShowCard(false)
    setHighlightSection(null)
    // Single question per card — always advance to next card
    advanceToNextCard()
  }, [advanceToNextCard])

  // ── Event handlers ──

  const handleMemorized = () => {
    if (readCountdown > 0) return
    setQuizMode(true)
    setCurrentQuestionIndex(0)
    setSelected(null)
    setFeedback(null)
    setFailCount(0)
    setAttemptNumber(1)
    setQuizStartTime(Date.now())
    setHighlightSection(null)
    setReShowCard(false)
  }

  const handleReReadDone = () => {
    if (readCountdown > 0) return
    if (failCount >= 2) {
      advanceQuestion()
      return
    }
    setReShowCard(false)
    setHighlightSection(null)
    setQuizMode(true)
    setSelected(null)
    setFeedback(null)
    setQuizStartTime(Date.now())
  }

  const handleSelectOption = (value: string) => {
    if (feedback) return
    setSelected(value)
  }

  const handleConfirmAnswer = () => {
    if (!selected || !card || !sessionId) return

    const elapsed = Date.now() - quizStartTime
    const qData = getQuestionData(currentQuestionIndex)
    const qType = QUESTION_TYPES[currentQuestionIndex]
    const isCorrect = selected === qData.correct

    logQuizAttempt(qType, attemptNumber, selected, qData.correct, isCorrect, elapsed)

    if (isCorrect) {
      setFeedback('correct')
      setTimeout(() => {
        setFeedback(null)
        advanceQuestion()
      }, 800)
    } else {
      setFeedback('wrong')
      const newFails = failCount + 1
      setFailCount(newFails)
      setAttemptNumber((a) => a + 1)

      setTimeout(() => {
        setFeedback(null)
        setSelected(null)

        if (newFails >= 2) {
          setAutoPassMessage(true)
          setTimeout(() => advanceQuestion(), 1500)
        } else {
          setReShowCard(true)
          setHighlightSection(qType)
          setQuizMode(false)
          startReadTimer()
        }
      }, 1000)
    }
  }

  const handleStartGame = () => {
    if (wsSend) {
      wsSend({ type: 'start_game', data: { block_number: blockNumber } })
    }
    setPhase('playing')
  }

  // ── Render: loading ──

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-slate-400 text-lg">Loading task cards...</div>
      </div>
    )
  }

  // ── Render: error ──

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow-xl p-6 text-center space-y-4">
          <p className="text-red-600 font-medium">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
          >
            Reload
          </button>
        </div>
      </div>
    )
  }

  // ── Render: no cards ──

  if (!cards.length || !card || !ec) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow-xl p-6 text-center space-y-4">
          <p className="text-slate-600">No task cards available. Please refresh.</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
          >
            Reload
          </button>
        </div>
      </div>
    )
  }

  // ── Render: completion summary ──

  if (allDone) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex flex-col items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-8 space-y-6">
          <div className="text-center">
            <div className="text-4xl mb-3">🎉</div>
            <h2 className="text-2xl font-bold text-slate-800">
              You've learned all {cards.length} tasks for this block!
            </h2>
            <p className="text-slate-500 mt-2">Here's a quick summary:</p>
          </div>

          <div className="space-y-3">
            {cards.map((c, i) => (
              <div key={i} className="bg-slate-50 rounded-xl p-3 flex items-start gap-3">
                <span className="text-sm font-bold text-blue-500 shrink-0">{i + 1}.</span>
                <p className="text-sm text-slate-700">
                  <span className="font-medium text-amber-700">
                    {c.encoding_card.trigger_description}
                  </span>
                  {' → '}
                  <span className="font-medium text-blue-700">
                    {c.encoding_card.action_description}
                  </span>
                </p>
              </div>
            ))}
          </div>

          <button
            onClick={handleStartGame}
            className="w-full py-4 bg-green-500 hover:bg-green-600
                       text-white text-lg font-bold rounded-xl transition-colors"
          >
            🍳 Ready to start cooking!
          </button>
        </div>
      </div>
    )
  }

  // ── Render: auto-pass message ──

  if (autoPassMessage) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-xl p-8 text-center space-y-3">
          <div className="text-3xl">💪</div>
          <p className="text-lg font-medium text-slate-700">Let's move on</p>
          <p className="text-sm text-slate-400">Don't worry — you'll do great!</p>
        </div>
      </div>
    )
  }

  // ── Render: card + quiz ──

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex flex-col items-center justify-center p-6">
      {/* Header */}
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
              i < currentCardIndex
                ? 'bg-green-400'
                : i === currentCardIndex
                  ? 'bg-blue-500'
                  : 'bg-slate-200'
            }`}
          />
        ))}
      </div>

      {/* Card + Quiz area */}
      {card && ec && (
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-blue-600 bg-blue-50 px-3 py-1 rounded-full">
              Task {currentCardIndex + 1} of {cards.length}
            </span>
            {highlightSection && (
              <span className="text-xs font-medium text-amber-600 bg-amber-50 px-2 py-1 rounded-full">
                ⚠ Pay attention to the highlighted section
              </span>
            )}
          </div>

          {!quizMode ? (
            <>
              {/* Encoding story paragraph */}
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                <p className="text-slate-700 leading-relaxed text-[15px] text-left">
                  {ec.encoding_text}
                </p>
              </div>

              {/* Info boxes */}
              <div className="space-y-3">
                {/* Trigger */}
                <div
                  className={`rounded-xl p-4 border transition-all ${
                    highlightSection === 'trigger'
                      ? 'bg-amber-100 border-amber-400 ring-2 ring-amber-300'
                      : 'bg-amber-50 border-amber-200'
                  }`}
                >
                  <p className="text-sm font-medium text-amber-800 mb-1">🔔 When this happens:</p>
                  <p className="text-amber-900 font-semibold">{ec.trigger_description}</p>
                </div>

                {/* Target room */}
                <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                  <p className="text-sm font-medium text-green-800 mb-1">📍 Go to:</p>
                  <p className="text-green-900 font-semibold">{ec.target_room}</p>
                </div>

                {/* Target item + visual cues */}
                <div
                  className={`rounded-xl p-4 border transition-all ${
                    highlightSection === 'target'
                      ? 'bg-purple-100 border-purple-400 ring-2 ring-purple-300'
                      : 'bg-purple-50 border-purple-200'
                  }`}
                >
                  <p className="text-sm font-medium text-purple-800 mb-1">🔍 Find this item:</p>
                  <p className="text-purple-900 font-semibold">{ec.target_description}</p>
                  {ec.visual_cues?.cue && (
                    <p className="mt-2 text-sm font-medium text-purple-700 bg-purple-100 px-3 py-1.5 rounded-lg inline-block">
                      👁 Look for: <span className="font-bold">{ec.visual_cues.cue}</span>
                    </p>
                  )}
                </div>

                {/* Action */}
                <div
                  className={`rounded-xl p-4 border transition-all ${
                    highlightSection === 'action'
                      ? 'bg-blue-100 border-blue-400 ring-2 ring-blue-300'
                      : 'bg-blue-50 border-blue-200'
                  }`}
                >
                  <p className="text-sm font-medium text-blue-800 mb-1">✋ Do this:</p>
                  <p className="text-blue-900 font-semibold">{ec.action_description}</p>
                </div>
              </div>

              {/* Read timer / proceed button */}
              <button
                onClick={reShowCard ? handleReReadDone : handleMemorized}
                disabled={readCountdown > 0}
                className={`w-full py-3 font-bold rounded-xl transition-colors ${
                  readCountdown > 0
                    ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                    : 'bg-blue-500 hover:bg-blue-600 text-white'
                }`}
              >
                {readCountdown > 0
                  ? `Read carefully... (${readCountdown}s)`
                  : reShowCard
                    ? "I've reviewed it — Test me again"
                    : "I've memorized this ✓"}
              </button>
            </>
          ) : (
            <>
              {/* Multi-question quiz */}
              {(() => {
                const qData = getQuestionData(currentQuestionIndex)
                const qType = QUESTION_TYPES[currentQuestionIndex]

                return (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold text-slate-800">Quick Check</h3>
                      <span className="text-xs text-slate-400">
                        Question {currentQuestionIndex + 1} of 3
                      </span>
                    </div>

                    {/* Question type badge */}
                    <span
                      className={`text-xs font-medium px-2 py-1 rounded-full inline-block ${
                        qType === 'trigger'
                          ? 'bg-amber-50 text-amber-700'
                          : qType === 'target'
                            ? 'bg-purple-50 text-purple-700'
                            : 'bg-blue-50 text-blue-700'
                      }`}
                    >
                      {qType === 'trigger'
                        ? '🔔 Trigger'
                        : qType === 'target'
                          ? '🔍 Target'
                          : '✋ Action'}
                    </span>

                    <p className="text-slate-600 font-medium">{qData.question}</p>

                    <div className="space-y-2">
                      {qData.options.map((opt, idx) => {
                        const isSelected = selected === opt
                        const showWrong = feedback === 'wrong' && isSelected
                        const showCorrect = feedback === 'correct' && isSelected

                        return (
                          <button
                            key={idx}
                            onClick={() => handleSelectOption(opt)}
                            disabled={!!feedback}
                            className={`w-full text-left px-4 py-3 rounded-xl border transition-all
                              ${
                                showCorrect
                                  ? 'bg-green-100 border-green-400 text-green-800'
                                  : showWrong
                                    ? 'bg-red-100 border-red-400 text-red-800'
                                    : isSelected
                                      ? 'bg-blue-100 border-blue-400 text-blue-800'
                                      : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                              }
                              ${feedback ? 'cursor-default' : 'cursor-pointer'}
                            `}
                          >
                            {opt}
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
                      <p className="text-green-600 text-sm font-medium">✓ Correct!</p>
                    )}

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
                  </div>
                )
              })()}
            </>
          )}
        </div>
      )}
    </div>
  )
}
