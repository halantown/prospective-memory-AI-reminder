import type { ReactNode } from 'react'
import FloorPlanView from './FloorPlanView'
import HUD from './HUD'
import PhoneSidebar from './PhoneSidebar'

interface ExperimentHomeShellProps {
  children: ReactNode
  phoneDisabled?: boolean
}

export default function ExperimentHomeShell({ children, phoneDisabled = true }: ExperimentHomeShellProps) {
  return (
    <div className="h-screen w-screen flex overflow-hidden bg-slate-900 select-none">
      <div className="relative flex-1 min-w-0">
        <FloorPlanView />
        <HUD />
        <div className="pointer-events-none absolute left-4 top-4 z-20 rounded-lg border border-amber-300/40 bg-slate-950/70 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-amber-100 shadow-lg">
          Bedroom
        </div>
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
