1. 部分（未处理的）消息反复发送
2. Reconnect PM pipeline state endpoint 参数不一致

- 观察：前端 `getSessionState(sessionId)` 调用 `/api/session/{sessionId}/state`，但后端 `GET /api/session/{token}/state` 按 participant token 查询。
- 风险：断线重连时如果存在未完成 PM pipeline，前端可能无法恢复真实 `task_id` / pipeline step，导致恢复失败或状态不完整。
- 相关文件：
  - `frontend/src/services/api.ts`
  - `frontend/src/hooks/useWebSocket.ts`
  - `backend/routers/session.py`

3. Backend gameplay time model 分裂，需要统一 GameClock 重构

- 记录日期：2026-05-02
- 状态：已止血，仍需重构
- 严重性：P1 高
- 观察：
  - `backend/engine/timeline.py` 原本用 `time.time() - start_time` 推进 HUD、phone message、block_end。
  - `backend/engine/cooking_engine.py` 自己维护 `block_start_time`、`asyncio.sleep()`、step timeout 和 response time。
  - `backend/engine/game_time.py` 后来为 PM trigger 增加了 DB-backed freeze/unfreeze，但只服务 PM scheduler。
  - PM modal 是全局中断，前端会阻止背景点击；但如果 backend timeline/cooking 继续跑，就会污染实验流程。
- 当前止血修复：
  - `pm_session.py` 在发送 `pm_trigger` 前调用 gameplay pause callback。
  - `game_handler.py` 在 PM pipeline 开始时暂停 timeline + cooking，在 `pm_action_complete` / `fake_trigger_ack` 后恢复。
  - `timeline.py` 增加 pause/resume control，timeline elapsed 和 sleeps 排除暂停时长。
  - `cooking_engine.py` pause 时保存 active step timeout 剩余时间，resume 时恢复 timeout 并平移 response-time 基准。
- 风险：
  - 当前仍是三套时间的边界同步，不是单一时间源。
  - process restart / reconnect 后，timeline/cooking 的运行态仍主要在内存里，不能作为生产级恢复机制。
  - 后续功能如果继续直接使用 `time.time()` 或裸 `asyncio.sleep()`，会绕过 PM pause 语义。

重构目标：

- 建立唯一 owner：`GameClock` 或 `BlockRuntime`。
- 所有 gameplay 模块只通过 `clock.now()` / `clock.sleep_until(game_second)` / `clock.sleep_for(game_seconds)` 获取和等待游戏时间。
- 业务模块不再直接计算 `time.time() - start_time`。
- PM pipeline 只调用 `runtime.pause(reason="pm")` 和 `runtime.resume(reason="pm")`，不再分别知道 timeline/cooking 的内部实现。
- cooking response time、step timeout、timeline event schedule、HUD clock、phone message schedule、session end 都使用同一个 game-time source。

建议阶段计划：

1. Phase 0 — 冻结范围

   - 不再扩展复杂 reconnect 恢复。
   - 测试阶段每轮从 admin 新建 test session/token。
   - 明确：被试中途关闭浏览器或长时间断线时标记 invalid/incomplete，而不是尝试恢复完整实验。
2. Phase 1 — 引入 `GameClock` 抽象

   - 新增 `backend/engine/game_clock.py`。
   - 封装现有 `Participant.game_time_elapsed_s`、`frozen_since`、`last_unfreeze_at`。
   - 提供 `start()`、`pause(reason)`、`resume(reason)`、`now()`、`sleep_for()`、`sleep_until()`。
   - 保持现有 DB 字段不变，避免先做 migration。
3. Phase 2 — timeline 迁移

   - `timeline.py` 事件等待改为 `clock.sleep_until(event.t)`。
   - HUD `time_tick` 由 `clock.now()` 推导。
   - phone message cooldown 使用 game time。
   - 移除 timeline 自己的 `TimelineControl` 或让它变成 `GameClock` 的薄封装。
4. Phase 3 — cooking engine 迁移

   - step activation 使用 `activated_game_time`。
   - timeout 使用 `deadline_game_time`。
   - response time 使用 `clock.now() - activated_game_time`。
   - 移除 cooking engine 自己维护的 `block_start_time` / pause offset 逻辑。
5. Phase 4 — PM pipeline 迁移

   - `pm_session.py` 不再直接调用低层 `freeze_game_time()`。
   - 改成 `runtime.pause("pm")` 后发 trigger，pipeline 完成后 `runtime.resume("pm")`。
   - 保留 fake trigger 和 real trigger 的相同 pause/resume 边界。
6. Phase 5 — lifecycle 策略收敛

   - `game_handler.py` 成为 `BlockRuntime` 的创建/销毁入口。
   - disconnect 不再默认重建 timeline/cooking 内存任务并猜测状态。
   - 如果实验层面不支持恢复，超过阈值直接标记 invalid/incomplete，并在 admin UI 显示。
