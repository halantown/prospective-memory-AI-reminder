/** Living room — PM target items near bookshelf area. */

import PMTargetItems from '../PMTargetItems'

export default function LivingRoom() {
  return (
    <div className="absolute inset-0">
      {/* PM targets positioned near bookshelf (right side) */}
      <div className="absolute z-10" style={{ right: '3%', top: '30%', width: '30%' }}>
        <PMTargetItems room="living_room" />
      </div>
    </div>
  )
}
