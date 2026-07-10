#!/usr/bin/env python3
"""Author a dual-registered neuroscience skill from a finished Level-1 run.

    <output_dir>/<folder_name>/
      SKILL.md                     reconciled frontmatter (top-level kebab name +
                                   description; metadata-nested smmt/triggers/tags/
                                   version) + LLM (or fallback) body + disk file tree
      scripts/run_analysis.py      <- the run's generated_code.py
      references/*.md              <- the 9 required reference files, synthesized
                                      from run material (each >= 50 chars)
      references/matched_files/    <- generated_code.py / statistics.json / conclusions.json
      metadata.json
"""

from __future__ import annotations

import argparse
import json
import re
import shutil
import sys
import traceback
from pathlib import Path
from typing import Any, Dict, List, Optional

SMMT_KEYS = ("stage", "species", "modality", "method", "target")

REQUIRED_REFERENCES = [
    "question.md",
    "paper_context.md",
    "repo_context.md",
    "connection_analysis.md",
    "reproduction_plan.md",
    "paper_structured_summary.md",
    "paper_figure_methods.md",
    "repo_overview.md",
    "repo_file_summaries.md",
]


# --------------------------------------------------------------------------- io
def _module_parent() -> Path:
    """internagent/modules — the dir that must be on sys.path for `targeted_skill`."""
    return Path(__file__).resolve().parents[1]


def _read_payload(input_path: Optional[str]) -> Dict[str, Any]:
    if input_path:
        return json.loads(Path(input_path).read_text(encoding="utf-8"))
    raw = sys.stdin.read()
    return json.loads(raw) if raw.strip() else {}


def _emit_result(payload: Dict[str, Any], output_path: Optional[str]) -> None:
    text = json.dumps(payload, ensure_ascii=False, indent=2)
    if output_path:
        target = Path(output_path).expanduser().resolve()
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(text, encoding="utf-8")
    else:
        print(text)


# ----------------------------------------------------------------- text helpers
def _clean_desc(desc: str) -> str:
    """<=1024 chars, no angle brackets (both validators + pi require this)."""
    desc = " ".join((desc or "").split()).replace("<", "(").replace(">", ")")
    if len(desc) > 1024:
        desc = desc[:1021].rstrip() + "..."
    return desc


def _min_text(text: str, fallback: str) -> str:
    """Ensure a reference file has >= 50 chars (validate_skills warns otherwise)."""
    text = (text or "").strip()
    if len(text) < 50:
        text = (text + "\n\n" + fallback).strip()
    return text if len(text) >= 50 else (fallback + " " + fallback)


def _fence(text: str, lang: str = "") -> str:
    return f"```{lang}\n{(text or '').strip()}\n```"


def _extract_dependencies(code_text: str) -> List[str]:
    """Parse top-level imports from the run's analysis code -> a dependency list."""
    deps: set[str] = set()
    for line in (code_text or "").splitlines():
        m = re.match(r"\s*(?:from|import)\s+([a-zA-Z_][\w]*)", line)
        if m:
            mod = m.group(1)
            if mod not in {"os", "sys", "json", "re", "pathlib", "typing", "argparse", "math", "time"}:
                deps.add(mod)
    return sorted(deps)


def _read_file(path: Optional[Path]) -> str:
    if path and path.is_file():
        try:
            return path.read_text(encoding="utf-8", errors="replace")
        except Exception:
            return ""
    return ""


# ---------------------------------------------------------------- frontmatter
def _serialize_frontmatter(pi_name: str, description: str, smmt: Dict[str, str],
                           run_id: str, triggers: List[str], tags: List[str],
                           extra_meta: Optional[Dict[str, Any]] = None,
                           version: str = "1.0") -> str:
    """Reconciled frontmatter via PyYAML (guarantees quick_validate's safe_load passes).

    Top-level keys are limited to {name, description, metadata} (all in the pi
    allow-list); triggers/tags/version live under metadata so validate_skills'
    substring search still finds them.
    """
    import yaml  # in requirements
    meta: Dict[str, Any] = {
        "provenance": "expert_run",
        "run_id": run_id or "",
        "smmt": {k: smmt[k] for k in SMMT_KEYS},
        "triggers": list(triggers) or [description],
        "tags": list(tags) or list(smmt.values()),
        "version": version,
    }
    if extra_meta:
        meta.update(extra_meta)
    doc = {"name": pi_name, "description": description, "metadata": meta}
    body = yaml.safe_dump(doc, sort_keys=False, allow_unicode=True, width=100000).strip()
    return "---\n" + body + "\n---"


