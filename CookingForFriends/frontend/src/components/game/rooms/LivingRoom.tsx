/** Living room — minimal interactive content. */

export default function LivingRoom() {
  return (
    <div className="flex flex-col gap-2 h-full text-slate-400 text-xs">
      <p>A cozy living room with a sofa and bookshelf.</p>
      <div className="flex gap-3 mt-2">
        <span className="text-2xl">🛋️</span>
        <span className="text-2xl">📚</span>
        <span className="text-2xl">📺</span>
      </div>
    </div>
  )
}
