# SaturdayAtHome Frontend Code - Complete Analysis

This directory contains comprehensive documentation of the SaturdayAtHome frontend React application.

## 📄 Documents Overview

### 1. **FRONTEND_SUMMARY.txt** (Quick Reference)
**Best for**: Quick lookups, understanding architecture at a glance
- Architecture overview
- 7-phase state machine
- WebSocket communication summary
- Game components (3 types)
- PM task lifecycle
- Sidebar components
- Zustand store structure
- Critical bugs list
- API endpoints
- Audio, Vite config, performance notes

**Size**: 205 lines | **Time to read**: 10-15 minutes

### 2. **FRONTEND_ANALYSIS.md** (Comprehensive Reference)
**Best for**: Deep dive, debugging, component modification
- Complete project structure (all 33 files listed)
- Detailed component hierarchy with props
- Full Zustand store architecture
- Complete data flow documentation
- Response recording pipeline
- Audio management details
- Critical component analysis (GameShell, MainPanel, Games, Sidebar)
- **18 identified bugs** (5 critical, 5 major, 8 moderate/minor)
- Frontend-backend mismatches table
- Component props reference table
- Store subscriber graph
- Complete execution flow (all 7 phases)
- Tailwind & CSS configuration
- Performance & optimization notes
- Testing considerations
- Security & privacy concerns
- File-to-responsibility mapping

**Size**: 852 lines | **Time to read**: 30-45 minutes

### 3. **FRONTEND_DIAGRAMS.txt** (Visual Documentation)
**Best for**: Understanding data flow, tracing execution paths
- Component hierarchy diagram
- Zustand store architecture diagram
- WebSocket event flow (backend ↔ frontend)
- Response recording & batching pipeline
- PM task lifecycle (encoding + playing phases)
- Phase state machine flow
- Sidebar component updates
- Game response flow (all 3 game types)

**Size**: 463 lines | **Time to read**: 15-20 minutes

## 🔍 Quick Navigation

### Find Information About:

| Topic | Location |
|-------|----------|
| Overall architecture | SUMMARY.txt or ANALYSIS.md §1 |
| Phase state machine | SUMMARY.txt or DIAGRAMS.txt |
| WebSocket communication | DIAGRAMS.txt (Event Flow) |
| Zustand store | ANALYSIS.md §3 |
| Game components | SUMMARY.txt or ANALYSIS.md §7 |
| PM task execution | SUMMARY.txt or DIAGRAMS.txt |
| Sidebar widgets | SUMMARY.txt or ANALYSIS.md §7 |
| Bugs & issues | ANALYSIS.md §8 |
| Component hierarchy | ANALYSIS.md §2 or DIAGRAMS.txt |
| Data flow | DIAGRAMS.txt or ANALYSIS.md §5 |
| API endpoints | SUMMARY.txt or ANALYSIS.md §4 |
| Response recording | ANALYSIS.md §5 or DIAGRAMS.txt |
| Audio management | ANALYSIS.md §6 |
| Testing needs | ANALYSIS.md §15 |
| Performance | ANALYSIS.md §14 |
| Security | ANALYSIS.md §16 |

## 🚨 Critical Issues (Must Fix)

1. **Response Buffer Race Condition** (GameShell.jsx + useWebSocket.js)
   - Both flush every 5s → potential double-send
   - **Fix**: Remove GameShell version

2. **MCQ Auto-Submit Missing** (MCQOverlay.jsx)
   - Timer counts to 0 but no auto-submit
   - **Fix**: Auto-submit on timeLeft === 0

3. **Block Config Field Mismatch** (EncodingScreen.jsx)
   - Tries `data.pm_tasks` OR `[data.task_a, data.task_b]`
   - **Fix**: Clarify backend contract

4. **Encoding Quiz UX Bug** (EncodingQuiz.jsx)
   - Wrong answer clears visible choice
   - **Fix**: Keep selected, disable button

5. **WS URL Parameter Fragile** (useWebSocket.js)
   - `auto_start` only true during 'playing'
   - **Risk**: If encoding needs timeline, breaks

See ANALYSIS.md §8 for full bug report (18 issues total).

## 📁 Project Structure

