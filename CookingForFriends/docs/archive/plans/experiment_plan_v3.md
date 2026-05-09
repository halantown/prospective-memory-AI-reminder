# Plan更新指令 (Increment Patch)

## 背景
此为对原plan的补丁。请只修改我指出的部分，其他保持原样。
所有改动必须在原plan基础上做精确替换/补充，不要重写整个plan。

---

## 改动 1: PM Pipeline Flow (修改 §6 + §5.4)

### 新Pipeline (real trigger)
```
1. Trigger fires (game time冻结开始)
2. Trigger affordance: 门铃图标/电话铃响动画
3. 被试点击 → 开门/接电话 → 进入greeting场景
4. 简短scripted greeting (与guest/caller对话)
5. Robot avatar进入场景 + speech bubble渲染reminder
   (reminder内容来自 PLACEHOLDER_REMINDER_T{n}_{EE1/EE0})
6. 被试点击"I know" → reminder bubble消失
7. Decoy modal出现: 6 options, 位置随机
8. 被试选择 → confidence rating
9. 被试提交confidence → modal关闭
10. ⭐ Avatar自动导航并执行action (被试观看, 不操作)
11. Action完成 → game time冻结结束 → 返回ongoing task
```

### 新Pipeline (fake trigger)
```
1. Trigger fires (game time冻结开始)
2. Trigger affordance
3. 被试点击 → greeting
4. Robot avatar进入 + speech bubble渲染fake reminder 
   (无关陈述, 来自 PLACEHOLDER_FAKE_REMINDER pool, 无action要求)
5. "I know"按钮
6. 关闭, game time冻结结束
```

### 实现要点
- 整个PMTriggerModal显示期间, game time暂停 (ongoing tasks freezes)
- Avatar执行action阶段也在modal范围内, 持续显示直到action complete
- 所有汉化文本/对话/reminder全部走placeholder

---

## 改动 2: 时间设计 (修改 §1.1 + §2.3 + §4.3)

### 移除
- `TRIGGER_TIMES = {1: 180, 2: 390, ...}`  (不再使用绝对时间)

### 替换为
```python
# Inter-trigger intervals (game time秒数, 自上一event结束计算)
TRIGGER_SCHEDULE = [
    {"type": "real", "delay_after_previous_s": 180, "task_position": 1},  
    {"type": "fake", "delay_after_previous_s": 120, "trigger_type": "doorbell"},
    {"type": "real", "delay_after_previous_s": 60,  "task_position": 2},  
    {"type": "real", "delay_after_previous_s": 120, "task_position": 3},  
    {"type": "fake", "delay_after_previous_s": 60,  "trigger_type": "phone_call"},
    {"type": "real", "delay_after_previous_s": 60,  "task_position": 4},  
]
SESSION_END_DELAY_AFTER_LAST_TRIGGER_S = 60
```

### Timeline生成逻辑 (engine/timeline_generator.py)
- 不再pre-schedule所有trigger的wall time
- 改为event-driven: 上一trigger pipeline结束 → 等`delay_after_previous_s`秒 → fire下一trigger
- "等待"期间game time正常流逝, ongoing tasks正常运行
- Pipeline期间game time冻结 (ongoing task timers暂停)

### Session结束条件
- 最后一个real trigger完成 + `SESSION_END_DELAY_AFTER_LAST_TRIGGER_S` 秒后, 自动转phase到`post_questionnaire`

---

## 改动 3: Game Time Freeze机制 (新增到§1.4)

### Session模型新增字段
```python
session.game_time_elapsed_s: float = 0.0       # 累积游戏时间(冻结期间不增加)
session.frozen_since: timestamp | null = None  # 当前冻结起始wall time
session.last_unfreeze_at: timestamp | null     # 最近一次unfreeze的wall time
```

### Freeze/Unfreeze逻辑
```python
def freeze_game_time(session):
    if session.frozen_since is None:
        session.game_time_elapsed_s += (now - session.last_unfreeze_at).seconds
        session.frozen_since = now

def unfreeze_game_time(session):
    if session.frozen_since is not None:
        session.last_unfreeze_at = now
        session.frozen_since = None

def get_current_game_time(session) -> float:
    if session.frozen_since:
        return session.game_time_elapsed_s
    return session.game_time_elapsed_s + (now - session.last_unfreeze_at).seconds
```

