# Research Planning Engine Refactor Plan

Status: implemented and verified

## 1. Objective

Refactor Research Planning from a subquestion-only generator into a lightweight,
tree-structured scientific planning engine.

Given one broad scientific question and locked dataset metadata, the engine must
produce:

- 2–3 targeted scientific subquestions;
- 1–2 actionable analysis tasks under each subquestion;
- an explicit biological hypothesis for every terminal task;
- a synthesis strategy showing how the task evidence answers the original
  question.

The design retains an Orchestrator–Reviewer debate while removing repeated
automatic review rounds.

## 2. Final Workflow

```text
Broad scientific question + dataset metadata
  -> Orchestrator creates a complete research-tree draft
  -> Reviewer critiques the complete tree once
  -> if accepted: use the draft as the final tree
  -> if revision is required: Orchestrator responds and revises once
  -> user reviews the final tree
     -> approve: begin task execution
     -> revise: Orchestrator applies user feedback, then returns to user review
     -> cancel: retain the plan without execution
```

The Reviewer is called once by default. A user-requested revision does not call
the Reviewer again. A second Reviewer call is allowed only when the user
explicitly requests another scientific review; it is not part of the automatic
workflow.

## 3. Responsibilities

### 3.1 Orchestrator Agent

The Orchestrator receives the original question, scientific framing, dataset
capability summary, and locked metadata. It creates the entire tree in one
call, rather than generating and reviewing subquestions and tasks separately.

It must:

- use 2–3 non-redundant subquestions;
- assign 1–2 tasks to each subquestion;
- keep each subquestion scientifically meaningful and jointly sufficient;
- map every task to a distinct, falsifiable biological hypothesis;
- identify the data required by each task and ground it in the metadata;
- distinguish evidence supporting and contradicting the hypothesis;
- avoid implementation-only splits, such as output files, plot panels, batches,
  or code stages;
- describe how evidence will be synthesized across branches.

Tasks define scientific analysis units, not detailed code plans. Detailed
methods remain the responsibility of the normal SeekBrain Plan stage.

### 3.2 Reviewer Agent

The Reviewer evaluates the complete tree once across:

- scientific relevance;
- logical completeness and coverage;
- dataset feasibility;
- redundancy and complementarity;
- hypothesis testability;
- cross-modality evidence roles;
- ability of terminal tasks to support the intended overall conclusion.

The Reviewer returns `accept`, `revise`, or `blocked`, with structured blocking
issues and recommendations. It does not start a score-driven multi-round loop.

### 3.3 Orchestrator Response

For `revise`, the Orchestrator receives the draft and the structured critique.
It must resolve every blocking issue by either:

- accepting it and changing the referenced nodes;
- partially accepting it with a scoped change;
- defending the original choice with a scientific and data-grounded reason.

The response records each resolution and produces the final tree. Unresolved
issues are surfaced to the user instead of triggering another automatic review.

For `blocked`, the engine stops before execution and explains what question or
data change is required.

## 4. Research Tree Contract

```json
{
  "research_goal": "...",
  "planning_rationale": "...",
  "subquestions": [
    {
      "id": "SQ1",
      "question": "...",
      "hypothesis": "...",
      "role_in_overall_conclusion": "...",
      "dataset_grounding": ["..."],
      "tasks": [
        {
          "id": "SQ1-T1",
          "title": "...",
          "analysis_question": "...",
          "biological_hypothesis": "...",
          "analysis_strategy": "...",
          "required_data": ["..."],
          "expected_evidence": "...",
          "supports_conclusion_if": "...",
          "contradicts_conclusion_if": "..."
        }
      ]
    }
  ],
  "synthesis_strategy": "..."
}
```

Schema constraints:

- `subquestions`: 2–3 items;
- `tasks`: 1–2 items per subquestion;
- IDs are stable and unique;
- every terminal task contains a biological hypothesis and dataset grounding;
- no unsupported modality, variable, annotation, experiment, or external
  dataset may be invented.

