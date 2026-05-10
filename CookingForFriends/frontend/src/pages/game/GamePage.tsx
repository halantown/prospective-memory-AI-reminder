/** Main game page — floor plan view replacing WorldView, phone sidebar preserved. */

import { useEffect } from 'react'
import { useGameStore } from '../../stores/gameStore'
import { useWebSocket } from '../../hooks/useWebSocket'
import { useMouseTracker } from '../../hooks/useMouseTracker'
import FloorPlanView from '../../components/game/FloorPlanView'
import PhoneSidebar from '../../components/game/PhoneSidebar'
import HUD from '../../components/game/HUD'
import RobotAvatar from '../../components/game/RobotAvatar'
import PMInteraction from '../../components/game/PMInteraction'
import TriggerEffects from '../../components/game/TriggerEffects'
import PMTriggerModal from '../../components/game/PMTriggerModal'

export default function GamePage() {
  const sessionId = useGameStore((s) => s.sessionId)
  const participantId = useGameStore((s) => s.participantId)
  const wsConnected = useGameStore((s) => s.wsConnected)
  const blockError = useGameStore((s) => s.blockError)
  const setPhase = useGameStore((s) => s.setPhase)
  const setGameClock = useGameStore((s) => s.setGameClock)
  const setElapsedSeconds = useGameStore((s) => s.setElapsedSeconds)
  const setActivePhoneTab = useGameStore((s) => s.setActivePhoneTab)
  const setPhoneLocked = useGameStore((s) => s.setPhoneLocked)
  const pmPipelineState = useGameStore((s) => s.pmPipelineState)
  const pmTriggerWaiting = pmPipelineState?.step === 'trigger_event'
  const doorbellTriggerWaiting = pmTriggerWaiting && pmPipelineState?.triggerType === 'doorbell'
  const pmBlocksOngoingTask = Boolean(pmPipelineState && !doorbellTriggerWaiting)
  const pmBlocksPhone = Boolean(pmPipelineState)

  useEffect(() => {
    if (!sessionId) setPhase('welcome')
  }, [sessionId, setPhase])

  useEffect(() => {
    setGameClock('17:00')
    setElapsedSeconds(0)
    setActivePhoneTab('chats')
    setPhoneLocked(false)
  }, [setActivePhoneTab, setElapsedSeconds, setGameClock, setPhoneLocked])

  useWebSocket(sessionId)
  useMouseTracker()

  if (!sessionId) return null

  if (blockError) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center p-6">
        <div className="w-full max-w-md rounded-lg border border-red-200 bg-white p-6 text-center shadow-lg">
          <h1 className="text-xl font-bold text-slate-900">Game Error</h1>
          <p className="mt-3 text-sm leading-relaxed text-slate-600">
            A server error occurred during gameplay. Please contact the experimenter.
          </p>
          {participantId && (
            <p className="mt-4 rounded bg-slate-100 px-3 py-2 font-mono text-xs text-slate-600">
              Participant: {participantId}
            </p>
          )}
          <p className="mt-3 rounded bg-red-50 px-3 py-2 font-mono text-xs text-red-600">
            {blockError}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen w-screen flex overflow-hidden bg-slate-900 select-none">
      {/* World area — FloorPlanView replaces old WorldView tile layout.
           RobotAvatar is suppressed here; Pepper is rendered inside FloorPlanView. */}
      <div className={`relative flex-1 min-w-0 ${pmBlocksOngoingTask ? 'pointer-events-none' : ''}`}>
        <FloorPlanView
          initialRoom="kitchen"
          initialCharRoom="kitchen"
          initialRobotRoom="kitchen"
          mainExperimentNavigation
        />
        <HUD />
        {/* RobotAvatar hidden — robot sprite lives inside FloorPlanView on the map */}
        {/* <RobotAvatar /> */}
        <PMInteraction />
        <TriggerEffects />

        {!wsConnected && (
          <div className="absolute top-0 left-0 right-0 bg-red-600 text-white text-center text-sm py-1 z-50">
            Reconnecting to server...
          </div>
        )}
      </div>

      {/* Phone sidebar */}
      <div style={{ width: 'var(--phone-sidebar-width)' }} className={`relative flex-shrink-0 ${pmBlocksPhone ? 'pointer-events-none' : ''}`}>
        <PhoneSidebar />
        {pmBlocksPhone && (
          <div className="absolute inset-0 z-overlay-pm bg-slate-950/70 backdrop-blur-sm" />
        )}
      </div>

      {/* PM pipeline overlay — blocks all game interaction when active */}
      <PMTriggerModal />
    </div>
  )
}