7. Phase 6 — 测试

   - 单元测试：`GameClock` start/pause/resume/now/sleep_until。
   - timeline 测试：PM pause 期间不发送 time_tick/phone_message/block_end。
   - cooking 测试：PM pause 期间 active step 不 timeout，resume 后剩余时间正确。
   - PM 集成测试：real/fake trigger 都暂停 gameplay，并在 complete/ack 后恢复。

验收标准：

- PM modal 停留任意时长时，HUD、phone、cooking timeout、block_end 都不推进。
- PM 完成后，下一次 trigger 的等待时间按 game time 继续计算。
- cooking response time 不包含 PM overlay 时间。
- 代码库中 gameplay 调度路径不再直接使用裸 `time.time() - start_time` 作为游戏进度。
- backend tests 覆盖真实 PM pause/resume 流程，而不是只依赖手测。

4. Cooking recipe / active step / timer queue 状态分裂

- 记录日期：2026-05-02
- 状态：主要重构已完成，仍需后续做事件链架构收敛
- 严重性：P1 高
- 观察：

  - 用户截图中顶部 kitchen timer 显示 `Sauté base!`，但 Recipe 卡片里 Tomato Soup 仍显示 `Select ingredients`。
  - WS log 显示同一个 `tomato_soup step_index=2` 在数秒内提交了多次不同 option。
  - 这说明 frontend 的 `kitchenTimerQueue`、`activeCookingSteps`、`dishes.currentStepIndex` / recipe rendering 可以互相脱节。
- 根因：

  - frontend `gameStore.ts` 里硬编码了一份 recipe steps，和 backend `data/cooking_recipes.py` 不是同一份数据。
  - backend Tomato Soup 有 9 步，frontend 之前只有 7 步；Spaghetti/Steak 也缺少 wait steps。
  - Recipe tab 把 `dish.phase !== idle` 直接当作“当前步骤 live”，导致 wrong/missed 后无 active step 时仍高亮旧步骤。
  - Station popup 提交后没有把该 active step 标记为 pending，用户可以在后端 result 返回前重复提交同一 step。
  - backend `CookingEngine.handle_action()` 原本忽略 client `step_index`，如果旧 popup 和当前 active step 同 dish/同 station，可能把 stale option 错算到新 step。
- 已做修复：

  - frontend recipe hardcoded steps 已对齐 backend `cooking_recipes.py` 当前定义。
  - Recipe tab 只有 `activeStep` / `waitStep` 存在时才高亮 live step；wrong/missed 后不再把旧步骤显示成正在执行。
  - Station popup 对同一 active step 增加 pending guard，避免重复发送多次 `cooking_action`。
  - backend cooking action 增加 `client_step_index` 校验，stale action 会被拒绝并记录 warning。
- 本次重构：

  - backend `data/cooking_recipes.py` 新增 `serialize_cooking_definitions()`，`/api/session/start` 和 `/api/session/{session_id}/cooking-definitions` 下发 recipe 可见 definitions、timeline 和 `recipe_version`；正确答案仍只保留在 backend。
  - frontend `gameStore.ts` 删除 recipe 内容 hardcode，`dishes` 从 backend bootstrap payload 初始化；sessionStorage 也保存同一份 definitions，刷新恢复时缺失则重新 fetch。
  - `kitchenTimerQueue` 已移除；锁屏 KITCHEN TIMER、phone header timer、Kitchen station highlight 都从 `activeCookingSteps` 派生。
  - `step_timeout` / `step_result` 只写入 `dish.stepResults` 并移除 active step；timeout 后 timer 会消失，Recipe 显示 missed，不再有独立 warning timer 残留。
  - backend 在激活同一道菜下一步前，会先把仍未完成的旧 active step 标记为 missed，避免 timeout task 和 timeline activation 同时发生时旧步骤被覆盖。
  - backend wait step 现在在下一道同 dish active step 前发 `wait_end`；frontend 收到下一步 `step_activate` 时也会清理该 dish 的旧 wait step，避免 Recipe 被旧 wait 卡住。
  - backend 完成某道菜所有 active steps 后会发 `dish_complete`，frontend 统一将该 dish 标记为 `served` 并清理 active/wait state。
- 剩余风险：

  - cooking timeline 仍是绝对时间表；如果想做到“每道菜内部前一步完成/timeout 后才激活下一步”，需要继续执行第 5 项事件链重构。
  - frontend 仍缺少自动化 UI 回归测试，Recipe/lock screen/header 的同步目前靠 store 结构和手测/构建保障。
