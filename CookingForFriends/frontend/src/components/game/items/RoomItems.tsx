/**
 * RoomItems.tsx — 36 SVG item components for PM target discrimination
 *
 * Each task has 3 items: Target, D1 (dim A correct, dim B wrong), D2 (dim A wrong, dim B correct)
 * All items share the same RoomItemProps interface.
 *
 * Usage:
 *   import { B1BookTarget, B1BookD1, B1BookD2 } from './RoomItems';
 *   <svg>
 *     <B1BookTarget x={100} y={50} scale={0.8} clickable={isWindowActive} onClick={handleSelect} />
 *   </svg>
 */

import React from 'react';

// ─── Shared Interface ───────────────────────────────────────────────

export interface RoomItemProps {
  x: number;
  y: number;
  scale?: number;
  onClick?: () => void;
  clickable?: boolean;
}

const ItemGroup: React.FC<RoomItemProps & { children: React.ReactNode }> = ({
  x, y, scale = 1, onClick, clickable = false, children,
}) => (
  <g
    transform={`translate(${x},${y}) scale(${scale})`}
    onClick={clickable ? onClick : undefined}
    style={{ cursor: clickable ? 'pointer' : 'default' }}
  >
    {children}
  </g>
);

// ═════════════════════════════════════════════════════════════════════
// BLOCK 1 — Dinner for Mei
// ═════════════════════════════════════════════════════════════════════

// ─── b1_book: Dim A = color (red/blue), Dim B = cover (mountain/ocean) ──

export const B1BookTarget: React.FC<RoomItemProps> = (props) => (
  <ItemGroup {...props}>
    {/* Red book + Mountain cover */}
    <rect x="0" y="0" width="40" height="56" rx="3" fill="#C0392B" />
    <rect x="0" y="0" width="4" height="56" rx="1" fill="#922B21" />
    <polygon points="12,44 20,24 28,44" fill="#2C3E50" />
    <polygon points="16,44 22,30 28,44" fill="#34495E" />
    <polygon points="18,30 20,24 22,30" fill="white" opacity="0.85" />
    <text x="20" y="52" textAnchor="middle" fontFamily="Georgia,serif" fontSize="5" fill="#F5B7B1" fontWeight="700">Erta Ale</text>
  </ItemGroup>
);

export const B1BookD1: React.FC<RoomItemProps> = (props) => (
  <ItemGroup {...props}>
    {/* Red book + Ocean cover (A correct, B wrong) */}
    <rect x="0" y="0" width="40" height="56" rx="3" fill="#C0392B" />
    <rect x="0" y="0" width="4" height="56" rx="1" fill="#922B21" />
    <path d="M12,38 Q16,32 20,38 Q24,44 28,38" fill="none" stroke="#2E86C1" strokeWidth="1.5" />
    <path d="M10,42 Q16,36 22,42 Q28,48 32,42" fill="none" stroke="#3498DB" strokeWidth="1.2" />
    <text x="20" y="52" textAnchor="middle" fontFamily="Georgia,serif" fontSize="4.5" fill="#F5B7B1" fontWeight="700">Blue Horizon</text>
  </ItemGroup>
);

export const B1BookD2: React.FC<RoomItemProps> = (props) => (
  <ItemGroup {...props}>
    {/* Blue book + Mountain cover (A wrong, B correct) */}
    <rect x="0" y="0" width="40" height="56" rx="3" fill="#2E86C1" />
    <rect x="0" y="0" width="4" height="56" rx="1" fill="#1A5276" />
    <polygon points="12,44 20,24 28,44" fill="#2C3E50" />
    <polygon points="16,44 22,30 28,44" fill="#34495E" />
    <polygon points="18,30 20,24 22,30" fill="white" opacity="0.85" />
    <text x="20" y="52" textAnchor="middle" fontFamily="Georgia,serif" fontSize="5" fill="#D6EAF8" fontWeight="700">Erta Ale</text>
  </ItemGroup>
);

// ─── b1_giftbag: Dim A = size (small/medium), Dim B = decor (bow/ribbon) ──