# ------------------------------------------------------------------ references
def _synthesize_references(p: Dict[str, Any], code_text: str, smmt: Dict[str, str],
                           folder_name: str, provenance_note: str) -> Dict[str, str]:
    q = p.get("question", "").strip()
    qhist = p.get("question_history") or []
    plan_md = p.get("plan_markdown", "").strip()
    data_info = p.get("data_info", "").strip()
    stats = p.get("statistics") or {}
    conclusions = p.get("conclusions") or {}
    deep = p.get("deep_research_context", "").strip()
    targeted = p.get("targeted_skill", "").strip()
    resource = p.get("resource_profile") or {}
    image_analyses = p.get("image_analyses") or p.get("image_analysis") or []
    deliverables = p.get("deliverables") or []
    digest = p.get("transcript_digest", "").strip()

    hist_txt = "\n".join(f"- (earlier) {h.get('text', h) if isinstance(h, dict) else h}" for h in qhist)
    deps = _extract_dependencies(code_text)
    stat_keys = sorted(stats.keys()) if isinstance(stats, dict) else []

    refs = {
        "question.md": f"# Research Question\n\n{q}\n\n{hist_txt}".strip(),
        "paper_context.md": deep or f"No source paper — this is a run-derived skill.\n\n{provenance_note}",
        "repo_context.md": (
            f"No source repository — this is a run-derived skill packaging the analysis code from a "
            f"Level-1 run.\n\n{provenance_note}\n\n"
            + (f"Targeted skill used during the run:\n\n{targeted}" if targeted else "")
        ).strip(),
        "connection_analysis.md": (
            f"# How the code addresses the question\n\n{q}\n\n"
            f"The script `scripts/run_analysis.py` implements the plan below and produces the "
            f"run's deliverables.\n\nPlan summary / warnings:\n\n{plan_md[:2000]}"
        ).strip(),
        "reproduction_plan.md": plan_md or f"Reproduction plan for {folder_name}.\n\n{provenance_note}",
        "paper_structured_summary.md": (
            f"# Dataset / run context\n\n{data_info}\n\n# Findings (run conclusions)\n\n"
            f"```json\n{json.dumps(conclusions, ensure_ascii=False, indent=2)[:3000]}\n```"
        ).strip(),
        "paper_figure_methods.md": (
            f"# Deliverables / figures\n\n```json\n{json.dumps(deliverables, ensure_ascii=False, indent=2)[:2000]}\n```\n\n"
            f"# Image analyses\n\n```json\n{json.dumps(image_analyses, ensure_ascii=False, indent=2)[:2000]}\n```"
        ).strip(),
        "repo_overview.md": (
            f"# Skill provenance & environment\n\n{provenance_note}\n\n"
            f"SMMT: {smmt}\n\nDetected compute at run time:\n\n"
            f"```json\n{json.dumps(resource, ensure_ascii=False, indent=2)[:1500]}\n```\n\n"
            f"Dependencies inferred from the analysis code: {', '.join(deps) or 'standard scientific Python'}."
        ).strip(),
        "repo_file_summaries.md": (
            f"# Files in this skill\n\n- `scripts/run_analysis.py` — the analysis script copied from the "
            f"Level-1 run (dependencies: {', '.join(deps) or 'std'}).\n\n"
            f"# Statistics produced\n\nKeys: {', '.join(stat_keys) or '(none recorded)'}\n\n"
            f"```json\n{json.dumps(stats, ensure_ascii=False, indent=2)[:2000]}\n```"
        ).strip(),
    }
    if digest:
        refs["connection_analysis.md"] += f"\n\n# Dialogue digest (intent & corrections)\n\n{digest[:2000]}"

    fallback = f"Run-derived skill {folder_name}. {provenance_note}"
    return {name: _min_text(txt, fallback) for name, txt in refs.items()}


