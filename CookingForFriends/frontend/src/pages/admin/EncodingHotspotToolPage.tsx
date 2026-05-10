import { useMemo, useRef, useState } from 'react'
import type { PointerEvent } from 'react'

interface Rect {
  x: number
  y: number
  width: number
  height: number
}

const DEFAULT_FRAME_WIDTH = 1112
const DEFAULT_FRAME_HEIGHT = 834

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
  const [videoSrc, setVideoSrc] = useState('/assets/encoding/t1_mei_s1.mp4')
  const [targetId, setTargetId] = useState('game_controller')
  const [targetLabel, setTargetLabel] = useState('Game controller')
  const [frameWidth, setFrameWidth] = useState(DEFAULT_FRAME_WIDTH)
  const [frameHeight, setFrameHeight] = useState(DEFAULT_FRAME_HEIGHT)
  const [rect, setRect] = useState<Rect>({ x: 311, y: 600, width: 222, height: 133 })
  const [dragging, setDragging] = useState(false)

  const rectStyle = useMemo(() => ({
    left: `${(rect.x / frameWidth) * 100}%`,
    top: `${(rect.y / frameHeight) * 100}%`,
    width: `${(rect.width / frameWidth) * 100}%`,
    height: `${(rect.height / frameHeight) * 100}%`,
    transform: 'translate(-50%, -50%)',
  }), [frameHeight, frameWidth, rect])

  const output = useMemo(() => JSON.stringify({
    id: targetId,
    label: targetLabel,
    hint: `Click the ${targetLabel}`,
    ...roundRect(rect),
  }, null, 2), [rect, targetId, targetLabel])

  const pointerToFrame = (event: PointerEvent<HTMLDivElement>) => {
    const bounds = frameRef.current?.getBoundingClientRect()
    if (!bounds) return null
    return {
      x: clamp(((event.clientX - bounds.left) / bounds.width) * frameWidth, 0, frameWidth),
      y: clamp(((event.clientY - bounds.top) / bounds.height) * frameHeight, 0, frameHeight),
    }
  }

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
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
    <div className="min-h-screen bg-slate-100 p-6 text-slate-900">
      <div className="mx-auto max-w-6xl">
        <div className="mb-5">
          <h1 className="text-2xl font-bold">Encoding Hotspot Tool</h1>
          <p className="mt-1 text-sm text-slate-600">
            Draw a rectangle over the video frame. Coordinates are saved in the original 1112 x 834 video coordinate system.
          </p>
        </div>

        <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
          <div className="rounded-lg border border-slate-300 bg-white p-4 shadow-sm">
            <div
              ref={frameRef}
              className="relative overflow-hidden rounded-md bg-slate-950"
              style={{ aspectRatio: `${frameWidth} / ${frameHeight}` }}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
            >
              {videoSrc ? (
                <video
                  key={videoSrc}
                  className="h-full w-full object-cover opacity-80"
                  src={videoSrc}
                  muted
                  playsInline
                  controls
                />
              ) : null}
              <div
                className="pointer-events-none absolute rounded-lg border-2 border-amber-300 bg-amber-300/20 shadow-[0_0_0_8px_rgba(251,191,36,0.18)]"
                style={rectStyle}
              >
                <div className="absolute -top-7 left-0 rounded bg-slate-950 px-2 py-1 text-xs font-semibold text-white">
                  {targetLabel}
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-lg border border-slate-300 bg-white p-4 shadow-sm">
              <label className="block text-sm font-semibold text-slate-700" htmlFor="video-src">Video path</label>
              <input
                id="video-src"
                value={videoSrc}
                onChange={(event) => setVideoSrc(event.target.value)}
                className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />

              <div className="mt-4 grid grid-cols-2 gap-3">
                <label className="block text-sm font-semibold text-slate-700">
                  Frame width
                  <input
                    type="number"
                    value={frameWidth}
                    onChange={(event) => setFrameWidth(Number(event.target.value) || DEFAULT_FRAME_WIDTH)}
                    className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  />
                </label>
                <label className="block text-sm font-semibold text-slate-700">
                  Frame height
                  <input
                    type="number"
                    value={frameHeight}
                    onChange={(event) => setFrameHeight(Number(event.target.value) || DEFAULT_FRAME_HEIGHT)}
                    className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  />
                </label>
              </div>

              <label className="mt-4 block text-sm font-semibold text-slate-700" htmlFor="target-id">Target id</label>
              <input
                id="target-id"
                value={targetId}
                onChange={(event) => setTargetId(event.target.value)}
                className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />

              <label className="mt-4 block text-sm font-semibold text-slate-700" htmlFor="target-label">Target label</label>
              <input
                id="target-label"
                value={targetLabel}
                onChange={(event) => setTargetLabel(event.target.value)}
                className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </div>

            <div className="rounded-lg border border-slate-300 bg-white p-4 shadow-sm">
              <h2 className="text-sm font-bold text-slate-800">click_target JSON</h2>
              <pre className="mt-3 max-h-72 overflow-auto rounded-md bg-slate-950 p-3 text-xs text-slate-100">
                {output}
              </pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
