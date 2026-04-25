# PM Task Design Summary

> Personal reference document. Includes cutscene storyboards, decoy structure, EC± wording directions, and implementation notes.

---

## Overall Structure

- **4 independent PM tasks**, between-subject (每个被试4个task全同condition: all EC+ or all EC-)
- **Setting**: Saturday evening, player at home preparing dinner, 4 friends arriving
- **Each task**: Encoding cutscene (past episode) → delay (cooking ongoing task) → trigger → reminder (EC+ or EC-) → "I know" button → 6-option decoy → confidence rating
- **Trigger types**: 2 doorbell + 2 phone call
- **Cutscene timing**: ~4 segments × ~15s each ≈ 1 min per task, keep consistent across tasks

---

## Task 1: Mei — 烘焙书

### Narrative Summary
上次去Mei家一起玩游戏、吃你做的点心。Mei觉得好吃问怎么做的，你说是跟着一本烘焙书学的，Mei说也想要一本，你答应给她。今天Mei来吃饭，按门铃到达。

### Encoding Cutscene (4 segments)

| Seg | Content | Key Objects |
|-----|---------|-------------|
| S1 | 你和Mei在她家客厅，沙发前摆着游戏手柄，你们在玩游戏 | 游戏手柄 |
| S2 | 茶几上放着你带来的蛋糕盒子，Mei拿起一块点心吃 | 蛋糕盒子 |
| S3 | Mei说好吃问怎么做的，你说跟着一本烘焙书学的，Mei说也想要一本，你答应给她 | 烘焙书 (target, verbal reference) |
| S4 | 你们继续玩游戏吃点心 | — |

### Task Parameters

| Field | Value |
|-------|-------|
| **Trigger** | Doorbell (Mei到达) |
| **Action** | 交烘焙书给Mei |
| **Target** | 烘焙书 |
| **Distractor (episode-internal)** | 游戏手柄、蛋糕盒子 |
| **EC+ wording direction** | "上次和Mei一起玩游戏吃点心" |
| **EC- wording direction** | "You promised to give Mei something." |
| **EC+ leakage check** | ✓ "玩游戏吃点心" → 无法推断出烘焙书 |

---

## Task 2: Anna/Lina — 巧克力

### Narrative Summary
Anna刚从旅行回来，在学校咖啡厅见面，从礼品袋里拿出给你的明信片和给Lina的巧克力。Anna说今晚聚会不去了，让你帮忙把巧克力转交给Lina。今天Lina按门铃到达。

### Encoding Cutscene (4 segments)

| Seg | Content | Key Objects |
|-----|---------|-------------|
| S1 | 你和Anna在学校咖啡厅坐着，Anna面前放着一个礼品袋，说刚从旅行回来给大家带了东西 | 礼品袋 |
| S2 | Anna从礼品袋里拿出一张明信片递给你，说"这个是给你的" | 明信片 |
| S3 | Anna拿出一盒巧克力，说"这个是给Lina的，她之前说想吃这种。今晚聚会我就不去了，你帮我转交给她。"你答应了 | 巧克力 (target) |
| S4 | 你们继续聊她旅行的事，桌上放着明信片和礼品袋 | — |

### Task Parameters

| Field | Value |
|-------|-------|
| **Trigger** | Doorbell (Lina到达) |
| **Action** | 交巧克力给Lina |
| **Target** | 巧克力 |
| **Distractor (episode-internal)** | 礼品袋、明信片 |
| **EC+ wording direction** | "Anna旅行回来在学校找你" |
| **EC- wording direction** | "You promised to give Lina something." |
| **EC+ leakage check** | ✓ "旅行回来在学校" → 无法推断出巧克力；明信片/礼品袋更像旅行联想 |

### Notes
- Anna本人不出席晚宴（narrative理由：今晚不去了）
- Trigger人物 = Lina（接收者），encoding人物 = Anna（托付者）

---

## Task 3: Tom — 苹果汁

### Narrative Summary
上次和Tom一起露营烧烤，蓝牙音箱放着音乐。Tom从冷藏箱拿苹果汁喝，觉得太冰，说下次来你家吃饭帮他提前把苹果汁从冰箱拿出来回温。今天Tom打电话说快到了。

### Encoding Cutscene (4 segments)

| Seg | Content | Key Objects |
|-----|---------|-------------|
| S1 | 你和Tom在户外露营，烧烤架上烤着东西，旁边蓝牙音箱在放音乐 | 烧烤架、蓝牙音箱 |
| S2 | Tom从冷藏箱拿出一瓶苹果汁，喝了一口，皱眉说太冰了 | 苹果汁 (target) |
| S3 | Tom说"下次去你家吃饭，帮我提前把苹果汁从冰箱拿出来回温。"你答应了 | — |
| S4 | 你们继续烧烤听音乐，Tom把苹果汁放在一边等回温 | — |

