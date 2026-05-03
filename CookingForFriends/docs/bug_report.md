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
- 本批迁移（2026-05-03）：
  - 新增 `backend/engine/game_clock.py`，集中定义 `GameClock`、`format_game_clock()`、`GAME_SECONDS_PER_CLOCK_MINUTE` 和 `DEFAULT_CLOCK_END_SECONDS`。
  - `timeline.py` 的 pause-aware elapsed、sleep、`time_tick` 显示和 `pm_watch_activity` fallback 已改为通过 `GameClock`。
  - timeline JSON / generator / admin editor 已支持 `clock_end_seconds=600`，和 `duration_seconds=900` 解耦。
  - `time_tick` payload 已新增 `game_time_s`、`frozen`、`clock_end_seconds`，旧 `elapsed` 字段短期保留。
- 第二批迁移（2026-05-03）：
  - `CookingEngine` 内部 step activation、timeline wait、timeout 和 response time 已改为使用 `GameClock`。
  - cooking WS payload 已新增 `activated_game_time`、`deadline_game_time`、`started_game_time`；旧 `activated_at` / `started_at` 继续保留为 wall timestamp/backcompat。
  - cooking pause/resume 不再取消并重建 timeline/timeout task，而是 pause/resume clock；timeout task 会在 `clock.sleep_until(deadline_game_time)` 中等待。
  - 新增回归测试：PM pause 期间 active step 不 timeout，resume 后才 timeout；response time 不包含 pause wall time。
- 第三批迁移（2026-05-03）：
  - `game_handler.py` 新增 per-participant `_game_clocks`，timeline 和 `CookingEngine` 注入同一个 `GameClock` 实例。
  - PM pause/resume 当前仍通过 legacy glue 调用 timeline/cooking，但二者现在共享同一个 clock；重复 pause/resume 是 idempotent。
  - 这一步还不是完整 `BlockRuntime`，PM scheduler 仍暂时使用 DB-backed `game_time` polling。
- 第四批迁移（2026-05-03）：
  - `pm_session.py` 接收共享 `GameClock`，trigger delay 和 session_end delay 已改为 `clock.sleep_for()`。
  - DB `Participant.game_time_elapsed_s/frozen_since` 保留为 snapshot/heartbeat/admin 状态，不再作为 PM scheduler 的等待 loop owner。
  - `game_handler.py` 启动/恢复 PM session 时传入同一个 per-participant clock。
- 第五批迁移（2026-05-03）：
  - 新增 `backend/engine/block_runtime.py`，由 `BlockRuntime` 持有同一个 block 的 `GameClock`、timeline task、`CookingEngine` 和 PM session task。
  - `game_handler.py` 删除 `_cooking_engines`、`_game_clocks`、`_pm_session_tasks` 三张并行运行态表，改为单一 `_block_runtimes` registry。
  - PM pipeline 开始时只调用 `runtime.pause("pm")`，PM 完成 / fake ack 后只调用 `runtime.resume("pm")`；timeline/cooking/PM scheduler 都因共享 `GameClock` 自动停住/恢复。
  - start_game、reconnect、disconnect、block_complete 的清理路径统一走 `BlockRuntime.start()` / `BlockRuntime.stop()`。
- 风险：
  - gameplay schedule 已收敛到 `BlockRuntime + GameClock`，但 timeline/cooking 内部仍保留少量兼容薄层和 wall timestamp 字段。
  - process restart / reconnect 后，timeline/cooking 的运行态仍主要在内存里，不能作为生产级恢复机制。
  - 后续功能如果继续直接使用 `time.time()` 或裸 `asyncio.sleep()`，会绕过 PM pause 语义。

重构目标：

- 建立唯一 owner：`GameClock` 或 `BlockRuntime`。
- 所有 gameplay 模块只通过 `clock.now()` / `clock.sleep_until(game_second)` / `clock.sleep_for(game_seconds)` 获取和等待游戏时间。
- 业务模块不再直接计算 `time.time() - start_time`。
- PM pipeline 只调用 `runtime.pause(reason="pm")` 和 `runtime.resume(reason="pm")`，不再分别知道 timeline/cooking 的内部实现。
- cooking response time、step timeout、timeline event schedule、HUD clock、phone message schedule、session end 都使用同一个 game-time source。

