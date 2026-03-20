/** Balcony room — washing machine, plants, drying rack. PM target items embedded. */

import PMTargetItems from '../PMTargetItems'

export default function BalconyRoom() {
  return (
    <div className="flex flex-col gap-2 h-full">
      <p className="text-xs text-slate-400">A sunny balcony with plants and a washing machine.</p>
      <div className="flex gap-3 mt-1">
        <span className="text-2xl">🌿</span>
        <span className="text-2xl">🧺</span>
        <span className="text-2xl">🌸</span>
        <span className="text-2xl">☀️</span>
      </div>
      <PMTargetItems room="balcony" />
    </div>
  )
}
