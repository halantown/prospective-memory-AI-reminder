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

## INC-011 — admin.py crashed at import time (broken `assign_condition` name)

| Field        | Detail |
|--------------|--------|
| Date         | 2025-07-15 |
| Severity     | P0 Critical |
| Status       | Resolved |
| Reported by  | Static analysis during Phase 2+3 implementation |
| Affected area| `routers/admin.py` — all admin endpoints |

### Background
> The admin router registers all participant management, monitoring, and export endpoints. It is imported by `main.py` at startup. A broken module-level import causes the entire FastAPI application to fail to start.

### Incident Description
> `routers/admin.py` line 19 imported `assign_condition` from `engine/condition_assigner.py`. That function was renamed `assign_condition_and_order` during Phase 1 refactoring to return both condition and task_order. The import was never updated, causing an `ImportError` at startup. All admin endpoints were unreachable.

### Timeline
| Time (local) | Event |
|--------------|-------|
| — | Phase 1 refactored `condition_assigner.py`, renamed function to `assign_condition_and_order` |
| — | `admin.py` line 19 left referencing old name `assign_condition` |
| 2025-07-15 | Discovered during Phase 2+3 pre-flight static analysis |
| 2025-07-15 | Fixed in Phase 2+3 implementation pass |

### Root Cause
> Function was renamed during a Phase 1 refactor but the sole call site in `admin.py` was not updated. No integration test covered admin router startup.

### Contributing Factors
> - No automated import test for routers
> - `admin.py` also imported removed helpers (`task_def_to_config`, `task_def_to_encoding_card`, `asdict`, `_UNREMINDED_CYCLE`) that were not caught sooner because the file crashed before reaching them

### Fix
> - `routers/admin.py` line 19: `assign_condition` → `assign_condition_and_order`
> - Removed stale imports: `task_def_to_config`, `task_def_to_encoding_card`, `dataclasses.asdict`, `random`
> - Rewrote `create_participant` to use `assign_condition_and_order` which returns `(condition, task_order)` tuple
> - Added `_create_participant_row` helper shared with new `/test-session` endpoint

### Verification
> `conda run -n thesis_server python -c "from routers.admin import router as admin_router; print('OK')"` passes without error.

### Follow-up Actions
> - [x] Added verification import test to Phase 2+3 completion checklist
> - [ ] Add `pytest` import smoke-test covering all routers to CI

---

## INC-012 — `phone_message_logs.correct_answer` type mismatch: string rejected as integer

| Field        | Detail |
|--------------|--------|
| Date         | 2026-05-02 |
| Severity     | P2 Medium |
| Status       | Open — production migration pending |
| Reported by  | Error surfaced during test session with old token |
| Affected area| `phone_message_logs` table / timeline engine phone message logging |

### Background
> The timeline engine logs each phone message to `phone_message_logs` with a `correct_answer` column intended to store the expected answer for quiz-type chat messages. Normal chat messages (non-quiz) were being logged with `correct_answer = "You'll make it!"` (a motivational string), which is valid data but the column was typed as `INTEGER` in the SQLAlchemy model and PostgreSQL schema.

### Incident Description
> During a test session, the timeline engine raised:
> ```
> (sqlalchemy.dialects.postgresql.asyncpg.Error) <class 'asyncpg.exceptions.DataError'>:
> invalid input for query argument $8: "You'll make it!" ('str' object cannot be interpreted as an integer)
> ```
> The INSERT into `phone_message_logs` failed, causing the message log to be silently dropped. The game continued but no log record was created for that message.

### Timeline
| Time (local) | Event |
|--------------|-------|
| 13:34 | Error first observed in backend logs during test session |
| 13:34 | Identified as type mismatch in `phone_message_logs.correct_answer` |

### Root Cause
> The `correct_answer` column was created as `INTEGER` when the schema was first designed (expecting quiz answer indices). Non-quiz phone messages pass a plain string (the message body or a motivational phrase) as `correct_answer`, causing a type rejection at the asyncpg layer.

### Contributing Factors
> - No constraint or validation at the application layer before the DB call
> - Column type assumed all phone messages would be quiz-type (integer answer index)
> - Old token used for testing may have had stale routing assumptions

### Fix
> **Pending**: Alter `phone_message_logs.correct_answer` column type from `INTEGER` to `TEXT` in both the SQLAlchemy model and a production migration script. Local dev database can be fixed with:
> ```sql
> ALTER TABLE phone_message_logs ALTER COLUMN correct_answer TYPE TEXT USING correct_answer::TEXT;
> ```

### Verification
> Re-run timeline engine with a phone message containing a string `correct_answer` and confirm no DataError is raised.

### Follow-up Actions
> - [ ] Apply `ALTER TABLE` migration to local dev DB
> - [ ] Apply to production DB in a dedicated migration step after E2E test passes
> - [ ] Update SQLAlchemy model `PhoneMessageLog.correct_answer` column type to `String`
> - [ ] Add validation / type coercion before INSERT to prevent future type mismatches

---

## INC-013 — PM modal freeze: screen unresponsive after clicking "I know" on reminder

| Field        | Detail |
|--------------|--------|
| Date         | 2026-05-02 |
| Severity     | P1 High |
| Status       | Resolved |
| Reported by  | Manual testing of PM trigger pipeline |
| Affected area| `PMTriggerModal.tsx` / PM task pipeline UX |

### Background
> The PM trigger modal is the full-screen overlay that drives participants through the PM task pipeline: trigger affordance → greeting → robot reminder → decoy selection → confidence rating → avatar auto-action. While the modal is visible, the game applies `pointer-events-none` to all game divs to prevent background interaction. When the modal closes normally, `pmPipelineState` is set to `null`, removing the `pointer-events-none` and restoring full interactivity.

### Incident Description
> After clicking the doorbell trigger, progressing through greeting, and seeing the robot reminder, clicking "I know" (reminder acknowledgement) caused the screen to become completely unresponsive. No UI elements could be clicked. The modal disappeared but the game was still frozen.

