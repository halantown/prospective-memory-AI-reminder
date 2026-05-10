import { useEffect, useMemo, useRef, useState } from 'react'
import { useGameStore } from '../../stores/gameStore'
import {
  advancePhase,
  getExperimentConfig,
  logCutsceneEvent,
  submitExperimentResponses,
  submitManipulationCheck,
} from '../../services/api'
import { frontendPhaseForBackend } from '../../utils/phase'
import TrainingHomeShell from '../../components/game/TrainingHomeShell'
import BubbleDialogue from '../../components/game/dialogue/BubbleDialogue'
import InteractiveEncodingVideo from '../../components/game/InteractiveEncodingVideo'
import type { EncodingVideoSegment } from '../../components/game/InteractiveEncodingVideo'

interface Option {
  id: string
  text: string
}

function phaseKind(phase: string) {
  if (phase.startsWith('ENCODING_VIDEO_')) return 'video'
  if (phase.startsWith('MANIP_CHECK_')) return 'manip'
  if (phase.startsWith('ASSIGN_')) return 'assign'
  if (phase === 'RECAP') return 'recap'
  return 'unknown'
}

export default function EncodingFlowPage() {
  const sessionId = useGameStore((s) => s.sessionId)
  const phase = useGameStore((s) => s.phase)
  const setPhase = useGameStore((s) => s.setPhase)
  const [config, setConfig] = useState<Record<string, unknown> | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const startedAtRef = useRef(Date.now())
  const currentPhase = String(phase)
  const kind = phaseKind(currentPhase)

  useEffect(() => {
    if (!sessionId) return
    setConfig(null)
    setSelected(null)
    startedAtRef.current = Date.now()
    getExperimentConfig(sessionId, currentPhase)
      .then((next) => setConfig(next as Record<string, unknown>))
      .catch((e) => console.error('[EncodingFlow] config load failed', e))
  }, [sessionId, currentPhase])

  const manip = config?.manipulation_check as { question: string; options: Option[] } | undefined
  const encoding = config?.encoding as {
    episode_label?: string
    frame_width?: number
    frame_height?: number
    interactive_segments?: EncodingVideoSegment[]
  } | undefined
  const assign = config?.assign as { text: string } | undefined
  const recapTasks = (config?.tasks as Array<{ task_id: string; text: string }> | undefined) ?? []

  const title = useMemo(() => {
    if (kind === 'video') return encoding?.episode_label ?? 'Encoding Video'
    if (kind === 'manip') return 'Quick Check'
    if (kind === 'assign') return 'Remember This'
    if (kind === 'recap') return 'Tonight\'s To-Do List'
    return 'Encoding'
  }, [encoding?.episode_label, kind])

  const advance = async () => {
    if (!sessionId || loading) return
    setLoading(true)
    try {
      const advanced = await advancePhase(sessionId)
      setPhase(frontendPhaseForBackend(advanced.current_phase))
    } catch (e) {
      console.error('[EncodingFlow] advance failed', e)
    } finally {
      setLoading(false)
    }
  }

  const handleManipSubmit = async () => {
    if (!sessionId || !selected || loading) return
    setLoading(true)
    try {
      await submitManipulationCheck(sessionId, {
        phase: currentPhase,
        task_id: String(config?.task_id),
        selected_option_id: selected,
        response_time_ms: Date.now() - startedAtRef.current,
      })
      const advanced = await advancePhase(sessionId)
      setPhase(frontendPhaseForBackend(advanced.current_phase))
    } catch (e) {
      console.error('[EncodingFlow] manipulation check submit failed', e)
    } finally {
      setLoading(false)
    }
  }

  const handleConfirm = async (questionId: string) => {
    if (!sessionId || loading) return
    setLoading(true)
    try {
      await submitExperimentResponses(sessionId, [{
        phase: currentPhase,
        question_id: questionId,
        response_type: 'boolean',
        value: true,
        metadata: { task_id: config?.task_id ?? null },
      }])
      const advanced = await advancePhase(sessionId)
      setPhase(frontendPhaseForBackend(advanced.current_phase))
    } catch (e) {
      console.error('[EncodingFlow] confirm failed', e)
    } finally {
      setLoading(false)
    }
  }

  const handleEncodingSegmentViewed = (
    segment: EncodingVideoSegment,
    segmentIndex: number,
    durationMs: number,
  ) => {
    if (!sessionId) return
    logCutsceneEvent(sessionId, {
      task_id: String(config?.task_id),
      segment_index: segmentIndex,
      placeholder: segment.placeholder ?? segment.label,
      viewed_at: Date.now() / 1000 - durationMs / 1000,
      duration_ms: durationMs,
    }).catch((e) => console.error('[EncodingFlow] segment view log failed', e))
  }

  const handleEncodingInteractionClick = (
    segment: EncodingVideoSegment,
    segmentIndex: number,
    responseTimeMs: number,
  ) => {
    if (!sessionId) return
    submitExperimentResponses(sessionId, [{
      phase: currentPhase,
      question_id: `${String(config?.task_id)}_segment_${segmentIndex + 1}_interaction_click`,
      response_type: 'object',
      value: {
        segment_id: segment.id,
        click_target_id: segment.click_target.id,
      },
      metadata: {
        task_id: config?.task_id ?? null,
        segment_index: segmentIndex,
        response_time_ms: responseTimeMs,
      },
    }]).catch((e) => console.error('[EncodingFlow] interaction click log failed', e))
  }

  if (!config) {
    return (
      <TrainingHomeShell phase={currentPhase}>
        <div className="rounded-lg bg-white p-6 text-center text-sm text-slate-500 shadow-xl">
          Loading...
        </div>
      </TrainingHomeShell>
    )
  }

  return (
    <TrainingHomeShell phase={currentPhase}>
      <div className={kind === 'video' ? '' : 'rounded-lg border border-slate-300 bg-white/95 p-5 shadow-xl backdrop-blur'}>
        {kind === 'video' && (
          <div>
            <BubbleDialogue
              speaker="AVATAR"
              text="Watch carefully. Let me tell you what happened recently."
              avatar="A"
            />
            <div className="mt-4">
              <InteractiveEncodingVideo
                taskId={String(config.task_id)}
                title={title}
                frameWidth={encoding?.frame_width}
                frameHeight={encoding?.frame_height}
                segments={encoding?.interactive_segments ?? []}
                loading={loading}
                onSegmentViewed={handleEncodingSegmentViewed}
                onInteractionClick={handleEncodingInteractionClick}
                onComplete={advance}
              />
            </div>
          </div>
        )}

        {kind === 'manip' && manip && (
          <div>
            <h1 className="text-lg font-bold text-slate-900">{title}</h1>
            <p className="mt-3 text-base font-medium text-slate-800">{manip.question}</p>
            <div className="mt-4 space-y-2">
              {manip.options.map((option) => (
                <button
                  key={option.id}
                  onClick={() => setSelected(option.id)}
                  className={`w-full rounded-lg border px-4 py-3 text-left text-sm transition ${
                    selected === option.id
                      ? 'border-slate-900 bg-slate-100'
                      : 'border-slate-300 bg-white hover:bg-slate-50'
                  }`}
                >
                  {option.text}
                </button>
              ))}
            </div>
            <button
              onClick={handleManipSubmit}
              disabled={!selected || loading}
              className="mt-6 w-full rounded-lg bg-slate-900 py-3 text-sm font-semibold text-white disabled:bg-slate-300"
            >
              {loading ? 'Saving...' : 'Continue'}
            </button>
          </div>
        )}

        {kind === 'assign' && assign && (
          <div>
            {Boolean(config.transition_line) && (
              <p className="mb-4 text-sm italic text-slate-500">{String(config.transition_line)}</p>
            )}
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-5 text-base font-medium text-amber-950">
              {assign.text}
            </div>
            <button
              onClick={() => handleConfirm(`${String(config.task_id)}_assign_confirmed`)}
              disabled={loading}
              className="mt-6 w-full rounded-lg bg-slate-900 py-3 text-sm font-semibold text-white disabled:bg-slate-300"
            >
              {loading ? 'Saving...' : 'OK'}
            </button>
          </div>
        )}

        {kind === 'recap' && (
          <div>
            <p className="text-sm text-slate-600">{String(config.intro ?? '')}</p>
            <ol className="mt-4 space-y-2">
              {recapTasks.map((task) => (
                <li key={task.task_id} className="rounded-lg bg-slate-100 px-4 py-3 text-sm text-slate-800">
                  {task.text}
                </li>
              ))}
            </ol>
            <p className="mt-4 text-sm text-slate-600">{String(config.outro ?? '')}</p>
            <button
              onClick={() => handleConfirm('recap_confirmed')}
              disabled={loading}
              className="mt-6 w-full rounded-lg bg-slate-900 py-3 text-sm font-semibold text-white disabled:bg-slate-300"
            >
              {loading ? 'Saving...' : 'Got it'}
            </button>
          </div>
        )}
      </div>
    </TrainingHomeShell>
  )
}
