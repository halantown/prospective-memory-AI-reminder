/** Main game page — floor plan view replacing WorldView, phone sidebar preserved. */

import { useEffect, useState } from 'react'
import { useGameStore } from '../../stores/gameStore'
import { useWebSocket } from '../../hooks/useWebSocket'
import { useMouseTracker } from '../../hooks/useMouseTracker'
import { getCookingDefinitions, getSessionStatus } from '../../services/api'
import { frontendPhaseForBackend, isMainExperimentPhase } from '../../utils/phase'
import FloorPlanView from '../../components/game/FloorPlanView'
import PhoneSidebar from '../../components/game/PhoneSidebar'
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
  const initializeCookingDefinitions = useGameStore((s) => s.initializeCookingDefinitions)
  const resetBlock = useGameStore((s) => s.resetBlock)
  const setPMPipelineState = useGameStore((s) => s.setPMPipelineState)
  const setGameTimeFrozen = useGameStore((s) => s.setGameTimeFrozen)
  const clearRobotSpeech = useGameStore((s) => s.clearRobotSpeech)
  const setWsSend = useGameStore((s) => s.setWsSend)
  const phase = useGameStore((s) => s.phase)
  const pmPipelineState = useGameStore((s) => s.pmPipelineState)
  const [runtimeReady, setRuntimeReady] = useState(false)
  const [initError, setInitError] = useState<string | null>(null)
  const pmTriggerWaiting = pmPipelineState?.step === 'trigger_event'
  const doorbellTriggerWaiting = pmTriggerWaiting && pmPipelineState?.triggerType === 'doorbell'
  const pmBlocksOngoingTask = Boolean(pmPipelineState && !doorbellTriggerWaiting)
  const pmBlocksPhone = Boolean(pmPipelineState)

  useEffect(() => {
    if (!sessionId) setPhase('welcome')
  }, [sessionId, setPhase])

  useEffect(() => {
    if (!sessionId) return

    let cancelled = false
    setRuntimeReady(false)
    setInitError(null)

    getCookingDefinitions(sessionId)
      .then((definitions) => {
        if (cancelled) return
        initializeCookingDefinitions(definitions)
        resetBlock()
        setPMPipelineState(null)
        setGameTimeFrozen(false)
        clearRobotSpeech()
        setWsSend(null)
        setGameClock('17:00')
        setElapsedSeconds(0)
        setActivePhoneTab('chats')
        setPhoneLocked(false)
        setRuntimeReady(true)
      })
      .catch((error) => {
        console.error('[GamePage] Failed to initialize main experiment runtime', error)
        if (!cancelled) {
          setInitError(error instanceof Error ? error.message : 'Failed to initialize main session')
          setRuntimeReady(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [
    clearRobotSpeech,
    initializeCookingDefinitions,
    resetBlock,
    sessionId,
    setActivePhoneTab,
    setElapsedSeconds,
    setGameClock,
    setGameTimeFrozen,
    setPMPipelineState,
    setPhoneLocked,
    setWsSend,
  ])

  useWebSocket(runtimeReady ? sessionId : null)
  useMouseTracker()

  useEffect(() => {
    if (!runtimeReady || !sessionId || !isMainExperimentPhase(phase)) return
    let cancelled = false
    const syncPhase = async () => {
      try {
        const status = await getSessionStatus(sessionId)
        const serverPhase = frontendPhaseForBackend(status.phase)
        if (!cancelled && !isMainExperimentPhase(serverPhase)) {
          setPMPipelineState(null)
          setGameTimeFrozen(false)
          clearRobotSpeech()
          setPhase(serverPhase)
        }
      } catch (error) {
        console.warn('[GamePage] Main-session phase sync failed', error)
      }
    }
    const timer = window.setInterval(syncPhase, 2500)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [
    clearRobotSpeech,
    phase,
    runtimeReady,
    sessionId,
    setGameTimeFrozen,
    setPMPipelineState,
    setPhase,
  ])

  if (!sessionId) return null

  if (initError) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center p-6">
        <div className="w-full max-w-md rounded-lg border border-red-200 bg-white p-6 text-center shadow-lg">
          <h1 className="text-xl font-bold text-slate-900">Session initialization failed</h1>
          <p className="mt-3 text-sm leading-relaxed text-slate-600">
            The main session could not be prepared. Please contact the experimenter.
          </p>
          {participantId && (
            <p className="mt-4 rounded bg-slate-100 px-3 py-2 font-mono text-xs text-slate-600">
              Participant: {participantId}
            </p>
          )}
          <p className="mt-3 rounded bg-red-50 px-3 py-2 font-mono text-xs text-red-600">
            {initError}
          </p>
        </div>
      </div>
    )
  }

  if (!runtimeReady) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center p-6">
        <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-600 shadow-sm">
          Loading main session...
        </div>
      </div>
    )
  }

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
      {/* World area — FloorPlanView replaces old WorldView tile layout. */}
      <div className={`relative flex-1 min-w-0 ${pmBlocksOngoingTask ? 'pointer-events-none' : ''}`}>
        <FloorPlanView
          initialRoom="kitchen"
          initialCharRoom="kitchen"
          initialRobotRoom="kitchen"
          mainExperimentNavigation
        />
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
