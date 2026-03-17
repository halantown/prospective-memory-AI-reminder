# SaturdayAtHome Frontend Code - Comprehensive Analysis

## 1. PROJECT STRUCTURE

### Technology Stack
- **Framework**: React 18.3.1 with Vite 5.4
- **State Management**: Zustand 5.0
- **UI Library**: Tailwind CSS 3.4, Framer Motion 11.15 (animations)
- **Audio**: Howler 2.2.4, Web Speech API, Web Audio API
- **Icons**: Lucide React 0.460

### File Structure
```
frontend/
├── src/
│   ├── App.jsx                    # Main router (game/dashboard/manage/config)
│   ├── main.jsx                   # React entry point
│   ├── index.css                  # Tailwind + custom animations
│   ├── components/
│   │   ├── GameShell.jsx          # Main game container (orchestrator)
│   │   ├── Dashboard.jsx          # Admin dashboard (live event monitoring)
│   │   ├── ManagePage.jsx         # Data management UI
│   │   ├── ConfigPage.jsx         # Game config editor
│   │   ├── game/
│   │   │   ├── MainPanel.jsx      # Game type router
│   │   │   ├── SemanticCatGame.jsx # Email categorization game
│   │   │   ├── GoNoGoGame.jsx     # Grocery shopping game
│   │   │   ├── TriviaGame.jsx     # Podcast quiz game
│   │   │   └── TransitionScreen.jsx # Room/activity transitions
│   │   ├── pm/
│   │   │   ├── MCQOverlay.jsx     # Interruption quiz overlay
│   │   │   ├── EncodingCard.jsx   # Task learning card
│   │   │   └── EncodingQuiz.jsx   # Task recall quiz
│   │   ├── screens/
│   │   │   ├── WelcomeScreen.jsx  # Token login
│   │   │   ├── OnboardingScreen.jsx # 6-page tutorial
│   │   │   ├── EncodingScreen.jsx # PM task encoding phase
│   │   │   ├── QuestionnaireScreen.jsx # Block-end survey (2 Likert scales)
│   │   │   ├── BlockEndScreen.jsx # Rest period + next block
│   │   │   └── CompleteScreen.jsx # Final survey + completion
│   │   └── sidebar/
│   │       ├── Sidebar.jsx        # Main sidebar container
│   │       ├── Clock.jsx          # Simulated time + sky gradient
│   │       ├── MiniMap.jsx        # 5-room floor plan
│   │       ├── ActivityLabel.jsx  # Current room/activity
│   │       ├── RobotStatus.jsx    # Robot speaking state + TTS bubble
│   │       └── TriggerZone.jsx    # 8 household event icons
│   ├── store/
│   │   └── gameStore.js           # Zustand store (single source of truth)
│   ├── hooks/
│   │   ├── useWebSocket.js        # WS connection + event routing
│   │   └── useAudio.js            # Robot TTS + trigger sound effects
│   └── utils/
│       ├── api.js                 # Fetch API utilities
│       └── logger.js              # Structured logging
├── vite.config.js                 # Vite setup + /api proxy
├── package.json
├── tailwind.config.js
├── postcss.config.js
└── index.html

```

---

## 2. COMPONENT HIERARCHY & PROPS FLOW

### Component Tree
```
App (window.location.pathname router)
  ├── GameShell (orchestrator - useWebSocket + useAudio)
  │   ├── (if phase: welcome) WelcomeScreen
  │   ├── (if phase: onboarding) OnboardingScreen
  │   ├── (if phase: encoding) EncodingScreen
  │   │   ├── EncodingCard (task A)
  │   │   ├── EncodingQuiz (task A)
  │   │   ├── EncodingCard (task B)
  │   │   └── EncodingQuiz (task B)
  │   ├── (if phase: questionnaire) QuestionnaireScreen
  │   ├── (if phase: block_end) BlockEndScreen
  │   ├── (if phase: complete) CompleteScreen
  │   └── (if phase: playing)
  │       ├── MainPanel (75% width)
  │       │   ├── TransitionScreen (when !gameActive)
  │       │   ├── SemanticCatGame (if currentGameType === 'semantic_cat')
  │       │   ├── GoNoGoGame (if currentGameType === 'go_nogo')
  │       │   └── TriviaGame (if currentGameType === 'trivia')
  │       ├── MCQOverlay (z-50, absolute overlay)
  │       └── Sidebar (25% width, dark bg)
  │           ├── Clock
  │           ├── ActivityLabel
  │           ├── MiniMap
  │           ├── RobotStatus
  │           └── TriggerZone
  ├── Dashboard (/dashboard - observer)
  ├── ManagePage (/manage - session/data management)
  └── ConfigPage (/config - game config editor)
```

