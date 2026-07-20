#!/usr/bin/env python3
"""
Scoring script for scientific reproduction outputs.

For each figure that has both a rubric and a model output, uses an OpenAI-compatible
vision model to score the conclusion against the rubric.

Two layout modes are supported (controlled by --layout):

  standard  Results are organised as:
              <output_dir>/<paper>/<fig_tag>/figure.png
              <output_dir>/<paper>/<fig_tag>/conclusions.json  (or conclusion.md)
            Use --output-dir to point at the root that contains <paper> subdirs.
            Example:
              python score_outputs_cc.py \
                --layout standard \
                --output-dir results/michael/20260422 \
                --paper "Michael_2019_Neuron" --fig Fig_6C

  ours      Results live in a single flat directory (our pipeline output):
              <result_dir>/figure.png
              <result_dir>/conclusions.json
            Use --result-dir to point directly at that directory.
            Example:
              python score_outputs_cc.py \
                --layout ours \
                --result-dir results/expr_Fig_6C-131510 \
                --paper "Michael_2019_Neuron" --fig Fig_6C

  auto      (default) Try standard first, then ours.

Other options:
    --output-dir   Batch root dir for standard/auto layout.
    --summary-only Print existing score table without API calls.

Outputs:
    scores/<paper>/<fig>/score_<eval_model>.json
    scores/summary.json
"""

import os
import re
import sys
import json
import base64
import argparse
import traceback
from pathlib import Path
from datetime import datetime

from openai import OpenAI

# ── Paths ───────────────────────────────────────────────────────────────
# This v3 scorer lives in SeekBrain, while the rubric/GT figure remains in the
# evaluate repository. Allow an override, but preserve the benchmark default.
EVAL_DIR    = Path(os.environ.get(
    "EVALUATE_DIR", "/mnt/shared-storage-user/zhuyuqing-p/evaluate"
)).resolve()
RUBRIC_DIR  = EVAL_DIR / "evaluate_query" / "rubric"
GT_FIG_DIR  = EVAL_DIR / "evaluate_query" / "gt_figure"
SCORES_DIR  = EVAL_DIR / "scores"
MAPPING_FILE = EVAL_DIR / "benchmark_id_mapping.md"

DEFAULT_MODEL   = "claude-opus-4-6"
DEFAULT_BASE_URL = "http://35.220.164.252:3888/v1"

# ── CC layout mappings (numeric ID ↔ paper name, letter ↔ fig tag) ────────

PAPER_ID_BY_NAME = {
    "Chen_2018_Neuron": "1",
    "IBL_Witten_2025_Nature": "2",
    "Findling_Pouget_2025_Nature": "3",
    "Michael_2019_Neuron": "5",
    "Ryosuke_2026_Nature": "7",
    "Adam_2023_Cell": "11",
    "Arhens_2026_bioRxiv": "13",
    "Wilson_2025_Nature_Neuroscience": "14",
    "Zeng_2025_Nature": "15",
    "Engel_2026_Nature": "17",
    "Komiyama_2025_Science": "26",
    "Koninck_2025_Science_Advances": "27",
}

PAPER_NAME_BY_ID = {v: k for k, v in PAPER_ID_BY_NAME.items()}

FIG_LETTER_BY_PAPER_ID_AND_FIG = {
    ("1", "Fig_2A"): "A",
    ("1", "Fig_2H"): "B",
    ("1", "Fig_3B"): "C",
    ("1", "Fig_3D"): "D",
    ("1", "Fig_4G"): "E",
    ("2", "Fig_4B"): "D",
    ("2", "Fig_4F"): "A",
    ("2", "Fig_4IJK"): "B",
    ("2", "Fig_4LM"): "C",
    ("3", "Fig_2A"): "A",
    ("3", "Fig_3A"): "B",
    ("3", "Fig_3C"): "C",
    ("3", "Fig_4A"): "D",
    ("3", "Fig_4F"): "E",
    ("5", "Fig_5A"): "A",
    ("5", "Fig_5B"): "B",
    ("5", "Fig_6C"): "C",
    ("5", "Fig_8B"): "D",
    ("7", "Fig_2F"): "A",
    ("7", "Fig_3E"): "B",
    ("7", "Fig_4A"): "C",
    ("7", "Fig_4G"): "D",
    ("11", "Fig_1H"): "A",
    ("11", "Fig_2C"): "B",
    ("11", "Fig_2D"): "C",
    ("11", "Fig_3B"): "D",
    ("11", "Fig_3G"): "E",
    ("13", "Fig_3B"): "A",
    ("13", "Fig_4D"): "B",
    ("13", "Fig_5A"): "C",
    ("13", "Fig_5E"): "D",
    ("13", "Fig_6H"): "E",
    ("14", "Fig_2C"): "A",
    ("14", "Fig_3C"): "B",
    ("14", "Fig_3D"): "C",
    ("14", "Fig_5E"): "D",
    ("15", "FIG_1C"): "A",
    ("15", "FIG_2B"): "B",
    ("15", "Fig_4B"): "C",
    ("15", "Fig_5A"): "D",
    ("15", "Fig_5D"): "E",
    ("17", "Fig_2B"): "A",
    ("17", "Fig_3A"): "B",
    ("17", "Fig_3C"): "C",
    ("17", "Fig_4B"): "D",
    ("26", "Fig_2B"): "A",
    ("26", "Fig_2H"): "B",
    ("26", "Fig_5C"): "C",
    ("26", "Fig_5F"): "D",
    ("26", "Fig_5M"): "E",
    ("27", "Fig_1E"): "A",
    ("27", "Fig_2B"): "B",
    ("27", "Fig_3A"): "C",
    ("27", "Fig_5F"): "D",
}

