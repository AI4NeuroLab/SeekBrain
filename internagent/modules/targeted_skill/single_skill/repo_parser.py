"""
Module to parse a code repository and build structured information
about its contents using an LLM.
"""

import nbformat
from pathlib import Path

from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage, HumanMessage

from .config import (
    LLM_MODEL, LLM_TEMPERATURE, LLM_MAX_TOKENS,
    OPENAI_API_KEY, OPENAI_BASE_URL,
    REPO_CODE_EXTENSIONS, MAX_FILE_CHUNK_SIZE,
)
from .utils import setup_logger, read_text_file, truncate_text

logger = setup_logger(__name__)


def _extract_notebook_content(nb_path: Path) -> str:
    """Extract code and markdown cells from a Jupyter notebook."""
    try:
        nb = nbformat.read(str(nb_path), as_version=4)
    except Exception as e:
        logger.warning(f"Could not parse notebook {nb_path}: {e}")
        return ""

    parts = []
    for i, cell in enumerate(nb.cells):
        cell_type = cell.cell_type
        source = cell.source.strip()
        if source:
            parts.append(f"# Cell {i + 1} [{cell_type}]\n{source}")
    return "\n\n".join(parts)


def collect_repo_files(repo_path: Path) -> list[dict]:
    """Walk the repository and collect all relevant code/doc files."""
    logger.info(f"Scanning repository: {repo_path}")
    files = []
    skip_dirs = {".git", "__pycache__", ".ipynb_checkpoints", "node_modules", ".venv", "venv", "env"}

    for fpath in sorted(repo_path.rglob("*")):
        if not fpath.is_file():
            continue
        parts = fpath.relative_to(repo_path).parts
        if any(p in skip_dirs for p in parts):
            continue
        ext = fpath.suffix.lower()
        if ext not in REPO_CODE_EXTENSIONS:
            continue

        content = _extract_notebook_content(fpath) if ext == ".ipynb" else read_text_file(fpath)

        if content.strip():
            rel_path = str(fpath.relative_to(repo_path))
            files.append({
                "path": str(fpath),
                "relative_path": rel_path,
                "extension": ext,
                "content": content,
                "size": len(content),
            })
            logger.debug(f"  Collected: {rel_path} ({len(content)} chars)")

    logger.info(f"Collected {len(files)} files from repository.")
    return files


def build_structured_repo_info(repo_path: Path) -> dict:
    """
    Parse the repository and use LLM to build structured information.

    Returns a dict with keys:
        - files: list of file info dicts
        - directory_tree: string representation of the directory structure
        - file_summaries: LLM-generated summary for each file
        - repo_overview: LLM-generated overall repository analysis
    """
    files = collect_repo_files(repo_path)

    dir_tree_lines = []
    for f in files:
        dir_tree_lines.append(f"  {f['relative_path']} ({f['size']} chars)")
    directory_tree = "Repository Structure:\n" + "\n".join(dir_tree_lines)
    logger.info(f"Directory tree:\n{directory_tree}")

    llm = ChatOpenAI(
        model=LLM_MODEL,
        temperature=LLM_TEMPERATURE,
        max_tokens=LLM_MAX_TOKENS,
        api_key=OPENAI_API_KEY,
        base_url=OPENAI_BASE_URL or None,
    )

    system_msg = SystemMessage(content=(
        "You are an expert code analyst. "
        "Analyze code files from a scientific research repository and provide structured summaries."
    ))

    # --- Summarize each file ---
    logger.info("Summarizing individual repository files...")
    file_summaries = {}
    for f in files:
        rel_path = f["relative_path"]
        content_chunk = truncate_text(f["content"], MAX_FILE_CHUNK_SIZE)

        human_msg = HumanMessage(content=f"""Analyze this file from a scientific code repository and provide a structured summary:

**File**: {rel_path}
**Extension**: {f['extension']}

```
{content_chunk}
```

Provide:
1. **Purpose**: What this file does (1-2 sentences)
2. **Key Functions/Classes**: List main functions or classes with brief descriptions
3. **Data Flow**: What data it reads/writes/processes
4. **Dependencies**: External libraries or other repo files it depends on
5. **Analysis Methods**: Any scientific/statistical methods implemented
6. **Figures/Outputs**: Any figures, plots, or outputs it generates
7. **Key Parameters**: Important configurable parameters
""")

        try:
            summary = llm.invoke([system_msg, human_msg]).content
            file_summaries[rel_path] = summary
            logger.info(f"  Summarized: {rel_path}")
        except Exception as e:
            logger.error(f"  Failed to summarize {rel_path}: {e}")
            file_summaries[rel_path] = f"[Error summarizing file: {e}]"

    # --- Build overall repo overview ---
    logger.info("Building overall repository overview...")
    summaries_text = "\n\n".join(
        f"### {path}\n{summary}" for path, summary in file_summaries.items()
    )
    summaries_chunk = truncate_text(summaries_text, MAX_FILE_CHUNK_SIZE * 3)

    human_msg_overview = HumanMessage(content=f"""Based on the following file summaries from a scientific research repository, provide a comprehensive REPOSITORY OVERVIEW:

{directory_tree}

FILE SUMMARIES:
{summaries_chunk}

Produce:
## 1. Repository Purpose
## 2. Data Pipeline
## 3. Key Scripts & Their Roles
## 4. Analysis Methods Implemented
## 5. Outputs & Figures
## 6. Dependencies & Environment
## 7. File Dependency Graph
""")

    try:
        repo_overview = llm.invoke([system_msg, human_msg_overview]).content
        logger.info(f"Repository overview generated: {len(repo_overview)} chars.")
    except Exception as e:
        logger.error(f"Failed to generate repo overview: {e}")
        repo_overview = f"[Error: {e}]"

    return {
        "files": files,
        "directory_tree": directory_tree,
        "file_summaries": file_summaries,
        "repo_overview": repo_overview,
    }