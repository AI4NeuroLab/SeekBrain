#!/usr/bin/env python3
"""
Resolve NeuroScientist targeted skills without changing the existing skill flow.

The script is intentionally a thin wrapper around the project implementation:
- existing skills are loaded through SkillLoader.load(...)
- missed skills can fall back to query_paper_rag(...) and
  generate_skill_from_paper_repo(...) + load_skill_without_code(...)
- output is a small JSON contract for the Pi main agent
"""

from __future__ import annotations

import argparse
import contextlib
import io
import json
import os
import sys
import traceback
import uuid
from pathlib import Path
from typing import Any, Dict, List, Optional


DEFAULT_SKILL_DIR = "library/skills/trajectory"
DEFAULT_GENERATED_SKILL_DIR = "library/skills/from_rag"
DEFAULT_RESOURCE_FILTER = {"suffixes": [".md", ".py"], "max_files": 5}


def _read_payload(input_path: Optional[str]) -> Dict[str, Any]:
    if input_path:
        return json.loads(Path(input_path).read_text(encoding="utf-8"))
    raw = sys.stdin.read()
    return json.loads(raw) if raw.strip() else {}


def _write_json(payload: Dict[str, Any]) -> None:
    print(json.dumps(payload, ensure_ascii=False, indent=2))


def _write_json_file(path: str, payload: Dict[str, Any]) -> None:
    target = Path(path).expanduser().resolve()
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def _emit_result(payload: Dict[str, Any], output_path: Optional[str]) -> None:
    if output_path:
        _write_json_file(output_path, payload)
    else:
        _write_json(payload)


def _append_log_path(payload: Dict[str, Any], log_path: Optional[str]) -> Dict[str, Any]:
    if not log_path:
        return payload
    details = payload.setdefault("details", {})
    details["log_path"] = str(Path(log_path).expanduser().resolve())
    return payload


def _as_bool(value: Any, default: bool) -> bool:
    if value is None:
        return default
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        return value.lower() not in {"0", "false", "no", "off"}
    return bool(value)


def _resolve_project_dir(payload: Dict[str, Any]) -> Path:
    explicit = payload.get("project_dir") or os.getenv("NEURO_PROJECT_DIR")
    if explicit:
        return Path(explicit).expanduser().resolve()
    root_dir = Path(payload.get("root_dir") or os.getenv("ROOT_DIR") or Path.cwd()).expanduser().resolve()
    default_modules = root_dir / "internagent" / "modules"
    if default_modules.exists():
        return default_modules
    return Path(__file__).resolve().parents[1]