### Timeline
| Time (local) | Event |
|--------------|-------|
| ~14:00 | Freeze first reported at affordance→greeting→reminder stage |
| 14:00 | Investigation: suspected z-index / overlay conflict |
| 14:05 | Ruled out: TriggerEffects, KitchenTimerModal, PMTargetItems, DetailCheckModal, useMouseTracker |
| 14:10 | Root cause found: `if (!content) return null` in PMTriggerModal causing modal DOM to vanish while `pmPipelineState` still non-null |
| 14:15 | Two additional bugs identified: `case 'completed': close()` during render + unstable `handleAvatarActionSent` ref |
| 14:20 | All three fixes applied; `npm run build` passes; backend restarted |

### Root Cause
> **Primary**: `renderStep()` returned `null` for the `decoy` step when `taskId` was null or `shuffledDecoys` was still empty (first render before the shuffle `useEffect` fired). The component's bottom-level guard `if (!content) return null` then unmounted the entire modal DOM. However, `pmPipelineState` in the Zustand store was still non-null — so `GamePage` continued to apply `pointer-events-none` to all game divs. The result: no modal + no game interaction = fully frozen screen.
>
> **Secondary**: `case 'completed': close(); return null` in `renderStep()` called `setPMPipelineState(null)` during React's render phase — a React 18 anti-pattern that can produce undefined behaviour or silent failures.
>
> **Tertiary**: `handleAvatarActionSent` was not wrapped in `useCallback`, causing a new function reference on every parent re-render. `AvatarActionStep`'s fallback 5-second timer used this as a `useCallback` dependency; every parent re-render recreated the callback, cleared the timer, and started a fresh 5s window — meaning the timer could never fire if re-renders occurred more frequently than every 5 seconds.

### Contributing Factors
> - `pointer-events-none` on game divs is CSS-inherited (affects all descendants including `fixed` children), so any modal DOM removal while the store flag is set is catastrophic
> - No visible error — the modal simply vanished without any console warning
> - The `decoy` step's `shuffledDecoys` populates asynchronously in a `useEffect`, creating a one-render window where the step has no content to render
> - React 18 silently tolerates (but mis-handles) `setState` calls during render in some cases, making the `case 'completed'` bug hard to spot

### Fix
> All changes in `frontend/src/components/game/PMTriggerModal.tsx`:
>
> 1. **Removed `if (!content) return null`**: modal wrapper now always renders when `pmPipelineState !== null`; content area shows a spinner `<div>` as fallback instead of unmounting.
> 2. **Replaced `case 'completed': close()` with a `useEffect`**: `useEffect(() => { if (step === 'completed') close(); }, [step, close])` — moves the state update out of render phase.
> 3. **Wrapped `handleAvatarActionSent` in `useCallback`**: added a `taskIdRef` (updated on every render) so the callback has a stable reference while still accessing the current `taskId`; dependency array is `[close]` only.
> 4. **`decoy` step spinner**: when `shuffledDecoys.length === 0` (first render), returns a centered spinner instead of `null`.
> 5. **Defensive z-index / pointer-events**: changed modal outer div from `z-50` to `z-[200]`; added explicit `style={{ pointerEvents: 'auto' }}` to ensure no parent CSS can block the modal.

### Verification
> `npm run build` passes (TypeScript + Vite, no errors). Backend restarted to serve new static files. User requested hard-refresh before re-testing.

### Follow-up Actions
> - [ ] Retest full PM pipeline in test mode: affordance → greeting → reminder → "I know" → decoy → confidence → avatar action → close
> - [ ] Verify game time unfreezes correctly after pipeline completes
> - [ ] Add unit test for `PMTriggerModal` covering the "content is null mid-pipeline" scenario

---

## INC-014 — Legacy timeline PM trigger overwrote real PM task state

| Field        | Detail |
|--------------|--------|
| Date         | 2026-05-02 |
| Severity     | P1 High |
| Status       | Resolved |
| Reported by  | Manual testing; debug strip showed `step=decoy | taskId=NULL! | decoys=0` |
| Affected area| `backend/engine/timeline.py`, `frontend/src/hooks/useWebSocket.ts`, PM trigger pipeline |

### Background
> EE1/EE0 sessions use the new event-driven PM scheduler in `engine/pm_session.py`. That scheduler sends `pm_trigger` WebSocket events with `task_id`, `trigger_type`, `position`, and fake/real metadata. The frontend uses `task_id` to load decoy options for the "What will you bring?" step.

### Incident Description
> During a PM trigger, the modal advanced through door/call affordance, greeting, and robot reminder, then reached the decoy step with no options. The debug strip showed `taskId=NULL!` and `decoys=0`. If the overlay DOM was removed via browser devtools, `pmPipelineState` remained non-null, so `GamePage` kept `pointer-events-none` on the game and phone areas and the UI stayed unclickable.

### Timeline
| Time (local) | Event |
|--------------|-------|
| 15:08 | Investigation started from user report |
| 15:08 | Found legacy `pm_trigger` entries in `backend/data/timelines/block_default.json` without `task_id` |
| 15:08 | Confirmed frontend accepted malformed real `pm_trigger` as `isFake=false`, `taskId=null` |
| 15:08 | Fix applied in backend timeline and frontend WebSocket guard |

### Root Cause
> The legacy block timeline still forwarded static JSON `pm_trigger` events for EE1/EE0 sessions. Those events predate the new PM module and only contain fields like `trigger_id` and `trigger_event`; they do not include the `task_id` required by `PMTriggerModal`. The frontend treated missing `is_fake` as `false`, so malformed legacy events were interpreted as real PM tasks and replaced the valid pipeline state with `taskId=null`.

### Contributing Factors
> - Two PM schedulers were active for the same session: legacy `engine/timeline.py` entries and new `engine/pm_session.py`
> - Frontend WebSocket handling did not validate that real `pm_trigger` events include `task_id`
> - The modal intentionally blocks background interaction while `pmPipelineState` is non-null, making malformed PM state user-blocking

