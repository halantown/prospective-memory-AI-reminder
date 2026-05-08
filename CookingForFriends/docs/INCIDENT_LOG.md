# Incident & Bug Post-Mortem Log

Record of backend incidents, bugs, and their root-cause analyses.
Each entry follows the standard template below.

---

## Template

```
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
> Anything that made this more likely or harder to catch (missing constraint,
> no test, edge-case in reconnect logic, etc.)

### Fix
> What exactly was changed and why.
> Reference files / line numbers where relevant.

### Verification
> How was the fix confirmed to work?

### Follow-up Actions
> Preventive measures, monitoring improvements, tests to add, etc.
> Use [ ] checkboxes.
```

---

## INC-001 — `MultipleResultsFound` on phone_reply handler

| Field         | Detail                                                      |
| ------------- | ----------------------------------------------------------- |
| Date          | 2026-04-07                                                  |
| Severity      | P1 High                                                     |
| Status        | Resolved                                                    |
| Reported by   | Server error log + frontend `ECONNRESET` in Vite WS proxy |
| Affected area | `websocket/game_handler.py` → `_handle_phone_reply`    |

### Background

每当参与者在手机界面回答问题消息时，后端会查询 `phone_message_logs` 表获取消息的发送时间（`sent_at`），用于计算响应时间。正常情况下每条 `(participant_id, block_id, message_id)` 组合只有一行记录。

### Incident Description

参与者 `3b6da23e` 在 Block 1 回复消息时，后端抛出：

```
sqlalchemy.exc.MultipleResultsFound: Multiple rows were found when one or none was required
```

位置：`game_handler.py:529` — `sent_row.scalar_one_or_none()`。
同时前端日志出现：

```
22:08:49 [vite] ws proxy socket error: Error: read ECONNRESET
```

WS 连接断线后重连，触发了本次事故的根本原因。

### Timeline

| Time (local) | Event                                                                           |
| ------------ | ------------------------------------------------------------------------------- |
| 22:08:49     | 前端 WS 连接出现 `ECONNRESET`，触发重连                                       |
| 22:09:12     | 参与者回复消息，后端抛出 `MultipleResultsFound`，`phone_reply` handler 崩溃 |
| 22:09:12     | 错误写入 server log，参与者回复未被记录                                         |
| ~22:10       | 开始排查，定位到 `scalar_one_or_none()`                                       |
| ~22:15       | 确认根本原因：无唯一约束 + 重连后 timeline 重复发送消息                         |
| ~22:20       | 三层修复完成，数据库去重并加唯一约束                                            |

### Root Cause

`phone_message_logs` 表在 `(participant_id, block_id, message_id)` 上**没有唯一约束**，而 `_log_phone_message_sent` 每次调用都无条件 `INSERT`。

WS 断线重连后，timeline 引擎重新触发了部分 `phone_message` 事件，导致同一条消息被多次插入数据库。之后当参与者回复该消息时，查询返回多行，`scalar_one_or_none()` 直接抛出异常。

### Contributing Factors

- `PhoneMessageLog` 模型没有数据库层唯一约束
- `_log_phone_message_sent` 写入逻辑不幂等（无 upsert）
- WS 重连机制可能导致 timeline 部分事件重放
- 缺少对该场景的集成测试

### Fix

**1. 即时容错** — `backend/websocket/game_handler.py`
查询加 `.limit(1)`，即使存在重复行也只取第一条，避免崩溃：

```python
select(PhoneMessageLog.sent_at).where(...).limit(1)
```

**2. 写入幂等** — `backend/engine/timeline.py` `_log_phone_message_sent`
改用 PostgreSQL upsert，同一消息重发时更新 `sent_at` 而不是新插入：

```python
from sqlalchemy.dialects.postgresql import insert as pg_insert
stmt = (
    pg_insert(PhoneMessageLog)
    .values(...)
    .on_conflict_do_update(
        index_elements=["participant_id", "block_id", "message_id"],
        set_={"sent_at": sent_at},
    )
)
```

**3. 数据库强约束** — `backend/models/logging.py`

```python
UniqueConstraint('participant_id', 'block_id', 'message_id',
                 name='uq_phonemsg_participant_block_message')
```

**4. 现有数据修复**直接对运行中数据库执行：

- 删除重复行（保留最小 `id` 即最早一条）：`DELETE 25 rows`
- `ALTER TABLE phone_message_logs ADD CONSTRAINT uq_phonemsg_participant_block_message UNIQUE (...)`

### Verification

- 数据库唯一约束添加成功（asyncpg 无报错）
- 后续重复行插入会触发 `ON CONFLICT DO UPDATE` 而非新建行
- 即使数据库出现遗留重复，`.limit(1)` 保证 handler 不崩溃

### Follow-up Actions

- [ ] 调查 WS 重连时 timeline 是否真的重放事件，若是则修复重放逻辑
- [ ] 对所有使用 `scalar_one_or_none()` 的查询做审计，确认业务上保证唯一的字段都有数据库约束
- [ ] 添加集成测试：模拟重连场景，验证消息不重复插入

---

## INC-004 — Phone receives zero messages after JSON restructure

| Field        | Detail |
|--------------|--------|
| Date         | 2026-04-09 |
| Severity     | P1 High |
| Status       | Resolved |
| Reported by  | Manual testing |
| Affected area| `timeline_generator.py` → phone message scheduling |

### Background
> The phone message system was refactored (Phase 3) to split the flat `messages` array in `messages_day1.json` into separate `chats[]` and `notifications[]` arrays. The static timeline template (`block_default.json`), the message loader (`message_loader.py`), and all frontend components were updated — but the **dynamic timeline generator** (`timeline_generator.py`) was missed.

### Incident Description
> After the Phase 3 refactor, no phone messages appeared in the frontend at all. The game ran normally otherwise (steaks, robot speech, PM triggers all worked).

### Timeline
| Time (local) | Event |
|--------------|-------|
| 22:36 | No messages received in frontend reported |
| 22:38 | Investigation started |
| 22:42 | Root cause identified: `timeline_generator.py` line 198 reads `msg_data.get("messages", [])` — empty because the key was removed |
| 22:44 | Fix deployed: read from `chats[]` + `notifications[]`, update duration to 900s |
| 22:45 | Confirmed resolved via smoke test |

### Root Cause
> `timeline_generator.py` was not updated during the Phase 3 JSON restructure. It still read from `msg_data.get("messages", [])` which returned an empty list because the new JSON no longer has a top-level `messages` key. Since the generated timeline had zero `phone_message` events, no messages were ever sent to the frontend.
>
> Additionally, the generator still injected `pm_trigger_{task_id}` phone messages for communication triggers (removed in the redesign) and capped message times at 600s (old block duration instead of 900s).

