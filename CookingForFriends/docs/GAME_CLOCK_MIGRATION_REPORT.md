# GameClock / BlockRuntime Migration Report

Date: 2026-05-03

Status: migrated and manually verified in test flow; reconnect remains best-effort and intentionally out of production scope for the current experiment.

## 1. Initial Architecture

Before this migration, gameplay time was not a single concept in the codebase. The system had accumulated several local timing mechanisms as features were added:

1. `timeline.py` owned narrative/gameplay elapsed time.

   - It computed progress with `time.time() - start_time`.
   - It emitted `time_tick`, phone messages, robot events, legacy PM trigger events, and `block_end`.
   - It formatted the displayed 17:00-18:00 clock inline with `elapsed // 10`.
   - Pause semantics were added as `TimelineControl` state after PM overlays became blocking.

2. `cooking_engine.py` owned cooking time separately.

   - It had its own `block_start_time`.
   - It waited for cooking timeline entries with naked sleep / wall elapsed logic.
   - It started timeout tasks per active step.
   - Response time was derived from activation wall timestamp.
   - A separate pause/resume offset was added later to reduce PM-overlay damage.

3. `game_time.py` owned PM trigger time through database fields.

   - `Participant.game_time_elapsed_s`, `frozen_since`, and `last_unfreeze_at` were used to freeze/unfreeze game time for the PM scheduler.
   - `pm_session.py` polled DB game time to decide when the next trigger should fire.
   - Timeline and cooking did not use this same clock.

4. Frontend state had its own historical split.

   - Recipe definitions were hardcoded in the frontend while backend had the authoritative cooking recipes.
   - Kitchen timer queue, active cooking steps, and Recipe tab dish state could diverge.
   - Earlier fixes removed the hardcoded recipe source and derived lock-screen/header timers from `activeCookingSteps`.

This was a typical feature-growth architecture: each subsystem solved its immediate timing problem locally. That was acceptable before global PM interruptions, but became fragile once the PM modal needed to freeze the whole gameplay world.

## 2. Problems Found

### 2.1 PM overlay did not imply global gameplay pause

PM trigger flow is modal: "someone is at the door" -> greeting -> robot reminder -> decoy/action/confidence -> completion. While that modal owns the UI, background gameplay must not progress.

With split time owners, a PM pause fix had to remember every subsystem:

- pause timeline;
- pause cooking;
- freeze DB game time;
- resume all three later.

Any missed subsystem could still advance and contaminate the experimental flow.

### 2.2 `taskId=NULL!` and fake/legacy trigger confusion

Static/generated timelines still contained legacy `pm_trigger` events. EC+/EC- sessions now use `pm_session.py` as the authoritative PM scheduler. If timeline legacy PM events were forwarded, the frontend could receive a PM modal without a real `task_id`, producing the observed debug state:

```text
step=decoy | taskId=NULL! | decoys=0
```

The immediate fix was to skip legacy timeline `pm_trigger` events for EC conditions. The deeper fix was to move PM scheduling onto the same shared gameplay clock and keep timeline PM entries as non-authoritative legacy data.

### 2.3 Cooking state could desync from Recipe and timer UI

The screenshot / WS log showed repeated submissions for the same `tomato_soup step_index=2` and different options. Root causes included:

- frontend recipes were not the backend recipes;
- Recipe tab could highlight dish progress even when no active backend step existed;
- station popup could submit the same active step multiple times before backend response;
- backend originally trusted dish/station more than the client `step_index`.

Those were fixed before this final GameClock migration, but the remaining cooking schedule still needed a single backend time source.

### 2.4 17:00-18:00 display was conflated with block duration

The block can run 900 seconds because late cooking/steak events exist around t=880. But the displayed clock should represent 17:00-18:00, which is 600 gameplay seconds at 10 real/gameplay seconds per displayed minute.

Old architecture used one `duration_seconds` concept for both:

- how long the timeline runner should continue;
- how far the displayed clock should advance.

This caused clocks like 18:02 or beyond. The fix separated `duration_seconds=900` from `clock_end_seconds=600`.

### 2.5 Reconnect code amplified hidden state assumptions

Reconnect attempted to restart timeline/cooking/PM tasks from persisted block status. For the current experiment this is not a primary requirement: a participant closing the browser mid-session should make that session invalid/incomplete. But during development, reusing one token repeatedly exposed stale in-memory and DB state.

