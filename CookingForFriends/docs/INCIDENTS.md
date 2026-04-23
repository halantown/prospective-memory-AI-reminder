# Incident Log

<!--
Template (copy for each new incident):

## INC-XXX — <One-line title>

| Field        | Detail |
|--------------|--------|
| Date         | YYYY-MM-DD |
| Severity     | P0 Critical / P1 High / P2 Medium / P3 Low |
| Status       | Resolved / Monitoring / Open |
| Reported by  | (who / how it was noticed) |
| Affected area| (component / endpoint / feature) |

### Background
> What was the system doing? What is the normal expected behaviour?

### Incident Description
> What went wrong? What did users / logs see?

### Timeline
| Time (local) | Event |
|--------------|-------|
| HH:MM | First symptom observed |
| HH:MM | Investigation started |
| HH:MM | Root cause identified |
| HH:MM | Fix deployed |
| HH:MM | Confirmed resolved |

### Root Cause
> Technical explanation of why this happened.

### Contributing Factors
> Anything that made this more likely or harder to catch.

### Fix
> What exactly was changed and why.

### Verification
> How was the fix confirmed to work?

### Follow-up Actions
> Preventive measures, monitoring improvements, tests to add, etc.
-->

---

## INC-001 — Duplicate phone messages + wrong-contact routing on WebSocket reconnect

| Field        | Detail |
|--------------|--------|
| Date         | 2025-07-12 |
| Severity     | P1 High |
| Status       | Resolved |
| Reported by  | User (observed duplicate messages and messages appearing in wrong contact thread) |
| Affected area| Phone sidebar / WebSocket reconnect / `timeline.py` / `game_handler.py` / `gameStore.ts` |

### Background
The phone sidebar delivers chat messages from a timeline at scheduled wall-clock offsets. Messages are keyed by contact (alice, sophie, jake, tom, emma). The frontend Zustand store accumulates all received messages and each `ChatView` filters by `contactId`.

### Incident Description
- **Bug 1**: The same phone messages appeared multiple times in a contact's chat thread after page refresh or WebSocket reconnect.
- **Bug 2**: Messages appeared in the wrong contact's thread (secondary symptom of Bug 1).

### Timeline
| Time (local) | Event |
|--------------|-------|
| Investigation | Root cause traced to `run_timeline()` restarting from `t=0` |
| Investigation | Confirmed `addPhoneMessage` in gameStore had no dedup guard |
| Fix | Added `block_start_time` param to `run_timeline`; skip past events on reconnect |
| Fix | Passed `block.started_at.timestamp()` from `game_handler.py` reconnect path |
| Fix | Added `id`-based dedup in `addPhoneMessage` in `gameStore.ts` |
| Resolved | Commit `b75a526` |

### Root Cause
`run_timeline()` always initialised `start_time = time.time()`, meaning every reconnect treated the block as starting fresh. Events with `t < elapsed_since_real_start` had negative `wait_seconds` and fired immediately, re-delivering all historical phone messages in a burst.

### Contributing Factors
- No idempotency check in the frontend message store.
- `game_handler.py` reconnect path did not pass the block's real start time to the timeline.

### Fix
1. **`backend/engine/timeline.py`** — Added optional `block_start_time: float | None` parameter. When provided, computes `resume_offset = time.time() - block_start_time` and skips any event whose scheduled time `t <= resume_offset`.
2. **`backend/websocket/game_handler.py`** — In the reconnect path (block already `PLAYING`), reads `block.started_at.timestamp()` and passes it as `block_start_time` to `run_timeline`.
3. **`frontend/src/stores/gameStore.ts`** — `addPhoneMessage` now checks `s.phoneMessages.some(m => m.id === msg.id)` before appending; duplicate IDs are silently dropped.

### Verification
TypeScript build passes (`tsc --noEmit` clean). Logic reviewed: on reconnect, `resume_offset` > 0 causes all already-fired events to be skipped in the `for event in events` loop. Frontend dedup is a safe last-resort guard.

### Follow-up Actions
- [ ] Add integration test: connect WS → start block → disconnect → reconnect → assert phone messages in store still have length == original (no duplicates)
- [ ] Monitor: log a warning in `game_handler.py` if `block.started_at` is `None` when block is `PLAYING` (data integrity guard)

---

## INC-002 — CookingEngine not restarted after WebSocket reconnect

| Field        | Detail |
|--------------|--------|
| Date         | 2025-07-11 |
| Severity     | P1 High |
| Status       | Resolved |
| Reported by  | Diagnosis during frontend debugging session |
| Affected area| `game_handler.py` / `CookingEngine` lifecycle |

### Background
`CookingEngine` is instantiated per participant when a game block starts. It drives all cooking-step events to the frontend. On disconnect, the engine is removed from `_cooking_engines`.

### Incident Description
After any page refresh or WebSocket reconnect, the cooking flow was permanently dead — no cooking events reached the frontend. The timeline resumed correctly but `CookingEngine` was never restarted.

### Root Cause
The reconnect path in `game_handler.py` (block already `PLAYING`) called `run_timeline()` again but had no logic to recreate `CookingEngine`. The engine was destroyed on disconnect cleanup (`_cooking_engines.pop(participant_id, None)`) and never recreated.

### Fix
Added `CookingEngine` restart logic immediately after `run_timeline()` in the reconnect path:

```python
if participant_id not in _cooking_engines:
    cooking = CookingEngine(participant_id, block_id, send_fn, db_factory)
    _cooking_engines[participant_id] = cooking
    cooking.start()
```

Commit `4e46ef1`.

### Follow-up Actions
- [ ] Add test: reconnect while block is PLAYING, assert cooking events resume
