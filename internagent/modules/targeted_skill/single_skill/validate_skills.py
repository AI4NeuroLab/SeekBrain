#!/usr/bin/env python3
"""
Validation script to check the quality and completeness of generated skills.
Runs after the main pipeline to ensure all outputs are well-formed.

Usage:
    python validate_skills.py [--output OUTPUT_DIR]
"""

import json
import sys
import re
from pathlib import Path

try:  # importable as a package module (targeted_skill.single_skill.validate_skills)
    from .utils import setup_logger, read_text_file
except ImportError:  # run directly from the single_skill/ directory
    from utils import setup_logger, read_text_file  # type: ignore

logger = setup_logger("validate")


def _check_yaml_front_matter(content: str) -> tuple[list[str], list[str]]:
    """
    Validate YAML front matter.
    Returns (issues, warnings).
    """
    issues = []
    warnings = []

    if not content.startswith("---"):
        issues.append("SKILL.md does not start with YAML front matter (---)")
        return issues, warnings

    # Find closing ---
    second_dash = content.find("---", 3)
    if second_dash == -1:
        issues.append("YAML front matter not closed (missing second ---)")
        return issues, warnings

    yaml_block = content[3:second_dash].strip()
    if not yaml_block:
        issues.append("YAML front matter is empty (no content between --- markers)")
        return issues, warnings

    # Check required fields
    required_fields = {
        "name:": "name",
        "description:": "description",
        "triggers:": "triggers",
        "tags:": "tags",
        "version:": "version",
    }
    for field_marker, field_name in required_fields.items():
        if field_marker not in yaml_block:
            issues.append(f"YAML missing required field: {field_name}")

    # Check triggers has list items
    if "triggers:" in yaml_block:
        triggers_section = yaml_block[yaml_block.index("triggers:"):]
        trigger_items = re.findall(r'^\s+-\s+', triggers_section, re.MULTILINE)
        if len(trigger_items) < 2:
            warnings.append(f"YAML triggers has only {len(trigger_items)} items (recommend >= 3)")

    # Check tags has list items
    if "tags:" in yaml_block:
        tags_section = yaml_block[yaml_block.index("tags:"):]
        # Find the next top-level field to limit scope
        next_field = re.search(r'\n\w+:', tags_section[5:])
        if next_field:
            tags_section = tags_section[:5 + next_field.start()]
        tag_items = re.findall(r'^\s+-\s+', tags_section, re.MULTILINE)
        if len(tag_items) < 2:
            warnings.append(f"YAML tags has only {len(tag_items)} items (recommend >= 3)")

    return issues, warnings


def _check_body_sections(content: str) -> tuple[list[str], list[str]]:
    """
    Validate required body sections in SKILL.md.
    Returns (issues, warnings).
    """
    issues = []
    warnings = []

    # Extract body (after YAML front matter)
    body = content
    if content.startswith("---"):
        second_dash = content.find("---", 3)
        if second_dash != -1:
            body = content[second_dash + 3:]

    required_sections = [
        ("# Skill:", "Top-level skill heading"),
        ("## Overview", "Overview section"),
        ("## Objective", "Objective section"),
        ("## Background", "Background section"),
        ("## Implementation", "Implementation section"),
        ("## Structured Prompt", "Structured Prompt section"),
        ("## File Structure", "File Structure section"),
    ]

    for marker, name in required_sections:
        if marker not in body:
            issues.append(f"Missing required section: {name} ({marker})")

    recommended_sections = [
        ("### Input Specification", "Input Specification subsection"),
        ("### Processing Steps", "Processing Steps subsection"),
        ("### Output Specification", "Output Specification subsection"),
        ("## Scripts Documentation", "Scripts Documentation section"),
        ("## References Documentation", "References Documentation section"),
        ("## Usage Example", "Usage Example section"),
    ]

    for marker, name in recommended_sections:
        if marker not in body:
            warnings.append(f"Missing recommended section: {name} ({marker})")

    # Check File Structure has actual tree content
    if "## File Structure" in body:
        fs_idx = body.index("## File Structure")
        fs_section = body[fs_idx:fs_idx + 2000]
        if "```" not in fs_section:
            warnings.append("File Structure section has no code fence (expected tree listing)")
        elif "SKILL.md" not in fs_section:
            warnings.append("File Structure tree does not contain SKILL.md")

    return issues, warnings


