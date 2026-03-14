/**
 * Virtual Week Game Constants
 * All magic numbers, configuration, and static data
 */

// API Configuration
const API_BASE_URL = '/api';
const API_BASE = '/api';

// Board Configuration
const BOARD_COLUMNS = 22;
const BOARD_ROWS = 14;
const TOTAL_HOURS = 15;  // 7:00 to 22:00
const START_HOUR = 7;    // 7:00 AM
const END_HOUR = 22;     // 10:00 PM
let BOARD_END_INDEX = 119;  // Last cell index (0-indexed), updated by rebuildPath

// Game Phase Constants
const PHASE = {
    LOADING: 'loading',
    IDLE: 'idle',
    MOVING: 'moving',
    WAITING_CONFIRM: 'waiting_confirm',
    RESOLVING_EVENT: 'resolving_event',
    START_CARD: 'start_card',
    FINISHED: 'finished'
};

// WebSocket Configuration
const SOCKET_CONFIG = {
    url: 'http://localhost:5001',
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionAttempts: 10
};

// Animation Configuration
const ANIMATION = {
    DICE_ROLL_DURATION: 1200,  // ms
    MOVE_STEP_DELAY: 400,      // ms
    DEBOUNCE_SAVE_STATE: 300   // ms
};

// Game Registry: Maps event category to game components
const GAME_REGISTRY = {
    'Shopping': {
        component: null,  // Will be set to window.SupermarketGame
        title: '超市大采购',
        subtitle: '请帮忙检查购物篮',
        icon: 'shopping-cart',
        background: 'pics/ah.png',
        defaultScenario: {
            context: "准备做一份水果沙拉招待朋友",
            items: [
                { id: 101, name: "红苹果", emoji: "🍎", isReasonable: true },
                { id: 102, name: "甜香蕉", emoji: "🍌", isReasonable: true },
                { id: 103, name: "酸奶", emoji: "🥛", isReasonable: true },
                { id: 104, name: "大蒜头", emoji: "🧄", isReasonable: false },
                { id: 105, name: "大碗", emoji: "🥣", isReasonable: true },
                { id: 106, name: "葡萄", emoji: "🍇", isReasonable: true },
            ]
        }
    }
};

// Initialize component references after DOM loads
function initGameRegistry() {
    if (window.SupermarketGame) {
        GAME_REGISTRY['Shopping'].component = window.SupermarketGame;
    }
}

// Export for use in other modules
window.GameConstants = {
    API_BASE_URL,
    API_BASE,
    BOARD_COLUMNS,
    BOARD_ROWS,
    TOTAL_HOURS,
    START_HOUR,
    END_HOUR,
    BOARD_END_INDEX,
    PHASE,
    SOCKET_CONFIG,
    ANIMATION,
    GAME_REGISTRY,
    initGameRegistry
};
