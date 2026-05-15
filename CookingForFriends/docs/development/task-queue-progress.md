# Task Queue Progress

> Experiment validity, data recording, and reproducibility improvements.
> Started: 2026-05-15.

---

## Task 1: Audit PM task flow (encoding → trigger → selection → logging)

**Status:** Complete (prior session)

Audited the full PM pipeline: encoding assignment, trigger scheduling, greeting dialogue, reminder display, item selection, confidence rating, auto-execute, backend logging. Found and fixed:

- `setPhoneLocked` bug: parameter was ignored, always set `phoneLocked: false` — fixed
- Phone notification suppression: only suppressed during `confidence_rating`, now also covers `greeting`, `reminder`, `item_selection`
- `correct_position_shown` not persisted to DB — added column + migration + store in handler
- PM CSV `position_in_order` missing — added
- Phone CSV header mismatch (`contact_id` → `sender`) — fixed

**Files modified:** `phoneSlice.ts`, `useWebSocket.ts`, `game_handler.py`, `database.py`, `admin.py`, `logging.py`

---

## Task 2: Check all randomization logging

**Status:** Complete (prior session)

Verified:
- Participant condition and task order: stored at registration
- PM item option order: shuffled client-side, sent to backend as `item_options_order` JSON array
- Chat answer position: randomized in `ChoiceButtons.tsx`, sent as `correct_position_shown` (0 or 1)
- Cooking step options: server-determined fixed order, no randomization (no logging needed)

---

## Task 3: Check EE0/EE1 reminder wording

**Status:** Complete

**Finding:** T3 EE1 reminder incorrectly said "Remember what Benjamin asked..." but the encoding episode character is Tom (not Benjamin). EE0 was fine ("You promised to do something for Benjamin.").

**Fix:** Changed T3 EE1 to "Remember what Tom asked after you went camping together recently."

**Verification:** Confirmed no target items appear in any reminder text. The only systematic difference between EE0 and EE1 is episodic anchors.

**Files modified:** `backend/data/experiment_materials/pm_tasks.json`

**Commit:** `c9929c1`

---

## Task 4: Check fake triggers

**Status:** Complete (no changes needed)

**Verification:**
- Backend (`pm_session.py`): fake triggers send `is_fake: True` with `fake_resolution_lines`, but no `task_id`, `condition`, `reminder_text`, or `item_options`. Logged to `FakeTriggerEvent` table (separate from `PMTaskEvent`).
- Frontend (`PMTriggerModal.tsx`): after greeting, `isFake` branches to `direct_request` step (no reminder, no item selection, no confidence rating). On timeout, fake triggers close directly.
- Backend handlers: all PM-specific handlers (`pm_reminder_shown/ack`, `pm_item_options_shown`, `pm_decoy_selected`, `pm_confidence_rated`, `pm_action_complete`) guard with `if not task_id: return`, so fake triggers are excluded even if accidentally invoked.
- CSV export: real and fake triggers are clearly distinguished by `is_fake` column; fake rows have empty PM-specific fields.

---

## Task 5: Cooking task UI — multiple simultaneous steps

**Status:** Complete

**Problem:** When multiple active cooking steps existed at the same station (e.g., two dishes both needing the cutting board), the station popup only showed the first step. The participant could not see or interact with other pending steps.

**Fix:** Modified `StationPopup` to accept an array of active steps with a selected index. When multiple steps share a station, compact switchable tabs appear at the top of the popup, showing dish emoji + step label for each. The participant can click tabs to switch between pending steps.

Also verified that `KitchenTimerBanner` already shows "N kitchen actions active" + compact queue badges when multiple steps are active (no change needed).

**Files modified:** `frontend/src/components/game/rooms/KitchenRoom.tsx`

**Commit:** `cc18c50`

**How to test:** Create a test session. In the runtime plan editor, schedule two active cooking steps for the same station at overlapping times. When both are active, click the station — tabs should appear showing both steps. Each tab should let the participant choose options independently.

**Remaining risks:** If the timeline plan never schedules two steps at the same station simultaneously, this code is defensive but untriggered. The step tab UI has not been visually tested in-browser (only type-checked).

---

## Security Review

**Status:** Complete

**Fixes applied:**
- Admin API key comparisons changed from `!=` to `hmac.compare_digest()` in `admin.py`, `timeline_editor.py`, and `main.py` (monitor WS). Prevents timing-based side-channel attacks.

