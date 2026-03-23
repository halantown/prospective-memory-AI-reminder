"""CLI tool for human review of generated reminder texts.

Run as:
    python -m reminder_agent.review.review_interface [--stats] [--task TASK_ID]
        [--condition CONDITION] [--export FILE]
"""

import argparse
import json
import sys
from pathlib import Path

from reminder_agent.stage2.output_store import OutputStore

TASK_SCHEMAS_DIR = (
    Path(__file__).resolve().parent.parent / "data" / "task_schemas"
)

SEPARATOR = "─" * 44

HELP_TEXT = """\
Review Guidelines:
  [a]pprove — Text is natural, includes all necessary cues, correct length
  [r]eject  — Unnatural, missing key cues, contains wrong info, too long/short
  [f]lag    — Uncertain, needs discussion (e.g., potentially misleading)
  [s]kip    — Review later
  [q]uit    — Save progress and exit
  [n]otes   — Add a note to the current reminder before deciding

When rejecting or flagging, you'll be prompted for a brief reason."""


def load_task_context(task_id: str) -> dict | None:
    """Load task JSON schema for displaying context during review."""
    path = TASK_SCHEMAS_DIR / f"{task_id}.json"
    if not path.exists():
        return None
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def format_stats(stats: dict) -> str:
    """Format statistics dict into a readable summary."""
    lines = [
        "=== Review Statistics ===",
        f"Total reminders: {stats['total_reminders']}",
        f"Total generation attempts: {stats['total_generation_attempts']}",
        "",
        "By condition:",
    ]
    for cond, count in sorted(stats.get("by_condition", {}).items()):
        lines.append(f"  {cond}: {count}")
    lines.append("")
    lines.append("By review status:")
    for status, count in sorted(stats.get("by_review_status", {}).items()):
        lines.append(f"  {status}: {count}")
    return "\n".join(lines)


def format_status_bar(stats: dict) -> str:
    """Single-line status bar from review status counts."""
    by_review = stats.get("by_review_status", {})
    pending = by_review.get("pending", 0)
    approved = by_review.get("approved", 0)
    rejected = by_review.get("rejected", 0)
    flagged = by_review.get("flagged", 0)
    return (
        f"Pending: {pending} | Approved: {approved} "
        f"| Rejected: {rejected} | Flagged: {flagged}"
    )


def format_reminder_card(
    reminder: dict, index: int, total: int, task_ctx: dict | None
) -> str:
    """Build the display card for a single reminder under review."""
    lines = [
        SEPARATOR,
        f"[{index}/{total}] Task: {reminder['task_id']} "
        f"| Condition: {reminder['condition']} "
        f"| Variant: {reminder['variant_idx']}",
    ]

    if task_ctx:
        reasoning = task_ctx.get("agent_reasoning_context", {})

        encoding_info = reasoning.get("encoding_info", {})
        encoding_text = encoding_info.get("encoding_text")
        if encoding_text:
            lines.append(f'\nContext (encoding text):\n  "{encoding_text}"')

        target = (
            task_ctx.get("reminder_context", {})
            .get("element1", {})
            .get("target_entity", {})
        )
        visual_cue = target.get("cues", {}).get("visual", "N/A")
        entity_name = target.get("entity_name", "N/A")
        lines.append(f"\nTarget: {visual_cue} ({entity_name})")

        distractor_info = reasoning.get("distractor_info", {})
        distractor_desc = distractor_info.get(
            "distractor_description", "N/A"
        )
        disc_dim = distractor_info.get("discriminating_dimension", "N/A")
        lines.append(f"Distractor: {distractor_desc}")
        lines.append(f"Discriminating cue: {disc_dim}")

    lines.append(f'\nGenerated reminder:\n  "{reminder["text"]}"')

    if reminder.get("quality_gate_failures"):
        lines.append(f"\n⚠ QG failures: {reminder['quality_gate_failures']}")
    if reminder.get("reviewer_notes"):
        lines.append(f"📝 Existing notes: {reminder['reviewer_notes']}")

    lines.append(
        "\n[a]pprove  [r]eject  [f]lag  [s]kip  [q]uit  [?]help"
    )
    return "\n".join(lines)


def prompt_reason(action: str) -> str:
    """Ask the reviewer for a reason when rejecting or flagging."""
    return input(f"Reason for {action}: ").strip()


