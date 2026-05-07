import type { ReactNode } from 'react'

export interface BubbleChoice {
  id: string
  label: string
  disabled?: boolean
}

export interface BubbleDialogueProps {
  speaker: string
  text: string
  avatar?: ReactNode
  align?: 'left' | 'right'
  choices?: BubbleChoice[]
  continueLabel?: string
  loading?: boolean
  disabled?: boolean
  children?: ReactNode
  onContinue?: () => void
  onChoice?: (choice: BubbleChoice) => void
}

export default function BubbleDialogue({
  speaker,
  text,
  avatar,
  align = 'left',
  choices = [],
  continueLabel = 'Continue',
  loading = false,
  disabled = false,
  children,
  onContinue,
  onChoice,
}: BubbleDialogueProps) {
  const isRight = align === 'right'
  const hasChoices = choices.length > 0

  return (
    <div className={`flex w-full items-end gap-3 ${isRight ? 'flex-row-reverse' : ''}`}>
      <div className="flex h-14 w-14 shrink-0 items-center justify-center border-2 border-slate-900 bg-amber-100 text-xl font-black text-slate-900 shadow-[3px_3px_0_rgba(15,23,42,0.35)]">
        {avatar ?? speaker.slice(0, 1).toUpperCase()}
      </div>
      <div className={`max-w-[min(34rem,calc(100vw-6rem))] ${isRight ? 'items-end' : 'items-start'} flex flex-col`}>
        <div className="mb-1 px-1 text-[11px] font-black uppercase tracking-wide text-slate-600">
          {speaker}
        </div>
        <div className="relative border-2 border-slate-900 bg-amber-50 px-4 py-3 text-sm font-semibold leading-relaxed text-slate-900 shadow-[4px_4px_0_rgba(15,23,42,0.45)]">
          {text}
          {children && <div className="mt-3">{children}</div>}
          <div
            className={`absolute bottom-3 h-4 w-4 rotate-45 border-b-2 border-slate-900 bg-amber-50 ${
              isRight ? '-right-[9px] border-r-2' : '-left-[9px] border-l-2'
            }`}
          />
        </div>
        {(hasChoices || onContinue) && (
          <div className={`mt-2 flex flex-wrap gap-2 ${isRight ? 'justify-end' : 'justify-start'}`}>
            {choices.map((choice) => (
              <button
                key={choice.id}
                type="button"
                disabled={disabled || loading || choice.disabled}
                onClick={() => onChoice?.(choice)}
                className="border-2 border-slate-900 bg-white px-3 py-2 text-sm font-black text-slate-800 shadow-[3px_3px_0_rgba(15,23,42,0.35)] transition hover:-translate-y-0.5 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {choice.label}
              </button>
            ))}
            {!hasChoices && onContinue && (
              <button
                type="button"
                disabled={disabled || loading}
                onClick={onContinue}
                className="border-2 border-slate-950 bg-slate-900 px-4 py-2 text-sm font-black text-white shadow-[3px_3px_0_rgba(15,23,42,0.35)] transition hover:-translate-y-0.5 hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? 'Please wait...' : continueLabel}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
