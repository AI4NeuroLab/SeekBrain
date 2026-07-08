#!/usr/bin/env python3
"""
Batch scoring for results/<folder>/ layout (non-recursive, fixed depth):

  <input_dir>/<paper>/<date>/<run_dir>/{figure.png, conclusions.json, ...}

Scores are written to evaluate/score/<folder_basename>/.
"""

from __future__ import annotations

import argparse
import base64
import csv
import json
import os
import re
import sys
import threading
import time
import traceback
from datetime import datetime
from pathlib import Path

from openai import OpenAI

EVAL_DIR = Path(__file__).parent.resolve()
RUBRIC_DIR = EVAL_DIR / "evaluate_query" / "rubric"
GT_FIG_DIR = EVAL_DIR / "evaluate_query" / "gt_figure"
GT_DATA_DIR = EVAL_DIR / "evaluate_query" / "query_gt_data"
CONFIG_FILE = EVAL_DIR / "config.yaml"

PAPER_ID_BY_NAME = {
    "Chen_2018_Neuron": "1",
    "IBL_Witten_2025_Nature": "2",
    "Findling_Pouget_2025_Nature": "3",
    "Michael_2019_Neuron": "5",
    "Ryosuke_2026_Nature": "7",
    "Adam_2023_Cell": "11",
    "Ahrens_2026_bioRxiv": "13",
    "Wilson_2025_Nature_Neuroscience": "14",
    "Zeng_2025_Nature": "15",
    "Engel_2026_Nature": "17",
    "Komiyama_2025_Science": "26",
    "Koninck_2025_Science_Advances": "27",
    "Findling_2025_Nature": "3",
}
PAPER_NAME_BY_ID = {}
for _paper, _pid in PAPER_ID_BY_NAME.items():
    PAPER_NAME_BY_ID.setdefault(_pid, _paper)

