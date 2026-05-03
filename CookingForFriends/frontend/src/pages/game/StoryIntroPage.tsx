import { useEffect, useState } from 'react'
import { useGameStore } from '../../stores/gameStore'
import { advancePhase, getExperimentConfig } from '../../services/api'
import { frontendPhaseForBackend } from '../../utils/phase'
import BubbleDialogue from '../../components/game/dialogue/BubbleDialogue'
import ExperimentHomeShell from '../../components/game/ExperimentHomeShell'

interface ScriptLine {
  speaker: string
  text: string
  stage_direction?: string
}

export default function StoryIntroPage() {
  const sessionId = useGameStore((s) => s.sessionId)
  const setPhase = useGameStore((s) => s.setPhase)
  const [script, setScript] = useState<ScriptLine[]>([])
  const [index, setIndex] = useState(0)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!sessionId) return
    getExperimentConfig(sessionId, 'STORY_INTRO')
      .then((config) => setScript((config.script as ScriptLine[]) ?? []))
      .catch((e) => console.error('[StoryIntro] config load failed', e))
  }, [sessionId])

  const current = script[index]

  const handleContinue = async () => {
    if (!sessionId || loading) return
    if (index < script.length - 1) {
      setIndex((i) => i + 1)
      return
    }
    setLoading(true)
    try {
      const advanced = await advancePhase(sessionId)
      setPhase(frontendPhaseForBackend(advanced.current_phase))
    } catch (e) {
      console.error('[StoryIntro] advance failed', e)
    } finally {
      setLoading(false)
    }
  }

  return (
    <ExperimentHomeShell initialRoom="bedroom" morningMode disableNavigation>
      {current ? (
        <BubbleDialogue
          speaker={current.speaker}
          text={current.text}
          avatar={current.speaker === 'ROBOT' ? 'R' : current.speaker === 'AVATAR' ? 'A' : 'N'}
          continueLabel={index < script.length - 1 ? 'Continue' : 'Start'}
          loading={loading}
          onContinue={handleContinue}
        >
          {current.stage_direction && (
            <div className="text-xs italic text-slate-500">{current.stage_direction}</div>
          )}
        </BubbleDialogue>
      ) : (
        <div className="rounded-lg bg-white p-6 text-center text-sm text-slate-500 shadow-xl">
          Loading...
        </div>
      )}
    </ExperimentHomeShell>
  )
}