def _safe_write(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")


def _trace_artifacts(trace_dir: Optional[str], trace: Dict[str, Any], targeted_skill: str) -> Dict[str, str]:
    if not trace_dir:
        return {}
    trace_path = Path(trace_dir).expanduser().resolve()
    trace_path.mkdir(parents=True, exist_ok=True)
    targeted_skill_path = trace_path / "targeted_skill.md"
    trace_json_path = trace_path / "trace.json"
    _safe_write(targeted_skill_path, targeted_skill)
    _safe_write(trace_json_path, json.dumps(trace, ensure_ascii=False, indent=2))
    return {
        "targeted_skill_md": str(targeted_skill_path),
        "trace_json": str(trace_json_path),
    }


def _resolve_paths(root_dir: Path, paths: List[str]) -> List[str]:
    resolved: List[str] = []
    seen = set()
    for raw in paths:
        if not raw:
            continue
        path = Path(raw).expanduser()
        if not path.is_absolute():
            path = root_dir / path
        value = str(path.resolve())
        if value not in seen:
            resolved.append(value)
            seen.add(value)
    return resolved


def _existing_reference_dirs(skill_paths: List[str]) -> List[str]:
    refs: List[str] = []
    seen = set()
    for raw in skill_paths:
        for candidate in (Path(raw) / "references", Path(raw) / "references" / "matched_files"):
            if candidate.exists() and candidate.is_dir():
                value = str(candidate.resolve())
                if value not in seen:
                    refs.append(value)
                    seen.add(value)
    return refs


def _result(
    *,
    ok: bool,
    matched: bool,
    source: str,
    targeted_skill: str = "",
    skill_paths: Optional[List[str]] = None,
    reference_paths: Optional[List[str]] = None,
    generated: bool = False,
    warnings: Optional[List[str]] = None,
    trace_id: Optional[str] = None,
    artifacts: Optional[Dict[str, str]] = None,
    error: Optional[str] = None,
    details: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    payload: Dict[str, Any] = {
        "ok": ok,
        "matched": matched,
        "source": source,
        "targeted_skill": targeted_skill,
        "skill_paths": skill_paths or [],
        "reference_paths": reference_paths or [],
        "generated": generated,
        "warnings": warnings or [],
        "trace_id": trace_id or str(uuid.uuid4()),
    }
    if artifacts:
        payload["artifacts"] = artifacts
    if error:
        payload["error"] = error
    if details:
        payload["details"] = details
    return payload


def resolve(payload: Dict[str, Any]) -> Dict[str, Any]:
    trace_id = payload.get("trace_id") or str(uuid.uuid4())
    warnings: List[str] = []
    question = str(payload.get("question") or "").strip()
    if not question:
        return _result(
            ok=False,
            matched=False,
            source="none",
            warnings=["question is required"],
            trace_id=trace_id,
            error="question is required",
        )

    project_dir = _resolve_project_dir(payload)
    if not project_dir.exists():
        return _result(
            ok=False,
            matched=False,
            source="none",
            warnings=[f"project_dir does not exist: {project_dir}"],
            trace_id=trace_id,
            error=f"project_dir does not exist: {project_dir}",
        )

    sys.path.insert(0, str(project_dir))
    os.environ.setdefault("ROOT_DIR", str(Path(payload.get("root_dir") or Path.cwd()).resolve()))

    skill_enable = _as_bool(payload.get("skill_enable"), True)
    match_skill_enable = _as_bool(payload.get("match_skill_enable"), True)
    generate_skill_enable = _as_bool(payload.get("generate_skill_enable"), True)
    if not skill_enable:
        trace = {"trace_id": trace_id, "question": question, "skill_enable": False}
        artifacts = _trace_artifacts(payload.get("trace_dir"), trace, "")
        return _result(
            ok=True,
            matched=False,
            source="none",
            warnings=["skill module disabled"],
            trace_id=trace_id,
            artifacts=artifacts,
        )

    root_dir = Path(os.environ["ROOT_DIR"]).expanduser().resolve()
    skill_dir = payload.get("skill_dir") or os.getenv("SKILL_DIR") or DEFAULT_SKILL_DIR
    verified_skills_dir = (root_dir / skill_dir).resolve()
    resource_filter = payload.get("resource_filter") or DEFAULT_RESOURCE_FILTER

    matched_skill_paths: List[str] = []
    targeted_skill = ""
    if not match_skill_enable:
        warnings.append("existing targeted skill matching disabled by workflow.level1.targeted_skill_match")
    else:
        # Scan the primary skill_dir plus any extra dirs (e.g. expert-saved skills
        # under library/skills/from_expert). Each dir has its own INDEX.md; the
        # dir whose best match scores highest wins.
        extra_dirs = payload.get("extra_skill_dirs") or []
        candidate_dirs: List[Path] = []
        for d in [skill_dir, *extra_dirs]:
            rd = Path(d).resolve() if Path(d).is_absolute() else (root_dir / d).resolve()
            if rd not in candidate_dirs:
                candidate_dirs.append(rd)
        indexed_dirs = [d for d in candidate_dirs if (d / "INDEX.md").exists()]
        if not indexed_dirs:
            warnings.append(f"no INDEX.md found in any skills dir: {[str(d) for d in candidate_dirs]}")
        else:
            try:
                from targeted_skill.skill_loader import SkillLoader
            except Exception as exc:  # pragma: no cover - runtime environment dependent
                return _result(
                    ok=False,
                    matched=False,
                    source="none",
                    warnings=[f"failed to import SkillLoader from {project_dir}"],
                    trace_id=trace_id,
                    error=str(exc),
                    details={"traceback": traceback.format_exc()},
                )

            model = payload.get("model") or "claude-opus-4-7"
            top_k = int(payload.get("top_k", 1))
            relevance_threshold = float(payload.get("relevance_threshold", 0.3))
            temperature = float(payload.get("temperature", 1.0))
            best_score = -1.0
            stdout_buffer = io.StringIO()
            with contextlib.redirect_stdout(stdout_buffer):
                for d in indexed_dirs:
                    try:
                        loader = SkillLoader(
                            skills_dir=str(d),
                            top_k=top_k,
                            relevance_threshold=relevance_threshold,
                            model=model,
                            temperature=temperature,
                        )
                        text = loader.load(
                            question=question,
                            resource_load_mode="all",
                            resource_filter=resource_filter,
                        )
                        matches = getattr(loader, "last_matched_skills", [])
                    except Exception as exc:
                        warnings.append(f"SkillLoader failed for {d}: {exc}")
                        continue
                    if text and matches:
                        dir_best = max((getattr(s, "score", 0.0) or 0.0) for s in matches)
                        if dir_best > best_score:
                            best_score = dir_best
                            targeted_skill = text
                            matched_skill_paths = [str(s.path.resolve()) for s in matches]
            loader_stdout = stdout_buffer.getvalue()
            if loader_stdout.strip():
                warnings.append("SkillLoader wrote diagnostic stdout; see details.log_path")

    if targeted_skill:
        skill_paths = matched_skill_paths or [str(verified_skills_dir)]
        reference_paths = _existing_reference_dirs(skill_paths)
        trace = {
            "trace_id": trace_id,
            "question": question,
            "source": "existing_skill",
            "skills_dir": str(verified_skills_dir),
            "skill_paths": skill_paths,
            "reference_paths": reference_paths,
            "warnings": warnings,
        }
        artifacts = _trace_artifacts(payload.get("trace_dir"), trace, targeted_skill)
        return _result(
            ok=True,
            matched=True,
            source="existing_skill",
            targeted_skill=targeted_skill,
            skill_paths=skill_paths,
            reference_paths=reference_paths,
            generated=False,
            warnings=warnings,
            trace_id=trace_id,
            artifacts=artifacts,
        )

    if not generate_skill_enable:
        trace = {
            "trace_id": trace_id,
            "question": question,
            "source": "none",
            "skills_dir": str(verified_skills_dir),
            "generate_skill_enable": False,
            "warnings": warnings,
        }
        artifacts = _trace_artifacts(payload.get("trace_dir"), trace, "")
        return _result(
            ok=True,
            matched=False,
            source="none",
            warnings=warnings,
            trace_id=trace_id,
            artifacts=artifacts,
        )

    try:
        from targeted_skill.rag_paper import query_paper_rag, rag_result_items
        from targeted_skill.single_skill.skill_fun import generate_skill_from_paper_repo
        from targeted_skill.load_skill_by_name import load_skill_without_code
    except Exception as exc:  # pragma: no cover - runtime environment dependent
        warnings.append("RAG fallback imports failed")
        trace = {
            "trace_id": trace_id,
            "question": question,
            "source": "none",
            "skills_dir": str(verified_skills_dir),
            "warnings": warnings,
            "error": str(exc),
            "traceback": traceback.format_exc(),
        }
        artifacts = _trace_artifacts(payload.get("trace_dir"), trace, "")
        return _result(
            ok=True,
            matched=False,
            source="none",
            warnings=warnings,
            trace_id=trace_id,
            artifacts=artifacts,
            error=str(exc),
        )

    loaded_skills: List[str] = []
    generated_paths: List[str] = []
    rag_raw = query_paper_rag(
        query=question,
        top_k=int(payload.get("rag_top_k", 2)),
        require_github=True,
    )
    rag_items = rag_result_items(rag_raw)
    for item in rag_items:
        title = item.get("title", "")
        paper_content = item.get("full_text", "")
        github_links = item.get("github_links", [])
        if not github_links:
            warnings.append(f"Skipping paper without github links: {title}")
            continue
        repo_link = github_links[0]
        generated_dir = _resolve_paths(root_dir, [payload.get("generated_skill_output_dir") or DEFAULT_GENERATED_SKILL_DIR])[0]
        skill_path = generate_skill_from_paper_repo(question, title, paper_content, repo_link, generated_dir)
        single_skill = load_skill_without_code(skill_path)
        generated_paths.append(str(skill_path))
        loaded_skills.append(f"### Skill from: {title} ({repo_link})\n\n{single_skill}")

    generated_paths = _resolve_paths(root_dir, generated_paths)
    reference_paths = _existing_reference_dirs(generated_paths)
    targeted_skill = "\n\n---\n\n".join(loaded_skills)
    trace = {
        "trace_id": trace_id,
        "question": question,
        "source": "generated_from_rag" if targeted_skill else "none",
        "skills_dir": str(verified_skills_dir),
        "generated_paths": generated_paths,
        "reference_paths": reference_paths,
        "warnings": warnings,
    }
    artifacts = _trace_artifacts(payload.get("trace_dir"), trace, targeted_skill)
    if targeted_skill:
        return _result(
            ok=True,
            matched=True,
            source="generated_from_rag",
            targeted_skill=targeted_skill,
            skill_paths=generated_paths,
            reference_paths=reference_paths,
            generated=True,
            warnings=warnings,
            trace_id=trace_id,
            artifacts=artifacts,
        )

    warnings.append("SkillLoader missed and RAG did not produce usable generated skills")
    return _result(
        ok=True,
        matched=False,
        source="none",
        warnings=warnings,
        trace_id=trace_id,
        artifacts=artifacts,
    )


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", help="JSON input file. Defaults to stdin.")
    parser.add_argument("--output", help="Write JSON result to this file instead of stdout.")
    parser.add_argument("--log", help="Write diagnostic stdout/stderr to this file.")
    args = parser.parse_args()

    try:
        payload = _read_payload(args.input)
        if args.log:
            log_path = Path(args.log).expanduser().resolve()
            log_path.parent.mkdir(parents=True, exist_ok=True)
            with log_path.open("a", encoding="utf-8") as log_file:
                with contextlib.redirect_stdout(log_file), contextlib.redirect_stderr(log_file):
                    result = resolve(payload)
        else:
            result = resolve(payload)
        _append_log_path(result, args.log)
        _emit_result(result, args.output)
        return 0
    except Exception as exc:  # pragma: no cover - defensive CLI boundary
        _emit_result(
            _append_log_path(_result(
                ok=False,
                matched=False,
                source="none",
                warnings=["unhandled resolve_targeted_skill error"],
                error=str(exc),
                details={"traceback": traceback.format_exc()},
            ), args.log),
            args.output,
        )
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