Codebase review（2026-05-03）：

- `backend/engine/timeline.py` 已开始迁移到 `GameClock`；当前仍保留 `TimelineControl` / `_timeline_elapsed()` / `_sleep_timeline()` 作为兼容薄层，但内部 clock owner 已是 `GameClock`。
- `backend/engine/cooking_engine.py` 仍然自己维护 `_block_start_time/_paused_at/_next_timeline_index`，step activation、timeout 和 response time 都基于 `time.time()` / `asyncio.sleep()`。
- `backend/engine/game_time.py` 是 DB-backed PM scheduler clock，只服务 `pm_session.py` 的 trigger wait/freeze；timeline/cooking 不读取它。
- `backend/websocket/game_handler.py` 当前是 glue code：PM trigger 时分别 pause timeline + cooking + DB game time，PM 完成后再分别 resume。这个边界同步容易漏模块。
- `timeline.py` 的 `pm_watch_activity` fallback 仍用 `start_time + fallback_time_offset` 和裸 `asyncio.sleep()`，会绕过统一 pause 语义。
- 前端 `gameClock` / `elapsedSeconds` 只来自 WS `time_tick`；phone lock/header/recipe 当前不自己推进游戏时间。cooking timer UI 已从 `activeCookingSteps` 派生，但 `activatedAt/startedAt` 仍是 epoch timestamp，未来如果恢复“剩余秒数”显示，不能再用 `Date.now()` 直接倒计时。
- 不是所有时间都应进入 GameClock：heartbeat、断线标记、鼠标轨迹、前端动画、PM 弹窗内部 decoy/confidence 反应时、PM execution window 评分窗口仍应保留 wall time，并在命名上明确。

重构边界：

- `GameClock` 只负责 gameplay time：timeline event、HUD/phone display clock、phone message schedule、cooking activation/timeout/response time、block/session end。
- `WallClock` 或裸 wall timestamp 只用于 telemetry/transport/UI animation/PM-modal-internal RT；这些字段要显式命名为 `*_wall_time` / `*_wall_ts` 或保留现有 epoch logging，不参与 gameplay schedule。
- 本阶段不做完整 reconnect 恢复；测试和实验流程仍按“每轮从 admin 新建 test session/token”。断线超过阈值应标记 incomplete，而不是重建内存任务后猜状态。

重构执行计划：

1. Phase 0 — 冻结范围

   - 不再扩展复杂 reconnect 恢复。
   - 测试阶段每轮从 admin 新建 test session/token。
   - 明确：被试中途关闭浏览器或长时间断线时标记 invalid/incomplete，而不是尝试恢复完整实验。
   - 先把代码中所有 gameplay-scheduling 的 `time.time()` / `asyncio.sleep()` 调用列成 allowlist，确认哪些是 wall time by design，哪些必须迁移。
2. Phase 1 — 抽出 clock math 和显示语义

   - [x] 新增 `backend/engine/clock_types.py` 或 `game_clock.py` 中的纯函数/常量：`GAME_SECONDS_PER_CLOCK_MINUTE = 10`、`CLOCK_START_HOUR = 17`、`DEFAULT_CLOCK_END_SECONDS = 600`、`format_game_clock(game_seconds, clock_end_seconds)`。
   - [x] 在 timeline JSON schema 中显式加入 `clock_end_seconds: 600`，与 `duration_seconds: 900` 解耦。
   - [x] `timeline.py` 先使用 `format_game_clock()` 生成 `time_tick`，去掉散落的 `// 10` / `min(tick_num, 60)`。
   - [x] 增加纯单元测试：0/10/590/600/900s 分别显示 17:00/17:01/17:59/18:00/18:00。