The migration therefore does not attempt production-grade state reconstruction. It makes active runtime ownership explicit and keeps test guidance simple: create a fresh admin test session/token for each test run.

## 3. Migration Strategy

The migration was intentionally staged so each step could be tested:

1. Introduce a pure gameplay clock abstraction.
2. Move timeline schedule/display onto it.
3. Move cooking activation/timeout/response time onto it.
4. Inject the same clock into timeline and cooking.
5. Move PM trigger/session-end waits from DB polling to the same clock.
6. Introduce `BlockRuntime` as the lifecycle owner so `game_handler.py` no longer coordinates independent runtime tables.

## 4. Migration Steps

### Step 1 — `GameClock`

Added `backend/engine/game_clock.py`.

Responsibilities:

- `now()` returns pause-aware gameplay seconds.
- `sleep_for(game_seconds)` waits in gameplay time.
- `sleep_until(game_second)` waits until a gameplay deadline.
- `pause(reason)` / `resume(reason)` freeze and resume time.
- `format_game_clock()` converts gameplay seconds to 17:xx display.

Important design point: `GameClock` uses wall time internally, but only as an implementation detail. Gameplay modules consume game seconds, not epoch timestamps.

### Step 2 — Timeline Migration

`backend/engine/timeline.py` was moved to `GameClock` for:

- event waits;
- `time_tick` generation;
- phone-message cooldown;
- `pm_watch_activity` fallback;
- tail loop until block end.

`time_tick` payload now includes explicit game-time fields:

```json
{
  "elapsed": 123,
  "game_time_s": 123,
  "game_clock": "17:12",
  "frozen": false,
  "clock_end_seconds": 600
}
```

`elapsed` remains only for compatibility.

Timeline JSON/generator/admin editor now support:

```json
{
  "duration_seconds": 900,
  "clock_end_seconds": 600
}
```

This fixed the 18:00 display-boundary issue without shortening the actual block.

### Step 3 — Cooking Migration

`backend/engine/cooking_engine.py` was moved to `GameClock` for:

- cooking timeline entry activation with `clock.sleep_until(entry.t)`;
- active step deadline with `deadline_game_time`;
- timeout with `clock.sleep_until(deadline_game_time)`;
- response time with `clock.now() - activated_game_time`.

WS payloads now include gameplay-time fields:

```json
{
  "event": "step_activate",
  "activated_game_time": 250.0,
  "deadline_game_time": 280.0
}
```

Wall-time fields like `activated_at` remain for logging/backward compatibility, but they are not the gameplay scheduler source.

### Step 4 — Shared Clock Injection

`game_handler.py` first gained a per-participant shared `GameClock` and injected it into both:

- `run_timeline(...)`;
- `CookingEngine(...)`.

This removed the worst timeline/cooking divergence. At this stage PM pause/resume still went through legacy glue, but the glue paused the same shared object.

### Step 5 — PM Scheduler Migration

`backend/engine/pm_session.py` now accepts the same `GameClock`.

Changes:

- trigger delays use `clock.sleep_for(delay_remaining)`;
- session-end delay uses `clock.sleep_for(...)`;
- trigger fired game time is recorded from `clock.now()`;
- DB `Participant.game_time_elapsed_s/frozen_since` remains a snapshot/admin/heartbeat state, not the active scheduler owner.

This changed PM from "DB-polling clock owner" to "consumer of the same gameplay clock".

### Step 6 — `BlockRuntime`

Added `backend/engine/block_runtime.py`.

`BlockRuntime` owns one active gameplay block:

- one `GameClock`;
- one timeline task;
- one `CookingEngine`;
- one PM session task;
- start/stop lifecycle;
- pause/resume boundary.

`backend/websocket/game_handler.py` now has one runtime registry:

```python
_block_runtimes: dict[str, BlockRuntime] = {}
```

It no longer owns these separate runtime tables:

```python
_cooking_engines
_game_clocks
_pm_session_tasks
```

PM pipeline now controls gameplay with one call:

```python
runtime.pause("pm")
runtime.resume("pm")
```

Timeline and cooking do not need direct PM-specific pause calls because their sleeps are waiting on the same `GameClock`.

## 5. Final Architecture

### 5.1 Runtime Ownership

Current backend ownership model:

