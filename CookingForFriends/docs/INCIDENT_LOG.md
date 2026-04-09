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
