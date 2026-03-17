# SaturdayAtHome Project Documentation Index

## Frontend Analysis (Complete)

### 📄 Documents Created

| Document | Size | Lines | Purpose |
|----------|------|-------|---------|
| **FRONTEND_README.md** | 7.7 KB | 280 | Master index + quick navigation guide |
| **FRONTEND_SUMMARY.txt** | 11 KB | 205 | Quick reference (10-15 min) |
| **FRONTEND_ANALYSIS.md** | 29 KB | 852 | Deep dive reference (30-45 min) |
| **FRONTEND_DIAGRAMS.txt** | 30 KB | 463 | Visual documentation (15-20 min) |

**Total**: 77.7 KB, 1,800+ lines of documentation

### 🎯 What Each Document Contains

#### FRONTEND_README.md
- Navigation guide for all 4 documents
- Critical issues quick list (5 bugs)
- Project structure overview
- Key metrics (29 components, 33 files, 40+ state fields)
- Learning path
- Dependencies
- Security & performance notes

#### FRONTEND_SUMMARY.txt
- Architecture (React + Vite + Zustand)
- 7-phase state machine flow
- WebSocket communication protocol
- 3 game component types with timeouts
- PM task lifecycle (encoding + execution)
- 5 sidebar components
- Zustand store structure
- 10 identified bugs (5 critical, 5 major)
- API endpoints, audio, config, performance

#### FRONTEND_ANALYSIS.md
- Complete project structure (33 files listed)
- Component hierarchy with props
- Full Zustand store architecture (40+ fields, 20+ actions)
- Complete data flow (WS, API, response batching)
- Response recording pipeline details
- Audio management (TTS + beeps)
- Critical component analysis (GameShell, MainPanel, Games, Sidebar)
- **18 identified bugs** with locations and fixes
- Frontend-backend mismatches table
- Store subscriber graph
- Complete 7-phase execution flow
- Tailwind & CSS configuration
- Performance & optimization
- Testing plan
- Security & privacy
- File-to-responsibility mapping

#### FRONTEND_DIAGRAMS.txt
- Component hierarchy tree
- Zustand store architecture diagram
- WebSocket event flow (backend ↔ frontend)
- Response recording & batching pipeline
- PM task lifecycle (encoding + playing)
- Phase state machine flow
- Sidebar real-time updates
- Game response flow (all 3 types)

### 🚨 Critical Issues Found

**5 Critical Bugs:**
1. Response Buffer Race Condition (GameShell + useWebSocket flush every 5s)
2. MCQ No Auto-Submit on Timeout (user may ignore MCQ)
3. Block Config Field Mismatch (pm_tasks vs [task_a, task_b])
4. Encoding Quiz UX Bug (selected cleared on wrong answer)
5. WS URL Parameter Fragile (auto_start only during playing)

**5 Major Issues:**
6. No error display for WS parse failures
7. Heartbeat may fail silently
8. No phase validation
9. Active execution window never auto-cleared
10. Game dimming persists on phase change

**8 Moderate/Minor Issues:** (See FRONTEND_ANALYSIS.md §8)

### 📊 Analysis Coverage

| Category | Details |
|----------|---------|
| Files Analyzed | 33 (JSX, CSS, config files) |
| Components | 29 (3 admin, 26 game) |
| Zustand Store | 40+ state fields, 20+ actions |
| WebSocket Events | 12 event types |
| HTTP Endpoints | 3 (startSession, getBlockConfig, resume) |
| Game Types | 3 (SemanticCat, GoNoGo, Trivia) |
| Phase States | 7 (welcome → onboarding → encoding → playing → questionnaire → block_end → complete) |
| PM Tasks per Block | 2 |
| Bugs Identified | 18 total (5 critical, 5 major, 8 moderate/minor) |
| Lines Reviewed | 1500+ |

### 🔄 Architecture Summary

