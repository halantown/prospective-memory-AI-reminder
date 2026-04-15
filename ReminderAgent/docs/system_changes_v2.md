# Reminder System — Change Requirements
*Based on design session, April 12*

---

## 1. Experimental Design Changes

### 1.1 Fan Pair Removed
- **Before**: 4 tasks organized into 2 fan pairs (book pair + food/drink pair), designed to create task-level competition between similar intentions
- **After**: 4 fully independent PM tasks, no pairing required
- **Impact**: Task JSON no longer needs `task_pair` and `pair_role` fields; these can be removed or retained as null

### 1.2 AF Theoretical Repositioning
- **Before**: AF grounded in fan effect (Cook et al., 2006) — discrimination among competing intentions
- **After**: AF grounded in encoding-retrieval match, cue specificity, cue distinctiveness, and cue overload reduction
  - Guynn et al. (1998): target + action structure as necessary condition for effective reminder → AF_low baseline anchor
  - Tulving & Thomson (1973) ESP: C_AF boundary anchor
  - Nairne (2002): diagnosticity applied at execution level (target vs distractors), not task level
- **Impact**: No system-level code change; affects documentation and JSON comments only

### 1.3 Diagnosticity Scoring — Static, Not Dynamic
- **Before**: Diagnosticity formula D(c) = A(c→target) / ΣA(c→tᵢ) applied across multiple tasks at runtime
- **After**: Diagnosticity evaluated offline, manually, against per-task distractors only
  - For each feature in C_AF, check: does this feature appear in any distractor?
  - Features unique to target = `diagnosticity: high`
  - Features shared with one or more distractors = `diagnosticity: low`
  - Feature combinations (e.g. red + mountain) that are jointly unique = `diagnosticity: high`
  - Results written into JSON statically at design time
- **Impact**: No runtime diagnosticity computation needed; pipeline reads pre-labelled `c_af_candidates`

---

## 2. Task JSON Structure Changes

### 2.1 Fields to Remove
- `task_pair` — no longer needed
- `pair_role` — no longer needed

### 2.2 Fields to Add
Each feature in `c_af_candidates` now requires a `diagnosticity` label:

```json
"c_af_candidates": [
  { "feature": "red cover",             "source": "encoding_card_text + VLM", "diagnosticity": "low" },
  { "feature": "mountain illustration", "source": "encoding_card_text + VLM", "diagnosticity": "low" },
  { "feature": "titled Erta Ale",       "source": "encoding_card_text",        "diagnosticity": "low" },
  { "feature": "travel book",           "source": "encoding_card_text",        "diagnosticity": "low" },
  { "feature": "red cover + mountain",  "source": "combination",               "diagnosticity": "high" },
  { "feature": "second shelf, study",   "source": "encoding_card_text",        "diagnosticity": "high" }
]
```

Note: Diagnosticity is evaluated against distractors within the same task only, not across tasks.

### 2.3 Fields to Update

**`element2_ec.creation_context`**
- **Before**: "Mei called you yesterday evening and mentioned she'd like to borrow a book"
- **After**: Scene-based description matching the actual encoding episode
  - Example (Book 1 / Mei): "Mei brought it up when you were baking together last week"
  - Rule: EC creation_context must describe the same event as the encoding episode in encoding_card_text. Mismatch between these two will cause context reinstatement to fail.

**`encoding_card_text` (Zone 2)**
- Must be updated to match the new encoding episode narrative (baking scene for Book 1, not phone call)
- EC creation_context and encoding_card_text must describe the same event — this is a hard consistency requirement

### 2.4 Encoding Episode Uniqueness Requirement
Each task's encoding episode (the scene described in encoding_card_text and EC creation_context) must be unique and non-overlapping across all 4 tasks. Overlapping scenes risk triggering context reinstatement for the wrong task.

Current status:
- Book 1 / Mei: baking together ✓
- Book 2 / Jack: watching a film together ✓
- Tea / Benjamin: phone call about caffeine allergy ✓
- Dessert / Sophia: group chat mention ✓ (to be confirmed)

---

## 3. Reminder Pipeline Logic Changes

### 3.1 AF_high Feature Selection
- **Before**: Top-k features selected by runtime diagnosticity ranking across tasks
- **After**: AF_high features = all features in `c_af_candidates` where `diagnosticity: high`
  - Pipeline reads pre-labelled list, no ranking computation needed

### 3.2 Reminder Assembly (unchanged structure, simplified source)
```
input: task_json + condition {AF_low|AF_high} × {EC_off|EC_on}

base = af_baseline (action_verb + recipient)
if AF_high: base += features where diagnosticity == "high" + location
if EC_on:   base += creation_context

output: formatted reminder string
```

### 3.3 Four Condition Outputs (Book 1 / Mei example)
```
AF_low / EC_off:
"When you see Mei, give her the book."

AF_high / EC_off:
"When you see Mei, give her the book —
 the red one with a mountain illustration,
 on the second shelf in the study."

AF_low / EC_on:
"Mei brought it up when you were baking together —
 remember to give her the book when she arrives."

AF_high / EC_on:
"Mei brought it up when you were baking together —
 give her the red book with the mountain illustration,
 on the second shelf in the study."
```

---

## 4. VLM Integration (unchanged role, clarified scope)

- VLM input: `encoding_card_image` (pre-prepared asset, not live environment)
- VLM output: visual feature candidates
- Human review step: reconcile VLM output against `encoding_card_text`; resolve conflicts in favour of text
- Output destination: `c_af_candidates` with source labelled as "encoding_card_text + VLM"
- VLM does NOT contribute independent C_AF candidates beyond what is described in encoding_card_text
- This step is offline / one-time per task, not runtime

---

## 5. Known Limitations (for thesis documentation)

1. **Mei overlap**: Mei is simultaneously action recipient (AF) and task creator (EC) in Book 1. This creates potential construct validity noise. Effect is uniform across all four conditions → no systematic bias. Listed as design limitation.

2. **Ecological validity of distractors**: Execution-level distractors (multiple similar objects to choose from) are a laboratory construct with limited ecological validity. Their function is difficulty control to prevent ceiling effects, not a theoretical claim. To be documented in method rationale.

3. **Diagnosticity scope**: Nairne (2002) diagnosticity originally formulated for competing memory traces. Applied here at execution level (target vs distractors). This borrowing to be explicitly acknowledged in thesis.

4. **No fan effect**: Fan pair removed. Cook et al. (2006) demoted to background reference. Task-level intention competition is not tested in this study.

---

## 6. What Is NOT Changing

- 2×2 factorial design (AF × EC) — unchanged
- AF_low baseline = target + action structure (Guynn et al., 1998) — unchanged
- EC mechanism = context reinstatement via DC-C (Smith, 1979) — unchanged
- C_AF boundary = explicitly presented features in encoding material — unchanged
- AF and EC orthogonality principle — unchanged
- Zone 1/2/3 JSON structure — unchanged
- Composite PM score (time × action, 0–6) — unchanged
- Primary DV: composite PM score; secondary DVs: initiation latency, mouse trajectory, memory self-efficacy, perceived usefulness — unchanged