const GiftbagBase: React.FC<{ fillW: number; bow: boolean }> = ({ fillW, bow }) => (
  <>
    <path d={`M${6},${fillW} L${2},${8} L${fillW - 2},${8} L${fillW - 6},${fillW} Z`} fill="#5DADE2" stroke="#2E86C1" strokeWidth="0.5" />
    <path d={`M${fillW * 0.3},8 Q${fillW * 0.3},2 ${fillW / 2},2 Q${fillW * 0.7},2 ${fillW * 0.7},8`} fill="none" stroke="#2471A3" strokeWidth="1.5" strokeLinecap="round" />
    {bow ? (
      <>
        <ellipse cx={fillW / 2 - 5} cy={7} rx={6} ry={3.5} fill="#E74C3C" opacity="0.9" />
        <ellipse cx={fillW / 2 + 5} cy={7} rx={6} ry={3.5} fill="#E74C3C" opacity="0.9" />
        <circle cx={fillW / 2} cy={7} r={2.5} fill="#C0392B" />
      </>
    ) : (
      <>
        <line x1={fillW / 2} y1={3} x2={fillW / 2} y2={fillW - 5} stroke="#E74C3C" strokeWidth="1.5" />
        <line x1={fillW * 0.25} y1={fillW * 0.5} x2={fillW * 0.75} y2={fillW * 0.5} stroke="#E74C3C" strokeWidth="1" />
      </>
    )}
  </>
);

export const B1GiftbagTarget: React.FC<RoomItemProps> = (props) => (
  <ItemGroup {...props}>
    {/* Small + Bow */}
    <GiftbagBase fillW={36} bow={true} />
  </ItemGroup>
);

export const B1GiftbagD1: React.FC<RoomItemProps> = (props) => (
  <ItemGroup {...props}>
    {/* Small + Ribbon (A correct, B wrong) */}
    <GiftbagBase fillW={36} bow={false} />
  </ItemGroup>
);

export const B1GiftbagD2: React.FC<RoomItemProps> = (props) => (
  <ItemGroup {...props}>
    {/* Medium + Bow (A wrong, B correct) */}
    <GiftbagBase fillW={50} bow={true} />
  </ItemGroup>
);

// ─── b1_dish: Dim A = handle color (blue/red), Dim B = shape (oval/round) ──

export const B1DishTarget: React.FC<RoomItemProps> = (props) => (
  <ItemGroup {...props}>
    {/* Oval + Blue handles */}
    <ellipse cx="30" cy="25" rx="28" ry="18" fill="#FDFEFE" stroke="#D5D8DC" strokeWidth="0.8" />
    <ellipse cx="30" cy="25" rx="22" ry="14" fill="none" stroke="#E8E8E8" strokeWidth="0.5" />
    <rect x="-2" y="18" width="8" height="14" rx="3" fill="#3498DB" stroke="#2E86C1" strokeWidth="0.5" />
    <rect x="54" y="18" width="8" height="14" rx="3" fill="#3498DB" stroke="#2E86C1" strokeWidth="0.5" />
  </ItemGroup>
);

export const B1DishD1: React.FC<RoomItemProps> = (props) => (
  <ItemGroup {...props}>
    {/* Round + Blue handles (A correct handle, B wrong shape) */}
    <circle cx="25" cy="25" r="22" fill="#FDFEFE" stroke="#D5D8DC" strokeWidth="0.8" />
    <circle cx="25" cy="25" r="17" fill="none" stroke="#E8E8E8" strokeWidth="0.5" />
    <rect x="-2" y="18" width="8" height="14" rx="3" fill="#3498DB" stroke="#2E86C1" strokeWidth="0.5" />
    <rect x="44" y="18" width="8" height="14" rx="3" fill="#3498DB" stroke="#2E86C1" strokeWidth="0.5" />
  </ItemGroup>
);

export const B1DishD2: React.FC<RoomItemProps> = (props) => (
  <ItemGroup {...props}>
    {/* Oval + Red handles (A wrong handle, B correct shape) */}
    <ellipse cx="30" cy="25" rx="28" ry="18" fill="#FDFEFE" stroke="#D5D8DC" strokeWidth="0.8" />
    <ellipse cx="30" cy="25" rx="22" ry="14" fill="none" stroke="#E8E8E8" strokeWidth="0.5" />
    <rect x="-2" y="18" width="8" height="14" rx="3" fill="#E74C3C" stroke="#C0392B" strokeWidth="0.5" />
    <rect x="54" y="18" width="8" height="14" rx="3" fill="#E74C3C" stroke="#C0392B" strokeWidth="0.5" />
  </ItemGroup>
);

// ─── b1_soap: Dim A = label (lemon/mint), Dim B = type (pump/flip-cap) ──

