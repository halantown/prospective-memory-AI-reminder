/** Study furniture — desk, monitor, keyboard, chair, shelf, filing cabinet, lamp. */

import { C } from './furniture/styles'

export default function StudyFurniture() {
  return (
    <svg
      className="absolute inset-0 w-full h-full"
      viewBox="0 0 400 300"
      preserveAspectRatio="none"
    >
      {/* ── Desk ── */}
      <rect x="25" y="18" width="260" height="88" rx="3" fill={C.darkWood} />
      <rect x="25" y="18" width="260" height="3" fill={C.wood} opacity="0.5" />

      {/* Monitor */}
      <rect x="105" y="28" width="82" height="50" rx="2" fill={C.monitorFrame} />
      <rect x="110" y="32" width="72" height="40" rx="1" fill={C.monitor} />
      {/* Monitor stand */}
      <rect x="140" y="78" width="12" height="7" fill={C.fileCabinet} />

      {/* Keyboard */}
      <rect x="108" y="88" width="68" height="14" rx="2" fill={C.keyboard} />

      {/* ── Chair ── */}
      <ellipse cx="155" cy="138" rx="34" ry="22" fill={C.fileCabinet} />
      <ellipse cx="155" cy="146" rx="14" ry="6" fill="#4A5565" />

      {/* ── Shelf ── */}
      <rect x="25" y="178" width="260" height="36" rx="2" fill={C.shelf} />
      <rect x="25" y="178" width="260" height="3" fill={C.shelfEdge} />

      {/* Calendar icon */}
      <rect x="50" y="186" width="26" height="22" rx="1.5" fill={C.calendarWhite} opacity="0.85" />
      <rect x="50" y="186" width="26" height="6" rx="1.5" fill="#C05050" opacity="0.7" />
      <text x="63" y="203" textAnchor="middle" fill="#555" fontSize="8" fontFamily="sans-serif">
        15
      </text>

      {/* Inbox tray */}
      <rect x="115" y="188" width="38" height="20" rx="2" fill={C.keyboard} stroke={C.label} strokeWidth="0.8" />
      <rect x="120" y="192" width="28" height="3" rx="1" fill="#8A9AAA" opacity="0.6" />
      <rect x="120" y="198" width="28" height="3" rx="1" fill="#8A9AAA" opacity="0.4" />

      {/* ── Filing cabinet (bottom-left) ── */}
      <rect x="25" y="242" width="68" height="52" rx="2" fill={C.fileCabinet} />
      <line x1="25" y1="260" x2="93" y2="260" stroke="#4A5565" strokeWidth="1" />
      <line x1="25" y1="278" x2="93" y2="278" stroke="#4A5565" strokeWidth="1" />
      <circle cx="59" cy="251" r="2" fill="#8A9AAA" />
      <circle cx="59" cy="269" r="2" fill="#8A9AAA" />
      <circle cx="59" cy="287" r="2" fill="#8A9AAA" />

      {/* ── Lamp (bottom-right) ── */}
      <ellipse cx="290" cy="278" rx="18" ry="8" fill="#6A5A4A" />
      <rect x="287" y="262" width="6" height="16" fill="#7A6A5A" />
      <circle cx="290" cy="255" r="16" fill={C.lamp} opacity="0.35" />
      <circle cx="290" cy="255" r="10" fill={C.lamp} opacity="0.2" />
    </svg>
  )
}
