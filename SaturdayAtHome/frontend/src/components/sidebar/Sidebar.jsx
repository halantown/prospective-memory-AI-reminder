import Clock from './Clock'
import MiniMap from './MiniMap'
import ActivityLabel from './ActivityLabel'
import RobotStatus from './RobotStatus'
import TriggerZone from './TriggerZone'

export default function Sidebar() {
  return (
    <div className="h-full flex flex-col p-3 gap-3 overflow-y-auto">
      <Clock />
      <MiniMap />
      <ActivityLabel />
      <RobotStatus />
      <TriggerZone />
    </div>
  )
}