### Store Subscribers (useGameStore hooks per component):
```
GameShell: phase, mcqVisible
MainPanel: currentGameType, gameActive, gameDimmed
SemanticCatGame: gameItems, itemIndex, recordResponse
GoNoGoGame: gameItems, itemIndex, recordResponse
TriviaGame: gameItems, itemIndex, recordResponse
MCQOverlay: mcqData, submitMCQ
EncodingScreen: sessionId, blockNumber, setPhase, submitEncoding
EncodingCard: (no store - receives task via props)
EncodingQuiz: (no store - receives task via props)
Clock: simulatedTime
MiniMap: currentRoom
ActivityLabel: activityLabel, currentRoom
RobotStatus: robotStatus, robotText
TriggerZone: triggers, clickTrigger
WelcomeScreen: setSession, setPhase, setBlockNumber
OnboardingScreen: setPhase
QuestionnaireScreen: submitQuestionnaire, blockNumber
BlockEndScreen: blockNumber, setBlockNumber, setPhase, resetBlock
CompleteScreen: wsSend
```

---

## 3. ZUSTAND STORE ARCHITECTURE (gameStore.js)

### State Shape
```javascript
{
  // Session info
  sessionId: null,
  participantId: null,
  group: null,
  conditionOrder: [],

  // Phase control
  phase: 'welcome', // welcome→onboarding→encoding→playing→questionnaire→block_end→complete
  blockNumber: 0,

  // Active game
  currentGameType: null, // 'semantic_cat' | 'go_nogo' | 'trivia'
  currentSkin: null,
  gameItems: [], // Items for current game
  itemIndex: 0, // Current position in gameItems
  gameActive: boolean,
  gameDimmed: boolean, // Opacity when MCQ visible

  // Response collection
  ongoingStats: { correct, wrong, missed, total },
  responseBuffer: [], // Batched before sending

  // Sidebar state
  simulatedTime: '10:00 AM',
  currentRoom: 'study', // study|kitchen|living|entrance|balcony
  activityLabel: 'Getting ready',
  triggers: [...8 triggers], // {id, emoji, label, state: inactive|ambient|fired, taskId}
  activeExecutionWindow: { taskId, sidebarIcon, expiresAt },

  // Robot
  robotStatus: 'idle' | 'speaking',
  robotText: null,
  utteranceQueue: [],

  // MCQ/PM
  mcqVisible: boolean,
  mcqData: { task_id, question, options, time_limit_s },
  mcqStartTime: null,

  // WebSocket
  wsConnected: boolean,
  wsSend: (msg) => void, // Function to send WS messages
}
```

### Key Actions

