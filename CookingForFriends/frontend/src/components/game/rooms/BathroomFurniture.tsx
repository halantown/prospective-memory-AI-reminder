/** Bathroom furniture — plant pots, washing machine, drying rack, garden supplies. */

import { C } from './furniture/styles'

export default function BathroomFurniture() {
  return (
    <svg
      className="absolute inset-0 w-full h-full"
      viewBox="0 0 400 300"
      preserveAspectRatio="none"
    >
      {/* ── Plant pots (top row) ── */}
      {/* Pot 1 — reddish with green plant */}
      <rect x="30" y="55" width="55" height="38" rx="5" fill={C.potRed} />
      <ellipse cx="57" cy="42" rx="26" ry="18" fill={C.plant} />
      <ellipse cx="50" cy="38" rx="10" ry="12" fill={C.plantDark} opacity="0.6" />

      {/* Pot 2 — cream with pink flowers */}
      <rect x="140" y="55" width="55" height="38" rx="5" fill={C.potCream} />
      <ellipse cx="167" cy="42" rx="24" ry="16" fill={C.plantPink} opacity="0.7" />
      <ellipse cx="160" cy="38" rx="10" ry="10" fill={C.plant} opacity="0.5" />

      {/* Pot 3 — green with dark foliage */}
      <rect x="250" y="55" width="55" height="38" rx="5" fill={C.potGreen} />
      <ellipse cx="277" cy="42" rx="26" ry="18" fill={C.plantDark} />
      <ellipse cx="270" cy="36" rx="12" ry="14" fill={C.plant} opacity="0.7" />

      {/* ── Washing machine (mid-left) ── */}
      <rect x="25" y="125" width="115" height="100" rx="5" fill={C.washer} />
      {/* Control panel */}
      <rect x="35" y="130" width="95" height="20" rx="2" fill={C.controlPanel} />
      <circle cx="55" cy="140" r="4" fill="#9AAABA" />
      <circle cx="72" cy="140" r="4" fill="#9AAABA" />
      <rect x="85" y="135" width="35" height="10" rx="2" fill="#5A6A7A" />
      {/* Door */}
      <circle cx="82" cy="185" r="32" fill={C.washerDoor} stroke="#8A9AAA" strokeWidth="1.5" />
      <circle cx="82" cy="185" r="24" fill={C.washerInner} />

      {/* ── Drying rack (mid-right) ── */}
      <rect
        x="175" y="125" width="200" height="100" rx="4"
        fill="none" stroke={C.dryingRack} strokeWidth="2" strokeDasharray="8 5"
      />
      {/* Rack bars */}
      <line x1="190" y1="155" x2="360" y2="155" stroke={C.dryingRack} strokeWidth="1.5" opacity="0.6" />
      <line x1="190" y1="175" x2="360" y2="175" stroke={C.dryingRack} strokeWidth="1.5" opacity="0.6" />
      <line x1="190" y1="195" x2="360" y2="195" stroke={C.dryingRack} strokeWidth="1.5" opacity="0.6" />

      {/* ── Garden supplies (bottom) ── */}
      <rect x="35" y="255" width="28" height="24" rx="4" fill={C.waterCan} />
      <rect x="55" y="252" width="6" height="10" rx="1" fill={C.waterCan} opacity="0.7" />
      <rect x="85" y="258" width="24" height="21" rx="4" fill={C.fertilizer} />
      <text x="148" y="274" fill={C.label} fontSize="10" fontFamily="sans-serif" opacity="0.6">
        Supplies
      </text>
    </svg>
  )
}
