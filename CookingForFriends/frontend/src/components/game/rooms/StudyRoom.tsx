/** Study room — PM items via bookshelf popup. */

import PMTargetItems from '../PMTargetItems'

export default function StudyRoom({ isActive: _isActive }: { isActive: boolean }) {
  return (
    <div className="absolute inset-0">
      {/* PM furniture button positioned near the shelf */}
      <div className="absolute z-10" style={{ left: '8%', top: '58%' }}>
        <PMTargetItems room="study" />
      </div>
    </div>
  )
}