3. Phase 2 — 引入 `GameClock` runtime

   - [x] 新增 `backend/engine/game_clock.py`。
   - [x] 提供 `start(started_at_wall_ts=None)`、`now()`、`pause(reason)`、`resume(reason)`、`sleep_for(game_seconds)`、`sleep_until(game_second)`、`snapshot()`。
   - [x] 内部用 wall-time adapter 支持测试注入；pause 时所有 `sleep_*` 不消耗 game seconds，resume 后继续。
   - 复用现有 `Participant.game_time_elapsed_s`、`frozen_since`、`last_unfreeze_at` 做 DB snapshot，先不做 migration。
   - [x] 单元测试覆盖 start/pause/resume、嵌套/重复 pause no-op、sleep_until 被 pause 拉长但 game time 不前进。
4. Phase 3 — 引入 `BlockRuntime` owner

   - [x] 新增 `backend/engine/block_runtime.py`，由 `game_handler.py` 创建并持有：`clock`、timeline task、`CookingEngine`、PM session task。
   - [x] `runtime.start()` 负责 start_game 后创建 timeline/cooking/pm_scheduler。
   - [x] `runtime.pause("pm")` 只 pause `GameClock`，必要时发送 clock snapshot；timeline/cooking 因等待同一个 clock 自动停住。
   - [x] `runtime.resume("pm")` 只 resume `GameClock` 并持久化 snapshot。
   - [x] `game_handler.py` 不再分别 import/call `pause_timeline()`、`resume_timeline()`、`cooking.pause()`、`cooking.resume()`。
5. Phase 4 — timeline 迁移

   - [x] `timeline.py` 事件等待改为 `clock.sleep_until(event.t)`。
   - [x] HUD `time_tick` 由 `clock.now()` 推导。
   - [x] phone message cooldown 使用 game time。
   - [x] `pm_watch_activity` fallback 改为 `clock.sleep_until(fallback_game_time)`，不能再用 wall deadline。
   - [ ] 移除 `TimelineControl` / `_timeline_elapsed()` / `_sleep_timeline()`。
   - 旧 timeline `pm_trigger` 兼容逻辑保留，但不再作为 EC+/EC- 的 PM scheduler。
6. Phase 5 — cooking engine 迁移

   - [x] step activation 使用 `activated_game_time`。
   - [x] timeout 使用 `deadline_game_time`。
   - [x] response time 使用 `clock.now() - activated_game_time`。
   - [x] 移除 cooking engine 自己维护的 `block_start_time` / pause offset 逻辑。
   - [x] WS `step_activate` payload 增加 `activated_game_time`、`deadline_game_time`；epoch `activated_at` 仅作为 wall log/backcompat，前端不要用它算 gameplay countdown。
   - [x] `CookingEngine` 的 timeline runner 用 `clock.sleep_until(entry.t)`；step timeout 用 `clock.sleep_until(deadline_game_time)`。
   - 如果第 5 项 cooking event-chain 重构同时做，则每道菜下一步等待上一 active step result/timeout 后再调度；否则先保持绝对 cooking timeline，但统一 clock。
7. Phase 6 — PM pipeline 迁移

   - [x] `pm_session.py` 不再直接调用低层 `freeze_game_time()` / `_wait_game_seconds()` DB polling。
   - [x] 改成使用 `clock.sleep_for(delay_remaining)` 等待 trigger；trigger 前调用 `runtime.pause("pm")` 并记录 `game_time_fired = clock.now()`。
   - pipeline 完成后由 `game_handler.py` 调用 `runtime.resume("pm")` 和 `signal_pipeline_complete()`。
   - 保留 fake trigger 和 real trigger 的相同 pause/resume 边界。
   - 注意：PM modal 内部 decoy/confidence RT 仍用 wall time，因为它测的是弹窗内实际作答时长，不是 cooking/timeline game time。
8. Phase 7 — frontend clock contract

   - `time_tick` payload 改为明确字段：`game_time_s`、`game_clock`、`frozen`、可选 `clock_end_seconds`。
   - frontend store 将 `elapsedSeconds` 语义改名或注释为 `gameTimeSeconds`，避免和 wall elapsed 混淆。
   - 如果需要 cooking 倒计时显示，只从 `deadline_game_time - gameTimeSeconds` 派生；禁止用 `Date.now() - activatedAt`。
   - PM freeze 状态以 backend clock snapshot/heartbeat 为准，前端 `setGameTimeFrozen(false)` 只做 optimistic UI，不能作为权威时钟恢复。
