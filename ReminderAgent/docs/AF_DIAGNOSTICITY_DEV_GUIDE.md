# AF Diagnosticity Analysis — Development Guide

> **Version**: 0.1 | **Date**: 2026-03-31 | **Prerequisite**: Read SUMMARY_M1.md + AGENT_DEV_GUIDE S5-7.md
> **Purpose**: Add diagnosticity-based cue selection to the AF operationalization pipeline
> **Model**: Qwen (百炼 API) for development, switch to local Ollama when stable

---

## 1. What This Guide Does

This guide adds a **diagnosticity analysis layer** between your task JSON design and the existing reminder generation pipeline. The goal: systematically decide which cues from the encoding material should appear in AF reminders, based on how well each cue discriminates the target from distractors.

### Before (current state)

```
Task JSON (hand-authored cues) → context_extractor → prompt_constructor → LLM → reminder text
                                                      ↑
                                        visual cue selection is implicit,
                                        no documented rationale
```

### After (new state)

```
Task JSON (2 distractors) → diagnosticity_analyzer → diagnosticity report (YAML)
                                                          ↓ (human review)
                                                     approved report
                                                          ↓
Task JSON → context_extractor → prompt_constructor (now cue-priority-aware) → LLM → reminder text
```

---

## 2. Theory Summary (for prompt context)

The diagnosticity analysis implements a 4-layer theoretical framework:

**L1 — PM Associative Memory**: Intention is encoded as a holistic associative network.

**L2 — Encoding Specificity Principle**: Only features explicitly presented during encoding are legitimate cue candidates.

```
C_AF = { c | c ∈ explicitly presented encoding material }
```

**L3 — Cue Diagnosticity × Fan Effect**: Among legitimate candidates, select those that most uniquely point to the target.

```
D(c) = A(c → target) / Σ A(c → t_i)
```

where t_i includes the target plus all competing items (distractors + other active PM tasks in the same block). Higher D means the cue is more diagnostic.

**L4 — AF Operationalization**: The reminder includes the top-diagnosticity cues from C_AF.

**Key references** (include in prompts when relevant):

- Anderson, J. R. (1974). Retrieval of propositional information from long-term memory.
- Cook, G. I., Marsh, R. L., Hicks, J. L., & Martin, B. A. (2006). Fan effects in event-based PM.
- Nairne, J. S. (2002). The myth of the encoding-retrieval match.
- Tulving, E., & Thomson, D. M. (1973). Encoding specificity and retrieval processes.

---

## 3. Schema Migration: 1 → 2 Distractors

### 3.1 New `distractor_info` Schema

Replace the current single-distractor structure in `agent_reasoning_context`:

**Current (single distractor):**

```json
"distractor_info": {
  "distractor_description": "Red paperback with ocean landscape illustration, titled Blue Horizon, same shelf",
  "discriminating_dimension": "cover illustration (mountain vs ocean)"
}
```

**New (two distractors):**

```json
"distractor_info": {
  "distractors": [
    {
      "id": "d1",
      "description": "Red paperback with wave icon on cover, titled Blue Horizon",
      "shared_features_with_target": ["color: red", "format: paperback", "location: same shelf"],
      "distinguishing_features": ["cover_icon: wave (not mountain)", "title: Blue Horizon"]
    },
    {
      "id": "d2",
      "description": "Blue paperback with mountain icon on cover, titled Erta Ale",
      "shared_features_with_target": ["cover_icon: mountain", "title: Erta Ale", "format: paperback", "location: same shelf"],
      "distinguishing_features": ["color: blue (not red)"]
    }
  ],
  "target_unique_conjunction": "red + mountain icon — only the target has both"
}
```

**Design principle for the two distractors**: Each distractor should share one or more salient features with the target but differ on at least one other. This forces the participant to use a **conjunction** of features (not a single feature) to identify the correct item. In the b1_book example:

- d1 shares **color** (red) with target, but differs on **cover icon** (wave vs mountain) and **title**
- d2 shares **cover icon** (mountain) AND **title** (Erta Ale) with target, but differs on **color** (blue vs red)
- Only the target has **both** red + mountain
- Note: d2 sharing the title is intentional — it prevents title alone from being a reliable discriminator, forcing reliance on visual features

### 3.2 Migration: Extraction from Frontend (Completed)

> **Status**: ✅ Completed 2026-03-31 — all 12 task JSONs migrated.

The 2-distractor design was already fully implemented in the frontend game
(`CookingForFriends/frontend/src/components/game/items/RoomItems.tsx`), where
each task has Target + D1 + D2 as SVG components with explicit 2-dimensional
conjunction logic. Variant images are exported in `encoding/variants/`.

**What was done**: Extracted D1/D2 feature descriptions from `RoomItems.tsx`
component comments and SVG parameters, then populated the new `distractor_info`
schema in all 12 task JSONs. No AI generation was needed — this was a data
synchronization from frontend → task JSON.

**Future enhancement — VLM-based feature extraction**: For richer feature sets
(e.g., discovering visual details not captured in text descriptions), a VLM
pipeline can be added:

1. Feed each variant image from `encoding/variants/` to a VLM
2. Have the VLM extract structured visual features per item
3. Diff features across Target/D1/D2 to auto-populate `shared_features_with_target`
   and `distinguishing_features`
4. Human review the VLM output for accuracy

This is tracked as an optional Phase 4 enhancement (§9). The current
manually-extracted features are sufficient for the diagnosticity analysis pipeline.

### 3.3 Updated `confirmation_question`

After adding d2, also update the `confirmation_question` to have 3 options corresponding to the target + d1 + d2. The current questions already have 3 options; during migration `b1_giftbag` was updated so its options now map to d1/target/d2 (was: "Medium bag with ribbon" → now: "Small bag with ribbon" for d1, "Medium bag with bow" for d2). Other tasks' options were verified to already represent the relevant distractor features.

### 3.4 Affected Tests

After migration, update `test_task_schemas.py`:

- Add check: `distractor_info.distractors` is a list of length 2
- Add check: each distractor has `id`, `description`, `shared_features_with_target`, `distinguishing_features`
- Add check: `target_unique_conjunction` is present and non-empty

---

## 4. New Module: `diagnosticity_analyzer.py`

### 4.1 Location

```
reminder_agent/
  stage2/
    diagnosticity_analyzer.py    ← NEW
  data/
    diagnosticity/               ← NEW (output directory)
      b1_book.yaml
      b1_dish.yaml
      ...
```

### 4.2 What It Does

For each PM trial, it:

1. Extracts all presented features from encoding material (L2: candidate set)
2. Assesses each feature's diagnosticity at two levels (L3)
3. Recommends which features to include in the AF reminder (L4)
4. Optionally uses VLM to extract additional visual features from encoding images

### 4.3 Diagnosticity Assessment: Two Levels

**Level A — Task discrimination**: Can this cue help the participant remember WHICH task to do?

- Competitors: the other 3 PM tasks in the same block
- A cue is diagnostic at Level A if it uniquely identifies this task among all active tasks
- Example: "book" is diagnostic if no other task in the block involves a book

**Level B — Object discrimination**: Can this cue help the participant pick the RIGHT object?

- Competitors: the 2 distractors in the execution environment
- A cue is diagnostic at Level B if it distinguishes the target from distractors
- Example: "mountain landscape cover" is diagnostic if neither distractor has a mountain cover

**Combined assessment**:

- HIGH: diagnostic at both levels (or highly diagnostic at one, adequate at the other)
- MEDIUM: diagnostic at one level only
- LOW: diagnostic at neither level (shared across tasks AND shared with distractors)

### 4.4 Output Schema: Diagnosticity Report

Each report is a YAML file stored in `data/diagnosticity/`:

```yaml
# data/diagnosticity/b1_book.yaml
task_id: b1_book
analysis_version: "0.1"
model_used: "qwen-max"
analyzed_at: "2026-03-31T12:00:00Z"
review_status: pending  # pending | approved | rejected

# L2: Candidate set (all presented features from encoding material)
candidate_features:
  - feature_id: f1
    feature: "red cover"
    source: "encoding_text + encoding_image"
    feature_type: visual_color

  - feature_id: f2
    feature: "mountain landscape illustration"
    source: "encoding_text + encoding_image"
    feature_type: visual_pattern

  - feature_id: f3
    feature: "titled Erta Ale"
    source: "encoding_text"
    feature_type: domain_property

  - feature_id: f4
    feature: "paperback"
    source: "encoding_text"
    feature_type: domain_property

  - feature_id: f5
    feature: "second shelf of the bookcase"
    source: "encoding_text"
    feature_type: location

  - feature_id: f6
    feature: "study room"
    source: "encoding_text"
    feature_type: location

# L3: Diagnosticity assessment
diagnosticity:
  - feature_id: f1
    level_a_task_discrimination:
      rating: medium
      reasoning: "Only this task involves a red object in Block 1, but 'red' is a common color that could be confused with other encoding memories"
    level_b_object_discrimination:
      rating: medium
      reasoning: "d1 is also red (shared), but d2 is blue (distinguished). Partially diagnostic."
    combined_rating: medium

  - feature_id: f2
    level_a_task_discrimination:
      rating: high
      reasoning: "No other task in Block 1 involves a mountain illustration"
    level_b_object_discrimination:
      rating: medium
      reasoning: "d1 has ocean landscape (distinguished), but d2 also has mountain landscape (shared). Partially diagnostic."
    combined_rating: high

  - feature_id: f3
    level_a_task_discrimination:
      rating: high
      reasoning: "Unique title, not shared with any other task in the block"
    level_b_object_discrimination:
      rating: medium
      reasoning: "d2 also displays 'Erta Ale' on the cover — title alone does not discriminate"
    combined_rating: medium

  - feature_id: f4
    level_a_task_discrimination:
      rating: low
      reasoning: "Format info doesn't distinguish between tasks"
    level_b_object_discrimination:
      rating: low
      reasoning: "All three items are paperbacks"
    combined_rating: low

  - feature_id: f5
    level_a_task_discrimination:
      rating: medium
      reasoning: "Location helps identify which room to go to"
    level_b_object_discrimination:
      rating: low
      reasoning: "All items are on the same shelf"
    combined_rating: low

  - feature_id: f6
    level_a_task_discrimination:
      rating: medium
      reasoning: "Room identifies where to go, but location is already in the task structure"
    level_b_object_discrimination:
      rating: low
      reasoning: "All items in same room"
    combined_rating: low

# L4: Recommended cue set for AF reminder
recommended_cues:
  include:
    - feature_id: f1
      priority: 1
      reason: "Essential conjunction member — eliminates d2 (blue)"
    - feature_id: f2
      priority: 1
      reason: "Essential conjunction member — eliminates d1 (wave icon)"
    - feature_id: f3
      priority: 3
      reason: "Aids task-level recall (Level A), but shared with d2 at object level"
    - feature_id: f5
      priority: 4
      reason: "Location aids navigation (standard inclusion)"
  exclude:
    - feature_id: f4
      reason: "Low diagnosticity at both levels — all items are paperbacks"
    - feature_id: f6
      reason: "Redundant with f5 (room already implied by location spot)"

# Target unique conjunction (from distractor_info)
target_conjunction: "red + mountain landscape"
minimum_cues_for_discrimination: ["f1", "f2"]
```

### 4.5 Module Interface