### Fix
> `backend/engine/timeline.py`: EE1/EE0 sessions now skip legacy static `pm_trigger` events because `engine.pm_session` is authoritative for the new PM pipeline.
>
> `frontend/src/hooks/useWebSocket.ts`: malformed real `pm_trigger` events without `task_id` are ignored and logged with `console.warn`, preventing the modal from entering an empty decoy state.
>
> Follow-up fix: `backend/websocket/game_handler.py` now ensures the PM scheduler is running when a client reconnects to an already-`PLAYING` block. `backend/engine/pm_session.py` now resumes from persisted PM/fake trigger rows and computes the remaining wait from current game time, so disabling legacy timeline triggers does not leave existing playing sessions without PM triggers.
>
> Follow-up fix: `backend/engine/game_time.py` now has an explicit `start_game_time()` helper, and `backend/websocket/game_handler.py` calls it when the block enters or resumes `PLAYING`. Previously fresh sessions never set `last_unfreeze_at`, so `get_current_game_time()` stayed at `0` forever and the first 180-second PM wait never completed.

### Verification
> `cd CookingForFriends/frontend && npm run build` passes before and after the reconnect-resume fix.
>
> `cd CookingForFriends/backend && conda run -n thesis_server python -m py_compile engine/game_time.py engine/pm_session.py websocket/game_handler.py engine/timeline.py` passes.
>
> `cd CookingForFriends/backend && conda run -n thesis_server pytest tests -v` runs, but 3 existing `CookingEngine` tests fail because the tests submit `chosen_option_id="correct"` and the current cooking engine treats it as a wrong option. Those failures are unrelated to PM trigger WebSocket handling.

### Follow-up Actions
> - [ ] Remove or migrate legacy `pm_trigger` entries from static timeline JSON once no legacy experiment flow depends on them
> - [ ] Add a frontend regression test for malformed `pm_trigger` payloads
> - [ ] Add backend integration test proving EE1/EE0 timeline does not emit legacy PM triggers
> - [ ] Add backend integration test proving PM scheduler resumes when reconnecting to an already-`PLAYING` block

---

## INC-015 — PM pipeline froze DB game time but not backend gameplay timers

| Field        | Detail |
|--------------|--------|
| Date         | 2026-05-02 |
| Severity     | P1 High |
| Status       | Resolved |
| Reported by  | Code review after PM trigger debugging |
| Affected area| PM scheduler, block timeline, cooking engine |

### Background
> PM triggers are modal interruptions. While the participant is in the PM/fake-trigger pipeline, the main cooking task and block timeline should not advance, because the frontend intentionally blocks background interaction.

### Incident Description
> `engine.pm_session` froze only the DB-backed game-time accumulator. The block timeline still used wall-clock elapsed time for HUD ticks, phone messages, and block-end timing. `CookingEngine` had `pause()` / `resume()` methods, but PM trigger start never called `pause()`, and the existing implementation did not safely restore active cooking-step timeouts after a pause.

### Timeline
| Time (local) | Event |
|--------------|-------|
| 20:12 | Implementation started from review item 2 |
| 20:12 | Found timeline was wall-clock driven despite DB game-time freeze |
| 20:12 | Found cooking pause/resume did not preserve active timeout remaining time |
| 20:12 | Added PM pipeline gameplay pause/resume integration |
| 20:12 | Static compile verification passed |

### Root Cause
> PM pipeline state was split across three independent clocks: DB game time in `engine/game_time.py`, wall-clock scheduling in `engine/timeline.py`, and wall-clock cooking step timers in `engine/cooking_engine.py`. Freezing only DB game time stopped the PM scheduler from advancing but left non-PM backend tasks free to keep emitting events and timeouts while the participant could not interact with the game UI.

### Contributing Factors
> - `CookingEngine.pause()` existed but was not called when PM triggers fired
> - Timeline scheduling had no pause/resume control and computed elapsed directly from `time.time() - start_time`
> - The frontend modal correctly blocks background clicks, making backend timer drift invisible until cooking steps/time ticks/messages are inspected
> - No integration test asserts that PM overlays pause cooking and timeline progression

### Fix
> `backend/engine/pm_session.py`: added an `on_pipeline_start` callback that runs immediately after `freeze_game_time()` and before `pm_trigger` is sent.
>
> `backend/websocket/game_handler.py`: passes a PM pipeline callback that pauses the block timeline and active `CookingEngine`; PM completion and fake-trigger acknowledgement now resume both systems after `unfreeze_game_time()`.
>
> `backend/engine/timeline.py`: added per-timeline pause/resume control. Timeline elapsed seconds and sleeps now exclude explicit pause intervals, so HUD ticks, phone messages, and block-end timing stop during PM overlays.
>
> `backend/engine/cooking_engine.py`: made pause/resume idempotent and safe for active steps. Pausing now cancels the cooking timeline task, preserves remaining active-step timeout, and adjusts activation timestamps on resume so response time does not include the PM interruption.

### Verification
> `cd CookingForFriends/backend && conda run -n thesis_server python -m py_compile engine/cooking_engine.py engine/timeline.py engine/pm_session.py websocket/game_handler.py` passes.
>
> `cd CookingForFriends/frontend && npm run build` passes.
>
> `cd CookingForFriends/backend && conda run -n thesis_server pytest tests/test_cooking_engine.py -q` runs with the same 3 existing failures caused by stale test inputs using `chosen_option_id="correct"` instead of `option_{correct_index}`; 11 tests pass.

### Follow-up Actions
> - [ ] Add backend unit test for `CookingEngine.pause()` preserving active-step timeout remaining time
> - [ ] Add backend integration test proving PM pipeline pauses timeline `time_tick` and phone-message scheduling
> - [ ] Consider making DB game time the single source of truth for all backend gameplay timers after the flow is stable

---

## INC-016 — Cooking recipe UI diverged from backend active-step state

| Field        | Detail |
|--------------|--------|
| Date         | 2026-05-02 |
| Severity     | P1 High |
| Status       | Resolved — local guard applied; data-source unification pending |
| Reported by  | Manual test screenshot + WebSocket log |
| Affected area| CookingEngine actions, Recipe tab, Kitchen station popup |