9. Phase 8 — lifecycle 策略收敛

   - [x] `game_handler.py` 成为 `BlockRuntime` 的创建/销毁入口。
   - disconnect 不再默认重建 timeline/cooking 内存任务并猜测状态；短重连只重绑 WS send_fn，长断线标记 incomplete。
   - 如果实验层面不支持恢复，超过 `MAX_DISCONNECT_DURATION_S` 直接标记 invalid/incomplete，并在 admin UI 显示。
10. Phase 9 — 测试

   - 单元测试：`GameClock` start/pause/resume/now/sleep_until/sleep_for。
   - timeline 测试：PM pause 期间不发送 time_tick/phone_message/block_end，resume 后按 game time 继续。
   - cooking 测试：PM pause 期间 active step 不 timeout，resume 后剩余 game-time window 正确；response time 不包含 PM overlay。
   - PM 集成测试：real/fake trigger 都暂停 gameplay，并在 complete/ack 后恢复；下一 trigger delay 从 `game_time_fired` 继续。
   - frontend build + store-level/manual checklist：lock screen / header / recipe / station highlight 都只随 `activeCookingSteps` 和 `gameTimeSeconds` 变化。

验收标准：

- PM modal 停留任意时长时，HUD、phone、cooking timeout、block_end 都不推进。
- PM 完成后，下一次 trigger 的等待时间按 game time 继续计算。
- cooking response time 不包含 PM overlay 时间。
- 代码库中 gameplay 调度路径不再直接使用裸 `time.time() - start_time` 作为游戏进度。
- `pm_watch_activity` fallback、phone cooldown、timeline tail loop、cooking timeout 全部经过同一个 `GameClock`。
- `duration_seconds=900` 不再影响 17:00-18:00 的显示边界，显示 clock 由 `clock_end_seconds=600` 控制。
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

**三套时间系统（codebase review 后的当前状态）**

系统中仍有三类时间语义，但 gameplay schedule owner 已经收敛为 `BlockRuntime + GameClock`：

| 套 | 当前 owner | 单位/来源 | 用途 | 风险 |
|----|------------|-----------|------|------|
| 1. Gameplay runtime time | `backend/engine/block_runtime.py` + `engine/game_clock.py` | `GameClock.now()` | timeline event、phone message、HUD `time_tick`、block_end、cooking activation/timeout/RT、PM trigger/session_end delay | 主要迁移完成；timeline/cooking 仍有少量兼容函数 |
| 2. PM DB snapshot time | `backend/engine/game_time.py` + `Participant` DB fields | snapshot of accumulated game seconds | heartbeat/admin/session-state freeze 状态、PM fired time 持久化 | 不再是 scheduler owner；只作为观测/恢复辅助 |
| 3. Wall-clock telemetry time | `time.time()` / client timestamp | epoch seconds / ms | heartbeat、disconnect、mouse trace、phone send/read log、PM modal internal RT、execution window scoring | 必须保持命名边界，不能拿来驱动 gameplay schedule |

前端当前只是消费 `time_tick` 和 cooking WS state。`activeCookingSteps.activatedAt` / `CookingWaitStep.startedAt` 仍是 epoch timestamp，但 UI 目前主要显示 cue，不再是独立的倒计时 owner。

当前关系如下：

```
BlockRuntime
    └─ GameClock.now()/sleep_until()/sleep_for()
          ├─ timeline events / phone cooldown / block_end
          ├─ HUD/phone display clock "17:xx"
          ├─ cooking activation / timeout / response time
          └─ PM trigger schedule / session_end delay

Participant.game_time_elapsed_s / frozen_since
    └─ snapshot for heartbeat/admin/session-state, not the active scheduler

Wall time
    └─ transport/logging/telemetry/PM modal internal RT/execution-window scoring
```

**为什么 `duration_seconds=900` 而时钟跨度是 600s？**

- `duration_seconds=900`：block runner 需要运行 900 真实秒，因为 steak 的 `ongoing_task_event` 排到 t=880。
- 游戏时钟跨度 600s：17:00→18:00 = 60 游戏分钟 × 10s/min。
- 两者目的不同，但原来共用同一个 `tick_num` 推导，导致时钟越界。
- 当前止血：`game_minutes = min(tick_num, 60)`。

