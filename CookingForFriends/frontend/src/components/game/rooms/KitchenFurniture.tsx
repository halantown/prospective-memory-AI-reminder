/** Kitchen furniture — image sprites for each cooking station.
 *
 *  Each station renders an <img> from /assets/kitchen/<station>.png.
 *  If the image hasn't been created yet the component falls back to a
 *  labelled placeholder div so the layout is always visible.
 *
 *  Positions exactly mirror STATION_POSITIONS in KitchenRoom.tsx so that
 *  the transparent hotspot buttons overlay each furniture image correctly.
 *
 *  To swap in a real asset: drop the PNG at public/assets/kitchen/<id>.png
 *  — no code changes needed.
 */

import { useState } from 'react'

interface StationDef {
  id: string
  label: string
  emoji: string
  style: React.CSSProperties
  /** Accent colour for the placeholder fallback */
  accent: string
}

const STATIONS: StationDef[] = [
  {
    id: 'fridge',
    label: 'Fridge',
    emoji: '🧊',
    style: { left: '78%', top: '2%', width: '20%', height: '32%' },
    accent: '#3A5A7A',
  },
  {
    id: 'cutting_board',
    label: 'Cutting Board',
    emoji: '🔪',
    style: { left: '22%', top: '2%', width: '28%', height: '14%' },
    accent: '#6B4C2A',
  },
  {
    id: 'spice_rack',
    label: 'Spice Rack',
    emoji: '🧂',
    style: { left: '2%', top: '72%', width: '25%', height: '20%' },
    accent: '#5A4A3A',
  },
  {
    id: 'burner1',
    label: 'Burner 1',
    emoji: '🔥',
    style: { left: '18%', top: '32%', width: '20%', height: '30%' },
    accent: '#6A3A1A',
  },
  {
    id: 'burner2',
    label: 'Burner 2',
    emoji: '🔥',
    style: { left: '40%', top: '32%', width: '20%', height: '30%' },
    accent: '#6A3A1A',
  },
  {
    id: 'burner3',
    label: 'Burner 3',
    emoji: '🔥',
    style: { left: '60%', top: '32%', width: '20%', height: '30%' },
    accent: '#6A3A1A',
  },
  {
    id: 'oven',
    label: 'Oven',
    emoji: '♨️',
    style: { left: '65%', top: '70%', width: '33%', height: '28%' },
    accent: '#3A3A5A',
  },
  {
    id: 'plating_area',
    label: 'Plating',
    emoji: '🍽️',
    style: { left: '52%', top: '2%', width: '24%', height: '14%' },
    accent: '#4A5A4A',
  },
]

function StationSprite({ station }: { station: StationDef }) {
  const [imgFailed, setImgFailed] = useState(false)

  return (
    <div
      className="absolute"
      style={station.style}
    >
      {!imgFailed ? (
        <img
          src={`/assets/kitchen/${station.id}.png`}
          alt={station.label}
          className="w-full h-full object-contain"
          onError={() => setImgFailed(true)}
          draggable={false}
        />
      ) : (
        /* Placeholder — dashed outline only, won't obscure floorplan */
        <div
          className="w-full h-full rounded flex flex-col items-center justify-center gap-0.5 border border-dashed border-white/20"
        >
          <span className="text-[10px] leading-none opacity-50">{station.emoji}</span>
        </div>
      )}
    </div>
  )
}

export default function KitchenFurniture() {
  return (
    <div className="absolute inset-0">
      {STATIONS.map((s) => (
        <StationSprite key={s.id} station={s} />
      ))}
    </div>
  )
}
