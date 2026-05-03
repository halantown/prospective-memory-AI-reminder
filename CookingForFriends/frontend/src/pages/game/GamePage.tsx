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
  const wsConnected = useGameStore((s) => s.wsConnected)
  const setPhase = useGameStore((s) => s.setPhase)
  const pmPipelineState = useGameStore((s) => s.pmPipelineState)
  const pmBlocksOngoingTask = pmPipelineState && pmPipelineState.step !== 'trigger_event'
  const pmBlocksPhone = Boolean(pmPipelineState)

  useEffect(() => {
    if (!sessionId) setPhase('welcome')
  }, [sessionId, setPhase])

  useWebSocket(sessionId)
  useMouseTracker()

  if (!sessionId) return null

  return (
    <div className="h-screen w-screen flex overflow-hidden bg-slate-900 select-none">
      {/* World area — FloorPlanView replaces old WorldView tile layout.
           RobotAvatar is suppressed here; Pepper is rendered inside FloorPlanView. */}
      <div className={`relative flex-1 min-w-0 ${pmBlocksOngoingTask ? 'pointer-events-none' : ''}`}>
        <FloorPlanView />
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

      {/* Phone sidebar (fixed 440px) */}
      <div style={{ width: '440px' }} className={`flex-shrink-0 ${pmBlocksPhone ? 'pointer-events-none' : ''}`}>
        <PhoneSidebar />
      </div>

      {/* PM pipeline overlay — blocks all game interaction when active */}
      <PMTriggerModal />
    </div>
  )
}
