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
import sys
import time
import json
from pathlib import Path

from config import PAPER_PATH, REPO_PATH, QUESTIONS_JSONL, QUESTIONS_BASE_DIR, OUTPUT_DIR
from utils import setup_logger, write_text_file, safe_filename
from paper_parser import build_structured_paper_info
from repo_parser import build_structured_repo_info
from question_loader import load_questions
from context_matcher import match_question_to_context
from skill_generator import generate_skill

logger = setup_logger("main")


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
    main()