FIG_LETTER_BY_PAPER_ID_AND_FIG = {
    ("11", "Fig_1H"): "A",
    ("11", "Fig_2C"): "B",
    ("11", "Fig_2D"): "C",
    ("11", "Fig_3B"): "D",
    ("11", "Fig_3G"): "E",
    ("5", "Fig_5A"): "A",
    ("5", "Fig_5B"): "B",
    ("5", "Fig_6C"): "C",
    ("5", "Fig_8B"): "D",
    ("3", "Fig_2A"): "A",
    ("3", "Fig_3A"): "B",
    ("3", "Fig_3C"): "C",
    ("3", "Fig_4A"): "D",
    ("3", "Fig_4F"): "E",
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
FIG_TAG_BY_PAPER_ID_AND_LETTER = {
    (pid, letter): fig for (pid, fig), letter in FIG_LETTER_BY_PAPER_ID_AND_FIG.items()
}

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


def log(msg: str) -> None:
    print(msg, flush=True)


def _fmt_bytes(n: int) -> str:
    if n >= 1024 * 1024:
        return f"{n / (1024 * 1024):.1f} MB"
    if n >= 1024:
        return f"{n / 1024:.1f} KB"
    return f"{n} B"


def _load_config() -> dict:
    if not CONFIG_FILE.exists():
        return {}
    try:
        import yaml  # type: ignore
    except ImportError:
        return {}
    with CONFIG_FILE.open(encoding="utf-8") as f:
        return yaml.safe_load(f) or {}


def _resolve_api_settings(args) -> tuple[str, str, str]:
    cfg = _load_config()
    api_cfg = cfg.get("api", {}) if isinstance(cfg, dict) else {}

    base_url = args.base_url or os.environ.get("OPENAI_API_BASE") or api_cfg.get("base_url")
    api_key = (
        args.api_key
        or os.environ.get("OPENAI_API_KEY")
        or os.environ.get("ANTHROPIC_API_KEY")
        or api_cfg.get("key")
    )
    if not api_key and api_cfg.get("key_env"):
        api_key = os.environ.get(str(api_cfg["key_env"]))

    model = args.model or os.environ.get("EVAL_MODEL") or cfg.get("default_model")

    missing = []
    if not base_url:
        missing.append("base_url (--base-url / OPENAI_API_BASE / config.yaml)")
    if not api_key:
        missing.append("api_key (--api-key / OPENAI_API_KEY / config.yaml)")
    if not model:
        missing.append("model (--model / EVAL_MODEL / config.yaml)")
    if missing:
        print("ERROR: Missing required settings: " + ", ".join(missing), file=sys.stderr)
        sys.exit(1)
    return str(base_url), str(api_key), str(model)


def encode_image(path: Path) -> str:
    with path.open("rb") as f:
        return base64.standard_b64encode(f.read()).decode("utf-8")


def image_block(path: Path) -> dict:
    suffix = path.suffix.lower()
    media_map = {
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".gif": "image/gif",
    }
    media_type = media_map.get(suffix, "image/png")
    raw_size = path.stat().st_size
    t0 = time.monotonic()
    log(f"  [ENCODE] {path.name} ({_fmt_bytes(raw_size)}) ...")
    encoded = encode_image(path)
    b64_size = len(encoded)
    log(
        f"  [ENCODE] {path.name} done in {time.monotonic() - t0:.1f}s "
        f"(base64 {_fmt_bytes(b64_size)})"
    )
    return {
        "type": "image_url",
        "image_url": {"url": f"data:{media_type};base64,{encoded}"},
    }


def _canonical_original_names(paper_name: str, fig_tag: str) -> tuple[str, str]:
    for candidate in _paper_names(paper_name):
        paper_id = candidate if candidate in PAPER_NAME_BY_ID else PAPER_ID_BY_NAME.get(candidate)
        if paper_id:
            original_paper = PAPER_NAME_BY_ID.get(paper_id, candidate)
            original_fig = FIG_TAG_BY_PAPER_ID_AND_LETTER.get((paper_id, fig_tag), fig_tag)
            return original_paper, original_fig
    return paper_name, fig_tag


def _normalize_fig_tag(tag: str) -> str:
    m = re.match(r"^(FIG|Fig)_(\d+)([A-Za-z].*)$", tag)
    if m:
        return f"Fig_{m.group(2)}{m.group(3).upper()}"
    return tag


def _load_conclusions(d: Path) -> str | None:
    conc = d / "conclusions.json"
    if conc.exists():
        data = json.loads(conc.read_text(encoding="utf-8"))
        items = data.get("conclusions", [])
        if items:
            return "\n\n".join(str(i) for i in items)
    md = d / "conclusion.md"
    if md.exists():
        return md.read_text(encoding="utf-8")
    return None


def _best_png(d: Path) -> Path | None:
    refine = d / "figure_refine.png"
    if refine.exists():
        return refine
    fixed = d / "figure.png"
    if fixed.exists():
        return fixed
    pngs = sorted(d.glob("*.png"))
    return pngs[0] if pngs else None


PAPER_ALIASES = {
    "Findling_2025_Nature": ["Findling_Pouget_2025_Nature"],
    "Findling_Pouget_2025_Nature": ["Findling_2025_Nature"],
}


def _paper_names(paper: str) -> list[str]:
    names = [paper]
    for alias in PAPER_ALIASES.get(paper, []):
        if alias not in names:
            names.append(alias)
    return names


def _paper_rubric_tags(paper: str) -> dict[str, Path]:
    tags: dict[str, Path] = {}
    for paper_name in _paper_names(paper):
        paper_dir = RUBRIC_DIR / paper_name
        if not paper_dir.is_dir():
            continue
        for rfile in sorted(paper_dir.glob("*.json")):
            if "_result" in rfile.stem:
                continue
            with rfile.open(encoding="utf-8") as f:
                rubric_data = json.load(f)
            tag = _normalize_fig_tag(rubric_data.get("tag", rfile.stem))
            tags.setdefault(tag, rfile)
    return tags


def detect_fig_tag(run_dir: Path, paper: str) -> str | None:
    for py_file in run_dir.glob("generated_code*.py"):
        m = re.match(r"generated_code(.+)\.py$", py_file.name)
        if m:
            return _normalize_fig_tag(m.group(1))

    name = run_dir.name.lower()
    m = re.search(
        r"(?:^|[-_])(?:fig(?:ure)?)[-_]?(\d+[a-z]+|[a-z]\d+[a-z]*|\d+[a-z]*)",
        name,
    )
    if m:
        return _normalize_fig_tag(f"Fig_{m.group(1).upper()}")

    m = re.search(r"(Fig_\w+)", run_dir.name, re.IGNORECASE)
    if m:
        return _normalize_fig_tag(m.group(1))

    rubric_tags = _paper_rubric_tags(paper)
    compact_name = re.sub(r"[^a-z0-9]", "", name)
    for tag in rubric_tags:
        compact_tag = re.sub(r"[^a-z0-9]", "", tag.lower())
        if compact_tag in compact_name or compact_tag.replace("fig", "") in compact_name:
            return tag
    return None


def find_rubric(paper: str, fig_tag: str) -> tuple[Path, dict] | tuple[None, None]:
    tags = _paper_rubric_tags(paper)
    fig_tag = _normalize_fig_tag(fig_tag)
    if fig_tag in tags:
        path = tags[fig_tag]
        with path.open(encoding="utf-8") as f:
            return path, json.load(f)
    return None, None


def find_gt_figure(paper_name: str, fig_tag: str) -> Path | None:
    paper_name, fig_tag = _canonical_original_names(paper_name, fig_tag)
    gt_dir = GT_FIG_DIR / paper_name
    if not gt_dir.exists():
        return None
    for f in gt_dir.iterdir():
        if fig_tag in f.name and f.suffix.lower() == ".png":
            return f
    return None


def find_gt_data(paper_name: str, fig_tag: str) -> dict | None:
    paper_name, fig_tag = _canonical_original_names(paper_name, fig_tag)
    p = GT_DATA_DIR / paper_name / f"{fig_tag}.json"
    if p.exists():
        with p.open(encoding="utf-8") as f:
            return json.load(f)
    return None


def discover_questions(input_dir: Path):
    """
    Fixed layout (no recursion):
      <input_dir>/<paper>/<date>/<run_dir>/
    """
    for paper_dir in sorted(p for p in input_dir.iterdir() if p.is_dir()):
        for date_dir in sorted(p for p in paper_dir.iterdir() if p.is_dir()):
            for run_dir in sorted(p for p in date_dir.iterdir() if p.is_dir()):
                yield paper_dir.name, date_dir.name, run_dir


def build_scoring_prompt(
    rubric_data: dict,
    gt_fig: Path | None,
    out_fig: Path | None,
    conclusion: str,
    gt_json: dict | None,
) -> list:
    rubric = rubric_data["rubrics"]["score_100"]
    parts = []
    if gt_json:
        parts.append(
            "## Ground-Truth Analysis Information\n"
            + json.dumps(
                {
                    "question": gt_json.get("query", gt_json.get("question", "")),
                    "key_analysis_results": gt_json.get("key_analysis_results", []),
                    "key_analysis_conclusions": gt_json.get("key_analysis_conclusions", []),
                    "statistical_info": gt_json.get("statistical_info", []),
                    "summary_report": gt_json.get("summary_report", {}),
                },
                indent=2,
                ensure_ascii=False,
            )
        )
    parts.append("## Rubric\n" + json.dumps(rubric, indent=2, ensure_ascii=False))
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
        {"role": "user", "content": content},
    ]


