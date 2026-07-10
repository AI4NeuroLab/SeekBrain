#!/usr/bin/env python3
"""pi-native trigger evaluation for a skill description.

The Claude-specific ``run_eval.py`` drives ``claude -p`` and parses stream events.
This variant instead evaluates the ACTUAL runtime matcher used by the SeekBrain
targeted-skill system: ``internagent/modules/targeted_skill/skill_loader.SkillLoader``
(an LLM router over ``INDEX.md``). For each query it builds an ephemeral one-entry
index using the *description under test* and checks whether the skill is matched.
This tests the real production trigger path deterministically-ish, with no
subprocess or stream parsing.

Output contract matches ``run_eval.py`` so ``run_loop_pi`` / ``improve_description_pi``
consume it unchanged.

Usage (run as a module from the skill-creator dir):
    python -m scripts.run_eval_pi --eval-set trigger.json --skill-path <skill> --verbose
"""

from __future__ import annotations

import argparse
import contextlib
import io
import json
import os
import re
import shutil
import sys
import tempfile
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from scripts.utils import parse_skill_md

# Set by run_loop_pi when it reuses scripts.run_loop.run_loop (which calls
# run_eval with skill_name/project_root, not skill_path).
_SKILL_PATH: Path | None = None
_RELEVANCE_THRESHOLD: float = 0.3


def _repo_root(start: Path) -> Path:
    for p in [start, *start.parents]:
        if (p / "internagent" / "modules" / "targeted_skill").is_dir():
            return p
    return start


def _ensure_path(repo_root: Path) -> None:
    mod = str(repo_root / "internagent" / "modules")
    if mod not in sys.path:
        sys.path.insert(0, mod)


def _sanitize_desc(desc: str) -> str:
    desc = re.sub(r"(?m)^\s*#{1,6}\s*", "", desc or "")
    return " ".join(desc.split()) or "(no description)"


def _build_index_dir(skill_path: Path, description: str) -> tuple[Path, str]:
    folder = skill_path.name
    tmp = Path(tempfile.mkdtemp(prefix="skilleval_"))
    link = tmp / folder
    try:
        os.symlink(skill_path.resolve(), link, target_is_directory=True)
    except OSError:
        shutil.copytree(skill_path.resolve(), link)
    (tmp / "INDEX.md").write_text(
        f"# Skills Index\n\n## `{folder}`\n{_sanitize_desc(description)}\n", encoding="utf-8"
    )
    return tmp, folder


def _loader_triggers(query: str, skills_dir: Path, folder: str, model: str,
                     relevance_threshold: float) -> bool:
    """Return True if SkillLoader matches this skill for the query."""
    from targeted_skill.skill_loader import SkillLoader  # noqa: E402
    buf = io.StringIO()
    with contextlib.redirect_stdout(buf):
        loader = SkillLoader(skills_dir=str(skills_dir), top_k=3,
                             relevance_threshold=relevance_threshold, model=model)
        loader.load(question=query, resource_load_mode="all")
        matched = {getattr(s, "name", "") for s in getattr(loader, "last_matched_skills", [])}
    return folder in matched


def run_eval(eval_set, skill_name=None, description="", num_workers=4, timeout=None,
             project_root=None, runs_per_query=1, trigger_threshold=0.5,
             relevance_threshold=None, model=None, skill_path=None, **_):
    """Evaluate trigger accuracy of `description` against the SkillLoader matcher.

    Signature is a superset of run_eval.py's so run_loop can call it unchanged
    (it passes skill_name/project_root/timeout, which we accept and ignore). The
    skill FOLDER comes from `skill_path` or the module-global `_SKILL_PATH`.
    """
    sp = Path(skill_path or _SKILL_PATH)
    rel = _RELEVANCE_THRESHOLD if relevance_threshold is None else relevance_threshold
    _ensure_path(_repo_root(sp.resolve()))
    skills_dir, folder = _build_index_dir(sp, description)

    query_triggers: dict[str, list[bool]] = {}
    query_items: dict[str, dict] = {}
    try:
        with ThreadPoolExecutor(max_workers=max(1, num_workers)) as ex:
            futures = []
            for item in eval_set:
                for _run in range(runs_per_query):
                    fut = ex.submit(_loader_triggers, item["query"], skills_dir, folder,
                                    model or "claude-opus-4-7", rel)
                    futures.append((fut, item))
            for fut, item in futures:
                q = item["query"]
                query_items[q] = item
                query_triggers.setdefault(q, [])
                try:
                    query_triggers[q].append(bool(fut.result()))
                except Exception as exc:
                    print(f"Warning: query failed: {exc}", file=sys.stderr)
                    query_triggers[q].append(False)
    finally:
        shutil.rmtree(skills_dir, ignore_errors=True)

    results = []
    for q, trig in query_triggers.items():
        item = query_items[q]
        rate = sum(trig) / len(trig)
        should = item.get("should_trigger", True)
        did = (rate >= trigger_threshold) if should else (rate < trigger_threshold)
        results.append({"query": q, "should_trigger": should, "trigger_rate": rate,
                        "triggers": sum(trig), "runs": len(trig), "pass": did})
    passed = sum(1 for r in results if r["pass"])
    total = len(results)
    name = skill_name or (parse_skill_md(sp)[0] if (sp / "SKILL.md").exists() else folder)
    return {"skill_name": name, "description": description, "results": results,
            "summary": {"total": total, "passed": passed, "failed": total - passed}}


def main():
    ap = argparse.ArgumentParser(description="pi-native trigger eval (SkillLoader matcher)")
    ap.add_argument("--eval-set", required=True)
    ap.add_argument("--skill-path", required=True)
    ap.add_argument("--description", default=None)
    ap.add_argument("--num-workers", type=int, default=4)
    ap.add_argument("--runs-per-query", type=int, default=3)
    ap.add_argument("--trigger-threshold", type=float, default=0.5)
    ap.add_argument("--relevance-threshold", type=float, default=0.3)
    ap.add_argument("--model", default=None)
    ap.add_argument("--verbose", action="store_true")
    args = ap.parse_args()

    eval_set = json.loads(Path(args.eval_set).read_text())
    skill_path = Path(args.skill_path)
    name, original_description, _ = parse_skill_md(skill_path)
    description = args.description or original_description
    out = run_eval(eval_set, skill_name=name, description=description, skill_path=skill_path,
                   num_workers=args.num_workers, runs_per_query=args.runs_per_query,
                   trigger_threshold=args.trigger_threshold,
                   relevance_threshold=args.relevance_threshold, model=args.model)
    if args.verbose:
        s = out["summary"]
        print(f"Results: {s['passed']}/{s['total']} passed", file=sys.stderr)
        for r in out["results"]:
            status = "PASS" if r["pass"] else "FAIL"
            print(f"  [{status}] rate={r['triggers']}/{r['runs']} expected={r['should_trigger']}: {r['query'][:70]}", file=sys.stderr)
    print(json.dumps(out, indent=2))


if __name__ == "__main__":
    main()
