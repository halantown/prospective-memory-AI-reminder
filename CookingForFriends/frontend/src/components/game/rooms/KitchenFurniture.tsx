/** Kitchen furniture — top-down floor plan with counter, sink, stovetop, shelf, oven. */

import { C } from './furniture/styles'

export default function KitchenFurniture() {
  return (
    <svg
      className="absolute inset-0 w-full h-full"
      viewBox="0 0 400 300"
      preserveAspectRatio="none"
    >
      {/* ── L-shaped counter along top ── */}
      <rect x="0" y="0" width="275" height="40" rx="2" fill={C.cabinet} />

      {/* Sink */}
      <rect x="12" y="6" width="60" height="28" rx="3" fill={C.sinkOuter} />
      <ellipse cx="42" cy="20" rx="20" ry="9" fill={C.sinkInner} stroke={C.sinkRim} strokeWidth="1" />

      {/* Counter surface */}
      <rect x="85" y="6" width="140" height="28" rx="2" fill={C.counter} />

      {/* ── Fridge (top-right) ── */}
      <rect x="330" y="0" width="70" height="95" rx="3" fill={C.fridge} />
      <line x1="365" y1="4" x2="365" y2="91" stroke="#6A7A8A" strokeWidth="1" />
      <circle cx="358" cy="28" r="2.5" fill="#9AAABA" />
      <circle cx="358" cy="62" r="2.5" fill="#9AAABA" />

      {/* ── Stovetop (center) ── */}
      <rect x="70" y="95" width="260" height="100" rx="4" fill={C.stovetop} />
      {/* Burner 1 — active */}
      <circle cx="140" cy="145" r="30" fill="none" stroke={C.burnerActive} strokeWidth="2.5" opacity="0.6" />
      <circle cx="140" cy="145" r="18" fill={C.burnerGlow} opacity="0.3" />
      {/* Burner 2 — active */}
      <circle cx="215" cy="145" r="30" fill="none" stroke={C.burnerActive} strokeWidth="2.5" opacity="0.6" />
      <circle cx="215" cy="145" r="18" fill={C.burnerGlow} opacity="0.3" />
      {/* Burner 3 — idle */}
      <circle cx="290" cy="145" r="30" fill="none" stroke={C.burnerIdle} strokeWidth="1.5" strokeDasharray="5 4" />

      {/* ── Shelf (bottom-left) ── */}
      <rect x="8" y="220" width="215" height="38" rx="2" fill={C.shelf} />
      <rect x="8" y="220" width="215" height="3" fill={C.shelfEdge} />
      {/* Bottles */}
      <rect x="22" y="229" width="14" height="22" rx="2" fill={C.bottleRed} />
      <rect x="46" y="231" width="14" height="20" rx="2" fill={C.bottleBlue} />
      <rect x="70" y="230" width="14" height="21" rx="2" fill={C.bottleGreen} />
      <rect x="94" y="232" width="12" height="19" rx="2" fill={C.bottleNeutral} />
      <rect x="116" y="229" width="14" height="22" rx="2" fill={C.bottleNeutral} />

      {/* ── Oven (bottom-right) ── */}
      <rect x="260" y="215" width="132" height="80" rx="3" fill={C.oven} />
      <rect x="272" y="228" width="108" height="48" rx="2" fill={C.ovenDoor} stroke="#5A6575" strokeWidth="1" />
      <circle cx="355" cy="285" r="3.5" fill={C.burnerActive} opacity="0.5" />
      <text x="326" y="256" textAnchor="middle" fill={C.label} fontSize="11" fontFamily="sans-serif">
        OVEN
      </text>
    </svg>
  )
}