def call_model(client: OpenAI, messages: list, model: str) -> dict:
    log(f"  [API] sending request to {model} ...")
    t0 = time.monotonic()
    stop = threading.Event()

    def heartbeat() -> None:
        while not stop.wait(15):
            log(f"  [API] still waiting ... {time.monotonic() - t0:.0f}s elapsed")

    hb = threading.Thread(target=heartbeat, daemon=True)
    hb.start()
    try:
        response = client.chat.completions.create(
            model=model,
            max_tokens=2048,
            messages=messages,
        )
    finally:
        stop.set()
    elapsed = time.monotonic() - t0
    log(f"  [API] response received in {elapsed:.1f}s")

    text = (response.choices[0].message.content or "").strip()
    if text.startswith("```"):
        lines = text.split("\n")
        text = "\n".join(lines[1:-1] if lines[-1] == "```" else lines[1:])
    numbers = re.findall(r"\b(\d+)\b", text)
    if numbers:
        return {"score": int(numbers[-1]), "reasoning": text}
    raise ValueError(f"Could not extract score from response: {text[:200]}")


def preview_questions(input_dir: Path) -> list[tuple[str, str, Path, str | None, bool]]:
    rows = []
    for paper_dir in sorted(p for p in input_dir.iterdir() if p.is_dir()):
        for date_dir in sorted(p for p in paper_dir.iterdir() if p.is_dir()):
            for run_dir in sorted(p for p in date_dir.iterdir() if p.is_dir()):
                fig_tag = detect_fig_tag(run_dir, paper_dir.name)
                rubric_ok = find_rubric(paper_dir.name, fig_tag)[1] is not None if fig_tag else False
                rows.append((paper_dir.name, date_dir.name, run_dir, fig_tag, rubric_ok))
    return rows


