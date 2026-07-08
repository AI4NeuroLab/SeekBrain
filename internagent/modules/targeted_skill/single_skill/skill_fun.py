#!/usr/bin/env python3
"""
Paper2Skill + Repo2Skill Joint Skill Generation Pipeline
Jointly extracts skills from a scientific paper and its companion code
repository, driven by specific research questions. For each question,
it produces a self-contained Skill folder.
Usage:
    python main.py [--paper PATH] [--repo PATH] [--questions PATH]
                   [--output PATH] [--skip-existing] [--tags TAG1 TAG2 ...]
"""
import argparse
import hashlib
import shutil
import subprocess
import sys
import time
import json
from pathlib import Path

from .config import PAPER_PATH, REPO_PATH, QUESTIONS_JSONL, QUESTIONS_BASE_DIR, OUTPUT_DIR
from .utils import setup_logger, write_text_file, safe_filename, _repo_identifier
from .paper_parser import build_structured_paper_info
from .repo_parser import build_structured_repo_info
from .question_loader import load_questions
from .context_matcher import match_question_to_context
from .skill_generator import generate_skill

logger = setup_logger("main")

# ═══════════════════════════════════════════════════════════════════════════════
#  Global in-memory cache (title → parsed info) for same-process reuse
# ═══════════════════════════════════════════════════════════════════════════════
_PAPER_INFO_MEM_CACHE: dict[str, dict] = {}
_REPO_INFO_MEM_CACHE: dict[str, dict] = {}


# ═══════════════════════════════════════════════════════════════════════════════
#  Helper: deterministic cache key from title
# ═══════════════════════════════════════════════════════════════════════════════
def _title_cache_key(title: str) -> str:
    """Return a filesystem-safe, deterministic key derived from paper title."""
    slug = safe_filename(title)[:80]
    h = hashlib.sha256(title.encode("utf-8")).hexdigest()[:12]
    return f"{slug}_{h}"


# ═══════════════════════════════════════════════════════════════════════════════
#  Helper: clone repo (shallow) with caching
# ═══════════════════════════════════════════════════════════════════════════════
def _clone_repo_cached(repo_link: str, clone_dir: Path) -> Path:
    """
    Shallow-clone *repo_link* into *clone_dir* if it hasn't been cloned yet.
    Returns the path to the cloned directory.
    Raises RuntimeError if clone fails.
    """
    marker = clone_dir / ".clone_done"
    if marker.exists() and any(clone_dir.iterdir()):
        logger.info(f"  Repo already cloned at: {clone_dir}")
        return clone_dir
    if clone_dir.exists():
        shutil.rmtree(clone_dir)
    clone_dir.mkdir(parents=True, exist_ok=True)

    # ---------- 先验证 URL 是否可达（可选，快速失败） ----------
    if repo_link.startswith("https://github.com/"):
        try:
            import urllib.request
            req = urllib.request.Request(repo_link, method="HEAD")
            resp = urllib.request.urlopen(req, timeout=10)
            if resp.status == 404:
                raise RuntimeError(f"Repo does not exist: {repo_link}")
        except urllib.error.HTTPError as e:
            if e.code == 404:
                raise RuntimeError(f"Repo not found (404): {repo_link}") from e
            # 其他 HTTP 错误（如 403）仍尝试 clone
            logger.warning(f"  HEAD check got HTTP {e.code}, will still try clone.")
        except Exception as e:
            logger.warning(f"  URL pre-check failed ({e}), will still try clone.")

    # ---------- 执行 clone ----------
    logger.info(f"  Cloning repo: {repo_link} -> {clone_dir}")
    try:
        result = subprocess.run(
            ["git", "clone", "--depth", "1", repo_link, str(clone_dir)],
            check=True,
            capture_output=True,
            text=True,
            timeout=600,
        )
    except subprocess.CalledProcessError as e:
        # 清理残留目录
        if clone_dir.exists():
            shutil.rmtree(clone_dir)
        stderr_msg = (e.stderr or "").strip()
        logger.error(f"  Git clone failed (exit {e.returncode}): {stderr_msg}")
        raise RuntimeError(
            f"Failed to clone repo: {repo_link}\n"
            f"  exit code: {e.returncode}\n"
            f"  stderr: {stderr_msg}\n"
            f"  Possible reasons: repo not found / private / network issue"
        ) from e
    except subprocess.TimeoutExpired:
        if clone_dir.exists():
            shutil.rmtree(clone_dir)
        logger.error(f"  Git clone timed out for: {repo_link}")
        raise RuntimeError(f"Git clone timed out (600s): {repo_link}")

    marker.write_text(repo_link, encoding="utf-8")
    logger.info(f"  Clone completed.")
    return clone_dir