const SoapPumpBody: React.FC<{ labelColor: string; labelText: string; labelBg: string }> = ({ labelColor, labelText, labelBg }) => (
  <>
    <rect x="4" y="20" width="32" height="44" rx="6" fill="#FDFEFE" stroke="#D5D8DC" strokeWidth="0.5" />
    <rect x="14" y="8" width="12" height="14" rx="2" fill="#BDC3C7" stroke="#95A5A6" strokeWidth="0.3" />
    <rect x="10" y="2" width="20" height="8" rx="3" fill="#ABB2B9" />
    <rect x="26" y="0" width="10" height="5" rx="2" fill="#ABB2B9" />
    <rect x="10" y="32" width="20" height="18" rx="2" fill={labelBg} stroke={labelColor} strokeWidth="0.3" />
    <text x="20" y="44" textAnchor="middle" fontFamily="Helvetica,Arial,sans-serif" fontSize="5" fill={labelColor} fontWeight="600">{labelText}</text>
  </>
);

const SoapFlipBody: React.FC<{ labelColor: string; labelText: string; labelBg: string }> = ({ labelColor, labelText, labelBg }) => (
  <>
    <rect x="4" y="10" width="32" height="50" rx="6" fill="#FDFEFE" stroke="#D5D8DC" strokeWidth="0.5" />
    <rect x="12" y="0" width="16" height="14" rx="4" fill="#E8E8E8" stroke="#D5D8DC" strokeWidth="0.3" />
    <rect x="16" y="-2" width="8" height="5" rx="2" fill="#D5D8DC" />
    <rect x="10" y="28" width="20" height="18" rx="2" fill={labelBg} stroke={labelColor} strokeWidth="0.3" />
    <text x="20" y="40" textAnchor="middle" fontFamily="Helvetica,Arial,sans-serif" fontSize="5" fill={labelColor} fontWeight="600">{labelText}</text>
  </>
);

export const B1SoapTarget: React.FC<RoomItemProps> = (props) => (
  <ItemGroup {...props}>
    <SoapPumpBody labelColor="#7D6608" labelText="LEMON" labelBg="#F9E79F" />
  </ItemGroup>
);

export const B1SoapD1: React.FC<RoomItemProps> = (props) => (
  <ItemGroup {...props}>
    {/* Mint + Pump (A wrong label, B correct type) — wait, D1 = A correct B wrong */}
    {/* D1: Lemon label wrong → Mint label, Pump correct */}
    {/* Actually: D1 = Dim A correct (lemon? no) — let me re-check */}
    {/* Dim A = label: lemon. Dim B = type: pump */}
    {/* D1 = A correct B wrong = lemon + flip-cap */}
    {/* D2 = A wrong B correct = mint + pump */}
    {/* Correction: D1 has lemon label but flip-cap */}
    <SoapFlipBody labelColor="#7D6608" labelText="LEMON" labelBg="#F9E79F" />
  </ItemGroup>
);

export const B1SoapD2: React.FC<RoomItemProps> = (props) => (
  <ItemGroup {...props}>
    {/* Mint + Pump (A wrong, B correct) */}
    <SoapPumpBody labelColor="#0E6B35" labelText="MINT" labelBg="#ABEBC6" />
  </ItemGroup>
);

// ═════════════════════════════════════════════════════════════════════
// BLOCK 2 — Dinner for Lucas
// ═════════════════════════════════════════════════════════════════════

// ─── b2_vinyl: Dim A = cover (car/abstract), Dim B = title (Night Drive/Dark Side) ──

const VinylSleeve: React.FC<{ children: React.ReactNode; title: string }> = ({ children, title }) => (
  <>
    <rect x="0" y="0" width="56" height="56" rx="2" fill="#1C1C1C" />
    <rect x="4" y="4" width="48" height="36" rx="1" fill="#2C3E50" />
    {children}
    <text x="28" y="50" textAnchor="middle" fontFamily="Helvetica,Arial,sans-serif" fontSize="5" fill="#ECF0F1" fontWeight="700" letterSpacing="0.5">{title}</text>
  </>
);

export const B2VinylTarget: React.FC<RoomItemProps> = (props) => (
  <ItemGroup {...props}>
    <VinylSleeve title="NIGHT DRIVE">
      {/* Car illustration */}
      <path d="M16,32 L20,25 L36,25 L40,32 Z" fill="#E74C3C" />
      <rect x="15" y="32" width="26" height="5" rx="1.5" fill="#C0392B" />
      <circle cx="21" cy="38" r="2.5" fill="#1C1C1C" />
      <circle cx="35" cy="38" r="2.5" fill="#1C1C1C" />
    </VinylSleeve>
  </ItemGroup>
);

export const B2VinylD1: React.FC<RoomItemProps> = (props) => (
  <ItemGroup {...props}>
    {/* Car + Dark Side (A correct cover, B wrong title) */}
    <VinylSleeve title="DARK SIDE">
      <path d="M16,32 L20,25 L36,25 L40,32 Z" fill="#E74C3C" />
      <rect x="15" y="32" width="26" height="5" rx="1.5" fill="#C0392B" />
      <circle cx="21" cy="38" r="2.5" fill="#1C1C1C" />
      <circle cx="35" cy="38" r="2.5" fill="#1C1C1C" />
    </VinylSleeve>
  </ItemGroup>
);

