#!/usr/bin/env python3
import argparse
import json
from pathlib import Path


def number(value):
    return value if isinstance(value, (int, float)) else 0


def read_entries(path):
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return []
    entries = payload.get("entries", [])
    return entries if isinstance(entries, list) else []


def entry_tokens(entry):
    tokens = entry.get("tokens", {}) if isinstance(entry, dict) else {}
    cache_read = number(tokens.get("cacheRead"))
    cache_write = number(tokens.get("cacheWrite"))
    total = number(tokens.get("total"))
    if total == 0:
        total = (
            number(tokens.get("input"))
            + number(tokens.get("output"))
            + cache_read
            + cache_write
        )
    return {
        "input": number(tokens.get("input")),
        "output": number(tokens.get("output")),
        "cacheRead": cache_read,
        "cacheWrite": cache_write,
        "total": total,
    }


def summarize_component(path):
    entries = read_entries(path)
    totals = {
        "input": 0,
        "output": 0,
        "cacheRead": 0,
        "cacheWrite": 0,
        "total": 0,
    }
    cost = 0
    for entry in entries:
        tokens = entry_tokens(entry)
        for key, value in tokens.items():
            totals[key] += value
        cost += number(entry.get("cost"))
    cache_tokens = totals["cacheRead"] + totals["cacheWrite"]
    return {
        "component": path.stem,
        "path": str(path),
        "entries": len(entries),
        "tokens": totals,
        "cache_tokens": cache_tokens,
        "cache_rate": (cache_tokens / totals["total"]) if totals["total"] else 0,
        "cost": cost,
    }


def main():
    parser = argparse.ArgumentParser(description="Summarize usage JSON files for a level-1 or level-2 work_dir.")
    parser.add_argument("work_dir", help="Level-1 work_dir containing usage/*.json")
    args = parser.parse_args()

    work_dir = Path(args.work_dir).resolve()
    usage_dir = work_dir / "usage"
    summary_path = usage_dir / "summary.json"
    components = []
    if usage_dir.is_dir():
        for path in sorted(usage_dir.glob("*.json")):
            if path.name == "summary.json":
                continue
            components.append(summarize_component(path))

    total_tokens = {
        "input": sum(c["tokens"]["input"] for c in components),
        "output": sum(c["tokens"]["output"] for c in components),
        "cacheRead": sum(c["tokens"]["cacheRead"] for c in components),
        "cacheWrite": sum(c["tokens"]["cacheWrite"] for c in components),
        "total": sum(c["tokens"]["total"] for c in components),
    }
    cache_tokens = total_tokens["cacheRead"] + total_tokens["cacheWrite"]
    summary = {
        "work_dir": str(work_dir),
        "usage_dir": str(usage_dir),
        "component_count": len(components),
        "entry_count": sum(c["entries"] for c in components),
        "tokens": total_tokens,
        "cache_tokens": cache_tokens,
        "cache_rate": (cache_tokens / total_tokens["total"]) if total_tokens["total"] else 0,
        "cost": sum(c["cost"] for c in components),
        "components": components,
    }

    usage_dir.mkdir(parents=True, exist_ok=True)
    summary_path.write_text(json.dumps(summary, indent=2), encoding="utf-8")
    print(
        "[usage] summary: "
        f"components={summary['component_count']} "
        f"entries={summary['entry_count']} "
        f"tokens={summary['tokens']['total']} "
        f"cache_rate={summary['cache_rate']:.4f} "
        f"cost={summary['cost']:.6f} "
        f"path={summary_path}"
    )


if __name__ == "__main__":
    main()