# ═══════════════════════════════════════════════════════════════════════════════
#  Helper: build paper info from raw text content (with disk + memory cache)
# ═══════════════════════════════════════════════════════════════════════════════
def _load_or_build_paper_info_from_content(
    title: str,
    paper_content: str,
    cache_dir: Path,
) -> dict:
    """
    Build structured paper info from *paper_content* text.
    Caches result both in memory (_PAPER_INFO_MEM_CACHE) and on disk.
    """
    cache_key = _title_cache_key(title)

    # 1. memory cache
    if cache_key in _PAPER_INFO_MEM_CACHE:
        logger.info(f"  Paper info hit memory cache (title={title!r})")
        return _PAPER_INFO_MEM_CACHE[cache_key]

    # 2. disk cache
    cache_file = cache_dir / cache_key / "paper_info.json"
    if cache_file.exists():
        logger.info(f"  Loading cached paper info from: {cache_file}")
        with open(cache_file, "r", encoding="utf-8") as f:
            data = json.load(f)
        _PAPER_INFO_MEM_CACHE[cache_key] = data
        return data

    # 3. build from scratch
    logger.info(f"  Building paper info from text content (title={title!r}) ...")
    start = time.time()

    # Try the dedicated text-based builder first; fall back to a lightweight
    # approach that packages raw text so down-stream LLM calls can still work.
    try:
        from paper_parser import build_structured_paper_info_from_text
        paper_info = build_structured_paper_info_from_text(title, paper_content)
    except ImportError:
        logger.warning(
            "  paper_parser.build_structured_paper_info_from_text not found; "
            "falling back to raw-text-only paper_info."
        )
        paper_info = {
            "structured_summary": "",
            "figure_methods": {},
            "raw_text": paper_content,
        }

    elapsed = time.time() - start
    logger.info(f"  Paper text parsing completed in {elapsed:.1f}s")

    cache_data = {
        "title": title,
        "structured_summary": paper_info.get("structured_summary", ""),
        "figure_methods": paper_info.get("figure_methods", {}),
        "raw_text": paper_info.get("raw_text", paper_content),
    }

    cache_file.parent.mkdir(parents=True, exist_ok=True)
    with open(cache_file, "w", encoding="utf-8") as f:
        json.dump(cache_data, f, indent=2, ensure_ascii=False)
    logger.info(f"  Paper info cached to: {cache_file}")

    _PAPER_INFO_MEM_CACHE[cache_key] = cache_data
    return cache_data


