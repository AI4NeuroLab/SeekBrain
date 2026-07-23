# Phase 4: stage migration

Phase 4 moves workflow behavior out of the Pi extension one dependency layer at
a time. Tool names, TypeBox parameter schemas, Pi result details, prompts, and
artifact/state contracts remain frozen during each move.

## Migration order and status

| Slice | Status | New boundary |
| --- | --- | --- |
| ping / capabilities | complete | `system-workflow.ts` pure result builders |
| start / resume run | complete | `RunLifecycleWorkflow` |
| start / continue research | complete | `RunLifecycleWorkflow` project-round operations |
| shared resolve / update state | complete | `RunLifecycleWorkflow` used by remaining stages |
| deep research / skill | complete | `ResearchSkillWorkflow` + injected resolver/RAG/agent ports |
| plan | complete | `PlanWorkflow` + injected planner/file/event ports |
| code | complete | `CodeWorkflow` + injected retry/agent/file/snapshot ports |
| validate | complete | `ValidateWorkflow` + injected vision/policy/agent/file ports |
| image refine / analyze | complete | `ImageWorkflow` + injected vision/guard/policy/agent ports |
| conclude | complete | `ConcludeWorkflow` + injected policy/agent/file/snapshot ports |
| review tools | complete | `ReviewWorkflow` state machine + Pi selector/diff adapters |

`src/extension/tool-adapter.ts` now owns the common conversion from
workflow details to the Pi text/details result. `RunLifecycleWorkflow` has no Pi
SDK imports and is tested directly with `FileRunRepository`.

## Phase guarantees

- A run is created, indexed, resumed, and updated without an `ExtensionAPI`.
- Multi-round metadata and parent context are inherited by the workflow layer.
- Research, plan, code, validation, image, conclusion, and review stages resolve
  and mutate state through the same lifecycle service.
- Stage prompts, deterministic routing, artifact persistence, and review-state
  transitions live in `src/workflows`; Pi owns registration, TypeBox
  schemas, isolated-agent construction, native selectors, and diff rendering.
- Old inline stage implementations and duplicate review-state helpers were
  removed from the active extension.
- Unit tests execute workflows with fake ports, while contract tests exercise
  registered Pi adapters and retain the frozen tool-schema baseline.