**根本问题**：`duration_seconds` 同时承担了两个语义——"block 运行多久"和"时钟走多久"——却没有被明确分离。

**本节具体重构计划**：

- [x] 在 JSON schema 中加 `clock_end_seconds: 600` 字段，与 `duration_seconds` 解耦：
  ```json
  { "duration_seconds": 900, "clock_end_seconds": 600 }
  ```
  Python: `game_minutes = min(game_time_s // GAME_SECONDS_PER_CLOCK_MINUTE, clock_end_seconds // GAME_SECONDS_PER_CLOCK_MINUTE)`
- [x] 新增 `format_game_clock(game_time_s, clock_end_seconds)`，由 backend `time_tick` 统一使用；前端只展示后端给出的 `game_clock`。
- [x] 在 `timeline.py` / 新 `game_clock.py` 顶部加 `GAME_SECONDS_PER_CLOCK_MINUTE = 10`，让 `// 10` 有名字。
- [ ] `duration_seconds` 暂时保留，语义改名/注释为 `block_runtime_seconds` 或 `timeline_end_seconds`；是否删除放到 GameClock 完成后决定，因为当前 tail loop 仍依赖它。
- [x] cooking 不应由 frontend `Date.now()` 驱动。未来如果显示剩余秒数，应由 `deadline_game_time - gameTimeSeconds` 派生；backend timeout 也必须由同一个 `GameClock.sleep_until(deadline_game_time)` 控制。
- [x] `time_tick` payload 建议从 `{ elapsed, game_clock }` 迁移到 `{ game_time_s, game_clock, frozen, clock_end_seconds }`，旧 `elapsed` 可短期保留为兼容字段。
- [ ] 清理命名：frontend `elapsedSeconds` 改名或注释为 `gameTimeSeconds`；backend wall timestamp 字段保留 `*_at`，gameplay schedule 字段使用 `*_game_time`。

7. Frontend avatar movement performance review

- 记录日期：2026-05-03
- 状态：Resolved（frontend build verified，2026-05-03）
- 严重性：P1 高
- 观察：
  - 人物移动时前端明显卡顿。
  - `frontend/src/stores/characterStore.ts` 使用 module-level `requestAnimationFrame` 驱动 movement loop，每帧调用 `_tick()`。
  - `_tick()` 在移动中每帧更新 Zustand store 的 `position` 和 `facing`。
  - `frontend/src/components/game/PlayerAvatar.tsx` 订阅 `position/facing/animation`，用 React render 改 `left/top`。
  - `frontend/src/components/game/FloorPlanView.tsx` 也订阅 `characterStore.position`，仅用于 minimap character dot，但这会拖着整个 FloorPlanView 每帧重渲染。
- 如何发现：
  - 从卡顿症状入手，搜索前端所有 `requestAnimationFrame` / `moveToWaypoint` / `PlayerAvatar` / `useCharacterStore` 订阅点。
  - 对照组件树发现 `position` 是 60fps 高频状态，但被 `FloorPlanView` 这种大型页面组件直接订阅。
  - 检查 `AvatarSprite` 后发现 sprite 帧动画也用 `setInterval + setState` 推进，虽然只有 8fps，但仍会让 React 参与角色动画帧。
  - waypoint 图只有 21 个点、18 条边，BFS pathfinding 不是瓶颈；瓶颈集中在渲染和状态通知。
- 主要根因：
  - 60fps 动画状态放进全局 Zustand，并由 React render 驱动。
  - 大型父组件 `FloorPlanView` 误订阅每帧变化的 `position`，导致 floor plan、厨房 overlay、robot、nav buttons、minimap、dev editor 等一起参与每帧 render。
  - Avatar 位置用 `left/top` 更新，而不是 GPU-friendly 的 `transform: translate3d(...)`。
  - `characterStore` 的 rAF loop 在模块加载时永久启动；生产通常只有一个 loop，但 Vite dev HMR 下如果模块热重载，可能叠加多个 loop。
  - 第一轮修复后，`position` 仍每帧写入 Zustand。即便 React 大组件不再订阅它，Zustand 仍要通知订阅者和执行 selector，对低配机器仍有额外主线程开销。
  - `AvatarSprite` 的帧推进属于纯视觉动画，不应该使用 React state；每次 `setFrame` 都会进入 React render/reconcile 路径。