# ═══════════════════════════════════════════════════════════════════════════════
#  Helper: build repo info from link (with disk + memory cache)
# ═══════════════════════════════════════════════════════════════════════════════
def _load_or_build_repo_info_from_link(
    title: str,
    repo_link: str,
    cache_dir: Path,
) -> dict:
    """
    Clone the repo (if needed) and build structured repo info.
    Caches result both in memory (_REPO_INFO_MEM_CACHE) and on disk.
    """
    cache_key = _title_cache_key(title)

    # 1. memory cache
    if cache_key in _REPO_INFO_MEM_CACHE:
        logger.info(f"  Repo info hit memory cache (title={title!r})")
        return _REPO_INFO_MEM_CACHE[cache_key]

    # 2. disk cache (repo_info.json)
    info_cache = cache_dir / cache_key / "repo_info.json"
    if info_cache.exists():
        logger.info(f"  Loading cached repo info from: {info_cache}")
        with open(info_cache, "r", encoding="utf-8") as f:
            data = json.load(f)
        _REPO_INFO_MEM_CACHE[cache_key] = data
        return data

    # 3. clone + build
    clone_dir = cache_dir / cache_key / "repo_clone"
    repo_path = _clone_repo_cached(repo_link, clone_dir)

    logger.info(f"  Building repo info (title={title!r}) ...")
    start = time.time()
    repo_info = build_structured_repo_info(repo_path)
    elapsed = time.time() - start
    logger.info(f"  Repo parsing completed in {elapsed:.1f}s")

    cache_data = {
        "repo_link": repo_link,
        "directory_tree": repo_info["directory_tree"],
        "file_summaries": repo_info["file_summaries"],
        "repo_overview": repo_info["repo_overview"],
        "files": [
            {
                "relative_path": f["relative_path"],
                "extension": f["extension"],
                "size": f["size"],
                "content": f["content"],
            }
            for f in repo_info["files"]
        ],
    }

    info_cache.parent.mkdir(parents=True, exist_ok=True)
    with open(info_cache, "w", encoding="utf-8") as f:
        json.dump(cache_data, f, indent=2, ensure_ascii=False)
    logger.info(f"  Repo info cached to: {info_cache}")

    _REPO_INFO_MEM_CACHE[cache_key] = cache_data
    return cache_data


