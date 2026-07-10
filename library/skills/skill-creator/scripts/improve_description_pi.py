#!/usr/bin/env python3
"""pi-native skill-description improver.

Reuses all of ``scripts.improve_description`` (prompt construction, ``<new_description>``
parsing, the 1024-char shorten safety net) but routes the LLM call through
``pi -p`` instead of ``claude -p``.

Usage:
    python -m scripts.improve_description_pi --eval-results r.json --skill-path <skill> --model <id>
"""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
from pathlib import Path

from scripts import improve_description as _base
from scripts.utils import parse_skill_md


def _call_pi(prompt: str, model: str | None, timeout: int = 300) -> str:
    """Run `pi -p` (text mode) with the prompt on stdin and return the response."""
    cmd = ["pi", "-p", "--mode", "text"]
    if model:
        cmd.extend(["--model", model])
    # Same nesting guard as the Claude path: drop CLAUDECODE so a nested,
    # programmatic run does not conflict with an interactive session.
    env = {k: v for k, v in os.environ.items() if k != "CLAUDECODE"}
    result = subprocess.run(cmd, input=prompt, capture_output=True, text=True,
                            env=env, timeout=timeout)
    if result.returncode != 0:
        raise RuntimeError(f"pi -p exited {result.returncode}\nstderr: {result.stderr}")
    return result.stdout


# Route the base improver's single LLM seam through pi, then re-export it.
_base._call_claude = _call_pi
improve_description = _base.improve_description


def main():
    parser = argparse.ArgumentParser(description="Improve a skill description (pi-native)")
    parser.add_argument("--eval-results", required=True, help="Path to eval results JSON (from run_eval_pi.py)")
    parser.add_argument("--skill-path", required=True, help="Path to skill directory")
    parser.add_argument("--history", default=None, help="Path to history JSON (previous attempts)")
    parser.add_argument("--model", required=True, help="Model for improvement")
    parser.add_argument("--verbose", action="store_true")
    args = parser.parse_args()

    skill_path = Path(args.skill_path)
    if not (skill_path / "SKILL.md").exists():
        print(f"Error: No SKILL.md found at {skill_path}", file=sys.stderr)
        sys.exit(1)

    eval_results = json.loads(Path(args.eval_results).read_text())
    history = json.loads(Path(args.history).read_text()) if args.history else []
    name, _, content = parse_skill_md(skill_path)
    current_description = eval_results["description"]

    new_description = improve_description(
        skill_name=name,
        skill_content=content,
        current_description=current_description,
        eval_results=eval_results,
        history=history,
        model=args.model,
    )
    if args.verbose:
        print(f"Improved: {new_description}", file=sys.stderr)

    output = {
        "description": new_description,
        "history": history + [{
            "description": current_description,
            "passed": eval_results["summary"]["passed"],
            "failed": eval_results["summary"]["failed"],
            "total": eval_results["summary"]["total"],
            "results": eval_results["results"],
        }],
    }
    print(json.dumps(output, indent=2))


if __name__ == "__main__":
    main()
