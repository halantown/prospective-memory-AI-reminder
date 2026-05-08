import { useEffect, useMemo } from 'react'
import type { ReactNode } from 'react'
import { useGameStore } from '../../stores/gameStore'
import ExperimentHomeShell from './ExperimentHomeShell'
import type { FloorRoom } from './FloorPlanView'

interface TrainingHomeShellProps {
  children: ReactNode
  phase: string
  scriptedDoorEncounterResting?: boolean
}

interface TrainingSceneConfig {
  room: FloorRoom
  startMinute: number
  phoneDisabled: boolean
  disableNavigation: boolean
  highlightedRoom?: FloorRoom | null
  scriptedDoorEncounterId?: string | null
}

const TRAINING_SCENES: Record<string, TrainingSceneConfig> = {
  STORY_INTRO: { room: 'bedroom', startMinute: 8 * 60, phoneDisabled: true, disableNavigation: true },
  ENCODING_VIDEO_1: { room: 'bedroom', startMinute: 8 * 60 + 2, phoneDisabled: true, disableNavigation: true },
  MANIP_CHECK_1: { room: 'bedroom', startMinute: 8 * 60 + 4, phoneDisabled: true, disableNavigation: true },
  ASSIGN_1: { room: 'bedroom', startMinute: 8 * 60 + 5, phoneDisabled: true, disableNavigation: true },
  ENCODING_VIDEO_2: { room: 'bedroom', startMinute: 8 * 60 + 7, phoneDisabled: true, disableNavigation: true },
  MANIP_CHECK_2: { room: 'bedroom', startMinute: 8 * 60 + 9, phoneDisabled: true, disableNavigation: true },
  ASSIGN_2: { room: 'bedroom', startMinute: 8 * 60 + 10, phoneDisabled: true, disableNavigation: true },
  ENCODING_VIDEO_3: { room: 'bedroom', startMinute: 8 * 60 + 12, phoneDisabled: true, disableNavigation: true },
  MANIP_CHECK_3: { room: 'bedroom', startMinute: 8 * 60 + 14, phoneDisabled: true, disableNavigation: true },
  ASSIGN_3: { room: 'bedroom', startMinute: 8 * 60 + 15, phoneDisabled: true, disableNavigation: true },
  ENCODING_VIDEO_4: { room: 'bedroom', startMinute: 8 * 60 + 17, phoneDisabled: true, disableNavigation: true },
  MANIP_CHECK_4: { room: 'bedroom', startMinute: 8 * 60 + 19, phoneDisabled: true, disableNavigation: true },
  ASSIGN_4: { room: 'bedroom', startMinute: 8 * 60 + 20, phoneDisabled: true, disableNavigation: true },
  RECAP: { room: 'bedroom', startMinute: 8 * 60 + 22, phoneDisabled: true, disableNavigation: true },
  TUTORIAL_PHONE: { room: 'bedroom', startMinute: 8 * 60 + 30, phoneDisabled: false, disableNavigation: true },
  TUTORIAL_COOKING: {
    room: 'bedroom',
    startMinute: 8 * 60 + 40,
    phoneDisabled: false,
    disableNavigation: false,
    highlightedRoom: 'kitchen',
  },
  TUTORIAL_TRIGGER: {
    room: 'living_room',
    startMinute: 8 * 60 + 55,
    phoneDisabled: true,
    disableNavigation: true,
    scriptedDoorEncounterId: 'tutorial_sam',
  },
}

function formatClock(totalMinutes: number) {
  const minutesInDay = ((totalMinutes % 1440) + 1440) % 1440
  const h = Math.floor(minutesInDay / 60)
  const m = minutesInDay % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export function trainingSceneForPhase(phase: string): TrainingSceneConfig {
  return TRAINING_SCENES[phase] ?? TRAINING_SCENES.STORY_INTRO
}

export default function TrainingHomeShell({ children, phase, scriptedDoorEncounterResting = false }: TrainingHomeShellProps) {
  const setGameClock = useGameStore((s) => s.setGameClock)
  const setElapsedSeconds = useGameStore((s) => s.setElapsedSeconds)
  const scene = useMemo(() => trainingSceneForPhase(phase), [phase])

  useEffect(() => {
    const mountedAt = Date.now()

    const updateTrainingClock = () => {
      const elapsedRealSeconds = Math.floor((Date.now() - mountedAt) / 1000)
      const elapsedTrainingMinutes = Math.floor(elapsedRealSeconds / 15)
      const currentMinute = scene.startMinute + elapsedTrainingMinutes
      setGameClock(formatClock(currentMinute))
      setElapsedSeconds(currentMinute * 60)
    }

    updateTrainingClock()
    const timer = window.setInterval(updateTrainingClock, 1000)
    return () => window.clearInterval(timer)
  }, [scene.startMinute, setElapsedSeconds, setGameClock])

  return (
    <ExperimentHomeShell
      initialRoom={scene.room}
      phoneDisabled={scene.phoneDisabled}
      disableNavigation={scene.disableNavigation}
      highlightedRoom={scene.highlightedRoom ?? null}
      scriptedDoorEncounterId={scene.scriptedDoorEncounterId ?? null}
      scriptedDoorEncounterResting={scriptedDoorEncounterResting}
    >
      {children}
    </ExperimentHomeShell>
  )
}