FIG_TAG_BY_PAPER_ID_AND_LETTER = {(pid, letter): fig
                                   for (pid, fig), letter in FIG_LETTER_BY_PAPER_ID_AND_FIG.items()}


def _load_benchmark_mapping(path: Path = MAPPING_FILE) -> None:
    """Load paper/figure aliases from benchmark_id_mapping.md when present."""
    if not path.exists():
        return

    section = None
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if line == "## Papers":
            section = "papers"
            continue
        if line == "## Question/Figure Files":
            section = "figures"
            continue
        if line.startswith("## ") and line not in {"## Papers", "## Question/Figure Files"}:
            section = None
            continue
        if not line.startswith("|") or "---" in line:
            continue

        cells = [cell.strip() for cell in line.strip("|").split("|")]
        if section == "papers" and len(cells) >= 2 and cells[0] != "ID":
            paper_id, paper_name = cells[0], cells[1]
            PAPER_ID_BY_NAME[paper_name] = paper_id
            PAPER_NAME_BY_ID[paper_id] = paper_name
        elif section == "figures" and len(cells) >= 3 and cells[0] != "ID":
            paper_id, letter, fig_tag = cells[0], cells[1], cells[2]
            # The mapping file is authoritative. Remove stale hard-coded aliases
            # for the same benchmark slot so one output cannot match two rubrics.
            for key, mapped_letter in list(FIG_LETTER_BY_PAPER_ID_AND_FIG.items()):
                if key[0] == paper_id and mapped_letter == letter and key[1] != fig_tag:
                    del FIG_LETTER_BY_PAPER_ID_AND_FIG[key]
            FIG_LETTER_BY_PAPER_ID_AND_FIG[(paper_id, fig_tag)] = letter
            FIG_TAG_BY_PAPER_ID_AND_LETTER[(paper_id, letter)] = fig_tag


_load_benchmark_mapping()


# ── Helpers ────────────────────────────────────────────────────────────────

def encode_image(path: Path) -> str:
    with open(path, "rb") as f:
        return base64.standard_b64encode(f.read()).decode("utf-8")


def image_block(path: Path) -> dict:
    suffix = path.suffix.lower()
    media_map = {".png": "image/png", ".jpg": "image/jpeg",
                 ".jpeg": "image/jpeg", ".gif": "image/gif"}
    media_type = media_map.get(suffix, "image/png")
    return {
        "type": "image_url",
        "image_url": {"url": f"data:{media_type};base64,{encode_image(path)}"},
    }


def detect_fig_tag(result_dir: Path) -> str | None:
    """
    Auto-detect fig_tag from a result directory.
    Strategy 1: find generated_code{tag}.py  -> extract {tag}
    Strategy 2: regex search for Fig_[A-Za-z0-9]+ in dir name
    """
    for py_file in result_dir.glob("generated_code*.py"):
        m = re.match(r"generated_code(.+)\.py$", py_file.name)
        if m:
            return m.group(1)

    m = re.search(r"(Fig_\w+)", result_dir.name)  # noqa: W605
    if m:
        return m.group(1)

    return None


def _strip_output_suffix(name: str) -> str:
    """Remove batch suffixes used by generated output directories."""
    current = name.strip("_")
    for _ in range(4):
        stripped = re.sub(r'_(?:query_)?\d+$', '', current)
        stripped = re.sub(r'_query$', '', stripped)
        if stripped == current:
            break
        current = stripped
    return current


def _paper_aliases(name: str | None) -> set[str]:
    if not name:
        return set()
    aliases = {name}
    stripped = _strip_output_suffix(name)
    aliases.add(stripped)
    if name in PAPER_NAME_BY_ID:
        aliases.add(PAPER_NAME_BY_ID[name])
    if stripped in PAPER_ID_BY_NAME:
        aliases.add(PAPER_ID_BY_NAME[stripped])
    if name in PAPER_ID_BY_NAME:
        aliases.add(PAPER_ID_BY_NAME[name])
    for alias in list(aliases):
        if alias in PAPER_NAME_BY_ID:
            aliases.add(PAPER_NAME_BY_ID[alias])
        if alias in PAPER_ID_BY_NAME:
            aliases.add(PAPER_ID_BY_NAME[alias])
    return {alias for alias in aliases if alias}


def _fig_aliases(paper_name: str | None, fig_tag: str | None) -> set[str]:
    if not fig_tag:
        return set()
    aliases = {fig_tag}
    for paper_alias in _paper_aliases(paper_name):
        paper_id = paper_alias if paper_alias in PAPER_NAME_BY_ID else PAPER_ID_BY_NAME.get(paper_alias)
        if not paper_id:
            continue
        letter = FIG_LETTER_BY_PAPER_ID_AND_FIG.get((paper_id, fig_tag))
        if letter:
            aliases.add(letter)
        original = FIG_TAG_BY_PAPER_ID_AND_LETTER.get((paper_id, fig_tag))
        if original:
            aliases.add(original)
    return {alias for alias in aliases if alias}


