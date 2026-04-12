"""Diagnosticity analyzer — assesses cue diagnosticity for AF reminder design.

Implements the 4-layer theoretical framework from AF_DIAGNOSTICITY_DEV_GUIDE.md:
  L2 — Extract candidate features from encoding material
  L3 — Assess diagnosticity at task-level (A) and object-level (B)
  L4 — Recommend cue set for AF reminders

This is an OFFLINE analysis tool. Run it once per task, review the output,
then use approved reports to guide AF reminder generation.

Usage:
    python -m reminder_agent.stage2.diagnosticity_analyzer --task b1_book
    python -m reminder_agent.stage2.diagnosticity_analyzer --all
    python -m reminder_agent.stage2.diagnosticity_analyzer --review
"""

from __future__ import annotations

import argparse
import json
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import yaml

from reminder_agent.stage2.config_loader import ModelConfig
from reminder_agent.stage2.llm_backend import LLMBackend, create_backend

logger = logging.getLogger(__name__)

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
TASK_DIR = DATA_DIR / "task_schemas"
REPORT_DIR = DATA_DIR / "diagnosticity"

# Block assignments for Level A (task discrimination) analysis
BLOCK_ASSIGNMENTS: dict[str, list[str]] = {
    "B1": ["b1_book", "b1_giftbag", "b1_dish", "b1_soap"],
    "B2": ["b2_vinyl", "b2_napkinrings", "b2_pot", "b2_softener"],
    "B3": ["b3_hanger", "b3_speaker", "b3_vase", "b3_handcream"],
}

TASK_TO_BLOCK: dict[str, str] = {
    tid: block for block, tids in BLOCK_ASSIGNMENTS.items() for tid in tids
}


# ---------------------------------------------------------------------------
# LLM Prompts
# ---------------------------------------------------------------------------

FEATURE_EXTRACTION_PROMPT = """You are analyzing encoding materials for a prospective memory experiment.

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
{{
  "features": [
    {{
      "feature_id": "f1",
      "feature": "red cover",
      "source": "encoding_text",
      "feature_type": "visual_color",
      "exact_quote": "It is a red paperback"
    }}
  ]
}}"""

DIAGNOSTICITY_ASSESSMENT_PROMPT = """You are assessing CUE DIAGNOSTICITY for a prospective memory experiment.

THEORY: A cue's diagnosticity D(c) is the ratio of activation it sends to the
target versus all competing items. High D means the cue uniquely identifies the target.
(Nairne, 2002; Cook et al., 2006 — fan effect in event-based PM)

TASK: Assess each candidate feature at TWO levels of discrimination.

TARGET ENTITY:
{target_entity}

DISTRACTORS (items the participant must distinguish the target from):
{distractors}

OTHER TASKS IN THIS BLOCK (for task-level discrimination):
{block_tasks_summary}

CANDIDATE FEATURES:
{features}

For EACH feature, assess:

LEVEL A — TASK DISCRIMINATION:
- Question: "If the participant only heard this one cue, could they tell which PM task it refers to?"
- Competitors: the other {n_block_tasks} PM tasks listed above
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

Also recommend which features to INCLUDE in the reminder and which to EXCLUDE.
For included features, assign priority 1 (must include) or 2 (should include) or 3-4 (may include).
Priority 1-2 features are the minimum cue set needed for target discrimination.

OUTPUT FORMAT (JSON only, no explanation):
{{
  "diagnosticity": [
    {{
      "feature_id": "f1",
      "level_a": {{"rating": "high|medium|low", "reasoning": "one sentence"}},
      "level_b": {{"rating": "high|medium|low", "reasoning": "one sentence"}},
      "combined": "HIGH|MEDIUM|LOW"
    }}
  ],
  "recommended_include": [
    {{"feature_id": "f1", "priority": 1, "reason": "one sentence"}}
  ],
  "recommended_exclude": [
    {{"feature_id": "f4", "reason": "one sentence"}}
  ],
  "target_conjunction": "the minimal set of features that uniquely identifies the target",
  "minimum_cues_for_discrimination": ["f1", "f2"]
}}"""


# ---------------------------------------------------------------------------
# Task loading helpers
# ---------------------------------------------------------------------------

