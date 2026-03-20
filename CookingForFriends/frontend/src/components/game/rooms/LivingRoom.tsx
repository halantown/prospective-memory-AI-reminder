/** Living room — cozy room with PM target items. */

import PMTargetItems from '../PMTargetItems'

export default function LivingRoom() {
  return (
    <div className="flex flex-col gap-2 h-full text-slate-400 text-xs">
      <p>A cozy living room with a sofa and bookshelf.</p>
      <div className="flex gap-3 mt-2">
        <span className="text-2xl">🛋️</span>
        <span className="text-2xl">📚</span>
        <span className="text-2xl">📺</span>
      </div>
      <PMTargetItems room="living_room" />
    </div>
  )
}