**Commit:** `6b8fbad`

**Open issues (documented, not fixed):**
- No WebSocket message rate limiting (flood risk under load)
- In-memory token rate limiter (`_token_attempts`) doesn't expire entries for IPs that stop retrying
- `.env.development` and `.env.production` are tracked in git (production file has only placeholders, so no real secret leak)
- Admin monitor WS accepts API key in query param (unavoidable for browser WS, but key appears in access logs)

---

## Reconnection System Review

**Status:** Complete (no changes needed)

**Findings:**
- WS reconnect: exponential backoff (500ms → 15s) with monotonic `connIdRef` to prevent stale close handlers
- Backend: `BlockRuntime` kept alive 30s via `RUNTIME_RECONNECT_GRACE_S` for reconnect window
- Game clock state (`frozen_since`, `game_time_elapsed_s`) correctly preserved across reconnects
- PM pipeline step restored from `/session/{id}/state` endpoint; restored state lacks `reminderText`/`itemOptions` (falls back to frontend constants)
- PM session scheduler resumes from correct schedule entry via DB trigger count query

---

## Task 6: Timeline engine stability

**Status:** Complete (no changes needed)

**Verification:** All event scheduling is server-side via asyncio tasks sharing a single `GameClock`. Room switches, phone tab switches, and modal openings are purely frontend UI changes — they do not affect server-side event scheduling.

Key guarantees:
- PM overlay pauses `GameClock` via `BlockRuntime.pause("pm")`. Both timeline.py and cooking_engine.py use `sleep_until()` + `wait_until_running()`, so no events fire during PM overlays.
- Cooking step activation explicitly calls `await self._clock.wait_until_running()` before each entry, preventing mid-PM activation.
- WS messages are queued with maxsize=256. Critical events (`pm_trigger`, `block_end`, `phone_message`, `phone_contacts`, `ongoing_task_event`) use `wait_for(queue.put(), timeout=5.0)` to avoid silent drops.
- `KitchenTimerBanner` renders in `PhoneSidebar` (visible in all rooms), so timer visibility is not dependent on being in the kitchen.
- Reconnect correctly skips already-fired events via `resume_offset` comparison.

**Remaining risks:** If WebSocket queue fills to 256 (extreme lag), non-critical events (e.g., `time_tick`, `robot_speak`) are silently dropped. Critical events block up to 5s before dropping. This is acceptable for the experiment's expected load.

---

## Task 7: PM item selection — verify all fields recorded

**Status:** Complete (no changes needed)

**Verification trace:**

| Field | Frontend sends | Backend stores | DB column | CSV export |
|-------|---------------|---------------|-----------|------------|
| options order | `item_options_order: [ids]` | `decoy_options_order` | JSON | `json.dumps()` |
| selected item | `item_selected: id` | `decoy_selected_option` | String(20) | as-is |
| correctness | `item_correct: bool` | `decoy_correct` | Boolean | as-is |
| response time | `response_time_ms: int` | `decoy_response_time` (÷1000) | Float (seconds) | as-is |
| timestamp | `timestamp: float` | `pm_item_selected_timestamp` | Float | as-is |
| condition | from participant row | `condition` | String(10) | as-is |
| task_id | from PM trigger | `task_id` | String(4) | as-is |

Item options sent to frontend: 3 items (target + intra1 + intra2), shuffled client-side, order logged.

Response time measured from `ItemSelectionStep` mount (options visible) to click — correct.

---

## Task 8: Confidence rating — verify association and timing

**Status:** Complete (no changes needed)

**Verification:**
- Confidence step appears immediately after item selection (pipeline step transition: `item_selection` → `confidence_rating`)
- `ConfidenceStep` measures RT from mount (rating prompt visible) to click
- Backend finds the correct `PMTaskEvent` via `task_id + action_animation_complete_time IS NULL` — same row used for item selection
- Stored fields: `confidence_rating` (1-7 int), `confidence_response_time` (seconds), `pm_confidence_rated_timestamp` (wall time)
- After recording, backend sends `avatar_action` WS event to trigger auto-execute animation

---

## Task 9: Backend data model / API field consistency

**Status:** Complete

**Findings and fixes:**

1. **Cooking CSV missing fields:** `cooking_steps.csv` export was missing `station`, `chosen_option`, `correct_option` columns — all three exist in `CookingStepRecord` DB model and are written by `CookingEngine._record_step`. Added to CSV row construction and header.

