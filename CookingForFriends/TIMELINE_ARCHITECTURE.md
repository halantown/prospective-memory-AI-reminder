# Timeline Architecture — Event Flow Documentation

> Auto-generated architecture trace for debugging timeline event push failures.

---

## 1. Timeline Engine Start Chain

### 1.1 Frontend sends "start game"

**File:** `frontend/src/pages/game/EncodingPage.tsx` → `frontend/src/pages/game/GamePage.tsx`

After the user completes all encoding cards and quizzes:
```
EncodingPage.advanceToNextCard() → setPhase('playing')
→ React re-renders → App.tsx switches to <GamePage />
```

**File:** `frontend/src/pages/game/GamePage.tsx`
```
GamePage mounts → useWebSocket(sessionId, blockNumber)
```

**File:** `frontend/src/hooks/useWebSocket.ts`
```
useEffect → connect() → new WebSocket(`ws://.../ws/game/${sessionId}/${blockNumber}`)
ws.onopen → checks useGameStore.getState().phase === 'playing'
  → sendFn({ type: 'start_game', data: { block_number: blockNumber } })
```

**Message format:** `{ "type": "start_game", "data": { "block_number": 1 } }`

### 1.2 Backend receives `start_game`

**File:** `backend/main.py`
```
@app.websocket("/ws/game/{session_id}/{block_num}")
→ handle_game_ws(ws, session_id, block_num, async_session)
```

**File:** `backend/websocket/game_handler.py`
```
handle_game_ws():
  1. manager.connect_participant(participant_id, ws) → returns queue
  2. Checks if block is already PLAYING → auto-starts timeline (reconnect case)
  3. Creates pump_task (ws_pump) + receiver_task (_ws_receiver)
  4. asyncio.wait([pump_task, receiver_task], FIRST_COMPLETED)
```

**File:** `backend/websocket/game_handler.py` — `_ws_receiver`
```
Receives raw JSON → parses → dispatches on msg_type:
  "start_game" → _handle_start_game(participant_id, block_number, db_factory, send_fn)
```

### 1.3 `_handle_start_game` starts the timeline

**File:** `backend/websocket/game_handler.py` — `_handle_start_game`
```
1. Query Block where participant_id=session_id AND block_number=N
2. Guard: block must be in PENDING or ENCODING status
3. Set block.status = PLAYING, commit
4. Call run_timeline(participant_id, block_number, condition, send_fn, db_factory)
```

### 1.4 TimelineEngine starts

**File:** `backend/engine/timeline.py` — `run_timeline()`
```
1. load_timeline(block_number, condition)
   → tries block_{N}_{condition}.json → block_{N}.json → block_default.json
