import { useEffect, useMemo, useRef, useState } from 'react'
import { CheckCircle2, MousePointerClick, Play } from 'lucide-react'

export interface EncodingClickTarget {
  id: string
  label: string
  hint: string
  x: number
  y: number
  width: number
  height: number
}

export interface EncodingVideoSegment {
  id: string
  label: string
  src?: string
  duration_ms: number
  click_target: EncodingClickTarget
  placeholder?: string
}

interface InteractiveEncodingVideoProps {
  taskId: string
  title: string
  frameWidth?: number
  frameHeight?: number
  segments: EncodingVideoSegment[]
  loading?: boolean
  onSegmentViewed?: (segment: EncodingVideoSegment, segmentIndex: number, durationMs: number) => void
  onInteractionClick?: (segment: EncodingVideoSegment, segmentIndex: number, responseTimeMs: number) => void
  onComplete: () => void
}

type SegmentMode = 'playing' | 'waiting'

const FALLBACK_SEGMENTS: EncodingVideoSegment[] = [
  {
    id: 'segment1',
    label: 'Interaction 1',
    duration_ms: 3000,
    click_target: { id: 'interaction1', label: 'Interaction 1', hint: 'Click to continue', x: 42, y: 62, width: 18, height: 14 },
    placeholder: 'Encoding segment 1',
  },
  {
    id: 'segment2',
    label: 'Interaction 2',
    duration_ms: 3000,
    click_target: { id: 'interaction2', label: 'Interaction 2', hint: 'Click to continue', x: 46, y: 56, width: 18, height: 14 },
    placeholder: 'Encoding segment 2',
  },
  {
    id: 'segment3',
    label: 'Interaction 3',
    duration_ms: 3000,
    click_target: { id: 'interaction3', label: 'Interaction 3', hint: 'Click to continue', x: 50, y: 50, width: 18, height: 14 },
    placeholder: 'Encoding segment 3',
  },
  {
    id: 'segment4',
    label: 'Continue',
    duration_ms: 3000,
    click_target: { id: 'continue', label: 'Continue', hint: 'Continue', x: 74, y: 76, width: 16, height: 10 },
    placeholder: 'Encoding segment 4',
  },
]

