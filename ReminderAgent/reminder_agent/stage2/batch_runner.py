"""Batch generation orchestrator for the reminder pipeline.

All 4 conditions (AF_low_EC_off, AF_low_EC_on, AF_high_EC_off, AF_high_EC_on)
use LLM generation. No template fallback.
"""

import argparse
import json
import logging
import sys
from pathlib import Path

from reminder_agent.stage2.config_loader import load_all_configs
from reminder_agent.stage2.context_extractor import extract
from reminder_agent.stage2.llm_backend import GenerationError, create_backend
from reminder_agent.stage2.output_store import OutputStore
from reminder_agent.stage2.prompt_constructor import build_prompts
from reminder_agent.stage2.quality_gate import check as qg_check

logger = logging.getLogger(__name__)

TASK_DIR = Path(__file__).resolve().parent.parent / "data" / "task_schemas"

ALL_CONDITIONS = [
    "AF_low_EC_off",
    "AF_high_EC_off",
    "AF_low_EC_on",
    "AF_high_EC_on",
]


def load_all_task_jsons(task_dir: Path | None = None) -> list[dict]:
    """Load all task JSON files from the task_schemas directory."""
    task_dir = task_dir or TASK_DIR
    tasks = []
    for path in sorted(task_dir.glob("*.json")):
        with open(path) as f:
            tasks.append(json.load(f))
    return tasks


def run_batch(
    n_variants: int | None = None,
    dry_run: bool = False,
    task_filter: str | None = None,
    condition_filter: str | None = None,
    clear_db: bool = False,
):
    """Full batch generation pipeline. All conditions use LLM."""
    model_config, gen_config, field_map = load_all_configs()

    backend = None
    if not dry_run:
        backend = create_backend(model_config)

    store = OutputStore()
    if clear_db:
        store.clear()
        print("Database cleared.")

    tasks = load_all_task_jsons()
    if task_filter:
        tasks = [t for t in tasks if t["task_id"] == task_filter]
        if not tasks:
            print(f"No task found with id '{task_filter}'")
            return

    n_variants = n_variants or gen_config.n_variants
    conditions = [condition_filter] if condition_filter else ALL_CONDITIONS

    total = len(tasks) * len(conditions) * n_variants
    succeeded = 0
    failed = 0
    failure_breakdown: dict[str, int] = {}

    print(f"\n=== LLM Generation ({len(tasks)} tasks × {len(conditions)} conditions × {n_variants} variants = {total} total) ===")

    for task in tasks:
        entity_name = task["reminder_context"]["element1_af"]["af_high"]["target_entity"]["entity_name"]

        for condition in conditions:
            prior_variants: list[str] = []

            for v_idx in range(n_variants):
                success = False

                for attempt in range(1, gen_config.max_retries + 1):
                    sys_prompt, usr_prompt = build_prompts(
                        task, condition,
                        prior_variants=prior_variants,
                        field_map=field_map,
                        gen_config=gen_config,
                    )

                    if dry_run:
                        raw_output = f"[DRY RUN] Remember to {task['reminder_context']['element1_af']['af_baseline']['action_verb']} the {entity_name}. ({condition} v{v_idx})"
                    else:
                        try:
                            raw_output = backend.generate(sys_prompt, usr_prompt)
                        except GenerationError as e:
                            logger.error("LLM error: %s", e)
                            continue

                    qg_result = qg_check(
                        text=raw_output,
                        condition=condition,
                        task_id=task["task_id"],
                        entity_name=entity_name,
                        prior_variants=prior_variants,
                        gen_config=gen_config,
                        task_json=task,
                    )

                    qg_details_str = json.dumps([
                        {"check": c.check_name, "passed": c.passed, "detail": c.detail}
                        for c in qg_result.checks
                    ])

                    store.write_generation_log(
                        task_id=task["task_id"],
                        condition=condition,
                        variant_idx=v_idx,
                        attempt=attempt,
                        raw_output=raw_output,
                        qg_passed=qg_result.passed,
                        qg_details=qg_details_str,
                        model_used=model_config.model_name,
                        prompt_system=sys_prompt,
                        prompt_user=usr_prompt,
                    )

                    if qg_result.passed or dry_run:
                        store.write_reminder(
                            task_id=task["task_id"],
                            condition=condition,
                            variant_idx=v_idx,
                            text=raw_output,
                            passed_qg=True if dry_run else qg_result.passed,
                            qg_failures=None,
                            model_used=model_config.model_name,
                            attempt=attempt,
                        )
                        prior_variants.append(raw_output)
                        success = True
                        print(f"  ✅ {task['task_id']} / {condition} / v{v_idx} (attempt {attempt})")
                        break
                    else:
                        fail_names = ", ".join(c.check_name for c in qg_result.failures)
                        if attempt < gen_config.max_retries:
                            print(f"  ⚠️  {task['task_id']} / {condition} / v{v_idx} attempt {attempt} — {fail_names}")
                        for c in qg_result.failures:
                            failure_breakdown[c.check_name] = failure_breakdown.get(c.check_name, 0) + 1

                if success:
                    succeeded += 1
                else:
                    failed += 1
                    print(f"  ❌ {task['task_id']} / {condition} / v{v_idx}: FAILED after {gen_config.max_retries} attempts")

    print(f"\n=== Summary ===")
    print(f"  Total: {total} attempted, {succeeded} succeeded, {failed} failed")
    print(f"  Database: {store.db_path}")

    if failure_breakdown:
        print(f"\n  QG failure breakdown:")
        for name, count in sorted(failure_breakdown.items()):
            print(f"    {name}: {count}")


def main():
    parser = argparse.ArgumentParser(description="Batch generate reminder texts.")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--n-variants", type=int, default=None)
    parser.add_argument("--task", type=str, default=None)
    parser.add_argument("--condition", type=str, default=None)
    parser.add_argument("--clear", action="store_true")
    parser.add_argument("-v", "--verbose", action="store_true")
    args = parser.parse_args()

    level = logging.DEBUG if args.verbose else logging.WARNING
    logging.basicConfig(level=level, format="%(levelname)s: %(message)s")

    run_batch(
        n_variants=args.n_variants,
        dry_run=args.dry_run,
        task_filter=args.task,
        condition_filter=args.condition,
        clear_db=args.clear,
    )


if __name__ == "__main__":
    main()
