import Clock from './Clock'
import MiniMap from './MiniMap'
import ActivityLabel from './ActivityLabel'
import RobotStatus from './RobotStatus'
import TriggerZone from './TriggerZone'

export default function Sidebar() {
  return (
    <div className="h-full flex flex-col bg-slate-900 overflow-y-auto">
      {/* Clock is flush to top — acts as status bar */}
      <Clock />
      <div className="flex flex-col gap-3 p-3 flex-1">
        <ActivityLabel />
        <MiniMap />
        <RobotStatus />
        <TriggerZone />
      </div>
    </div>
  )
}