### Task Parameters

| Field | Value |
|-------|-------|
| **Trigger** | 电话 (Tom说快到了) |
| **Action** | 从冰箱拿苹果汁出来回温 |
| **Target** | 苹果汁 |
| **Distractor (episode-internal)** | 蓝牙音箱、烧烤架 |
| **EC+ wording direction** | "上次和Tom露营烧烤" |
| **EC- wording direction** | "You promised to do something for Tom." |
| **EC+ leakage check** | ✓ "露营烧烤" → 蓝牙音箱/烧烤架更像直接联想，无法推断苹果汁 |

### Notes
- Tom不安排进门环节，实验结束后再进门
- Action有自然的时间约束理由："提前回温"需要一个时间窗口，电话说快到了 = 该拿出来了

---

## Task 4: 送货员 — 垃圾袋

### Narrative Summary
今天早上在客厅给装饰灯换电池，旧电池拿下来想扔垃圾桶，发现垃圾袋没了。想着等下午送货员打来时记得加一包垃圾袋。先把旧电池放进纸箱里。下午送货员打电话确认订单。

### Encoding Cutscene (4 segments)

| Seg | Content | Key Objects |
|-----|---------|-------------|
| S1 | 你站在客厅，从装饰灯上取下旧电池 | 旧电池 |
| S2 | 你拿着旧电池走到垃圾桶前，打开盖子——里面没有垃圾袋了 | 垃圾袋 (target, absence) |
| S3 | 你想了一下，心想等下午送货员打来要记得加一包垃圾袋 | — |
| S4 | 你把旧电池放进旁边的纸箱里，继续忙 | 纸箱 |

### Task Parameters

| Field | Value |
|-------|-------|
| **Trigger** | 电话 (送货员确认订单) |
| **Action** | 告诉送货员加一包垃圾袋 (手机chat回复) |
| **Target** | 垃圾袋 |
| **Distractor (episode-internal)** | 旧电池、纸箱 |
| **EC+ wording direction** | "今天早上你在家换装饰灯电池" |
| **EC- wording direction** | "You wanted to add something to your delivery order." |
| **EC+ leakage check** | ✓ "换装饰灯电池" → 无法推断出垃圾袋；电池/纸箱更像直接联想 |

### Notes
- Action通过手机chat执行（回复送货员），与平台交互一致
- Encoding episode发生在**今天早上**（非过去某天），时间上最近
- 送货员不是晚宴客人

---

## Decoy Structure (all tasks)

6-option multiple choice per task:
- 1 × target
- 2 × episode-internal distractor (from same encoding cutscene)
- 2 × cross-task items (from other tasks' encoding episodes)
- 1 × unrelated item (TBD)

### Cross-task Item Pool

| Task | Available for other tasks' decoys |
|------|-----------------------------------|
| Mei | 游戏手柄、蛋糕盒子 |
| Anna/Lina | 礼品袋、明信片 |
| Tom | 蓝牙音箱、烧烤架 |
| Task 4 | 旧电池、纸箱 |

### Design Principle
- 被试如果看过所有encoding cutscenes，应能记得cross-task物品属于哪个故事 → 可以排除 → 这就是decoy的设计目的（区分recall vs recognition）
- 没看过video的人仅凭EC+措辞无法推断target → ✓ verified for all 4 tasks

---

## Implementation Notes

### Video/Cutscene Generation
- Art style: tiled 48×48 pixel art + cutscene (对话框 + 场景互动)
- Each task: 4 segments × ~15s ≈ 1 min total
- Keep timing consistent across all 4 tasks
- SVG assets: `preserveAspectRatio="xMidYMid meet"`, `viewBox="400 300"`
- Interactions as HTML overlay with % positioning

### Detail-check Design
- After each segment: detail-check question (确认被试处理了material)
- After all 4 cutscenes: explicit PM intention check

### Trigger Flow
1. Trigger event (doorbell / phone call)
2. Open door / answer phone → greet
3. Reminder displayed (EC+ or EC-)
4. "I know" button
5. 6-option decoy selection
6. Confidence rating (5-point Likert)

### Platform Interaction Differences by Task
| Task | Post-decoy execution |
|------|---------------------|
| Mei | Navigate to room → pick up 烘焙书 → bring to Mei |
| Anna/Lina | Navigate to room → pick up 巧克力 → bring to Lina |
| Tom | Navigate to kitchen → open fridge → take 苹果汁 out |
| Task 4 | Reply to 送货员 in phone chat |

### Fake Triggers
- 保留，防止meta-strategy（被试一看到trigger就知道是PM task）
- 与real trigger同类型混合（doorbell / phone call）

### Recap (Pilot Testing)
- Pilot A: no recap after cutscenes
- Pilot B: brief recap after cutscenes
- TBD based on pilot results
