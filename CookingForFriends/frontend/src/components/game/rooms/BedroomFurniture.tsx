/** Bedroom furniture — table, chairs, plates, side table, cabinet. */

import { C } from './furniture/styles'

export default function BedroomFurniture() {
  return (
    <svg
      className="absolute inset-0 w-full h-full"
      viewBox="0 0 400 300"
      preserveAspectRatio="none"
    >
      {/* ── Chairs (top row) ── */}
      <rect x="108" y="52" width="44" height="22" rx="5" fill={C.chair} />
      <rect x="178" y="52" width="44" height="22" rx="5" fill={C.chair} />
      <rect x="248" y="52" width="44" height="22" rx="5" fill={C.chair} />

      {/* ── Dining table ── */}
      <rect x="80" y="80" width="240" height="140" rx="8" fill={C.table} />
      <rect x="80" y="80" width="240" height="3" rx="1" fill={C.tableEdge} opacity="0.5" />

      {/* Plates (2 rows × 3) */}
      <circle cx="135" cy="120" r="15" fill="none" stroke={C.plateRim} strokeWidth="1.5" />
      <circle cx="200" cy="120" r="15" fill="none" stroke={C.plateRim} strokeWidth="1.5" />
      <circle cx="265" cy="120" r="15" fill="none" stroke={C.plateRim} strokeWidth="1.5" />
      <circle cx="135" cy="175" r="15" fill="none" stroke={C.plateRim} strokeWidth="1.5" />
      <circle cx="200" cy="175" r="15" fill="none" stroke={C.plateRim} strokeWidth="1.5" />
      <circle cx="265" cy="175" r="15" fill="none" stroke={C.plateRim} strokeWidth="1.5" />

      {/* ── Chairs (bottom row) ── */}
      <rect x="108" y="228" width="44" height="22" rx="5" fill={C.chair} />
      <rect x="178" y="228" width="44" height="22" rx="5" fill={C.chair} />
      <rect x="248" y="228" width="44" height="22" rx="5" fill={C.chair} />

      {/* ── Side table (bottom-left) ── */}
      <rect x="8" y="260" width="120" height="34" rx="3" fill={C.coffeeTable} />
      <circle cx="40" cy="277" r="7" fill="none" stroke={C.plateRim} strokeWidth="1" />
      <circle cx="68" cy="277" r="7" fill="none" stroke={C.plateRim} strokeWidth="1" />

      {/* ── Cabinet (bottom-right) ── */}
      <rect x="310" y="260" width="82" height="34" rx="2" fill={C.fileCabinet} />
      <circle cx="340" cy="277" r="2" fill="#8A9AAA" />
      <circle cx="362" cy="277" r="2" fill="#8A9AAA" />
    </svg>
  )
}