def validate_skill_folder(skill_dir: Path) -> dict:
    """
    Validate a single skill folder for completeness and quality.
    """
    tag = skill_dir.name
    issues = []
    warnings = []

    # ------------------------------------------------------------------
    # Check SKILL.md
    # ------------------------------------------------------------------
    skill_md_path = skill_dir / "SKILL.md"
    if not skill_md_path.exists():
        issues.append("SKILL.md is missing")
    else:
        content = read_text_file(skill_md_path)
        if len(content) < 500:
            issues.append(f"SKILL.md is too short ({len(content)} chars, minimum 500)")

        yaml_issues, yaml_warnings = _check_yaml_front_matter(content)
        issues.extend(yaml_issues)
        warnings.extend(yaml_warnings)

        body_issues, body_warnings = _check_body_sections(content)
        issues.extend(body_issues)
        warnings.extend(body_warnings)

    # ------------------------------------------------------------------
    # Check scripts/
    # ------------------------------------------------------------------
    scripts_dir = skill_dir / "scripts"
    if not scripts_dir.exists():
        issues.append("scripts/ directory is missing")
    else:
        script_files = list(scripts_dir.glob("*.py"))
        if not script_files:
            issues.append("scripts/ has no .py files")
        else:
            for sf in script_files:
                sc = read_text_file(sf)
                if len(sc) < 100:
                    issues.append(f"Script {sf.name} is too short ({len(sc)} chars)")
                if "import" not in sc:
                    warnings.append(f"Script {sf.name} has no import statements")
                if "def " not in sc and "class " not in sc:
                    warnings.append(f"Script {sf.name} has no function/class definitions")
                if 'if __name__' not in sc:
                    warnings.append(f"Script {sf.name} has no __main__ guard")

    # ------------------------------------------------------------------
    # Check references/
    # ------------------------------------------------------------------
    references_dir = skill_dir / "references"
    if not references_dir.exists():
        issues.append("references/ directory is missing")
    else:
        required_refs = [
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
        for ref_name in required_refs:
            ref_path = references_dir / ref_name
            if not ref_path.exists():
                issues.append(f"references/{ref_name} is missing")
            else:
                ref_content = read_text_file(ref_path)
                if len(ref_content) < 50:
                    warnings.append(
                        f"references/{ref_name} is suspiciously short ({len(ref_content)} chars)"
                    )

        matched_dir = references_dir / "matched_files"
        if not matched_dir.exists():
            warnings.append("references/matched_files/ directory is missing")
        else:
            matched_files = [f for f in matched_dir.iterdir() if f.is_file()]
            if not matched_files:
                warnings.append("references/matched_files/ is empty (no matched repo files)")
            else:
                for mf in matched_files:
                    mf_content = read_text_file(mf)
                    if len(mf_content) < 20:
                        warnings.append(f"references/matched_files/{mf.name} is nearly empty")

    # ------------------------------------------------------------------
    # Check metadata.json
    # ------------------------------------------------------------------
    metadata_path = skill_dir / "metadata.json"
    if not metadata_path.exists():
        warnings.append("metadata.json is missing")
    else:
        try:
            with open(metadata_path, "r", encoding="utf-8") as f:
                metadata = json.load(f)

            required_meta_keys = ["tag", "scripts", "references", "yaml_metadata"]
            for key in required_meta_keys:
                if key not in metadata:
                    warnings.append(f"metadata.json missing key: {key}")

            # Validate yaml_metadata sub-fields
            if "yaml_metadata" in metadata:
                ym = metadata["yaml_metadata"]
                for ym_key in ["name", "description", "triggers", "tags"]:
                    if ym_key not in ym:
                        warnings.append(f"metadata.json yaml_metadata missing key: {ym_key}")

            # Cross-check: do listed scripts actually exist?
            if "scripts" in metadata:
                for script_rel in metadata["scripts"]:
                    script_abs = skill_dir / script_rel
                    if not script_abs.exists():
                        issues.append(
                            f"metadata.json lists script '{script_rel}' but file does not exist"
                        )

            # Cross-check: do listed references actually exist?
            if "references" in metadata:
                for ref_rel in metadata["references"]:
                    ref_abs = skill_dir / ref_rel
                    if not ref_abs.exists():
                        warnings.append(
                            f"metadata.json lists reference '{ref_rel}' but file does not exist"
                        )

        except json.JSONDecodeError as e:
            issues.append(f"metadata.json is invalid JSON: {e}")

    # ------------------------------------------------------------------
    # Cross-validate: File Structure in SKILL.md vs actual disk
    # ------------------------------------------------------------------
    if skill_md_path.exists():
        content = read_text_file(skill_md_path)
        if "## File Structure" in content:
            # Extract the tree block
            fs_start = content.index("## File Structure")
            fs_section = content[fs_start:fs_start + 3000]
            fence_start = fs_section.find("```")
            if fence_start != -1:
                fence_end = fs_section.find("```", fence_start + 3)
                if fence_end != -1:
                    tree_text = fs_section[fence_start + 3:fence_end].strip()

                    # Check that key actual files appear in the tree
                    actual_files = []
                    for p in skill_dir.rglob("*"):
                        if p.is_file() and p.name != "metadata.json":
                            actual_files.append(p.name)

                    for af in actual_files:
                        if af not in tree_text:
                            warnings.append(
                                f"File '{af}' exists on disk but not in SKILL.md File Structure"
                            )

    # ------------------------------------------------------------------
    # Determine overall status
    # ------------------------------------------------------------------
    if issues:
        status = "FAIL"
    elif warnings:
        status = "WARN"
    else:
        status = "PASS"

    return {
        "tag": tag,
        "status": status,
        "issue_count": len(issues),
        "warning_count": len(warnings),
        "issues": issues,
        "warnings": warnings,
    }


def print_result(result: dict) -> None:
    """Pretty-print a single validation result."""
    status_icon = {"PASS": "✅", "WARN": "⚠️ ", "FAIL": "❌"}[result["status"]]
    tag = result["tag"]
    logger.info(
        f"  {status_icon} {tag}: {result['status']} "
        f"({result['issue_count']} issues, {result['warning_count']} warnings)"
    )
    for issue in result["issues"]:
        logger.info(f"      ❌ ISSUE: {issue}")
    for w in result["warnings"]:
        logger.info(f"      ⚠️  WARN:  {w}")


def main():
    """Validate all skill folders in the output directory."""
    import argparse

    parser = argparse.ArgumentParser(description="Validate generated skills")
    parser.add_argument(
        "--output", type=Path, default=Path("output/skills"),
        help="Output directory containing skill folders (default: output/skills)"
    )
    parser.add_argument(
        "--tags", nargs="*", default=None,
        help="Only validate specific tags (e.g., --tags Figure1C Figure2A)"
    )
    parser.add_argument(
        "--strict", action="store_true",
        help="Treat warnings as failures"
    )
    args = parser.parse_args()

    if not args.output.exists():
        logger.error(f"Output directory not found: {args.output}")
        sys.exit(1)

    # Find all skill directories (exclude hidden dirs and special files)
    skill_dirs = sorted([
        d for d in args.output.iterdir()
        if d.is_dir() and not d.name.startswith(".")
    ])

    # Filter by tags if specified
    if args.tags:
        try:
            from .utils import safe_filename
        except ImportError:
            from utils import safe_filename  # type: ignore
        tag_set = {safe_filename(t) for t in args.tags}
        skill_dirs = [d for d in skill_dirs if d.name in tag_set]

    if not skill_dirs:
        logger.warning("No skill directories found to validate.")
        sys.exit(0)

    logger.info(f"Validating {len(skill_dirs)} skill folder(s)...")
    logger.info("")

    all_results = []
    pass_count = 0
    warn_count = 0
    fail_count = 0

    for skill_dir in skill_dirs:
        result = validate_skill_folder(skill_dir)
        all_results.append(result)
        print_result(result)

        if result["status"] == "PASS":
            pass_count += 1
        elif result["status"] == "WARN":
            warn_count += 1
        else:
            fail_count += 1

    # Summary
    logger.info("")
    logger.info("=" * 60)
    logger.info("VALIDATION SUMMARY")
    logger.info("=" * 60)
    logger.info(f"  Total validated:  {len(skill_dirs)}")
    logger.info(f"  ✅ Passed:        {pass_count}")
    logger.info(f"  ⚠️  Warnings:      {warn_count}")
    logger.info(f"  ❌ Failed:        {fail_count}")
    logger.info("=" * 60)

    # Aggregate stats
    total_issues = sum(r["issue_count"] for r in all_results)
    total_warnings = sum(r["warning_count"] for r in all_results)
    logger.info(f"  Total issues:     {total_issues}")
    logger.info(f"  Total warnings:   {total_warnings}")

    # Most common issues
    if total_issues > 0 or total_warnings > 0:
        logger.info("")
        logger.info("Most common problems:")
        from collections import Counter
        all_problems = []
        for r in all_results:
            all_problems.extend(r["issues"])
            all_problems.extend(r["warnings"])
        for problem, count in Counter(all_problems).most_common(10):
            logger.info(f"  [{count}x] {problem}")

    # Write validation report
    report_path = args.output / "validation_report.json"
    report = {
        "total": len(skill_dirs),
        "passed": pass_count,
        "warnings": warn_count,
        "failed": fail_count,
        "total_issues": total_issues,
        "total_warnings": total_warnings,
        "results": all_results,
    }
    with open(report_path, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2, ensure_ascii=False)
    logger.info(f"\nValidation report written to: {report_path}")

    # Exit code
    if fail_count > 0:
        sys.exit(1)
    if args.strict and warn_count > 0:
        logger.warning("Strict mode: treating warnings as failures.")
        sys.exit(1)
    sys.exit(0)


if __name__ == "__main__":
    main()
