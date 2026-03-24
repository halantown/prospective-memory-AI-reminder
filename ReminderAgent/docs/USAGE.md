# ReminderAgent 使用说明

> 离线批量生成实验提示语的流水线工具。在正式数据采集前运行一次，生成所有任务 × 条件组合的提醒文本变体并存入 SQLite 数据库。

---

## 快速开始

```bash
conda activate thesis_server
cd ReminderAgent
```

### 1. 验证环境（dry-run，无需 LLM）

```bash
python -m reminder_agent.stage2.batch_runner --dry-run
```

输出示例：
```
=== Phase 1: Baselines (12 tasks) ===
  ✅ b1_book: "Remember to find and bring the book."
  ✅ b1_dish: "Remember to get and bring the baking dish."
  ...

=== Phase 2: LLM Generation (12 tasks × 2 conditions × 3 variants) ===
  ✅ b1_book / AF_only / v0 (attempt 1)
  ✅ b1_book / AF_CB / v0 (attempt 1)
  ...

=== Summary ===
  Baselines : 12 / 12
  Generated : 72 / 72
  Failed    : 0
```

Dry-run 不调用 LLM，不写入数据库，用于检查配置和任务 JSON 是否完整。

---

## 正式生成

### 前提条件

配置文件 `reminder_agent/config/model_config.yaml` 选择 LLM 后端：

| 后端 | 说明 | 所需准备 |
|------|------|---------|
| `ollama`（默认） | 本地模型 | `ollama serve` + `ollama pull llama3.1` |
| `together` | 云端 | 设置 `TOGETHER_API_KEY` |
| `openai` | 云端 | 设置 `OPENAI_API_KEY` |
| `anthropic` | 云端 | 设置 `ANTHROPIC_API_KEY` |

### 生成全部提示语（生产用）

```bash
# 先修改 generation_config.yaml: n_variants: 10
python -m reminder_agent.stage2.batch_runner
```

输出写入 `reminder_agent/output/reminders.db`。

### 常用选项

```bash
# 只生成某个任务
python -m reminder_agent.stage2.batch_runner --task b1_book

# 只生成某个条件
python -m reminder_agent.stage2.batch_runner --condition AF_only

# 指定变体数量（覆盖配置文件）
python -m reminder_agent.stage2.batch_runner --n-variants 5

# 清空数据库重新生成
python -m reminder_agent.stage2.batch_runner --clear

# 组合使用：重新生成 b2_vinyl 的 AF_CB 条件，5 个变体
python -m reminder_agent.stage2.batch_runner --task b2_vinyl --condition AF_CB --n-variants 5 --clear

# 详细日志
python -m reminder_agent.stage2.batch_runner --verbose
```

---

## 查看 & 人工审核

```bash
# 查看统计信息
python -m reminder_agent.review.review_interface --stats
```

输出示例：
```
=== Review Statistics ===
  Total reminders : 84
  Approved        : 0
  Pending review  : 84
  Failed QA       : 0

  By condition:
    Baseline : 12
    AF_only  : 36
    AF_CB    : 36
```

```bash
# 交互式审核某个任务
python -m reminder_agent.review.review_interface --task b1_book

# 只看特定条件
python -m reminder_agent.review.review_interface --condition AF_CB

# 导出已通过审核的提示语
python -m reminder_agent.review.review_interface --export approved_reminders.json

# 指定数据库路径（非默认位置时使用）
python -m reminder_agent.review.review_interface --db /path/to/reminders.db
```

---

## 只生成 Baseline（模板文本）

Baseline 为固定模板，不依赖 LLM，可单独调用：

```python
from reminder_agent.stage2.baseline_generator import generate_all_baselines, load_all_task_jsons

tasks = load_all_task_jsons()
baselines = generate_all_baselines(tasks)

for task_id, text in baselines.items():
    print(f"{task_id}: {text}")
```

输出：
```
b1_book: "Remember to find and bring the book."
b1_dish: "Remember to get and bring the baking dish."
b2_vinyl: "Remember to find and place the vinyl record."
...
```

---

## Stage 1：从源文本提取任务 JSON（演示）

```bash
python -m reminder_agent.stage1.demo_run
```

输出示例（使用 `doctor_email.txt`）：
```
=== Stage 1 Demo: Information Extraction ===
Source: doctor_email.txt
Type: Doctor's prescription email
Method: Rule-based (no LLM)

--- Extracted Task JSON ---
{
  "reminder_context": {
    "element1": {
      "action_verb": "take",
      "target_entity": { "entity_name": "Doxycycline", ... },
      "location": { "room": "kitchen", "spot": "shelf" }
    },
    "element2": {
      "origin": { "creator_is_authority": true },
      ...
    }
  }
}
--- Confidence: 1.0 ---
```

---

## 运行测试

```bash
cd ReminderAgent
pytest reminder_agent/tests -v
# 预期: 129 passed
```

---

## 配置文件速查

| 文件 | 作用 |
|------|------|
| `config/model_config.yaml` | 切换 LLM 后端、模型名、温度 |
| `config/generation_config.yaml` | 变体数量、字数限制、重试次数 |
| `config/condition_field_map.yaml` | 各条件可见的任务 JSON 字段白名单 |
| `config/forbidden_keywords.yaml` | Low-AF 条件不能出现的词汇 |

### 切换到云端 LLM

编辑 `config/model_config.yaml`：

```yaml
backend: "openai"
model_name: "gpt-4o-mini"
api_key_env: "OPENAI_API_KEY"
```

然后：

```bash
export OPENAI_API_KEY=sk-...
python -m reminder_agent.stage2.batch_runner --dry-run  # 先验证
python -m reminder_agent.stage2.batch_runner
```

### 增加变体数量（正式数据采集用）

编辑 `config/generation_config.yaml`：

```yaml
n_variants: 10   # 从 3 改为 10
```

---

## 任务 ID 对照表

| Block | 任务 ID | 物品 |
|-------|---------|------|
| B1 | `b1_book` | 书 |
| B1 | `b1_dish` | 烤盘 |
| B1 | `b1_giftbag` | 礼品袋 |
| B1 | `b1_soap` | 洗手液 |
| B2 | `b2_vinyl` | 黑胶唱片 |
| B2 | `b2_napkinrings` | 餐巾环 |
| B2 | `b2_pot` | 花盆 |
| B2 | `b2_softener` | 柔顺剂 |
| B3 | `b3_hanger` | 衣架 |
| B3 | `b3_speaker` | 蓝牙音箱 |
| B3 | `b3_vase` | 花瓶 |
| B3 | `b3_handcream` | 护手霜 |

---

## 数据库结构（参考）

`reminders.db` 由 `OutputStore` 自动创建，包含两张表：

```sql
-- 生成的提示语
SELECT task_id, condition, variant_idx, text, quality_passed, human_approved
FROM reminders;

-- 生成日志（成功 / 失败记录）
SELECT task_id, condition, status, error_msg, created_at
FROM generation_log;
```

---

## 完整工作流

```
1. 配置 LLM         → config/model_config.yaml
2. 设置变体数       → config/generation_config.yaml (n_variants: 10)
3. 验证环境         → python -m reminder_agent.stage2.batch_runner --dry-run
4. 正式生成         → python -m reminder_agent.stage2.batch_runner
5. 人工审核         → python -m reminder_agent.review.review_interface
6. 导出结果         → python -m reminder_agent.review.review_interface --export reminders.json
7. SaturdayAtHome 使用 reminders.db 在实验中按 (task_id, condition) 查询并随机选取变体
```