# ═══════════════════════════════════════════════════════════════════════════════
#  PUBLIC API: generate_skill_from_paper_repo
# ═══════════════════════════════════════════════════════════════════════════════
def generate_skill_from_paper_repo(
    question: str,
    title: str,
    paper_content: str,
    repo_link: str,
    output_dir: str,
    *,
    tag: str | None = None,
    skip_existing: bool = True,
) -> Path:
    """
    End-to-end skill generation from a research question + paper text + repo URL.

    Parameters
    ----------
    question : str
        The research question driving skill extraction.
    title : str
        Paper title – used as cache key so that different questions about the
        same paper reuse parsed paper / repo info.
    paper_content : str
        Full paper text (already extracted from PDF / HTML / etc.).
    repo_link : str
        Git-cloneable URL of the companion code repository.
        If empty or ``None``, repo-related steps are skipped.
    output_dir : str
        Root directory under which the skill folder will be created,
        e.g. ``"library/skills/from_rag"``.
    tag : str, optional
        Human-readable tag for the question (used as folder name).
        Defaults to the first 60 chars of the question.
    skip_existing : bool
        If ``True`` and the skill folder already contains ``SKILL.md``,
        return immediately without regenerating.

    Returns
    -------
    Path
        Path to the generated skill folder.
    """
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)
    cache_dir = output_path / ".cache"
    cache_dir.mkdir(parents=True, exist_ok=True)

    # Derive tag / folder name
    if not tag:
        tag = safe_filename(question)[:60]
    # skill_dir = output_path / safe_filename(tag)

    # new
    repo_id = _repo_identifier(repo_link)                                                                       
    skill_dir = output_path / f"{safe_filename(tag)}__{safe_filename(repo_id)}"

    logger.info("─" * 60)
    logger.info(f"generate_skill_from_paper_repo")
    logger.info(f"  question : {question[:120]}{'…' if len(question) > 120 else ''}")
    logger.info(f"  title    : {title[:100]}{'…' if len(title) > 100 else ''}")
    logger.info(f"  repo     : {repo_link or '(none)'}")
    logger.info(f"  output   : {skill_dir}")
    logger.info("─" * 60)

    # --- Skip if already generated -----------------------------------------
    if skip_existing and (skill_dir / "SKILL.md").exists():
        logger.info(f"  Skill already exists at {skill_dir}, skipping.")
        return skill_dir

    start_time = time.time()

    # ── Step 1: Parse paper ────────────────────────────────────────────────
    logger.info("  [1/4] Parsing paper content ...")
    paper_info = _load_or_build_paper_info_from_content(title, paper_content, cache_dir)

    # ── Step 2: Parse repo ─────────────────────────────────────────────────
    if repo_link:
        logger.info("  [2/4] Parsing repository ...")
        try:
            repo_info = _load_or_build_repo_info_from_link(title, repo_link, cache_dir)
        except Exception as e:
            logger.warning(f"无法获取仓库信息，将仅基于论文内容生成 skill: {e}")
            repo_info = {
                    "repo_link": "",
                    "directory_tree": "",
                    "file_summaries": {},
                    "repo_overview": "",
                    "files": []}
    else:
        logger.info("  [2/4] No repo link provided, skipping repo parsing.")
        repo_info = {
            "repo_link": "",
            "directory_tree": "",
            "file_summaries": {},
            "repo_overview": "",
            "files": [],
        }

    # ── Step 3: Match context ──────────────────────────────────────────────
    logger.info("  [3/4] Matching question to context ...")
    question_obj = {
        "tag": tag,
        "question_text": question,
        "title": title,
        "repo_link": repo_link or "",
    }
    context = match_question_to_context(question_obj, paper_info, repo_info)

    # ── Step 4: Generate skill ─────────────────────────────────────────────
    logger.info("  [4/4] Generating skill ...")
    # skill_path = generate_skill(
    #     question=question_obj,
    #     context=context,
    #     paper_info=paper_info,
    #     repo_info=repo_info,
    #     output_base=output_path,
    # )
    # new
    skill_path = generate_skill(
        question=question_obj,
        context=context,
        paper_info=paper_info,
        repo_info=repo_info,
        output_base=output_path,
        skill_dir=skill_dir
    )

    elapsed = time.time() - start_time
    logger.info(f"  ✅ Skill generated in {elapsed:.1f}s -> {skill_path}")

    # ── Append to pipeline_results.json for bookkeeping ────────────────────
    results_file = output_path / "pipeline_results.json"
    try:
        if results_file.exists():
            with open(results_file, "r", encoding="utf-8") as f:
                results_data = json.load(f)
        else:
            results_data = {"results": []}
    except (json.JSONDecodeError, KeyError):
        results_data = {"results": []}

    results_data["results"].append({
        "tag": tag,
        "title": title,
        "question": question,
        "repo_link": repo_link or "",
        "status": "success",
        "path": str(skill_path),
        "elapsed_seconds": round(elapsed, 1),
    })
    write_text_file(results_file, json.dumps(results_data, indent=2, ensure_ascii=False))

    return Path(skill_path)


# ═══════════════════════════════════════════════════════════════════════════════
#  Batch variant: process a list of (question, title, content, repo) tuples
# ═══════════════════════════════════════════════════════════════════════════════
def batch_generate_skills_from_paper_repo(
    items: list[dict],
    output_dir: str,
    *,
    skip_existing: bool = True,
) -> list[dict]:
    """
    Batch version of ``generate_skill_from_paper_repo``.

    Parameters
    ----------
    items : list[dict]
        Each dict must contain keys:
        ``question``, ``title``, ``paper_content``, ``repo_link``.
        Optional: ``tag``.
    output_dir : str
        Root output directory.
    skip_existing : bool
        Skip skills whose folders already exist.

    Returns
    -------
    list[dict]
        Per-item result dicts with ``tag``, ``status``, ``path``, ``elapsed_seconds``.
    """
    results = []
    total = len(items)
    logger.info(f"Batch generating {total} skills -> {output_dir}")

    for idx, item in enumerate(items, 1):
        question = item["question"]
        title = item["title"]
        paper_content = item["paper_content"]
        repo_link = item.get("repo_link", "")
        tag = item.get("tag", None)

        logger.info(f"\n[{idx}/{total}] Processing: {title[:80]}...")
        try:
            skill_path = generate_skill_from_paper_repo(
                question=question,
                title=title,
                paper_content=paper_content,
                repo_link=repo_link,
                output_dir=output_dir,
                tag=tag,
                skip_existing=skip_existing,
            )
            results.append({
                "tag": tag or safe_filename(question)[:60],
                "status": "success",
                "path": str(skill_path),
            })
        except Exception as e:
            logger.error(f"  ❌ Failed: {e}", exc_info=True)
            results.append({
                "tag": tag or safe_filename(question)[:60],
                "status": "failed",
                "error": str(e),
            })

    success = sum(1 for r in results if r["status"] == "success")
    failed = sum(1 for r in results if r["status"] == "failed")
    logger.info(f"\nBatch complete: {success} succeeded, {failed} failed out of {total}.")
    return results