### 何时freeze/unfreeze
- Trigger fires → freeze
- Pipeline完成 (action complete for real, "I know" for fake) → unfreeze
- Disconnect时仍保持freeze状态, 重连后继续

---

## 改动 4: Decoy内容 (固化到 frontend/src/constants/pmTasks.ts)

```typescript
export const DECOY_OPTIONS: Record<string, DecoyOption[]> = {
  T1: [  // Mei → 烘焙书
    { id: 'target',    label: '烘焙书',     isTarget: true },
    { id: 'intra1',    label: '游戏手柄',   isTarget: false },
    { id: 'intra2',    label: '蛋糕盒子',   isTarget: false },
    { id: 'cross1',    label: '礼品袋',     isTarget: false },  // T2 intra
    { id: 'cross2',    label: '烧烤架',     isTarget: false },  // T3 intra
    { id: 'unrelated', label: '[T1 unrelated TBD]', isTarget: false },
  ],
  T2: [  // Lina → 巧克力
    { id: 'target',    label: '巧克力',     isTarget: true },
    { id: 'intra1',    label: '礼品袋',     isTarget: false },
    { id: 'intra2',    label: '明信片',     isTarget: false },
    { id: 'cross1',    label: '游戏手柄',   isTarget: false },  // T1 intra
    { id: 'cross2',    label: '旧电池',     isTarget: false },  // T4 intra
    { id: 'unrelated', label: '[T2 unrelated TBD]', isTarget: false },
  ],
  T3: [  // Tom → 苹果汁
    { id: 'target',    label: '苹果汁',     isTarget: true },
    { id: 'intra1',    label: '烧烤架',     isTarget: false },
    { id: 'intra2',    label: '蓝牙音箱',   isTarget: false },
    { id: 'cross1',    label: '蛋糕盒子',   isTarget: false },  // T1 intra
    { id: 'cross2',    label: '纸箱',       isTarget: false },  // T4 intra
    { id: 'unrelated', label: '[T3 unrelated TBD]', isTarget: false },
  ],
  T4: [  // 送货员 → 垃圾袋
    { id: 'target',    label: '垃圾袋',     isTarget: true },
    { id: 'intra1',    label: '旧电池',     isTarget: false },
    { id: 'intra2',    label: '纸箱',       isTarget: false },
    { id: 'cross1',    label: '明信片',     isTarget: false },  // T2 intra
    { id: 'cross2',    label: '蓝牙音箱',   isTarget: false },  // T3 intra
    { id: 'unrelated', label: '[T4 unrelated TBD]', isTarget: false },
  ],
}
```

Cross-distractor分配规则: 每个task非target intra item只在一个其他task的decoy中出现一次, 避免被试在多个decoy中重复看到同一item.

---

## 改动 5: PMTaskEvent模型简化 (修改 §1.3)

### 移除字段
- `action_correct: bool`  ← 删除
- 因为action由system自动执行, 不反映被试behavior

### 保留 (重命名以明示语义)
- `action_animation_start_time: timestamp`
- `action_animation_complete_time: timestamp`

### 注解
DV层面行为正确性来自`decoy_correct`. Action字段仅用于timing analysis和session log完整性.

---

## 改动 6: Intention Check实现 (新增到 §5.2)

### 替换原"PMIntentionCheck"为
4个独立intention check question, 每个task一道, 按task_order顺序问:

```typescript
// 例: T1 (Mei)
question: "When the doorbell rings and Mei arrives, what will you do?"
options: [
  "Bring [target item TBD] to her",      // 正确
  "Bring [intra distractor 1] to her",   // 干扰1
  "Bring [intra distractor 2] to her",   // 干扰2
  "Just greet her and continue cooking", // null option
]
```

