import { useEffect } from 'react'
import type { ReactNode } from 'react'
import FloorPlanView from './FloorPlanView'
import type { FloorRoom } from './FloorPlanView'
import HUD from './HUD'
import PhoneSidebar from './PhoneSidebar'
import { useGameStore } from '../../stores/gameStore'

interface ExperimentHomeShellProps {
  children: ReactNode
  phoneDisabled?: boolean
  initialRoom?: FloorRoom | null
  morningMode?: boolean
  disableNavigation?: boolean
  highlightedRoom?: FloorRoom | null
}

export default function ExperimentHomeShell({
  children,
  phoneDisabled = true,
  initialRoom = null,
  morningMode = false,
  disableNavigation = false,
  highlightedRoom = null,
}: ExperimentHomeShellProps) {
  const setGameClock = useGameStore((s) => s.setGameClock)
  const roomForActors = initialRoom ?? 'living_room'

  useEffect(() => {
    if (morningMode) {
      setGameClock('08:00')
    }
  }, [morningMode, setGameClock])

  return (
    <div className="h-screen w-screen flex overflow-hidden bg-slate-900 select-none">
      <div className="relative flex-1 min-w-0">
        <FloorPlanView
          initialRoom={initialRoom}
          initialCharRoom={roomForActors}
          initialRobotRoom={roomForActors}
          disableNavigation={disableNavigation}
          highlightedRoom={highlightedRoom}
        />
        <HUD />
        <div className="pointer-events-auto absolute inset-x-0 bottom-0 z-[220] bg-gradient-to-t from-black/65 via-black/25 to-transparent p-4">
          <div className="mx-auto w-full max-w-4xl">
            {children}
          </div>
        </div>
      </div>
      <div
        style={{ width: '440px' }}
        className={`flex-shrink-0 ${phoneDisabled ? 'pointer-events-none opacity-90' : ''}`}
      >
        <PhoneSidebar />
      </div>
    </div>
  )
}