# ═══════════════════════════════════════════════════════════════════════════════
#  Original CLI helpers (unchanged)
# ═══════════════════════════════════════════════════════════════════════════════

def parse_args() -> argparse.Namespace:
    """Parse command-line arguments."""
    parser = argparse.ArgumentParser(
        description="Paper2Skill + Repo2Skill Joint Skill Generation Pipeline"
    )
    parser.add_argument("--paper", type=Path, default=PAPER_PATH,
                        help=f"Path to paper PDF (default: {PAPER_PATH})")
    parser.add_argument("--repo", type=Path, default=REPO_PATH,
                        help=f"Path to code repository (default: {REPO_PATH})")
    parser.add_argument("--questions", type=Path, default=QUESTIONS_JSONL,
                        help=f"Path to q.jsonl (default: {QUESTIONS_JSONL})")
    parser.add_argument("--questions-base-dir", type=Path, default=QUESTIONS_BASE_DIR,
                        help=f"Base dir for resolving .md paths (default: {QUESTIONS_BASE_DIR})")
    parser.add_argument("--output", type=Path, default=OUTPUT_DIR,
                        help=f"Output directory (default: {OUTPUT_DIR})")
    parser.add_argument("--skip-existing", action="store_true",
                        help="Skip questions whose skill folders already exist")
    parser.add_argument("--tags", nargs="*", default=None,
                        help="Only process specific tags (e.g., --tags Figure1C Figure2A)")
    return parser.parse_args()


def _load_or_build_paper_info(paper_path: Path, cache_dir: Path) -> dict:
    """Load paper info from cache or build from scratch."""
    cache_file = cache_dir / "paper_info.json"
    if cache_file.exists():
        logger.info(f"Loading cached paper info from: {cache_file}")
        with open(cache_file, "r", encoding="utf-8") as f:
            return json.load(f)
    start_time = time.time()
    paper_info = build_structured_paper_info(paper_path)
    elapsed = time.time() - start_time
    logger.info(f"Paper parsing completed in {elapsed:.1f}s")
    cache_file.parent.mkdir(parents=True, exist_ok=True)
    cache_data = {
        "structured_summary": paper_info["structured_summary"],
        "figure_methods": paper_info["figure_methods"],
        "raw_text": paper_info["raw_text"],
    }
    with open(cache_file, "w", encoding="utf-8") as f:
        json.dump(cache_data, f, indent=2, ensure_ascii=False)
    logger.info(f"Paper info cached to: {cache_file}")
    return cache_data


def _load_or_build_repo_info(repo_path: Path, cache_dir: Path) -> dict:
    """Load repo info from cache or build from scratch."""
    cache_file = cache_dir / "repo_info.json"
    if cache_file.exists():
        logger.info(f"Loading cached repo info from: {cache_file}")
        with open(cache_file, "r", encoding="utf-8") as f:
            return json.load(f)
    start_time = time.time()
    repo_info = build_structured_repo_info(repo_path)
    elapsed = time.time() - start_time
    logger.info(f"Repository parsing completed in {elapsed:.1f}s")
    cache_file.parent.mkdir(parents=True, exist_ok=True)
    cache_data = {
        "directory_tree": repo_info["directory_tree"],
        "file_summaries": repo_info["file_summaries"],
        "repo_overview": repo_info["repo_overview"],
        "files": [
            {
                "relative_path": f["relative_path"],
                "extension": f["extension"],
                "size": f["size"],
                "content": f["content"],
            }
            for f in repo_info["files"]
        ],
    }
    with open(cache_file, "w", encoding="utf-8") as f:
        json.dump(cache_data, f, indent=2, ensure_ascii=False)
    logger.info(f"Repo info cached to: {cache_file}")
    return cache_data


