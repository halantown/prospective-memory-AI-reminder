/** Living room furniture — TV, coffee table, sofa, bookshelf, entrance. */

import { C } from './furniture/styles'

export default function LivingFurniture() {
  return (
    <svg
      className="absolute inset-0 w-full h-full"
      viewBox="0 0 400 300"
      preserveAspectRatio="xMidYMid meet"
    >
      {/* ── TV (top) ── */}
      <rect x="95" y="12" width="200" height="14" rx="2" fill={C.tv} />
      <rect x="185" y="26" width="20" height="8" fill={C.tvStand} />
      <rect x="170" y="34" width="50" height="4" rx="2" fill={C.tvStand} />

      {/* ── Coffee table ── */}
      <rect x="115" y="80" width="160" height="45" rx="4" fill={C.coffeeTable} />
      <rect x="115" y="80" width="160" height="2.5" fill={C.shelfEdge} opacity="0.5" />

      {/* ── Sofa ── */}
      <rect x="50" y="150" width="240" height="52" rx="12" fill={C.sofa} />
      <rect x="58" y="155" width="108" height="42" rx="8" fill={C.cushion} />
      <rect x="174" y="155" width="108" height="42" rx="8" fill={C.cushion} />

      {/* ── Bookshelf (right) ── */}
      <rect x="330" y="60" width="62" height="150" rx="2" fill={C.bookshelf} />
      {/* Shelves */}
      <rect x="330" y="95" width="62" height="2" fill={C.bookshelfDiv} />
      <rect x="330" y="130" width="62" height="2" fill={C.bookshelfDiv} />
      <rect x="330" y="165" width="62" height="2" fill={C.bookshelfDiv} />
      {/* Books row 1 */}
      <rect x="335" y="68" width="10" height="24" rx="1" fill={C.bookRed} />
      <rect x="348" y="70" width="10" height="22" rx="1" fill={C.bookBlue} />
      <rect x="361" y="69" width="10" height="23" rx="1" fill={C.bookGreen} />
      <rect x="374" y="71" width="10" height="21" rx="1" fill={C.bookYellow} />
      {/* Books row 2 */}
      <rect x="335" y="100" width="10" height="27" rx="1" fill={C.bookPurple} />
      <rect x="348" y="103" width="10" height="24" rx="1" fill={C.bookRed} />
      <rect x="361" y="101" width="10" height="26" rx="1" fill={C.bookBlue} />
      {/* Books row 3 */}
      <rect x="335" y="137" width="10" height="25" rx="1" fill={C.bookGreen} />
      <rect x="348" y="139" width="10" height="23" rx="1" fill={C.bookYellow} />
      <rect x="361" y="138" width="10" height="24" rx="1" fill={C.bookRed} />
      <rect x="374" y="140" width="10" height="22" rx="1" fill={C.bookPurple} />

      {/* ── Entrance area (bottom-left) ── */}
      <rect
        x="15" y="245" width="160" height="44" rx="3"
        fill="none" stroke={C.entrance} strokeWidth="1.5" strokeDasharray="6 4"
      />
      <text x="95" y="272" textAnchor="middle" fill={C.entrance} fontSize="11" fontFamily="sans-serif">
        ENTRANCE
      </text>
    </svg>
  )
}