- 理想架构决策：

  - Backend 必须是 recipe definitions 的唯一 source of truth。
  - 游戏开始前通过 session/bootstrap 一次性下发完整 cooking definitions，而不是运行时按 step 请求。
  - Payload 应包括 `recipes`、`dish_labels`、`dish_emojis`、必要时包括 `cooking_timeline` 和 `recipe_version`。
  - Frontend `gameStore` 不再 hardcode `SPAGHETTI_STEPS` / `STEAK_STEPS` / `SOUP_STEPS` / `VEGGIE_STEPS`，只根据 bootstrap payload 初始化 `dishes`。
  - Runtime WebSocket 只负责状态推进：`step_activate`、`step_result`、`step_timeout`、`wait_start`、`dish_complete`。
  - 不采用“到时候只从后端拿特定条目”的方案，因为 Recipe tab 需要按住即时显示，运行时 HTTP fetch 会引入延迟、race condition 和第二条同步通道。
  - 推荐在 block/session 记录中保存 `recipe_version` 或 `recipe_snapshot`，保证后续实验数据分析能复现该 participant 使用的 recipe 定义。
- 后续建议：

  - [x] 新增 session/bootstrap payload，返回完整 backend recipe definitions 和 recipe version。
  - [x] 删除 frontend `gameStore.ts` 中的 recipe hardcode。
  - [x] 前端 `RecipeTab` 改为只渲染 bootstrap recipes + runtime state，不再拥有 recipe 内容定义。
  - [ ] 给 cooking action 增加 frontend rejection handling，例如显示 stale/expired step 提示。
  - [ ] 增加测试：wrong/missed 后 Recipe 不高亮旧 step；active step 只能提交一次；stale step_index 被 backend 拒绝。
  - [ ] 将 cooking timeline 从绝对时间触发改为 per-dish event chain，只用 timeline 控制每道菜第一步开始。

5. 每道菜内部，前一步没完成（完成或timeout），下一步不激活。timeline只控制第一步的开始时间，后续步骤由完成事件触发。

6. Game clock 超过 18:00 / 时间系统分层说明

- 记录日期：2026-05-02
- 状态：已修复（止血），架构层面仍需改进
- 严重性：P2 中
- 观察：游戏时钟在 elapsed=620s 时显示 18:02，block 运行期间可达 18:30。
- 详见 `INCIDENT_LOG.md` INC-014。

**三套时间系统（当前架构）**

系统中现存三套完全独立的时间：

| 套 | 位置 | 单位 | 用途 |
|----|------|------|------|
| 1. Event t 值 | `block_default.json` + `timeline.py` | 真实秒（0–900） | 控制何时触发剧情事件（phone message、steak、block_end） |
| 2. Game Clock | `timeline.py` → `time_tick` → 前端 `GameClock` | 游戏分钟（17:00–18:00） | 纯 UI 显示，无逻辑依赖 |
| 3. Cooking Countdown | 前端 `activeCookingSteps`，用 `Date.now()` 驱动 | 系统实时时钟 | 每道菜步骤的倒计时显示 |

三套之间**没有数据依赖**。关系如下：

```
真实 elapsed（秒）
    │
    ├─ ÷10，min(60) ──→ game_clock "17:xx"     [系统2，纯显示，上限18:00]
    │
    └─ 直接比较 t 值  ──→ 触发 events           [系统1，逻辑，上限900s]

系统3（cooking countdown）= Date.now() - step激活时间戳，完全独立
```

**为什么 `duration_seconds=900` 而时钟跨度是 600s？**

- `duration_seconds=900`：block runner 需要运行 900 真实秒，因为 steak 的 `ongoing_task_event` 排到 t=880。
- 游戏时钟跨度 600s：17:00→18:00 = 60 游戏分钟 × 10s/min。
- 两者目的不同，但原来共用同一个 `tick_num` 推导，导致时钟越界。
- 当前止血：`game_minutes = min(tick_num, 60)`。

**根本问题**：`duration_seconds` 同时承担了两个语义——"block 运行多久"和"时钟走多久"——却没有被明确分离。

**重构建议**：

- [ ] 在 JSON schema 中加 `clock_end_seconds: 600` 字段，与 `duration_seconds` 解耦：
  ```json
  { "duration_seconds": 900, "clock_end_seconds": 600 }
  ```
  Python: `game_minutes = min(tick_num, timeline.get("clock_end_seconds", 600) // 10)`
- [ ] 在 `timeline.py` 顶部加常量 `GAME_SECONDS_PER_MINUTE = 10`，让 `// 10` 有名字。
- [ ] 考虑是否可以删除 `duration_seconds`：当 `block_end` 永远是最后一个事件时，tail loop 实际不执行，该字段是死代码。
- [ ] 评估系统3（cooking countdown）是否应改为由 `time_tick` 驱动，以便 PM pause 时 cooking 倒计时也能暂停（目前 PM pause 期间 `Date.now()` 仍在走，步骤可能超时）。