### Background
> The cooking task is backend-driven: `CookingEngine` sends `step_activate`, `step_result`, `step_timeout`, and `wait_start` events. The frontend should render the current recipe state from those events and should submit one action for the currently active backend step.

### Incident Description
> During a test run, the phone timer showed `Sauté base!`, but the Recipe tab for Tomato Soup still showed `Select ingredients`. The WebSocket log also showed multiple `cooking_action` submissions for the same `tomato_soup step_index=2` with different options. This means the frontend recipe display, timer queue, active step popup, and backend active step were not reliably synchronized.

### Timeline
| Time (local) | Event |
|--------------|-------|
| 20:36 | User reported Recipe tab mismatch with screenshot and WS log |
| 20:42 | Investigation found frontend recipe hardcodes diverged from backend recipes |
| 20:42 | Found station popup could submit the same active step repeatedly |
| 20:42 | Added frontend pending guard and backend stale step validation |
| 20:42 | Build and compile verification completed |

### Root Cause
> The frontend kept a second hardcoded copy of cooking recipe steps in `frontend/src/stores/gameStore.ts`, separate from `backend/data/cooking_recipes.py`. The two copies had different step counts and missing wait steps. Recipe rendering also treated `dish.phase !== idle` as enough to mark a step as live, even when the active step had already been answered, missed, or removed. Finally, the station popup did not disable a step while its result was pending, and the backend ignored the client-provided `step_index`.

### Contributing Factors
> - No single source of truth for cooking recipe definitions
> - `kitchenTimerQueue`, `activeCookingSteps`, and `dishes.currentStepIndex` are separate frontend state paths
> - No backend stale-action guard for `step_index`
> - No frontend test covering wrong/missed cooking steps and recipe display

### Fix
> `frontend/src/stores/gameStore.ts`: aligned frontend recipe step arrays with backend `cooking_recipes.py`, including wait steps and current labels/descriptions.
>
> `frontend/src/components/game/phone/RecipeTab.tsx`: only highlights a recipe row as live when an active or wait step actually exists; wrong/missed/completed current steps no longer appear as active.
>
> `frontend/src/components/game/rooms/KitchenRoom.tsx`: added a per-step pending guard so one active cooking step can only submit one `cooking_action` while waiting for backend result.
>
> `backend/engine/cooking_engine.py` and `backend/websocket/game_handler.py`: backend now validates the client `step_index` against the active backend step and rejects stale cooking actions with a warning instead of scoring them against a different step.

### Verification
> `cd CookingForFriends/backend && conda run -n thesis_server python -m py_compile engine/cooking_engine.py websocket/game_handler.py` passes.
>
> `cd CookingForFriends/frontend && npm run build` passes.
>
> `cd CookingForFriends/backend && conda run -n thesis_server pytest tests/test_cooking_engine.py -q` still has the same 3 existing stale-test failures caused by `chosen_option_id="correct"` instead of `option_{correct_index}`; 11 tests pass.

### Follow-up Actions
> - [ ] Move cooking recipe definitions to a server-provided payload so frontend does not hardcode a copy
> - [ ] Add frontend stale/rejected cooking-action feedback
> - [ ] Add regression test for wrong/missed step display in Recipe tab
> - [ ] Fix stale `test_cooking_engine.py` assertions to use real option IDs

---

## INC-017 — Cooking timer and recipe state still diverged after timeout/wait

| Field        | Detail |
|--------------|--------|
| Date         | 2026-05-02 |
| Severity     | P1 High |
| Status       | Resolved — runtime state unified; event-chain scheduling pending |
| Reported by  | Manual test: timeout, Recipe tab, and lock-screen KITCHEN TIMER showed different state |
| Affected area| CookingEngine wait/result events, frontend cooking store, Recipe tab, phone lock screen |

### Background
> Cooking state should have one runtime source: backend `CookingEngine` emits active/wait/result events; frontend renders recipe progress and timer cues from those events. A timed-out step should disappear from timer displays and appear as `missed` in Recipe. Wait steps should end before the next same-dish active step.

### Incident Description
> After the previous local guard, the system could still show inconsistent cooking state. `kitchenTimerQueue` remained a separate frontend queue from `activeCookingSteps`, so timeout/warning behavior could persist on lock screen or station highlights after the active step was gone. Recipe definitions were still copied into frontend code. Backend wait steps emitted `wait_start` but did not reliably emit `wait_end`, and backend never emitted `dish_complete`, even though the frontend had a handler for it.

### Timeline
| Time (local) | Event |
|--------------|-------|
| 21:15 | Investigation started from user report that timeout/Recipe/KITCHEN TIMER remained out of sync |
| 21:15 | Confirmed `kitchenTimerQueue` was an independent frontend state source |
| 21:15 | Confirmed backend recipe definitions were still copied into frontend initialization |
| 21:15 | Confirmed backend emitted `wait_start` without corresponding wait cleanup and did not emit `dish_complete` |
| 21:15 | Refactor implemented and compile/test verification passed |

### Root Cause
> The cooking UI had three state paths: `activeCookingSteps`, `cookingWaitSteps` / `dishes.currentStepIndex`, and `kitchenTimerQueue`. Timeout and result events updated some but not all of those paths. Recipe definitions also still existed in frontend code, so frontend could diverge from backend recipe/timeline changes. Backend event semantics were incomplete because wait steps did not have a clear end event and dish completion was only an internal phase change.

### Contributing Factors
> - `kitchenTimerQueue` was not derived from backend active-step state
> - Recipe definitions were not delivered as a session/bootstrap payload
> - `wait_start` had no reliable frontend cleanup point if the next same-dish step arrived
> - `dish_complete` existed as a frontend case but had no backend sender
> - Cooking tests still used stale option IDs, masking current engine behavior in local verification

