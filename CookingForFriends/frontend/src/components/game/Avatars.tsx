/**
 * Avatars.tsx — Character avatar components
 *
 * Usage:
 *   import { Avatar, CHARACTERS } from './Avatars';
 *   <Avatar name="Mei" size={40} />
 *   <Avatar {...CHARACTERS.lucas} size={64} />
 */

import React from 'react';

// ─── Types ──────────────────────────────────────────────────────────

interface AvatarProps {
  name: string;
  color: string;
  size?: number; // px, default 40
  className?: string;
}

// ─── Component ──────────────────────────────────────────────────────

export const Avatar: React.FC<AvatarProps> = ({
  name,
  color,
  size = 40,
  className = '',
}) => {
  const fontSize = Math.round(size * 0.55);

  return (
    <div
      className={`inline-flex items-center justify-center rounded-full select-none ${className}`}
      style={{
        width: size,
        height: size,
        backgroundColor: color,
        fontSize,
        fontWeight: 500,
        color: 'white',
        fontFamily: 'Helvetica, Arial, sans-serif',
        lineHeight: 1,
      }}
    >
      {name[0].toUpperCase()}
    </div>
  );
};

// ─── SVG variant (for use inside <svg> elements) ────────────────────

export const AvatarSVG: React.FC<{
  name: string;
  color: string;
  cx: number;
  cy: number;
  r?: number;
}> = ({ name, color, cx, cy, r = 16 }) => (
  <g>
    <circle cx={cx} cy={cy} r={r} fill={color} />
    <text
      x={cx}
      y={cy}
      textAnchor="middle"
      dominantBaseline="central"
      fontFamily="Helvetica,Arial,sans-serif"
      fontSize={r * 1.1}
      fill="white"
      fontWeight="500"
    >
      {name[0].toUpperCase()}
    </text>
  </g>
);

// ─── Predefined Characters ──────────────────────────────────────────

export const CHARACTERS = {
  mei:      { name: 'Mei',      color: '#AF7AC5' },
  lucas:    { name: 'Lucas',    color: '#5DADE2' },
  sophie:   { name: 'Sophie',   color: '#58D68D' },
  neighbor: { name: 'Neighbor', color: '#F0B27A' },
  delivery: { name: 'Delivery', color: '#ABB2B9' },
} as const;

// ─── Helper: get character by block ─────────────────────────────────

export const getGuestForBlock = (block: 1 | 2 | 3) => {
  const map = { 1: CHARACTERS.mei, 2: CHARACTERS.lucas, 3: CHARACTERS.sophie };
  return map[block];
};

// ─── Phone message sender avatars ───────────────────────────────────
// These are the avatars used in the phone message UI.
// Friends who send PM-trigger messages use their character avatar.
// Non-PM senders use generic colored circles.

export const PHONE_SENDERS = {
  mei:      CHARACTERS.mei,
  lucas:    CHARACTERS.lucas,
  sophie:   CHARACTERS.sophie,
  // Generic senders for non-PM messages
  alex:     { name: 'Alex',     color: '#E59866' },
  jordan:   { name: 'Jordan',   color: '#76D7C4' },
  system:   { name: 'System',   color: '#85929E' },
  delivery: CHARACTERS.delivery,
} as const;