export const B2VinylD2: React.FC<RoomItemProps> = (props) => (
  <ItemGroup {...props}>
    {/* Abstract + Night Drive (A wrong cover, B correct title) */}
    <VinylSleeve title="NIGHT DRIVE">
      <rect x="14" y="12" width="12" height="12" rx="1" fill="#8E44AD" opacity="0.7" transform="rotate(15 20 18)" />
      <circle cx="36" cy="20" r="8" fill="none" stroke="#E74C3C" strokeWidth="1.5" opacity="0.7" />
      <line x1="18" y1="28" x2="38" y2="10" stroke="#F1C40F" strokeWidth="1" opacity="0.5" />
    </VinylSleeve>
  </ItemGroup>
);

// ─── b2_napkinrings: Dim A = material (wood/metal), Dim B = shade (light/dark) ──

const NapkinRingSet: React.FC<{ ringFill: string; ringStroke: string; grainColor?: string }> = ({ ringFill, ringStroke, grainColor }) => (
  <>
    {[0, 18, 36].map((dx, i) => (
      <g key={i}>
        <ellipse cx={10 + dx} cy="20" rx="8" ry="12" fill="none" stroke={ringFill} strokeWidth="3.5" />
        <ellipse cx={10 + dx} cy="20" rx="8" ry="12" fill="none" stroke={ringStroke} strokeWidth="2.5" />
        {grainColor && (
          <>
            <path d={`M${4 + dx},16 Q${10 + dx},15 ${16 + dx},16`} fill="none" stroke={grainColor} strokeWidth="0.3" opacity="0.3" />
            <path d={`M${4 + dx},22 Q${10 + dx},21 ${16 + dx},22`} fill="none" stroke={grainColor} strokeWidth="0.3" opacity="0.3" />
          </>
        )}
      </g>
    ))}
  </>
);

export const B2NapkinringsTarget: React.FC<RoomItemProps> = (props) => (
  <ItemGroup {...props}>
    {/* Wood + Light oak */}
    <NapkinRingSet ringFill="#C19A6B" ringStroke="#D4A76A" grainColor="#B8860B" />
  </ItemGroup>
);

export const B2NapkinringsD1: React.FC<RoomItemProps> = (props) => (
  <ItemGroup {...props}>
    {/* Wood + Dark (A correct material, B wrong shade) */}
    <NapkinRingSet ringFill="#8B6914" ringStroke="#A07828" grainColor="#6B4F10" />
  </ItemGroup>
);

export const B2NapkinringsD2: React.FC<RoomItemProps> = (props) => (
  <ItemGroup {...props}>
    {/* Metal + Light (A wrong material, B correct shade) */}
    <NapkinRingSet ringFill="#ABB2B9" ringStroke="#D5D8DC" />
  </ItemGroup>
);

// ─── b2_pot: Dim A = saucer (yes/no), Dim B = size (medium/small) ──

const PotShape: React.FC<{ w: number; h: number; hasSaucer: boolean }> = ({ w, h, hasSaucer }) => {
  const cx = w / 2;
  return (
    <>
      {hasSaucer && (
        <>
          <ellipse cx={cx} cy={h} rx={cx + 8} ry={5} fill="#C0846B" stroke="#A0695A" strokeWidth="0.5" />
          <ellipse cx={cx} cy={h - 1.5} rx={cx + 4} ry={3.5} fill="#D49A80" />
        </>
      )}
      <path d={`M${cx * 0.25},${h * 0.2} L${cx * 0.15},${h - 2} L${w - cx * 0.15},${h - 2} L${w - cx * 0.25},${h * 0.2} Z`} fill="#C0846B" stroke="#A0695A" strokeWidth="0.5" />
      <ellipse cx={cx} cy={h * 0.2} rx={cx * 0.4} ry={cx * 0.15} fill="#D49A80" stroke="#A0695A" strokeWidth="0.5" />
    </>
  );
};

export const B2PotTarget: React.FC<RoomItemProps> = (props) => (
  <ItemGroup {...props}>
    {/* Medium + With saucer */}
    <PotShape w={44} h={48} hasSaucer={true} />
  </ItemGroup>
);

export const B2PotD1: React.FC<RoomItemProps> = (props) => (
  <ItemGroup {...props}>
    {/* Small + With saucer (A correct saucer, B wrong size) */}
    <PotShape w={32} h={36} hasSaucer={true} />
  </ItemGroup>
);