### Fix
> `backend/data/cooking_recipes.py`: added `serialize_cooking_definitions()` with recipe version, dish order, dish metadata, recipe-visible step definitions, and timeline entries. Correct answers remain backend-only.
>
> `backend/routers/session.py` and `backend/models/schemas.py`: session start now returns `cooking_definitions`; a dedicated `/api/session/{session_id}/cooking-definitions` endpoint restores definitions for refreshed sessions.
>
> `backend/engine/cooking_engine.py`: activating the next same-dish step now emits `wait_end` for the previous wait step. Completing all active steps now emits `dish_complete` once.
>
> It also marks an unanswered same-dish active step as `missed` before activating the next scheduled step. This prevents the timeout task and timeline activation race from overwriting the old active step without a result.
>
> `frontend/src/stores/gameStore.ts`: removed recipe content hardcode and initializes `dishes` from server definitions. Removed `kitchenTimerQueue`; timer displays are now derived from `activeCookingSteps`, while timeout/result writes only to `dish.stepResults`.
>
> `frontend/src/components/game/phone/RecipeTab.tsx`, `LockScreen.tsx`, `PhoneSidebar.tsx`, and `KitchenRoom.tsx`: UI now uses `activeCookingSteps`, `cookingWaitSteps`, and `dishes` as the shared runtime state. Legacy `kitchen_timer` WebSocket events are ignored to avoid reintroducing a second timer channel.
>
> `backend/tests/test_cooking_engine.py`: fixed stale option IDs and added regressions for `wait_start` → `wait_end` → `step_activate` and unanswered active-step supersession.

### Verification
> `cd CookingForFriends/backend && conda run -n thesis_server python -m py_compile data/cooking_recipes.py engine/cooking_engine.py routers/session.py models/schemas.py websocket/game_handler.py` passes.
>
> `cd CookingForFriends/frontend && npm run build` passes.
>
> `cd CookingForFriends/backend && conda run -n thesis_server pytest tests/test_cooking_engine.py -q` passes: 16 passed.

### Follow-up Actions
> - [ ] Add frontend store/unit tests for timeout/result/wait state rendering once frontend test tooling exists
> - [ ] Add backend integration test for full cooking event order across one dish
> - [ ] Refactor cooking scheduling so timeline controls only each dish's first step and later same-dish steps are activated by completion/timeout events

---

## INC-018 — Gameplay timeline still used its own clock after PM pause fixes

| Field        | Detail |
|--------------|--------|
| Date         | 2026-05-03 |
| Severity     | P1 High |
| Status       | Resolved — gameplay schedule now owned by BlockRuntime + GameClock |
| Reported by  | Codebase review of three independent time systems |
| Affected area| TimelineEngine, game clock display, PM pause semantics |

### Background
> Gameplay scheduling should use one pause-aware game-time source. During a PM overlay, timeline events, phone-message cooldowns, activity-trigger fallbacks, cooking timeouts, and block end should stop advancing until the overlay completes.

### Incident Description
> Earlier stopgap fixes paused `timeline.py`, `cooking_engine.py`, and DB-backed PM game time at their boundaries, but each subsystem still owned its own clock. `timeline.py` kept `TimelineControl.paused_at/total_paused_s`, generated the HUD clock inline, and scheduled `pm_watch_activity` fallback using wall-clock deadlines.

### Timeline
| Time (local) | Event |
|--------------|-------|
| 01:35 | Three-time-system review started from legacy investigation notes |
| 01:45 | Root cause confirmed in `timeline.py`, `game_time.py`, and `cooking_engine.py` |
| 01:55 | `GameClock` abstraction added and timeline migrated to it |
| 02:04 | Backend compile/tests passed |
| 02:18 | CookingEngine activation/timeout/response-time migrated to `GameClock` |
| 02:25 | Timeline and CookingEngine wired to a shared per-participant `GameClock` |
| 02:31 | PM scheduler trigger/session-end waits moved from DB polling to shared `GameClock` |
| 02:48 | `BlockRuntime` introduced; `game_handler.py` glue registries and pause/resume calls removed |

### Root Cause
> The PM pause fix was added after timeline and cooking scheduling already existed. Instead of one owner for gameplay time, the codebase had boundary synchronization: DB participant game time for PM triggers, `TimelineControl` for timeline events, and `CookingEngine` offsets for cooking. This made it easy for future gameplay scheduling to bypass PM pause semantics.

### Contributing Factors
> - No shared backend clock abstraction before PM trigger work
> - Timeline display clock mixed clock formatting with event scheduling
> - `duration_seconds` and display-clock end time were conflated until the 18:00 cap fix
> - No unit tests for pause-aware game-time sleep

### Fix
> `backend/engine/game_clock.py`: added `GameClock`, `GameClockSnapshot`, `format_game_clock()`, and display constants. `GameClock.sleep_for()` and `sleep_until()` use gameplay seconds and ignore paused wall-clock intervals.
>
> `backend/engine/timeline.py`: timeline elapsed, pause/resume, event waits, phone-message cooldown, activity fallback, and `time_tick` payload now go through `GameClock`. `time_tick` now includes `game_time_s`, `frozen`, and `clock_end_seconds`; old `elapsed` remains for frontend compatibility.
>
> `backend/data/timelines/block_default.json`, `backend/engine/timeline_generator.py`, and `backend/routers/timeline_editor.py`: added `clock_end_seconds=600` so display-clock span is explicit and separate from `duration_seconds=900`.
>
> `backend/tests/test_game_clock.py`: added unit tests for display formatting, pause/resume, snapshot, and `sleep_until()` excluding paused wall time.
>
> `backend/engine/cooking_engine.py`: cooking timeline waits, active-step timeout, and response-time calculation now use `GameClock`. WebSocket payloads include `activated_game_time`, `deadline_game_time`, and `started_game_time`; wall-time fields remain for compatibility.
>
> `backend/tests/test_cooking_engine.py`: added regressions proving PM pause prevents cooking timeout and cooking response time excludes paused wall time.
>
> `backend/engine/block_runtime.py`: added `BlockRuntime`, the single in-memory owner for one block's shared `GameClock`, timeline task, `CookingEngine`, and PM session task.
>
> `backend/websocket/game_handler.py`: replaced `_cooking_engines`, `_game_clocks`, and `_pm_session_tasks` with one `_block_runtimes` registry. `start_game`, reconnect, disconnect, and block-complete cleanup now go through `BlockRuntime.start()` / `stop()`. PM complete/fake ack resumes via `runtime.resume("pm")`; PM scheduler starts the overlay via `runtime.pause("pm")`.
>
> `backend/engine/pm_session.py`: accepts the shared `GameClock` and uses it for trigger delay and session-end delay waits. Participant DB game-time fields remain as heartbeat/admin snapshots instead of the scheduler wait owner.

