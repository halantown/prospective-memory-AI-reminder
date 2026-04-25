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
