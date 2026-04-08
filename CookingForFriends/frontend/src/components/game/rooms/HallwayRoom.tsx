/** Hallway room — connecting space between all rooms.
 *  Shows front door area where visitors arrive.
 *  Minimal interaction — primarily a transit space.
 */

import PMTargetItems from '../PMTargetItems'

export default function HallwayRoom({ isActive }: { isActive: boolean }) {
  return (
    <div className="absolute inset-0">
      {/* Front door indicator */}
      <div
        className="absolute z-10 flex items-center gap-1"
        style={{ right: '8%', top: '35%' }}
      >
        <span className="text-2xl">🚪</span>
      </div>

      {/* PM furniture button */}
      <div className="absolute z-10" style={{ left: '3%', bottom: '5%' }}>
        <PMTargetItems room="hallway" />
      </div>
    </div>
  )
}
