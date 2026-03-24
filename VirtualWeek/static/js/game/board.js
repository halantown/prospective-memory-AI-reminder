/**
 * Virtual Week Board Generation
 * Path generation and cell calculations
 */

/**
 * Generate the game board path
 * Grid: 22x14, Path: 120 steps (8 steps/hour × 15 hours)
 * Returns array of {x, y} coordinates
 */
function generatePath() {
    let p = [];
    let x = 21; 
    let y = 13;
    p.push({x, y}); // Start point

    const move = (dx, dy) => {
        x += dx;
        y += dy;
        p.push({x, y});
    };

    // Bump functions (Inward/Center-ward)
    const bumpUp = (depth) => {
        for(let i=0; i<depth; i++) move(0, -1);
        move(-1, 0);
        for(let i=0; i<depth; i++) move(0, 1);
    };
    const bumpRight = (depth) => {
        for(let i=0; i<depth; i++) move(1, 0);
        move(0, -1);
        for(let i=0; i<depth; i++) move(-1, 0);
    };
    const bumpDown = (depth) => {
        for(let i=0; i<depth; i++) move(0, 1);
        move(1, 0);
        for(let i=0; i<depth; i++) move(0, -1);
    };
    const bumpLeft = (depth) => {
        for(let i=0; i<depth; i++) move(-1, 0);
        move(0, 1);
        for(let i=0; i<depth; i++) move(1, 0);
    };

    // 1. Bottom Edge (Right to Left)
    for(let i=0; i<4; i++) move(-1, 0);
    bumpUp(3);
    for(let i=0; i<5; i++) move(-1, 0);
    bumpUp(3);
    for(let i=0; i<5; i++) move(-1, 0);
    bumpUp(3);
    for(let i=0; i<4; i++) move(-1, 0);

    // 2. Left Edge (Bottom to Top)
    for(let i=0; i<4; i++) move(0, -1);
    bumpRight(3);
    for(let i=0; i<4; i++) move(0, -1);
    bumpRight(1);
    for(let i=0; i<3; i++) move(0, -1);

    // 3. Top Edge (Left to Right)
    for(let i=0; i<4; i++) move(1, 0);
    bumpDown(3);
    for(let i=0; i<5; i++) move(1, 0);
    bumpDown(3);
    for(let i=0; i<5; i++) move(1, 0);
    bumpDown(3);
    for(let i=0; i<4; i++) move(1, 0);

    // 4. Right Edge (Top to Bottom)
    for(let i=0; i<4; i++) move(0, 1);
    bumpLeft(3);
    for(let i=0; i<4; i++) move(0, 1);
    bumpLeft(1);
    for(let i=0; i<3; i++) move(0, 1);

    // Remove duplicate start point
    if (p.length > 1 && p[p.length-1].x === 21 && p[p.length-1].y === 13) {
        p.pop();
    }

    return p;
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
const rawPath = calculateRotations(generatePath());
const STEPS_PER_HOUR = rawPath.length / 15;

// Export
window.BoardUtils = {
    generatePath,
    calculateRotations,
    buildBoardCells,
    getCellStyle,
    calculateVirtualTime,
    formatRealTime,
    rawPath,
    STEPS_PER_HOUR
};
