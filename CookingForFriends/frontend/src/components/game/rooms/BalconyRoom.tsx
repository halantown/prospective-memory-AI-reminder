/** Balcony room — PM target items in garden supplies area. */

import PMTargetItems from '../PMTargetItems'

export default function BalconyRoom() {
  return (
    <div className="absolute inset-0">
      {/* PM targets positioned at garden supplies area */}
      <div className="absolute z-10" style={{ left: '5%', bottom: '5%', width: '60%' }}>
        <PMTargetItems room="balcony" />
      </div>
    </div>
  )
}
