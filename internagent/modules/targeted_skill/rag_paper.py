import json
import logging
import contextlib
import sys
import traceback
import urllib.error
import urllib.request
import uuid
from pathlib import Path
from typing import Any, Dict, Optional

logger = logging.getLogger(__name__)


def _build_no_proxy_opener() -> urllib.request.OpenerDirector:
    return urllib.request.build_opener(urllib.request.ProxyHandler({}))


def query_paper_rag(
    query: str,
    top_k: int = 2,
    base_url: str = "http://100.104.36.129:21800",
    timeout: int = 600,
    require_github: bool = True,
) -> Optional[Any]:
    """
    Query the Paper RAG service.

    Callers choose require_github explicitly:
    - neuro_deep_research (rag_paper.run): require_github=False
    - resolve_targeted_skill RAG fallback: require_github=True

    The default True is safe for direct callers that need repo links.
    """
    url = f"{base_url}/queryfull"
    payload = json.dumps({
        "query": query,
        "top_k": top_k,
        "require_github": require_github,
    }).encode("utf-8")
    request = urllib.request.Request(
        url,
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    try:
        with _build_no_proxy_opener().open(request, timeout=timeout) as response:
            data = json.loads(response.read().decode("utf-8"))
        logger.info(f"Paper RAG 查询成功, query='{query}', top_k={top_k}")
        return data.get("results", data)
    except urllib.error.URLError:
        logger.error(f"无法连接到 RAG 服务: {url}")
    except TimeoutError:
        logger.error(f"请求超时 ({timeout}s), url={url}")
    except json.JSONDecodeError:
        logger.error("响应解析失败")

    return None


def rag_result_items(raw: Any) -> list[Dict[str, Any]]:
    """Normalize query_paper_rag output into a list of paper dicts."""
    if raw is None:
        return []
    if isinstance(raw, list):
        return [item for item in raw if isinstance(item, dict)]
    if isinstance(raw, dict):
        nested = raw.get("results", raw)
        if isinstance(nested, list):
            return [item for item in nested if isinstance(item, dict)]
    return []


def _read_payload(input_path: Optional[str]) -> Dict[str, Any]:
    if input_path:
        return json.loads(Path(input_path).read_text(encoding="utf-8"))
    raw = sys.stdin.read()
    return json.loads(raw) if raw.strip() else {}


def _write_json(payload: Dict[str, Any], output_path: Optional[str] = None) -> None:
    text = json.dumps(payload, ensure_ascii=False, indent=2)
    if output_path:
        path = Path(output_path).expanduser().resolve()
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text + "\n", encoding="utf-8")
    else:
        print(text)


def _append_log_path(result: Dict[str, Any], log_path: Optional[str]) -> Dict[str, Any]:
    if not log_path:
        return result
    details = result.setdefault("details", {})
    if isinstance(details, dict):
        details["log_path"] = str(Path(log_path).expanduser().resolve())
    return result


def _normalize_results(raw: Any, source_char_limit: int):
    results = raw.get("results", raw) if isinstance(raw, dict) else raw
    if not isinstance(results, list):
        return []
    normalized = []
    seen = set()
    for item in results:
        if not isinstance(item, dict):
            continue
        title = str(item.get("title", "")).strip()
        full_text = str(item.get("full_text") or item.get("content") or "").strip()
        key = title.lower() or full_text[:200].lower()
        if not key or key in seen:
            continue
        seen.add(key)
        normalized.append({
            "source_id": f"S{len(normalized) + 1}",
            "title": title or "(untitled paper)",
            "pub_time": item.get("pub_time", ""),
            "magazine": item.get("magazine", ""),
            "github_links": item.get("github_links", []),
            "text": full_text[:source_char_limit],
        })
    return normalized


def run(payload: Dict[str, Any]) -> Dict[str, Any]:
    trace_id = payload.get("trace_id") or str(uuid.uuid4())
    query = str(payload.get("question") or payload.get("query") or "").strip()
    if not query:
        return {
            "ok": False,
            "trace_id": trace_id,
            "sources": [],
            "warnings": ["question/query is required"],
            "error": "question/query is required",
        }

    top_k = int(payload.get("top_k", 4))
    base_url = str(payload.get("rag_base_url") or payload.get("base_url") or "http://100.104.36.129:21800")
    timeout = int(payload.get("rag_timeout") or payload.get("timeout") or 600)
    source_char_limit = int(payload.get("source_char_limit", 5000))

    raw = query_paper_rag(
        query=query,
        top_k=top_k,
        base_url=base_url,
        timeout=timeout,
        require_github=False,
    )
    sources = _normalize_results(raw, source_char_limit)
    if raw is None:
        return {
            "ok": False,
            "trace_id": trace_id,
            "sources": [],
            "warnings": ["Paper RAG query failed"],
            "error": "Paper RAG query failed",
        }
    return {
        "ok": True,
        "trace_id": trace_id,
        "sources": sources,
        "source_count": len(sources),
        "warnings": [] if sources else ["Paper RAG returned no usable sources"],
    }


def main() -> int:
    import argparse

    parser = argparse.ArgumentParser()
    parser.add_argument("--input", help="JSON input file. Defaults to stdin.")
    parser.add_argument("--output", help="Write JSON result to this file instead of stdout.")
    parser.add_argument("--log", help="Write diagnostic stdout/stderr to this file.")
    args = parser.parse_args()
    try:
        payload = _read_payload(args.input)
        if args.log:
            log_path = Path(args.log).expanduser().resolve()
            log_path.parent.mkdir(parents=True, exist_ok=True)
            with log_path.open("a", encoding="utf-8") as log_file:
                with contextlib.redirect_stdout(log_file), contextlib.redirect_stderr(log_file):
                    result = run(payload)
        else:
            result = run(payload)
        _write_json(_append_log_path(result, args.log), args.output)
        return 0
    except Exception as exc:
        _write_json(_append_log_path({
            "ok": False,
            "trace_id": str(uuid.uuid4()),
            "sources": [],
            "warnings": ["unhandled Paper RAG helper error"],
            "error": str(exc),
            "details": {"traceback": traceback.format_exc()},
        }, args.log), args.output)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