| Action | Purpose | Side Effects |
|--------|---------|--------------|
| `setSession(data)` | Initialize from welcome login | Sets sessionId, participantId, group, conditionOrder |
| `setPhase(phase)` | Advance phase state machine | Triggers screen transitions |
| `setBlockNumber(n)` | Move to block N | Used in block_end screen |
| `handleGameStart(data)` | WS event: game begins | Sets currentGameType, gameItems, clears itemIndex, resets stats |
| `handleGameEnd()` | WS event: game finishes | Clears game state |
| `handleRoomTransition(data)` | WS event: room change | Updates currentRoom, simulatedTime, activityLabel |
| `handleRobotSpeak(data)` | WS event: robot message | Pushes to utteranceQueue, auto-plays if idle |
| `playNextUtterance()` | Dequeue & speak | Sets robotStatus='speaking', robotText |
| `finishSpeaking()` | After TTS ends | Sets robotStatus='idle', schedules playNextUtterance() |
| `handleTriggerFire(data)` | WS event: trigger activates | Sets trigger state='fired', starts 30s activeExecutionWindow |
| `handleAmbientPulse(data)` | WS event: trigger ambient pulse | Sets state='ambient', auto-reverts after 10s |
| `handleWindowClose(data)` | WS event: PM window expires | Clears activeExecutionWindow, hides MCQ, undims game |
| `clickTrigger(triggerId)` | User clicks fired trigger | Sends WS message: {type: 'trigger_click', data: {task_id}} |
| `showMCQ(data)` | WS event: MCQ overlay | Sets mcqVisible=true, mcqData, gameDimmed=true, starts timer |
| `submitMCQ(selected)` | User submits answer | Sends WS: {type: 'mcq_answer', ...}, clears MCQ state |
| `recordResponse(response)` | Game records item response | Updates ongoingStats, pushes responseBuffer |
| `flushResponseBuffer()` | Batch send responses | Sends WS: {type: 'ongoing_batch', data: {responses, ...}} |
| `handleBlockEnd()` | WS event: block finishes | Sets phase='questionnaire' |
| `submitQuestionnaire(data)` | User submits post-block survey | Sends WS: {type: 'questionnaire', ...} |
| `submitEncoding(taskId, attempts)` | User completes PM task quiz | Sends WS: {type: 'encoding_result', ...} |
| `resetBlock()` | Prepare for next block | Clears all gameplay state, resets triggers |

---

## 4. DATA FLOW: WEBSOCKET & API INTEGRATION

### WebSocket Connection (useWebSocket.js)

**When**: Triggered when `sessionId && blockNumber && phase in ['encoding', 'playing', 'questionnaire', 'complete']`

**URL Format**:
```
ws(s)://host/api/session/{sessionId}/block/{blockNumber}/stream?client=participant&auto_start={autoStart}
```
- `autoStart=true` only when phase === 'playing'

**Event Handlers** (WS → Store):
```javascript
{
  'game_start': handleGameStart,
  'game_end': handleGameEnd,
  'room_transition': handleRoomTransition,
  'reminder_fire': handleRobotSpeak (type: 'reminder'),
  'robot_speak': handleRobotSpeak (type: 'neutral'),
  'trigger_fire': handleTriggerFire,
  'window_close': handleWindowClose,
  'ambient_pulse': handleAmbientPulse,
  'block_start': console.log,
  'block_end': handleBlockEnd,
  'mcq_data': showMCQ,
  'mcq_result': console.log,
  'encoding_ack': (no-op),
  'questionnaire_ack': (no-op),
  'ongoing_ack': (no-op),
  'keepalive': (no-op),
}
```

**Messages Sent** (Store → WS):
```javascript
{
  type: 'heartbeat' // Every 10s
}
{
  type: 'trigger_click',
  data: { task_id }
}
{
  type: 'mcq_answer',
  data: { task_id, selected, mcq_response_time_ms, client_ts }
}
{
  type: 'ongoing_batch',
  data: {
    game_type,
    skin,
    block_number,
    responses: [
      { item_index, item_id, selected, correct, skipped, response_time_ms, client_ts }
    ]
  }
}
{
  type: 'encoding_result',
  data: { task_id, quiz_attempts }
}
{
  type: 'questionnaire',
  data: { intrusiveness, helpfulness, block } // block-end
}
{
  type: 'questionnaire',
  data: { mse_score, strategy_use, open_feedback, block: 'final' } // completion
}
```

**Reconnection Logic**:
- Exponential backoff: 500ms * 2^retryCount (capped at 5s)
- Closed by user flag prevents auto-reconnect

### HTTP API Calls (api.js)

**Endpoints Called**:
```javascript
POST /api/session/start             // Start new session (token)
GET  /api/session/{sessionId}/block/{blockNum}  // Get block config + PM tasks
GET  /api/game-items/{skin}         // Get game items (rarely called - usually via WS)
GET  /api/session/{sessionId}/resume // Resume session
```

**Vite Proxy**: `/api` → `http://localhost:5000` (dev mode)

---

## 5. RESPONSE RECORDING PIPELINE