def _canonical_original_names(paper_name: str, fig_tag: str) -> tuple[str, str]:
    """Return original paper/Fig names for GT lookup where possible."""
    paper_id = paper_name if paper_name in PAPER_NAME_BY_ID else PAPER_ID_BY_NAME.get(_strip_output_suffix(paper_name))
    original_paper = PAPER_NAME_BY_ID.get(paper_id, _strip_output_suffix(paper_name))
    original_fig = FIG_TAG_BY_PAPER_ID_AND_LETTER.get((paper_id, fig_tag), fig_tag)
    return original_paper, original_fig


def discover_rubrics(fig_filter: str = None, paper_filter: str = None):
    """
    Yield (paper_name, fig_tag, rubric_path, rubric_data).

    Rubric files are named <fig_tag>.json (e.g. Fig_6C.json). Legacy
    *_result*.json files are ignored.
    """
    paper_filter_aliases = _paper_aliases(paper_filter)
    for paper_dir in sorted(RUBRIC_DIR.iterdir()):
        if not paper_dir.is_dir():
            continue
        paper_name = paper_dir.name
        if paper_filter and paper_name not in paper_filter_aliases:
            continue
        fig_filter_aliases = _fig_aliases(paper_name, fig_filter)
        for rfile in sorted(paper_dir.glob("*.json")):
            if "_result" in rfile.stem:
                continue
            with open(rfile) as f:
                rubric_data = json.load(f)
            fig_tag = rubric_data.get("tag", rfile.stem)
            if fig_filter and fig_tag not in fig_filter_aliases and rfile.stem not in fig_filter_aliases:
                continue
            yield paper_name, fig_tag, rfile, rubric_data


def _load_conclusions(d: Path) -> str | None:
    """Load only conclusions and summary, falling back to conclusion.md.

    This v2 experiment includes the core conclusions plus the concise summary,
    while excluding confidence, limitations, and next-research metadata.
    """
    conc = d / "conclusions.json"
    if conc.exists():
        data = json.loads(conc.read_text(encoding="utf-8"))
        if isinstance(data, dict):
            selected = {
                key: data[key]
                for key in ("conclusions", "summary")
                if key in data
            }
        elif isinstance(data, list):
            selected = []
            for entry in data:
                if isinstance(entry, dict):
                    selected.append({
                        key: entry[key]
                        for key in ("conclusions", "summary")
                        if key in entry
                    })
                elif isinstance(entry, str):
                    selected.append(entry)
        else:
            selected = data
        return json.dumps(selected, indent=2, ensure_ascii=False)
    md = d / "conclusion.md"
    if md.exists():
        return md.read_text(encoding="utf-8")
    return None


def _first_png(d: Path) -> Path | None:
    """Return figure.png if it exists, else the first *.png in the directory."""
    fixed = d / "figure.png"
    if fixed.exists():
        return fixed
    pngs = sorted(d.glob("*.png"))
    return pngs[0] if pngs else None


def _best_png(d: Path) -> Path | None:
    """Prefer figure_refine.png over figure.png; fall back to first *.png."""
    refine = d / "figure_refine.png"
    if refine.exists():
        return refine
    return _first_png(d)


def _normalize_paper_dir(name: str) -> str:
    """Convert 'Author, Year, Journal' -> 'Author_Year_Journal' for directory lookup."""
    return re.sub(r'[\s,]+', '_', name).strip('_')


def find_output_standard(paper_name: str, fig_tag: str, base: Path):
    """
    Standard layout:  <base>/<paper>/<fig_tag>/figure.png + conclusions.json|conclusion.md
    Also handles a round subdirectory:  <base>/<paper>/<fig_tag>/round_*/
    Also handles flat layout:  <base>/<paper>/{fig_tag}_*.png + {fig_tag}_conclusion.md
    Paper dir is tried both as-is and with name normalized (commas/spaces -> underscores).
    """
    paper_dirs = [base / paper_name, base / _normalize_paper_dir(paper_name)]
    for paper_dir in paper_dirs:
        if not paper_dir.exists():
            continue

        # Subdirectory layout: <paper_dir>/<fig_tag>/
        std_dir = paper_dir / fig_tag
        if std_dir.exists():
            png        = _first_png(std_dir)
            conclusion = _load_conclusions(std_dir)
            if png is None and conclusion is None:
                subdirs = sorted(d for d in std_dir.iterdir() if d.is_dir())
                for sub in subdirs:
                    png        = _first_png(sub)
                    conclusion = _load_conclusions(sub)
                    if png or conclusion:
                        break
            if png is not None or conclusion is not None:
                return png, conclusion, None

        # Flat layout: files named {fig_tag}_*.png / {fig_tag}_conclusion.md in paper_dir
        pngs = sorted(paper_dir.glob(f"{fig_tag}*.png"))
        png  = pngs[0] if pngs else None
        conclusion = None
        md = paper_dir / f"{fig_tag}_conclusion.md"
        if md.exists():
            conclusion = md.read_text(encoding="utf-8")
        else:
            conc = paper_dir / f"{fig_tag}_conclusions.json"
            if conc.exists():
                data  = json.loads(conc.read_text(encoding="utf-8"))
                items = data.get("conclusions", [])
                if items:
                    conclusion = "\n\n".join(str(i) for i in items)
        if png is not None or conclusion is not None:
            return png, conclusion, None

    return None, None, None


