/** Bathroom — PM target items area. */

import PMTargetItems from '../PMTargetItems'

export default function BathroomRoom({ isActive: _isActive }: { isActive: boolean }) {
  return (
    <div className="absolute inset-0">
      {/* PM targets positioned in bathroom area */}
      <div className="absolute z-10" style={{ left: '5%', bottom: '5%', width: '60%' }}>
        <PMTargetItems room="bathroom" />
      </div>
    </div>
  )
}
