# ReminderAgent 使用说明

> 离线批量生成实验提示语的流水线工具。基于 2×2 被试间设计（AF × EC），在正式数据采集前运行一次，生成所有任务 × 条件组合的提醒文本变体并存入 SQLite 数据库。

---

## 实验设计概览

| | EC off（无来源信息） | EC on（含来源信息） |
|---|---|---|
| **AF low**（仅动作+物品） | `AF_low_EC_off` | `AF_low_EC_on` |
| **AF high**（含视觉线索/属性/位置） | `AF_high_EC_off` | `AF_high_EC_on` |

- **AF（Attention Features）**：控制提醒文本包含多少物品特征（within-subject）
- **EC（Encoding Context）**：控制是否提及任务来源信息（between-subject）
- **所有 4 个条件均使用 LLM 生成**（不再有模板 Baseline）

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
=== LLM Generation (2 tasks × 4 conditions × 3 variants = 24 total) ===
  ✅ example_book / AF_low_EC_off / v0 (attempt 1)
  ✅ example_book / AF_high_EC_off / v0 (attempt 1)
  ✅ example_book / AF_low_EC_on / v0 (attempt 1)
  ✅ example_book / AF_high_EC_on / v0 (attempt 1)
  ...

=== Summary ===
  Total: 24 attempted, 24 succeeded, 0 failed
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
python -m reminder_agent.stage2.batch_runner --task example_book

# 只生成某个条件
python -m reminder_agent.stage2.batch_runner --condition AF_high_EC_on

# 指定变体数量（覆盖配置文件）
python -m reminder_agent.stage2.batch_runner --n-variants 5

# 清空数据库重新生成
python -m reminder_agent.stage2.batch_runner --clear

# 组合使用：重新生成 example_book 的 AF_low_EC_off 条件，5 个变体
python -m reminder_agent.stage2.batch_runner --task example_book --condition AF_low_EC_off --n-variants 5 --clear

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
  Total reminders : 24
  Approved        : 0
  Pending review  : 24
  Failed QA       : 0

  By condition:
    AF_low_EC_off  : 6
    AF_high_EC_off : 6
    AF_low_EC_on   : 6
    AF_high_EC_on  : 6
```

```bash
# 交互式审核某个任务
python -m reminder_agent.review.review_interface --task example_book

# 只看特定条件
python -m reminder_agent.review.review_interface --condition AF_high_EC_on

# 导出已通过审核的提示语
python -m reminder_agent.review.review_interface --export approved_reminders.json

# 指定数据库路径（非默认位置时使用）
python -m reminder_agent.review.review_interface --db /path/to/reminders.db
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
# 预期: 106 passed
```

---

## 配置文件速查

| 文件 | 作用 |
|------|------|
| `config/model_config.yaml` | 切换 LLM 后端、模型名、温度 |
| `config/generation_config.yaml` | 变体数量、字数限制（8–45 词）、重试次数 |
| `config/condition_field_map.yaml` | 4 个条件各自可见的任务 JSON 字段白名单 |
| `config/forbidden_keywords.yaml` | AF_low 条件不能出现的关键词（按任务） |

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

| 任务 ID | 物品 | 说明 |
|---------|------|------|
| `example_book` | 书 | 含视觉线索（红色封面、山景插图）、位置（书房书架） |
| `example_hanger` | 衣架 | 含视觉线索（木质、金色挂钩）、位置（卧室衣柜） |

> 正式实验任务 JSON 将按同样结构扩展，放入 `data/task_schemas/` 目录。

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
