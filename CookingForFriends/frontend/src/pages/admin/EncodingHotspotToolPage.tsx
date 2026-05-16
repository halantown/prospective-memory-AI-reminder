import { useMemo, useRef, useState } from 'react'
import type { PointerEvent } from 'react'
import { Check, Copy, MousePointerClick } from 'lucide-react'

interface Rect {
  x: number
  y: number
  width: number
  height: number
}

const DEFAULT_FRAME_WIDTH = 1112
const DEFAULT_FRAME_HEIGHT = 834

interface SegmentPreset {
  key: string
  taskId: string
  episodeLabel: string
  segmentIndex: number
  segmentId: string
  videoSrc: string
  targetId: string
  targetLabel: string
  frameWidth: number
  frameHeight: number
  rect: Rect
}

const SEGMENT_PRESETS: SegmentPreset[] = [
  {
    key: 'T1-0',
    taskId: 'T1',
    episodeLabel: 'Mei episode',
    segmentIndex: 0,
    segmentId: 'segment1',
    videoSrc: '/assets/encoding/t1/segment1.mp4',
    targetId: 'game_controller',
    targetLabel: 'Game controller',
    frameWidth: 1112,
    frameHeight: 834,
    rect: { x: 509, y: 525, width: 144, height: 101 },
  },
  {
    key: 'T1-1',
    taskId: 'T1',
    episodeLabel: 'Mei episode',
    segmentIndex: 1,
    segmentId: 'segment2',
    videoSrc: '/assets/encoding/t1/segment2.mp4',
    targetId: 'snack_box',
    targetLabel: 'Snack box',
    frameWidth: 1112,
    frameHeight: 834,
    rect: { x: 486, y: 539, width: 201, height: 157 },
  },
  {
    key: 'T1-2',
    taskId: 'T1',
    episodeLabel: 'Mei episode',
    segmentIndex: 2,
    segmentId: 'segment3',
    videoSrc: '/assets/encoding/t1/segment3.mp4',
    targetId: 'baking_book_bubble',
    targetLabel: 'Baking book',
    frameWidth: 1112,
    frameHeight: 834,
    rect: { x: 906, y: 248, width: 174, height: 167 },
  },
  {
    key: 'T1-3',
    taskId: 'T1',
    episodeLabel: 'Mei episode',
    segmentIndex: 3,
    segmentId: 'segment4',
    videoSrc: '/assets/encoding/t1/segment4.mp4',
    targetId: 'continue',
    targetLabel: 'Continue',
    frameWidth: 1112,
    frameHeight: 834,
    rect: { x: 845, y: 651, width: 178, height: 83 },
  },
  {
    key: 'T2-0',
    taskId: 'T2',
    episodeLabel: 'Anna-Lina episode',
    segmentIndex: 0,
    segmentId: 'segment1',
    videoSrc: '/assets/encoding/t2/segment1.mp4',
    targetId: 'gift_bag',
    targetLabel: 'Gift bag',
    frameWidth: 1112,
    frameHeight: 834,
    rect: { x: 712, y: 517, width: 200, height: 183 },
  },
  {
    key: 'T2-1',
    taskId: 'T2',
    episodeLabel: 'Anna-Lina episode',
    segmentIndex: 1,
    segmentId: 'segment2',
    videoSrc: '/assets/encoding/t2/segment2.mp4',
    targetId: 'postcard',
    targetLabel: 'Postcard',
    frameWidth: 1112,
    frameHeight: 834,
    rect: { x: 500, y: 567, width: 222, height: 108 },
  },
  {
    key: 'T2-2',
    taskId: 'T2',
    episodeLabel: 'Anna-Lina episode',
    segmentIndex: 2,
    segmentId: 'segment3',
    videoSrc: '/assets/encoding/t2/segment3.mp4',
    targetId: 'chocolate',
    targetLabel: 'Chocolate',
    frameWidth: 1112,
    frameHeight: 834,
    rect: { x: 589, y: 525, width: 200, height: 100 },
  },
  {
    key: 'T2-3',
    taskId: 'T2',
    episodeLabel: 'Anna-Lina episode',
    segmentIndex: 3,
    segmentId: 'segment4',
    videoSrc: '/assets/encoding/t2/segment4.mp4',
    targetId: 'continue',
    targetLabel: 'Continue',
    frameWidth: 1112,
    frameHeight: 834,
    rect: { x: 845, y: 651, width: 178, height: 83 },
  },
  {
    key: 'T3-0',
    taskId: 'T3',
    episodeLabel: 'Tom episode',
    segmentIndex: 0,
    segmentId: 'segment1',
    videoSrc: '/assets/encoding/t3/segment1.mp4',
    targetId: 'bluetooth_speaker',
    targetLabel: 'Bluetooth speaker',
    frameWidth: 1112,
    frameHeight: 834,
    rect: { x: 334, y: 550, width: 200, height: 117 },
  },
  {
    key: 'T3-1',
    taskId: 'T3',
    episodeLabel: 'Tom episode',
    segmentIndex: 1,
    segmentId: 'segment2',
    videoSrc: '/assets/encoding/t3/segment2.mp4',
    targetId: 'apple_juice',
    targetLabel: 'Apple juice',
    frameWidth: 1112,
    frameHeight: 834,
    rect: { x: 645, y: 467, width: 156, height: 183 },
  },
  {
    key: 'T3-2',
    taskId: 'T3',
    episodeLabel: 'Tom episode',
    segmentIndex: 2,
    segmentId: 'segment3',
    videoSrc: '/assets/encoding/t3/segment3.mp4',
    targetId: 'cooler_box',
    targetLabel: 'Cooler box',
    frameWidth: 1112,
    frameHeight: 834,
    rect: { x: 689, y: 600, width: 245, height: 142 },
  },
  {
    key: 'T3-3',
    taskId: 'T3',
    episodeLabel: 'Tom episode',
    segmentIndex: 3,
    segmentId: 'segment4',
    videoSrc: '/assets/encoding/t3/segment4.mp4',
    targetId: 'continue',
    targetLabel: 'Continue',
    frameWidth: 1112,
    frameHeight: 834,
    rect: { x: 845, y: 651, width: 178, height: 83 },
  },
  {
    key: 'T4-0',
    taskId: 'T4',
    episodeLabel: 'Delivery person episode',
    segmentIndex: 0,
    segmentId: 'segment1',
    videoSrc: '/assets/encoding/t4/segment1.mp4',
    targetId: 'neighbor',
    targetLabel: 'Neighbor',
    frameWidth: 1112,
    frameHeight: 834,
    rect: { x: 423, y: 400, width: 200, height: 284 },
  },
  {
    key: 'T4-1',
    taskId: 'T4',
    episodeLabel: 'Delivery person episode',
    segmentIndex: 1,
    segmentId: 'segment2',
    videoSrc: '/assets/encoding/t4/segment2.mp4',
    targetId: 'delivery_boxes',
    targetLabel: 'Delivery boxes',
    frameWidth: 1112,
    frameHeight: 834,
    rect: { x: 600, y: 584, width: 267, height: 150 },
  },
  {
    key: 'T4-2',
    taskId: 'T4',
    episodeLabel: 'Delivery person episode',
    segmentIndex: 2,
    segmentId: 'segment3',
    videoSrc: '/assets/encoding/t4/segment3.mp4',
    targetId: 'front_door',
    targetLabel: 'Front door',
    frameWidth: 1112,
    frameHeight: 834,
    rect: { x: 778, y: 292, width: 200, height: 367 },
  },
  {
    key: 'T4-3',
    taskId: 'T4',
    episodeLabel: 'Delivery person episode',
    segmentIndex: 3,
    segmentId: 'segment4',
    videoSrc: '/assets/encoding/t4/segment4.mp4',
    targetId: 'continue',
    targetLabel: 'Continue',
    frameWidth: 1112,
    frameHeight: 834,
    rect: { x: 845, y: 651, width: 178, height: 83 },
  },
]

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function roundRect(rect: Rect): Rect {
  return {
    x: Math.round(rect.x),
    y: Math.round(rect.y),
    width: Math.round(rect.width),
    height: Math.round(rect.height),
  }
}

