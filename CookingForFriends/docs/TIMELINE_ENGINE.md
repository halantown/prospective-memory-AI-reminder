# Timeline Engine — Architecture & Configuration Guide

> Complete technical documentation for the CookingForFriends block timeline engine.

---

## 1. Overview

The **Timeline Engine** drives all game events during a 10-minute experiment block. It reads a JSON timeline (either generated per-participant or loaded from a static file), then fires events over WebSocket at precise real-time offsets. Each event triggers frontend behavior: placing steaks, robot speech, phone messages, PM task triggers, etc.

```
Timeline JSON  ─→  TimelineEngine._run()  ─→  send_fn()  ─→  ConnectionManager  ─→  WebSocket  ─→  Frontend
```

### Key Files

| File | Role |
|------|------|
| `backend/engine/timeline.py` | Core engine: `run_timeline()`, `_run()` main loop, event dispatch |
| `backend/engine/timeline_generator.py` | Generates per-participant timelines based on block/condition |
| `backend/engine/execution_window.py` | Silent 60s timer after PM triggers for auto-scoring |
| `backend/engine/pm_tasks.py` | PM task registry (12 tasks across 3 blocks) |
| `backend/engine/message_loader.py` | Phone message pool loader from `data/messages/` |
| `backend/data/timelines/block_default.json` | Static fallback timeline template |
| `backend/websocket/game_handler.py` | WebSocket handler that starts/manages timelines |
| `backend/routers/timeline_editor.py` | REST API for timeline editing |

---

## 2. Architecture

### 2.1 Startup Chain

```
Frontend: EncodingPage completes
  → GamePage mounts → useWebSocket(sessionId, blockNumber)
  → ws.onopen → sends { type: "start_game", data: { block_number: N } }

Backend: main.py @app.websocket("/ws/game/{session_id}/{block_num}")
  → handle_game_ws() in game_handler.py
    → _ws_receiver dispatches "start_game"
      → _handle_start_game()
        1. Query Block from DB, verify status is PENDING/ENCODING
        2. Set block.status = PLAYING
        3. Call run_timeline(participant_id, block_number, condition, send_fn)
```

### 2.2 Timeline Loading Priority

`load_timeline(block_number, condition, **kwargs)` tries sources in order:

1. **Generator** (`timeline_generator.py`): If condition is AF/AFCB/CONTROL or `unreminded_task_id` is provided, generates a participant-specific timeline with correct PM triggers, reminders, fake triggers, and neutral utterances.
2. **Specific JSON**: `data/timelines/block_{N}_{condition}.json`
3. **Block JSON**: `data/timelines/block_{N}.json`
4. **Default JSON**: `data/timelines/block_default.json`
5. **Empty fallback**: `{ "events": [], "duration_seconds": 600 }`

### 2.3 The `_run()` Main Loop

```python
async def _run():
    start_time = time.time()
    trial_lookup = await _build_trial_lookup(...)  # DB query: task_id → trial info

    for event in events:
        # 1. Wait for event time, emitting time_tick every 10 real seconds
        while event.t - elapsed > 1.0:
            tick_num = int(elapsed) // 10
            if tick_num != last_tick_num:
                await send_fn("time_tick", { elapsed, game_clock })
            await asyncio.sleep(1.0)

        # 2. Shallow-copy event data (prevent template mutation)
        event_data = dict(event["data"])

        # 3. Resolve reminder placeholders
        #    {{reminder:task_id}} → actual text (AF/AFCB) or skip (CONTROL)

        # 4. Handle special event types:
        #    - phone_message: load from message pool, build WS payload
        #    - pm_trigger: record trigger_fired_at, start execution window
        #    - pm_watch_activity: register activity watcher with fallback

        # 5. Send event to frontend via WebSocket
        await send_fn(event_type, event_data)

    # 6. Continue time_ticks until block duration expires
    # 7. Send block_end if not already in events
    # 8. Call on_complete callback (marks block as COMPLETED in DB)
```

### 2.4 Time System

- **Real time**: `time.time()` tracks wall-clock elapsed seconds
- **Game clock**: Each 10 real seconds = 1 game minute. Starts at 17:00.
  - `tick_num = int(elapsed) // 10`
  - `game_clock = f"{17 + tick_num // 60}:{tick_num % 60:02d}"`