### Game Response Collection
```
Game Component (SemanticCatGame|GoNoGoGame|TriviaGame)
  ↓ (user clicks or timeout)
  recordResponse({
    item_index,
    item_id,
    selected,      // User's answer
    correct,       // Boolean
    skipped,       // Boolean (timeout)
    response_time_ms,
    client_ts
  })
  ↓ (Zustand action)
  Push to responseBuffer[]
  Update ongoingStats (correct/wrong/missed/total)
  Increment itemIndex
  ↓ (Every 5s in GameShell + useWebSocket)
  flushResponseBuffer()
  ↓
  Send WS: {type: 'ongoing_batch', data: {...}}
  ↓ (WS ACK)
  responseBuffer = []
```

### PM Task Encoding Phase
```
EncodingScreen (loading block config)
  ↓
  Tasks loaded: taskA, taskB
  ↓ (User: card A → quiz A → card B → quiz B)
  EncodingQuiz (attempts tracking)
    ↓ (user selects correct answer)
    onComplete(attempts)
    ↓
    submitEncoding(taskId, attempts)
    ↓
    Send WS: {type: 'encoding_result', data: {task_id, quiz_attempts}}
```

### PM Task Execution (Playing Phase)
```
WS Event: trigger_fire {sidebar_icon, task_id}
  ↓
  handleTriggerFire()
  ↓
  trigger.state = 'fired'
  activeExecutionWindow = {taskId, sidebarIcon, expiresAt: now+30s}
  gameDimmed = true
  ↓
  User sees MCQ overlay (30s timer)
    ↓ (user selects answer or times out)
    submitMCQ(selected)
    ↓
    Send WS: {type: 'mcq_answer', data: {task_id, selected, mcq_response_time_ms}}
    ↓
    Clear MCQ, undim game
```

---

## 6. AUDIO MANAGEMENT (useAudio.js)

### Robot TTS (Text-to-Speech)
```
handleRobotSpeak(data) 
  ↓
  utteranceQueue.push({text, type})
  ↓ (if robotStatus === 'idle')
  playNextUtterance()
  ↓
  window.speechSynthesis.speak(utterance)
  Set robotStatus = 'speaking'
  Display robotText in bubble
  ↓ (after utterance ends)
  finishSpeaking()
  ↓
  Schedule playNextUtterance() after 500ms delay
```

**Speech Config**:
- Language: 'en-US'
- Rate: 0.9 (slower)
- On error: Fallback 3s timeout

### Trigger Sound Effects
```
Detect trigger state change (idle → ambient|fired)
  ↓
  createBeep() via Web Audio API
  ↓
  Oscillator (880 Hz sine wave)
  Gain: 0.3 → 0.001 over 0.3s
```

---

## 7. CRITICAL COMPONENT ANALYSIS

### GameShell (Orchestrator)
**Responsibilities**:
- Initialize WebSocket hook
- Initialize Audio hook
- Dispatch phase-based screen
- Display MCQ overlay on top during playing
- Manual response buffer flush every 5s (redundant with useWebSocket)

**Props**: None
**Store Hooks**: phase, mcqVisible

### MainPanel (Game Router)
**Routing Logic**:
```javascript
if (!gameActive) → TransitionScreen
else if (gameType === 'semantic_cat') → SemanticCatGame
else if (gameType === 'go_nogo') → GoNoGoGame
else if (gameType === 'trivia') → TriviaGame
```

**Props**: None
**Store Hooks**: currentGameType, gameActive, gameDimmed

### SemanticCatGame / GoNoGoGame / TriviaGame
**Common Pattern**:
1. Get currentItem from gameItems[itemIndex]
2. On mount: shownAtRef = Date.now()
3. Setup timeout (2.5-7s depending on game)
4. User clicks button OR timeout → recordResponse()
5. Timeout auto-records with skipped=true
6. Feedback flash (300ms) after each response

**Key Differences**:
| Game | Timeout | Button Interaction | Correctness |
|------|---------|-------------------|-------------|
| SemanticCat | 4s | Category selection (Work/Personal/Spam) | currentItem.category or .correct_category |
| GoNoGo | 2.5s | "Add to Cart" button | type==='go' (button press correct) |
| Trivia | 7s | True/False buttons | currentItem.answer or .correct_answer |