def find_output_ours(paper_name: str, fig_tag: str,
                     base: Path = None, result_dir: Path = None):
    """
    Ours layout:  a flat result directory that contains figure.png + conclusions.json.

    If result_dir is given, use it directly.
    Otherwise scan base for any subdirectory whose name contains fig_tag
    (handles expr_Fig_6C-131510, Fig_6C-230425, etc.).
    """
    if result_dir and result_dir.exists():
        return _first_png(result_dir), _load_conclusions(result_dir), result_dir.name

    if base is None:
        return None, None, None

    candidates = sorted(d for d in base.iterdir() if d.is_dir() and fig_tag in d.name)
    if not candidates:
        return None, None, None
    fig_dir = candidates[-1]   # latest timestamp wins
    return _first_png(fig_dir), _load_conclusions(fig_dir), fig_dir.name


def find_output_ns(paper_name: str, fig_tag: str, base: Path = None, run_dir: Path = None):
    """
    NS layout:  <base>/<paper>/<fig_tag>-<timestamp>/round_<N>/figure(_refine).png

    - If run_dir is given, use it directly (skip scanning).
    - Otherwise scan base, pick the latest <fig_tag>-* dir.
    - Within the run dir, picks the latest round_* subdir.
    - Prefers figure_refine.png over figure.png.
    """
    if run_dir is not None:
        rounds = sorted(d for d in run_dir.iterdir() if d.is_dir() and d.name.startswith("round_"))
        search_dirs = [rounds[-1], run_dir] if rounds else [run_dir]
        for d in search_dirs:
            png        = _best_png(d)
            conclusion = _load_conclusions(d)
            if png is not None or conclusion is not None:
                return png, conclusion, run_dir.name
        return None, None, run_dir.name

    paper_dirs = [base / paper_name, base / _normalize_paper_dir(paper_name)]
    for paper_dir in paper_dirs:
        if not paper_dir.exists():
            continue

        candidates = sorted(
            d for d in paper_dir.iterdir()
            if d.is_dir() and d.name.startswith(f"{fig_tag}-")
        )
        if not candidates:
            continue

        _run_dir = candidates[-1]  # latest timestamp wins

        rounds = sorted(d for d in _run_dir.iterdir() if d.is_dir() and d.name.startswith("round_"))
        search_dirs = [rounds[-1], _run_dir] if rounds else [_run_dir]

        for d in search_dirs:
            png        = _best_png(d)
            conclusion = _load_conclusions(d)
            if png is not None or conclusion is not None:
                return png, conclusion, _run_dir.name

    return None, None, None


def find_output_cc(paper_name: str, fig_tag: str, base: Path):
    """CC layout: <base>/<numeric_id>/<letter>/conclusion.md + analyze.png

    Maps paper_name -> numeric ID, fig_tag -> letter using the lookup tables.
    """
    paper_id = PAPER_ID_BY_NAME.get(paper_name)
    if not paper_id:
        return None, None, None

    letter = FIG_LETTER_BY_PAPER_ID_AND_FIG.get((paper_id, fig_tag))
    if not letter:
        return None, None, None

    run_dir = base / paper_id / letter
    if not run_dir.exists():
        return None, None, None

    png = run_dir / "analyze.png"
    if not png.exists():
        png = _first_png(run_dir)

    conclusion = None
    md = run_dir / "conclusion.md"
    if md.exists():
        conclusion = md.read_text(encoding="utf-8")
    else:
        conclusion = _load_conclusions(run_dir)

    if png is not None or conclusion is not None:
        return png, conclusion, f"{paper_id}/{letter}"

    return None, None, None


def discover_runs_ns(base: Path, paper_filter=None, fig_filter=None):
    """
    Yield (paper_name, fig_tag, run_dir) for every <fig_tag>-<timestamp> directory
    found under base/<paper>/.  Used for batch NS-layout evaluation.
    """
    if not base.exists():
        return
    for paper_dir in sorted(base.iterdir()):
        if not paper_dir.is_dir():
            continue
        paper_name = paper_dir.name
        if paper_filter and paper_name != paper_filter:
            continue
        for run_dir in sorted(paper_dir.iterdir()):
            if not run_dir.is_dir():
                continue
            m = re.match(r'^(.+)-(\d+)$', run_dir.name)
            if not m:
                continue
            fig_tag = m.group(1)
            if fig_filter and fig_tag != fig_filter:
                continue
            yield paper_name, fig_tag, run_dir


def discover_runs_in_date_dir(date_dir: Path, paper_name: str, fig_filter=None):
    """
    Yield (paper_name, fig_tag, run_dir) for every <fig_tag>-<timestamp> directory
    found directly inside `date_dir`. Used when the user passes a single
    <results_root>/<paper>/<date>/ directory via --input-dir.
    """
    if not date_dir.exists():
        return
    for run_dir in sorted(date_dir.iterdir()):
        if not run_dir.is_dir():
            continue
        m = re.match(r'^(.+)-(\d+)$', run_dir.name)
        if not m:
            continue
        fig_tag = m.group(1)
        if fig_filter and fig_tag != fig_filter:
            continue
        yield paper_name, fig_tag, run_dir