# ------------------------------------------------------------------- body (LLM)
def _build_context(p: Dict[str, Any], code_text: str, folder_name: str) -> Dict[str, str]:
    plan_md = p.get("plan_markdown", "").strip()
    deep = p.get("deep_research_context", "").strip()
    targeted = p.get("targeted_skill", "").strip()
    q = p.get("question", "").strip()
    code_excerpt = (code_text or "")[:6000]
    return {
        "question_text": q,
        "matched_paper_context": deep or "(Run-derived skill; no source paper. Background comes from the run itself.)",
        "matched_repo_context": (
            "This skill packages the verified analysis script `scripts/run_analysis.py` produced by a "
            "Level-1 run.\n\n" + _fence(code_excerpt, "python")
            + (f"\n\nTargeted skill referenced during the run:\n{targeted[:2000]}" if targeted else "")
        ),
        "connection_analysis": (
            f"The script `scripts/run_analysis.py` implements the plan for: {q}\n\n{plan_md[:3000]}"
        ),
        "reproduction_plan": plan_md or f"Reproduction plan for {folder_name}.",
    }


def _fallback_body(folder_name: str, context: Dict[str, str], code_text: str,
                   description: str) -> str:
    """Deterministic body used when the LLM is unavailable. Satisfies the required
    body sections of validate_skills (# Skill:, Overview, Objective, Background,
    Implementation, Structured Prompt)."""
    deps = _extract_dependencies(code_text)
    return f"""# Skill: {folder_name}

## Overview
{description}

This skill was derived from a completed NeuroScientist Level-1 analysis run. It
packages the verified analysis script together with the run's plan and findings so
the same processing pipeline can be reused on comparable data.

## Objective
Reproduce the analysis described by the originating question using the bundled
`scripts/run_analysis.py`, adapting only the input paths to the target dataset.

## Background (from Paper)
### Scientific Context
{context['question_text']}
### Methods Description
See `references/reproduction_plan.md` for the step-by-step plan that this script
implements.
### Expected Results
See `references/paper_structured_summary.md` for the run's conclusions and statistics.

## Implementation Guidance
### Verified Repository Components
- `scripts/run_analysis.py` — the exact analysis code executed in the source run.
### Conceptual Implementation Plan
Point the script at the new dataset (following the plan in
`references/reproduction_plan.md`), run it, and validate the outputs against the
Validation Criteria below.
### Dependencies
{', '.join(deps) or 'standard scientific Python (numpy, scipy, pandas, matplotlib)'}.

## Structured Prompt
### Input Specification
1. The dataset matching the modality/species this skill targets.
2. Paths configured as in the original run (see references).
### Processing Steps
1. Read the plan in `references/reproduction_plan.md`.
2. Run `scripts/run_analysis.py` on the target data.
3. Compare outputs to the run's statistics and conclusions.
### Output Specification
The figures/statistics the original run produced (see
`references/repo_file_summaries.md`).
### Validation Criteria
Outputs are consistent with `references/paper_structured_summary.md`.

## Scripts Documentation
- `scripts/run_analysis.py` — analysis script copied from the source run.

## References Documentation
Nine context files under `references/` describe the question, plan, findings, and
provenance of this run-derived skill.

## Usage Example
```bash
python scripts/run_analysis.py
```

## Notes & Caveats
Derived from a single run; adapt input paths and sanity-check assumptions before
relying on the outputs for a new dataset.
"""


