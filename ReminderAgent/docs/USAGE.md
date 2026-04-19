# ReminderAgent 使用说明

> 离线批量生成实验提示语的流水线工具。基于纯 EC 操作化设计（EC_off / EC_on），在正式数据采集前运行一次，生成所有任务 × 条件组合的提醒文本变体并存入 SQLite 数据库。

---

## 这次更新做了什么

### v3 EC 操作化迁移（最新）

- **实验设计简化**：从 2×2 AF×EC（4 条件）迁移到纯 EC 操作化（2 条件：`EC_off` / `EC_on`）
- **新增 v3 任务 JSON 字段**：`baseline`（action_verb / target / recipient）、`episode_dimensions`（5 维度）、`ec_selected_features`（entity + causality）、`ec_priority_dimensions`
- **Prompt 重写**：
  - EC_off：仅含 baseline，≤12 词，单句
  - EC_on：encoding context paraphrase + baseline，≤25 词
- **Quality Gate 重写**：新增 `check_baseline_present`、`check_ec_features_present`、`check_no_extra_dimensions`、`check_no_fabrication`
- **Config 简化**：`condition_field_map.yaml` 改为 `visible_fields` 格式；`generation_config.yaml` 新增 per-condition `word_limits`
- **Output Store**：新增 `ec_dimensions_used` 列
- **测试全部重写**：90 tests passed

### 此前更新

- Prompt 强化 & Quality Gate 收紧：禁止连字符压缩、长度校准示例等
- ec_cue 重构：替代 creation_context 作为 EC 来源
- v1 → v2 任务 JSON 迁移：element1_af / element2_ec / element3_excluded 结构
- 独立 4 任务集合：book1_mei、ticket_jack、tea_benjamin、dessert_sophia

---

## 实验设计概览（v3）

| 条件 | 说明 | 词数限制 |
|------|------|---------|
| `EC_off` | 仅 baseline（动作 + 目标 + 接收人） | 5–12 词 |
| `EC_on` | baseline + encoding context features（entity + causality） | 12–25 词 |

- **EC（Encoding Context）**：控制是否在提醒中包含编码情境信息（between-subject）
- **理论基础**：Situation Model（Zwaan & Radvansky, 1998）的 5 个维度（time, space, entity, causality, intentionality），EC_on 使用 entity + causality
- **AF 代码保留**：v2 的 AF 字段和逻辑保留在代码中但不再使用

---

## 快速开始

```bash
conda activate thesis_server
cd ReminderAgent
```

### 1. 验证环境（dry-run，无需 LLM）

```bash
python -m reminder_agent.stage2.batch_runner --dry-run --clear
```

输出示例：
```
=== LLM Generation (4 tasks × 2 conditions × 3 variants = 24 total) ===
  ✅ book1_mei / EC_off / v0 (attempt 1)
  ✅ book1_mei / EC_on / v0 (attempt 1)
  ...

=== Summary ===
  Total: 24 attempted, 24 succeeded, 0 failed
```

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
python -m reminder_agent.stage2.batch_runner --task book1_mei

# 只生成某个条件
python -m reminder_agent.stage2.batch_runner --condition EC_on

# 指定变体数量（覆盖配置文件）
python -m reminder_agent.stage2.batch_runner --n-variants 5

# 清空数据库重新生成
python -m reminder_agent.stage2.batch_runner --clear

# 组合使用
python -m reminder_agent.stage2.batch_runner --task book1_mei --condition EC_off --n-variants 5 --clear

# 详细日志
python -m reminder_agent.stage2.batch_runner --verbose
```

---

## 查看 & 人工审核

```bash
# 查看统计信息
python -m reminder_agent.review.review_interface --stats

# 交互式审核某个任务
python -m reminder_agent.review.review_interface --task book1_mei

# 导出已通过审核的提示语
python -m reminder_agent.review.review_interface --export approved_reminders.json
```

---

## 运行测试

```bash
cd ReminderAgent
pytest reminder_agent/tests -v
# 预期: 90 passed
```

---

## 配置文件速查

| 文件 | 作用 |
|------|------|
| `config/model_config.yaml` | 切换 LLM 后端、模型名、温度 |
| `config/generation_config.yaml` | 变体数量、per-condition 字数限制、重试次数 |
| `config/condition_field_map.yaml` | 2 个 EC 条件各自可见的任务 JSON 字段白名单 |

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
python -m reminder_agent.stage2.batch_runner --dry-run
python -m reminder_agent.stage2.batch_runner
```

---

## 任务 ID 对照表

| 任务 ID | 物品 | EC Features | 说明 |
|---------|------|-------------|------|
| `book1_mei` | 烘焙书（给Mei） | entity: Mei, baking book; causality: liked & wanted to borrow | 红色封面、Erta Ale |
| `ticket_jack` | 戏剧票（给Jack） | entity: Jack, theatre tickets; causality: bought tickets & asked to hold | 两张票 |
| `tea_benjamin` | 茶（给Benjamin） | entity: Benjamin, tea; causality: brought tea from England | 红金色锡罐、英国品牌 |
| `dessert_sophia` | 蛋挞（给Sophia） | entity: Sophia, egg tart; causality: craving & asked to prepare | 酥皮、金色蛋液 |

---

## 数据库结构（参考）

`reminders.db` 由 `OutputStore` 自动创建，包含两张表：

```sql
-- 生成的提示语
SELECT task_id, condition, variant_idx, text, passed_quality_gate,
       ec_dimensions_used
FROM reminders;

-- 生成日志
SELECT task_id, condition, variant_idx, attempt, quality_gate_passed
FROM generation_log;
```

---

## 完整工作流

```
1. 配置 LLM         → config/model_config.yaml
2. 设置变体数       → config/generation_config.yaml (n_variants: 10)
3. 验证环境         → python -m reminder_agent.stage2.batch_runner --dry-run --clear
4. 正式生成         → python -m reminder_agent.stage2.batch_runner --clear
5. 人工审核         → python -m reminder_agent.review.review_interface
6. 导出结果         → python -m reminder_agent.review.review_interface --export reminders.json
7. SaturdayAtHome 使用 reminders.db 按 (task_id, condition) 查询并随机选取变体
```