```python
"""Diagnosticity analyzer — assesses cue diagnosticity for AF reminder design.

This is an OFFLINE analysis tool. Run it once per task, review the output,
then use approved reports to guide AF reminder generation.

Usage:
    python -m reminder_agent.stage2.diagnosticity_analyzer [--task TASK_ID] [--all] [--use-vlm]
"""

def analyze_task(
    task_json: dict,
    block_tasks: list[dict],  # other tasks in the same block (for Level A)
    backend: LLMBackend,
    vlm_backend: LLMBackend | None = None,  # optional VLM for image analysis
    encoding_image_path: Path | None = None,
) -> dict:
    """Run diagnosticity analysis for a single task.
  
    Args:
        task_json: Full task JSON with all 3 zones.
        block_tasks: Other PM tasks in the same block (for Level A comparison).
        backend: Text LLM for reasoning.
        vlm_backend: Optional VLM for analyzing encoding images.
        encoding_image_path: Path to the encoding image file.
  
    Returns:
        Diagnosticity report dict (matches YAML schema above).
    """
    ...


def analyze_all_tasks(
    backend: LLMBackend,
    vlm_backend: LLMBackend | None = None,
    image_dir: Path | None = None,
) -> dict[str, dict]:
    """Run diagnosticity analysis for all 12 tasks.
  
    Groups tasks by block for Level A analysis.
    Returns {task_id: report_dict}.
    """
    ...


def save_report(report: dict, output_dir: Path | None = None) -> Path:
    """Save diagnosticity report to YAML file."""
    ...


def load_report(task_id: str, report_dir: Path | None = None) -> dict:
    """Load a diagnosticity report from YAML."""
    ...
```

---

## 5. LLM Prompts for Diagnosticity Analysis

### 5.1 Feature Extraction Prompt (L2: Candidate Set)

```
You are analyzing encoding materials for a prospective memory experiment.

TASK: Extract ALL visual, physical, and identifying features that a participant
would perceive when reading the encoding card below.

ENCODING TEXT:
{encoding_text}

RULES:
1. Only extract features that are EXPLICITLY stated or shown.
   Do NOT infer features (e.g., don't infer "antibiotic" from "Doxycycline").
2. Categorize each feature:
   - visual_color: colors mentioned
   - visual_pattern: illustrations, patterns, designs
   - visual_shape: shape descriptions
   - visual_size: size descriptions
   - domain_property: specific identifying properties (title, name, material, scent)
   - location: where the item is
3. Quote the exact phrase from the encoding text for each feature.

OUTPUT FORMAT (JSON only, no explanation):
{
  "features": [
    {
      "feature_id": "f1",
      "feature": "red cover",
      "source": "encoding_text",
      "feature_type": "visual_color",
      "exact_quote": "It is a red paperback"
    }
  ]
}
```

### 5.2 VLM Feature Extraction Prompt (optional, for encoding images)

```
You are analyzing an image from a prospective memory experiment.
This image shows a target object that participants will need to find later.

TASK: List ALL visual features you can observe in this image that could help
someone identify this specific object. Focus on:
- Colors (exact shades if distinguishable)
- Patterns, illustrations, or decorations
- Shape and size relative to surroundings
- Text or labels visible
- Material or texture
- Any other visually distinctive features

IMPORTANT: Only describe what you can SEE. Do not infer function or category.

OUTPUT FORMAT (JSON only):
{
  "image_features": [
    {
      "feature": "description of visual feature",
      "feature_type": "visual_color | visual_pattern | visual_shape | visual_size | visual_text | visual_material",
      "salience": "high | medium | low"
    }
  ]
}
```

### 5.3 Diagnosticity Assessment Prompt (L3)

This is the core prompt. It receives the candidate features, distractor info, and block context.

