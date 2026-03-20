/** Debrief page — demographics, preference, open questions. */

import { useState } from 'react'
import { useGameStore } from '../../stores/gameStore'
import { submitDebrief } from '../../services/api'

export default function DebriefPage() {
  const sessionId = useGameStore((s) => s.sessionId)
  const setPhase = useGameStore((s) => s.setPhase)
  const [step, setStep] = useState(0)
  const [submitting, setSubmitting] = useState(false)

  // Demographics
  const [age, setAge] = useState('')
  const [gender, setGender] = useState('')

  // Preference
  const [preferredStyle, setPreferredStyle] = useState('')

  // Open responses
  const [noticedDifference, setNoticedDifference] = useState('')
  const [strategy, setStrategy] = useState('')

  const handleSubmit = async () => {
    if (!sessionId) return
    setSubmitting(true)
    try {
      await submitDebrief(sessionId, {
        demographic: { age: parseInt(age) || 0, gender },
        preference: { preferred_reminder_style: preferredStyle },
        open_responses: {
          noticed_difference: noticedDifference,
          strategy_description: strategy,
        },
      })
      setPhase('complete')
    } catch (err) {
      console.error('Failed to submit debrief:', err)
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-8">
        <h1 className="text-xl font-bold text-slate-800 mb-1">Almost Done!</h1>
        <p className="text-slate-500 text-sm mb-6">
          Please answer a few final questions.
        </p>

        {step === 0 && (
          <div className="space-y-4">
            <h2 className="text-sm font-semibold text-slate-700">Demographics</h2>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Age</label>
              <input
                type="number"
                value={age}
                onChange={(e) => setAge(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                placeholder="e.g. 25"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Gender</label>
              <select
                value={gender}
                onChange={(e) => setGender(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
              >
                <option value="">Select...</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="non_binary">Non-binary</option>
                <option value="prefer_not">Prefer not to say</option>
              </select>
            </div>
            <button
              onClick={() => setStep(1)}
              disabled={!age || !gender}
              className="w-full py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-200
                         text-white font-medium rounded-xl transition-colors"
            >
              Next
            </button>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4">
            <h2 className="text-sm font-semibold text-slate-700">
              Robot Reminder Preference
            </h2>
            <p className="text-xs text-slate-500">
              During the experiment, the robot sometimes reminded you of tasks.
              Which style did you prefer?
            </p>
            <div className="space-y-2">
              {[
                { value: 'specific', label: 'Specific reminders with details about the item' },
                { value: 'contextual', label: 'Reminders that connected to what I was doing' },
                { value: 'no_preference', label: 'No preference / didn\'t notice a difference' },
              ].map((opt) => (
                <label
                  key={opt.value}
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors
                    ${preferredStyle === opt.value
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-slate-200 hover:bg-slate-50'
                    }`}
                >
                  <input
                    type="radio"
                    name="preference"
                    value={opt.value}
                    checked={preferredStyle === opt.value}
                    onChange={(e) => setPreferredStyle(e.target.value)}
                    className="accent-blue-500"
                  />
                  <span className="text-sm text-slate-700">{opt.label}</span>
                </label>
              ))}
            </div>
            <button
              onClick={() => setStep(2)}
              disabled={!preferredStyle}
              className="w-full py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-200
                         text-white font-medium rounded-xl transition-colors"
            >
              Next
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <h2 className="text-sm font-semibold text-slate-700">Open Questions</h2>
            <div>
              <label className="block text-xs text-slate-500 mb-1">
                Did you notice any differences in the robot's reminders across the three blocks?
              </label>
              <textarea
                value={noticedDifference}
                onChange={(e) => setNoticedDifference(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm h-20 resize-none"
                placeholder="Describe what you noticed..."
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">
                Did you use any particular strategy to remember the tasks?
              </label>
              <textarea
                value={strategy}
                onChange={(e) => setStrategy(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm h-20 resize-none"
                placeholder="Describe your strategy..."
              />
            </div>
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="w-full py-2 bg-green-500 hover:bg-green-600 disabled:bg-green-200
                         text-white font-bold rounded-xl transition-colors"
            >
              {submitting ? 'Submitting...' : 'Complete Experiment'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
