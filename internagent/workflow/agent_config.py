#!/usr/bin/env python3
"""Config middle layer: defaults, merge, and CLI for shell + Pi extensions.

Usage:
  agent_config.py workflow <field> [config.yaml]
  agent_config.py merged [config.yaml]
  agent_config.py <agent_name> <field|pi_args> [fallback] [config.yaml]
"""

from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any, Dict, List

AGENT_MERGE_KEYS = ("provider", "model", "thinking", "timeout_seconds")
MAIN_AGENTS = frozenset({"level1", "level2"})

# Single fallback source for workflow.* (override in config.yaml).
WORKFLOW_DEFAULTS: Dict[str, Any] = {
    "debug_disk_writes": False,
    "level1": {
        "deep_research": True,
        "targeted_skill_match": True,
        "targeted_skill_generate": True,
        "image_refine": True,
        "image_analysis": True,
        "save_skill": True,
        "transparency": True,
        "human_review": {
            "enabled": False,
            "gates": {
                "plan": False,
                "code": False,
                "validate": False,
                "conclude": False,
            },
        },
    },
}


def parse_scalar(value: str) -> Any:
    raw = value.strip()
    if (raw.startswith('"') and raw.endswith('"')) or (
        raw.startswith("'") and raw.endswith("'")
    ):
        return raw[1:-1]
    if raw == "true":
        return True
    if raw == "false":
        return False
    if raw == "null":
        return None
    if raw.lstrip("-").isdigit():
        return int(raw)
    try:
        return float(raw)
    except ValueError:
        return raw


def strip_yaml_comment(line: str) -> str:
    in_quote = ""
    for i, char in enumerate(line):
        if char in ("'", '"'):
            if in_quote == char:
                in_quote = ""
            elif not in_quote:
                in_quote = char
        if char == "#" and not in_quote:
            return line[:i]
    return line


def parse_inline_yaml(value: str) -> Any:
    raw = value.strip()
    if raw == "{}":
        return {}
    if raw == "[]":
        return []
    return parse_scalar(raw)


def parse_simple_yaml(text: str) -> Dict[str, Any]:
    config: Dict[str, Any] = {}
    # Stack entries: (indent, container, grandparent, key_in_grandparent). The
    # grandparent/key let us convert an empty-dict placeholder into a list the
    # first time we see a "- " child (block-scalar or mapping list).
    stack: list[tuple[int, Any, Any, Any]] = [(-1, config, None, None)]
    for raw_line in text.splitlines():
        line = strip_yaml_comment(raw_line).rstrip()
        if not line.strip():
            continue
        indent = len(line) - len(line.lstrip(" "))
        stripped = line.strip()
        while indent <= stack[-1][0]:
            stack.pop()
        entry = stack[-1]
        parent = entry[1]

        if stripped.startswith("- "):
            if not isinstance(parent, list):
                # Convert the empty-dict placeholder created for this key to a list.
                if isinstance(parent, dict) and not parent and entry[2] is not None:
                    parent = []
                    entry[2][entry[3]] = parent
                    stack[-1] = (entry[0], parent, entry[2], entry[3])
                else:
                    continue
            rest = stripped[2:].strip()
            if rest and ":" in rest:
                key, value = rest.split(":", 1)
                item: Dict[str, Any] = {key.strip(): parse_inline_yaml(value)}
                parent.append(item)
                stack.append((indent, item, parent, len(parent) - 1))
            elif rest:
                parent.append(parse_inline_yaml(rest))  # plain scalar list item
            else:
                item = {}
                parent.append(item)
                stack.append((indent, item, parent, len(parent) - 1))
            continue

        if ":" not in stripped or not isinstance(parent, dict):
            continue
        key, value = stripped.split(":", 1)
        key = key.strip()
        value = value.strip()
        if value:
            parent[key] = parse_inline_yaml(value)
        else:
            child: Any = [] if key == "models" else {}
            parent[key] = child
            stack.append((indent, child, parent, key))
    return config