### Contributing Factors
> - `timeline_generator.py` was not listed in the Phase 3 migration checklist
> - The static `block_default.json` fallback WAS updated, masking the issue in that code path
> - The active code path used by experimental conditions (AF, AFCB, CONTROL) goes through `generate_block_timeline()`, not the static JSON
> - No integration test verifies that generated timelines contain phone_message events

### Fix
> `backend/engine/timeline_generator.py`:
> - Lines 198-206: Read from `chats[]` and `notifications[]` arrays instead of `messages[]`
> - Lines 146-151: Removed `pm_trigger_{task_id}` phone_message injection
> - Lines 218-219: Updated duration cap from 600 → 900
> - Lines 224, 235: Updated `block_end` time and `duration_seconds` from 600 → 900

### Verification
> - Python syntax check passed
> - `load_message_pool(1)` returns 18 messages (12 chats + 6 notifications)
> - Smoke test confirms pool loads correctly with channel tags

### Follow-up Actions
> - [ ] Add a unit test that `generate_block_timeline(1, "AF", ...)` produces ≥1 phone_message event
> - [ ] Ensure any future data format changes have a grep audit for all files referencing the old format

---

## INC-005 — Friend reply bubble lost after phone lock/unlock

| Field        | Detail |
|--------------|--------|
| Date         | 2026-04-09 |
| Severity     | P2 Medium |
| Status       | Resolved |
| Reported by  | Manual testing — reply bubble disappeared after unlocking the phone |
| Affected area| `ChatView.tsx` → friend feedback bubble rendering |

### Background
> After a participant answers a question in chat, the friend's reply bubble appears with a 2.5-second delay. This feedback is an important part of the conversational flow and must persist across phone state changes.

### Incident Description
> After unlocking the phone (or switching contacts and returning), previously visible friend reply bubbles were gone. The participant's own answer bubble remained, but the friend's follow-up response had vanished.

### Timeline
| Time (local) | Event |
|--------------|-------|
| 23:01 | Bug reported during UI testing |
| 23:02 | Root cause identified: `feedbackVisible` stored in local `useState` |
| 23:03 | Fix deployed: moved to Zustand store field `feedbackVisible` on message |
| 23:04 | Confirmed resolved |

### Root Cause
> `ChatView.tsx` tracked which messages had their feedback bubble visible using a local `useState<Set<string>>`. When the phone locked, `LockScreen` replaced `ChatView` in the render tree, unmounting the component and discarding its local state. On unlock, `ChatView` remounted with an empty set — all feedback visibility was gone.

### Contributing Factors
> - Component-local state used for data that semantically belongs to the message itself
> - Locking/unlocking causes unmount/remount of `ChatView` (expected behavior), making any local state non-persistent
> - No test coverage for the lock → answer → lock → unlock → check feedback flow

### Fix
> **`frontend/src/types/index.ts`**: Added `feedbackVisible?: boolean` field to `PhoneMessage`.
>
> **`frontend/src/stores/gameStore.ts`**: Added `showMessageFeedback(messageId)` action that sets `feedbackVisible: true` on the target message (persisted in store across remounts).
>
> **`frontend/src/components/game/phone/ChatView.tsx`**:
> - Removed `useState<Set<string>>` for `feedbackVisible`
> - `handleAnswer` now calls `showMessageFeedback(msg.id)` after the 2.5s delay instead of `setFeedbackVisible`
> - `MessageGroup` reads `msg.feedbackVisible` directly from the message prop

### Verification
> Answered a question, locked phone, unlocked — friend reply bubble still present.

### Follow-up Actions
> - [ ] Consider also persisting `flashResult` (correct/incorrect border flash) — currently it's also local state but is very short-lived (600ms) so loss is less noticeable
> - [ ] Review other `ChatView` local state for similar persistence issues

---

## INC-006 — Ollama model store split after directory migration

| Field        | Detail |
|--------------|--------|
| Date         | 2026-04-13 |
| Severity     | P2 Medium |
| Status       | Monitoring |
| Reported by  | Manual restart after migrating Ollama models to `/home/charmot/ollama_data/` |
| Affected area| Ollama model storage, `ollama.service`, local inference availability |

### Background
> Ollama had been migrated from the default per-user model path to `/home/charmot/ollama_data/` to keep model files outside the home directory. After migration, restarting Ollama should still expose the same models regardless of whether Ollama is started manually or by systemd.

### Incident Description
> After restart, Ollama no longer showed the expected models from the migrated directory. Investigation showed that the running server process and the systemd service were using different execution contexts and different model paths:
>
> - the active process on port `11434` was a manually started `ollama serve` running as user `charmot`
> - `systemd` was also trying to start `ollama.service` as user `ollama`, but it failed continuously because the port was already occupied
> - the manual process was still reading the old path `~/.ollama/models`
> - the migrated models were actually present in `/home/charmot/ollama_data/models`
>
> This made it appear as if the migrated models had disappeared, while in reality Ollama had fallen back to a different storage location.

### Timeline
| Time (local) | Event |
|--------------|-------|
| 02:06 | Manual `ollama serve` process started as user `charmot` and bound to `127.0.0.1:11434` |
| 02:08 | Restart issue reported: migrated models no longer visible after reboot/restart |
| 02:10 | Investigation started: `ollama.service` found in crash loop with `bind: address already in use` |
| 02:11 | Root cause identified: service user/path split between `charmot` and `ollama` contexts |
| 02:15 | User-level path fixed by replacing `~/.ollama/models` with a symlink to `/home/charmot/ollama_data/models` |
| 02:15 | Permanent systemd fix prepared via service override script targeting `OLLAMA_MODELS=/home/charmot/ollama_data/models` |

### Root Cause
> The migration was only partially completed. The actual model files were moved to `/home/charmot/ollama_data/models`, but the runtime configuration was not unified across all startup paths.
>
> `ollama.service` runs as the dedicated `ollama` system user, whose default home is `/usr/share/ollama`, while the manually started Ollama process ran as `charmot` and continued to use `~/.ollama/models`. Because the manual process occupied port `11434`, the systemd service never took over. As a result, Ollama started successfully in one context but read the wrong model directory.

### Contributing Factors
> - Migration relied on a per-user path change instead of an explicit service-level `OLLAMA_MODELS` override
> - The dedicated `ollama` service account does not naturally share the same home-directory assumptions as the interactive user
> - `/home/charmot` has restricted traversal permissions (`750`), so service access to migrated content is not guaranteed without ACLs or a different storage root
> - No post-migration verification checked both `ollama list` and `systemctl status ollama`

