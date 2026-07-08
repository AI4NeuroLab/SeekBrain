# NeuroScientist Extension

This is the development note for the NeuroScientist Pi extension in this
repository.

## Goal

Expose the NeuroScientist workflow as a Pi extension in this repository.
The first supported workflow is Level-1. Level-2 can be added later as a
parallel module behind the same `/neuro` selector.

The immediate goal is not to replace the existing
`/mnt/shared-storage-user/zhuyuqing-p/agent-loop` project. This repository acts
as the Pi extension host and UI layer. The original `agent-loop` project remains
the source of the Level-1 Python modules, skills, RAG helpers, data assets, and
runtime configuration.

## User Experience

Launch Pi with:

```bash
just ext-neuro
```

Inside Pi:

```text
/neuro
```

The command opens a level selector. Today it contains only `level1`.
After selection, the footer/status line shows the active NeuroScientist
workflow and the area below the conversation renders a workflow dashboard.

The Level-1 dashboard follows the compact workflow graph in
`specs/workflow.png`:

```text
skill
  |
Research -> Plan -> Code
validate -> analysis -> conclude
```

Each stage has a stable status:

- `pending`
- `running`
- `done`
- `error`

The third line of each card shows the current or last tool event.

## Files

Current implementation:

```text
pi-vs-claude-code/
  extensions/
    neuro.ts
    neuro/
      level1/
        index.ts
        config.json
        prompts/
          entry.md
          continue.md
          conclude_only.md
          deep_research.md
          plan.md
          code.md
          validate.md
          image_refine.md
          image_analysis.md
          conclude.md
  specs/
    neuro.md
```

`extensions/neuro.ts` is the user-facing selector and dashboard extension.

`extensions/neuro/level1/index.ts` is copied from:

```text
/mnt/shared-storage-user/zhuyuqing-p/agent-loop/internagent/pi/extensions/neuroscientist-level1/index.ts
```

`extensions/neuro/level1/prompts/*.md` are copied from the corresponding
`agent-loop` prompt directory.

`extensions/neuro/level1/config.json` is copied from the deployed Level-1 config:

```text
/mnt/shared-storage-user/zhuyuqing-p/agent-loop/.pi/extensions/neuroscientist-level1/config.json
```

## Architecture

`extensions/neuro.ts` is the wrapper extension:

- registers `/neuro`
- renders the workflow widget
- injects the active Level-1 workflow instructions through `before_agent_start`
- tracks `neuro_*` tool execution events and updates stage state

Important implementation points:

- Level tools are registered during extension load, not when `/neuro` is run.
- `/neuro` only selects and activates a workflow level.
- `before_agent_start` injects the selected workflow prompt into the agent's
  system prompt.
- `tool_execution_start` and `tool_execution_end` drive the dashboard state.
- The dashboard is rendered with `ctx.ui.setWidget("neuro-workflow", ...)`.

`extensions/neuro/level1/` contains the Level-1 tool implementation copied from
`agent-loop`:

- `index.ts`
- `config.json`
- `prompts/*.md`

The copied Level-1 module is patched to run from this repository while using the
existing workflow assets in:

```text
/mnt/shared-storage-user/zhuyuqing-p/agent-loop
```

The current repository provides the UI and slash command. The `agent-loop`
project remains the source for Python modules, skills, data assets, and `.env`
used by Level-1 execution.

## Why Tools Are Registered Up Front

Pi extensions require commands and tools to be registered synchronously during
extension loading. That means this pattern is correct:

```ts
export default function (pi) {
  registerLevel1(pi);
  pi.registerCommand("neuro", ...);
}
```

This pattern should be avoided:

```ts
pi.registerCommand("neuro", {
  handler() {
    registerLevel1(pi); // too late
  },
});
```

When Level-2 is added, Level-2 tools should also be registered at load time.
The active level should decide which workflow prompt and dashboard mapping are
used.

## Level-1 Workflow Mapping

The displayed dashboard intentionally compresses the detailed Level-1 spine into
readable cards arranged as a compact graph.

Detailed Level-1 spine:

```text
neuro_capabilities
-> neuro_start_run / neuro_resume_run
-> neuro_deep_research
-> resolve_targeted_skill
-> neuro_plan
-> neuro_code
-> neuro_validate
-> neuro_refine_image
-> neuro_analyze_image
-> neuro_conclude
```

Dashboard mapping:

| Tool | Dashboard stage |
| --- | --- |
| `neuro_capabilities` | `Research` |
| `neuro_start_run` | `Research` |
| `neuro_resume_run` | `Research` |
| `neuro_deep_research` | `Research` |
| `resolve_targeted_skill` | `skill` |
| `neuro_plan` | `Plan` |
| `neuro_code` | `Code` |
| `neuro_validate` | `validate` |
| `neuro_refine_image` | `validate` |
| `neuro_analyze_image` | `analysis` |
| `neuro_conclude` | `conclude` |

The mapping lives in `LEVEL1.toolStages` in `extensions/neuro.ts`.

If more tools are added to Level-1, update this mapping. If a new tool is not
mapped, it will still run, but the dashboard will not change for that tool.

## Level-1 Runtime Adaptation

The original Level-1 extension assumes Pi is running from the `agent-loop`
project root. In this repository, Pi runs from:

```text
/mnt/shared-storage-user/zhuyuqing-p/pi-vs-claude-code
```

The copied Level-1 module therefore defines:

```ts
const WORKFLOW_ROOT = process.env.NEURO_LEVEL1_ROOT || "/mnt/shared-storage-user/zhuyuqing-p/agent-loop";
```

This affects:

- `agent_config.py` config merging
- `.env` loading
- `resolve_targeted_skill.py`
- `rag_paper.py`
- default `root_dir` passed to targeted skill resolution

Output run directories still follow the user-provided `work_dir`. Relative
`work_dir` values are resolved against the current Pi cwd
(`pi-vs-claude-code`). Absolute `work_dir` values are respected.

To point the extension at another workflow checkout:

```bash
NEURO_LEVEL1_ROOT=/path/to/agent-loop just ext-neuro
```

## Level-1 Tool Surface

The copied Level-1 module registers these tools:

```text
neuro_ping
neuro_capabilities
neuro_start_run
neuro_resume_run
neuro_approve_stage
neuro_record_feedback
resolve_targeted_skill
neuro_deep_research
neuro_plan
neuro_code
neuro_validate
neuro_refine_image
neuro_analyze_image
neuro_conclude
```

`neuro_approve_stage` and `neuro_record_feedback` support human review gates.
They are currently not represented as dashboard stages. They can be added later
if review status should be visible in the widget.

## Prompt Injection

After `/neuro` activates Level-1, `before_agent_start` appends:

1. A short wrapper instruction explaining that the active workflow is
   NeuroScientist Level-1.
2. The Level-1 `entry.md` prompt.

This is intentionally different from using Pi's `--prompt-template` flag. It
allows `/neuro` to be a runtime selector, while still keeping Level-1 behavior
prompt-driven.

## Commands and Recipes

Primary command:

```bash
just ext-neuro
```

Equivalent raw command:

```bash
pi -e extensions/neuro.ts -e extensions/theme-cycler.ts
```

If the global `pi` command is run by an old Node version, use the local Node path
from the `justfile`. The current `justfile` exports:

```text
.tools/node-v22.19.0/bin
```

before `~/.local/bin`, so `just ext-neuro` should run Pi with a compatible Node
runtime.

Inside Pi:

```text
/neuro
```

Then select:

```text
level1
```

Example user message after selection:

```text
Question:
...

Dataset / Metadata:
...

Output work directory:
Use work_dir: results/neuro/example

Extra path / access notes:
...
```

## Verification

Recipe check:

```bash
just --dry-run ext-neuro
```

Expected output:

```text
pi -e extensions/neuro.ts -e extensions/theme-cycler.ts
```

Extension load smoke test:

```bash
PATH="$PWD/.tools/node-v22.19.0/bin:$PATH" \
PI_CODING_AGENT_DIR="$PWD/.pi/agent" \
PI_OFFLINE=1 \
pi --approve \
  --no-context-files \
  --no-skills \
  --no-prompt-templates \
  --no-themes \
  -e extensions/neuro.ts \
  -p --no-tools \
  --model openai/gpt-4o-mini \
  "ping"
```

In an environment without model/network access, this may end with:

```text
Connection error.
```

That is acceptable for this smoke test if there are no extension import,
TypeScript parse, or module resolution errors before the connection failure.

Note: this smoke test can create files under `.pi/agent/`. Remove generated
session/auth files if the repository should stay clean.

## Known Constraints

- The Level-1 implementation is copied from `agent-loop`, so future upstream
  changes must be manually re-synced or factored into a shared package.
- The widget tracks tool execution events. If the agent skips a tool because a
  stage is disabled in config, the visible stage may remain `pending`.
- The dashboard is intentionally compressed. The underlying state and artifacts
  remain in `state.json` and the selected `work_dir`.
- The current extension only exposes Level-1 in the selector.
- The copied module imports Pi SDK packages using this repository's package names
  (`@mariozechner/*`). If the runtime package names change, update both
  `extensions/neuro.ts` and `extensions/neuro/level1/index.ts`.
- The Level-1 module still uses subagents internally. Those subagents depend on
  the Pi SDK APIs available in the runtime.

## Syncing Level-1 From agent-loop

When `agent-loop` Level-1 changes, re-sync these files:

```bash
cp /mnt/shared-storage-user/zhuyuqing-p/agent-loop/internagent/pi/extensions/neuroscientist-level1/index.ts \
  extensions/neuro/level1/index.ts

cp /mnt/shared-storage-user/zhuyuqing-p/agent-loop/.pi/extensions/neuroscientist-level1/config.json \
  extensions/neuro/level1/config.json

cp /mnt/shared-storage-user/zhuyuqing-p/agent-loop/internagent/pi/extensions/neuroscientist-level1/prompts/*.md \
  extensions/neuro/level1/prompts/
```

Then re-apply the local compatibility patch:

- import `ExtensionAPI` from `@mariozechner/pi-coding-agent`
- import `Type` from `@sinclair/typebox`
- replace dynamic imports of `@earendil-works/pi-coding-agent` with
  `@mariozechner/pi-coding-agent`
- replace dynamic imports of `@earendil-works/pi-ai` with `@mariozechner/pi-ai`
- add `WORKFLOW_ROOT`
- load `agent_config.py`, `.env`, `resolve_targeted_skill.py`, and `rag_paper.py`
  from `WORKFLOW_ROOT`
- default targeted skill `root_dir` to `WORKFLOW_ROOT`

After syncing, rerun the verification commands above.

## Level-2 Path

When Level-2 is ready:

1. Add `extensions/neuro/level2/`.
2. Register its tools during extension load.
3. Add `level2` to the `/neuro` selector.
4. Add a Level-2 stage list and tool-to-stage mapping.

Pi extension APIs require tools to be registered during extension load, so level
selection only activates a workflow; it must not dynamically register tools.

Suggested Level-2 implementation shape:

```text
extensions/
  neuro.ts
  neuro/
    level1/
      index.ts
      prompts/
    level2/
      index.ts
      config.json
      prompts/
```

In `extensions/neuro.ts`:

```ts
import registerLevel2 from "./neuro/level2/index.ts";

const LEVEL2 = {
  level: "level2",
  label: "Level 2",
  description: "...",
  promptPath: join(EXT_DIR, "neuro", "level2", "prompts", "entry.md"),
  stages: [...],
  toolStages: {...},
};

const WORKFLOWS = [LEVEL1, LEVEL2];

export default function (pi) {
  registerLevel1(pi);
  registerLevel2(pi);
  ...
}
```

If Level-2 uses tools with names that overlap Level-1, either:

- share the same tool implementation intentionally, or
- rename Level-2 tools with a `neuro_l2_*` prefix.

Prefer explicit `neuro_l2_*` names if behavior diverges.