### Verification
> `cd CookingForFriends/backend && conda run -n thesis_server python -m py_compile engine/game_clock.py engine/timeline.py engine/timeline_generator.py routers/timeline_editor.py` passes.
>
> `cd CookingForFriends/backend && conda run -n thesis_server pytest tests -q` passes: 27 passed.
>
> `cd CookingForFriends && conda run -n thesis_server python -m py_compile backend/engine/block_runtime.py backend/websocket/game_handler.py` passes.

### Follow-up Actions
> - [x] Move `CookingEngine` activation, timeout, and response-time calculation onto `GameClock`
> - [x] Move PM scheduler off DB polling and onto `BlockRuntime` / `GameClock`
> - [x] Replace `game_handler.py` glue pause/resume calls with a single `BlockRuntime.pause()` / `resume()`
> - [ ] Add timeline integration test proving PM pause blocks `time_tick`, phone messages, and block end

---

## INC-019 — Non-atomic double commit in PM action complete / fake trigger ack

| Field        | Detail |
|--------------|--------|
| Date         | 2026-05-08 |
| Severity     | P2 Medium |
| Status       | Open |
| Reported by  | Code review |
| Affected area| `backend/websocket/game_handler.py` — `_handle_pm_action_complete`, `_handle_fake_trigger_ack` |

### Background
> When a PM action completes or a fake trigger is acknowledged, the handler must (1) update the event record and (2) unfreeze game time on the Participant row. Both writes happen within the same `async with db_factory() as db:` block (same session).

### Incident Description
> Each handler calls `await db.commit()` twice within a single session context: once after updating the event row and again after unfreezing game time. If the process crashes between the two commits, the event is recorded as complete but game time remains frozen — the participant's clock never resumes and the experiment stalls.

### Root Cause
> The two logical writes were committed separately instead of being batched into one atomic transaction. There is no technical reason to split them.

### Contributing Factors
> - No transactional test covering the commit boundary
> - The pattern likely arose from incremental development (event tracking added first, unfreeze added later)

### Fix
> Merge the two `db.commit()` calls into one in both `_handle_pm_action_complete` and `_handle_fake_trigger_ack`. Move the `unfreeze_game_time` call before the single remaining commit.

### Follow-up Actions
> - [ ] Add integration test asserting event update + game time unfreeze are atomic

---

## INC-020 — NoneType crash in admin condition assignment export

| Field        | Detail |
|--------------|--------|
| Date         | 2026-05-08 |
| Severity     | P2 Medium |
| Status       | Open |
| Reported by  | Code review |
| Affected area| `backend/routers/admin.py` — `get_condition_assignments` (~line 327) |

### Background
> The admin condition-assignment endpoint iterates PM trials to find the filler trial without a reminder, then reads `filler.task_config.get("task_id")` to report which task was unreminded.

### Incident Description
> `PMTrial.task_config` is a nullable JSON column. When it is `None`, calling `.get("task_id")` raises `AttributeError: 'NoneType' object has no attribute 'get'`, crashing the admin export endpoint.

### Root Cause
> Missing None guard on `filler.task_config` before calling `.get()`.

### Contributing Factors
> - `task_config` is not a `NOT NULL` column — older rows or edge cases may have `None`
> - No test exercises this path with `task_config=None`

### Fix
> Change `filler.task_config.get("task_id")` to `(filler.task_config or {}).get("task_id")`.

### Follow-up Actions
> - [ ] Add test for condition assignment endpoint with a filler trial where `task_config` is None

---

## INC-021 — GameClock timing gap at PM trigger fire

| Field        | Detail |
|--------------|--------|
| Date         | 2026-05-08 |
| Severity     | P2 Medium |
| Status       | Open |
| Reported by  | Code review |
| Affected area| `backend/engine/pm_session.py` — trigger fire sequence (~lines 180-205) |

### Background
> When a PM trigger fires, the system must record the exact game time at which the trigger appeared and then pause the GameClock. The recorded `game_time_fired` is the dependent variable in the psychology experiment — accuracy to the millisecond matters.

### Incident Description
> The current sequence is: (A) `game_time_fired = clock.now()`, (B) write to DB + commit, (C) `on_pipeline_start()` → `clock.pause("pm")`. Between step A and step C, the GameClock continues running. The DB commit alone adds ~1-5 ms of drift, meaning `game_time_fired` does not match the actual moment the clock pauses. In a psychology experiment, even millisecond-level inaccuracy in the dependent variable is unacceptable.

### Root Cause
> `clock.pause()` is called after `clock.now()` is captured and after the DB commit, leaving a window where game time advances beyond the recorded value.

### Contributing Factors
> - `on_pipeline_start` is a callback passed from BlockRuntime — easy to overlook that it must execute before the time snapshot
> - No assertion or test verifying that `game_time_fired == clock.now()` at the moment the clock actually pauses

### Fix
> Reorder so `on_pipeline_start()` (which calls `clock.pause("pm")`) executes before `game_time_fired = clock.now()`. Once the clock is paused, `clock.now()` returns a stable value and the DB commit latency no longer matters.

### Follow-up Actions
> - [ ] Add test asserting `clock.now()` is stable between pause and DB write

---

## INC-022 — Admin config page contract drift crashed assignments and showed undefined timing fields

| Field        | Detail |
|--------------|--------|
| Date         | 2026-05-09 |
| Severity     | P2 Medium |
| Status       | Resolved |
| Reported by  | Manual admin UI check |
| Affected area| `backend/routers/admin.py` `/api/admin/config`; frontend `ConfigPage` assignments table |

