/** Consent page — embeds consent PDF and records consent timestamp. */

import { useEffect, useState } from 'react'
import { useGameStore } from '../../stores/gameStore'
import { advancePhase, getExperimentConfig, submitExperimentResponses } from '../../services/api'
import { frontendPhaseForBackend } from '../../utils/phase'

export default function ConsentPage() {
  const sessionId = useGameStore((s) => s.sessionId)
  const setPhase = useGameStore((s) => s.setPhase)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [checked, setChecked] = useState(false)
  const [consent, setConsent] = useState<{
    pdf_path?: string
    checkbox_label?: string
    continue_button?: string
  } | null>(null)

  useEffect(() => {
    if (!sessionId) return
    getExperimentConfig(sessionId, 'CONSENT')
      .then((config) => setConsent(config.consent as typeof consent))
      .catch((e) => console.error('[Consent] config load failed', e))
  }, [sessionId])

  const handleAgree = async () => {
    if (!sessionId || loading || !checked) return
    setLoading(true)
    setError(null)
    try {
      await submitExperimentResponses(sessionId, [{
        phase: 'CONSENT',
        question_id: 'informed_consent_agreement',
        response_type: 'boolean',
        value: true,
        timestamp: Date.now() / 1000,
        metadata: { consent_pdf_path: consent?.pdf_path ?? null },
      }])
      const advanced = await advancePhase(sessionId, 'DEMOGRAPHICS')
      setPhase(frontendPhaseForBackend(advanced.current_phase))
    } catch (e) {
      console.error('[Consent] submit failed', e)
      setError('Failed to submit. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const pdfSrc = consent?.pdf_path ? `/${consent.pdf_path}` : null

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-xl max-w-4xl w-full p-8">
        <h1 className="text-2xl font-bold text-slate-800 mb-6 text-center">
          Informed Consent
        </h1>
        <div className="h-[60vh] overflow-hidden rounded-xl border border-slate-200 bg-slate-50 mb-5">
          {pdfSrc ? (
            <iframe title="Informed consent" src={pdfSrc} className="h-full w-full" />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-slate-500">
              Loading consent form...
            </div>
          )}
        </div>
        <label className="mb-6 flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => setChecked(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-blue-600"
          />
          <span>
            {consent?.checkbox_label
              ?? 'I have read and understood the information above and voluntarily agree to participate.'}
          </span>
        </label>
        {error && (
          <div className="mb-3 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>
        )}
        <button
          onClick={handleAgree}
          disabled={loading || !checked}
          className="w-full py-3 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300
                     text-white font-semibold rounded-xl transition-colors text-base"
        >
          {loading ? <><span className="btn-spinner" />Please wait...</> : consent?.continue_button ?? 'I Agree & Continue'}
        </button>
      </div>
    </div>
  )
}