def _generate_master_index(output_dir: Path, results: list[dict]) -> None:
    """Generate a master index file listing all generated skills."""
    logger.info("Generating master skill index...")
    lines = [
        "# Skill Index",
        "",
        "Auto-generated index of all skills produced by the Paper2Skill + Repo2Skill pipeline.",
        "",
        "| # | Tag | Status | Elapsed | Path |",
        "|---|-----|--------|---------|------|",
    ]
    for i, r in enumerate(results, 1):
        tag = r.get("tag", "unknown")
        status = r.get("status", "unknown")
        elapsed = r.get("elapsed_seconds", "N/A")
        path = r.get("path", "N/A")
        icon = {"success": "✅", "skipped": "⏭️", "failed": "❌"}.get(status, "❓")
        lines.append(f"| {i} | {tag} | {icon} {status} | {elapsed}s | `{path}` |")
    lines.extend(["", "## Quick Navigation", ""])
    for r in results:
        if r.get("status") == "success":
            tag = r["tag"]
            folder = safe_filename(tag)
            lines.append(f"- [{tag}](./{folder}/SKILL.md)")
    lines.extend(["", "---", "*Generated by Paper2Skill + Repo2Skill Pipeline*"])
    write_text_file(output_dir / "INDEX.md", "\n".join(lines))
    logger.info(f"Master index written to: {output_dir / 'INDEX.md'}")