export const B2PotD2: React.FC<RoomItemProps> = (props) => (
  <ItemGroup {...props}>
    {/* Medium + No saucer (A wrong saucer, B correct size) */}
    <PotShape w={44} h={48} hasSaucer={false} />
  </ItemGroup>
);

// ─── b2_softener: Dim A = label (lavender/eucalyptus), Dim B = bottle color (purple/white) ──

const SoftenerBottle: React.FC<{ bottleColor: string; bottleStroke: string; labelColor: string; labelText: string; labelIcon: React.ReactNode }> = ({
  bottleColor, bottleStroke, labelColor, labelText, labelIcon,
}) => (
  <>
    <rect x="4" y="16" width="32" height="48" rx="5" fill={bottleColor} stroke={bottleStroke} strokeWidth="0.5" />
    <rect x="12" y="4" width="16" height="14" rx="3" fill={bottleColor} stroke={bottleStroke} strokeWidth="0.5" />
    <rect x="10" y="0" width="20" height="8" rx="3" fill={bottleColor === '#FDFEFE' ? '#E8E8E8' : '#9B59B6'} stroke={bottleStroke} strokeWidth="0.3" />
    <rect x="10" y="28" width="20" height="24" rx="2" fill="#E8DAEF" stroke="#D2B4DE" strokeWidth="0.3" />
    {labelIcon}
    <text x="20" y="48" textAnchor="middle" fontFamily="Helvetica,Arial,sans-serif" fontSize="4.5" fill={labelColor} fontWeight="600">{labelText}</text>
  </>
);

const LavenderIcon = () => (
  <>
    <line x1="20" y1="44" x2="20" y2="33" stroke="#27AE60" strokeWidth="0.8" strokeLinecap="round" />
    <ellipse cx="20" cy="34" rx="2.5" ry="1.8" fill="#8E44AD" />
    <ellipse cx="18.5" cy="37" rx="2.5" ry="1.8" fill="#9B59B6" />
    <ellipse cx="21.5" cy="37" rx="2.5" ry="1.8" fill="#9B59B6" />
    <ellipse cx="19" cy="40" rx="2" ry="1.5" fill="#AF7AC5" />
    <ellipse cx="21" cy="40" rx="2" ry="1.5" fill="#AF7AC5" />
  </>
);

const EucalyptusIcon = () => (
  <>
    <line x1="20" y1="44" x2="20" y2="32" stroke="#27AE60" strokeWidth="0.8" strokeLinecap="round" />
    <ellipse cx="17" cy="35" rx="4" ry="2" fill="#27AE60" transform="rotate(-30 17 35)" />
    <ellipse cx="23" cy="35" rx="4" ry="2" fill="#27AE60" transform="rotate(30 23 35)" />
    <ellipse cx="16" cy="39" rx="4" ry="2" fill="#2ECC71" transform="rotate(-40 16 39)" />
    <ellipse cx="24" cy="39" rx="4" ry="2" fill="#2ECC71" transform="rotate(40 24 39)" />
  </>
);

export const B2SoftenerTarget: React.FC<RoomItemProps> = (props) => (
  <ItemGroup {...props}>
    <SoftenerBottle bottleColor="#8E44AD" bottleStroke="#7D3C98" labelColor="#6C3483" labelText="LAVENDER" labelIcon={<LavenderIcon />} />
  </ItemGroup>
);

export const B2SoftenerD1: React.FC<RoomItemProps> = (props) => (
  <ItemGroup {...props}>
    {/* Eucalyptus + Purple (A wrong label, B correct bottle) */}
    {/* Wait: D1 = Dim A correct, Dim B wrong */}
    {/* Dim A = label: lavender. D1 should have lavender label + wrong bottle color */}
    {/* Correction: D1 = lavender + white bottle */}
    {/* Actually from style guide: D1 = eucalyptus+purple, D2 = lavender+white */}
    {/* Style guide §10: D1 (A✓B✗) = eucalyptus+purple — A is label, eucalyptus is wrong... */}
    {/* Hmm, let me re-read. A = label: lavender. D1 = A correct B wrong = lavender label + white bottle */}
    {/* But style guide says D1 = eucalyptus+purple. That means A = label, D1 has wrong label = eucalyptus */}
    {/* The style guide table has D1 (A✓B✗). For softener: A = label:lavender, B = bottle:purple */}
    {/* D1 = A correct (lavender) + B wrong (white) → lavender+white */}
    {/* D2 = A wrong (eucalyptus) + B correct (purple) → eucalyptus+purple */}
    {/* Style guide says: D1 = eucalyptus+purple. That contradicts. Let me follow the style guide table: */}
    {/* "b2_softener | label: lavender | bottle: purple | lavender+purple | eucalyptus+purple | lavender+white" */}
    {/* So D1 = eucalyptus+purple = wrong label + correct bottle */}
    {/* That means for this task D1 = Dim A WRONG, Dim B correct — which is backwards from the header */}
    {/* The header says D1 (A✓B✗). But the data says D1 = eucalyptus+purple = A wrong. */}
    {/* I'll follow the ACTUAL DATA in the style guide table, not the header. */}
    {/* D1 = eucalyptus + purple */}
    <SoftenerBottle bottleColor="#8E44AD" bottleStroke="#7D3C98" labelColor="#0E6B35" labelText="EUCALYPTUS" labelIcon={<EucalyptusIcon />} />
  </ItemGroup>
);

