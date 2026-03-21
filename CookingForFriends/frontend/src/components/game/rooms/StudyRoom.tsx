/** Study room — PM target items on shelf area. */

import PMTargetItems from '../PMTargetItems'

export default function StudyRoom({ isActive: _isActive }: { isActive: boolean }) {
  return (
    <div className="absolute inset-0">
      {/* PM targets positioned on shelf area */}
      <div className="absolute z-10" style={{ left: '5%', top: '55%', width: '70%' }}>
        <PMTargetItems room="study" />
      </div>
    </div>
  )
}
