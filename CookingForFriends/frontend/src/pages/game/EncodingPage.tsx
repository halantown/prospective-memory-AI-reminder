/** Encoding page — display PM task cards before each block. */

import { useState, useEffect } from 'react'
import { useGameStore } from '../../stores/gameStore'
import { getBlockEncoding } from '../../services/api'
import type { PMEncodingCard } from '../../types'

export default function EncodingPage() {
  const sessionId = useGameStore((s) => s.sessionId)
  const blockNumber = useGameStore((s) => s.blockNumber)
  const setPhase = useGameStore((s) => s.setPhase)
  const resetBlock = useGameStore((s) => s.resetBlock)

  const [cards, setCards] = useState<PMEncodingCard[]>([])
  const [dayStory, setDayStory] = useState('')
  const [currentCard, setCurrentCard] = useState(0)
  const [quizMode, setQuizMode] = useState(false)
  const [quizAnswer, setQuizAnswer] = useState('')
  const [quizCorrect, setQuizCorrect] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(true)

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

  const handleNext = () => {
    if (quizMode) {
      // Verify rehearsal answer
      if (quizAnswer.trim().length > 0) {
        setQuizCorrect(true) // Accept any answer for now
        setTimeout(() => {
          setQuizMode(false)
          setQuizAnswer('')
          setQuizCorrect(null)
          if (currentCard < cards.length - 1) {
            setCurrentCard(currentCard + 1)
          } else {
            // All cards reviewed — start game
            setPhase('playing')
          }
        }, 1000)
      }
    } else {
      setQuizMode(true)
    }
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
          Please remember the following tasks. You'll need to do them during the game.
        </p>
      </div>

      {/* Progress */}
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

      {/* Task card */}
      {card && (
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-blue-600 bg-blue-50 px-3 py-1 rounded-full">
              Task {currentCard + 1} of {cards.length}
            </span>
          </div>

          {!quizMode ? (
            <>
              {/* Encoding card display */}
              <div className="space-y-3">
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

              {/* Target image placeholder */}
              <div className="bg-slate-100 rounded-xl h-32 flex items-center justify-center">
                <span className="text-slate-400 text-sm">
                  📷 {card.target_description}
                </span>
              </div>
            </>
          ) : (
            <>
              {/* Quiz / rehearsal mode */}
              <div className="space-y-3">
                <h3 className="text-lg font-semibold text-slate-800">Quick Check</h3>
                <p className="text-slate-600">
                  Can you describe what you need to do when the trigger happens?
                </p>
                <textarea
                  value={quizAnswer}
                  onChange={(e) => setQuizAnswer(e.target.value)}
                  placeholder="Describe the task in your own words..."
                  className="w-full px-4 py-3 border border-slate-300 rounded-xl
                             focus:outline-none focus:ring-2 focus:ring-blue-400
                             resize-none h-24"
                  autoFocus
                />
                {quizCorrect && (
                  <div className="text-green-600 text-sm font-medium">
                    ✓ Great! Moving to next task...
                  </div>
                )}
              </div>
            </>
          )}

          <button
            onClick={handleNext}
            disabled={quizMode && quizAnswer.trim().length === 0}
            className="w-full py-3 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-200
                       text-white font-bold rounded-xl transition-colors"
          >
            {quizMode
              ? 'Confirm'
              : currentCard < cards.length - 1
              ? 'I Remember — Next Task'
              : 'I Remember — Start Game!'
            }
          </button>
        </div>
      )}
    </div>
  )
}