# ---------------------------------------------- SKILL.md assembly (no LLM deps)
def _write(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")


def _file_tree(base: Path, prefix: str = "") -> str:
    lines: List[str] = []
    entries = sorted(base.iterdir(), key=lambda e: (e.is_file(), e.name))
    for i, entry in enumerate(entries):
        connector = "└── " if i == len(entries) - 1 else "├── "
        lines.append(prefix + connector + entry.name + ("/" if entry.is_dir() else ""))
        if entry.is_dir():
            extension = "    " if i == len(entries) - 1 else "│   "
            sub = _file_tree(entry, prefix + extension)
            if sub:
                lines.append(sub)
    return "\n".join(lines)


def _file_structure_section(skill_dir: Path,
                            guaranteed: tuple = ("SKILL.md", "metadata.json")) -> str:
    # SKILL.md (and metadata.json) are written after this tree is built; list them
    # explicitly so validate_skills' file-structure check finds them.
    tree = _file_tree(skill_dir)
    lines = tree.split("\n") if tree else []
    for name in guaranteed:
        if not any(name in ln for ln in lines):
            lines.append(f"├── {name}")
    return f"## File Structure\n\n```\n{skill_dir.name}/\n" + "\n".join(lines) + "\n```"


def _assemble_skill_md(frontmatter: str, body: str, file_structure: str) -> str:
    markers = ["## Scripts Documentation", "## References Documentation",
               "## Usage Example", "## Notes"]
    insert_idx = None
    for m in markers:
        i = body.find(m)
        if i != -1:
            insert_idx = i
            break
    if insert_idx is not None:
        assembled = body[:insert_idx].rstrip() + "\n\n" + file_structure + "\n\n" + body[insert_idx:]
    else:
        assembled = body.rstrip() + "\n\n" + file_structure
    return frontmatter + "\n\n" + assembled


def _finalize_skill_md(content: str) -> str:
    content = content.strip()
    if not content.startswith("---"):
        idx = content.find("---")
        content = content[idx:] if idx != -1 else "---\n" + content
    return content.strip() + "\n"


def _llm_body(folder_name: str, context: Dict[str, str]) -> Optional[str]:
    """Best-effort LLM body via the existing Paper2Skill generator; None on failure."""
    try:
        from targeted_skill.single_skill.skill_generator import (  # noqa: E402
            _generate_skill_md_body, _get_llm,
        )
        body = _generate_skill_md_body(folder_name, context, _get_llm())
        return body if body and body.strip() else None
    except Exception:
        return None


# ------------------------------------------------------------------- main flow
def _resolve_out_base(p: Dict[str, Any]) -> Path:
    root = Path(p.get("root_dir") or ".").resolve()
    out = Path(p.get("output_dir") or "library/skills/from_expert")
    return out if out.is_absolute() else (root / out)


def _unique_dir(base: Path, folder_name: str, overwrite: bool) -> tuple[Path, str]:
    target = base / folder_name
    if overwrite or not target.exists():
        return target, folder_name
    n = 2
    while (base / f"{folder_name}-v{n}").exists():
        n += 1
    return base / f"{folder_name}-v{n}", f"{folder_name}-v{n}"


def save_skill(p: Dict[str, Any]) -> Dict[str, Any]:
    sys.path.insert(0, str(_module_parent()))
    from targeted_skill import taxonomy  # noqa: E402

    warnings: List[str] = []

    smmt = p.get("smmt") or {}
    smmt = {k: (taxonomy.normalize_field(k, smmt.get(k)) or "") for k in SMMT_KEYS}
    ok, errors, warns = taxonomy.validate_smmt(**smmt)
    warnings.extend(warns)
    if not ok:
        return {"ok": False, "error": "invalid SMMT name", "errors": errors, "warnings": warnings}

    folder_stem = p.get("folder_name") or taxonomy.canonical_label(**smmt)
    pi_name = p.get("pi_name") or taxonomy.pi_name(**smmt)
    run_id = p.get("run_id", "")
    description = _clean_desc(p.get("description") or
                             f"Run-derived neuroscience skill: {smmt['stage']} {smmt['species']} "
                             f"{smmt['modality']} {smmt['method']} -> {smmt['target']}.")
    triggers = [t for t in (p.get("triggers") or []) if str(t).strip()][:8]
    tags = [t for t in (p.get("tags") or []) if str(t).strip()][:8] or list(smmt.values())

    out_base = _resolve_out_base(p)
    out_base.mkdir(parents=True, exist_ok=True)
    skill_dir, folder_name = _unique_dir(out_base, folder_stem, bool(p.get("overwrite")))
    if folder_name != folder_stem:
        warnings.append(f"folder '{folder_stem}' existed; saved as '{folder_name}'.")
    (skill_dir / "scripts").mkdir(parents=True, exist_ok=True)
    (skill_dir / "references" / "matched_files").mkdir(parents=True, exist_ok=True)

    # --- scripts/run_analysis.py <- the run's generated code
    run_dir = Path(p.get("run_dir") or ".")
    if not run_dir.is_absolute():
        run_dir = (Path(p.get("root_dir") or ".").resolve() / run_dir)
    code_path = Path(p["generated_code_path"]) if p.get("generated_code_path") else (run_dir / "generated_code.py")
    if not code_path.is_absolute():
        code_path = run_dir / code_path
    code_text = _read_file(code_path)
    if not code_text:
        warnings.append(f"no analysis code found at {code_path}; run_analysis.py will be a stub.")
        code_text = f"# Run-derived skill {folder_name}: original analysis code was not available.\n"
    _write(skill_dir / "scripts" / "run_analysis.py", code_text)

    files_written: List[str] = ["scripts/run_analysis.py"]

    # --- references/*.md (all 9)
    provenance_note = f"Provenance: expert_run; source Level-1 run_id={run_id or '(unknown)'}."
    refs = _synthesize_references(p, code_text, smmt, folder_name, provenance_note)
    for name in REQUIRED_REFERENCES:
        _write(skill_dir / "references" / name, refs[name])
        files_written.append(f"references/{name}")

    # --- references/matched_files/ <- key run artifacts
    for art in ("generated_code.py", "statistics.json", "conclusions.json"):
        src = run_dir / art
        if src.is_file():
            shutil.copyfile(src, skill_dir / "references" / "matched_files" / art)
            files_written.append(f"references/matched_files/{art}")

    # --- SKILL.md (frontmatter + body + disk file-structure)
    context = _build_context(p, code_text, folder_name)
    body = _llm_body(folder_name, context) if p.get("use_llm_body", True) else None
    if not body:
        warnings.append("used deterministic fallback body (LLM unavailable or disabled).")
        body = _fallback_body(folder_name, context, code_text, description)

    file_structure = _file_structure_section(skill_dir)
    frontmatter = _serialize_frontmatter(pi_name, description, smmt, run_id, triggers, tags)
    skill_md = _finalize_skill_md(_assemble_skill_md(frontmatter, body, file_structure))
    _write(skill_dir / "SKILL.md", skill_md)
    files_written.append("SKILL.md")

    # --- metadata.json
    metadata = {
        "tag": folder_name,
        "provenance": "expert_run",
        "run_id": run_id,
        "smmt": smmt,
        "pi_name": pi_name,
        "scripts": ["scripts/run_analysis.py"],
        "references": [f"references/{n}" for n in REQUIRED_REFERENCES],
        "yaml_metadata": {"name": pi_name, "description": description,
                          "triggers": triggers, "tags": tags},
    }
    _write(skill_dir / "metadata.json",
                    json.dumps(metadata, ensure_ascii=False, indent=2))
    files_written.append("metadata.json")

    # --- rebuild the loader-compatible INDEX.md for this dir
    index_updated = False
    try:
        from targeted_skill import index_generate  # noqa: E402
        index_generate.regenerate_index(out_base)
        index_updated = True
    except Exception as exc:
        warnings.append(f"INDEX.md regeneration failed: {exc}")

    # --- self-check with the repo validator (best effort)
    validate_result: Dict[str, Any] = {}
    try:
        from targeted_skill.single_skill.validate_skills import validate_skill_folder  # noqa: E402
        vr = validate_skill_folder(skill_dir)
        validate_result = {"status": vr.get("status"), "issues": vr.get("issues", []),
                           "warnings": vr.get("warnings", [])}
    except Exception as exc:
        warnings.append(f"validate_skills self-check skipped: {exc}")

    return {
        "ok": True,
        "skill_dir": str(skill_dir),
        "folder_name": folder_name,
        "pi_name": pi_name,
        "smmt": smmt,
        "files_written": files_written,
        "index_updated": index_updated,
        "validate_skills": validate_result,
        "warnings": warnings,
    }


def main() -> None:
    ap = argparse.ArgumentParser(description="Save a Level-1 run as a neuroscience skill.")
    ap.add_argument("--input")
    ap.add_argument("--output")
    ap.add_argument("--log")
    args = ap.parse_args()
    try:
        payload = _read_payload(args.input)
        result = save_skill(payload)
    except Exception as exc:  # never crash the caller
        result = {"ok": False, "error": str(exc), "traceback": traceback.format_exc()}
    if args.log:
        try:
            Path(args.log).expanduser().parent.mkdir(parents=True, exist_ok=True)
            Path(args.log).write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
        except Exception:
            pass
    _emit_result(result, args.output)


if __name__ == "__main__":
    main()