### Sidebar Components
- **Clock**: Parses simulatedTime → sky gradient + icon
- **MiniMap**: 5 rooms (study, kitchen, living, entrance, balcony)
- **ActivityLabel**: Room + narrative text
- **RobotStatus**: Indicator + speech bubble
- **TriggerZone**: 8 household events, clickable when fired

---

## 8. IDENTIFIED BUGS & ISSUES

### 🔴 **CRITICAL ISSUES**

1. **Response Buffer Flushing - REDUNDANCY & RACE CONDITION**
   - **Location**: GameShell.jsx lines 22-29 + useWebSocket.js lines 106-111
   - **Issue**: Same flushResponseBuffer() called from TWO places
     - GameShell: every 5s when phase === 'playing'
     - useWebSocket: every 5s unconditionally
   - **Risk**: Potential double-send or missed batches
   - **Fix**: Remove one, keep only useWebSocket version

2. **MCQ Timer - NO AUTO-SUBMIT ON TIMEOUT**
   - **Location**: MCQOverlay.jsx lines 7-23
   - **Issue**: Timer counts down to 0 but no auto-submit (user must click)
   - **Risk**: Incomplete PM data collection if user ignores MCQ
   - **Fix**: Add: `if (timeLeft === 0) { submitMCQ(-1) }` or similar

3. **Block Config Mismatch - PM_TASKS vs API Response**
   - **Location**: EncodingScreen.jsx lines 25-26
   - **Issue**: Tries to access `data.pm_tasks` but also fallback to `[data.task_a, data.task_b]`
   - **Risk**: Unclear which format backend sends
   - **Fix**: Clarify backend contract + add error boundary

4. **Encoding Quiz - Incorrect Answer Handling**
   - **Location**: EncodingQuiz.jsx line 22
   - **Issue**: On wrong answer, `setSelected(null)` clears choice but shows error
   - **Risk**: UX confusing (answer disappears when wrong)
   - **Fix**: Keep selected state, disable submit button for 2s instead

5. **WS URL Mismatch - Query Parameters**
   - **Location**: useWebSocket.js line 43
   - **Issue**: `auto_start=${autoStart}` param only set to true during 'playing'
   - **Risk**: If encoding/questionnaire need timeline started, this breaks
   - **Note**: Backend likely handles this, but fragile

### 🟠 **MAJOR ISSUES**

6. **No Error Handling for WS Parse Failures**
   - **Location**: useWebSocket.js lines 58-68
   - **Issue**: `try/catch` swallows errors, only logs to console
   - **Fix**: Store error state in Zustand, display to user

7. **Heartbeat May Fail Silently**
   - **Location**: useWebSocket.js lines 95-103
   - **Issue**: `wsSend()` called but no error handling if WS not ready
   - **Fix**: Check ws.readyState === OPEN before sending

8. **Phase State Machine - No Validation**
   - **Location**: gameStore.js line 68
   - **Issue**: setPhase() accepts any string, no validation
   - **Risk**: Typo causes broken state
   - **Fix**: Use enum or whitelist

9. **Active Execution Window Expires But Not Cleared**
   - **Location**: gameStore.js handleTriggerFire() line 142
   - **Issue**: `expiresAt` set but never checked/cleared by component
   - **Risk**: Ghost execution window if window_close WS event delayed
   - **Fix**: Add cleanup timer

10. **Game Dimming Not Reversed on Phase Change**
    - **Location**: MainPanel.jsx line 13
    - **Issue**: gameDimmed persists if phase changes before MCQ closes
    - **Fix**: Add cleanup in gameStore.setPhase()

### 🟡 **MODERATE ISSUES**

11. **Token Validation - No Length Check**
    - **Location**: WelcomeScreen.jsx line 16
    - **Issue**: Only checks `.trim()`, no format validation
    - **Fix**: Add regex or length limits

12. **Duplicate Observer Pattern in useAudio**
    - **Location**: useAudio.js lines 43-47
    - **Issue**: `useGameStore.subscribe()` creates listener each render
    - **Risk**: Memory leak if unmounted during subscription
    - **Fix**: Return unsub in dependency array