export const B2SoftenerD2: React.FC<RoomItemProps> = (props) => (
  <ItemGroup {...props}>
    {/* Lavender + White bottle */}
    <SoftenerBottle bottleColor="#FDFEFE" bottleStroke="#D5D8DC" labelColor="#6C3483" labelText="LAVENDER" labelIcon={<LavenderIcon />} />
  </ItemGroup>
);

// ═════════════════════════════════════════════════════════════════════
// BLOCK 3 — Dinner for Sophie
// ═════════════════════════════════════════════════════════════════════

// ─── b3_hanger: Dim A = shoulders (wide/narrow), Dim B = bar (yes/no) ──

const HangerShape: React.FC<{ shoulderWidth: number; hasBar: boolean }> = ({ shoulderWidth, hasBar }) => {
  const cx = 30;
  const spread = shoulderWidth;
  return (
    <>
      <path d={`M${cx},4 Q${cx},10 ${cx + 3},12 Q${cx + 5},14 ${cx + 5},18`} fill="none" stroke="#95A5A6" strokeWidth="1.5" strokeLinecap="round" />
      <path d={`M${cx - spread},35 Q${cx - spread + 4},18 ${cx},14 Q${cx + spread - 4},18 ${cx + spread},35`} fill="none" stroke="#C19A6B" strokeWidth="4" strokeLinecap="round" />
      <path d={`M${cx - spread + 2},28 Q${cx},20 ${cx + spread - 2},28`} fill="none" stroke="#B8860B" strokeWidth="0.3" opacity="0.3" />
      {hasBar && (
        <line x1={cx - spread + 8} y1="42" x2={cx + spread - 8} y2="42" stroke="#C19A6B" strokeWidth="2.5" strokeLinecap="round" />
      )}
    </>
  );
};

export const B3HangerTarget: React.FC<RoomItemProps> = (props) => (
  <ItemGroup {...props}>
    <HangerShape shoulderWidth={26} hasBar={true} />
  </ItemGroup>
);

export const B3HangerD1: React.FC<RoomItemProps> = (props) => (
  <ItemGroup {...props}>
    {/* Wide + No bar (A correct shoulders, B wrong bar) */}
    <HangerShape shoulderWidth={26} hasBar={false} />
  </ItemGroup>
);

export const B3HangerD2: React.FC<RoomItemProps> = (props) => (
  <ItemGroup {...props}>
    {/* Narrow + With bar (A wrong shoulders, B correct bar) */}
    <HangerShape shoulderWidth={18} hasBar={true} />
  </ItemGroup>
);

// ─── b3_speaker: Dim A = cover (fabric/rubber), Dim B = shape (round/square) ──

export const B3SpeakerTarget: React.FC<RoomItemProps> = (props) => (
  <ItemGroup {...props}>
    {/* Round + Fabric */}
    <circle cx="25" cy="25" r="22" fill="#7F8C8D" stroke="#566573" strokeWidth="1.2" />
    {/* Fabric texture: crosshatch */}
    {[0, 6, 12, 18, 24, 30, 36, 42].map((i) => (
      <g key={`f${i}`}>
        <line x1={3 + i} y1="3" x2={3 + i} y2="47" stroke="#95A5A6" strokeWidth="0.3" opacity="0.4" />
        <line x1="3" y1={3 + i} x2="47" y2={3 + i} stroke="#95A5A6" strokeWidth="0.3" opacity="0.4" />
      </g>
    ))}
    <circle cx="25" cy="25" r="7" fill="#5D6D7E" />
    <circle cx="25" cy="25" r="3" fill="#4D5D6D" />
  </ItemGroup>
);