- **time_tick events**: Emitted every 10s while waiting between events

### 2.5 WebSocket Message Flow

```
send_fn(event_type, data)
  → manager.send_to_participant(participant_id, event_type, data)
    → JSON: { "event": type, "data": data, "server_ts": time.time() }
    → queue.put(msg) for each connection
      → ws_pump reads queue → ws.send_text(msg)
```

The ConnectionManager uses per-connection asyncio Queues with a pump coroutine. A 5-second keepalive prevents WebSocket timeouts. New connections for the same participant evict previous ones (code 4001 "superseded").

---

## 3. Event Types

### 3.1 `block_start`
| Field | Type | Description |
|-------|------|-------------|
| *(none)* | — | Marks block start. Always at t=0. |

### 3.2 `block_end`
| Field | Type | Description |
|-------|------|-------------|
| *(none)* | — | Marks block end. Also auto-sent after duration expires if not in events. |

### 3.3 `ongoing_task_event`
| Field | Type | Description |
|-------|------|-------------|
| `task` | string | Task type: `"steak"` or `"dining"` |
| `event` | string | Event name: `"place_steak"`, `"table_ready"` |
| `pan` | int | Pan number 1–3 (for steak tasks) |
| `room` | string | Room where event occurs: `"kitchen"`, `"bedroom"` |

Steaks are placed every 20 seconds, cycling through 3 pans. This is the ongoing task participants perform throughout the block.

### 3.4 `robot_speak`
| Field | Type | Description |
|-------|------|-------------|
| `text` | string | Speech text, or `{{reminder:task_id}}` placeholder |
| `log_tag` | string | `"neutral"` or `"reminder"` |
| `task_id` | string? | PM task ID (for reminders only) |
| `condition` | string? | Experiment condition (for reminders only) |

**Reminder resolution**: `{{reminder:task_id}}` placeholders are resolved at runtime:
- **CONTROL**: Reminder event is skipped entirely (not sent)
- **AF/AFCB**: Resolved to baseline reminder text from task registry

### 3.5 `phone_message`
| Field | Type | Description |
|-------|------|-------------|
| `message_id` | string | References `data/messages/messages_dayN.json` pool |

At runtime, the engine loads the full message from the pool file, builds a rich WS payload with sender/avatar/text/replies, and sends it. The frontend receives the full payload, not just the message_id.

### 3.6 `pm_trigger`
| Field | Type | Description |
|-------|------|-------------|
| `trigger_id` | string | PM task ID |
| `trigger_event` | string | Human-readable trigger description |
| `trigger_type` | string | `"visitor"` \| `"communication"` \| `"appliance"` \| `"activity"` |
| `task_id` | string | PM task ID |
| `signal.audio` | string | Audio file name |
| `signal.visual` | string | Visual event type for frontend |

When fired, the engine also:
1. Records `trigger_fired_at` on the PMTrial DB record
2. Starts a silent execution window (30s primary + 60s extended)
3. Auto-scores trial as 0 if no `pm_attempt` received within 60s

### 3.7 `pm_watch_activity`
| Field | Type | Description |
|-------|------|-------------|
| `task_id` | string | PM task ID |
| `watch_condition` | string | Game state condition to watch for |
| `fallback_time` | int | Seconds offset for fallback trigger |

Internal event — **not forwarded to frontend**. Registers an activity watcher that fires the PM trigger when a game-state condition is met (e.g., `"all_steaks_plated"`), or at the fallback time if not met.

### 3.8 `fake_trigger`
| Field | Type | Description |
|-------|------|-------------|
| `trigger_type` | string | `"visitor"` \| `"appliance"` |
| `content` | string | Description of the fake event |
| `duration` | int | How long the event lasts (seconds) |

Fake triggers set participant expectations without requiring any PM action. Placed ~45s before the first real trigger in each block.

---

## 4. Configuration Reference

### 4.1 `config.py` Timeline Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `BLOCK_DURATION_S` | 600 | Block duration in seconds (10 min) |
| `EXECUTION_WINDOW_S` | 30 | Primary PM execution window |
| `LATE_WINDOW_S` | 60 | Extended window before auto-score 0 |
| `REMINDER_LEAD_S` | 120 | Reminder fires ~120s before trigger |
| `DATA_DIR` | `backend/data` | Base directory for timeline/message files |

