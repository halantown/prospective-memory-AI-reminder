/** Micro-break page — forced pause + NASA-TLX. */

import { useState, useEffect, useRef } from 'react'
import { useGameStore } from '../../stores/gameStore'
import { submitNasaTLX } from '../../services/api'

const BREAK_DURATION_S = 60

export default function MicroBreakPage() {
  const sessionId = useGameStore((s) => s.sessionId)
  const blockNumber = useGameStore((s) => s.blockNumber)
  const setPhase = useGameStore((s) => s.setPhase)
  const setBlockNumber = useGameStore((s) => s.setBlockNumber)
  const resetBlock = useGameStore((s) => s.resetBlock)

  const [countdown, setCountdown] = useState(BREAK_DURATION_S)
  const [showNasaTLX, setShowNasaTLX] = useState(false)
  const [mentalDemand, setMentalDemand] = useState(10)
  const [effort, setEffort] = useState(10)
  const [frustration, setFrustration] = useState(10)
  const [submitting, setSubmitting] = useState(false)

  // Countdown timer
  useEffect(() => {
    if (countdown <= 0) {
      setShowNasaTLX(true)
      return
    }
    const timer = setTimeout(() => setCountdown(countdown - 1), 1000)
    return () => clearTimeout(timer)
  }, [countdown])

  const handleSubmit = async () => {
    if (!sessionId) return
    setSubmitting(true)
    try {
      const result = await submitNasaTLX(sessionId, blockNumber, {
        mental_demand: mentalDemand,
        effort,
        frustration,
      })

      if (result.next_block) {
        resetBlock()
        setBlockNumber(result.next_block)
        setPhase('encoding')
      } else {
        setPhase('debrief')
      }
    } catch (err) {
      console.error('Failed to submit NASA-TLX:', err)
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8">
        {!showNasaTLX ? (
          // Countdown break
          <div className="text-center">
            <h1 className="text-xl font-bold text-slate-800 mb-2">Take a Short Break</h1>
            <p className="text-slate-500 text-sm mb-6">
              Block {blockNumber} complete! Please relax for a moment.
            </p>
            <div className="text-6xl font-mono font-bold text-cooking-500 mb-4">
              {countdown}
            </div>
            <p className="text-slate-400 text-xs">seconds remaining</p>
            <div className="w-full bg-slate-200 rounded-full h-2 mt-6">
              <div
                className="bg-cooking-400 h-2 rounded-full transition-all duration-1000"
                style={{ width: `${((BREAK_DURATION_S - countdown) / BREAK_DURATION_S) * 100}%` }}
              />
            </div>
          </div>
        ) : (
          // NASA-TLX
          <div>
            <h1 className="text-lg font-bold text-slate-800 mb-1">Quick Questions</h1>
            <p className="text-slate-500 text-sm mb-6">
              Rate your experience during the last block:
            </p>

            <div className="space-y-6">
              <TLXSlider
                label="Mental Demand"
                description="How mentally demanding was the task?"
                value={mentalDemand}
                onChange={setMentalDemand}
              />
              <TLXSlider
                label="Effort"
                description="How hard did you have to work?"
                value={effort}
                onChange={setEffort}
              />
              <TLXSlider
                label="Frustration"
                description="How frustrated did you feel?"
                value={frustration}
                onChange={setFrustration}
              />
            </div>

            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="w-full mt-8 py-3 bg-cooking-500 hover:bg-cooking-600
                         disabled:bg-cooking-200 text-white font-bold rounded-xl transition-colors"
            >
              {submitting ? 'Submitting...' : 'Continue'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function TLXSlider({ label, description, value, onChange }: {
  label: string
  description: string
  value: number
  onChange: (v: number) => void
}) {
  return (
    <div>
      <div className="flex justify-between items-baseline mb-1">
        <label className="text-sm font-medium text-slate-700">{label}</label>
        <span className="text-xs text-slate-400">{value}/21</span>
      </div>
      <p className="text-xs text-slate-400 mb-2">{description}</p>
      <div className="flex items-center gap-2">
        <span className="text-xs text-slate-400">Low</span>
        <input
          type="range"
          min={1}
          max={21}
          value={value}
          onChange={(e) => onChange(parseInt(e.target.value))}
          className="flex-1 accent-cooking-500"
        />
        <span className="text-xs text-slate-400">High</span>
      </div>
    </div>
  )
}