2. **CookingDishScore not exported:** `CookingDishScore` table (per-dish aggregate: total_steps, steps_correct/wrong/missed, timing) was never included in ZIP export. Added `cooking_dish_scores.csv` with all fields.

3. **CutsceneEvent not exported:** `CutsceneEvent` table (encoding episode viewing: display/dismiss times, detail-check answers) was stored in DB but not included in ZIP. Added `cutscene_events.csv`.

4. **IntentionCheckEvent not exported:** `IntentionCheckEvent` table (post-encoding comprehension check: selected vs correct option, RT) was stored in DB but not included in ZIP. Added `intention_checks.csv`.

5. **Cooking status remapping removed:** CSV export was remapping `result` values (`correct→success`, `wrong→wrong_choice`, `missed→timeout`), creating an inconsistency between DB and exported data. Removed the remapping — CSV now exports the raw DB values (`correct`, `wrong`, `missed`).

6. **Event log enrichment:** `event_log.csv` cooking step_completed entries now include `station`, `chosen_option`, `correct_option` in their JSON payload.

**Verified (no changes needed):**
- PM pipeline WS fields: frontend sends match backend stores match CSV export (tasks 7-8 already verified)
- Phone message fields: `correct_position_shown`, `correct_answer`, `user_choice` all consistent
- Cooking engine `handle_action` → `_record_step` → `CookingStepRecord`: all fields consistent
- `pm_item_selected` / `pm_decoy_selected` dual WS type alias: both route to same handler, correct

**Files modified:** `backend/routers/admin.py`

---

## Task 10: Tests

**Status:** Complete

**New test files:**

1. `tests/test_pm_pipeline.py` (62 tests) — PM pipeline data integrity:
   - Trigger schedule: 6 total (4 real + 2 fake), positions 1-4 covered, delays present
   - Condition reminders: EE0/EE1 both exist, differ, and never contain target item/label
   - Item selection: exactly 3 options (target + intra1 + intra2), exactly 1 target
   - Fake trigger isolation: lines exist for both trigger types, no task_position on fakes
   - Task definitions: all 4 defined, valid trigger types, greeting lines present
   - Counterbalancing: 4 Latin-square orders, each position has each task, accessor functions

2. `tests/test_export_fields.py` (8 tests) — CSV export field consistency:
   - CookingStepRecord: all DB columns exported, no silent drops
   - CookingDishScore: all DB columns exported
   - CutsceneEvent: all DB columns exported
   - IntentionCheckEvent: all DB columns exported

**Total test count:** 120 (was 50, added 70)

**All tests pass:** `pytest tests/ -v` → 120 passed

---

## Task 11: Data dictionary

**Status:** Complete

Created `docs/development/data-dictionary.md` documenting all 13 exported data files:

- **pm_events.csv** — 31 columns: trigger metadata, item selection, confidence rating, full pipeline timestamps
- **cooking_steps.csv** — 13 columns: step outcome with station, chosen/correct options, game-time RT
- **cooking_dish_scores.csv** — 10 columns: per-dish aggregates
- **phone_messages.csv** — 14 columns: chat task with answer correctness and position randomization
- **cutscene_events.csv** — 9 columns: encoding episode viewing and detail checks
- **intention_checks.csv** — 7 columns: post-encoding comprehension verification
- **robot_idle_comments.csv** — 5 columns
- **phase_history.csv** — 5 columns
- **experiment_responses.csv** — 8 columns: all questionnaire/survey data
- **room_navigation.csv** — 5 columns
- **recipe_views.csv** — 5 columns
- **interaction_logs.csv** — 6 columns: raw interaction events
- **event_log.csv** — 6 columns: unified chronological timeline
- **mouse_tracking/*.json** — per-participant mouse/touch tracking

Each file documents column name, type, description, and thesis-relevant variable mappings.

Added to docs README index.

---

## Task 12: Deployment / experiment running checklist

**Status:** Complete

Created `docs/development/deployment-checklist.md` covering:

- **Pre-deployment:** environment config, materials review, frontend build, DB setup, smoke test
- **Running sessions:** per-participant prep, monitoring, post-session validation
- **Data export:** full export command, per-participant export, quick validation script (Python)
- **Troubleshooting:** common symptoms and fixes
- **Security notes:** timing-safe key comparison, WS limitations, CORS, token rate limiting

Added to docs README index.

---

## All Tasks Complete

Tasks 1–12 + security review + reconnection review: all done.