export const B3SpeakerD1: React.FC<RoomItemProps> = (props) => (
  <ItemGroup {...props}>
    {/* Round + Rubber (A wrong cover, B correct shape) */}
    {/* Wait: D1 = A correct B wrong. A = fabric, B = round. */}
    {/* D1 = fabric correct + shape wrong = fabric + square */}
    {/* But style guide: D1 = rubber+round. That's A wrong + B correct again. */}
    {/* Following style guide data: D1 = rubber+round */}
    <circle cx="25" cy="25" r="22" fill="#2C3E50" stroke="#1C2833" strokeWidth="1.2" />
    {/* Rubber: smooth, no texture, slight shine */}
    <ellipse cx="18" cy="18" rx="8" ry="5" fill="white" opacity="0.08" />
    <circle cx="25" cy="25" r="7" fill="#5D6D7E" />
    <circle cx="25" cy="25" r="3" fill="#4D5D6D" />
  </ItemGroup>
);

export const B3SpeakerD2: React.FC<RoomItemProps> = (props) => (
  <ItemGroup {...props}>
    {/* Fabric + Square (A correct cover, B wrong shape) */}
    {/* Following style guide: D2 = fabric+square */}
    <rect x="3" y="3" width="44" height="44" rx="6" fill="#7F8C8D" stroke="#566573" strokeWidth="1.2" />
    {[0, 6, 12, 18, 24, 30, 36, 42].map((i) => (
      <g key={`f${i}`}>
        <line x1={3 + i} y1="3" x2={3 + i} y2="47" stroke="#95A5A6" strokeWidth="0.3" opacity="0.4" />
        <line x1="3" y1={3 + i} x2="47" y2={3 + i} stroke="#95A5A6" strokeWidth="0.3" opacity="0.4" />
      </g>
    ))}
    <circle cx="25" cy="25" r="7" fill="#5D6D7E" />
    <circle cx="25" cy="25" r="3" fill="#4D5D6D" />
  </ItemGroup>
);

// ─── b3_vase: Dim A = glaze (blue/green), Dim B = size (small/large) ──

const VaseShape: React.FC<{ fill: string; stroke: string; rimFill: string; scale: number }> = ({
  fill, stroke, rimFill, scale,
}) => {
  const s = scale;
  return (
    <>
      <path
        d={`M${15 * s},${50 * s} Q${8 * s},${38 * s} ${10 * s},${25 * s} Q${12 * s},${14 * s} ${18 * s},${8 * s} L${32 * s},${8 * s} Q${38 * s},${14 * s} ${40 * s},${25 * s} Q${42 * s},${38 * s} ${35 * s},${50 * s} Z`}
        fill={fill} stroke={stroke} strokeWidth="0.5"
      />
      <ellipse cx={25 * s} cy={8 * s} rx={8 * s} ry={3 * s} fill={rimFill} stroke={stroke} strokeWidth="0.5" />
      <path d={`M${17 * s},${28 * s} Q${19 * s},${18 * s} ${22 * s},${12 * s}`} fill="none" stroke="white" strokeWidth={1.2 * s} opacity="0.3" strokeLinecap="round" />
      <rect x={20 * s} y={49 * s} width={10 * s} height={3 * s} rx={1.5 * s} fill={stroke} />
    </>
  );
};

export const B3VaseTarget: React.FC<RoomItemProps> = (props) => (
  <ItemGroup {...props}>
    {/* Blue + Small */}
    <VaseShape fill="#5DADE2" stroke="#2E86C1" rimFill="#3498DB" scale={1} />
  </ItemGroup>
);

export const B3VaseD1: React.FC<RoomItemProps> = (props) => (
  <ItemGroup {...props}>
    {/* Green + Small (A wrong glaze, B correct size) */}
    {/* Style guide: D1 = green+small */}
    <VaseShape fill="#58D68D" stroke="#27AE60" rimFill="#2ECC71" scale={1} />
  </ItemGroup>
);

export const B3VaseD2: React.FC<RoomItemProps> = (props) => (
  <ItemGroup {...props}>
    {/* Blue + Large (A correct glaze, B wrong size) */}
    {/* Style guide: D2 = blue+large */}
    <VaseShape fill="#5DADE2" stroke="#2E86C1" rimFill="#3498DB" scale={1.4} />
  </ItemGroup>
);

// ─── b3_handcream: Dim A = label (lavender/mint), Dim B = tube color (white/beige) ──

