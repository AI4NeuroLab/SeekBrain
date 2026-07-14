#!/usr/bin/env python3
"""Transactional snapshots for Nature Figure code-driven revisions."""

from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import os
from pathlib import Path
import shutil
import sys
import uuid


SAFE_RELATED_KINDS = {"figure", "statistics", "json", "markdown", "log"}


def utc_now() -> str:
    return dt.datetime.now(dt.timezone.utc).isoformat()


def short_timestamp() -> str:
    return dt.datetime.now(dt.timezone.utc).strftime("%Y%m%d-%H%M%S")


def read_json(path: Path, default=None):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (FileNotFoundError, json.JSONDecodeError, OSError):
        return default


def write_json(path: Path, value) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(f".{path.name}.{uuid.uuid4().hex}.tmp")
    temporary.write_text(json.dumps(value, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    os.replace(temporary, path)


def resolve_from(base: Path, value: str | Path) -> Path:
    candidate = Path(value).expanduser()
    return (candidate if candidate.is_absolute() else base / candidate).resolve()


def artifact_path(work_dir: Path, artifact: dict) -> Path | None:
    raw = artifact.get("path")
    if not isinstance(raw, str) or not raw.strip():
        return None
    return resolve_from(work_dir, raw)


def produced_by_path(work_dir: Path, artifact: dict) -> Path | None:
    raw = artifact.get("produced_by")
    if not isinstance(raw, str) or not raw.strip():
        return None
    return resolve_from(work_dir, raw)


def safe_backup_name(work_dir: Path, source: Path) -> Path:
    try:
        relative = source.resolve().relative_to(work_dir.resolve())
        if "figure_revisions" not in relative.parts:
            return relative
    except ValueError:
        pass
    prefix = hashlib.sha256(str(source).encode("utf-8")).hexdigest()[:12]
    return Path("_external") / f"{prefix}_{source.name}"


def collect_related(work_dir: Path, code: Path, figure: Path) -> list[tuple[Path, str]]:
    selected: dict[str, tuple[Path, str]] = {
        str(code): (code, "code"),
        str(figure): (figure, "figure"),
    }
    state = read_json(work_dir / "state.json", {}) or {}
    artifacts = state.get("artifacts") if isinstance(state.get("artifacts"), list) else []
    for artifact in artifacts:
        if not isinstance(artifact, dict):
            continue
        path = artifact_path(work_dir, artifact)
        if path is None or not path.is_file():
            continue
        producer = produced_by_path(work_dir, artifact)
        kind = str(artifact.get("kind") or "other")
        if (producer == code and kind == "figure") or (kind in SAFE_RELATED_KINDS and path == figure):
            selected[str(path)] = (path, kind)

    # Preserve same-stem publication exports even when an older state file did
    # not declare them explicitly.
    for suffix in (".png", ".jpg", ".jpeg", ".webp", ".pdf", ".svg", ".tif", ".tiff"):
        sibling = figure.with_suffix(suffix)
        if sibling.is_file():
            selected.setdefault(str(sibling), (sibling, "figure"))
    return sorted(selected.values(), key=lambda item: str(item[0]))


def snapshot_files(work_dir: Path, target_dir: Path, sources: list[tuple[Path, str]]) -> list[dict]:
    records: list[dict] = []
    for source, kind in sources:
        if not source.is_file():
            continue
        relative_backup = safe_backup_name(work_dir, source)
        backup = target_dir / relative_backup
        backup.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, backup)
        records.append({
            "original_path": str(source),
            "backup_path": str(backup),
            "kind": kind,
        })
    return records


def archived_entries(revision: dict) -> list[dict]:
    """Return v2 archives, while retaining rollback support for v1 records."""
    entries = revision.get("archived")
    if isinstance(entries, list):
        return entries
    legacy = revision.get("before")
    return legacy if isinstance(legacy, list) else []


def release_lock(revision: dict) -> None:
    raw = revision.get("lock_path")
    if not raw:
        return
    lock = Path(raw)
    try:
        lock.unlink()
    except FileNotFoundError:
        pass


def command_discover(args) -> int:
    root = Path(args.project_root).expanduser().resolve()
    pointer_path = root / ".pi" / "neuroscientist-level1" / "current_run.json"
    pointer = read_json(pointer_path, {}) or {}
    project_dir = None
    manifest = {}
    selected_round = None

    if args.round_dir:
        run_dir = resolve_from(root, args.round_dir)
    elif args.project_dir or args.round:
        project_raw = args.project_dir or pointer.get("project_dir")
        if not isinstance(project_raw, str) or not project_raw:
            print(json.dumps({"ok": False, "error": "--round requires --project-dir or a current multi-round project pointer."}, indent=2))
            return 1
        project_dir = resolve_from(root, project_raw)
        manifest = read_json(project_dir / "project.json", {}) or {}
        rounds = manifest.get("rounds") if isinstance(manifest.get("rounds"), list) else []
        requested = str(args.round or "").lower().removeprefix("round")
        if requested:
            try:
                number = int(requested)
            except ValueError:
                print(json.dumps({"ok": False, "error": f"Invalid round selector: {args.round}"}, indent=2))
                return 1
            selected_round = next((entry for entry in rounds if int(entry.get("round_number", -1)) == number), None)
        elif rounds:
            selected_round = max(rounds, key=lambda entry: int(entry.get("round_number", 0)))
        if not isinstance(selected_round, dict) or not selected_round.get("run_dir"):
            print(json.dumps({"ok": False, "error": "Requested round was not found in project.json.", "project_dir": str(project_dir)}, indent=2))
            return 1
        run_dir = Path(selected_round["run_dir"]).expanduser().resolve()
    else:
        run_dir_raw = pointer.get("run_dir")
        if not isinstance(run_dir_raw, str) or not run_dir_raw:
            print(json.dumps({"ok": False, "error": "No current Level 1 run pointer.", "pointer_path": str(pointer_path)}, indent=2))
            return 1
        run_dir = Path(run_dir_raw).expanduser().resolve()
    state = read_json(run_dir / "state.json", {}) or {}
    artifacts = state.get("artifacts") if isinstance(state.get("artifacts"), list) else []
    figures = []
    for artifact in artifacts:
        if not isinstance(artifact, dict) or artifact.get("kind") != "figure":
            continue
        path = artifact_path(run_dir, artifact)
        if path is None:
            continue
        producer = produced_by_path(run_dir, artifact)
        figures.append({
            "path": str(path),
            "role": artifact.get("role"),
            "description": artifact.get("description"),
            "produced_by": str(producer) if producer else None,
            "exists": path.is_file(),
        })
    print(json.dumps({
        "ok": True,
        "context_source": "level1",
        "pointer_path": str(pointer_path),
        "run_id": state.get("run_id") or pointer.get("run_id"),
        "run_dir": str(run_dir),
        "project_id": state.get("project_id") or manifest.get("project_id") or pointer.get("project_id"),
        "project_dir": state.get("project_dir") or (str(project_dir) if project_dir else pointer.get("project_dir")),
        "round_number": state.get("round_number") or (selected_round or {}).get("round_number") or pointer.get("round_number"),
        "round_name": state.get("round_name") or (selected_round or {}).get("round_name") or pointer.get("round_name"),
        "question": state.get("question"),
        "figures": figures,
        "statistics_path": str(run_dir / "statistics.json") if (run_dir / "statistics.json").is_file() else None,
        "validation_path": str(run_dir / "validation.json") if (run_dir / "validation.json").is_file() else None,
    }, indent=2, ensure_ascii=False))
    return 0


def command_begin(args) -> int:
    work_dir = Path(args.work_dir).expanduser().resolve()
    code = resolve_from(work_dir, args.code)
    figure = resolve_from(work_dir, args.figure)
    if not work_dir.is_dir():
        raise RuntimeError(f"working directory does not exist: {work_dir}")
    if not code.is_file():
        raise RuntimeError(f"generating code does not exist: {code}")
    if not figure.is_file():
        raise RuntimeError(f"target figure does not exist: {figure}")

    revision_id = f"rev_{short_timestamp()}_{uuid.uuid4().hex[:8]}"
    root = work_dir / "figure_revisions"
    revision_dir = root / revision_id
    lock_dir = root / ".locks"
    lock_dir.mkdir(parents=True, exist_ok=True)
    lock_key = hashlib.sha256(str(code).encode("utf-8")).hexdigest()[:24]
    lock_path = lock_dir / f"{lock_key}.lock"
    try:
        descriptor = os.open(lock_path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o644)
    except FileExistsError as error:
        owner = read_json(lock_path, {}) or {}
        raise RuntimeError(f"generating code is already locked: {code}; lock={lock_path}; owner={owner}") from error

    try:
        os.write(descriptor, (json.dumps({"revision_id": revision_id, "code_path": str(code), "created_at": utc_now()}) + "\n").encode("utf-8"))
    finally:
        os.close(descriptor)

    try:
        related = collect_related(work_dir, code, figure)
        archived = snapshot_files(work_dir, revision_dir, related)
        if not any(record["original_path"] == str(code) for record in archived):
            raise RuntimeError("code snapshot was not created")
        revision_dir.mkdir(parents=True, exist_ok=True)
        revision = {
            "schema_version": 3,
            "revision_id": revision_id,
            "status": "active",
            "created_at": utc_now(),
            "work_dir": str(work_dir),
            "code_path": str(code),
            "figure_path": str(figure),
            "request": args.request.strip(),
            "lock_path": str(lock_path),
            "archived": archived,
            "rollback_available": True,
        }
        write_json(revision_dir / "revision.json", revision)
    except Exception:
        try:
            lock_path.unlink()
        except FileNotFoundError:
            pass
        shutil.rmtree(revision_dir, ignore_errors=True)
        raise

    print(json.dumps({
        "ok": True,
        "revision_id": revision_id,
        "revision_dir": str(revision_dir),
        "archived_previous_version": archived,
    }, indent=2, ensure_ascii=False))
    return 0


def load_revision(path_value: str) -> tuple[Path, dict]:
    revision_dir = Path(path_value).expanduser().resolve()
    revision_path = revision_dir / "revision.json"
    revision = read_json(revision_path, None)
    if not isinstance(revision, dict):
        raise RuntimeError(f"invalid revision directory: {revision_dir}")
    return revision_dir, revision


def command_finish(args) -> int:
    revision_dir, revision = load_revision(args.revision_dir)
    if revision.get("status") != "active":
        raise RuntimeError(f"revision is not active: {revision.get('status')}")
    code = Path(revision["code_path"])
    figure = Path(revision["figure_path"])
    if not code.is_file() or not figure.is_file():
        raise RuntimeError("cannot finish: active code or target figure is missing")
    if args.iterations < 1:
        raise RuntimeError("iterations must be at least 1")
    revision.update({
        "status": "completed",
        "completed_at": utc_now(),
        "iterations": args.iterations,
    })
    release_lock(revision)
    write_json(revision_dir / "revision.json", revision)
    print(json.dumps({
        "ok": True,
        "revision_id": revision["revision_id"],
        "revision_dir": str(revision_dir),
        "status": revision["status"],
        "rollback_available": True,
        "active_code": str(code),
        "active_figure": str(figure),
        "iterations": args.iterations,
    }, indent=2, ensure_ascii=False))
    return 0


def command_rollback(args) -> int:
    revision_dir, revision = load_revision(args.revision_dir)
    if revision.get("status") not in {"active", "completed"}:
        raise RuntimeError(f"revision cannot be rolled back from status: {revision.get('status')}")
    work_dir = Path(revision["work_dir"])
    current_sources = []
    entries = archived_entries(revision)
    for entry in entries:
        original = Path(entry["original_path"])
        if original.is_file():
            current_sources.append((original, str(entry.get("kind") or "other")))
    snapshot_files(work_dir, revision_dir / "failed_candidate", current_sources)
    for entry in entries:
        backup = Path(entry["backup_path"])
        original = Path(entry["original_path"])
        if not backup.is_file():
            raise RuntimeError(f"missing rollback backup: {backup}")
        original.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(backup, original)
    revision.update({
        "status": "rolled_back",
        "rolled_back_at": utc_now(),
        "rollback_reason": args.reason,
    })
    release_lock(revision)
    write_json(revision_dir / "revision.json", revision)
    print(json.dumps({
        "ok": True,
        "revision_id": revision["revision_id"],
        "revision_dir": str(revision_dir),
        "status": revision["status"],
        "reason": args.reason,
        "restored": [entry["original_path"] for entry in entries],
    }, indent=2, ensure_ascii=False))
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    subparsers = parser.add_subparsers(dest="command", required=True)

    discover = subparsers.add_parser("discover", help="Resolve the current Level 1 figure context.")
    discover.add_argument("--project-root", default=".")
    discover.add_argument("--project-dir", help="Select a multi-round project directory instead of the current pointer.")
    discover.add_argument("--round", help="Select round number/name (for example 1 or round1). Uses --project-dir or the current project pointer.")
    discover.add_argument("--round-dir", help="Select an exact historical round directory.")
    discover.set_defaults(func=command_discover)

    begin = subparsers.add_parser("begin", help="Lock and snapshot a code-driven figure revision.")
    begin.add_argument("--work-dir", required=True)
    begin.add_argument("--figure", required=True)
    begin.add_argument("--code", required=True)
    begin.add_argument("--request", required=True)
    begin.set_defaults(func=command_begin)

    finish = subparsers.add_parser("finish", help="Mark an inspected figure revision complete and release its lock.")
    finish.add_argument("--revision-dir", required=True)
    finish.add_argument("--iterations", required=True, type=int)
    finish.set_defaults(func=command_finish)

    rollback = subparsers.add_parser("rollback", help="Preserve the failed candidate and restore the archived version.")
    rollback.add_argument("--revision-dir", required=True)
    rollback.add_argument("--reason", required=True)
    rollback.set_defaults(func=command_rollback)
    return parser


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()
    try:
        return int(args.func(args))
    except Exception as error:
        print(json.dumps({"ok": False, "error": str(error)}, indent=2, ensure_ascii=False), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
