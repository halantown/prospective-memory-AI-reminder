/**
 * export-room-items.tsx
 *
 * Renders each object group (target + d1 + d2) from RoomItems.tsx into
 * a single combined SVG, then converts to PNG via ImageMagick.
 *
 * Usage:  npx tsx scripts/export-room-items.tsx
 * Output: public/assets/encoding/{key}_variants.svg  (vector)
 *         public/assets/encoding/{key}_variants.png  (raster, 4× scale)
 */

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

import { ROOM_ITEMS } from '../src/components/game/items/RoomItems';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, '..', 'public', 'assets', 'encoding', 'variants');
mkdirSync(OUTPUT_DIR, { recursive: true });

// ─── Layout constants ────────────────────────────────────────────────
const CELL_W = 110;
const CELL_H = 100;
const GAP = 25;
const PAD_X = 20;
const PAD_Y = 15;
const LABEL_H = 28;
const TITLE_H = 24;

const TOTAL_W = PAD_X * 2 + CELL_W * 3 + GAP * 2;
const TOTAL_H = TITLE_H + PAD_Y + CELL_H + LABEL_H + PAD_Y;

const LABELS = ['Target', 'Distractor 1', 'Distractor 2'];
const VARIANTS = ['target', 'd1', 'd2'] as const;

// Friendly display names for each item group
const DISPLAY_NAMES: Record<string, string> = {
  b1_book: 'Book',
  b1_giftbag: 'Gift Bag',
  b1_dish: 'Dish',
  b1_soap: 'Soap',
  b2_vinyl: 'Vinyl Record',
  b2_napkinrings: 'Napkin Rings',
  b2_pot: 'Flower Pot',
  b2_softener: 'Softener',
  b3_hanger: 'Hanger',
  b3_speaker: 'Speaker',
  b3_vase: 'Vase',
  b3_handcream: 'Hand Cream',
};

// ─── Generate SVGs ───────────────────────────────────────────────────
const svgFiles: string[] = [];

for (const [key, items] of Object.entries(ROOM_ITEMS)) {
  const displayName = DISPLAY_NAMES[key] || key;

  // Render the three variant components
  const itemMarkups = VARIANTS.map((variant, i) => {
    const Comp = items[variant];
    const cellX = PAD_X + i * (CELL_W + GAP);
    const itemX = cellX + 20;
    const itemY = TITLE_H + PAD_Y + 5;

    const markup = renderToStaticMarkup(
      React.createElement(Comp, { x: itemX, y: itemY, scale: 1 })
    );

    // Label below the item
    const labelX = cellX + CELL_W / 2;
    const labelY = TITLE_H + PAD_Y + CELL_H + 16;
    const labelColor = i === 0 ? '#C0392B' : '#7F8C8D';
    const labelWeight = i === 0 ? '700' : '400';
    const label = `<text x="${labelX}" y="${labelY}" text-anchor="middle" font-family="system-ui,-apple-system,sans-serif" font-size="11" fill="${labelColor}" font-weight="${labelWeight}">${LABELS[i]}</text>`;

    return markup + '\n  ' + label;
  });

  // Dashed separator lines between cells
  const sep1X = PAD_X + CELL_W + GAP / 2;
  const sep2X = PAD_X + CELL_W * 2 + GAP + GAP / 2;
  const sepY1 = TITLE_H + PAD_Y;
  const sepY2 = TITLE_H + PAD_Y + CELL_H;

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${TOTAL_W} ${TOTAL_H}" width="${TOTAL_W * 3}" height="${TOTAL_H * 3}">
  <style>text { font-family: system-ui, -apple-system, sans-serif; }</style>
  <rect width="${TOTAL_W}" height="${TOTAL_H}" fill="white" rx="6"/>
  <!-- Title -->
  <text x="${TOTAL_W / 2}" y="${TITLE_H - 4}" text-anchor="middle" font-size="13" fill="#2C3E50" font-weight="700">${displayName} (${key})</text>
  <!-- Separators -->
  <line x1="${sep1X}" y1="${sepY1}" x2="${sep1X}" y2="${sepY2}" stroke="#E0E0E0" stroke-width="1" stroke-dasharray="4,3"/>
  <line x1="${sep2X}" y1="${sepY1}" x2="${sep2X}" y2="${sepY2}" stroke="#E0E0E0" stroke-width="1" stroke-dasharray="4,3"/>
  <!-- Items -->
  ${itemMarkups.join('\n  ')}
</svg>`;

  const svgPath = join(OUTPUT_DIR, `${key}_variants.svg`);
  writeFileSync(svgPath, svg, 'utf-8');
  svgFiles.push(svgPath);
  console.log(`✓ SVG  ${key}_variants.svg`);
}

// ─── Convert SVG → PNG via ImageMagick ───────────────────────────────
console.log('\nConverting to PNG …');
let pngCount = 0;

for (const svgPath of svgFiles) {
  const pngPath = svgPath.replace(/\.svg$/, '.png');
  try {
    // 4× density for crisp output (effectively ~300 DPI for the viewBox size)
    execSync(
      `convert -background white -density 288 "${svgPath}" "${pngPath}"`,
      { stdio: 'pipe' }
    );
    pngCount++;
    console.log(`✓ PNG  ${pngPath.split('/').pop()}`);
  } catch (err: any) {
    console.warn(`✗ PNG failed for ${svgPath.split('/').pop()}: ${err.message}`);
  }
}

console.log(`\nDone! ${svgFiles.length} SVGs + ${pngCount} PNGs → ${OUTPUT_DIR}`);