2. asyncio.create_task(_run())  ← fire-and-forget!
3. Store task in _active_timelines dict
4. Return task (but caller doesn't monitor it)
```

**⚠ RISK:** If `_run()` raises, the task silently fails. No events fire. No error visible.

---

## 2. Event Push Chain

### 2.1 `_run()` main loop

**File:** `backend/engine/timeline.py` — `_run()`

```python
start_time = time.time()
# Build trial lookup (DB query)
for event in events:
    # While waiting for event time, emit time_tick every 10 real seconds
    while t - elapsed > 1.0:
        tick_num = int(elapsed) // 10
        if tick_num != last_tick_num:
            await send_fn("time_tick", {elapsed, game_clock})
        await asyncio.sleep(1.0)
    # Fire event
    await send_fn(event_type, event_data)
# After all events, continue ticking until block duration
await send_fn("block_end", {})
```

### 2.2 Events source

Events come from `backend/data/timelines/block_default.json`:
- 34 events spanning t=0 to t=600
- Types: `block_start`, `ongoing_task_event`, `robot_speak`, `phone_notification`, `pm_trigger`, `block_end`

### 2.3 `send_fn` → ConnectionManager → Queue → WebSocket

```
send_fn(event_type, data)
  → manager.send_to_participant(participant_id, event_type, data)
    → JSON encode: {"event": type, "data": data, "server_ts": time.time()}
    → queue.put(msg) for each connection
      → ws_pump reads queue → ws.send_text(msg)
```

**Key:** Messages go through an asyncio.Queue per connection. The `ws_pump` coroutine drains the queue and sends via WebSocket. A 5-second keepalive timeout prevents stalls.

---

## 3. time_tick Push Chain

### Generated in `_run()` main loop

time_tick is emitted **while waiting between events** (not from the events list):
```
tick_num = int(elapsed) // 10    # changes every 10 real seconds
game_minutes = tick_num            # 1 tick = 1 game minute
game_clock = f"{17 + minutes//60}:{minutes%60:02d}"
```

- First tick at elapsed≈0s → "17:00" (same as initial state, invisible)
- Second tick at elapsed=10s → "17:01" (first visible change)
- Also ticks during the "remaining duration" loop after all events

---

## 4. Frontend Receive Chain

### 4.1 WebSocket message handling

**File:** `frontend/src/hooks/useWebSocket.ts` — `handleMessage`

```typescript
switch (eventType) {
  case 'time_tick':     → setGameClock(data.game_clock), setElapsedSeconds(data.elapsed)
  case 'robot_speak':   → setRobotSpeaking(data.text), setTimeout(clearRobotSpeech, 5000)
  case 'phone_notification': → addPhoneNotification({...})
  case 'pm_trigger':    → addPMTrial({...}), addTriggerEffect(triggerEvent), send trigger_ack
  case 'block_end':     → setPhase('microbreak')
  case 'ongoing_task_event': → handleOngoingTaskEvent(data)
  case 'keepalive':     → (ignore)
}
```

### 4.2 Store → Components

| Store field | Updated by | Consumed by |
|---|---|---|
| `gameClock` | `setGameClock` | `HUD.tsx` |
| `elapsedSeconds` | `setElapsedSeconds` | `HUD.tsx` |
| `robot.speaking/text` | `setRobotSpeaking` | `RobotAvatar.tsx` |
| `phoneNotifications` | `addPhoneNotification` | `PhoneSidebar.tsx` |
| `activePMTrials` | `addPMTrial` | `PMInteraction.tsx` |
| `pans` | `handleOngoingTaskEvent` | Kitchen room component |

All Zustand store actions create new state objects (immutable updates) → components re-render. ✓

---

## 5. Identified Break Points

### ❌ Break Point A: `_ws_receiver` exception handling

**Location:** `game_handler.py` lines 89-133

```python
async def _ws_receiver(...):
    try:
        while True:
            raw = await ws.receive_text()
            msg = json.loads(raw)
            if msg_type == "start_game":
                await _handle_start_game(...)  # If this throws...
            ...
    except WebSocketDisconnect:
        ...
    except Exception as e:
        logger.error(...)  # ...exception is caught here, loop TERMINATES
```

**Impact:** If `_handle_start_game` raises ANY exception, the receiver loop dies.
Then `asyncio.wait(FIRST_COMPLETED)` in `handle_game_ws` returns, the pump is cancelled,
and the participant is disconnected. **No more messages in either direction.**

### ❌ Break Point B: `_run()` silent task failure

**Location:** `timeline.py` line 169

```python
task = asyncio.create_task(_run())  # fire-and-forget
```

If `_run()` raises (e.g., during `_build_trial_lookup` DB query), the task completes
with an exception. Since no one awaits or adds an exception handler, the error is
**silently lost** (only visible via asyncio's default exception handler, easily missed).

### ❌ Break Point C: `_handle_start_game` block not found

**Location:** `game_handler.py` line 147-152

If the block doesn't exist in the DB (e.g., blocks weren't seeded, wrong participant_id),
`_handle_start_game` returns silently with just a warning log. Timeline never starts.

### ❌ Break Point D: Block status guard

**Location:** `game_handler.py` line 155-157

If block is already PLAYING (e.g., page refresh, reconnect), the guard rejects `start_game`.
The auto-start path in `handle_game_ws` would handle this, but timing between them
could cause the auto-start check to also miss it.

### ✅ Frontend send: Verified correct
`useGameStore.getState().phase` reads latest value at `ws.onopen` time. ✓

### ✅ Frontend receive: Verified correct
All event types have proper `case` handlers, store actions create new objects. ✓

### ✅ ConnectionManager: Verified correct
Queue-based with pump. Keepalive prevents timeout.
New connections for the same participant **evict** all previous connections
(close with code 4001 "superseded") to prevent message duplication. ✓

---

## 6. Fix Strategy

1. **Wrap each handler in `_ws_receiver` with try-except** — never let a handler crash the loop
2. **Add top-level try-except to `_run()`** — log errors instead of silently failing
3. **Add exception callback to timeline task** — `task.add_done_callback(...)` to log failures
4. **Add strategic logging** at all chain links for debugging
5. **Make `_handle_start_game` more resilient** — catch and log errors, don't crash receiver