### Background
> The admin config page should provide a read-only view of experiment timing, task registry, reminders, and condition assignments. The frontend expects stable config keys and should tolerate older assignment payload shapes.

### Incident Description
> The Experiment Parameters section displayed `undefined` for several fields because `/api/admin/config` no longer returned `blocks_per_participant`, `pm_tasks_per_block`, `execution_window_s`, `late_window_s`, or `reminder_lead_s`. Opening Condition Assignments crashed with `Cannot read properties of undefined (reading 'map')` because the backend returned top-level `unreminded_task` while the frontend assumed `blocks[]`.

### Timeline
| Time (local) | Event |
|--------------|-------|
| 22:36 | Admin config bug reported from UI |
| 22:36 | Investigation started |
| 22:37 | Root cause identified as frontend/backend contract drift |
| 22:39 | Backend config fields and frontend guards implemented |
| 22:40 | Frontend build and backend tests passed |

### Root Cause
> The admin page retained assumptions from an older schema while the admin endpoints returned a newer, smaller payload. The frontend also did not guard optional assignment fields before rendering nested block rows.

### Contributing Factors
> - No shared schema or response type between admin API and frontend config page
> - No frontend test for `/config` with current `/assignments` payload
> - Missing fallback formatting for optional admin config values

### Fix
> `/api/admin/config` now includes the legacy timing/count fields needed by the admin UI. `ConfigPage` now formats missing numbers as `—`, derives assignment rows through a normalizer, and supports both top-level `unreminded_task` and nested `blocks[]`.

### Verification
> `npm run build` passed in `CookingForFriends/frontend`. `conda run -n thesis_server pytest tests/test_phase_state.py tests/test_experiment_materials.py -q` passed in `CookingForFriends/backend`.

### Follow-up Actions
> - [ ] Add a focused admin API contract test for `/api/admin/config` and `/api/admin/assignments`
> - [ ] Add a lightweight frontend regression test or story fixture for `ConfigPage`

---

<!-- Merged from former docs/incidents.md on 2026-05-13. Former local IDs were renumbered to keep this file unique. -->

## INC-023 — Game time continues and cooking steps fire during PM overlay

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

---

## INC-024 — Session end leaves frontend in frozen game state before post-test

| Field         | Detail |
| ------------- | ------ |
| Date          | 2026-05-11 |
| Severity      | P1 High |
| Status        | Resolved |
| Reported by   | User observation during formal session end testing |
| Affected area | `websocket/game_handler.py` session-end event flow, `frontend/src/hooks/useWebSocket.ts`, main experiment phase transition |

### Background

At the end of the main experiment, the backend sends a `session_end` WebSocket event after the final PM pipeline and session-end delay. The normal expected behaviour is that the frontend immediately exits the game runtime, clears any frozen PM state, and renders `POST_MANIP_CHECK` ("Robot Reminder Question") without requiring a browser refresh.

### Incident Description

After a formal session ended, the participant page could transition to a white screen and appear stuck. Refreshing the page restored a partially stale game view: the phone still showed the main-experiment UI and the in-game time appeared not to advance. After a delay, the page eventually transitioned to the Robot Reminder Question page.

This was a high-risk end-of-session issue because it could make participants think the experiment had crashed immediately before post-test questionnaires.

### Timeline

| Time (local) | Event |
|--------------|-------|
| — | First symptom observed: white screen after formal session end |
| — | Refresh showed stale phone/game UI with frozen-looking clock |
| — | Investigation started in WebSocket session-end and frontend phase handling |
| — | Root cause identified: session-end events did not clear runtime/frozen frontend state |
| — | Fix deployed in frontend WebSocket event handler |
| — | Confirmed build passes |

### Root Cause

The frontend `useWebSocket` handler treated `session_end` as only a phase update:

```ts
store.setPhase('POST_MANIP_CHECK')
```

It did not clear the PM pipeline state, did not unset `gameTimeFrozen`, and did not clear robot speech. If the session ended after a PM-trigger-controlled freeze or while stale runtime state was still present, the frontend could continue rendering game-era state long enough to produce a blank/stale transition before the post-test page stabilized.

A second inconsistency existed for `block_end`: the handler still routed to the legacy `debrief` phase instead of the canonical post-test flow. That made the end-of-main-experiment path depend on which terminal WS event arrived.

### Contributing Factors

- The current experiment moved to canonical phases (`MAIN_EXPERIMENT -> POST_MANIP_CHECK`), but `block_end` still contained legacy `debrief` routing.
- The WebSocket end-event handlers did not perform runtime cleanup even though PM triggers can leave `gameTimeFrozen` and `pmPipelineState` active.
- The frontend does not currently have an integration test that simulates the final backend `session_end` event while PM/game runtime state is non-idle.

### Fix

Updated `frontend/src/hooks/useWebSocket.ts` so both `session_end` and `block_end` perform the same cleanup before entering post-test:

- `setPMPipelineState(null)`
- `setGameTimeFrozen(false)`
- `clearRobotSpeech()`
- `setPhase('POST_MANIP_CHECK')`

This makes terminal backend events idempotently leave the main experiment runtime and enter the canonical post-test flow.

Related fix commit:

- `a69c977 fix(frontend): prevent invisible phone overlays`

### Verification

- Frontend production build passed with `cd CookingForFriends/frontend && npm run build`.
- Manual reasoning check: both backend terminal events now clear frozen/runtime state before phase transition, and `block_end` no longer routes to legacy `debrief`.

### Follow-up Actions

- [ ] Add a frontend/WebSocket integration test that dispatches `session_end` while `pmPipelineState` is active and `gameTimeFrozen=true`, then asserts `phase === POST_MANIP_CHECK`, `pmPipelineState === null`, and `gameTimeFrozen === false`.
- [ ] Audit remaining legacy phase transitions that still route directly to `debrief` or `post_questionnaire`.
- [ ] Add lightweight runtime logging for `session_end` receipt and frontend phase transition completion during pilot sessions.

---