export default function EncodingHotspotToolPage() {
  const frameRef = useRef<HTMLDivElement | null>(null)
  const dragStartRef = useRef<{ x: number; y: number } | null>(null)
  const [selectedKey, setSelectedKey] = useState(SEGMENT_PRESETS[0].key)
  const [rect, setRect] = useState<Rect>(SEGMENT_PRESETS[0].rect)
  const [dragging, setDragging] = useState(false)
  const [copied, setCopied] = useState(false)
  const [drawingEnabled, setDrawingEnabled] = useState(false)

  const selected = SEGMENT_PRESETS.find((preset) => preset.key === selectedKey) ?? SEGMENT_PRESETS[0]
  const frameWidth = selected.frameWidth || DEFAULT_FRAME_WIDTH
  const frameHeight = selected.frameHeight || DEFAULT_FRAME_HEIGHT

  const rectStyle = useMemo(() => ({
    left: `${(rect.x / frameWidth) * 100}%`,
    top: `${(rect.y / frameHeight) * 100}%`,
    width: `${(rect.width / frameWidth) * 100}%`,
    height: `${(rect.height / frameHeight) * 100}%`,
    transform: 'translate(-50%, -50%)',
  }), [frameHeight, frameWidth, rect])

  const output = useMemo(() => JSON.stringify({
    task_id: selected.taskId,
    segment_id: selected.segmentId,
    segment_index: selected.segmentIndex,
    id: selected.targetId,
    label: selected.targetLabel,
    hint: `Click the ${selected.targetLabel.toLowerCase()}`,
    ...roundRect(rect),
  }, null, 2), [rect, selected.segmentId, selected.segmentIndex, selected.targetId, selected.targetLabel, selected.taskId])

  const handlePresetChange = (key: string) => {
    const next = SEGMENT_PRESETS.find((preset) => preset.key === key) ?? SEGMENT_PRESETS[0]
    setSelectedKey(next.key)
    setRect(next.rect)
    setCopied(false)
    setDrawingEnabled(false)
  }

  const handleCopy = async () => {
    await navigator.clipboard.writeText(output)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1400)
  }

  const pointerToFrame = (event: PointerEvent<HTMLDivElement>) => {
    const bounds = frameRef.current?.getBoundingClientRect()
    if (!bounds) return null
    return {
      x: clamp(((event.clientX - bounds.left) / bounds.width) * frameWidth, 0, frameWidth),
      y: clamp(((event.clientY - bounds.top) / bounds.height) * frameHeight, 0, frameHeight),
    }
  }

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (!drawingEnabled) return
    const point = pointerToFrame(event)
    if (!point) return
    event.currentTarget.setPointerCapture(event.pointerId)
    dragStartRef.current = point
    setDragging(true)
    setRect({ x: point.x, y: point.y, width: 1, height: 1 })
  }

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!dragging || !dragStartRef.current) return
    const point = pointerToFrame(event)
    if (!point) return
    const start = dragStartRef.current
    const minX = Math.min(start.x, point.x)
    const maxX = Math.max(start.x, point.x)
    const minY = Math.min(start.y, point.y)
    const maxY = Math.max(start.y, point.y)
    setRect({
      x: minX + (maxX - minX) / 2,
      y: minY + (maxY - minY) / 2,
      width: Math.max(1, maxX - minX),
      height: Math.max(1, maxY - minY),
    })
  }

  const handlePointerUp = (event: PointerEvent<HTMLDivElement>) => {
    if (!dragging) return
    event.currentTarget.releasePointerCapture(event.pointerId)
    dragStartRef.current = null
    setDragging(false)
    setRect((current) => roundRect(current))
  }

  return (
    <main className="p-6 text-slate-900">
      <div className="mx-auto max-w-6xl">
        <p className="mb-5 text-sm text-slate-600">
          Select a segment, pause on the final interaction frame, then draw a rectangle over the target.
        </p>

        <div className="grid gap-5 lg:grid-cols-[1fr_380px]">
          <div className="rounded-lg border border-slate-300 bg-white p-4 shadow-sm">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {selected.taskId} · Segment {selected.segmentIndex + 1} / 4
                </p>
                <h2 className="text-base font-bold text-slate-900">{selected.episodeLabel}</h2>
              </div>
              <div className="rounded-md bg-slate-100 px-3 py-2 text-xs font-mono text-slate-700">
                {selected.videoSrc}
              </div>
            </div>
            <div
              ref={frameRef}
              className="relative overflow-hidden rounded-md bg-slate-950"
              style={{ aspectRatio: `${frameWidth} / ${frameHeight}` }}
            >
              {selected.videoSrc ? (
                <video
                  key={selected.videoSrc}
                  className="h-full w-full object-cover opacity-80"
                  src={selected.videoSrc}
                  playsInline
                  controls
                />
              ) : null}
              <div
                className="pointer-events-none absolute rounded-lg border-2 border-amber-300 bg-amber-300/20 shadow-[0_0_0_8px_rgba(251,191,36,0.18)]"
                style={rectStyle}
              >
                <div className="absolute -top-7 left-0 rounded bg-slate-950 px-2 py-1 text-xs font-semibold text-white">
                  {selected.targetLabel}
                </div>
              </div>
              {drawingEnabled && (
                <div
                  className="absolute inset-0 cursor-crosshair"
                  onPointerDown={handlePointerDown}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                />
              )}
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-slate-500">
                Coordinates are original video pixels for a {frameWidth} x {frameHeight} frame.
              </p>
              <button
                type="button"
                onClick={() => setDrawingEnabled((current) => !current)}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                  drawingEnabled
                    ? 'bg-amber-500 text-white hover:bg-amber-600'
                    : 'bg-slate-900 text-white hover:bg-slate-700'
                }`}
              >
                {drawingEnabled ? 'Draw mode on' : 'Preview mode'}
              </button>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-lg border border-slate-300 bg-white p-4 shadow-sm">
              <label className="block text-sm font-semibold text-slate-700" htmlFor="segment-preset">Segment</label>
              <select
                id="segment-preset"
                value={selectedKey}
                onChange={(event) => handlePresetChange(event.target.value)}
                className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
              >
                {SEGMENT_PRESETS.map((preset) => (
                  <option key={preset.key} value={preset.key}>
                    {preset.taskId} · {preset.episodeLabel} · S{preset.segmentIndex + 1} · {preset.targetLabel}
                  </option>
                ))}
              </select>

              <dl className="mt-4 space-y-3 rounded-md bg-slate-50 p-3 text-sm">
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Target id</dt>
                  <dd className="mt-1 font-mono text-slate-900">{selected.targetId}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Target label</dt>
                  <dd className="mt-1 text-slate-900">{selected.targetLabel}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Config location</dt>
                  <dd className="mt-1 font-mono text-xs text-slate-900">
                    tasks.{selected.taskId}.interactive_segments[{selected.segmentIndex}].click_target
                  </dd>
                </div>
              </dl>
            </div>

            <div className="rounded-lg border border-slate-300 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-sm font-bold text-slate-800">click_target JSON</h2>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="inline-flex items-center gap-1.5 rounded-md bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-700"
                >
                  {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
              <pre className="mt-3 max-h-72 overflow-auto rounded-md bg-slate-950 p-3 text-xs text-slate-100">
                {output}
              </pre>
              <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-950">
                <div className="mb-1 flex items-center gap-1.5 font-bold">
                  <MousePointerClick className="h-3.5 w-3.5" />
                  After drawing
                </div>
                Copy this JSON and replace the `click_target` object at the config location above in `backend/data/experiment_materials/encoding_materials.json`, then reload the participant encoding flow.
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