### 4.2 PM Task Registry (`pm_tasks.py`)

12 tasks across 3 blocks (4 per block). Each `PMTaskDef` defines:
- Trigger type & timing
- Target room/object
- Encoding text & quiz
- Baseline reminder text

Key data structures:
```python
BLOCK_TRIGGER_ORDER = { 1: [...], 2: [...], 3: [...] }  # task_ids per block
BLOCK_TRIGGER_TIMES = { 1: {"b1_book": 240, ...}, ... }  # seconds for fixed triggers
ACTIVITY_WATCH_CONFIG = { "b1_soap": { "watch_from": 100, ... }, ... }  # for activity triggers
```

### 4.3 Timeline JSON Schema

```json
{
  "block_number": 1,
  "condition": "CONTROL",
  "duration_seconds": 600,
  "events": [
    { "t": 0,   "type": "block_start", "data": {} },
    { "t": 30,  "type": "robot_speak",  "data": { "text": "Hello!", "log_tag": "neutral" } },
    { "t": 240, "type": "pm_trigger",   "data": { "trigger_id": "b1_book", ... } },
    { "t": 600, "type": "block_end",    "data": {} }
  ]
}
```

Events **must** be sorted by `t` (ascending). The engine processes them sequentially.

---

## 5. Timeline Editor

An admin page at `/timeline-editor` provides visual editing capabilities:

- **Load** existing timeline JSON files
- **Generate** previews for any block × condition combination
- **Edit** event times, types, and data fields inline
- **Add/duplicate/delete** events
- **Save** back to JSON files with validation

### API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/timelines` | List all timeline files + generatable combos |
| GET | `/api/admin/timelines/file/{filename}` | Get a timeline file |
| PUT | `/api/admin/timelines/file/{filename}` | Save/update a timeline file |
| POST | `/api/admin/timelines/preview` | Generate a preview timeline |
| GET | `/api/admin/timelines/schema` | Get event type schema |

---

## 6. Known Issues & Mitigations

### ✅ Fixed: Reminder resolution for CONTROL
`_resolve_reminder()` now returns `None` for CONTROL condition. The `_run()` loop skips sending the event entirely when resolution returns `None`.

### ✅ Fixed: Event data mutation
Event data dicts are now shallow-copied before modification, preventing corruption of shared timeline templates.

### ✅ Fixed: Block completion callback
`_handle_start_game()` now passes an `on_complete` callback to `run_timeline()`. When the timeline finishes normally, the block status is updated to COMPLETED in the database.

### ⚠ Design Note: Fire-and-forget timeline task
The timeline runs as an `asyncio.create_task()` with a done-callback for error logging. If `_run()` crashes, the error is logged via `_on_task_done()` but the participant sees no events. Monitor logs for `[TIMELINE] Task failed` messages.

### ⚠ Design Note: Reconnection handling
When a client reconnects during an active block (status=PLAYING), `handle_game_ws()` auto-starts a new timeline. The old connection's cleanup cancels the previous timeline if it's still the latest connection. Race conditions are mitigated by connection ID tracking.

---

## 7. Extending the System

### Adding a new event type

1. Add the type to `VALID_EVENT_TYPES` in `routers/timeline_editor.py`
2. Add handling logic in `_run()` in `timeline.py`
3. Add a `case` handler in `useWebSocket.ts` on the frontend
4. Update `EVENT_COLORS` and `EVENT_LABELS` in `TimelineEditorPage.tsx`
5. Document the data schema in this file

### Creating a custom timeline

1. Create `data/timelines/block_{N}_{condition}.json`
2. Follow the JSON schema (Section 4.3)
3. Ensure events are sorted by `t`
4. Include `block_start` at t=0 and `block_end` at t=duration
5. Use the Timeline Editor to visually verify

### Modifying trigger timing

Edit `BLOCK_TRIGGER_TIMES` in `pm_tasks.py` for fixed triggers, or `ACTIVITY_WATCH_CONFIG` for activity-based triggers. The timeline generator uses these to place events.