def find_output(paper_name: str, fig_tag: str,
                output_dir: Path = None,
                result_dir: Path = None,
                layout: str = "auto",
                run_dir: Path = None):
    """
    Return (figure_path, conclusion_text, run_id) or (None, None, None).

    layout:
      "standard"  <output_dir>/<paper>/<fig_tag>/figure.png + conclusions.json|conclusion.md
      "ours"      result_dir (direct) or <output_dir>/**/*{fig_tag}*/ (scan)
      "ns"        <output_dir>/<paper>/<fig_tag>-<timestamp>/round_N/figure(_refine).png
      "cc"        <output_dir>/<numeric_id>/<letter>/conclusion.md + analyze.png
      "auto"      try standard first, then ours
    run_dir: if given and layout is "ns", use it directly instead of scanning.
    """
    base = output_dir or EVAL_DIR / "output"

    if layout == "cc":
        return find_output_cc(paper_name, fig_tag, base)

    if layout == "standard":
        return find_output_standard(paper_name, fig_tag, base)

    if layout == "ours":
        return find_output_ours(paper_name, fig_tag, base, result_dir)

    if layout == "ns":
        return find_output_ns(paper_name, fig_tag, base, run_dir=run_dir)

    # auto: standard → ours
    png, conclusion, run_id = find_output_standard(paper_name, fig_tag, base)
    if png is not None or conclusion is not None:
        return png, conclusion, run_id
    return find_output_ours(paper_name, fig_tag, base, result_dir)


def find_gt_figure(paper_name: str, fig_tag: str) -> Path | None:
    paper_name, fig_tag = _canonical_original_names(paper_name, fig_tag)
    gt_dir = GT_FIG_DIR / paper_name
    if not gt_dir.exists():
        return None

    # Prefer an exact stem match. Substring matching alone makes tags such as
    # Fig_4B incorrectly select Fig_4BCDE.png depending on directory order.
    exact_matches = sorted(
        f for f in gt_dir.iterdir()
        if f.is_file() and f.suffix.lower() == ".png" and f.stem == fig_tag
    )
    if exact_matches:
        return exact_matches[0]

    # Preserve compatibility with legacy assets whose filenames add a suffix.
    for f in sorted(gt_dir.iterdir()):
        if fig_tag in f.name and f.suffix.lower() == ".png":
            return f
    return None


###### version 1 
# You are an expert scientific evaluator assessing the quality of a scientific \
# figure reproduction. You will be shown:
# 1. The ground-truth (GT) figure from the original paper.
# 2. The model's reproduced figure.
# 3. The model's written conclusion/methods summary.
# 4. A rubric that specifies exactly how to assign points.

# Your task is to assign a score strictly following the rubric criteria, \
# deduction rules, and acceptable deviations. Be rigorous and consistent. \
# Output your reasoning as plain text, ending with the final score on its own line.
# 

###### version 2
# You are an expert evaluator for scientific figure reproduction 
# in neuroscience research. You will be provided with:

# 1. GROUND TRUTH (GT): The original figure from the paper.
# 2. REPRODUCTION: The model's reproduced figure.
# 3. CONCLUSION: The model's written methods/results summary.
# 4. RUBRIC: Scoring criteria with point allocations and 
#    deduction rules.

# Evaluation procedure — follow in this exact order:
#   Step 1. Read the rubric fully before examining any figure.
#   Step 2. For each rubric item, assess the GT figure, 
#           the reproduced figure, and the conclusion 
#           independently before assigning points.
#   Step 3. Assign points strictly per rubric. Do not award 
#           points for criteria not listed, and do not deduct 
#           beyond the maximum deduction specified.
#   Step 4. For each rubric item, write one sentence justifying 
#           your score, citing specific evidence 
#           (e.g., exact values, visual features, quoted text).
#   Step 5. Sum item scores for the final total.
#   Step 6. End your response with the final score as a single 
#           integer on its own line (e.g., "72"). This must be 
#           the last number in your entire response.
# 

# ── Scoring ────────────────────────────────────────────────────────────────

SYSTEM_PROMPT = """\
You are a strict but fair scientific benchmark evaluator.
Grade only the submitted artifacts against the supplied rubric.
Do not reward claims or figure content that is absent from the submission.
Do not penalize wording differences when the scientific meaning is correct.
Return only valid JSON, with no Markdown fences or extra text.

Evaluate the submitted neuroscience benchmark result according to the rubric below.

Important grading rules:
- The maximum score is {max_score:g}; assign each rubric item a score from 0 to that item's max_point.
- Partial credit is allowed when the submitted answer partially satisfies a criterion.
- Follow each deduction_rule when applicable.
- Treat the rubric's ground-truth conclusion as the scoring reference, not as text automatically credited to the submission.
- Generated figure images are attached before this text. You may inspect them directly.
- Output valid JSON only. Scores may be integers or decimals.

"""


def build_scoring_prompt(rubric_data: dict,
                         gt_fig: Path | None, out_fig: Path | None,
                         conclusion: str) -> list:
    rubric = rubric_data["rubrics"]["score_100"]

    parts = ["## Rubric\n" + json.dumps(rubric, indent=2, ensure_ascii=False)]

    if conclusion:
        parts.append("## Model's Conclusion / Methods\n" + conclusion)

    parts.append(
        "\n## Task\n"
        "Score the model's conclusion from 0 to 100 using the rubric above. "
        "Apply deductions as specified. "
        "Provide your reasoning as plain text, ending with the final score on its own line."
    )

    content = []
    if gt_fig and gt_fig.exists():
        content.append({"type": "text", "text": "### Ground-Truth Figure (original paper)"})
        content.append(image_block(gt_fig))
    if out_fig and out_fig.exists():
        content.append({"type": "text", "text": "### Model's Reproduced Figure"})
        content.append(image_block(out_fig))
    content.append({"type": "text", "text": "\n".join(parts)})

    return [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user",   "content": content},
    ]