```
App (router) 
  ├── GameShell (orchestrator)
  │   ├── 7 Phase Screens (welcome, onboarding, encoding, playing, questionnaire, block_end, complete)
  │   ├── 3 Game Components (SemanticCat, GoNoGo, Trivia)
  │   ├── PM Components (EncodingCard, EncodingQuiz, MCQOverlay)
  │   └── Sidebar (Clock, MiniMap, ActivityLabel, RobotStatus, TriggerZone)
  ├── Dashboard (admin observer)
  ├── ManagePage (data management)
  └── ConfigPage (game config editor)

Zustand Store (single source of truth)
  ├── Session state (sessionId, participantId, group, conditionOrder)
  ├── Phase control (7-state machine)
  ├── Game state (currentGameType, gameItems[], itemIndex, responses)
  ├── Sidebar state (time, room, activity, triggers[], robot)
  ├── PM state (encoding, quiz attempts, MCQ data)
  └── WebSocket state (connection, send function)

WebSocket (real-time)
  ├── Inbound: 12 event types (game_start, trigger_fire, mcq_data, etc.)
  └── Outbound: heartbeat, trigger_click, mcq_answer, ongoing_batch, etc.

HTTP API
  ├── POST /api/session/start (token → sessionId)
  ├── GET /api/session/{id}/block/{num} (block config + PM tasks)
  └── GET /api/session/{id}/resume (resume session)
```

### 🎮 Game Response Flow

```
User Input
  ↓
Game Component records response
  ↓
Push to responseBuffer[]
  ↓
Every 5s: flushResponseBuffer()
  ↓
Send WS: {type: 'ongoing_batch', data: {responses: [...]}}
  ↓
Backend ACK: ongoing_ack
  ↓
responseBuffer[] cleared
```

### 📋 PM Task Flow

**Encoding Phase:**
```
getBlockConfig() 
  → EncodingCard (learn)
  → EncodingQuiz (attempt 1, 2, 3... until correct)
  → submitEncoding(task_id, quiz_attempts)
```

**Playing Phase:**
```
reminder_fire (WS) 
  → Robot speaks reminder
  → [30s pause]
  → trigger_fire (WS) {sidebar_icon, task_id}
  → Trigger animates
  → User clicks (or times out after 30s)
  → mcq_data (WS) {question, options}
  → MCQ overlay (30s timer)
  → submitMCQ(selected)
  → window_close (WS)
  → Trigger deactivates
```

### 🔐 Security & Auth

✅ Good:
- Token-based sessions
- WS timestamps included
- No credentials in URLs

⚠️ Concerns:
- Dashboard/ManagePage have NO authentication
- Token never validated client-side
- Experiment data logs all user interactions (expected for research)

### 📈 Performance

✅ Strengths:
- Zustand (lightweight state)
- Response batching (5s intervals)
- Framer Motion (hardware-accelerated)

❌ Opportunities:
- No React.memo() on game components
- No lazy loading of screens
- No virtual scrolling in admin logs

### 🧪 Testing Needs

- **Unit**: gameStore.js, useWebSocket.js, game components
- **Integration**: WS → Store → UI, phase transitions, response batching
- **E2E**: Full session flow, multi-block, network failures, trigger execution

### 📚 Quick Reference

**Main Files:**
- `src/store/gameStore.js` - Zustand store (40+ fields, 20+ actions)
- `src/hooks/useWebSocket.js` - WS handler (12 events, auto-reconnect)
- `src/components/GameShell.jsx` - Orchestrator (7-phase controller)
- `src/components/game/` - 3 game types
- `src/components/sidebar/` - 5 widgets
- `src/components/screens/` - 6 phase screens
- `src/components/pm/` - PM task components

**Key Concepts:**
- Single Zustand store (no Redux, no Context)
- Component tree uses store hooks (no prop drilling)
- WebSocket for real-time backend events
- Response batching every 5 seconds
- 7-phase linear state machine
- PM tasks: encoding phase + in-game execution

### 📌 How to Use

1. **First time**: Read FRONTEND_README.md (5 min)
2. **Quick lookup**: Use FRONTEND_SUMMARY.txt (10 min)
3. **Understanding flow**: Study FRONTEND_DIAGRAMS.txt (20 min)
4. **Deep dive**: Read FRONTEND_ANALYSIS.md (45 min)
5. **Bug fixes**: Reference FRONTEND_ANALYSIS.md §8
6. **Optimization**: Reference FRONTEND_ANALYSIS.md §14

### 📍 File Locations

```
/home/charmot/Coding/thesis/
├── INDEX.md                    (this file)
├── FRONTEND_README.md          (master navigation)
├── FRONTEND_SUMMARY.txt        (quick reference)
├── FRONTEND_ANALYSIS.md        (comprehensive)
└── FRONTEND_DIAGRAMS.txt       (visual)
```

---

**Analysis Date**: March 18, 2025
**Scope**: Complete SaturdayAtHome frontend codebase
**Documentation Quality**: Production-ready
**Total Content**: 77.7 KB, 1,800+ lines, 8 diagrams