def load_task(task_id: str) -> dict:
    """Load a single task JSON."""
    path = TASK_DIR / f"{task_id}.json"
    if not path.exists():
        raise FileNotFoundError(f"Task file not found: {path}")
    with open(path) as f:
        return json.load(f)


def load_all_tasks() -> dict[str, dict]:
    """Load all task JSONs, keyed by task_id."""
    tasks = {}
    for path in sorted(TASK_DIR.glob("*.json")):
        with open(path) as f:
            data = json.load(f)
        tasks[data["task_id"]] = data
    return tasks


def get_block_peers(task_id: str, all_tasks: dict[str, dict]) -> list[dict]:
    """Get other tasks in the same block (for Level A analysis)."""
    block = TASK_TO_BLOCK.get(task_id)
    if not block:
        raise ValueError(f"Task {task_id} not in any block")
    return [
        all_tasks[tid] for tid in BLOCK_ASSIGNMENTS[block]
        if tid != task_id and tid in all_tasks
    ]


def _summarize_task_for_block(task: dict) -> str:
    """Create a brief summary of a task for block-level context."""
    el1 = task["reminder_context"]["element1"]
    entity = el1["target_entity"]
    name = entity.get("entity_name", "unknown")
    visual = entity.get("cues", {}).get("visual", "no visual cue")
    return f"- {task['task_id']}: {name} ({visual})"


# ---------------------------------------------------------------------------
# LLM response parsing
# ---------------------------------------------------------------------------

def _parse_json_response(text: str) -> dict:
    """Extract and parse JSON from LLM response (handles markdown fences)."""
    text = text.strip()
    # Strip markdown code fences
    if text.startswith("```"):
        lines = text.split("\n")
        # Remove first line (```json or ```) and last line (```)
        start = 1
        end = len(lines)
        for i in range(len(lines) - 1, 0, -1):
            if lines[i].strip() == "```":
                end = i
                break
        text = "\n".join(lines[start:end])
    return json.loads(text)


# ---------------------------------------------------------------------------
# Core analysis functions
# ---------------------------------------------------------------------------

def extract_features(
    task_json: dict,
    backend: LLMBackend,
) -> list[dict]:
    """L2: Extract candidate features from encoding material using LLM."""
    encoding_text = task_json["agent_reasoning_context"]["encoding_info"]["encoding_text"]

    prompt = FEATURE_EXTRACTION_PROMPT.format(encoding_text=encoding_text)
    system = "You are a precise feature extraction assistant for cognitive psychology experiments. Output only valid JSON."

    raw = backend.generate(system, prompt)
    parsed = _parse_json_response(raw)
    features = parsed.get("features", [])

    logger.info("Extracted %d features for %s", len(features), task_json["task_id"])
    return features


def assess_diagnosticity(
    task_json: dict,
    features: list[dict],
    block_peers: list[dict],
    backend: LLMBackend,
) -> dict:
    """L3+L4: Assess feature diagnosticity and recommend cue set."""
    el1 = task_json["reminder_context"]["element1"]
    target_entity = json.dumps(el1["target_entity"], indent=2)
    distractors = json.dumps(
        task_json["agent_reasoning_context"]["distractor_info"]["distractors"],
        indent=2,
    )
    block_summary = "\n".join(_summarize_task_for_block(t) for t in block_peers)
    features_json = json.dumps(features, indent=2)

    prompt = DIAGNOSTICITY_ASSESSMENT_PROMPT.format(
        target_entity=target_entity,
        distractors=distractors,
        block_tasks_summary=block_summary,
        features=features_json,
        n_block_tasks=len(block_peers),
    )
    system = "You are a cognitive psychology expert assessing cue diagnosticity. Output only valid JSON."

    raw = backend.generate(system, prompt)
    result = _parse_json_response(raw)

    logger.info(
        "Diagnosticity assessed for %s: %d features, %d recommended",
        task_json["task_id"],
        len(result.get("diagnosticity", [])),
        len(result.get("recommended_include", [])),
    )
    return result


