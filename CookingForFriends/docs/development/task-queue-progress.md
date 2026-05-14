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

## Remaining Tasks

- **Task 6:** Timeline engine — verify event scheduling doesn't lose events during room/tab/modal switches
- **Task 7:** PM item selection — verify all fields recorded correctly
- **Task 8:** Confidence rating — verify recorded immediately after each PM item selection
- **Task 9:** Backend data model / API field consistency
- **Task 10:** Tests
- **Task 11:** Data dictionary
- **Task 12:** Deployment / experiment running checklist