13. **EncodingScreen - No Retry on Failed Load**
    - **Location**: EncodingScreen.jsx lines 53-66
    - **Issue**: Error screen has "Retry" button but no retry logic
    - **Fix**: Add onClick={fetchConfig}

14. **Trigger State Transitions - No Validation**
    - **Location**: gameStore.js multiple places
    - **Issue**: Can transition directly inactive→fired without ambient
    - **Risk**: Visual inconsistency
    - **Note**: Likely acceptable per spec

15. **CompleteScreen - wsSend May Be Null**
    - **Location**: CompleteScreen.jsx lines 47-57
    - **Issue**: No check if wsSend exists before sending
    - **Fix**: Add guard clause

### 🟢 **MINOR ISSUES**

16. **API Error Messages - Not User Friendly**
    - **Location**: api.js line 9
    - **Issue**: Shows raw `.detail` from backend
    - **Fix**: Wrap in user-friendly message

17. **Logger - Timestamp Precision**
    - **Location**: logger.js line 13
    - **Issue**: Only shows HH:mm:ss.SSS (no date)
    - **Note**: Acceptable for dev logging

18. **Clock Component - No Validation of Time Format**
    - **Location**: Clock.jsx lines 6-17
    - **Issue**: If timeStr is malformed, returns 12 (noon)
    - **Fix**: Add warning log

---

## 9. POTENTIAL FRONTEND-BACKEND MISMATCHES

| Issue | Frontend | Backend Expected | Risk |
|-------|----------|------------------|------|
| PM Task Format | `data.pm_tasks` OR `[data.task_a, data.task_b]` | ? | 404 if field name wrong |
| Task ID Fields | `task.task_id` or `task.id` | Inconsistent | TypeError if wrong |
| Trigger Icon Names | 8 hardcoded IDs (dinner_table, etc) | Must match config | Trigger won't fire if mismatch |
| WS Message ACK | Expects specific event types | ? | Silent failures if missing |
| Game Item Fields | `currentItem.category` / `.correct_category` | ? | Undefined errors |
| Response Batch Size | No limit | ? | OOM if backend sends huge batch |
| Session Resume | getBlockConfig called but resume() endpoint exists | ? | Dead code? |

---

## 10. COMPONENT PROPS REFERENCE TABLE

| Component | Receives Props | Source |
|-----------|---|---------|
| EncodingCard | `task`, `onNext` | Parent (EncodingScreen) |
| EncodingQuiz | `task`, `onComplete` | Parent (EncodingScreen) |
| TriggerIcon | `trigger`, `onClick` | Parent (TriggerZone) |
| LikertScale (Questionnaire) | `label`, `value`, `onChange` | Parent |
| LikertScale (CompleteScreen) | `label`, `value`, `onChange`, `labels` | Parent |
| **All Game Components** | **NONE (all via store)** | Zustand |
| **All Sidebar Components** | **NONE (all via store)** | Zustand |
| **All Screen Components** | **NONE (all via store)** | Zustand |

---

## 11. STORE SUBSCRIBER GRAPH

```
Zustand Store (gameStore.js)
    ├── GameShell (reads: phase, mcqVisible)
    ├── MainPanel (reads: currentGameType, gameActive, gameDimmed)
    ├── SemanticCatGame (reads: gameItems, itemIndex | writes: recordResponse)
    ├── GoNoGoGame (reads: gameItems, itemIndex | writes: recordResponse)
    ├── TriviaGame (reads: gameItems, itemIndex | writes: recordResponse)
    ├── MCQOverlay (reads: mcqData | writes: submitMCQ)
    ├── Clock (reads: simulatedTime)
    ├── MiniMap (reads: currentRoom)
    ├── ActivityLabel (reads: activityLabel, currentRoom)
    ├── RobotStatus (reads: robotStatus, robotText)
    ├── TriggerZone (reads: triggers | writes: clickTrigger)
    ├── WelcomeScreen (writes: setSession, setPhase, setBlockNumber)
    ├── OnboardingScreen (writes: setPhase)
    ├── EncodingScreen (reads: sessionId, blockNumber | writes: setPhase, submitEncoding)
    ├── QuestionnaireScreen (reads: blockNumber | writes: submitQuestionnaire)
    ├── BlockEndScreen (reads: blockNumber | writes: setBlockNumber, setPhase, resetBlock)
    └── CompleteScreen (reads: wsSend | writes: wsSend({questionnaire}))
```

