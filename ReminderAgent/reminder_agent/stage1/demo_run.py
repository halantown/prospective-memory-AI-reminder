"""Run the Stage 1 extraction demo.

Usage:
    python -m reminder_agent.stage1.demo_run [--use-llm]
"""

from __future__ import annotations

import argparse
import json
import logging
from pathlib import Path

from reminder_agent.stage1.extractor import extract_from_text

DATA_DIR = Path(__file__).resolve().parent.parent / "data" / "simulated_sources"


def main():
    parser = argparse.ArgumentParser(description="Stage 1 extraction demo")
    parser.add_argument("--use-llm", action="store_true",
                        help="Use LLM backend (requires running Ollama)")
    args = parser.parse_args()

    source_path = DATA_DIR / "doctor_email.txt"
    if not source_path.exists():
        print(f"Source file not found: {source_path}")
        return

    source_text = source_path.read_text()

    print("=== Stage 1 Demo: Information Extraction ===\n")
    print(f"Source: {source_path.name}")
    print(f"Type: Doctor's prescription email")
    print(f"Method: {'LLM-based' if args.use_llm else 'Rule-based (no LLM)'}\n")

    backend = None
    if args.use_llm:
        from reminder_agent.stage2.llm_backend import create_backend
        backend = create_backend()
        print(f"LLM: {backend.config.backend} / {backend.config.model_name}\n")

    result = extract_from_text(source_text, backend=backend)

    print("--- Extracted Task JSON ---")
    print(json.dumps(result["extracted"], indent=2))

    print("\n--- Gaps ---")
    if result["gaps"]:
        for gap in result["gaps"]:
            print(f"  • {gap}")
    else:
        print("  None — all fields extracted successfully")

    print(f"\n--- Confidence: {result['confidence']} ---")


if __name__ == "__main__":
    logging.basicConfig(level=logging.WARNING)
    main()