```text
game_handler.py
    └─ _block_runtimes[participant_id]
          └─ BlockRuntime
                ├─ GameClock
                ├─ timeline task
                ├─ CookingEngine
                └─ PM session task
```

`game_handler.py` is now an entrypoint and router:

- validates participant;
- accepts WS;
- creates or stops `BlockRuntime`;
- routes client actions to the active runtime;
- logs interactions;
- persists block completion.

It is no longer the place where individual gameplay modules are manually synchronized.

### 5.2 Time Domains

There are now two intentional time domains.

Gameplay time:

- owner: `BlockRuntime.clock`;
- unit: gameplay seconds;
- paused by PM overlays;
- used by timeline events, phone cooldowns, HUD clock, cooking activation/timeout/RT, PM trigger delays, session-end delay.

Wall time:

- owner: OS/client timestamps;
- unit: epoch seconds/ms;
- not paused by PM overlays;
- used by heartbeat, disconnect detection, mouse tracking, phone send/read logs, PM modal internal response time, execution-window scoring, UI animation.

The rule is: gameplay schedule must not use naked `time.time()` or naked `asyncio.sleep()` unless the code is explicitly wall-time telemetry or transport.

### 5.3 Frontend Contract

Frontend should treat backend `time_tick` as authoritative for gameplay time.

For future cooking countdown display:

```text
remaining = activeStep.deadline_game_time - gameTimeSeconds
```

Do not calculate cooking gameplay countdown from:

```text
Date.now() - activatedAt
```

`activatedAt` is a wall timestamp for logging/backcompat, not a gameplay time owner.

### 5.4 Reconnect Policy

Reconnect is still best-effort. That is intentional for the current experimental protocol.

Current assumptions:

- each test run should use a fresh admin-generated session/token;
- a participant closing the browser mid-experiment should produce an invalid/incomplete session;
- the system should not spend engineering complexity reconstructing all in-memory timeline/cooking/PM runtime from partial DB state unless the experiment protocol changes.

## 6. Remaining Work

1. Remove timeline compatibility thin layers.

   - `TimelineControl`, `_timeline_elapsed()`, and `_sleep_timeline()` now mostly wrap `GameClock`.
   - They can be removed after confirming no legacy caller needs a no-clock path.

2. Rename ambiguous fields.

   - Frontend `elapsedSeconds` should become or be documented as `gameTimeSeconds`.
   - Backend wall fields should keep `*_at` / `*_wall_ts`; gameplay fields should use `*_game_time`.

3. Add an integration test for global PM pause.

   - PM overlay should block `time_tick`, phone messages, cooking timeout, and `block_end`.
   - Current backend tests cover `GameClock` and cooking pause behavior, but not full timeline+PM integration.

4. Decide whether to implement cooking event-chain scheduling.

   - Current cooking timeline is still absolute-time based.
   - Better future architecture: timeline starts each dish; subsequent same-dish steps activate only after previous completion/timeout.

5. If reconnect becomes a real requirement, design it explicitly.

   - Do not grow ad-hoc restart logic in `game_handler.py`.
   - Persist runtime snapshots and define incomplete/restore thresholds first.

## 7. Verification

Automated checks run during migration:

```bash
cd CookingForFriends
conda run -n thesis_server python -m py_compile backend/engine/block_runtime.py backend/websocket/game_handler.py
```

```bash
cd CookingForFriends/backend
conda run -n thesis_server pytest tests -q
```

Result:

```text
27 passed
```

Manual verification:

- User confirmed the migrated flow tested correctly before final cleanup.
- PM trigger flow no longer reproduces the previous stuck `taskId=NULL!` path in normal EC PM scheduling.
- Cooking timer/recipe/PM pause behavior was manually checked through fresh test sessions.

## 8. Net Effect

The architecture evolved from "several modules each own their own time and `game_handler.py` tries to synchronize them" to "one block runtime owns one game clock, and all gameplay schedulers consume that clock".

This is the core improvement:

```text
Before:
timeline clock + cooking clock + PM DB clock + frontend-derived assumptions
    -> boundary glue, race risk, modal pause leaks

After:
BlockRuntime
    -> one GameClock
    -> timeline/cooking/PM all wait on the same pause-aware gameplay time
```

The code is not finished in the sense of being production-grade reconnect infrastructure. It is finished for the immediate goal: run the experimental gameplay flow with coherent pause-aware timeline, PM trigger, recipe, and cooking timer semantics.