export default function InteractiveEncodingVideo({
  taskId,
  title,
  frameWidth = 1112,
  frameHeight = 834,
  segments,
  loading = false,
  onSegmentViewed,
  onInteractionClick,
  onComplete,
}: InteractiveEncodingVideoProps) {
  const playableSegments = useMemo(
    () => (segments.length > 0 ? segments.slice(0, 4) : FALLBACK_SEGMENTS),
    [segments],
  )
  const [segmentIndex, setSegmentIndex] = useState(0)
  const [mode, setMode] = useState<SegmentMode>('playing')
  const [progress, setProgress] = useState(0)
  const segmentStartedAtRef = useRef(Date.now())
  const waitingStartedAtRef = useRef(Date.now())
  const viewedLoggedRef = useRef(false)

  const segment = playableSegments[segmentIndex]
  const target = segment.click_target
  const currentVideoSrc = segment.src
  const targetStyle = {
    left: `${(target.x / frameWidth) * 100}%`,
    top: `${(target.y / frameHeight) * 100}%`,
    width: `${(target.width / frameWidth) * 100}%`,
    height: `${(target.height / frameHeight) * 100}%`,
    transform: 'translate(-50%, -50%)',
  }

  useEffect(() => {
    setSegmentIndex(0)
    setMode('playing')
    setProgress(0)
    segmentStartedAtRef.current = Date.now()
    waitingStartedAtRef.current = Date.now()
    viewedLoggedRef.current = false
  }, [taskId, playableSegments])

  useEffect(() => {
    if (mode !== 'playing') return
    viewedLoggedRef.current = false
    segmentStartedAtRef.current = Date.now()
    setProgress(0)

    const durationMs = Math.max(segment.duration_ms, 1000)
    const tick = window.setInterval(() => {
      const elapsed = Date.now() - segmentStartedAtRef.current
      setProgress(Math.min(100, (elapsed / durationMs) * 100))
    }, 100)

    const timer = currentVideoSrc
      ? undefined
      : window.setTimeout(() => finishSegmentPlayback(), durationMs)

    return () => {
      window.clearInterval(tick)
      if (timer) window.clearTimeout(timer)
    }
  }, [currentVideoSrc, mode, segment, segmentIndex])

  function finishSegmentPlayback() {
    const elapsed = Date.now() - segmentStartedAtRef.current
    if (!viewedLoggedRef.current) {
      viewedLoggedRef.current = true
      onSegmentViewed?.(segment, segmentIndex, elapsed)
    }
    waitingStartedAtRef.current = Date.now()
    setProgress(100)
    setMode('waiting')
  }

  const handleTargetClick = () => {
    if (mode !== 'waiting' || loading) return
    onInteractionClick?.(segment, segmentIndex, Date.now() - waitingStartedAtRef.current)
    if (segmentIndex >= playableSegments.length - 1) {
      onComplete()
      return
    }
    setSegmentIndex((current) => current + 1)
    setMode('playing')
  }

  return (
    <div className="w-[min(880px,calc(100vw-3rem))] overflow-hidden rounded-lg border border-slate-300 bg-white shadow-xl">
      <div className="border-b border-slate-200 px-5 py-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Task {taskId} · Segment {segmentIndex + 1} / {playableSegments.length}
            </p>
            <h1 className="mt-1 text-lg font-bold text-slate-950">{title}</h1>
          </div>
          <div className="flex items-center gap-2 text-sm font-medium text-slate-600">
            {mode === 'playing' ? <Play className="h-4 w-4" /> : <MousePointerClick className="h-4 w-4" />}
            {mode === 'playing' ? 'Playing' : 'Waiting for click'}
          </div>
        </div>
      </div>

      <div className="relative bg-slate-950" style={{ aspectRatio: `${frameWidth} / ${frameHeight}` }}>
        {currentVideoSrc ? (
          <video
            key={`${currentVideoSrc}-${segment.id}`}
            className="h-full w-full object-cover opacity-80"
            src={currentVideoSrc}
            muted
            playsInline
            autoPlay
            onEnded={finishSegmentPlayback}
          />
        ) : null}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_40%_35%,rgba(250,250,250,0.10),transparent_35%),linear-gradient(135deg,rgba(15,23,42,0.10),rgba(15,23,42,0.70))]" />
        <div className="absolute left-5 top-5 max-w-md rounded-md bg-slate-950/75 px-4 py-3 text-sm leading-relaxed text-white shadow-lg">
          {segment.placeholder ?? segment.label}
        </div>

        {mode === 'waiting' && (
          <button
            type="button"
            aria-label={target.hint}
            title={target.hint}
            onClick={handleTargetClick}
            disabled={loading}
            className="absolute flex items-center justify-center rounded-lg border-2 border-amber-300 bg-amber-300/20 text-amber-100 shadow-[0_0_0_8px_rgba(251,191,36,0.18)] transition hover:bg-amber-300/30 disabled:cursor-wait disabled:opacity-70"
            style={targetStyle}
          >
            <span className="pointer-events-none absolute inset-0 rounded-lg border-2 border-amber-200 opacity-75 animate-ping" />
            <span className="rounded-md bg-slate-950/80 px-3 py-1 text-xs font-semibold">
              {loading ? 'Saving...' : target.label}
            </span>
          </button>
        )}
      </div>

      <div className="space-y-4 px-5 py-4">
        <div className="h-2 overflow-hidden rounded-full bg-slate-200">
          <div className="h-full bg-slate-900 transition-[width]" style={{ width: `${progress}%` }} />
        </div>
        <div className="grid grid-cols-4 gap-2">
          {playableSegments.map((item, index) => (
            <div
              key={item.id}
              title={item.label}
              className={`flex h-10 min-w-0 items-center justify-center rounded-md border px-1 text-xs font-semibold ${
                index < segmentIndex
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                  : index === segmentIndex
                    ? 'border-slate-900 bg-slate-100 text-slate-900'
                    : 'border-slate-200 bg-white text-slate-400'
              }`}
            >
              {index < segmentIndex ? <CheckCircle2 className="h-4 w-4" /> : <span className="truncate">{item.label}</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
