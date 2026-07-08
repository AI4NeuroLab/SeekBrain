"""
Utility functions for the skill generation pipeline.
"""

import logging
import sys
import json
import re
from pathlib import Path
from typing import Optional

from .config import LOG_LEVEL, LOG_FORMAT


def setup_logger(name: str, level: Optional[str] = None) -> logging.Logger:
    """Create and configure a logger instance."""
    logger = logging.getLogger(name)
    if not logger.handlers:
        handler = logging.StreamHandler(sys.stdout)
        handler.setFormatter(logging.Formatter(LOG_FORMAT))
        logger.addHandler(handler)
    logger.setLevel(getattr(logging, level or LOG_LEVEL, logging.INFO))
    return logger


def read_text_file(filepath: Path, encoding: str = "utf-8") -> str:
    """Safely read a text file, returning empty string on failure."""
    try:
        return filepath.read_text(encoding=encoding)
    except Exception:
        try:
            return filepath.read_text(encoding="latin-1")
        except Exception:
            return ""


def write_text_file(filepath: Path, content: str, encoding: str = "utf-8") -> None:
    """Write content to a text file, creating parent directories as needed."""
    filepath.parent.mkdir(parents=True, exist_ok=True)
    filepath.write_text(content, encoding=encoding)


def load_jsonl(filepath: Path) -> list[dict]:
    """Load a JSONL file into a list of dicts."""
    logger = setup_logger("utils")
    records = []
    with open(filepath, "r", encoding="utf-8") as f:
        for line_num, line in enumerate(f, 1):
            line = line.strip()
            if line:
                try:
                    records.append(json.loads(line))
                except json.JSONDecodeError as e:
                    logger.warning(f"Skipping invalid JSON at line {line_num}: {e}")
    return records


def truncate_text(text: str, max_chars: int) -> str:
    """Truncate text to max_chars, appending a note if truncated."""
    if len(text) <= max_chars:
        return text
    return text[:max_chars] + "\n\n... [TRUNCATED] ..."


def safe_filename(name: str) -> str:
    """Convert a string into a safe filename."""
    return "".join(c if c.isalnum() or c in "-_." else "_" for c in name)

# new
def _repo_identifier(repo_link: str | None) -> str:                                                                                                      
      """Extract '<owner>_<name>' from a GitHub URL; 'no_repo' if empty/unparseable."""                                                                    
      if not repo_link:                  
          return "no_repo"                                                                                                                                 
      s = repo_link.rstrip("/")                                                                                   
      if s.endswith(".git"):                                                                                                                               
          s = s[:-4]
      parts = s.split("/")                                                                                                                                 
      if len(parts) >= 2:                                                                                         
          return f"{parts[-2]}_{parts[-1]}"
      return safe_filename(s)[:40] 

def extract_code_block(text: str, language: str = "python") -> str:
    """
    Extract the first code block of the specified language from markdown text.
    Handles triple-backtick fences with or without language specifier.
    """
    # Try language-specific fence first
    pattern = rf"```{language}\s*\n(.*?)```"
    match = re.search(pattern, text, re.DOTALL)
    if match:
        return match.group(1).strip()

    # Try generic code fence
    pattern = r"```\s*\n(.*?)```"
    match = re.search(pattern, text, re.DOTALL)
    if match:
        return match.group(1).strip()

    # Fallback: split by ```
    parts = text.split("```")
    if len(parts) >= 3:
        code = parts[1]
        lines = code.split("\n")
        if lines and lines[0].strip().lower() in ("python", "python3", "py", ""):
            code = "\n".join(lines[1:])
        return code.strip()

    return ""


def extract_json_from_response(text: str) -> str:
    """Extract JSON content from an LLM response that may contain markdown fences."""
    text = text.strip()
    if "```" in text:
        pattern = r"```(?:json)?\s*\n(.*?)```"
        match = re.search(pattern, text, re.DOTALL)
        if match:
            return match.group(1).strip()
    return text


def build_file_tree_string(base_dir: Path, indent: str = "    ") -> str:
    """
    Build a formatted directory tree string for a given directory.
    Only includes files, not empty directories.
    """
    lines = []
    base_name = base_dir.name + "/"
    lines.append(base_name)

    def _recurse(current_dir: Path, prefix: str):
        entries = sorted(current_dir.iterdir(), key=lambda p: (p.is_file(), p.name))
        dirs = [e for e in entries if e.is_dir()]
        files = [e for e in entries if e.is_file()]

        for d in dirs:
            lines.append(f"{prefix}{d.name}/")
            _recurse(d, prefix + indent)
        for f in files:
            lines.append(f"{prefix}{f.name}")

    _recurse(base_dir, indent)
    return "\n".join(lines)