def call_model(client: OpenAI, messages: list, model: str = DEFAULT_MODEL) -> dict:
    response = client.chat.completions.create(
        model=model,
        max_tokens=2048,
        messages=messages,
    )
    text = response.choices[0].message.content or ""
    text = text.strip()
    if text.startswith("```"):
        lines = text.split("\n")
        text = "\n".join(lines[1:-1] if lines[-1] == "```" else lines[1:])

    # Extract the last integer in the text as the final score
    numbers = re.findall(r'\b(\d+)\b', text)
    if numbers:
        score = int(numbers[-1])
        return {"score": score, "reasoning": text}

    raise ValueError(f"Could not extract score from response: {text[:200]}")


# ── Per-figure scoring ──────────────────────────────────────────────────────

def score_one(client, paper_name, fig_tag, rubric_data,
              force=False,
              output_dir=None, result_dir=None, scores_base=None,
              layout="auto", run_dir=None, eval_model=DEFAULT_MODEL,
              flat_scores=False, eval_code=False):
    """Score one figure/rubric combination. Returns result dict or None.

    flat_scores: if True, write scores to <scores_base>/<run_id|fig_tag>/...
                 instead of <scores_base>/<paper>/<run_id|fig_tag>/...
                 Used when scores_base already encodes paper (and date).
    """

    # Fast-skip: when run_dir is known upfront, check if already fully scored
    if run_dir and not force:
        _scores_dir = scores_base or SCORES_DIR
        _run_score_id = f"{run_dir.name}-with-code" if eval_code else run_dir.name
        if flat_scores:
            _out_file = _scores_dir / _run_score_id / f"score_{eval_model}.json"
        else:
            _out_file = _scores_dir / paper_name / _run_score_id / f"score_{eval_model}.json"
        if _out_file.exists():
            with open(_out_file) as f:
                _cached = json.load(f)
            if _cached.get("score_100", {}).get("score") is not None:
                print(f"  [SKIP] Already scored: {run_dir.name}/score_{eval_model}.json")
                return _cached

    out_fig, conclusion, run_id = find_output(paper_name, fig_tag,
                                               output_dir=output_dir,
                                               result_dir=result_dir,
                                               layout=layout,
                                               run_dir=run_dir)
    if conclusion is None and out_fig is None:
        print(f"  [SKIP] No output found for {paper_name}/{fig_tag}")
        return None

    if eval_code:
        output_path = out_fig.parent if out_fig is not None else None
        code_names = ("analyze.py",) if layout == "cc" else ("generated_code.py",)
        code_file = next(
            (output_path / name for name in code_names
             if output_path is not None and (output_path / name).is_file()),
            None,
        )
        if code_file is None:
            expected = " or ".join(code_names)
            print(f"  [SKIP] Code evaluation requested but {expected} was not found in {output_path}")
            return None
        code_text = code_file.read_text(encoding="utf-8")
        conclusion = (
            (conclusion or "")
            + "\n\n## Generated Analysis Code (submitted evidence)\n"
            + "Inspect this code when the rubric concerns analysis methods, computations, "
              "or figure construction. Do not execute it.\n\n"
            + f"<{code_file.name}>\n{code_text}\n</{code_file.name}>\n"
        )
        run_id = f"{run_id}-with-code" if run_id else f"{fig_tag}-with-code"

    gt_fig = find_gt_figure(paper_name, fig_tag)

    _scores_dir = scores_base or SCORES_DIR
    score_subdir = run_id if run_id else fig_tag
    if flat_scores:
        scores_path = _scores_dir / score_subdir
    else:
        scores_path = _scores_dir / paper_name / score_subdir
    scores_path.mkdir(parents=True, exist_ok=True)
    out_file = scores_path / f"score_{eval_model}.json"

    existing = {}
    if out_file.exists() and not force:
        with open(out_file) as f:
            existing = json.load(f)
        if existing.get("score_100", {}).get("score") is not None:
            print(f"  [SKIP] Already scored: {out_file}")
            return existing

    results = dict(existing)
    results.setdefault("paper", paper_name)
    results.setdefault("fig_tag", fig_tag)
    results.setdefault("run_id", run_id or "")
    results["timestamp"] = datetime.now().isoformat()
    results["eval_model"] = eval_model
    results["eval_code"] = eval_code

    print(f"  layout        : {layout}")
    print(f"  run_id        : {run_id or '(none)'}")
    print(f"  output figure : {out_fig}")
    print(f"  conclusion    : {str(conclusion)[:120] if conclusion else '(none)'}")
    print(f"  evaluate code : {eval_code}")
    print(f"  gt figure     : {gt_fig}")


    if force or existing.get("score_100", {}).get("score") is None:
        print(f"  Scoring score_100 ...")
        try:
            messages = build_scoring_prompt(
                rubric_data, gt_fig, out_fig, conclusion or ""
            )
            result = call_model(client, messages, model=eval_model)
            results["score_100"] = result
            print(f"    → score={result['score']}  {result.get('reasoning', '')[:100]}")
        except Exception as e:
            print(f"    [ERROR] {e}")
            traceback.print_exc()
            results["score_100"] = {"score": None, "error": str(e)}

    with open(out_file, "w") as f:
        json.dump(results, f, indent=2, ensure_ascii=False)
    print(f"  Saved → {out_file}")
    return results


# ── Summary ────────────────────────────────────────────────────────────────