---

## 12. EXECUTION FLOW - COMPLETE SESSION

### 1. Welcome Phase
```
User loads app (path: /)
  ↓
App → GameShell (phase: welcome)
  ↓
WelcomeScreen renders
  ↓
User enters token → startSession()
  ↓
setSession(data) → sessionId, participantId, group, conditionOrder
  ↓
setBlockNumber(data.current_block || 1)
  ↓
setPhase('onboarding')
```

### 2. Onboarding Phase
```
OnboardingScreen: 6-page carousel
  ↓ (user clicks "Start Learning Tasks")
  ↓
setPhase('encoding')
```

### 3. Encoding Phase
```
useWebSocket hook NOT activated (phase: 'encoding' is included)
  ↓
EncodingScreen loads blockConfig
  ↓
Tasks A & B displayed as cards → quizzes
  ↓ (user completes both quizzes)
  ↓
submitEncoding() × 2 (sends WS if connected)
  ↓ (WS connected? Yes, if phase in ['encoding', 'playing', 'questionnaire', 'complete'])
  ↓
setPhase('playing')
```

### 4. Playing Phase (Main Game)
```
useWebSocket auto-starts with auto_start=true
  ↓
Block timeline begins (backend)
  ↓
WS: game_start → handleGameStart()
  ↓
gameActive = true, gameItems loaded
  ↓
MainPanel → SemanticCatGame (game 1)
  ↓
User categorizes emails (4s timeout, auto-advance)
  ↓ (responses recorded + buffered)
  ↓ (every 5s)
flushResponseBuffer() → WS: ongoing_batch
  ↓
WS: room_transition → handleRoomTransition()
  ↓
TransitionScreen shows (gameActive = false)
  ↓
WS: game_start (game 2: go_nogo)
  ↓
Similar flow for 2-3 more games
  ↓ (during game play)
WS: reminder_fire → handleRobotSpeak()
  ↓ (robot TTS via useAudio)
  ↓
WS: trigger_fire → handleTriggerFire()
  ↓
Trigger icon animates in sidebar
  ↓ (user clicks or within 30s window)
WS: mcq_data → showMCQ()
  ↓
MCQOverlay renders (30s timer)
  ↓ (user selects or times out)
submitMCQ() → WS: mcq_answer
  ↓
WS: window_close → handleWindowClose()
  ↓
Trigger deactivates, MCQ disappears
  ↓
(repeat trigger/MCQ cycle)
  ↓
WS: block_end → handleBlockEnd()
  ↓
setPhase('questionnaire')
```

### 5. Questionnaire Phase
```
QuestionnaireScreen: 2 Likert scales (intrusiveness, helpfulness)
  ↓
submitQuestionnaire() → WS: questionnaire {intrusiveness, helpfulness, block: 1}
  ↓
setPhase('block_end')
```

### 6. Block End Phase
```
BlockEndScreen: 30s rest countdown
  ↓ (countdown reaches 0)
  ↓ (if block >= 4)
  ↓ setPhase('complete')
(else)
  ↓ resetBlock() (clear all gameplay state)
  ↓ setBlockNumber(blockNumber + 1)
  ↓ setPhase('encoding') (repeat encoding → playing → questionnaire → block_end)
```

### 7. Complete Phase
```
CompleteScreen: Final survey (2 Likert + open text)
  ↓
submitQuestionnaire() → WS: questionnaire {mse_score, strategy_use, open_feedback, block: 'final'}
  ↓
setPhase('done')
  ↓
"Thank you for participating!" screen
```

---

## 13. TAILWIND & CSS CONFIGURATION

### Tailwind Usage
- Utility-first, no custom components
- Color palette: slate (default), blue, emerald, red, amber, orange, purple, cyan
- Responsive: Not used (fixed layout)
- Dark mode: Manual with `bg-slate-900`, `text-gray-100`, etc. (not Tailwind dark: mode)