### 实现要点
- Options也用placeholder, 由researcher后期填
- Logged as `IntentionCheckEvent`: session_id, task_id, question_text, selected_option, correct_option, response_time
- 错误回答允许继续 (don't gate progression), 但log

### 新增模型
```python
IntentionCheckEvent: session_id, task_id, position, 
                     selected_option_index, correct_option_index, response_time
```

---

## 改动 7: Disconnect/Reconnect (新增到 §1.4 + §3.1)

### 心跳机制
- 前端每30s发ping
- 后端60s无ping → mark as disconnected (但不立即终止session)
- 前端`window.onclose` → 立即尝试reconnect (exponential backoff: 1s, 2s, 4s, 8s)

### Reconnect时
- 前端拉取`GET /api/session/{token}/state`
- 返回当前phase, frozen状态, 当前pipeline step (if any), 累积游戏时间
- 前端渲染对应phase, 必要时resume pipeline中断处

### 中途pipeline断线策略
- 如果断线时正在pipeline中 (e.g., reminder displayed but no "I know" click yet)
- 重连后: **从pipeline开头重新trigger** (重新从affordance开始)
- Log字段添加: `pipeline_was_interrupted: bool`
- 不重复扣除game time (frozen期间断线, frozen状态保持, 重连后unfreeze正常推进)

### Disconnect timeout
```python
MAX_DISCONNECT_DURATION_S = 300  # 5分钟
```
- 断线超过5min, session标记为`incomplete=True`, 后续export可filter
- 不强制终止WS, 允许被试重连查看状态, 但data flagged

---

## 改动 8: Test Mode bypass (修改 §3.2)

### `POST /api/admin/test-session` 实现
```python
async def create_test_session(req: TestSessionRequest):
    # ⭐ DO NOT call assign_condition_and_order()
    # ⭐ DO NOT increment any round-robin counter
    participant = Participant(
        token=generate_token(),
        condition=req.condition,           # admin指定
        task_order=req.order,              # admin指定
        is_test=True,                      # 强制True
        current_phase=req.start_phase,     # admin可跳到任意phase
    )
    db.add(participant)
    await db.commit()
    return {"token": participant.token, "url": f"/?token={participant.token}"}
```

### Round-robin counter逻辑
- 仅在`POST /api/admin/participant/create` (real participant)中递增
- Admin页`§8.2 assignment counts`查询时, 加`WHERE is_test=False`过滤

---

## 改动 9: PM Intention Check Frontend Position

在`CutsceneEncodingPage.tsx`中, 流程修改为:
```
For each task in task_order:
  For each segment (4 total):
    Show CutscenePlayer
    Show DetailCheckModal
After all 16 segments:
  For each task in task_order:
    Show IntentionCheckQuestion (4题, 按顺序)
Then: → setPhase('playing')
```

---

## 改动 10: Open Questions更新

移除原open questions, 替换为:
- ❌ Robot avatar — RESOLVED (使用)
- ❌ Confidence scale type — placeholder保留
- ❌ Greeting text — placeholder保留
- ❌ Unrelated distractor items (4个) — placeholder保留, 待研究者填
- ❌ Fake reminder content — placeholder保留, 待研究者填
- 🆕 Inter-trigger interval分布 — 已固定为TRIGGER_SCHEDULE, 可调

---

## 验收标准 (E2E test场景)

通过Test mode创建一个EE1 Order A session, 完整跑通:
1. ✅ Welcome → Consent → Introduction → Encoding (4 tasks × 4 segments + detail checks + 4 intention checks)
2. ✅ 进入Formal phase → 等3分钟 → trigger 1 fires
3. ✅ 完成trigger 1 pipeline (greeting → robot reminder → "I know" → decoy → confidence → avatar auto-action)
4. ✅ Game time冻结正确, ongoing task不在pipeline期间推进
5. ✅ 等2分钟 → fake trigger fires, 完成fake pipeline (无decoy/confidence)
6. ✅ 继续到trigger 4 → 最后delay 1分钟 → 自动转post_questionnaire
7. ✅ 期间断网1次, 重连后从断开phase继续
8. ✅ 全部数据正确log到DB, admin export CSV验证
```