def run_interactive_review(store: OutputStore, reminders: list[dict]) -> None:
    """Main interactive review loop."""
    total = len(reminders)
    if total == 0:
        print("No pending reminders to review.")
        return

    print("\n=== Reminder Review Interface ===")
    print(format_status_bar(store.get_stats()))

    task_ctx_cache: dict[str, dict | None] = {}
    current_notes: str | None = None
    i = 0

    while i < len(reminders):
        reminder = reminders[i]
        task_id = reminder["task_id"]

        if task_id not in task_ctx_cache:
            task_ctx_cache[task_id] = load_task_context(task_id)

        card = format_reminder_card(
            reminder, i + 1, total, task_ctx_cache[task_id]
        )
        print(card)

        try:
            choice = input("> ").strip().lower()
        except (EOFError, KeyboardInterrupt):
            print("\nExiting review.")
            break

        if choice == "a":
            store.update_review_status(
                reminder["id"], "approved", notes=current_notes
            )
            print("  ✓ Approved")
            current_notes = None
            i += 1
        elif choice == "r":
            reason = prompt_reason("rejection")
            notes = (
                f"{current_notes}; {reason}" if current_notes else reason
            )
            store.update_review_status(reminder["id"], "rejected", notes=notes)
            print("  ✗ Rejected")
            current_notes = None
            i += 1
        elif choice == "f":
            reason = prompt_reason("flagging")
            notes = (
                f"{current_notes}; {reason}" if current_notes else reason
            )
            store.update_review_status(reminder["id"], "flagged", notes=notes)
            print("  ⚑ Flagged")
            current_notes = None
            i += 1
        elif choice == "s":
            print("  → Skipped")
            current_notes = None
            i += 1
        elif choice == "q":
            print("Progress saved. Exiting.")
            break
        elif choice == "?" or choice == "help":
            print(f"\n{HELP_TEXT}\n")
        elif choice == "n":
            note = input("Note: ").strip()
            if note:
                current_notes = (
                    f"{current_notes}; {note}" if current_notes else note
                )
                print(f"  📝 Note saved (will attach to next decision)")
            else:
                print("  (empty note, nothing added)")
        else:
            print(f'  Unknown command "{choice}". Press ? for help.')

    reviewed = store.get_stats().get("by_review_status", {})
    still_pending = reviewed.get("pending", 0)
    print(f"\nDone. {still_pending} reminders still pending.")


def run_export(store: OutputStore, filepath: str) -> None:
    """Export approved reminders to a JSON file."""
    approved = store.get_approved_for_export()
    if not approved:
        print("No approved reminders to export.")
        return

    export_data = [
        {
            "task_id": r["task_id"],
            "condition": r["condition"],
            "variant_idx": r["variant_idx"],
            "text": r["text"],
        }
        for r in approved
    ]

    out_path = Path(filepath)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(export_data, f, indent=2, ensure_ascii=False)

    print(f"Exported {len(export_data)} approved reminders to {out_path}")


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Human review CLI for generated reminder texts.",
    )
    parser.add_argument(
        "--stats",
        action="store_true",
        help="Show review statistics and exit.",
    )
    parser.add_argument(
        "--task",
        type=str,
        default=None,
        help="Filter reminders to a specific task_id.",
    )
    parser.add_argument(
        "--condition",
        type=str,
        default=None,
        help="Filter reminders to a specific condition.",
    )
    parser.add_argument(
        "--export",
        type=str,
        default=None,
        metavar="FILE",
        help="Export approved reminders to a JSON file.",
    )
    parser.add_argument(
        "--db",
        type=str,
        default=None,
        metavar="PATH",
        help="Path to reminders.db (default: auto-detected).",
    )
    return parser


def main(argv: list[str] | None = None) -> None:
    parser = build_parser()
    args = parser.parse_args(argv)

    store_kwargs = {}
    if args.db:
        store_kwargs["db_path"] = Path(args.db)
    store = OutputStore(**store_kwargs)

    if args.stats:
        print(format_stats(store.get_stats()))
        return

    if args.export:
        run_export(store, args.export)
        return

    # Interactive review: get pending reminders with optional filters
    if args.task or args.condition:
        reminders = store.get_all_reminders(
            task_id=args.task,
            condition=args.condition,
            review_status="pending",
        )
    else:
        reminders = store.get_pending_review()

    run_interactive_review(store, reminders)


if __name__ == "__main__":
    main()