def build_summary(scores_base=None, paper_filter=None, fig_filter=None):
    _scores_dir = scores_base or SCORES_DIR
    rows = []
    for score_file in sorted(_scores_dir.rglob("score_*.json")):
        with open(score_file) as f:
            d = json.load(f)
        rows.append({
            "paper":          d.get("paper", ""),
            "fig_tag":        d.get("fig_tag", ""),
            "run_id":         d.get("run_id", ""),
            "eval_model":     d.get("eval_model", ""),
            "score_100":      d.get("score_100", {}).get("score"),
        })

    # Build pivot table: rows = (paper, fig_tag, run_id), cols = eval_model
    col_keys = sorted({r["eval_model"] for r in rows}, key=str)

    # Index scores by row key + col key
    pivot: dict = {}
    for r in rows:
        row_key = (r["paper"], r["fig_tag"], r["run_id"])
        pivot.setdefault(row_key, {})[r["eval_model"]] = r["score_100"]

    # Build Markdown table
    header_cols = [f"{model} score_100" for model in col_keys]

    header = "| Paper | Figure | Run ID | " + " | ".join(header_cols) + " |"
    sep    = "| --- | --- | --- | " + " | ".join(["---"] * len(header_cols)) + " |"

    md_lines = [header, sep]

    # Apply filters for the Markdown output
    filtered_keys = sorted(pivot.keys())
    if paper_filter:
        filtered_keys = [k for k in filtered_keys if k[0] == paper_filter]
    if fig_filter:
        filtered_keys = [k for k in filtered_keys if k[1] == fig_filter]

    for row_key in filtered_keys:
        paper, fig_tag, run_id = row_key
        cells = [paper, fig_tag, run_id or "—"]
        for col_key in col_keys:
            s100 = pivot[row_key].get(col_key)
            cells.append(str(s100) if s100 is not None else "—")
        md_lines.append("| " + " | ".join(cells) + " |")

    md_content = "\n".join(md_lines) + "\n"
    summary_path = _scores_dir / "summary.md"
    with open(summary_path, "w", encoding="utf-8") as f:
        f.write(md_content)

    # Console preview (flat rows, same as before)
    print_rows = rows
    if paper_filter:
        print_rows = [r for r in print_rows if r["paper"] == paper_filter]
    if fig_filter:
        print_rows = [r for r in print_rows if r["fig_tag"] == fig_filter]

    print("\n" + "=" * 90)
    print(f"{'Paper':<30} {'Figure':<10} {'Run ID':<20} {'Eval Model':<22} {'Score/100':>10}")
    print("-" * 90)
    for r in print_rows:
        s100  = str(r["score_100"]) if r["score_100"] is not None else "—"
        run   = r["run_id"]     or "—"
        model = r["eval_model"] or "—"
        print(f"{r['paper']:<30} {r['fig_tag']:<10} {run:<20} {model:<22} {s100:>10}")
    print("=" * 90)
    print(f"\nSummary saved to {summary_path}")
    return rows