```
You are assessing CUE DIAGNOSTICITY for a prospective memory experiment.

THEORY: A cue's diagnosticity D(c) is the ratio of activation it sends to the
target versus all competing items. High D means the cue uniquely identifies the target.
(Nairne, 2002; Cook et al., 2006 — fan effect in event-based PM)

TASK: Assess each candidate feature at TWO levels of discrimination.

TARGET ENTITY:
{target_entity JSON}

DISTRACTORS (items the participant must distinguish the target from):
{distractors JSON}

OTHER TASKS IN THIS BLOCK (for task-level discrimination):
{block_tasks_summary — list of entity_name + visual cue for each other task}

CANDIDATE FEATURES:
{features JSON from L2 extraction}

For EACH feature, assess:

LEVEL A — TASK DISCRIMINATION:
- Question: "If the participant only heard this one cue, could they tell which PM task it refers to?"
- Competitors: the other {N} PM tasks listed above
- Rate: high (uniquely identifies this task) / medium (narrows to 2-3 tasks) / low (common across tasks)

LEVEL B — OBJECT DISCRIMINATION:
- Question: "If the participant is in the room looking at 3 objects (target + 2 distractors),
  does this cue help them pick the right one?"
- Competitors: d1 and d2 above
- Rate: high (excludes both distractors) / medium (excludes one distractor) / low (shared with both)

COMBINED RATING:
- HIGH: high at both levels, OR high at one + medium at the other
- MEDIUM: medium at both, OR high at one + low at the other
- LOW: low at both levels

OUTPUT FORMAT (JSON only, no explanation):
{
  "diagnosticity": [
    {
      "feature_id": "f1",
      "level_a": {"rating": "high|medium|low", "reasoning": "one sentence"},
      "level_b": {"rating": "high|medium|low", "reasoning": "one sentence"},
      "combined": "HIGH|MEDIUM|LOW"
    }
  ],
  "recommended_include": ["f1", "f2"],
  "recommended_exclude": ["f4"],
  "target_conjunction": "the minimal set of features that uniquely identifies the target",
  "minimum_cues_for_discrimination": ["f1", "f2"]
}
```

---

## 6. Integration with Existing Pipeline

### 6.1 How Diagnosticity Reports Feed into Prompt Construction

The diagnosticity report does NOT change `condition_field_map.yaml` or `context_extractor.py`.
Instead, it informs `prompt_constructor.py` about **which features to emphasize**.

**Current prompt_constructor behavior**: It passes ALL fields from the pruned context to the LLM
equally — visual cue, domain properties, location — with no priority weighting.

**New behavior**: When a diagnosticity report is available, the user prompt includes
a **cue priority annotation**:

```python
def build_user_prompt(
    pruned_context: dict,
    prior_variants: list[str] | None = None,
    context_format: str = "prose",
    diagnosticity_report: dict | None = None,  # NEW parameter
) -> str:
```

When `diagnosticity_report` is provided, append to the user prompt:

```
CUE PRIORITY (based on diagnosticity analysis):
  MUST include (high diagnosticity): mountain landscape illustration, titled Erta Ale
  SHOULD include (medium): red cover
  MAY omit (low diagnosticity): paperback format
  
The reminder MUST contain at least the high-priority cues. Include medium-priority
cues if they fit naturally within the word limit.
```

### 6.2 Updated System Prompt for AF Conditions

Add to the AF system prompt rules:

```
9. When CUE PRIORITY is provided, you MUST include all high-priority cues.
   Include medium-priority cues when they fit naturally.
   Do NOT include low-priority cues unless needed for grammatical completeness.
```

### 6.3 Quality Gate Addition

Add a new check to `quality_gate.py`:

```python
def check_cue_priority_compliance(
    text: str,
    diagnosticity_report: dict,
) -> CheckResult:
    """Check that high-priority cues from diagnosticity report appear in the text."""
    if diagnosticity_report is None:
        return CheckResult("cue_priority", True, "No diagnosticity report — skipped")
  
    high_priority = [
        f for f in diagnosticity_report.get("recommended_cues", {}).get("include", [])
        if f.get("priority", 99) <= 2  # priority 1 and 2 are mandatory
    ]
  
    missing = []
    for cue in high_priority:
        # Check if any key term from the feature appears in the text
        feature_text = cue.get("feature", "").lower()
        key_terms = [t.strip() for t in feature_text.split() if len(t.strip()) > 3]
        if not any(term in text.lower() for term in key_terms):
            missing.append(cue["feature_id"])
  
    if missing:
        return CheckResult("cue_priority", False, f"Missing high-priority cues: {missing}")
    return CheckResult("cue_priority", True)
```

