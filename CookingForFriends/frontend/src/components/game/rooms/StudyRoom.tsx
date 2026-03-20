/** Study room — desk, bookshelf, calendar. PM target items embedded. */

import PMTargetItems from '../PMTargetItems'

export default function StudyRoom() {
  return (
    <div className="flex flex-col gap-2 h-full">
      <p className="text-xs text-slate-400">A quiet study with a desk and bookshelf.</p>
      <div className="flex gap-3 mt-1">
        <span className="text-2xl">🪑</span>
        <span className="text-2xl">📚</span>
        <span className="text-2xl">🖥️</span>
        <span className="text-2xl">📅</span>
      </div>
      <PMTargetItems room="study" />
    </div>
  )
}