### Fix
> **Immediate consistency fix**:
> - Replaced `/home/charmot/.ollama/models` with a symlink to `/home/charmot/ollama_data/models`
> - Preserved the previous directory as `/home/charmot/.ollama/models.backup-20260413-021524`
>
> **Permanent service fix prepared**:
> - Added a script to create a systemd drop-in with:
>
> ```ini
> [Service]
> Environment="OLLAMA_MODELS=/home/charmot/ollama_data/models"
> ```
>
> - The script also applies ACLs so the `ollama` service user can traverse `/home/charmot` and read/write `/home/charmot/ollama_data/models`
> - The script stops the conflicting process on port `11434`, reloads systemd, and restarts `ollama.service`
>
> Reference script:
> `/home/charmot/.copilot/session-state/cc44b556-0088-47e5-96dd-e83e5e9fa252/files/ollama-systemd-fix.sh`

### Verification
> - After the symlink correction, `ollama list` showed the migrated models again:
>   `gemma3:4b`, `qwen3:latest`, `llama3.1:latest`
> - File-system inspection confirmed the migrated store remained intact under `/home/charmot/ollama_data/models`
> - systemd-level persistence fix was prepared but still depends on executing the root-owned service update script

### Follow-up Actions
> - [ ] Execute the prepared root script to install the systemd drop-in and ACLs permanently
> - [ ] After deployment, verify `systemctl status ollama` shows a healthy service owned by user `ollama`
> - [ ] Confirm that a full reboot still preserves model visibility via `ollama list`
> - [ ] Consider relocating the shared model store to a service-neutral path such as `/var/lib/ollama/models` to avoid home-directory ACL coupling

---

## INC-007 — Cooking task UI shows no signals (field name contract mismatch)

| Field        | Detail |
|--------------|--------|
| Date         | 2026-04-22 |
| Severity     | P1 High |
| Status       | Resolved |
| Reported by  | Manual testing — kitchen stations never glowed, popups showed blank |
| Affected area| `backend/engine/cooking_engine.py`, `frontend/src/stores/gameStore.ts` |

### Background
> The multi-dish cooking task uses a backend CookingEngine that fires `ongoing_task_event` messages to drive the frontend. The frontend gameStore handlers parse these events and populate `activeCookingSteps`, which KitchenRoom reads to show station glows and option popups.

### Incident Description
> The frontend appeared to receive no cooking signals at all. Kitchen stations did not glow, no popups appeared. The CookingEngine was confirmed running (engine started, timeline fired), and WebSocket routing was correct. The actual events were arriving at the frontend but producing empty/broken state.

### Timeline
| Time (local) | Event |
|--------------|-------|
| 21:02 | User reports frontend receives no cooking signals |
| 21:05 | Full end-to-end audit launched |
| 21:10 | Audit confirms engine running, WS routing correct |
| 21:12 | Field name mismatches identified between backend event payload and frontend handler |
| 21:14 | Fixes applied to both files, TS compiles clean |
| 21:14 | Committed as `fix(cooking): fix field name mismatches between backend events and frontend handlers` |

### Root Cause
> The `step_activate` and `wait_start` event payloads sent by `CookingEngine` used different field names than what the frontend `handleCookingStepActivate` and `handleCookingWaitStart` handlers expected. The mismatch was introduced when the two sides were developed independently without a shared contract definition.
>
> Specific mismatches:
>
> | Field | Backend sent | Frontend read | Effect |
> |-------|-------------|---------------|--------|
> | Step title | `label` | `step_label` | `undefined` → popup title blank |
> | Step description | `description` | `step_description` | `undefined` |
> | Timer window | `window_s` | `window_seconds` | defaulted to 30 (accidentally correct) |
> | Activation time | not sent | `activated_at \|\| Date.now()` | used wall clock (close enough) |
> | Wait station | not sent | `station` | `undefined` → yellow oven glow never appeared |
> | Wait duration | `wait_duration_s` | `duration_s` | defaulted to 60 instead of actual value |

### Contributing Factors
> - Backend and frontend developed in the same session without a shared TypeScript type for the WS event shape
> - The `station` field on `step_activate` was correct (so stations DID receive active step info), making the bug non-obvious — stations glowed but popup content was blank, giving the impression of "no signals"
> - No integration test sends a synthetic `step_activate` and asserts the store fields

### Fix
> **`backend/engine/cooking_engine.py`** — `_activate_entry()`:
> - Added `"activated_at": activated_at` to `step_activate` event payload
> - Added `"station": step_def.station` to `wait_start` event payload
>
> **`frontend/src/stores/gameStore.ts`** — `handleCookingStepActivate()`:
> - `data.step_label` → `data.label`
> - `data.step_description` → `data.description`
> - `data.window_seconds` → `data.window_s`
> - `data.activated_at` converted from Unix seconds to ms: `data.activated_at ? data.activated_at * 1000 : Date.now()`
>
> **`frontend/src/stores/gameStore.ts`** — `handleCookingWaitStart()`:
> - `data.step_label` → `data.label`
> - `data.started_at` → `Date.now()` (not sent by backend; wall clock acceptable)
> - `data.duration_s` → `data.wait_duration_s`

### Verification
> - TypeScript compiles with no errors (`tsc --noEmit`)
> - Manual code review confirms all field names now match between engine payload and store handler
> - Cooking timeline validated: all 32 entries have valid dish IDs and step indices (`python3` check passed)

### Follow-up Actions
> - [ ] Define a shared `CookingEventPayload` TypeScript type or Pydantic model to enforce the contract at build time
> - [ ] Add a unit test in `test_cooking_engine.py` that asserts the exact keys present in each event type sent via mock send_fn

---

## INC-008 — PM attempt record silently dropped on race-condition rollback

| Field        | Detail |
|--------------|--------|
| Date         | 2026-04-23 |
| Severity     | P1 High |
| Status       | Resolved |
| Reported by  | Code review |
| Affected area| `backend/websocket/game_handler.py` — PM attempt handler |

### Background
> When a participant submits a PM attempt, the handler records a `PMAttemptRecord` and atomically updates the `PMTrial` row. If the trial was already scored (race with window expiry), the update is rejected by a rowcount check and the transaction is rolled back.

### Incident Description
> `db.add(attempt_record)` was called **before** the atomic `PMTrial` rowcount check. When the check failed (`rowcount == 0`) and `await db.rollback()` was issued, the `PMAttemptRecord` — which had only been added to the session, never committed — was silently discarded along with the rolled-back update. Any PM attempt that arrived in a race with window expiry produced no research record.

### Timeline
| Time (local) | Event |
|--------------|-------|
| 21:59 | Identified during automated code review |
| 22:08 | Root cause confirmed by code inspection |
| 22:08 | Fix applied and committed |

### Root Cause
> SQLAlchemy's `db.add()` stages a row in the current transaction. `db.rollback()` discards all staged changes, including the attempt record that was added before the update was attempted. Because race conditions are rare, the data loss went undetected.

### Contributing Factors
> - `db.add(attempt_record)` placed before the guard that could trigger rollback
> - Race conditions occur infrequently, so missing records are hard to notice without explicit monitoring