def _deep_merge(base: Dict[str, Any], override: Dict[str, Any]) -> Dict[str, Any]:
    merged = dict(base)
    for key, value in override.items():
        if isinstance(value, dict) and isinstance(merged.get(key), dict):
            merged[key] = _deep_merge(merged[key], value)
        else:
            merged[key] = value
    return merged


def resolve_workflow(user_workflow: Dict[str, Any] | None = None) -> Dict[str, Any]:
    return _deep_merge(WORKFLOW_DEFAULTS, user_workflow or {})


def merge_config(config: Dict[str, Any]) -> Dict[str, Any]:
    merged = dict(config)
    merged["workflow"] = resolve_workflow(config.get("workflow"))
    return merged


def is_main_agent(agent_name: str) -> bool:
    return agent_name in MAIN_AGENTS


def sub_default_key(agent_name: str) -> str:
    if agent_name.startswith("level2_"):
        return "level2_default"
    return "level1_default"


def resolve_agent_config(config: Dict[str, Any], agent_name: str) -> Dict[str, Any]:
    agents = config.get("agents", {}) or {}
    specific = agents.get(agent_name, {}) or {}
    if is_main_agent(agent_name):
        return dict(specific)
    defaults = agents.get(sub_default_key(agent_name), {}) or {}
    merged = dict(specific)
    for key in AGENT_MERGE_KEYS:
        if key not in merged and key in defaults:
            merged[key] = defaults[key]
    return merged


def merge_agent_config(config: Dict[str, Any], agent_name: str) -> Dict[str, Any]:
    return resolve_agent_config(config, agent_name)


def main_pi_cli_args(agent_cfg: Dict[str, Any]) -> List[str]:
    args: List[str] = []
    provider = agent_cfg.get("provider")
    model = agent_cfg.get("model")
    thinking = agent_cfg.get("thinking")
    if provider:
        args.extend(["--provider", str(provider)])
    if model:
        model_arg = str(model)
        if thinking:
            model_arg = f"{model_arg}:{thinking}"
        args.extend(["--model", model_arg])
    elif thinking:
        args.extend(["--thinking", str(thinking)])
    return args


def format_config_value(value: Any, fallback: str) -> str:
    if value is None or value == "":
        return fallback
    if isinstance(value, bool):
        return "true" if value else "false"
    return str(value)


def load_config(path: Path) -> Dict[str, Any]:
    return parse_simple_yaml(path.read_text(encoding="utf-8"))


def load_merged_config(path: Path | None) -> Dict[str, Any]:
    if path and path.is_file():
        return merge_config(load_config(path))
    return merge_config({})


def main() -> int:
    if len(sys.argv) < 2:
        print(main.__doc__ or "", file=sys.stderr)
        return 2

    agent_name = sys.argv[1]

    if agent_name == "merged":
        config_path = Path(sys.argv[2]) if len(sys.argv) > 2 else Path("config.yaml")
        print(json.dumps(load_merged_config(config_path), ensure_ascii=False))
        return 0

    if len(sys.argv) < 3:
        print(main.__doc__ or "", file=sys.stderr)
        return 2

    field = sys.argv[2]

    if agent_name == "workflow":
        config_path = Path(sys.argv[3]) if len(sys.argv) > 3 else Path("config.yaml")
        value = resolve_workflow(
            load_config(config_path).get("workflow") if config_path.is_file() else None
        ).get(field)
        if value is None:
            print(f"unknown workflow field: {field}", file=sys.stderr)
            return 1
        if isinstance(value, (dict, list)):
            print(json.dumps(value, ensure_ascii=False))
        else:
            print(format_config_value(value, ""))
        return 0

    fallback = sys.argv[3] if len(sys.argv) > 3 else ""
    config_path = Path(sys.argv[4]) if len(sys.argv) > 4 else Path("config.yaml")

    if not config_path.is_file():
        if field == "pi_args":
            return 0
        print(fallback)
        return 0

    resolved = resolve_agent_config(load_config(config_path), agent_name)
    if field == "pi_args":
        for arg in main_pi_cli_args(resolved):
            print(arg)
        return 0

    value = resolved.get(field)
    if value is None or value == "":
        print(fallback)
        return 0
    print(value)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
