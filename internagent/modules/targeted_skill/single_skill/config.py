"""
Configuration module for Paper2Skill + Repo2Skill pipeline.
"""

import os
from pathlib import Path

# =============================================================================
# LLM Configuration
# =============================================================================
LLM_MODEL = "gemini-3.1-flash-lite-preview" #"gemini-3.1-pro-preview"
LLM_TEMPERATURE = 1.0
LLM_MAX_TOKENS = 64000

# OpenAI-compatible endpoint for Gemini
# Set OPENAI_API_KEY and OPENAI_BASE_URL in your environment
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "")
OPENAI_BASE_URL = os.environ.get("OPENAI_BASE_URL", "")

# =============================================================================
# Path Configuration
# =============================================================================
PROJECT_ROOT = Path(__file__).parent.resolve()

PAPER_PATH = PROJECT_ROOT / "papers" / "sciadv.adv7576.pdf"
REPO_PATH = PROJECT_ROOT / "repos" / "Legare-zebrafish-brain-networks"
QUESTIONS_JSONL = PROJECT_ROOT / "q.jsonl"
QUESTIONS_BASE_DIR = PROJECT_ROOT  # base dir for resolving question .md paths

OUTPUT_DIR = PROJECT_ROOT / "output" / "skills"

# =============================================================================
# Parsing Configuration
# =============================================================================
# File extensions to parse in the repository
REPO_CODE_EXTENSIONS = {".py", ".ipynb", ".md", ".r", ".R", ".sh", ".yaml", ".yml", ".toml", ".cfg", ".txt"}
# Max characters per file chunk sent to LLM
MAX_FILE_CHUNK_SIZE = 15000
# Max characters for paper chunk sent to LLM
MAX_PAPER_CHUNK_SIZE = 200000

# =============================================================================
# Logging
# =============================================================================
LOG_LEVEL = "INFO"
LOG_FORMAT = "%(asctime)s [%(levelname)s] %(name)s: %(message)s"
