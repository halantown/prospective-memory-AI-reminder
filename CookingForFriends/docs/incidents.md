# Incident Log — CookingForFriends Backend

<!-- Template ──────────────────────────────────────────────────────────────────
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
> Use [ ] checkboxes.
────────────────────────────────────────────────────────────────────────────── -->

---

## INC-001 — Game time continues and cooking steps fire during PM overlay

| Field         | Detail                                                                                                        |
| ------------- | ------------------------------------------------------------------------------------------------------------- |
| Date          | 2026-05-09                                                                                                    |
| Severity      | P1 High                                                                                                       |
| Status        | Resolved                                                                                                      |
| Reported by   | User observation — "small but reproducible probability"                                                      |
| Affected area | `engine/timeline.py`, `engine/game_clock.py`, `engine/cooking_engine.py`, `websocket/game_handler.py` |

### Background

When a PM (prospective memory) task triggers, the backend pauses the shared `GameClock` so all game-time events (cooking steps, phone messages, clock display) freeze. The frontend mirrors this with a `gameTimeFrozen` flag that stops the cooking-step countdown banner. Normal expected behaviour: while the PM overlay is visible, no cooking steps fire and the HUD timer does not advance.

### Incident Description

With a small probability (estimated ~1–2 % of PM triggers), participants observed that:

1. The HUD game clock continued counting during the PM greeting/overlay reading phase.
2. Ongoing cooking-step banners appeared and/or their countdowns kept running while the PM overlay was open.

### Timeline

| Time (local) | Event                                                             |
| ------------ | ----------------------------------------------------------------- |
| —           | First symptom reported by experimenter after participant sessions |
| —           | Investigation started — full codebase trace                      |
| —           | Root causes identified (three independent issues)                 |
| —           | Fixes implemented and all 52 backend tests passed                 |
| —           | Confirmed resolved                                                |

### Root Cause

**RC-1 (primary — race in WS message ordering):**
`_emit_time_tick()` in `engine/timeline.py` always sent `"frozen": False`. When the PM session paused the clock and then awaited a DB write, the asyncio event loop could schedule the timeline task to wake and emit a `time_tick`. Because `pm_trigger` was queued via `asyncio.wait_for` (which yields), the `time_tick(frozen=False)` could be enqueued *after* `pm_trigger`, so the frontend received: `pm_trigger → gameTimeFrozen=true`, then `time_tick(frozen=False) → gameTimeFrozen=false`. This reset the freeze flag mid-overlay.

**RC-2 (cooking step race):**
`CookingEngine._run_timeline()` called `_clock.sleep_until(entry.t)` and immediately activated the entry. If a step was scheduled at exactly the same game time as a PM trigger, `sleep_until` returned (remaining = 0) and `_activate_entry` fired before the frontend had set `gameTimeFrozen`. The same scenario applied to `_run_idle_comments`.

**RC-3 (reconnect — wrong clock state):**
When the backend restarted or the WS reconnected while `_block_runtimes` was empty but the block was PLAYING, a fresh `BlockRuntime` with a brand-new `GameClock` was created. The new clock did not account for any PM-pause time accumulated before the reconnect, causing `clock.now()` to report an incorrect (too-high) game time. If `participant.frozen_since` was set in the DB, the clock was also not paused, so `time_tick(frozen=False)` events flowed and cooking steps could fire during an active PM overlay.

### Contributing Factors

- `_emit_time_tick` had no reference to the shared `GameClock` — the `frozen` field was a hardcoded literal.
- `asyncio.wait_for` for critical events (pm_trigger) yields to the event loop, creating a window for the timeline task to run between the clock pause and the WS send.
- `GameClock.restore()` did not exist; reconnect always derived game time from raw wall-clock arithmetic that ignored prior PM pauses.

### Fix

**Fix 1 — `engine/timeline.py`: pass clock to `_emit_time_tick`**
Added `clock: GameClock | None = None` parameter. `frozen` is now `clock.is_paused if clock is not None else False`. Both callers updated to pass `control.clock`. Any `time_tick` emitted while the clock is paused now carries `frozen=True`, so the frontend's `gameTimeFrozen` flag is never incorrectly reset to `false`.

**Fix 2 — `engine/game_clock.py`: `wait_until_running()` method**
Added `async def wait_until_running()` that polls (at `poll_interval_s` = 200 ms) until `is_paused` is false. Used in `CookingEngine._run_timeline()` and `_run_idle_comments()` immediately after `sleep_until()` returns. Steps that reach their scheduled time during a PM pause now block until the overlay resolves before sending `step_activate`.

**Fix 3 — `engine/game_clock.py`: `restore()` method**
Added `def restore(game_time_s, paused, reason)` that initialises `_started_wall_time` and optionally `_paused_at` to produce the exact desired `clock.now()` value, without overwriting it by a subsequent `start()` call (which is already guarded by `if _started_wall_time is not None: return`).

**Fix 4 — `websocket/game_handler.py`: reconnect clock restore**
In the auto-start reconnect path, before `runtime.start()`, the participant's DB fields are used to compute the correct current game time and freeze state, and `runtime.clock.restore(game_time_s, paused=frozen_since is not None)` is called. The new clock therefore matches the persisted state: paused at the right game time if the overlay is still open, or running at the correct accumulated game time if not.

Files changed:

- `backend/engine/game_clock.py` — `restore()` + `wait_until_running()`
- `backend/engine/timeline.py` — `_emit_time_tick` clock parameter + caller updates
- `backend/engine/cooking_engine.py` — `wait_until_running()` after `sleep_until` (timeline + idle comments)
- `backend/websocket/game_handler.py` — reconnect clock restore before `runtime.start()`
- `backend/tests/test_game_clock.py` — 5 new tests for `restore()` and `wait_until_running()`

### Verification

- All 52 backend tests pass (`pytest tests -v`).
- New tests confirm: `restore(paused=True)` freezes at the given game time; `restore(paused=False)` advances from the correct position; a subsequent `start()` is a no-op; `wait_until_running()` returns immediately if not paused and blocks until resumed.

### Follow-up Actions

- [ ] Add an integration test that simulates a WS reconnect during an active PM overlay and asserts that the new runtime's clock is paused at the persisted game time.
- [ ] Add a test that confirms `time_tick` events carry `frozen=True` while the clock is paused.
- [ ] Consider persisting the cooking engine's `_next_timeline_index` so that on reconnect the cooking engine skips already-fired steps rather than rapidly re-activating them after the PM overlay resolves.
- [ ] Review reconnect resume-offset handling in `engine/timeline.py`: if `BlockRuntime` restores `GameClock` from DB but `block_start_time` is unavailable or ignored as stale, `resume_offset` can still be `0`, so past timeline events may be replayed. This is a reconnect/stale-block edge case and is intentionally not fixed in this patch.
- [ ] Review cooking-engine reconnect recovery: `CookingEngine.start()` resets `_next_timeline_index` to `0`, so after reconnect during a PM freeze, old cooking events may fire quickly after resume unless already-fired cooking state is persisted or skipped from current game time. This is a reconnect-during-overlay edge case and is intentionally not fixed in this patch.
- [ ] Monitor participant sessions for recurrence of the clock-continues symptom.
