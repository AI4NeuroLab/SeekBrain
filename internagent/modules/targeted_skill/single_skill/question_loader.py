"""
Module to load questions from q.jsonl and their corresponding Markdown files.
"""

from pathlib import Path

from .utils import setup_logger, load_jsonl, read_text_file

logger = setup_logger(__name__)


def load_questions(jsonl_path: Path, base_dir: Path) -> list[dict]:
    """
    Load all questions from the JSONL file and resolve their Markdown content.

    Args:
        jsonl_path: Path to q.jsonl.
        base_dir: Base directory for resolving relative .md paths.

    Returns:
        List of dicts with keys: tag, question_path, question_text, raw_record.
    """
    logger.info(f"Loading questions from: {jsonl_path}")
    records = load_jsonl(jsonl_path)
    logger.info(f"Found {len(records)} question records.")

    questions = []
    for i, record in enumerate(records):
        tag = record.get("tag", f"Q{i + 1}")
        question_rel_path = record.get("question", "")

        if not question_rel_path:
            logger.warning(f"Record {i} has no 'question' field, skipping.")
            continue

        md_path = base_dir / question_rel_path
        if not md_path.exists():
            logger.warning(f"Question file not found: {md_path}, skipping tag={tag}.")
            continue

        question_text = read_text_file(md_path)
        if not question_text.strip():
            logger.warning(f"Question file is empty: {md_path}, skipping tag={tag}.")
            continue

        questions.append({
            "tag": tag,
            "question_path": str(md_path),
            "question_rel_path": question_rel_path,
            "question_text": question_text,
            "raw_record": record,
        })
        logger.info(f"  Loaded question [{tag}]: {question_rel_path} ({len(question_text)} chars)")

    logger.info(f"Successfully loaded {len(questions)} questions.")
    return questions