### Fix
> **`backend/websocket/game_handler.py`** — Moved `db.add(attempt_record)` to **after** the `rowcount == 0` early-return check. The attempt record is now only added to the session when the atomic update has confirmed success, ensuring rollbacks on race conditions leave no partial state.

### Verification
> Code inspection confirms `db.add(attempt_record)` now executes only on the success path (rowcount ≥ 1), immediately before `await db.commit()`.

### Follow-up Actions
> - [ ] Add monitoring/counter for `rowcount == 0` warnings to detect pathological race rates in production

---

## INC-009 — Admin endpoints unprotected when `ADMIN_API_KEY` unset in production

| Field        | Detail |
|--------------|--------|
| Date         | 2026-04-23 |
| Severity     | P2 Medium |
| Status       | Resolved |
| Reported by  | Code review |
| Affected area| `backend/routers/admin.py`, `backend/main.py` (`/ws/monitor`) |

### Background
> Admin endpoints (`/api/admin/*`) allow creating/deleting participants, exporting all experiment data, and resetting study state. They are protected by `X-Admin-Key` header verification when `ADMIN_API_KEY` is set. When `ADMIN_API_KEY` is unset, the guard short-circuits and skips all authentication — intended for local development.

### Incident Description
> No startup guard prevented deploying to production without setting `ADMIN_API_KEY`. Unlike `DEV_TOKEN` (which raises `RuntimeError` if set in production), the absence of `ADMIN_API_KEY` in production was silently tolerated, leaving all admin routes completely unauthenticated.

### Timeline
| Time (local) | Event |
|--------------|-------|
| 21:59 | Identified during automated code review |
| 22:08 | Fix applied to `config.py` |

### Root Cause
> `DEV_TOKEN` had an explicit production guard added (correctly), but the same pattern was never applied to `ADMIN_API_KEY`.

### Contributing Factors
> - Asymmetric treatment of development-only configuration values
> - No integration test exercises the auth guard under production-like settings

### Fix
> **`backend/config.py`** — Added startup guard:
> ```python
> if ENVIRONMENT == "production" and ADMIN_API_KEY is None:
>     raise RuntimeError("ADMIN_API_KEY must be set in production! ...")
> ```
> The server now refuses to start in production without an admin key set.

### Verification
> Code inspection confirms the guard follows the same pattern as the existing `DEV_TOKEN` check.

### Follow-up Actions
> - [ ] Add similar guards for any future credentials/secrets introduced to `config.py`

---

## INC-010 — CORS wildcard + credentials allowed in production without guard

| Field        | Detail |
|--------------|--------|
| Date         | 2026-04-23 |
| Severity     | P2 Medium |
| Status       | Resolved |
| Reported by  | Code review |
| Affected area| `backend/config.py`, `backend/main.py` — CORS middleware |

### Background
> The CORS middleware is configured with `allow_credentials=True`. The allowed origins default to `"*"` (wildcard) when `CORS_ORIGINS` is not set in the environment. Browsers enforce that `allow_credentials=True` is incompatible with a wildcard origin — they reject such responses. However, a wildcard config in production would still allow unauthenticated cross-origin requests from any domain.

### Incident Description
> `config.py` defaulted `CORS_ORIGINS` to `["*"]` with no production guard. Deploying without setting `CORS_ORIGINS` would leave the API reachable from any origin (non-credentialed requests) and silently break credentialed CORS requests (browsers reject `*` + credentials). No startup check prevented this misconfiguration.

### Timeline
| Time (local) | Event |
|--------------|-------|
| 21:59 | Identified during automated code review |
| 22:08 | Fix applied to `config.py` |

### Root Cause
> The comment in `config.py` said "restrict in production" but relied solely on the operator remembering to set the environment variable. No enforcement existed.

### Contributing Factors
> - Default of `"*"` is convenient for development but dangerous if carried to production
> - `allow_credentials=True` + `"*"` is non-functional in browsers, masking the issue during testing

### Fix
> **`backend/main.py`** — Changed `allow_credentials=True` → `allow_credentials=False`.
> Session tokens are passed in request bodies, not cookies, so credentials mode is not required.
> This resolves the wildcard incompatibility at its root: `allow_origins=["*"]` is now valid and
> the CORS guard in `config.py` is not needed.

### Verification
> `allow_credentials=False` + `allow_origins=["*"]` is a valid, browser-accepted CORS configuration.

### Follow-up Actions
> - [x] Remove `allow_credentials=True` — done

---

## INC-011 — PM module field-name mismatches between schema, handlers, and frontend

| Field        | Detail |
|--------------|--------|
| Date         | 2025-07-17 |
| Severity     | P1 High |
| Status       | Resolved |
| Reported by  | E2E test script (`/tmp/e2e_test.py`) during Phase 7 testing |
| Affected area| `routers/session.py`, `websocket/game_handler.py`, `models/schemas.py`, `routers/admin.py` |

### Background
> The PM task module (Phases 1–6) was implemented with backend schemas, WS handlers, and HTTP endpoints.
> The frontend sends specific JSON field names; the backend must match them exactly.
> E2E testing (Phase 7) revealed multiple field-name mismatches that prevented event logging.

