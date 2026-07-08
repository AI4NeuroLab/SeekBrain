"""
Module to parse a scientific paper PDF and produce structured information
using an LLM.
"""

import fitz  # PyMuPDF
from pathlib import Path

from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage, HumanMessage

from .config import (
    LLM_MODEL, LLM_TEMPERATURE, LLM_MAX_TOKENS,
    OPENAI_API_KEY, OPENAI_BASE_URL,
    MAX_PAPER_CHUNK_SIZE,
)
from .utils import setup_logger, truncate_text

logger = setup_logger(__name__)


def extract_pdf_text(pdf_path: Path) -> str:
    """Extract full text from a PDF file using PyMuPDF."""
    logger.info(f"Extracting text from PDF: {pdf_path}")
    doc = fitz.open(str(pdf_path))
    pages_text = []
    for page_num, page in enumerate(doc):
        text = page.get_text("text")
        pages_text.append(f"--- PAGE {page_num + 1} ---\n{text}")
    full_text = "\n\n".join(pages_text)
    logger.info(f"Extracted {len(full_text)} characters from {len(doc)} pages.")
    doc.close()
    return full_text


def build_structured_paper_info(pdf_path: Path) -> dict:
    """
    Parse the paper PDF and use LLM to build structured information.

    Returns a dict with keys:
        - raw_text: Full extracted text.
        - structured_summary: LLM-generated structured overview.
        - figure_methods: LLM-generated figure-method mapping.
    """
    raw_text = extract_pdf_text(pdf_path)

    llm = ChatOpenAI(
        model=LLM_MODEL,
        temperature=LLM_TEMPERATURE,
        max_tokens=LLM_MAX_TOKENS,
        api_key=OPENAI_API_KEY,
        base_url=OPENAI_BASE_URL or None,
    )

    chunk = truncate_text(raw_text, MAX_PAPER_CHUNK_SIZE * 3)

    system_msg = SystemMessage(content=(
        "You are an expert scientific paper analyst. "
        "You will receive the full text of a research paper. "
        "Produce a comprehensive structured analysis in Markdown."
    ))

    # --- Pass 1: Structured overview ---
    logger.info("LLM Pass 1: Building structured paper overview...")
    human_msg = HumanMessage(content=f"""Analyze the following paper text and produce a STRUCTURED ANALYSIS with these exact sections:

## 1. Paper Metadata
- Title, Authors, Journal, Year

## 2. Abstract & Key Contributions
- Summarize the abstract
- List 3-5 key contributions

## 3. Paper Sections Outline
- For each major section, provide a 2-3 sentence summary

## 4. Figures and Tables
- For EACH figure and table mentioned, describe:
  - Figure/Table ID (e.g., Figure 1A, Figure 1B, Table 1)
  - What it shows
  - Key data or results depicted
  - Methods/analysis used to generate it

## 5. Methods & Algorithms
- Detailed step-by-step description of all methods
- Include data processing pipelines, statistical methods, computational tools
- Note any specific software, packages, or parameters mentioned

## 6. Data Description
- Input data types, formats, sources
- Output data types, formats
- Intermediate data representations

## 7. Evaluation & Metrics
- How results are evaluated
- Statistical tests used
- Performance metrics

## 8. Key Parameters & Configurations
- Any specific parameters, thresholds, or configurations mentioned

PAPER TEXT:
{chunk}
""")

    structured_summary = llm.invoke([system_msg, human_msg]).content
    logger.info(f"Structured summary generated: {len(structured_summary)} chars.")

    # --- Pass 2: Detailed figure/method extraction ---
    logger.info("LLM Pass 2: Extracting detailed figure-method mappings...")
    human_msg2 = HumanMessage(content=f"""Based on the following paper text, create a DETAILED MAPPING between each figure/table and the specific methods/code/analysis needed to reproduce it.

For EACH figure and table, provide:
1. **Figure/Table ID**: exact identifier
2. **Description**: what it shows
3. **Data Requirements**: what data is needed
4. **Analysis Steps**: numbered step-by-step procedure to reproduce
5. **Tools/Software**: specific tools, libraries, or software mentioned
6. **Statistical Methods**: any statistical tests or analyses
7. **Visualization Type**: plot type (scatter, heatmap, bar chart, etc.)

Format as a structured list.

PAPER TEXT:
{chunk}
""")

    figure_methods = llm.invoke([system_msg, human_msg2]).content
    logger.info(f"Figure-method mapping generated: {len(figure_methods)} chars.")

    return {
        "raw_text": raw_text,
        "structured_summary": structured_summary,
        "figure_methods": figure_methods,
    }
