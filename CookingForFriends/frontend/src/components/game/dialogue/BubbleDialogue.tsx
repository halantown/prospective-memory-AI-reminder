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
      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-md border border-slate-300 bg-slate-100 text-xl shadow-sm">
        {avatar ?? speaker.slice(0, 1).toUpperCase()}
      </div>
      <div className={`max-w-[min(34rem,calc(100vw-6rem))] ${isRight ? 'items-end' : 'items-start'} flex flex-col`}>
        <div className="mb-1 px-1 text-xs font-bold uppercase tracking-wide text-slate-500">
          {speaker}
        </div>
        <div className="rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm leading-relaxed text-slate-800 shadow-lg">
          {text}
          {children && <div className="mt-3">{children}</div>}
        </div>
        {(hasChoices || onContinue) && (
          <div className={`mt-2 flex flex-wrap gap-2 ${isRight ? 'justify-end' : 'justify-start'}`}>
            {choices.map((choice) => (
              <button
                key={choice.id}
                type="button"
                disabled={disabled || loading || choice.disabled}
                onClick={() => onChoice?.(choice)}
                className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:border-amber-400 hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {choice.label}
              </button>
            ))}
            {!hasChoices && onContinue && (
              <button
                type="button"
                disabled={disabled || loading}
                onClick={onContinue}
                className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
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