def analyze_task(
    task_json: dict,
    block_tasks: list[dict],
    backend: LLMBackend,
) -> dict:
    """Run full diagnosticity analysis for a single task.

    Args:
        task_json: Full task JSON with all 3 zones.
        block_tasks: Other PM tasks in the same block (for Level A).
        backend: Text LLM for reasoning.

    Returns:
        Diagnosticity report dict (matches YAML schema from dev guide §4.4).
    """
    task_id = task_json["task_id"]
    logger.info("Analyzing task: %s", task_id)

    # L2: Feature extraction
    features = extract_features(task_json, backend)

    # L3 + L4: Diagnosticity assessment and cue recommendation
    assessment = assess_diagnosticity(task_json, features, block_tasks, backend)

    # Build report
    distractor_info = task_json["agent_reasoning_context"]["distractor_info"]
    report = {
        "task_id": task_id,
        "analysis_version": "0.1",
        "model_used": backend.config.model_name,
        "analyzed_at": datetime.now(timezone.utc).isoformat(),
        "review_status": "pending",
        "candidate_features": features,
        "diagnosticity": assessment.get("diagnosticity", []),
        "recommended_cues": {
            "include": assessment.get("recommended_include", []),
            "exclude": assessment.get("recommended_exclude", []),
        },
        "target_conjunction": assessment.get(
            "target_conjunction",
            distractor_info.get("target_unique_conjunction", ""),
        ),
        "minimum_cues_for_discrimination": assessment.get(
            "minimum_cues_for_discrimination", []
        ),
    }

    return report


def analyze_all_tasks(
    backend: LLMBackend,
) -> dict[str, dict]:
    """Run diagnosticity analysis for all tasks.

    .. deprecated:: v2
        In v2, diagnosticity labels are pre-assigned statically in each task
        JSON's ``c_af_candidates`` entries. This function is retained only as
        an offline validation/re-analysis tool. Use the static labels in task
        JSON for production pipeline runs.

    Groups tasks by block for Level A analysis.
    Returns {task_id: report_dict}.
    """
    all_tasks = load_all_tasks()
    reports = {}

    for task_id, task_json in all_tasks.items():
        block_peers = get_block_peers(task_id, all_tasks)
        report = analyze_task(task_json, block_peers, backend)
        reports[task_id] = report

    return reports


# ---------------------------------------------------------------------------
# Report I/O
# ---------------------------------------------------------------------------

def save_report(report: dict, output_dir: Path | None = None) -> Path:
    """Save diagnosticity report to YAML file."""
    if output_dir is None:
        output_dir = REPORT_DIR
    output_dir.mkdir(parents=True, exist_ok=True)

    task_id = report["task_id"]
    path = output_dir / f"{task_id}.yaml"

    with open(path, "w") as f:
        yaml.dump(report, f, default_flow_style=False, sort_keys=False, allow_unicode=True)

    logger.info("Saved report: %s", path)
    return path


def load_report(task_id: str, report_dir: Path | None = None) -> dict:
    """Load a diagnosticity report from YAML."""
    if report_dir is None:
        report_dir = REPORT_DIR

    path = report_dir / f"{task_id}.yaml"
    if not path.exists():
        raise FileNotFoundError(f"Report not found: {path}")

    with open(path) as f:
        return yaml.safe_load(f)


def load_approved_reports(report_dir: Path | None = None) -> dict[str, dict]:
    """Load all approved diagnosticity reports. Returns {task_id: report}."""
    if report_dir is None:
        report_dir = REPORT_DIR

    reports = {}
    for path in sorted(report_dir.glob("*.yaml")):
        with open(path) as f:
            report = yaml.safe_load(f)
        if report and report.get("review_status") == "approved":
            reports[report["task_id"]] = report
    return reports


# ---------------------------------------------------------------------------
# Review display
# ---------------------------------------------------------------------------