## 5. Reviewer Contract

```json
{
  "verdict": "accept | revise | blocked",
  "summary": "...",
  "blocking_issues": [
    {
      "target_id": "SQ2-T1",
      "dimension": "data_feasibility",
      "issue": "...",
      "required_change": "..."
    }
  ],
  "non_blocking_suggestions": [],
  "missing_evidence": [],
  "redundancies": [],
  "unsupported_tasks": []
}
```

## 6. Human Review Contract

Only the final research tree is presented for routine human review.

```text
Review the structured research plan?

2–3 scientific subquestions
N actionable analysis tasks
Reviewer status and revision summary
Unresolved blocking issue count

Approve — begin task execution
Revise — provide scientific feedback
Cancel — retain the plan without execution
```

User feedback has the highest priority. On `Revise`, the Orchestrator rewrites
the plan once and returns it to the user. The Reviewer is not called again
unless the user explicitly asks for another scientific review.

## 7. Persistence

Store planning artifacts under the run directory:

```text
research_plan/
  draft_plan.json
  reviewer_critique.json
  orchestrator_response.json   # only when automatic revision is required
  research_plan.json
  review_decision.json
```

`state.json` remains the source of truth and records:

- planning status;
- artifact paths;
- reviewer verdict;
- unresolved issue count;
- user decision and feedback history;
- stable node IDs and task execution status.

Do not produce multi-round subquestion review logs or per-node Reviewer
artifacts.

## 8. Execution Boundary

After user approval, each terminal task becomes an independently traceable
child execution unit and enters the standard SeekBrain workflow:

```text
Skill -> Plan -> Code -> Validate -> Interpret
```

Research Planning supplies the task's scientific question, hypothesis, data
requirements, and relationship to the parent conclusion. The normal Plan stage
supplies detailed analytical methods and deliverables.

The Research Planning Engine does not execute analysis code itself.

## 9. Implementation Phases

### Phase A — Replace the subquestion contract

- Replace the flat `research_subquestions.json` result with the research-tree
  schema.
- Add schema validation for 2–3 subquestions and 1–2 tasks per subquestion.
- Update Orchestrator prompts to generate the complete tree in one call.

### Phase B — Add single-pass adversarial review

- Add the compact Reviewer schema and prompt.
- Run the Reviewer exactly once after draft generation.
- For `revise`, run one Orchestrator response/refinement call.
- For `blocked`, stop before human approval and return actionable guidance.

### Phase C — Add final human review

- Add the native research-tree review selector.
- Persist approve, revise, and cancel decisions.
- Route user revision directly to the Orchestrator without an automatic second
  Reviewer call.
- Preserve an explicit opt-in path for user-requested re-review.

### Phase D — Connect task execution

- Materialize stable task records from terminal tree nodes.
- Route approved tasks into the existing standard SeekBrain workflow.
- Preserve parent/child provenance and synthesis relationships.

### Phase E — Migration and verification

- Remove obsolete automatic multi-round review assumptions.
- Keep a compatibility reader for existing `research_subquestions.json` runs
  where practical.
- Add unit tests for schema bounds, single Reviewer invocation, revision,
  blocked routing, user feedback, persistence, resume, and task dispatch.
- Update tool-contract baselines, compact renderers, entry instructions, and
  non-interactive tool lists.

## 10. Acceptance Criteria

- A broad question produces 2–3 subquestions and 1–2 tasks per subquestion.
- Every task is explicitly mapped to a biological hypothesis and supported by
  locked metadata.
- The Reviewer is invoked no more than once in the default automatic path.
- A Reviewer revision produces at most one automatic Orchestrator refinement.
- User revision never silently invokes the Reviewer again.
- Blocked plans do not proceed to execution.
- Approved terminal tasks can enter the standard SeekBrain workflow with full
  parent/child provenance.
- All planning artifacts and decisions survive resume and are traceable from
  `state.json`.