def main():
    """Main entry point for the skill generation pipeline."""
    args = parse_args()
    logger.info("=" * 70)
    logger.info("Paper2Skill + Repo2Skill Joint Skill Generation Pipeline")
    logger.info("=" * 70)
    logger.info(f"Paper:     {args.paper}")
    logger.info(f"Repo:      {args.repo}")
    logger.info(f"Questions: {args.questions}")
    logger.info(f"Output:    {args.output}")

    # Validate inputs
    if not args.paper.exists():
        logger.error(f"Paper file not found: {args.paper}")
        sys.exit(1)
    if not args.repo.exists():
        logger.error(f"Repository directory not found: {args.repo}")
        sys.exit(1)
    if not args.questions.exists():
        logger.error(f"Questions file not found: {args.questions}")
        sys.exit(1)

    args.output.mkdir(parents=True, exist_ok=True)
    cache_dir = args.output / ".cache"

    # =========================================================================
    # Step 1: Parse the paper
    # =========================================================================
    logger.info("\n" + "=" * 70)
    logger.info("STEP 1: Parsing paper...")
    logger.info("=" * 70)
    paper_info = _load_or_build_paper_info(args.paper, cache_dir)

    # =========================================================================
    # Step 2: Parse the repository
    # =========================================================================
    logger.info("\n" + "=" * 70)
    logger.info("STEP 2: Parsing repository...")
    logger.info("=" * 70)
    repo_info = _load_or_build_repo_info(args.repo, cache_dir)

    # =========================================================================
    # Step 3: Load questions
    # =========================================================================
    logger.info("\n" + "=" * 70)
    logger.info("STEP 3: Loading questions...")
    logger.info("=" * 70)
    questions = load_questions(args.questions, args.questions_base_dir)
    if not questions:
        logger.error("No valid questions loaded. Exiting.")
        sys.exit(1)
    if args.tags:
        tags_set = set(args.tags)
        questions = [q for q in questions if q["tag"] in tags_set]
        logger.info(f"Filtered to {len(questions)} questions matching tags: {args.tags}")
    if not questions:
        logger.error("No questions remain after filtering. Exiting.")
        sys.exit(1)

    # =========================================================================
    # Steps 4-6: Process each question
    # =========================================================================
    logger.info("\n" + "=" * 70)
    logger.info(f"STEPS 4-6: Processing {len(questions)} questions...")
    logger.info("=" * 70)

    results = []
    failed = []
    for i, question in enumerate(questions):
        tag = question["tag"]
        logger.info("")
        logger.info(f"{'─' * 50}")
        logger.info(f"Question {i + 1}/{len(questions)}: [{tag}]")
        logger.info(f"{'─' * 50}")

        # Check if skill already exists
        skill_dir = args.output / safe_filename(tag)
        if args.skip_existing and (skill_dir / "SKILL.md").exists():
            logger.info(f"  [{tag}] Skill already exists, skipping.")
            results.append({"tag": tag, "status": "skipped", "path": str(skill_dir)})
            continue

        try:
            start_time = time.time()

            # Step 4: Match context
            logger.info(f"  [{tag}] Step 4: Matching question to paper and repo context...")
            context = match_question_to_context(question, paper_info, repo_info)

            # Step 5: Generate skill
            logger.info(f"  [{tag}] Step 5: Generating skill folder...")
            skill_path = generate_skill(
                question=question,
                context=context,
                paper_info=paper_info,
                repo_info=repo_info,
                output_base=args.output,
            )

            elapsed = time.time() - start_time
            logger.info(f"  [{tag}] ✅ Completed in {elapsed:.1f}s -> {skill_path}")
            results.append({
                "tag": tag,
                "status": "success",
                "path": str(skill_path),
                "elapsed_seconds": round(elapsed, 1),
            })

        except Exception as e:
            elapsed = time.time() - start_time
            logger.error(f"  [{tag}] ❌ FAILED after {elapsed:.1f}s: {e}", exc_info=True)
            failed.append(tag)
            results.append({
                "tag": tag,
                "status": "failed",
                "error": str(e),
                "elapsed_seconds": round(elapsed, 1),
            })

    # =========================================================================
    # Summary
    # =========================================================================
    logger.info("\n" + "=" * 70)
    logger.info("PIPELINE COMPLETE - SUMMARY")
    logger.info("=" * 70)
    success_count = sum(1 for r in results if r["status"] == "success")
    skip_count = sum(1 for r in results if r["status"] == "skipped")
    fail_count = sum(1 for r in results if r["status"] == "failed")
    total_elapsed = sum(r.get("elapsed_seconds", 0) for r in results)
    logger.info(f"Total questions:    {len(questions)}")
    logger.info(f"Successful:         {success_count}")
    logger.info(f"Skipped:            {skip_count}")
    logger.info(f"Failed:             {fail_count}")
    logger.info(f"Total time:         {total_elapsed:.1f}s")
    if failed:
        logger.warning(f"Failed tags: {failed}")

    # Write pipeline results summary
    summary_path = args.output / "pipeline_results.json"
    summary_data = {
        "paper": str(args.paper),
        "repo": str(args.repo),
        "questions_file": str(args.questions),
        "total_questions": len(questions),
        "success": success_count,
        "skipped": skip_count,
        "failed": fail_count,
        "total_elapsed_seconds": round(total_elapsed, 1),
        "results": results,
    }
    write_text_file(summary_path, json.dumps(summary_data, indent=2, ensure_ascii=False))
    logger.info(f"Pipeline results written to: {summary_path}")

    # Generate master index
    _generate_master_index(args.output, results)

    if fail_count > 0:
        logger.warning(f"Pipeline completed with {fail_count} failure(s).")
        sys.exit(1)
    else:
        logger.info("Pipeline completed successfully!")
        sys.exit(0)


