/** CutscenePlayer — shows a single cutscene segment placeholder with a Next button. */

interface CutscenePlayerProps {
  taskId: string
  segmentIndex: number
  placeholder: string
  onNext: () => void
}

export default function CutscenePlayer({ taskId, segmentIndex, placeholder, onNext }: CutscenePlayerProps) {
  const segmentLabel = `Segment ${segmentIndex + 1} / 4`

  return (
    <div className="min-h-screen bg-stone-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="text-3xl">🎬</div>
          <div>
            <p className="text-xs font-semibold text-amber-600 uppercase tracking-wider">
              Task {taskId}
            </p>
            <p className="text-sm text-slate-500">{segmentLabel}</p>
          </div>
        </div>

        <div className="bg-amber-50 rounded-xl p-6 mb-8 min-h-[120px] flex items-center">
          <p className="text-slate-700 leading-relaxed text-base whitespace-pre-wrap">
            {placeholder}
          </p>
        </div>

        <button
          onClick={onNext}
          className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-white
                     font-semibold rounded-xl transition-colors text-base"
        >
          Next →
        </button>
      </div>
    </div>
  )
}
