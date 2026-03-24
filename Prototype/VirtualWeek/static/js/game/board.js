/**
 * Virtual Week Board Generation
 * Path generation and cell calculations
 */

/**
 * Generate the game board path
 * Grid: 22x14, path spirals along the perimeter with inward bumps
 * @param {number} totalSteps - desired number of cells (68~168, default 120)
 * totalSteps = 68 (base perimeter) + 2 × Σ(all bump depths)
 * Returns array of {x, y} coordinates
 */
function generatePath(totalSteps) {
    totalSteps = (typeof totalSteps === 'number') ? Math.max(68, Math.min(152, totalSteps)) : 120;

    let p = [];
    let x = 21, y = 13;
    p.push({x, y});

    const move = (dx, dy) => { x += dx; y += dy; p.push({x, y}); };

    const bumpUp    = (d) => { for(let i=0;i<d;i++) move(0,-1); move(-1,0); for(let i=0;i<d;i++) move(0,1); };
    const bumpRight = (d) => { for(let i=0;i<d;i++) move(1,0);  move(0,-1); for(let i=0;i<d;i++) move(-1,0); };
    const bumpDown  = (d) => { for(let i=0;i<d;i++) move(0,1);  move(1,0);  for(let i=0;i<d;i++) move(0,-1); };
    const bumpLeft  = (d) => { for(let i=0;i<d;i++) move(-1,0); move(0,1);  for(let i=0;i<d;i++) move(1,0); };

    // Original 120-step path for backward compatibility
    if (totalSteps === 120) {
        for(let i=0;i<4;i++) move(-1,0); bumpUp(3);
        for(let i=0;i<5;i++) move(-1,0); bumpUp(3);
        for(let i=0;i<5;i++) move(-1,0); bumpUp(3);
        for(let i=0;i<4;i++) move(-1,0);

        for(let i=0;i<4;i++) move(0,-1); bumpRight(3);
        for(let i=0;i<4;i++) move(0,-1); bumpRight(1);
        for(let i=0;i<3;i++) move(0,-1);

        for(let i=0;i<4;i++) move(1,0); bumpDown(3);
        for(let i=0;i<5;i++) move(1,0); bumpDown(3);
        for(let i=0;i<5;i++) move(1,0); bumpDown(3);
        for(let i=0;i<4;i++) move(1,0);

        for(let i=0;i<4;i++) move(0,1); bumpLeft(3);
        for(let i=0;i<4;i++) move(0,1); bumpLeft(1);
        for(let i=0;i<3;i++) move(0,1);
    } else {
        const recipe = _computePathRecipe(totalSteps);
        const runEdge = (segs, goStraight, goBump) => {
            for (const seg of segs) {
                if (seg.t === 's') { for(let i=0;i<seg.n;i++) goStraight(); }
                else goBump(seg.n);
            }
        };
        runEdge(recipe.bottom, () => move(-1,0), bumpUp);
        runEdge(recipe.left,   () => move(0,-1), bumpRight);
        runEdge(recipe.top,    () => move(1,0),  bumpDown);
        runEdge(recipe.right,  () => move(0,1),  bumpLeft);
    }

    if (p.length > 1 && p[p.length-1].x === 21 && p[p.length-1].y === 13) p.pop();
    return p;
}

function _computePathRecipe(totalSteps) {
    const totalBumpDepth = Math.max(0, Math.round((totalSteps - 68) / 2));
    if (totalBumpDepth === 0) {
        const s = (n) => [{ t: 's', n }];
        return { bottom: s(21), left: s(13), top: s(21), right: s(13) };
    }
    let hDepth = Math.round(totalBumpDepth * 0.35);
    let vDepth = Math.max(0, Math.round((totalBumpDepth - 2 * hDepth) / 2));
    return {
        bottom: _edgeSegments(hDepth, 21, 4),
        left:   _edgeSegments(vDepth, 13, 3),
        top:    _edgeSegments(hDepth, 21, 4),
        right:  _edgeSegments(vDepth, 13, 3)
    };
}