def print_report_summary(report: dict) -> None:
    """Print a human-readable summary of a diagnosticity report."""
    tid = report["task_id"]
    status = report.get("review_status", "unknown")
    model = report.get("model_used", "unknown")
    n_features = len(report.get("candidate_features", []))
    include = report.get("recommended_cues", {}).get("include", [])
    exclude = report.get("recommended_cues", {}).get("exclude", [])
    conjunction = report.get("target_conjunction", "")

    status_icon = {"pending": "⏳", "approved": "✅", "rejected": "❌"}.get(status, "❓")

    print(f"\n{'─'*60}")
    print(f"  {status_icon} {tid}  (status: {status}, model: {model})")
    print(f"  Features: {n_features} extracted")
    print(f"  Target conjunction: {conjunction}")
    print(f"  Include ({len(include)}):")
    for cue in include:
        fid = cue.get("feature_id", "?")
        pri = cue.get("priority", "?")
        reason = cue.get("reason", "")
        print(f"    P{pri} [{fid}] {reason}")
    if exclude:
        print(f"  Exclude ({len(exclude)}):")
        for cue in exclude:
            fid = cue.get("feature_id", "?")
            reason = cue.get("reason", "")
            print(f"    [{fid}] {reason}")

    # Diagnosticity table
    diag = report.get("diagnosticity", [])
    if diag:
        print(f"  {'─'*56}")
        print(f"  {'Feature':<20} {'LvlA':<8} {'LvlB':<8} {'Combined':<8}")
        print(f"  {'─'*56}")
        features_by_id = {f["feature_id"]: f for f in report.get("candidate_features", [])}
        for d in diag:
            fid = d.get("feature_id", "?")
            feature_text = features_by_id.get(fid, {}).get("feature", fid)
            if len(feature_text) > 18:
                feature_text = feature_text[:15] + "..."
            la = d.get("level_a", {}).get("rating", "?")
            lb = d.get("level_b", {}).get("rating", "?")
            combined = d.get("combined", "?")
            print(f"  {feature_text:<20} {la:<8} {lb:<8} {combined:<8}")


def review_reports(report_dir: Path | None = None) -> None:
    """Show all existing reports with their statuses."""
    if report_dir is None:
        report_dir = REPORT_DIR

    if not report_dir.exists():
        print("No diagnosticity reports found.")
        return

    reports = sorted(report_dir.glob("*.yaml"))
    if not reports:
        print("No diagnosticity reports found.")
        return

    print(f"\n{'='*60}")
    print(f"  Diagnosticity Reports ({len(reports)} files)")
    print(f"{'='*60}")

    for path in reports:
        with open(path) as f:
            report = yaml.safe_load(f)
        if report:
            print_report_summary(report)

    print(f"\n{'─'*60}")


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def _create_analysis_backend() -> LLMBackend:
    """Create LLM backend configured for diagnosticity analysis.

    Uses Qwen via 百炼 API with lower temperature for analytical tasks.
    """
    config = ModelConfig(
        backend="openai",
        model_name="qwen-plus",
        temperature=0.3,
        max_tokens=2000,
        base_url="https://dashscope.aliyuncs.com/compatible-mode/v1",
        api_key_env="THESIS_API_KEY",
    )
    return create_backend(config)


def main():
    parser = argparse.ArgumentParser(
        description="Diagnosticity analysis for AF reminder cue selection."
    )
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--task", type=str, help="Analyze a single task by ID")
    group.add_argument("--all", action="store_true", help="Analyze all 12 tasks")
    group.add_argument("--review", action="store_true", help="Show existing reports")
    parser.add_argument("-v", "--verbose", action="store_true", help="Debug logging")
    args = parser.parse_args()

    level = logging.DEBUG if args.verbose else logging.INFO
    logging.basicConfig(level=level, format="%(levelname)s: %(message)s")

    if args.review:
        review_reports()
        return

    backend = _create_analysis_backend()

    if args.task:
        all_tasks = load_all_tasks()
        task_json = all_tasks.get(args.task)
        if task_json is None:
            print(f"Task not found: {args.task}")
            print(f"Available: {sorted(all_tasks.keys())}")
            raise SystemExit(1)

        block_peers = get_block_peers(args.task, all_tasks)
        report = analyze_task(task_json, block_peers, backend)
        path = save_report(report)
        print_report_summary(report)
        print(f"\n  Saved to: {path}")

    elif args.all:
        reports = analyze_all_tasks(backend)
        for task_id, report in reports.items():
            path = save_report(report)
            print_report_summary(report)
        print(f"\n  All {len(reports)} reports saved to {REPORT_DIR}/")


if __name__ == "__main__":
    main()
