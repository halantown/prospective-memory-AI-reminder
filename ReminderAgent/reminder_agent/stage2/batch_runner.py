"""Batch generation orchestrator for the reminder pipeline."""

import argparse
import json
import logging
import sys
from pathlib import Path

from reminder_agent.stage2.baseline_generator import generate_baseline, load_all_task_jsons
from reminder_agent.stage2.config_loader import load_all_configs
from reminder_agent.stage2.context_extractor import extract
from reminder_agent.stage2.llm_backend import GenerationError, create_backend
from reminder_agent.stage2.output_store import OutputStore
from reminder_agent.stage2.prompt_constructor import build_prompts
from reminder_agent.stage2.quality_gate import check as qg_check

logger = logging.getLogger(__name__)

LLM_CONDITIONS = ["AF_only", "AF_CB"]


def run_batch(
    n_variants: int | None = None,
    dry_run: bool = False,
    task_filter: str | None = None,
    condition_filter: str | None = None,
    clear_db: bool = False,
):
    """Full batch generation pipeline."""
    model_config, gen_config, field_map = load_all_configs()

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
    conditions = [condition_filter] if condition_filter else LLM_CONDITIONS

    # Phase 1: Baselines
    print(f"\n=== Phase 1: Baselines ({len(tasks)} tasks) ===")
    for task in tasks:
        text = generate_baseline(task, field_map)
        store.write_reminder(
            task_id=task["task_id"],
            condition="Baseline",
            variant_idx=0,
            text=text,
            passed_qg=True,
            qg_failures=None,
            model_used=None,
            attempt=1,
        )
        print(f"  ✅ {task['task_id']}: \"{text}\"")

    # Phase 2: LLM Generation
    total = len(tasks) * len(conditions) * n_variants
    succeeded = 0
    failed = 0
    failure_breakdown: dict[str, int] = {}

    print(f"\n=== Phase 2: LLM Generation ({len(tasks)} tasks × {len(conditions)} conditions × {n_variants} variants) ===")

    for task in tasks:
        entity_name = task["reminder_context"]["element1"]["target_entity"]["entity_name"]

        for condition in conditions:
            prior_variants: list[str] = []

            for v_idx in range(n_variants):
                success = False

                for attempt in range(1, gen_config.max_retries + 1):
                    # Build prompts
                    sys_prompt, usr_prompt = build_prompts(
                        task, condition,
                        prior_variants=prior_variants,
                        field_map=field_map,
                        gen_config=gen_config,
                    )

                    # Generate
                    if dry_run:
                        raw_output = f"[DRY RUN] {task['task_id']} / {condition} / v{v_idx}"
                    else:
                        try:
                            raw_output = backend.generate(sys_prompt, usr_prompt)
                        except GenerationError as e:
                            logger.error("LLM error: %s", e)
                            continue

                    # Quality gate
                    qg_result = qg_check(
                        text=raw_output,
                        condition=condition,
                        task_id=task["task_id"],
                        entity_name=entity_name,
                        prior_variants=prior_variants,
                        gen_config=gen_config,
                    )

                    # Serialize QG details for logging
                    qg_details_str = json.dumps([
                        {"check": c.check_name, "passed": c.passed, "detail": c.detail}
                        for c in qg_result.checks
                    ])
                    qg_failure_names = [c.check_name for c in qg_result.failures] if not qg_result.passed else None

                    # Log attempt
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
                            print(f"  ⚠️  {task['task_id']} / {condition} / v{v_idx} (attempt {attempt}) — {fail_names}")
                        for c in qg_result.failures:
                            failure_breakdown[c.check_name] = failure_breakdown.get(c.check_name, 0) + 1

                if success:
                    succeeded += 1
                else:
                    failed += 1
                    print(f"  ❌ {task['task_id']} / {condition} / v{v_idx}: FAILED after {gen_config.max_retries} attempts")

    # Summary
    print(f"\n=== Summary ===")
    print(f"  Baselines: {len(tasks)}/{len(tasks)}")
    print(f"  LLM texts: {total} attempted, {succeeded} succeeded, {failed} failed")
    print(f"  Database: {store.db_path}")

    if conditions:
        print(f"\n  By condition:")
        stats = store.get_stats()
        for cond, count in stats["by_condition"].items():
            if cond != "Baseline":
                print(f"    {cond}: {count}")

    if failure_breakdown:
        print(f"\n  Quality gate failure breakdown:")
        for name, count in sorted(failure_breakdown.items()):
            print(f"    {name}: {count}")

    print(f"\n  Check output:")
    print(f"    sqlite3 {store.db_path} \"SELECT task_id, condition, text FROM reminders LIMIT 20;\"")


def main():
    parser = argparse.ArgumentParser(
        description="Batch generate reminder texts for the experiment."
    )
    parser.add_argument("--dry-run", action="store_true",
                        help="Validate pipeline without LLM calls")
    parser.add_argument("--n-variants", type=int, default=None,
                        help="Number of variants per (task, condition)")
    parser.add_argument("--task", type=str, default=None,
                        help="Generate for specific task_id only")
    parser.add_argument("--condition", type=str, default=None,
                        help="Generate for specific condition only")
    parser.add_argument("--clear", action="store_true",
                        help="Clear DB before generating")
    parser.add_argument("-v", "--verbose", action="store_true",
                        help="Enable debug logging")
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