# ── Main ────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="Score scientific reproduction outputs.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument("--layout", default="auto",
                        choices=["auto", "standard", "ours", "ns", "cc"],
                        help=(
                            "Result directory layout.\n"
                            "  standard  <output-dir>/<paper>/<fig>/figure.png + conclusions.json\n"
                            "  ours      --result-dir points directly at the flat result dir\n"
                            "  ns        <output-dir>/<paper>/<fig>-<ts>/round_N/figure(_refine).png\n"
                            "  cc        <output-dir>/<numeric_id>/<letter>/conclusion.md + analyze.png\n"
                            "  auto      try standard first, then ours (default)"
                        ))
    parser.add_argument("--result-dir", default=None,
                        help="[ours/auto] Direct path to a single result directory, "
                             "e.g. results/expr_Fig_6C-131510.")
    parser.add_argument("--output-dir", default=None,
                        help="[standard/auto] Root dir that contains <paper>/<fig>/ subdirs.")
    parser.add_argument("--input-dir", default=None,
                        help="[ns] A single <results_root>/<paper>/<date>/ directory whose "
                             "subdirectories are <fig_tag>-<timestamp> run dirs. "
                             "Scores for each run are written flat under --scores-dir.")
    parser.add_argument("--fig",   default=None,
                        help="Figure tag, e.g. Fig_6C. Auto-detected from --result-dir if omitted.")
    parser.add_argument("--paper", default=None,
                        help="Paper name, e.g. 'Michael_2019_Neuron'.")
    parser.add_argument("--force", action="store_true",
                        help="Re-score even if cached result exists.")
    parser.add_argument("--eval-code", action="store_true",
                        help="Include generated analysis code as submitted evidence. "
                             "Uses generated_code.py for ours/ns and analyze.py for cc.")
    parser.add_argument("--summary-only", action="store_true",
                        help="Only print existing score summary, no API calls.")
    parser.add_argument("--api-key", default=None,
                        help="API key (or set OPENAI_API_KEY / ANTHROPIC_API_KEY).")
    parser.add_argument("--model", default=DEFAULT_MODEL,
                        help=f"Evaluation model name (default: {DEFAULT_MODEL}).")
    parser.add_argument("--base-url", default=DEFAULT_BASE_URL,
                        help=f"OpenAI-compatible API base URL (default: {DEFAULT_BASE_URL}).")
    parser.add_argument("--scores-dir", default=None,
                        help="Override scores output directory.")
    parser.add_argument("--rubric-dir", default=os.environ.get("RUBRIC_DIR"),
                        help="Override rubric directory. Defaults to evaluate_query/rubric. "
                             "Can also be set with RUBRIC_DIR.")
    args = parser.parse_args()

    scores_base = Path(args.scores_dir) if args.scores_dir else None
    rubric_base = Path(args.rubric_dir) if args.rubric_dir else None
    output_dir  = Path(args.output_dir) if args.output_dir  else None
    result_dir  = Path(args.result_dir) if args.result_dir  else None
    input_dir   = Path(args.input_dir)  if args.input_dir   else None

    # Resolve relative paths against evaluate/ so the script can be called from anywhere
    global RUBRIC_DIR
    if rubric_base:
        if not rubric_base.is_absolute():
            rubric_base = EVAL_DIR / rubric_base
        RUBRIC_DIR = rubric_base.resolve()
        print(f"[Rubric dir] {RUBRIC_DIR}")
    if result_dir and not result_dir.is_absolute():
        result_dir = EVAL_DIR / result_dir
    if output_dir and not output_dir.is_absolute():
        output_dir = EVAL_DIR / output_dir
    if input_dir and not input_dir.is_absolute():
        input_dir = EVAL_DIR / input_dir

    # When --input-dir is given, derive paper from its parent if not provided.
    if input_dir is not None and not args.paper:
        args.paper = input_dir.parent.name

    if args.summary_only:
        build_summary(scores_base)
        return

    api_key = (args.api_key
               or os.environ.get("OPENAI_API_KEY")
               or os.environ.get("ANTHROPIC_API_KEY"))
    if not api_key:
        print("ERROR: No API key. Set OPENAI_API_KEY / ANTHROPIC_API_KEY or use --api-key.")
        sys.exit(1)

    client = OpenAI(api_key=api_key, base_url=args.base_url)
    print(f"[Eval model] {args.model}  (base_url: {args.base_url})")
    (scores_base or SCORES_DIR).mkdir(parents=True, exist_ok=True)

    # Validate layout vs. supplied args
    if args.layout == "ours" and not args.result_dir and not args.output_dir:
        print("ERROR: --layout ours requires --result-dir or --output-dir.")
        sys.exit(1)
    if args.layout == "ns" and not (args.output_dir or args.input_dir):
        print("ERROR: --layout ns requires --output-dir or --input-dir.")
        sys.exit(1)
    if args.layout == "standard" and not args.output_dir:
        print("ERROR: --layout standard requires --output-dir.")
        sys.exit(1)

    # Auto-detect fig_tag from result_dir if --fig not given
    fig_filter = args.fig
    if fig_filter is None and result_dir is not None:
        fig_filter = detect_fig_tag(result_dir)
        if fig_filter:
            print(f"[Auto-detected] fig_tag = {fig_filter}")
        else:
            print("ERROR: Cannot auto-detect fig_tag from result dir. "
                  "Please pass --fig explicitly.")
            sys.exit(1)

    if result_dir and not args.paper:
        print("ERROR: --paper is required when using --result-dir. "
              "Example: --paper \"Michael_2019_Neuron\"")
        sys.exit(1)

    all_results = []
    if args.layout == "ns":
        if input_dir is not None:
            # Date-dir mode: scan run dirs directly inside input_dir.
            # scores_base is expected to already encode <paper>/<date>, so write flat.
            if not args.paper:
                print("ERROR: --paper is required (or derivable from --input-dir's parent).")
                sys.exit(1)
            runs = discover_runs_in_date_dir(
                input_dir, paper_name=args.paper, fig_filter=fig_filter,
            )
            flat_scores = True
            ns_output_dir = input_dir
        else:
            runs = discover_runs_ns(
                output_dir or EVAL_DIR / "output",
                paper_filter=args.paper, fig_filter=fig_filter,
            )
            flat_scores = False
            ns_output_dir = output_dir

        for paper_name, fig_tag, rdir in runs:
            print(f"\n{'─' * 60}")
            print(f"Paper:   {paper_name}")
            print(f"Run:     {rdir.name}")
            rubrics = list(discover_rubrics(fig_filter=fig_tag, paper_filter=paper_name))
            if not rubrics:
                print(f"  [SKIP] No rubric found for {paper_name}/{fig_tag}")
                continue
            for _, _, _, rubric_data in rubrics:
                print(f"Figure:  {fig_tag}")
                res = score_one(
                    client, paper_name, fig_tag, rubric_data,
                    force=args.force,
                    output_dir=ns_output_dir,
                    result_dir=result_dir,
                    scores_base=scores_base,
                    layout=args.layout,
                    run_dir=rdir,
                    eval_model=args.model,
                    flat_scores=flat_scores,
                    eval_code=args.eval_code,
                )
                if res:
                    all_results.append(res)
    else:
        for paper_name, fig_tag, rfile, rubric_data in discover_rubrics(
            fig_filter=fig_filter, paper_filter=args.paper,
        ):
            print(f"\n{'─' * 60}")
            print(f"Paper:   {paper_name}")
            print(f"Figure:  {fig_tag}")
            res = score_one(
                client, paper_name, fig_tag, rubric_data,
                force=args.force,
                output_dir=output_dir,
                result_dir=result_dir,
                scores_base=scores_base,
                layout=args.layout,
                eval_model=args.model,
                eval_code=args.eval_code,
            )
            if res:
                all_results.append(res)

    if not all_results:
        print("\n[WARNING] No figures were scored. "
              "Check --fig / --paper / --result-dir arguments.")

    build_summary(scores_base, paper_filter=args.paper, fig_filter=fig_filter)


if __name__ == "__main__":
    main()