```
frontend/
├── src/
│   ├── App.jsx                         # Router
│   ├── main.jsx                        # Entry
│   ├── components/
│   │   ├── GameShell.jsx               # Orchestrator
│   │   ├── game/                       # 3 game types
│   │   ├── pm/                         # PM task components
│   │   ├── screens/                    # 6 phase screens
│   │   └── sidebar/                    # 5 sidebar widgets
│   ├── store/gameStore.js              # Zustand (40+ state fields)
│   ├── hooks/
│   │   ├── useWebSocket.js             # WS connection
│   │   └── useAudio.js                 # TTS + beeps
│   └── utils/
│       ├── api.js                      # Fetch wrapper
│       └── logger.js                   # Logging
└── [config files: vite, tailwind, postcss, package.json]
```

## 🎯 Key Metrics

- **Total Components**: 29 (3 admin, 26 game)
- **Total Files**: 33 (JSX, CSS, config)
- **State Management**: Single Zustand store (40+ fields)
- **WebSocket Events**: 12 event types
- **Game Types**: 3 (SemanticCat, GoNoGo, Trivia)
- **PM Tasks per Block**: 2
- **Blocks per Session**: 4
- **Phase Machine States**: 7
- **Identified Bugs**: 18 (5 critical, 5 major, 8 moderate/minor)

## 🔗 Dependencies

### Production
- React 18.3.1
- Vite 5.4
- Zustand 5.0
- Tailwind CSS 3.4
- Framer Motion 11.15
- Howler 2.2.4 (unused in current code)
- Lucide React 0.460

### Dev
- @vitejs/plugin-react
- autoprefixer
- postcss

## 🧪 Testing Needs

- **Unit Tests**: gameStore.js, useWebSocket.js, game components
- **Integration Tests**: WS → Store → UI flow, phase transitions
- **E2E Tests**: Full session flow, multi-block, network failures

See ANALYSIS.md §15 for detailed testing plan.

## 🔐 Security Notes

✅ **Good**:
- Token-based sessions
- WS message timestamps

⚠️ **Concerns**:
- Dashboard/ManagePage have no authentication
- Token never validated client-side
- Experiment data includes all user interactions (expected)

See ANALYSIS.md §16 for details.

## 📊 Performance Observations

**Strengths**:
- Zustand (minimal overhead)
- Response batching (every 5s)
- Hardware-accelerated animations

**Weaknesses**:
- No React.memo() on game components
- No lazy loading
- No virtual scrolling in logs

See ANALYSIS.md §14 for optimization opportunities.

## 🎓 Learning Path

1. **Start here**: FRONTEND_SUMMARY.txt (10 min)
2. **Understand flow**: FRONTEND_DIAGRAMS.txt (20 min)
3. **Deep dive**: FRONTEND_ANALYSIS.md (40 min)
4. **Code walkthrough**: 
   - gameStore.js (Zustand store)
   - useWebSocket.js (WS handling)
   - GameShell.jsx (orchestrator)
   - SemanticCatGame.jsx (example game)

## 🔄 Data Flow Overview

```
User Input
    ↓
Game Component (SemanticCatGame/GoNoGo/Trivia)
    ↓
recordResponse() → Push to responseBuffer[]
    ↓
(Every 5s) flushResponseBuffer() → WS: ongoing_batch
    ↓
Backend receives batch
    ↓
WS: game_start → handleGameStart() → MainPanel re-renders
    ↓
Next game displays
```

## 📞 Quick Reference

- **Main Store**: `/src/store/gameStore.js` (40+ state fields, 20+ actions)
- **WS Handler**: `/src/hooks/useWebSocket.js` (12 event types, auto-reconnect)
- **Orchestrator**: `/src/components/GameShell.jsx` (7-phase controller)
- **Game Examples**: 
  - `/src/components/game/SemanticCatGame.jsx` (Email categorization)
  - `/src/components/game/GoNoGoGame.jsx` (Grocery shopping)
  - `/src/components/game/TriviaGame.jsx` (True/False quiz)
- **PM Tasks**: `/src/components/pm/` (EncodingCard, EncodingQuiz, MCQOverlay)

## 📝 Notes

- All game/sidebar components use Zustand hooks (no props drilling)
- EncodingCard and EncodingQuiz receive props (exception to rule)
- Only 2 HTTP API calls during session (startSession, getBlockConfig)
- Heavy reliance on WebSocket for real-time events
- Response data continuously collected and batched
- PM task execution happens in-game during playing phase

---

**Generated**: March 18, 2025
**Scope**: Complete frontend codebase (33 files, 1500+ lines analyzed)
**Format**: 3 complementary documents + this README
