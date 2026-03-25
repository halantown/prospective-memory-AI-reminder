/** Bathroom — PM items via supply shelf popup. */

import PMTargetItems from '../PMTargetItems'

export default function BathroomRoom({ isActive: _isActive }: { isActive: boolean }) {
  return (
    <div className="absolute inset-0">
      {/* PM furniture button positioned near the supply shelf */}
      <div className="absolute z-10" style={{ left: '5%', bottom: '8%' }}>
        <PMTargetItems room="bathroom" />
      </div>
    </div>
  )
}