### Incident Description
> Running the E2E test script returned HTTP 422 (Unprocessable Entity) or wrong data on:
> - `POST /api/session/{id}/phase` — handler read `req.action` but schema defined `event_type`
> - `GET /api/session/{token}/state` — response returned `current_phase`/`is_frozen` but schema defined `phase`/`frozen`
> - `POST /api/session/{id}/cutscene-event` — handler used `req.segment_number`, `req.display_time` but frontend sends `segment_index` (0-based), `viewed_at`, `duration_ms`
> - `POST /api/session/{id}/intention-check` — handler used `req.check_type`, `req.responses` but frontend sends `selected_index`, `correct_index`, `task_position`, `is_correct`
> - WS `pm_greeting_complete` — handler read `data.get("timestamp")` but frontend sends `game_time`
> - WS `pm_decoy_selected` — handler read `options_order`/`correct` but frontend sends `decoy_options_order`/`decoy_correct`
> - WS `pm_confidence_rated` — handler read `rating`/`response_time_s` but frontend sends `confidence_rating`/`response_time_ms`
> - WS `pm_action_complete` — handler read `start_time`/`timestamp` but frontend sends `action_animation_start_time`/`action_animation_complete_time`
> - `GET /api/admin/tasks` — returned `{"tasks": {...}}` dict wrapper; test expected a flat list
> - `GET /api/admin/export/per-participant` — used wrong model field names (`trigger_fired_at`, `task_order` which don't exist on `PMTaskEvent`); missing `token` column; missing JOIN with `Participant`
> - `GET /api/admin/export/aggregated` — missing `token` column
> - `POST /api/admin/participant/create` and `test-session` — response missing `is_test` field
> - Test script issues: checked `url` instead of `entry_url`; checked `isinstance(ac, dict)` instead of `list`; used `ac.values()` on a list; sent `event` instead of `event_type` in phase transitions

### Timeline
| Time (local) | Event |
|--------------|-------|
| ~14:00 | Phase 7 E2E test script first run; 7 checks failing |
| ~14:10 | Root cause identified: field names diverged between schema/handler/frontend during parallel implementation |
| ~14:20 | `session.py` handlers and `schemas.py` fixed (phase, cutscene-event, intention-check, state endpoint) |
| ~14:25 | `game_handler.py` fixed (all 6 WS PM pipeline handlers) |
| ~14:30 | Server restarted; test re-run: 5 backend issues + 4 test script issues remaining |
| ~14:45 | `admin.py` fixed (tasks list, export field names, export JOIN, is_test response field) |
| ~14:50 | `schemas.py` `ParticipantCreateResponse` updated to include `is_test` |
| ~14:55 | Test script fixed (entry_url, event_type, list checks, relative count comparison) |
| ~15:00 | 44/44 E2E checks passing |

### Root Cause
> The backend and frontend were implemented in parallel by separate agents during Phases 2–5.
> Without a shared type-contract document checked by both, field names drifted:
> - Backend handlers used snake_case names from the DB model (`segment_number`, `display_time`)
>   while the frontend used more explicit names (`segment_index`, `viewed_at`, `duration_ms`)
> - WS message field names were chosen independently in the frontend (prefixed: `decoy_options_order`,
>   `confidence_rating`) vs the backend handler (bare: `options_order`, `rating`)
> - Response schemas were not kept in sync with the handler's `return` statements

### Contributing Factors
> - Parallel implementation without a shared API contract document
> - No static type-checking across the WS boundary (WS uses `data.get("key")` — no schema validation)
> - Schema defined `TestSessionResponse` but handler returned `ParticipantCreateResponse` (shape mismatch)
> - Test script was written before backend was finalized, then not updated to match final field names

### Fix
> **`backend/models/schemas.py`**:
> - `CutsceneEventRequest`: added `segment_index`, `viewed_at`, `duration_ms` (replaced old fields)
> - `IntentionCheckRequest`: added `selected_index`, `correct_index`, `task_position`, `is_correct`
> - `SessionStateResponse`: renamed `current_phase`→`phase`, `is_frozen`→`frozen`
> - `ParticipantCreateResponse`: added `is_test: bool = False`
>
> **`backend/routers/session.py`**:
> - `update_phase`: changed `req.action` → `req.event_type`
> - `log_cutscene_event`: rewrote mapping from new schema fields to model fields
> - `log_intention_check`: rewrote mapping from new schema fields to model fields
> - `get_session_state`: changed response keys to match schema (`phase`, `frozen`)
>
> **`backend/websocket/game_handler.py`**:
> - All 6 PM pipeline handlers updated to use correct frontend field names
>
> **`backend/routers/admin.py`**:
> - `list_pm_tasks`: returns flat list instead of `{"tasks": {...}}` dict wrapper
> - `export_per_participant`: fixed field names (used correct model attributes), added JOIN with Participant for token, added token/task_order columns to CSV
> - `export_aggregated`: added `token` column
> - `create_participant`/`create_test_session`: return `is_test` in response
>
> **`/tmp/e2e_test.py`**:
> - Fixed `url` → `entry_url`, `event` → `event_type`
> - Fixed `isinstance(ac, dict)` → `isinstance(ac, list)`
> - Removed `.values()` call on list; used relative count comparison

### Verification
> E2E test script passes 44/44 checks after all fixes applied.

### Follow-up Actions
> - [ ] Document the WS message field names in `docs/ARCHITECTURE.md` API contract section
> - [ ] Consider adding a Pydantic model for WS inbound messages to catch field mismatches at parse time
> - [x] All field names aligned and E2E verified

---

## INC-012 — `phone_message_logs.correct_answer` INTEGER receives reply text string

| Field        | Detail |
|--------------|--------|
| Date         | 2026-05-02 |
| Severity     | P2 Medium |
| Status       | Resolved |
| Reported by  | Backend error log during live test with real token |
| Affected area| `engine/timeline.py` → `_log_phone_message_sent` / `models/logging.py` |

### Background
> Every chat/phone message sent to the participant is logged in `phone_message_logs` including the correct reply. Normal operation: messages send, participant answers, results logged.

### Incident Description
> `asyncpg.exceptions.DataError: invalid input for query argument $8: "You'll make it!" ('str' object cannot be interpreted as an integer)` — timeline engine tried to insert the correct-choice reply text into an `INTEGER` column.

### Root Cause
> `correct_choice` in `messages_day1.json` is the **text** of the correct reply (e.g. `"You'll make it!"`), not a numeric index. The `PhoneMessageLog.correct_answer` column was typed `Integer`. Same issue existed for `user_choice` (text of the selected reply was already being stored by the WS handler).

### Fix
> `models/logging.py`: changed `correct_answer` and `user_choice` from `Integer` to `Text`.
> `ALTER TABLE phone_message_logs ALTER COLUMN correct_answer TYPE TEXT USING correct_answer::TEXT, ALTER COLUMN user_choice TYPE TEXT USING user_choice::TEXT` applied to dev DB.

### Verification
> `information_schema.columns` confirms both columns are `text`. Timeline engine no longer errors on phone message logging.

### Follow-up Actions
> - [ ] Apply same ALTER TABLE in production migration when ready to deploy

---

## INC-013 — Wait steps visually indistinguishable from actionable steps in Recipe tab

| Field        | Detail |
|--------------|--------|
| Date         | 2026-05-02 |
| Severity     | P3 Low |
| Status       | Resolved |
| Reported by  | Observed during frontend testing (screenshot) |
| Affected area| `frontend/src/components/game/phone/RecipeTab.tsx` — `DishRecipeCard` / `StepRow` |

### Background
> The Recipe tab shows each dish's step list with the current active step highlighted. Two types of "live" steps exist: **active steps** (require user interaction at a kitchen station) and **wait steps** (automatic background processes, e.g. oven cooking). Both were fed into `hasLiveStep = Boolean(activeStep || waitStep)`.

### Incident Description
> "Oven cooking" appeared highlighted in orange with a ▶ icon — identical to an actionable step — even though no user action was required (oven cooking is fully automatic). This confused the UI state: nothing was clickable in the kitchen, but the recipe card implied an action was pending.

### Root Cause
> `DishRecipeCard` computed `hasLiveStep = Boolean(activeStep || waitStep)` and passed `isCurrent={hasLiveStep}` to `StepRow`. `StepRow` applied the same orange `bg-cooking-900/40 border-cooking-400/40` style and `▶` icon regardless of whether the step was user-driven or automatic.

### Contributing Factors
> Wait steps and active steps were added at different times; both reused the same `isCurrent` styling path without a flag to distinguish them.

### Fix
> `RecipeTab.tsx`:
> - Added `isWaiting = !activeStep && Boolean(waitStep)` flag in `DishRecipeCard`.
> - Passed `isWaiting` prop to the current-step `StepRow`.
> - `StepRow` now applies **indigo** background (`bg-indigo-900/40 border-indigo-400/40`) and **⏳** icon for wait steps, vs orange + ▶ for active steps.

### Verification
> TypeScript build clean (`npm run build`). Wait steps now display teal/indigo with ⏳; active steps retain orange with ▶.

### Follow-up Actions
> - [ ] Consider adding the same distinction to the LockScreen kitchen section (currently only shows active steps, not wait steps)

---

## INC-014 — Game clock advances past 18:00 (shows 18:02–18:30)

| Field        | Detail |
|--------------|--------|
| Date         | 2026-05-02 |
| Severity     | P2 Medium |
| Status       | Resolved |
| Reported by  | Developer during frontend review |
| Affected area| `backend/engine/timeline.py` — `time_tick` emission; `frontend/src/components/game/GameClock.tsx` |

### Background

The game simulates a one-hour cooking session from 17:00 to 18:00.
The formula is: **10 real seconds = 1 game minute**, so 600 real seconds = 60 game minutes.
The frontend displays the game clock to the participant as an ambient indicator of time pressure.
Expected behaviour: clock starts at 17:00 on block_start, ticks up, and stops at 18:00.

### Incident Description

The game clock was observed showing **18:02, 18:04, ... up to ~18:30** during sessions.
It did not stop at 18:00. This breaks the illusion of the one-hour game window and could
influence participant stress perception in a study measuring time pressure.

### Root Cause

#### Part 1 — Unbounded tick_num formula

In two places in `timeline.py`, the game clock was computed as:

```python
tick_num    = int(elapsed) // 10       # elapsed seconds → game minutes
game_minutes = tick_num                 # ← no upper bound
game_hour   = 17 + game_minutes // 60
game_min    = game_minutes % 60
game_clock  = f"{game_hour}:{game_min:02d}"
```

At `elapsed = 620 s`, `tick_num = 62`, so `game_clock = "18:02"`.
At `elapsed = 900 s`, `tick_num = 90`, so `game_clock = "18:30"`.

No maximum was enforced.  The fix is `game_minutes = min(tick_num, 60)`.

#### Part 2 — `duration_seconds` mismatch (design issue, not a regression)

`block_default.json` declares **`duration_seconds: 900`** but the game clock
spans only 600 real seconds.  These two numbers serve *different* purposes
that were never explicitly separated:

| Field | Value | Meaning |
|-------|-------|---------|
| `duration_seconds` | 900 | How long the block runner keeps the session alive after the last event fires |
| intended clock span | 600 | 60 game minutes × 10 s/min = 17:00 → 18:00 |

The block needs to run for 900 s because steak-cooking `ongoing_task_event` entries
are scheduled at t = 750, 800, 850, 880 s — well past the 18:00 game-clock boundary.
These events still need to fire; the block runner must not exit at t = 600.

Because `block_end` is the last scheduled event in the events list (t = 900),
the tail-loop (`while remaining > 0`) never actually runs — `remaining ≈ 0`
when all events are done.  `duration_seconds = 900` is therefore also redundant
for this block, but it is **not wrong**.  The problem was purely the missing cap.

#### Part 3 — Two separate emission sites

`time_tick` is emitted from two independent code paths:

1. **Main event loop** (`lines ~232–249`): the `while t - elapsed > 1.0` busy-wait
   between consecutive scheduled events.  
2. **Tail loop** (`lines ~387–407`): the `while remaining > 0` loop after the
   last event in the list fires.

Both paths had the unbounded formula; both were patched.

### Timeline

| Time (local) | Event |
|--------------|-------|
| 23:00 | Clock-past-18:00 noticed during frontend review session |
| 23:05 | Traced to `tick_num` formula in `timeline.py` |
| 23:10 | Identified two emission sites; confirmed `duration_seconds=900` vs clock span=600 |
| 23:15 | Fix deployed: `min(tick_num, 60)` at both sites |
| 23:20 | Build + smoke-test confirmed clock stops at 18:00 |

### Fix

**`CookingForFriends/backend/engine/timeline.py`**, two locations (lines ~237, ~394):

```python
# Before
game_minutes = tick_num

# After
game_minutes = min(tick_num, 60)  # cap at 18:00 (60 game minutes)
```

No changes to data files.  The `duration_seconds: 900` in `block_default.json`
is intentional and correct for event coverage.

### Verification

- Frontend build passes (no type errors).
- Clock visually stops at 18:00 in browser; no 18:xx values observed after fix.
- `ongoing_task_event` entries at t > 600 still fire correctly (block does not
  terminate early).

### Follow-up Actions / Refactor Notes

The current design conflates two independent time spans inside a single field
(`duration_seconds`) and one implicit constant (`10 s / game minute`).  Before
any significant timeline refactor, consider:

- [ ] **Introduce `clock_end_seconds` (or `game_duration_minutes`) in the JSON schema**
  so the cap is data-driven rather than a magic `60` hardcoded in Python.
  ```json
  { "duration_seconds": 900, "clock_end_seconds": 600, ... }
  ```
  Python: `game_minutes = min(tick_num, timeline.get("clock_end_seconds", 600) // 10)`

- [ ] **Name the conversion constant** — add `GAME_SECONDS_PER_MINUTE = 10` at the top
  of `timeline.py` so the `// 10` divisor is self-documenting and easy to change.

- [ ] **Consider whether `duration_seconds` should be removed** when `block_end` is
  always present as the last event.  Currently it only controls the (unused) tail loop.
  If every block guarantees a `block_end` event, `duration_seconds` is dead code.

- [ ] Validate that `ongoing_task_event` handlers on the frontend are not affected
  by the clock display capping (they are independent — cook timers run from
  `activeCookingSteps` state, not from game_clock string).


---

## INC-015 — Four frontend UX bugs (Welcome flash, Consent iframe, Demographics, Encoding)

| Field        | Detail |
|--------------|--------|
| Date         | 2026-05-03 |
| Severity     | P2 Medium |
| Status       | Resolved |
| Reported by  | Developer observation during experiment prep |
| Affected area| WelcomePage, ConsentPage, DemographicsPage, CutsceneEncodingPage |

### Background
> The frontend experiment flow covers: Welcome → Consent → Demographics → Encoding → Game. Multiple UX issues were identified in these phases.

### Incident Description
> 1. **Welcome flash**: Fallback text "Welcome! You'll be preparing dinner…" briefly rendered before the WELCOME config loaded, then jumped to the actual cover story text.
> 2. **Consent nested iframe**: Informed Consent page showed recursive layers of itself instead of the PDF; the PDF could not be viewed.
> 3. **Demographics page**: Had 6 backend-driven fields; too wide; browser showed "Save identity card?" popup on submit.
> 4. **Encoding phase blank**: CutsceneEncodingPage showed a plain white card on a blank background instead of the game world.

### Timeline
| Time (local) | Event |
|--------------|-------|
| 22:51 | All four issues reported |
| 22:52 | Root cause investigation started |
| 23:00 | All root causes identified |
| 23:10 | All fixes deployed |
| 23:12 | TypeScript build passed, confirmed resolved |

### Root Cause
> 1. **Welcome flash**: `welcomeText` state started as `null`; the JSX used a `?? fallback` expression that rendered immediately before the async API call resolved.
> 2. **Consent iframe**: Vite dev-server proxy only forwarded `/api` and `/ws` to FastAPI. `/documents` was unproxied, so Vite served its own `index.html` for `/documents/Informed_Consent_no_HREC.pdf`. The React app in the iframe detected the active session in `sessionStorage` and re-rendered `ConsentPage`, causing infinite nesting.
> 3. **Demographics popup**: The form used `type="number"` inputs alongside personal-looking fields without `autocomplete="off"`, triggering Chrome's identity-card save heuristic. Additionally, 6 backend-driven fields exceeded UX requirements.
> 4. **Encoding phase blank**: `CutsceneEncodingPage` used standalone full-page components (white card on gradient background) with no game world behind them.

### Contributing Factors
> - Vite proxy config was not kept in sync with FastAPI static-file mounts.
> - Demographics page was purely data-driven (from backend questionnaire JSON) with no frontend field-type handling for `choice` / `select` inputs.
> - CutsceneEncodingPage was designed before the galgame layout decision.

### Fix
> 1. **`WelcomePage.tsx`**: Added `configLoaded` boolean state; text paragraph only renders after the config fetch settles (success or failure via `.finally()`).
> 2. **`vite.config.ts`**: Added `/documents` proxy entry pointing to `http://localhost:5000`.
> 3. **`DemographicsPage.tsx`**: Complete rewrite — hardcoded 3 fields (Age number, Gender select+other, English proficiency select). `max-w-sm` container. `<form autoComplete="off">` + non-standard `name` attributes to prevent browser identity-card detection.
> 4. **`CutsceneEncodingPage.tsx`**: Imports `FloorPlanView` and `PhoneSidebar`; all stage renders now use a `h-screen` game-layout background (pointer-events-none) with stage-specific overlays: cutscene → bottom galgame panel (dark glass), detail_check → existing `fixed inset-0` `DetailCheckModal`, intention_check → `absolute` overlay inside game area. **`IntentionCheckQuestion.tsx`**: Added optional `className` prop to override the outer wrapper.

### Verification
> `npm run build` (tsc + vite) passed with zero errors or warnings.

### Follow-up Actions
> - [ ] Keep Vite proxy in sync whenever FastAPI adds new static mounts.
> - [ ] Consider a proxy config helper or comment documenting all backend-served paths.
> - [ ] Add real cutscene video/image assets to replace the placeholder text in `CutscenePlayer` (the component is no longer used by `CutsceneEncodingPage` but still exists for reference).

---

## INC-016 — Admin Test Mode "Start Phase" selector had no effect

| Field        | Detail |
|--------------|--------|
| Date         | 2026-05-03 |
| Severity     | P2 Medium |
| Status       | Resolved |
| Reported by  | Developer — noticed in manual testing |
| Affected area| Admin dashboard → Test Mode tab; `/admin/test-session` endpoint |

### Background
> The admin Test Mode tab lets developers create throw-away test sessions with a specific condition, task order, and starting phase. The intent is to skip to any experiment phase directly from the admin UI without going through the full participant flow.

### Incident Description
> Selecting a non-default "Start Phase" in the admin Test Mode tab had no effect. Sessions always started at the WELCOME phase regardless of the dropdown value.

### Timeline
| Time (local) | Event |
|--------------|-------|
| 23:06 | Developer reported start phase selector not working |
| 23:10 | Root cause identified via code inspection |
| 23:20 | Backend + frontend fixed and build verified |

### Root Cause
> Three compounding bugs:
> 1. **Wrong request schema**: `POST /admin/test-session` used `AdminParticipantCreateRequest` (which has `condition` and `task_order` only) instead of the already-existing `TestSessionRequest` (which has `condition`, `order`, and `start_phase`). The `start_phase` field sent by the frontend was silently discarded by FastAPI's Pydantic parser.
> 2. **Wrong field name**: Frontend sent `order` but `AdminParticipantCreateRequest` expected `task_order`, so the order selection was also ignored.
> 3. **No phase advance**: Even if the request body had been parsed correctly, the endpoint never called `enter_phase()` — it only created the participant row and returned.

### Contributing Factors
> - `TestSessionRequest` schema existed in `models/schemas.py` but was never wired to the endpoint.
> - The `AdminParticipantCreateRequest` and `TestSessionRequest` schemas have overlapping but distinct field names (`task_order` vs `order`), making the mismatch non-obvious.

### Fix
> **Backend** (`routers/admin.py`):
> - Added `TestSessionRequest` to imports.
> - Changed `create_test_session` to accept `Optional[TestSessionRequest]` instead of `Optional[AdminParticipantCreateRequest]`.
> - Added a compatibility shim that maps `req.order → compat.task_order` for `_create_participant_row`.
> - After creating the participant, calls `await enter_phase(db, participant, req.start_phase)` when `start_phase` is not `welcome`/empty.
>
> **Frontend** (`pages/admin/DashboardPage.tsx`):
> - Replaced copy-token-and-open workflow with direct URL launch: `/?token=XXX`. WelcomePage already auto-starts when `?token=` is present in the URL, and since the backend pre-advanced the phase, the session lands directly on the target screen.
> - Removed now-unused `copied`/`setCopied` state.

### Verification
> `npm run build` (tsc + vite) passed with zero errors. Backend import check passed (`python -c "from routers.admin import router"`).

### Follow-up Actions
> - [ ] Add an integration test for `POST /admin/test-session` verifying that `current_phase` equals `start_phase` after creation.
> - [ ] Consider consolidating `AdminParticipantCreateRequest` and `TestSessionRequest` into a single schema.

---

## INC-017 — Test entry auto-start and encoding phase alias broke manual testing

| Field        | Detail |
|--------------|--------|
| Date         | 2026-05-04 |
| Severity     | P2 Medium |
| Status       | Resolved |
| Reported by  | Developer — manual admin test with token `VUSMC3` |
| Affected area| Admin dashboard Test Mode; frontend phase recovery; encoding/tutorial UI shell |

### Background
> Admin Test Mode should let the experimenter create a test token, open the participant page, open DevTools, and then manually enter the token. Encoding and tutorial phases should run in a morning home scene, separate from the formal evening main experiment runtime.

### Incident Description
> Clicking "Open Session" immediately opened `/?token=...`, causing WelcomePage to auto-start before DevTools could be opened. During story intro, advancing from "Before I start preparing..." could return to the login page because backend canonical phases such as `ENCODING_VIDEO_1` were stored in the frontend as render aliases such as `encoding_flow`. The next phase request then used a value the backend state machine does not own.

### Timeline
| Time (local) | Event |
|--------------|-------|
| 01:05 | Developer reported admin auto-start and story intro returning to login |
| 01:12 | `VUSMC3` inspected in PostgreSQL; backend phase was still `ENCODING_VIDEO_1` |
| 01:20 | Phase alias bug and admin entry behavior identified |
| 01:35 | Frontend fixes implemented and build verified |
| 01:45 | Training shell added for scripted morning room/time state |

### Root Cause
> 1. **Admin entry regression**: Test Mode reused the participant deep link with a `?token=` query parameter. WelcomePage intentionally auto-starts when a token query is present.
> 2. **Frontend phase aliasing**: `frontendPhaseForBackend()` returned render-phase aliases. Those aliases are useful for React routing, but invalid as backend phase identifiers.
> 3. **Training scene coupling**: Story, encoding, and tutorial screens each hand-coded partial game-shell state instead of deriving room/time/phone state from canonical phase.

### Contributing Factors
> - Render routing and backend phase ownership were represented by the same `Phase` store value.
> - Admin Test Mode optimized for skipping directly into a session, but the current debugging workflow needs manual token entry.
> - Encoding assets are still placeholders, so phase transition failures were easy to confuse with missing media.

### Fix
> **Frontend**:
> - `utils/phase.ts`: `frontendPhaseForBackend()` now preserves canonical backend phases; `renderPhaseFor()` remains the only place that maps canonical phases to React render pages.
> - `pages/admin/DashboardPage.tsx`: Test Mode now copies the token and opens `/` without `?token=`, preventing auto-start.
> - `components/game/FloorPlanView.tsx`: Added explicit initial room/actor props and disabled-navigation support for scripted scenes.
> - `components/game/ExperimentHomeShell.tsx`: Supports scripted room initialization.
> - `components/game/TrainingHomeShell.tsx`: Centralized story/encoding/tutorial scene config. Each canonical training phase maps to a room, morning clock time, and phone availability.
> - Story, encoding, and tutorial pages now render inside `TrainingHomeShell`.

### Verification
> `npm run build` passed. Manual database check confirmed token `VUSMC3` was not corrupted server-side and remained at `ENCODING_VIDEO_1`.

### Follow-up Actions
> - [ ] Add a frontend regression test for backend phase preservation.
> - [ ] Add an admin Test Mode integration test verifying the opened URL does not include `?token=`.
> - [ ] Replace encoding video placeholders with approved media assets when available.

---

## INC-018 — Cooking tutorial lacked kitchen navigation and bedroom camera framing was too low

| Field        | Detail |
|--------------|--------|
| Date         | 2026-05-08 |
| Severity     | P3 Low |
| Status       | Resolved |
| Reported by  | Developer — manual tutorial playthrough |
| Affected area| Frontend tutorial cooking scene; floor-plan room navigation and camera framing |

### Background
> `TUTORIAL_COOKING` starts the participant in the bedroom/bathroom area and highlights the kitchen as the next target. Participants should be able to navigate to the kitchen from the zoomed room view before using the recipe and station UI.

### Incident Description
> During the cooking tutorial, no navigation button appeared from the bedroom/bathroom view to the kitchen. The same bedroom/bathroom zoom framing also placed both rooms too low in the viewport, making the area feel cramped against the bottom edge. After restoring general room navigation, the Living Room button was also visible outside PM trigger context, which could let participants reach the door scene before the trigger pipeline was ready.

### Timeline
| Time (local) | Event |
|--------------|-------|
| 21:45 | Missing cooking tutorial navigation and low bedroom/bathroom camera reported |
| 21:50 | `TrainingHomeShell` and `FloorPlanView` inspected |
| 21:55 | Root cause identified in zoomed-mode navigation rendering and camera clamp |
| 21:59 | Frontend fix implemented and incident record added |
| 22:25 | Living Room button gating and shared door encounter waypoint rendering added |

### Root Cause
> `FloorPlanView` only rendered zoomed room navigation controls for the doorbell PM trigger path. Normal zoomed room navigation data existed in `ADJACENCY`, and `TUTORIAL_COOKING` correctly passed `highlightedRoom: 'kitchen'`, but there was no general zoomed-mode button renderer to expose it. Bedroom/bathroom framing also used the global no-border vertical clamp, preventing a small downward camera over-pan. Door encounter actors were split across systems: formal PM visitors used hard-coded map percentages while tutorial Sam used a separate page-level sprite overlay.

### Contributing Factors
> - Training scene setup correctly allowed navigation, so the missing UI was not obvious from `TrainingHomeShell`.
> - Doorbell-specific navigation masked that ordinary zoomed room navigation had no shared renderer.
> - The bedroom and bathroom are combined into one bottom-of-map room definition, making global no-border camera math too restrictive for that scene.
> - Tutorial trigger presentation duplicated formal PM trigger presentation instead of sharing map waypoints and camera focus logic.

### Fix
> **Frontend** (`components/game/FloorPlanView.tsx`):
> - Added general zoomed-mode room navigation buttons for non-doorbell states, using the existing `ADJACENCY` map.
> - Reused `highlightedRoom` so the cooking tutorial's kitchen target appears as the emphasized navigation button.
> - Added a guard for the case where a doorbell trigger fires while the participant is already in the living room: the avatar moves to the door waypoint and answers the trigger.
> - Positioned `Bedroom / Bathroom` navigation at the lower-left edge to avoid blocking the central room view.
> - Added a bedroom/bathroom-specific bottom-edge over-pan allowance so the camera frames the rooms higher and exposes a small bottom edge.
> - Added `door_visitor` and `door_avatar` waypoints and reused them for formal PM visitors and tutorial Sam.
> - Kept normal living room entry at `living_room_idle`; `door_avatar` is used only after a doorbell trigger is being answered.
> - Added scripted door encounter support to `TrainingHomeShell`/`ExperimentHomeShell` so tutorial trigger actor rendering shares the `FloorPlanView` system.
> - Increased door encounter camera zoom and centered it on the door avatar/visitor area with Pepper kept in frame.

### Verification
> `npm run build` passed (`tsc -b && vite build`).

### Follow-up Actions
> - [ ] Add visual/manual QA coverage for each tutorial phase's starting room and required navigation target.
> - [ ] Consider extracting shared room navigation controls from `FloorPlanView` once more training scenes rely on them.