if __name__ == "__main__":
    import logging
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)-7s] %(name)-25s │ %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )
    # ── 示例调用 ──
    result = generate_skill_from_paper_repo(
        question="analyse nerual signal",
        title="Example Brain Analysis",
        paper_content="ociated current amplitudes used as the target data in the detailed CA1 pyramidal neuron use case. \n\n```\n<table><tr><td>AP_fall_time</td><td>Time from the peak of the AP to the end of the AP</td><td>0.15, 0.2, 0.25</td></tr><tr><td>AP_rise_time</td><td>Time from the AP threshold to the peak of the AP</td><td>0.15, 0.2, 0.25</td></tr><tr><td>AP_last_amp</td><td>Amplitude of the last AP</td><td>0.15, 0.2, 0.25</td></tr><tr><td>time_to_last_spike</td><td>Time to the last spike</td><td>0.15, 0.2, 0.25</td></tr><tr><td>sag_amplitude</td><td>Difference between the minimal voltage and the steady state voltage at the end of the stimulus</td><td>-0.25</td></tr><tr><td>sag_ratio1</td><td>Ratio between sag amplitude and maximal hyperpolarization from voltage base</td><td>-0.25</td></tr></table>\n```\n\nWe optimized 12 abstract parameters of the model that were mapped onto the actual parameters of the NEURON implementation by an appropriate user function. Ten parameters\n\ndetermined the densities of the voltage-gated and leak conductances in the different compartments (soma, dendrites, axon) of the neuron; one parameter represented the reversal potential of the leak current; and the final parameter determined the difference between the half-activation and half-inactivation potential values of the Na conductance.\n\n# Evaluation Methods\n\nWe tested the different optimization algorithms on each of the six model optimization tasks described above. To ensure a fair comparison of model performance, we allowed 10,000 model evaluations for every algorithm on each task. For all population-based methods (including evolutionary algorithms and swarm intelligence-based approaches) we set the population size to 100, and the number of generations to 100 as well. We similarly set 100 global and 100 local minimization steps for two-stage algorithms. Otherwise, we ran every algorithm with its default settings in Neuroptimus. These default options are typically the package default settings, with one significant exception: we observed that the default settings of the EvolutionaryComputation class of the Inspyred package that underlies our CEO algorithm led to essentially no optimization, so we adjusted the default number of elites from 0 to half of the population size, changed the mutation rate from 0.1 to 0.25 and standard deviation of Gaussian mutation from 1 to 0.5.\n\nOptimization runs were parallelized for all algorithms where this is supported by Neuroptimus and the underlying packages (see Table 2). For the most resource-intensive use case (the detailed CA1 pyramidal neuron model) these parallelized runs were performed on supercomputers via the Neuroscience Gateway [75]; simpler use cases and algorithms that do not support parallelization were run on a Dell PowerEdge R730 compute server or personal computers. To allow meaningful statistical comparisons between the algorithms, we performed 10 independent runs (using distinct random seeds) of each algorithm in every use case.\n\nWe visualized and compared the performance of the algorithms in each use case using several different methods. All the comparisons were based on the change in the total error during the optimization. First, we visualized the convergence of the algorithms by plotting the cumulative minimum of the error function after every generation (i.e., after every 100 model evaluations). We plotted the median value across the 10 runs to see which algorithms typically find the best solutions after a given number of model evaluations. The lowest and the highest errors achieved by the 10 runs were also calculated in every iteration to observe how well the algorithm performs in the best case, and whether it gets stuck in some cases.\n\nWe defined two basic scores to characterize and compare the performance of the algorithms in a concise manner. The first of these scores was defined as the lowest error achieved during the entire optimization run (these are usually, but not always, associated with members of the final population). We visualized the distribution of this measure across the 10 independent runs using box plots that show the median, interquartile range, minimum, and maximum values, and also indicate apparent outliers.\n\nIn the case of more complex, detailed models, each model evaluation (simulation) can be time-consuming, and thus we are also interested in which algorithms can find a reasonably good solution in a relatively short time. To characterize the convergence speed of an algorithm, we used the sum of the logarithms of the error scores achieved by the best individuals in e",
        repo_link="https://github.com/pdesrosiers/Legare-zebrafish-brain-networks",
        output_dir="library/skills/from_rag")
    print("\n" + "=" * 60)
    print(f"Result:{result}")