def score_one(
    client: OpenAI,
    paper: str,
    date: str,
    run_dir: Path,
    scores_dir: Path,
    eval_model: str,
    force: bool,
    idx: int,
    total: int,
) -> dict | None:
    t_question = time.monotonic()
    log(f"\n{'─' * 60}")
    log(f"[{idx}/{total}] {paper}/{date}/{run_dir.name}")

    fig_tag = detect_fig_tag(run_dir, paper)
    if not fig_tag:
        log(f"  [SKIP] Cannot detect fig tag for {run_dir.name}")
        return None

    rubric_path, rubric_data = find_rubric(paper, fig_tag)
    if rubric_data is None:
        log(f"  [SKIP] No rubric for {paper}/{fig_tag}")
        return None

    out_file = scores_dir / paper / date / run_dir.name / f"score_{eval_model}.json"
    if out_file.exists() and not force:
        with out_file.open(encoding="utf-8") as f:
            cached = json.load(f)
        if cached.get("score_100", {}).get("score") is not None:
            log(f"  [SKIP] Already scored: {out_file.relative_to(scores_dir)}")
            return cached

    log("  [LOAD] reading artifacts ...")
    out_fig = _best_png(run_dir)
    conclusion = _load_conclusions(run_dir)
    if out_fig is None and conclusion is None:
        log(f"  [SKIP] No figure or conclusion in {run_dir}")
        return None

    gt_fig = find_gt_figure(paper, fig_tag)
    gt_json = find_gt_data(paper, fig_tag)

    log(f"  paper      : {paper}")
    log(f"  date       : {date}")
    log(f"  run        : {run_dir.name}")
    log(f"  fig_tag    : {fig_tag}")
    log(f"  rubric     : {rubric_path.name if rubric_path else '(none)'}")
    log(f"  figure     : {out_fig}")
    log(f"  gt figure  : {gt_fig or '(none)'}")
    log(f"  gt data    : {'yes' if gt_json else 'no'}")
    log(f"  conclusion : {(conclusion or '')[:120] or '(none)'}")

    results = {
        "paper": paper,
        "date": date,
        "fig_tag": fig_tag,
        "run_id": run_dir.name,
        "timestamp": datetime.now().isoformat(),
        "eval_model": eval_model,
        "input_dir": str(run_dir),
        "rubric": str(rubric_path),
    }

    log("  [PROMPT] building scoring prompt ...")
    t_prompt = time.monotonic()
    try:
        messages = build_scoring_prompt(rubric_data, gt_fig, out_fig, conclusion or "", gt_json)
        log(f"  [PROMPT] ready in {time.monotonic() - t_prompt:.1f}s")
        result = call_model(client, messages, model=eval_model)
        results["score_100"] = result
        log(f"  [DONE] score={result['score']}  (question total {time.monotonic() - t_question:.1f}s)")
    except Exception as e:
        log(f"  [ERROR] {e}  (after {time.monotonic() - t_question:.1f}s)")
        traceback.print_exc()
        results["score_100"] = {"score": None, "error": str(e)}

    out_file.parent.mkdir(parents=True, exist_ok=True)
    with out_file.open("w", encoding="utf-8") as f:
        json.dump(results, f, indent=2, ensure_ascii=False)
    log(f"  [SAVE] {out_file}")
    return results


def collect_rows(scores_dir: Path) -> list[dict]:
    rows = []
    for score_file in sorted(scores_dir.rglob("score_*.json")):
        with score_file.open(encoding="utf-8") as f:
            d = json.load(f)
        rows.append(
            {
                "paper": d.get("paper", ""),
                "fig_tag": d.get("fig_tag", ""),
                "date": d.get("date", ""),
                "run_id": d.get("run_id", ""),
                "eval_model": d.get("eval_model", ""),
                "score_100": d.get("score_100", {}).get("score"),
            }
        )
    return rows