const HandcreamTube: React.FC<{ tubeColor: string; tubeStroke: string; labelColor: string; labelText: string; labelIcon: React.ReactNode }> = ({
  tubeColor, tubeStroke, labelColor, labelText, labelIcon,
}) => (
  <g transform="rotate(-8 25 30)">
    <rect x="2" y="12" width="46" height="24" rx="8" fill={tubeColor} stroke={tubeStroke} strokeWidth="0.5" />
    <rect x="44" y="17" width="12" height="14" rx="4" fill="#E8E8E8" stroke="#D5D8DC" strokeWidth="0.3" />
    <rect x="0" y="18" width="6" height="12" rx="1" fill="#E8E8E8" stroke="#D5D8DC" strokeWidth="0.3" />
    <rect x="14" y="16" width="24" height="16" rx="2" fill="#E8DAEF" stroke="#D2B4DE" strokeWidth="0.3" />
    {labelIcon}
    <text x="32" y="28" textAnchor="middle" fontFamily="Helvetica,Arial,sans-serif" fontSize="4" fill={labelColor} fontWeight="600">{labelText}</text>
  </g>
);

const SmallLavender = () => (
  <>
    <line x1="21" y1="30" x2="21" y2="21" stroke="#27AE60" strokeWidth="0.6" strokeLinecap="round" />
    <ellipse cx="21" cy="22" rx="2" ry="1.5" fill="#8E44AD" />
    <ellipse cx="20" cy="24.5" rx="2" ry="1.5" fill="#9B59B6" />
    <ellipse cx="22" cy="24.5" rx="2" ry="1.5" fill="#9B59B6" />
  </>
);

const SmallMint = () => (
  <>
    <ellipse cx="20" cy="24" rx="3.5" ry="2.5" fill="#2ECC71" />
    <ellipse cx="22" cy="22" rx="3" ry="2" fill="#58D68D" />
    <line x1="21" y1="28" x2="21" y2="22" stroke="#27AE60" strokeWidth="0.5" />
  </>
);

export const B3HandcreamTarget: React.FC<RoomItemProps> = (props) => (
  <ItemGroup {...props}>
    {/* Lavender + White tube */}
    <HandcreamTube tubeColor="#FDFEFE" tubeStroke="#D5D8DC" labelColor="#6C3483" labelText="LAVENDER" labelIcon={<SmallLavender />} />
  </ItemGroup>
);

export const B3HandcreamD1: React.FC<RoomItemProps> = (props) => (
  <ItemGroup {...props}>
    {/* Mint + White tube (wrong label, correct tube) */}
    {/* Style guide: D1 = mint+white */}
    <HandcreamTube tubeColor="#FDFEFE" tubeStroke="#D5D8DC" labelColor="#0E6B35" labelText="MINT" labelIcon={<SmallMint />} />
  </ItemGroup>
);

export const B3HandcreamD2: React.FC<RoomItemProps> = (props) => (
  <ItemGroup {...props}>
    {/* Lavender + Beige tube (correct label, wrong tube) */}
    {/* Style guide: D2 = lavender+beige */}
    <HandcreamTube tubeColor="#F5E6CC" tubeStroke="#D5C4A1" labelColor="#6C3483" labelText="LAVENDER" labelIcon={<SmallLavender />} />
  </ItemGroup>
);

// ═════════════════════════════════════════════════════════════════════
// EXPORT MAP — for programmatic access by task_id
// ═════════════════════════════════════════════════════════════════════

export const ROOM_ITEMS: Record<string, {
  target: React.FC<RoomItemProps>;
  d1: React.FC<RoomItemProps>;
  d2: React.FC<RoomItemProps>;
}> = {
  b1_book:        { target: B1BookTarget,       d1: B1BookD1,       d2: B1BookD2 },
  b1_giftbag:     { target: B1GiftbagTarget,    d1: B1GiftbagD1,    d2: B1GiftbagD2 },
  b1_dish:        { target: B1DishTarget,       d1: B1DishD1,       d2: B1DishD2 },
  b1_soap:        { target: B1SoapTarget,       d1: B1SoapD1,       d2: B1SoapD2 },
  b2_vinyl:       { target: B2VinylTarget,      d1: B2VinylD1,      d2: B2VinylD2 },
  b2_napkinrings: { target: B2NapkinringsTarget, d1: B2NapkinringsD1, d2: B2NapkinringsD2 },
  b2_pot:         { target: B2PotTarget,        d1: B2PotD1,        d2: B2PotD2 },
  b2_softener:    { target: B2SoftenerTarget,   d1: B2SoftenerD1,   d2: B2SoftenerD2 },
  b3_hanger:      { target: B3HangerTarget,     d1: B3HangerD1,     d2: B3HangerD2 },
  b3_speaker:     { target: B3SpeakerTarget,    d1: B3SpeakerD1,    d2: B3SpeakerD2 },
  b3_vase:        { target: B3VaseTarget,       d1: B3VaseD1,       d2: B3VaseD2 },
  b3_handcream:   { target: B3HandcreamTarget,  d1: B3HandcreamD1,  d2: B3HandcreamD2 },
};
