/** Hallway furniture — connecting corridor with front door, coat rack, shoe shelf. */

import { C } from './furniture/styles'

export default function HallwayFurniture() {
  return (
    <svg
      className="absolute inset-0 w-full h-full"
      viewBox="0 0 400 300"
      preserveAspectRatio="xMidYMid meet"
    >
      {/* ── Floor runner / rug ── */}
      <rect x="40" y="100" width="320" height="60" rx="4" fill="#3A3530" opacity="0.5" />
      <rect x="50" y="105" width="300" height="50" rx="2" fill="none" stroke="#4A4540" strokeWidth="1" strokeDasharray="8 4" />

      {/* ── Coat rack (left wall) ── */}
      <rect x="10" y="20" width="8" height="120" rx="2" fill={C.darkWood} />
      <circle cx="14" cy="30" r="6" fill="none" stroke={C.wood} strokeWidth="1.5" />
      <circle cx="14" cy="55" r="6" fill="none" stroke={C.wood} strokeWidth="1.5" />
      {/* Hanging coat */}
      <path d="M 8 30 L 2 60 L 26 60 L 20 30" fill="#5A4A6A" opacity="0.6" />

      {/* ── Shoe shelf (left wall, lower) ── */}
      <rect x="5" y="180" width="60" height="45" rx="2" fill={C.shelf} />
      <rect x="5" y="180" width="60" height="3" fill={C.shelfEdge} />
      <rect x="5" y="200" width="60" height="2" fill={C.shelfEdge} />
      {/* Shoes */}
      <ellipse cx="20" cy="190" rx="8" ry="4" fill="#4A3A2A" />
      <ellipse cx="40" cy="190" rx="8" ry="4" fill="#3A4A5A" />
      <ellipse cx="20" cy="212" rx="8" ry="4" fill="#5A3A3A" />

      {/* ── Console table (top wall) ── */}
      <rect x="140" y="10" width="120" height="30" rx="2" fill={C.wood} />
      <rect x="140" y="10" width="120" height="3" fill={C.tableEdge} />
      {/* Keys bowl */}
      <ellipse cx="170" cy="25" rx="12" ry="6" fill={C.sinkOuter} />
      {/* Mail */}
      <rect x="210" y="18" width="30" height="18" rx="1" fill={C.calendarWhite} opacity="0.4" />

      {/* ── Front door (right wall) ── */}
      <rect x="340" y="60" width="55" height="180" rx="3" fill="#4A3828" />
      <rect x="345" y="65" width="45" height="170" rx="2" fill="#5A4838" />
      {/* Door handle */}
      <circle cx="380" cy="150" r="4" fill="#8A7A5A" />
      {/* Peephole */}
      <circle cx="367" cy="110" r="3" fill="#2A2018" stroke="#6A5A4A" strokeWidth="1" />
      {/* Door frame */}
      <rect x="336" y="55" width="4" height="190" fill="#6A5A4A" />
      <rect x="336" y="55" width="63" height="4" fill="#6A5A4A" />

      {/* ── Welcome mat ── */}
      <rect x="348" y="245" width="44" height="25" rx="2" fill="#5A6A4A" />
      <text x="370" y="261" textAnchor="middle" fill="#8A9A7A" fontSize="7" fontFamily="sans-serif">
        WELCOME
      </text>

      {/* ── Label ── */}
      <text x="200" y="285" textAnchor="middle" fill={C.label} fontSize="10" fontFamily="sans-serif" opacity="0.5">
        🚪 Front Door →
      </text>
    </svg>
  )
}