def build_summary(scores_dir: Path, rows: list[dict]) -> None:
    if not rows:
        print("\n[WARNING] No scores to summarize.")
        return

    header = ["Paper", "Figure", "Date", "Run ID", "Eval Model", "Score/100"]
    md_lines = [
        "| " + " | ".join(header) + " |",
        "| " + " | ".join(["---"] * len(header)) + " |",
    ]
    csv_rows = [header]

    numeric_scores = []
    for r in rows:
        score = r["score_100"]
        score_str = str(score) if score is not None else "—"
        md_lines.append(
            "| "
            + " | ".join(
                [
                    r["paper"],
                    r["fig_tag"],
                    r["date"],
                    r["run_id"] or "—",
                    r["eval_model"] or "—",
                    score_str,
                ]
            )
            + " |"
        )
        csv_rows.append(
            [
                r["paper"],
                r["fig_tag"],
                r["date"],
                r["run_id"],
                r["eval_model"],
                score if score is not None else "",
            ]
        )
        if isinstance(score, (int, float)):
            numeric_scores.append(float(score))

    if numeric_scores:
        total = sum(numeric_scores)
        avg = total / len(numeric_scores)
        md_lines.extend(
            [
                "",
                f"**Total score:** {total:g} / {len(numeric_scores) * 100:g}",
                f"**Average score:** {avg:.2f} / 100",
            ]
        )
        csv_rows.append([])
        csv_rows.append(["Total", "", "", "", "", f"{total:g}"])
        csv_rows.append(["Average", "", "", "", "", f"{avg:.2f}"])
        csv_rows.append(["Count", "", "", "", "", str(len(numeric_scores))])

    summary_md = scores_dir / "summary.md"
    summary_csv = scores_dir / "summary.csv"
    summary_md.write_text("\n".join(md_lines) + "\n", encoding="utf-8")

    with summary_csv.open("w", encoding="utf-8", newline="") as f:
        writer = csv.writer(f)
        writer.writerows(csv_rows)

    print("\n" + "=" * 96)
    print(f"{'Paper':<28} {'Figure':<10} {'Date':<10} {'Run ID':<24} {'Model':<18} {'Score':>8}")
    print("-" * 96)
    for r in rows:
        score = str(r["score_100"]) if r["score_100"] is not None else "—"
        print(
            f"{r['paper']:<28} {r['fig_tag']:<10} {r['date']:<10} "
            f"{(r['run_id'] or '—'):<24} {(r['eval_model'] or '—'):<18} {score:>8}"
        )
    if numeric_scores:
        print("-" * 96)
        print(f"{'TOTAL':<28} {'':<10} {'':<10} {'':<24} {'':<18} {total:>8.0f}")
        print(f"{'AVERAGE':<28} {'':<10} {'':<10} {'':<24} {'':<18} {avg:>8.2f}")
    print("=" * 96)
    print(f"\nSummary -> {summary_md}")
    print(f"CSV     -> {summary_csv}")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Score results/<folder>/ batch outputs.",
    )
    parser.add_argument("input_dir", help="Path to results/<folder>/")
    parser.add_argument("--scores-dir", required=True, help="Output directory for scores.")
    parser.add_argument("--model", default=None, help="Evaluation model (required via env/config if omitted).")
    parser.add_argument("--base-url", default=None, help="OpenAI-compatible API base URL.")
    parser.add_argument("--api-key", default=None, help="API key.")
    parser.add_argument("--force", action="store_true", help="Re-score even if cached.")
    parser.add_argument("--summary-only", action="store_true", help="Only rebuild summary from existing scores.")
    args = parser.parse_args()

    input_dir = Path(args.input_dir)
    if not input_dir.is_absolute():
        input_dir = (Path.cwd() / input_dir).resolve()
    if not input_dir.is_dir():
        print(f"ERROR: input_dir not found: {input_dir}", file=sys.stderr)
        sys.exit(1)

    scores_dir = Path(args.scores_dir)
    if not scores_dir.is_absolute():
        scores_dir = (EVAL_DIR / scores_dir).resolve()
    scores_dir.mkdir(parents=True, exist_ok=True)

    if args.summary_only:
        build_summary(scores_dir, collect_rows(scores_dir))
        return

    base_url, api_key, eval_model = _resolve_api_settings(args)
    client = OpenAI(api_key=api_key, base_url=base_url)
    t_run = time.monotonic()
    log(f"[START] {datetime.now().isoformat(timespec='seconds')}")
    log(f"[Eval model] {eval_model}")
    log(f"[Base URL]   {base_url}")
    log(f"[Input dir]  {input_dir}")
    log(f"[Scores dir] {scores_dir}")

    preview = preview_questions(input_dir)
    if not preview:
        log("[WARNING] No question directories found.")
    else:
        log(f"[SCAN] found {len(preview)} question(s):")
        for i, (paper, date, run_dir, fig_tag, rubric_ok) in enumerate(preview, 1):
            log(
                f"  {i}. {paper}/{date}/{run_dir.name} "
                f"-> {fig_tag or '?'}  rubric={'ok' if rubric_ok else 'MISSING'}"
            )

    all_results = []
    total = len(preview)
    for idx, (paper, date, run_dir, _, _) in enumerate(preview, 1):
        res = score_one(
            client, paper, date, run_dir, scores_dir, eval_model, args.force, idx, total
        )
        if res:
            all_results.append(res)

    if not all_results:
        log("\n[WARNING] No questions were scored.")

    build_summary(scores_dir, collect_rows(scores_dir))
    log(f"\n[FINISH] total elapsed {time.monotonic() - t_run:.1f}s")


if __name__ == "__main__":
    main()