## INC-025 — Tutorial-to-main transition can enter blank/stale game state

| Field         | Detail |
| ------------- | ------ |
| Date          | 2026-05-11 |
| Severity      | P1 High |
| Status        | Resolved |
| Reported by   | User observation during tutorial-to-formal-session testing |
| Affected area | `frontend/src/pages/game/TutorialFlowPage.tsx`, `frontend/src/pages/game/GamePage.tsx`, main experiment phase transition |

### Background

After `TUTORIAL_TRIGGER`, the frontend advances to `MAIN_EXPERIMENT`. Normal expected behaviour is that the practice/tutorial runtime is discarded, formal cooking definitions are loaded, the game state starts from a clean 17:00 session, and the WebSocket starts the backend block timeline.

### Incident Description

The participant page could turn white or remain in an unusable stale state when switching from tutorial to the formal session. This resembled the earlier formal-session-to-questionnaire transition issue, but happened at the boundary between tutorial practice state and the real game runtime.

### Timeline

| Time (local) | Event |
|--------------|-------|
| — | First symptom observed: white screen during tutorial-to-session phase switch |
| — | Investigation started in frontend phase routing and runtime initialization |
| — | Root cause identified: formal game mounted with tutorial cooking/runtime state still in the global store |
| — | Fix deployed in `GamePage` initialization path |
| — | Confirmed frontend build passes |

### Root Cause

`TutorialFlowPage` intentionally mutates global game state for practice: it loads a fried-egg tutorial recipe, injects tutorial phone messages/contacts, unlocks the phone, and temporarily overrides `wsSend` to intercept cooking actions. When the backend phase advanced to `MAIN_EXPERIMENT`, `GamePage` mounted and immediately opened the formal WebSocket, but it did not first reload formal cooking definitions or clear tutorial PM/phone/cooking/runtime state.

That left the first formal-session render dependent on stale tutorial state while the backend runtime expected the real main-experiment recipe and timeline.

### Contributing Factors

- Tutorial practice and formal gameplay share the same global Zustand store.
- `GamePage` assumed cooking definitions had already been initialized correctly.
- The WebSocket could start before the formal main-session state was reset.
- Frontend automation does not currently cover cross-phase transitions.

### Fix

Updated `frontend/src/pages/game/GamePage.tsx` so formal runtime initialization is explicit before opening the WebSocket:

- Load formal cooking definitions with `getCookingDefinitions(sessionId)`.
- Reinitialize cooking definitions and call `resetBlock()`.
- Clear tutorial/runtime residue: PM pipeline state, `gameTimeFrozen`, robot speech, and any temporary `wsSend`.
- Reset the visible game clock, elapsed seconds, phone tab, and lock state.
- Delay `useWebSocket` activation until initialization succeeds.
- Render a visible initialization error page if setup fails instead of leaving an indefinite blank/loading state.

### Verification

- Frontend production build passed with `cd CookingForFriends/frontend && npm run build`.
- Manual reasoning check: `GamePage` no longer opens the WebSocket or sends `start_game` until formal cooking definitions are loaded and tutorial state has been cleared.

### Follow-up Actions

- [ ] Add a frontend transition test for `TUTORIAL_TRIGGER -> MAIN_EXPERIMENT` that asserts formal cooking definitions are loaded before `start_game`.
- [ ] Consider separating tutorial practice state from main game runtime state so future tutorials cannot leak into formal sessions.
- [ ] Add lightweight runtime logging for formal game initialization completion during pilot sessions.

---

## INC-026 — First 0s cooking task skipped on fresh main-experiment start

| Field         | Detail |
| ------------- | ------ |
| Date          | 2026-05-13 |
| Severity      | P1 High |
| Status        | Resolved |
| Reported by   | User observation during main experiment session |
| Affected area | `backend/engine/cooking_engine.py`, main experiment cooking timeline |

### Background

At `MAIN_EXPERIMENT` start, the backend runtime should immediately activate the first cooking step scheduled at `t=0` and send an `ongoing_task_event` to the frontend.

### Incident Description

The participant entered a main experiment session but did not receive the first kitchen task scheduled at 0 seconds.

### Timeline

| Time (local) | Event |
|--------------|-------|
| — | First symptom observed: 0s kitchen task did not appear |
| — | Investigation started in runtime plan, PM scheduler, and cooking engine startup |
| — | Root cause identified: fresh shared `GameClock` startup was treated like a resumed runtime |
| — | Fix deployed in `CookingEngine.start` |
| — | Backend tests and frontend build confirmed passing |

### Root Cause

`BlockRuntime` starts the shared `GameClock` through the timeline before constructing `CookingEngine`. On a fresh session this means `clock.now()` can already be a few milliseconds greater than zero when the cooking engine starts. The reconnect-safety logic interpreted that as a restored runtime and selected the first cooking entry with `entry.t > now`, which skipped the `t=0` entry.

### Contributing Factors

- Fresh starts and restored/reconnected starts both used an already-started shared `GameClock`.
- The reconnect replay fix did not include a regression test for a fresh clock that had advanced slightly past zero.
- The first real cooking cue is scheduled exactly at `t=0`, so even a tiny startup offset exposed the issue.

### Fix

Updated `CookingEngine.start` to treat an already-started clock with less than one second elapsed as a fresh start and schedule from `0.0`. Reconnect/restored starts still skip past entries when `block_start_time` is provided or the shared clock is meaningfully past zero.

Added `test_fresh_shared_clock_keeps_zero_second_cooking_entry` to assert that a fresh shared clock at `0.05s` still emits the `t=0` cooking activation.

### Verification

- `cd CookingForFriends/backend && conda run -n thesis_server pytest tests/test_cooking_engine.py tests/test_timeline_reconnect.py tests/test_runtime_plan_loader.py -q`
- `cd CookingForFriends/backend && conda run -n thesis_server pytest tests -q`
- `cd CookingForFriends/frontend && npm run build`

### Follow-up Actions

- [ ] Add an end-to-end runtime smoke test that starts `BlockRuntime` and asserts the first cooking `ongoing_task_event` is emitted.