---

## 7. VLM Integration (Optional Enhancement)

### 7.1 When to Use VLM

VLM analysis is **additive** — it may discover visual features in the encoding image
that are not captured in the text description. Use it when:

- encoding images exist (they do for all 12 tasks)
- you want to verify that text descriptions are complete
- you want to discover features the text missed (e.g., "the bottle has a curved handle")

VLM is NOT required for the core diagnosticity analysis. The text-based analysis
using encoding_text + distractor descriptions is sufficient.

### 7.2 VLM Backend Configuration

Add to `model_config.yaml` (optional section):

```yaml
# VLM for image analysis (optional)
vlm_backend: "openai"  # or "anthropic" or "qwen-vl"
vlm_model_name: "qwen-vl-max"
vlm_base_url: "https://dashscope.aliyuncs.com/compatible-mode/v1"
vlm_api_key_env: "THESIS_API_KEY"
```

### 7.3 VLM Call Pattern

```python
def extract_image_features(image_path: Path, vlm_backend: LLMBackend) -> list[dict]:
    """Use VLM to extract visual features from encoding image.
  
    The VLM receives the image + the VLM feature extraction prompt (§5.2).
    Its output is merged with text-extracted features, with duplicates removed.
    """
    # Read image, encode as base64
    # Call VLM with image + prompt
    # Parse JSON output
    # Return list of image_features
    ...
```

---

## 8. CLI Interface

```bash
# Analyze a single task
python -m reminder_agent.stage2.diagnosticity_analyzer --task b1_book

# Analyze all tasks
python -m reminder_agent.stage2.diagnosticity_analyzer --all

# With VLM (requires images in data/encoding_images/)
python -m reminder_agent.stage2.diagnosticity_analyzer --all --use-vlm

# Review mode: show existing reports
python -m reminder_agent.stage2.diagnosticity_analyzer --review

# Output goes to data/diagnosticity/b1_book.yaml etc.
```

---

## 9. Development Sequence

### Phase 1: Schema Migration ✅ (completed 2026-03-31)

1. ~~Define new distractor_info schema (§3.1)~~
2. ~~Extract D1/D2 from RoomItems.tsx into all 12 task JSONs (§3.2)~~
3. Human review each migration (verify conjunction is correct) ← **next step**
4. Update test_task_schemas.py

### Phase 2: Core Diagnosticity Analyzer

1. Implement `diagnosticity_analyzer.py` with text-only analysis
2. Run on all 12 tasks using Qwen via 百炼 API
3. Human review all 12 diagnosticity reports
4. Iterate on prompts if quality is poor

### Phase 3: Pipeline Integration

1. Add `diagnosticity_report` parameter to `prompt_constructor.build_user_prompt()`
2. Add `check_cue_priority_compliance` to `quality_gate.py`
3. Update `batch_runner.py` to load approved diagnosticity reports
4. Re-run batch generation with diagnosticity-aware prompts

### Phase 4: VLM Enhancement (optional)

1. Add VLM backend configuration
2. Implement `extract_image_features()`
3. Merge VLM-extracted features with text features
4. Re-run diagnosticity analysis to check for missed features

---

## 10. Block Assignment Reference

For Level A (task discrimination), the analyzer needs to know which tasks
are in the same block. Current assignment:

| Block | Tasks                                         |
| ----- | --------------------------------------------- |
| B1    | b1_book, b1_giftbag, b1_dish, b1_soap         |
| B2    | b2_vinyl, b2_napkinrings, b2_pot, b2_softener |
| B3    | b3_hanger, b3_speaker, b3_vase, b3_handcream  |

This is used in the Level A assessment: a cue's task-discrimination is evaluated
against the other 3 tasks in the same block, not all 12 tasks.

---

## 11. Example: Full Analysis for b1_book

### Input