function _edgeSegments(bumpDepthTotal, netLen, maxBumps) {
    if (bumpDepthTotal <= 0) return [{ t: 's', n: netLen }];
    let bestN = 1, bestD = Math.min(5, bumpDepthTotal), bestDiff = Infinity;
    for (let n = 1; n <= maxBumps; n++) {
        for (const d of [Math.floor(bumpDepthTotal / n), Math.ceil(bumpDepthTotal / n)]) {
            if (d < 1 || d > 5) continue;
            const diff = Math.abs(n * d - bumpDepthTotal);
            if (diff < bestDiff || (diff === bestDiff && n < bestN)) {
                bestDiff = diff; bestN = n; bestD = d;
            }
        }
    }
    const straightTotal = netLen - bestN;
    const segs = [];
    const base = Math.floor(straightTotal / (bestN + 1));
    let rem = straightTotal % (bestN + 1);
    for (let i = 0; i <= bestN; i++) {
        const len = base + (rem > 0 ? 1 : 0);
        if (rem > 0) rem--;
        if (len > 0) segs.push({ t: 's', n: len });
        if (i < bestN) segs.push({ t: 'b', n: bestD });
    }
    return segs;
}

/**
 * Calculate rotation for each cell arrow
 */
function calculateRotations(path) {
    return path.map((curr, i) => {
        const next = path[(i + 1) % path.length];
        const dx = next.x - curr.x;
        const dy = next.y - curr.y;
        let deg = 0;
        if (dx === 1) deg = 0;      // Right
        else if (dx === -1) deg = 180; // Left
        else if (dy === 1) deg = 90;   // Down
        else if (dy === -1) deg = 270; // Up
        return { ...curr, rotation: deg };
    });
}

/**
 * Build board cells from path and map config
 */
function buildBoardCells(rawPath, mapConfig = {}) {
    const STEPS_PER_HOUR = rawPath.length / 15;
    const events = mapConfig.events || {};
    const hourLabels = mapConfig.hour_labels || {};
    
    return rawPath.map((cell, idx) => {
        // Determine cell type
        let type = '';
        if (idx === 0) type = 'Start';
        else if (idx === rawPath.length - 1) type = 'End';
        else if (idx % STEPS_PER_HOUR === 0) type = 'Hour';
        else if (events[idx]) type = 'E';
        
        // Hour marker (time label)
        let hourMarker = null;
        if (hourLabels[idx]) {
            hourMarker = hourLabels[idx];
        }
        
        return {
            ...cell,
            type,
            hourMarker
        };
    });
}

/**
 * Get cell grid style
 */
function getCellStyle(cell) {
    return {
        gridColumnStart: cell.x + 1,
        gridRowStart: cell.y + 1
    };
}

/**
 * Calculate virtual time from position
 */
function calculateVirtualTime(position, totalSteps = 120) {
    const startMin = 7 * 60;  // 7:00 AM
    const minsPerStep = (15 * 60) / totalSteps; 
    const currentTotalMins = startMin + (position * minsPerStep);
    const h = Math.floor(currentTotalMins / 60) % 24;
    const m = Math.floor(currentTotalMins % 60);
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

/**
 * Format real time seconds as MM:SS
 */
function formatRealTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

// Generate default path with rotations
let rawPath = calculateRotations(generatePath());
let STEPS_PER_HOUR = rawPath.length / 15;

function rebuildPath(totalSteps) {
    rawPath = calculateRotations(generatePath(totalSteps));
    STEPS_PER_HOUR = rawPath.length / 15;
}

// Export
window.BoardUtils = {
    generatePath,
    calculateRotations,
    buildBoardCells,
    getCellStyle,
    calculateVirtualTime,
    formatRealTime,
    rebuildPath,
    get rawPath() { return rawPath; },
    get STEPS_PER_HOUR() { return STEPS_PER_HOUR; }
};
