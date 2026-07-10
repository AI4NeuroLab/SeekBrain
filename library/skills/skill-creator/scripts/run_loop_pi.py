#!/usr/bin/env python3
"""pi-native skill-description optimization loop.

Reuses ``scripts.run_loop.run_loop`` (train/test split, history, best-by-test
selection, live HTML report) but swaps its two LLM seams to pi-native variants:
  - ``run_eval`` -> ``run_eval_pi.run_eval`` (the real SkillLoader matcher; no ``claude -p``)
  - ``improve_description`` -> ``improve_description_pi.improve_description`` (``pi -p``)

Headless by default: it writes a static ``report.html`` (via ``--static``) and never
opens a browser.

Usage:
    python -m scripts.run_loop_pi --eval-set trigger.json --skill-path <skill> \
        --model <id> --static report.html --verbose
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from scripts import improve_description_pi, run_eval_pi
from scripts import run_loop as rl
from scripts.generate_report import generate_html
from scripts.utils import parse_skill_md


def main():
    ap = argparse.ArgumentParser(description="pi-native eval + improve loop")
    ap.add_argument("--eval-set", required=True)
    ap.add_argument("--skill-path", required=True)
    ap.add_argument("--description", default=None)
    ap.add_argument("--num-workers", type=int, default=4)
    ap.add_argument("--max-iterations", type=int, default=5)
    ap.add_argument("--runs-per-query", type=int, default=3)
    ap.add_argument("--trigger-threshold", type=float, default=0.5)
    ap.add_argument("--relevance-threshold", type=float, default=0.3)
    ap.add_argument("--holdout", type=float, default=0.4)
    ap.add_argument("--model", required=True)
    ap.add_argument("--static", default=None, help="Write the HTML report here (headless; no browser).")
    ap.add_argument("--verbose", action="store_true")
    args = ap.parse_args()

    skill_path = Path(args.skill_path)
    if not (skill_path / "SKILL.md").exists():
        print(f"Error: No SKILL.md found at {skill_path}", file=sys.stderr)
        sys.exit(1)
    eval_set = json.loads(Path(args.eval_set).read_text())

    # Wire the pi-native seams into the reused loop.
    run_eval_pi._SKILL_PATH = skill_path
    run_eval_pi._RELEVANCE_THRESHOLD = args.relevance_threshold
    rl.run_eval = run_eval_pi.run_eval
    rl.improve_description = improve_description_pi.improve_description

    report_path = Path(args.static) if args.static else None
    result = rl.run_loop(
        eval_set=eval_set,
        skill_path=skill_path,
        description_override=args.description,
        num_workers=args.num_workers,
        timeout=0,
        max_iterations=args.max_iterations,
        runs_per_query=args.runs_per_query,
        trigger_threshold=args.trigger_threshold,
        holdout=args.holdout,
        model=args.model,
        verbose=args.verbose,
        live_report_path=report_path,
    )

    if report_path:
        name, _, _ = parse_skill_md(skill_path)
        report_path.write_text(generate_html(result, auto_refresh=False, skill_name=name))
        if args.verbose:
            print(f"Report: {report_path}", file=sys.stderr)
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