### Custom CSS (index.css)
```css
@keyframes laundry-jam-shake
  /* Used by ???? — not found in components */
  /* Likely dead code or used by backend-served content */
.laundry-jam-shake
  /* animation: ... infinite */
  /* box-shadow: red glow */
```

### PostCSS
```js
plugins: { tailwindcss: {}, autoprefixer: {} }
```

---

## 14. PERFORMANCE & OPTIMIZATION NOTES

### Strengths
✅ Zustand (lightweight state management)
✅ Framer Motion (hardware-accelerated animations)
✅ useCallback + memo not overused (acceptable)
✅ Response batching every 5s (reduces WS traffic)

### Weaknesses
❌ No memoization of game components (re-render on store changes)
❌ No lazy loading of screens
❌ TriggerZone renders all 8 triggers always (not heavy)
❌ Clock updates only on simulatedTime change (good)

### Optimization Opportunities
- `React.memo()` on game components
- `useMemo()` for gameItems list operations
- Virtual scrolling for event logs (Dashboard, ManagePage)
- Code splitting: separate Dashboard/ManagePage bundles

---

## 15. TESTING CONSIDERATIONS

### Unit Tests Needed
- `gameStore.js`: All action methods
- `useWebSocket.js`: Message routing, reconnection logic
- Game components: Response recording, timeout handling
- `EncodingQuiz.jsx`: Correct/incorrect logic, attempts tracking

### Integration Tests Needed
- WS → Store → UI flow
- Response batch flushing
- Phase transitions (all 7 phases)
- PM task execution (reminder → trigger → MCQ → window_close)

### E2E Tests (Selenium/Cypress)
- Full session flow (welcome → complete)
- Multiple blocks
- Trigger clicking during game
- MCQ submission
- Network failures (WS reconnection)

---

## 16. SECURITY & PRIVACY

### ✅ Good Practices
- Token-based session (no credentials in URL)
- WS messages include timestamps
- No sensitive data in logs

### ⚠️ Concerns
- Token never validated client-side (trust backend)
- No CSRF protection visible
- Response data includes user interactions (expected for experiment)
- Dashboard/ManagePage have no authentication check (accessible to anyone on network)

---

## SUMMARY TABLE: File-to-Responsibility Mapping

| File | Responsibility | Dependencies |
|------|---|---|
| App.jsx | Route by pathname | none |
| GameShell.jsx | Orchestrate game phases | useWebSocket, useAudio, gameStore |
| mainPanel.jsx | Route game type | gameStore |
| SemanticCatGame.jsx | Email categorization | gameStore |
| GoNoGoGame.jsx | Grocery shopping | gameStore |
| TriviaGame.jsx | True/False quiz | gameStore |
| MCQOverlay.jsx | PM task MCQ | gameStore |
| EncodingScreen.jsx | PM task encoding | gameStore, API |
| EncodingCard.jsx | Task learning card | props |
| EncodingQuiz.jsx | Task recall quiz | props |
| WelcomeScreen.jsx | Token login | gameStore, API |
| OnboardingScreen.jsx | Tutorial carousel | gameStore |
| QuestionnaireScreen.jsx | Block-end survey | gameStore |
| BlockEndScreen.jsx | Rest period | gameStore |
| CompleteScreen.jsx | Final survey | gameStore |
| Sidebar.jsx | Sidebar container | none (children use store) |
| Clock.jsx | Time display | gameStore |
| MiniMap.jsx | Room visualization | gameStore |
| ActivityLabel.jsx | Activity text | gameStore |
| RobotStatus.jsx | Robot state + TTS | gameStore |
| TriggerZone.jsx | Trigger icons | gameStore |
| useWebSocket.js | WS connection + routing | gameStore |
| useAudio.js | TTS + sound effects | gameStore |
| gameStore.js | Central state | none |
| api.js | Fetch wrapper | none |
| logger.js | Structured logging | none |
| Dashboard.jsx | Event observer UI | API |
| ManagePage.jsx | Session management UI | API |
| ConfigPage.jsx | Game config editor | API |

