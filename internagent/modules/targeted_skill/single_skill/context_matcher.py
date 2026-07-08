"""
Module to match each question to relevant paper sections and repository files,
extracting full context for skill generation.
"""

import json

from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage, HumanMessage

from .config import (
    LLM_MODEL, LLM_TEMPERATURE, LLM_MAX_TOKENS,
    OPENAI_API_KEY, OPENAI_BASE_URL,
    MAX_FILE_CHUNK_SIZE,
)
from .utils import setup_logger, truncate_text, extract_json_from_response

logger = setup_logger(__name__)


def match_question_to_context(
    question: dict,
    paper_info: dict,
    repo_info: dict,
) -> dict:
    """
    For a given question, identify relevant paper sections and repo files,
    and extract the full matched context.

    Returns:
        Dict with tag, question_text, matched_paper_context, matched_repo_context,
        matched_repo_files, connection_analysis, reproduction_plan.
    """
    tag = question["tag"]
    question_text = question["question_text"]
    logger.info(f"Matching context for question [{tag}]...")

    llm = ChatOpenAI(
        model=LLM_MODEL,
        temperature=LLM_TEMPERATURE,
        max_tokens=LLM_MAX_TOKENS,
        api_key=OPENAI_API_KEY,
        base_url=OPENAI_BASE_URL or None,
    )

    system_msg = SystemMessage(content=(
        "You are an expert at analyzing scientific papers and matching research questions "
        "to specific paper content and code repositories. Be thorough and precise."
    ))

    # =========================================================================
    # Step 1: Identify relevant paper sections
    # =========================================================================
    logger.info(f"  [{tag}] Identifying relevant paper sections...")

    paper_structured = truncate_text(paper_info["structured_summary"], MAX_FILE_CHUNK_SIZE * 2)
    paper_figures = truncate_text(paper_info["figure_methods"], MAX_FILE_CHUNK_SIZE * 2)

    paper_match_prompt = HumanMessage(content=f"""Given the QUESTION and PAPER ANALYSIS below, identify ALL relevant paper sections, figures, methods, and data needed to answer the question.

QUESTION TAG: {tag}

QUESTION:
{question_text}

PAPER STRUCTURED ANALYSIS:
{paper_structured}

PAPER FIGURE-METHOD MAPPING:
{paper_figures}

Provide:
## 1. Relevant Paper Sections
## 2. Relevant Figures/Tables
## 3. Required Methods from Paper
## 4. Data Requirements
## 5. Key Paper Excerpts
## 6. Evaluation Criteria
""")

    matched_paper_context = llm.invoke([system_msg, paper_match_prompt]).content
    logger.info(f"  [{tag}] Paper context matched: {len(matched_paper_context)} chars.")

    # =========================================================================
    # Step 2: Identify relevant repo files
    # =========================================================================
    logger.info(f"  [{tag}] Identifying relevant repository files...")

    repo_overview = truncate_text(repo_info["repo_overview"], MAX_FILE_CHUNK_SIZE)
    file_summaries_text = "\n\n".join(
        f"### {path}\n{summary}"
        for path, summary in repo_info["file_summaries"].items()
    )
    file_summaries_chunk = truncate_text(file_summaries_text, MAX_FILE_CHUNK_SIZE * 2)

    repo_match_prompt = HumanMessage(content=f"""Given the QUESTION and REPOSITORY INFORMATION below, identify ALL relevant repository files and code sections.

QUESTION TAG: {tag}

QUESTION:
{question_text}

MATCHED PAPER CONTEXT (for reference):
{truncate_text(matched_paper_context, MAX_FILE_CHUNK_SIZE)}

REPOSITORY OVERVIEW:
{repo_overview}

FILE SUMMARIES:
{file_summaries_chunk}

Provide:
## 1. Relevant Files (RANKED by relevance, with Priority HIGH/MEDIUM/LOW)
## 2. Code Execution Order
## 3. Key Code Patterns
## 4. Data Files Referenced
## 5. Missing Pieces
""")

    matched_repo_context = llm.invoke([system_msg, repo_match_prompt]).content
    logger.info(f"  [{tag}] Repo context matched: {len(matched_repo_context)} chars.")

    # =========================================================================
    # Step 3: Extract actual relevant file contents
    # =========================================================================
    logger.info(f"  [{tag}] Extracting relevant file contents...")

    file_list_prompt = HumanMessage(content=f"""From the following repository analysis, extract ONLY the relevant file paths.

{matched_repo_context}

Available files in repo:
{repo_info['directory_tree']}

Return ONLY a JSON array of file paths, e.g.: ["path/to/file1.py", "path/to/file2.ipynb"]
Return ONLY the JSON array, nothing else.
""")

    try:
        file_list_response = llm.invoke([
            SystemMessage(content="Extract file paths as a JSON array. Return ONLY valid JSON."),
            file_list_prompt
        ]).content.strip()

        cleaned = extract_json_from_response(file_list_response)
        relevant_paths = json.loads(cleaned)
        logger.info(f"  [{tag}] Identified {len(relevant_paths)} relevant files.")
    except Exception as e:
        logger.warning(f"  [{tag}] Could not parse file list: {e}. Using all files.")
        relevant_paths = [f["relative_path"] for f in repo_info["files"]]

    # Collect actual file contents
    file_content_map = {f["relative_path"]: f["content"] for f in repo_info["files"]}
    matched_repo_files = []

    for rel_path in relevant_paths:
        if rel_path in file_content_map:
            matched_repo_files.append({
                "relative_path": rel_path,
                "content": file_content_map[rel_path],
                "summary": repo_info["file_summaries"].get(rel_path, ""),
            })
        else:
            # Fuzzy match
            for key in file_content_map:
                if rel_path in key or key in rel_path:
                    matched_repo_files.append({
                        "relative_path": key,
                        "content": file_content_map[key],
                        "summary": repo_info["file_summaries"].get(key, ""),
                    })
                    break

    logger.info(f"  [{tag}] Collected content from {len(matched_repo_files)} relevant files.")

    # =========================================================================
    # Step 4: Analyze paper-repo connection
    # =========================================================================
    logger.info(f"  [{tag}] Analyzing paper-repo connection...")

    repo_code_excerpts = ""
    for mf in matched_repo_files[:5]:
        excerpt = truncate_text(mf["content"], MAX_FILE_CHUNK_SIZE // 2)
        repo_code_excerpts += f"\n### {mf['relative_path']}\n```\n{excerpt}\n```\n"

    connection_prompt = HumanMessage(content=f"""Analyze the CONNECTION between the paper methods and the repository code for this question.

QUESTION TAG: {tag}
QUESTION:
{question_text}

MATCHED PAPER CONTEXT:
{truncate_text(matched_paper_context, MAX_FILE_CHUNK_SIZE)}

MATCHED REPO CODE:
{truncate_text(repo_code_excerpts, MAX_FILE_CHUNK_SIZE * 2)}

Provide:
## 1. Paper-to-Code Mapping
## 2. Code-to-Paper Mapping
## 3. Gap Analysis
## 4. Reproduction Strategy
## 5. Key Insights
""")

    connection_analysis = llm.invoke([system_msg, connection_prompt]).content
    logger.info(f"  [{tag}] Connection analysis: {len(connection_analysis)} chars.")

    # =========================================================================
    # Step 5: Generate a reproduction plan
    # =========================================================================
    logger.info(f"  [{tag}] Generating reproduction plan...")

    plan_prompt = HumanMessage(content=f"""Create a DETAILED STEP-BY-STEP REPRODUCTION PLAN for this question.

QUESTION TAG: {tag}
QUESTION:
{question_text}

PAPER-REPO CONNECTION:
{truncate_text(connection_analysis, MAX_FILE_CHUNK_SIZE)}

MATCHED PAPER CONTEXT:
{truncate_text(matched_paper_context, MAX_FILE_CHUNK_SIZE)}

Produce:
## Prerequisites
## Step-by-Step Procedure (with Action, Paper Reference, Code Reference, Input, Output, Parameters, Validation per step)
## Expected Output
## Troubleshooting
""")

    reproduction_plan = llm.invoke([system_msg, plan_prompt]).content
    logger.info(f"  [{tag}] Reproduction plan: {len(reproduction_plan)} chars.")

    return {
        "tag": tag,
        "question_text": question_text,
        "question_rel_path": question.get("question_rel_path", ""),
        "matched_paper_context": matched_paper_context,
        "matched_repo_context": matched_repo_context,
        "matched_repo_files": matched_repo_files,
        "connection_analysis": connection_analysis,
        "reproduction_plan": reproduction_plan,
    }