- 风险：
  - 后续继续把高频动画状态接到页面级组件，会让卡顿越来越难定位。
  - 如果 dev HMR 多 loop 叠加，开发环境会比生产更卡，容易误判性能问题来源。
- 建议修复：
  - [x] 从 `FloorPlanView` 移除 `avatarPosition` 订阅；把 minimap character dot 抽成独立 `MinimapAvatarDot`，并用 ref subscription 直接写 DOM transform，避免每帧 React render。
  - [x] `PlayerAvatar` 改为 `ref + useCharacterStore.subscribe`，直接写 DOM `style.transform = translate3d(...)`，不要每帧 React render。
  - [x] Avatar movement 使用 `transform`，避免 `left/top` 每帧变化。
  - [x] 给 `characterStore` 的 rAF loop 增加按需启动/停止和 HMR cleanup：`import.meta.hot.dispose(() => cancelAnimationFrame(rafId))`。
  - [x] 将移动中的高频 position 从 Zustand store 更新链路移到 lightweight transient position subscribers；store 只在 teleport / stop / waypoint 到达时同步最终位置。
  - [x] 将 `AvatarSprite` 从 `setInterval + setState` 改成 CSS `steps()` sprite sheet animation，避免 React 参与帧推进。
  - [ ] 进一步收敛 `FloorPlanView`：把 minimap、room navigation、robot、station popup、dev waypoint editor 拆成较小组件，避免一个低层状态变化带动整张地图重渲染。
- 已做修复（2026-05-03）：
  - `PlayerAvatar` 不再订阅 `position` 触发 React render；移动时通过父 floorplan 尺寸把 waypoint 百分比转换为像素，写入 `translate3d(...)`，仍跟随父层 zoom transform。
  - `MinimapAvatarDot` 也改为 ref subscription + `translate3d(...)`，移动时不触发 minimap React render。
  - `characterStore` 删除模块加载即永久启动的 rAF loop；现在只在 `moveToWaypoint()` 进入移动状态时启动，路径结束 / teleport / stop 时停止。
  - HMR dispose 时取消未完成的 rAF，避免 Vite dev 下叠加 movement loops。
  - `characterStore` 新增 `subscribeCharacterPosition()` transient subscription。移动过程中只通知需要直接写 DOM transform 的 avatar/minimap；Zustand store 的 `position` 不再每帧更新。
  - `AvatarSprite` 删除 `useState/useEffect/setInterval` 帧推进，改为 CSS keyframes + `steps(frameCount)`；React 只在 `animation/facing/scale` 改变时重新渲染。
  - `index.css` 增加 `avatar-sprite-frames` keyframes，sprite sheet 的最终 background offset 由 CSS variable 注入。
  - `FloorPlanView` 的 zoom transform 从百分比 `translate(...)` 改为根据容器尺寸计算的 device-pixel snapped `translate3d(px)`，减少 pixel-art 背景边缘在缩放/动画重绘时的亚像素重采样抖动。
  - `floorplan.png` 背景图被包进独立 paint/compositing layer，和角色、机器人、门铃、hotspot 等动画层隔离，降低静态背景被动画 sibling 反复重栅格化的概率。
- 解决方案原则：
  - React/Zustand 负责低频语义状态：开始走、停止、朝向变化、到达 waypoint、显示气泡。
  - 高频视觉状态直接走 DOM transform / CSS animation，避免进入 React reconciliation。
  - 会影响 layout 的属性（`left/top`）改为 compositor 友好的 `transform`，降低 layout/repaint 压力。
  - Pixel art 背景尽量固定在稳定 layer 上；父层平移要贴近 device pixel，避免高对比像素边缘落在半个物理像素上。
- Verification:
  - `cd CookingForFriends/frontend && npm run build` 通过。