- **Encoding text**: "Your friend Mei asked to borrow a travel book. When Mei arrives, go to the study and find the book on the second shelf of the bookcase. It is a red paperback with a mountain illustration on the cover, titled Erta Ale. Bring it to the living room and give it to Mei."
- **Target**: Red cover + mountain icon + "Erta Ale", second shelf, study
- **d1**: Red cover + wave icon + "Blue Horizon", same shelf (shares color with target)
- **d2**: Blue cover + mountain icon + "Erta Ale", same shelf (shares icon AND title with target)
- **Block peers**: b1_giftbag (small blue bag), b1_dish (oval white ceramic dish), b1_soap (white pump bottle)

### Expected Analysis

| Feature         | Level A (task disc.)            | Level B (object disc.)                 | Combined | Include?                  |
| --------------- | ------------------------------- | -------------------------------------- | -------- | ------------------------- |
| red cover       | medium (only red item in block) | medium (shared with d1, eliminates d2) | MEDIUM   | yes — conjunction member |
| mountain icon   | high (unique in block)          | medium (shared with d2, eliminates d1) | HIGH     | yes — conjunction member |
| titled Erta Ale | high (unique task identifier)   | medium (d2 also says "Erta Ale")       | MEDIUM   | yes — aids task recall   |
| paperback       | low (generic format)            | low (all three are paperbacks)         | LOW      | no                        |
| second shelf    | medium (navigation aid)         | low (all same shelf)                   | LOW      | include as location       |
| study room      | medium (navigation)             | low (all same room)                    | LOW      | include as location       |

**Minimum cue set for object discrimination**: red + mountain icon (conjunction eliminates both distractors)

**Key insight from this example**: The title "Erta Ale" has HIGH diagnosticity for Level A (which task?) but only MEDIUM for Level B (which object?) because d2 deliberately shares the title. This forces the participant to rely on the visual conjunction (color + icon), not just the name — which is exactly what AF is designed to support.

---

## 12. Files to Create/Modify

### New Files

| File                                        | Purpose                          |
| ------------------------------------------- | -------------------------------- |
| `stage2/diagnosticity_analyzer.py`        | Core analysis module             |
| `data/diagnosticity/` (directory)         | Output reports                   |
| `data/diagnosticity/b1_book.yaml` (× 12) | Per-task diagnosticity reports   |
| `tests/test_diagnosticity_analyzer.py`    | Tests for the analyzer           |
| `config/diagnosticity_config.yaml`        | Optional: VLM config, thresholds |

### Modified Files

| File                                  | Change                                   |
| ------------------------------------- | ---------------------------------------- |
| `data/task_schemas/*.json` (all 12) | Migrate distractor_info to 2 distractors |
| `stage2/prompt_constructor.py`      | Add diagnosticity_report parameter       |
| `stage2/quality_gate.py`            | Add cue_priority_compliance check        |
| `stage2/batch_runner.py`            | Load approved reports before generation  |
| `tests/test_task_schemas.py`        | Validate new distractor schema           |
| `tests/test_quality_gate.py`        | Test new cue priority check              |
| `config/model_config.yaml`          | Optional: add VLM backend section        |

---

## 13. Qwen 百炼 API Configuration

For development, use Qwen via Aliyun 百炼:

```yaml
# model_config.yaml — for diagnosticity analysis
backend: "openai"  # 百炼 uses OpenAI-compatible API
model_name: "qwen3-max"
base_url: "https://dashscope.aliyuncs.com/compatible-mode/v1"
api_key_env: [in environment variable: $THESIS_API_KEY]
temperature: 0.3  # lower temperature for analytical tasks
max_tokens: 2000  # diagnosticity output is longer than reminders
```

The existing `OpenAIBackend` in `llm_backend.py` already supports custom `base_url`,
so no code changes are needed for the backend — just config changes.

For VLM (image analysis), Qwen-VL uses the same endpoint but a different model name:

```yaml
vlm_model_name: "qwen-vl-max"
```

Image input requires multimodal message format — this will need a small extension
to `llm_backend.py` (add an `image_path` parameter to `_call` for OpenAI-compatible backends).
