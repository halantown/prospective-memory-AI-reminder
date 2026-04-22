/** Kitchen furniture — top-down floor plan with all cooking stations.
 *  Stations: fridge (top-right), cutting board (upper counter),
 *  3 burners (center), oven (bottom-right), spice rack (lower-left),
 *  plating area (upper counter, right of cutting board).
 */

import { C } from './furniture/styles'

export default function KitchenFurniture() {
  return (
    <svg
      className="absolute inset-0 w-full h-full"
      viewBox="0 0 400 300"
      preserveAspectRatio="xMidYMid meet"
    >
      {/* ── Counter along top ── */}
      <rect x="0" y="0" width="310" height="42" rx="2" fill={C.cabinet} />

      {/* Sink (left of counter) */}
      <rect x="8" y="5" width="55" height="32" rx="3" fill={C.sinkOuter} />
      <ellipse cx="36" cy="21" rx="18" ry="10" fill={C.sinkInner} stroke={C.sinkRim} strokeWidth="1" />

      {/* Cutting board station */}
      <rect x="88" y="5" width="110" height="32" rx="2" fill="#C4A46C" />
      <rect x="92" y="9" width="102" height="24" rx="1" fill="#D4B87A" />
      <text x="143" y="25" textAnchor="middle" fill="#7A5C30" fontSize="8" fontFamily="sans-serif">🔪 CUTTING BOARD</text>

      {/* Plating area station */}
      <rect x="208" y="5" width="96" height="32" rx="2" fill={C.counter} />
      <rect x="214" y="9" width="84" height="24" rx="1" fill="#E0E5EA" stroke="#B0B8C2" strokeWidth="0.5" />
      <text x="256" y="25" textAnchor="middle" fill="#6A7A8A" fontSize="8" fontFamily="sans-serif">🍽️ PLATING</text>

      {/* ── Fridge (top-right) ── */}
      <rect x="318" y="0" width="82" height="95" rx="3" fill={C.fridge} />
      <line x1="359" y1="4" x2="359" y2="91" stroke="#6A7A8A" strokeWidth="1" />
      <circle cx="352" cy="28" r="2.5" fill="#9AAABA" />
      <circle cx="352" cy="62" r="2.5" fill="#9AAABA" />
      <text x="359" y="50" textAnchor="middle" fill="#B0C0D0" fontSize="9" fontFamily="sans-serif">🧊</text>

      {/* ── Stovetop (center) — 3 burners ── */}
      <rect x="70" y="95" width="260" height="95" rx="4" fill={C.stovetop} />

      {/* Burner 1 */}
      <circle cx="135" cy="142" r="32" fill="none" stroke={C.burnerActive} strokeWidth="2.5" opacity="0.5" />
      <circle cx="135" cy="142" r="18" fill={C.burnerGlow} opacity="0.25" />
      <text x="135" y="147" textAnchor="middle" fill="#FF8844" fontSize="8" fontFamily="sans-serif" opacity="0.7">B1</text>

      {/* Burner 2 */}
      <circle cx="210" cy="142" r="32" fill="none" stroke={C.burnerActive} strokeWidth="2.5" opacity="0.5" />
      <circle cx="210" cy="142" r="18" fill={C.burnerGlow} opacity="0.25" />
      <text x="210" y="147" textAnchor="middle" fill="#FF8844" fontSize="8" fontFamily="sans-serif" opacity="0.7">B2</text>

      {/* Burner 3 */}
      <circle cx="285" cy="142" r="32" fill="none" stroke={C.burnerIdle} strokeWidth="1.5" strokeDasharray="5 4" />
      <text x="285" y="147" textAnchor="middle" fill="#8899AA" fontSize="8" fontFamily="sans-serif" opacity="0.7">B3</text>

      {/* ── Spice rack (bottom-left shelf) ── */}
      <rect x="8" y="218" width="100" height="60" rx="2" fill={C.shelf} />
      <rect x="8" y="218" width="100" height="3" fill={C.shelfEdge} />
      <text x="58" y="237" textAnchor="middle" fill={C.label} fontSize="8" fontFamily="sans-serif">🧂 SPICE RACK</text>
      {/* Bottles */}
      <rect x="18" y="243" width="12" height="18" rx="2" fill={C.bottleRed} />
      <rect x="36" y="245" width="12" height="16" rx="2" fill={C.bottleBlue} />
      <rect x="54" y="244" width="12" height="17" rx="2" fill={C.bottleGreen} />
      <rect x="72" y="246" width="10" height="15" rx="2" fill={C.bottleNeutral} />
      <rect x="88" y="243" width="12" height="18" rx="2" fill={C.bottleNeutral} />

      {/* ── Oven (bottom-right) ── */}
      <rect x="262" y="210" width="135" height="85" rx="3" fill={C.oven} />
      <rect x="274" y="224" width="111" height="50" rx="2" fill={C.ovenDoor} stroke="#5A6575" strokeWidth="1" />
      <circle cx="360" cy="285" r="3.5" fill={C.burnerActive} opacity="0.5" />
      <text x="330" y="252" textAnchor="middle" fill={C.label} fontSize="10" fontFamily="sans-serif">♨️ OVEN</text>
    </svg>
  )
}
