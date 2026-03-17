import { reportPmAction } from '../utils/api'
import { useGameStore } from '../store/gameStore'

export default function PmTaskPanel() {
  const trigger = useGameStore((s) => s.trigger)
  const pmPanelOpen = useGameStore((s) => s.pmPanelOpen)
  const pmDraft = useGameStore((s) => s.pmDraft)
  const openPmPanel = useGameStore((s) => s.openPmPanel)
  const closePmPanel = useGameStore((s) => s.closePmPanel)
  const setPmTarget = useGameStore((s) => s.setPmTarget)
  const togglePmStep = useGameStore((s) => s.togglePmStep)
  const resetPmDraft = useGameStore((s) => s.resetPmDraft)
  const getCurrentTask = useGameStore((s) => s.getCurrentTask)

  const sessionId = useGameStore((s) => s.sessionId)
  const blockNumber = useGameStore((s) => s.blockNumber)

  const task = getCurrentTask()

  if (!trigger.visible) return null

  const steps = Array.isArray(task?.steps) ? task.steps : []
  const options = Array.isArray(task?.options) ? task.options : []

  const canSubmit = Boolean(pmDraft.targetId) && steps.every((s) => pmDraft.stepsDone.includes(s.id))

  const onSubmit = async () => {
    if (!canSubmit || !sessionId || !blockNumber || !trigger.taskId) return

    try {
      await reportPmAction(sessionId, blockNumber, {
        task_id: trigger.taskId,
        task_slot: trigger.slot,
        selected_target: pmDraft.targetId,
        choice: {
          target_id: pmDraft.targetId,
          steps_done: pmDraft.stepsDone,
        },
      })
    } catch (err) {
      console.warn('[PM] action report failed:', err.message || err)
    } finally {
      resetPmDraft()
      closePmPanel()
    }
  }

  return (
    <>
      <div className="mx-6 mt-3 rounded-2xl border border-indigo-200 bg-indigo-50 px-4 py-3 flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-indigo-800">Trigger event appeared</div>
          <div className="text-xs text-indigo-700">
            {task?.title || trigger.taskId} · Slot {trigger.slot}
          </div>
        </div>
        <button
          onClick={openPmPanel}
          className="px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold"
        >
          Open PM task
        </button>
      </div>

      {pmPanelOpen && (
        <div className="fixed inset-0 bg-slate-900/35 z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-xl bg-white rounded-3xl shadow-2xl border border-slate-200 p-5">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-xl font-bold text-slate-800">{task?.title || trigger.taskId}</h3>
                <p className="text-sm text-slate-500">Choose the remembered target and complete both action steps.</p>
              </div>
              <button
                onClick={closePmPanel}
                className="text-slate-400 hover:text-slate-700 text-xl leading-none"
              >
                ×
              </button>
            </div>

            <div className="mb-4">
              <p className="text-xs uppercase tracking-wide text-slate-500 font-semibold mb-2">Target selection</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {options.map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => setPmTarget(opt.id)}
                    className={`px-3 py-2 rounded-xl border text-left text-sm ${
                      pmDraft.targetId === opt.id
                        ? 'border-indigo-500 bg-indigo-50 text-indigo-800'
                        : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-5">
              <p className="text-xs uppercase tracking-wide text-slate-500 font-semibold mb-2">Step completion</p>
              <div className="space-y-2">
                {steps.map((step) => (
                  <label
                    key={step.id}
                    className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700"
                  >
                    <input
                      type="checkbox"
                      checked={pmDraft.stepsDone.includes(step.id)}
                      onChange={() => togglePmStep(step.id)}
                    />
                    {step.label}
                  </label>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                onClick={closePmPanel}
                className="px-3 py-2 rounded-xl border border-slate-300 text-slate-600 hover:bg-slate-50 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={onSubmit}
                disabled={!canSubmit}
                className={`px-4 py-2 rounded-xl text-sm font-semibold ${
                  canSubmit
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                }`}
              >
                Submit PM action
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
