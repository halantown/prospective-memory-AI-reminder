/** Main game page — 75/25 layout with world view + phone sidebar. */

import { useEffect } from 'react'
import { useGameStore } from '../../stores/gameStore'
import { useWebSocket } from '../../hooks/useWebSocket'
import { useMouseTracker } from '../../hooks/useMouseTracker'
import WorldView from '../../components/game/WorldView'
import PhoneSidebar from '../../components/game/PhoneSidebar'
import HUD from '../../components/game/HUD'
import RobotAvatar from '../../components/game/RobotAvatar'
import PMInteraction from '../../components/game/PMInteraction'
import TriggerEffects from '../../components/game/TriggerEffects'

export default function GamePage() {
  const sessionId = useGameStore((s) => s.sessionId)
  const blockNumber = useGameStore((s) => s.blockNumber)
  const wsConnected = useGameStore((s) => s.wsConnected)

  // Connect WebSocket
  useWebSocket(sessionId, blockNumber)

  // Start mouse tracking
  useMouseTracker()

  return (
    <div className="h-screen w-screen flex overflow-hidden bg-slate-900 select-none">
      {/* Game main area (75%) */}
      <div className="relative flex-1" style={{ width: '75%' }}>
        <WorldView />
        <HUD />
        <RobotAvatar />
        <PMInteraction />
        <TriggerEffects />

        {/* WS status indicator */}
        {!wsConnected && (
          <div className="absolute top-0 left-0 right-0 bg-red-600 text-white text-center text-sm py-1 z-50">
            Reconnecting to server...
          </div>
        )}
      </div>

      {/* Phone sidebar (25%) */}
      <div className="w-[25%] min-w-[280px] max-w-[360px]">
        <PhoneSidebar />
      </div>
    </div>
  )
}
