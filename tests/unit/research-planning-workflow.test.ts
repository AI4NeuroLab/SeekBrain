import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { FileRunRepository } from "../../src/core/index.ts";
import { ResearchPlanningWorkflow, RunLifecycleWorkflow } from "../../src/workflows/index.ts";

describe("research planning workflow", () => {
  it("stops for clarification when the question and metadata are fundamentally mismatched", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "seekbrain-research-mismatch-"));
    try {
      const lifecycle = new RunLifecycleWorkflow(new FileRunRepository());
      const run = await lifecycle.startRun(cwd, "run", undefined, "How does eye opening alter visual-cortex transcriptomes?");
      await lifecycle.updateState(run, { data_info: JSON.stringify({ modality: "Neuropixels electrophysiology" }) });
      const workflow = new ResearchPlanningWorkflow({
        lifecycle,
        runAgent: async ({ prompt }) => {
          expect(prompt).not.toContain("literature_queries");
          return { ok: true, result: {
            route: "needs_clarification",
            reason: "The dataset contains electrophysiology, not transcriptomics.",
            dataset_summary: "Neuropixels recordings",
            question_requirements: "Visual-cortex transcriptomics",
            recommended_action: "Provide transcriptomic metadata",
            evidence_dimensions: [],
            inferred_background: "",
            inferred_scientific_goal: "",
            literature_queries: ["must be discarded for AILab"],
          } };
        },
        writeJson: async (path, value) => {
          await mkdir(dirname(path), { recursive: true });
          await writeFile(path, JSON.stringify(value, null, 2));
        },
        appendEvent: async () => {},
      });
      const result = await workflow.assess({ cwd, runId: run.runId, literatureProvider: "ailab_rag", rolePrompt: "route role", agentConfig: {}, finalizeSchema: {} });
      expect(result).toMatchObject({ ok: true, route: "needs_clarification", needs_user_clarification: true, needs_user_review: false });
      expect(result).toMatchObject({ dataset_summary: "Neuropixels recordings", recommended_action: "Provide transcriptomic metadata" });
      expect(result.next_tool).toBeUndefined();
      expect(result).not.toHaveProperty("literature_queries");
      const state = JSON.parse(await readFile(join(run.runDir, "state.json"), "utf8"));
      expect(state.research_planning.status).toBe("blocked_input");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it("requires a Yes decision before preparing subquestions and lets No use the standard route", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "seekbrain-research-planning-"));
    try {
      const lifecycle = new RunLifecycleWorkflow(new FileRunRepository());
      const run = await lifecycle.startRun(cwd, "run", undefined, "Can behavior, neural activity, and posture jointly explain the prior signal?");
      await lifecycle.updateState(run, { data_info: JSON.stringify({ modalities: ["behavior", "neural", "pose"] }) });
      const events: any[] = [];
      let phase: "route" | "subquestions" | "review" = "route";
      let reviewerCalls = 0;
      const workflow = new ResearchPlanningWorkflow({
        lifecycle,
        runAgent: async ({ prompt, finalizeTool }) => {
          if (phase === "route") {
            expect(finalizeTool).toBe("finalize_research_route");
            expect(prompt).toContain("Dataset metadata excerpt");
            expect(prompt).toContain("Literature provider: semantic_scholar");
            expect(prompt).toContain("literature_queries");
            return { ok: true, result: {
              route: "research_planning",
              reason: "three independent evidence streams",
              dataset_summary: "behavior, neural activity, and pose",
              question_requirements: "separate and synthesize complementary explanations",
              recommended_action: "prepare structured research subquestions",
              evidence_dimensions: ["behavior", "neural", "pose"],
              inferred_background: "possible motor confound",
              inferred_scientific_goal: "distinguish cognitive and embodied priors",
              literature_queries: ["behavior neural prior", "posture neural activity"],
            } };
          }
          if (phase === "review") {
            reviewerCalls += 1;
            expect(finalizeTool).toBe("finalize_research_plan_review");
            expect(prompt).toContain("[Literature Grounding Background]\nDevelopmental evidence supports modality-specific tests.");
            return { ok: true, result: {
              verdict: "accept",
              summary: "The research tree is coherent and feasible.",
              blocking_issues: [],
              non_blocking_suggestions: [],
              missing_evidence: [],
              redundancies: [],
              unsupported_tasks: [],
              blocked_reason: "",
              recommended_action: "",
            } };
          }
          expect(finalizeTool).toBe("finalize_research_plan_draft");
          expect(prompt).toContain("[Literature Grounding Background]\nDevelopmental evidence supports modality-specific tests.");
          const task = (id: string, title: string) => ({
            id,
            title,
            analysis_question: `${title}?`,
            biological_hypothesis: `${title} has a measurable biological effect.`,
            analysis_strategy: `Test ${title} with the available observations.`,
            required_data: ["recorded observations"],
            expected_evidence: "A quantified effect with uncertainty.",
            supports_conclusion_if: "The effect is robust.",
            contradicts_conclusion_if: "The effect is absent.",
          });
          return { ok: true, result: {
            research_goal: "Distinguish cognitive and embodied priors.",
            planning_rationale: "Two complementary evidence branches.",
            subquestions: [
              {
                id: "first",
                question: "Does behavior reflect the prior?",
                hypothesis: "Behavior reflects the prior.",
                role_in_overall_conclusion: "Tests behavioral expression.",
                dataset_grounding: ["behavior modality"],
                tasks: [task("first-task", "Quantify behavioral prior effects")],
              },
              {
                id: "second",
                question: "Does pose explain the neural signal?",
                hypothesis: "Pose accounts for part of the neural signal.",
                role_in_overall_conclusion: "Tests an embodied confound.",
                dataset_grounding: ["pose and neural modalities"],
                tasks: [task("second-task", "Compare pose and neural effects")],
              },
            ],
            synthesis_strategy: "Compare behavioral and pose-linked evidence.",
          } };
        },
        writeJson: async (path, value) => {
          await mkdir(dirname(path), { recursive: true });
          await writeFile(path, JSON.stringify(value, null, 2));
        },
        appendEvent: async (event) => { events.push(event); },
      });

      const assessed = await workflow.assess({ cwd, runId: run.runId, literatureProvider: "semantic_scholar", rolePrompt: "route role", agentConfig: {}, finalizeSchema: {} });
      expect(assessed).toMatchObject({ ok: true, route: "research_planning", needs_user_review: true, next_tool: "neuro_review_research_planning" });
      expect(assessed.literature_queries).toEqual(["behavior neural prior", "posture neural activity"]);
      expect(await workflow.prepareSubquestions({ cwd, runId: run.runId, rolePrompt: "subquestion role", agentConfig: {}, finalizeSchema: {} })).toMatchObject({ ok: false, blocked_by_human_review: true });

      const declined = await workflow.recordDecision(cwd, run.runId, "no");
      expect(declined).toMatchObject({ ok: true, route: "standard", next_tool: "resolve_targeted_skill" });

      await workflow.assess({ cwd, runId: run.runId, literatureProvider: "semantic_scholar", rolePrompt: "route role", agentConfig: {}, finalizeSchema: {} });
      expect(await workflow.recordDecision(cwd, run.runId, "yes")).toMatchObject({ ok: true, route: "research_planning", next_tool: "neuro_prepare_subquestions" });
      const approvedRun = await lifecycle.resolveRun(cwd, run.runId);
      await lifecycle.updateState(approvedRun, {
        research_planning: {
          ...approvedRun.state.research_planning,
          survey: {
            status: "ready",
            literature_grounding_context: "[Literature Grounding Background]\nDevelopmental evidence supports modality-specific tests.",
            sources: [{ source_id: "S1", title: "Relevant paper" }],
          },
        },
      });
      phase = "subquestions";
      const prepared = await workflow.prepareSubquestions({ cwd, runId: run.runId, rolePrompt: "subquestion role", agentConfig: {}, finalizeSchema: {} });
      expect(prepared).toMatchObject({ ok: true, needs_reviewer_review: true, subquestion_count: 2, task_count: 2 });
      expect(prepared.subquestions).toHaveLength(2);
      expect(prepared.subquestions[0].id).toBe("SQ1");
      expect(prepared.subquestions[0].tasks[0].id).toBe("SQ1-T1");
      const state = JSON.parse(await readFile(join(run.runDir, "state.json"), "utf8"));
      expect(state.research_planning.status).toBe("draft_ready");
      expect(state.research_planning.draft_plan_path).toBe(join(run.runDir, "research_plan", "draft_plan.json"));
      phase = "review";
      const reviewed = await workflow.reviewResearchPlan({
        cwd,
        runId: run.runId,
        reviewerRolePrompt: "review role",
        reviewerAgentConfig: {},
        reviewerFinalizeSchema: {},
        orchestratorRolePrompt: "orchestrator role",
        orchestratorAgentConfig: {},
        refinementFinalizeSchema: {},
      });
      expect(reviewed).toMatchObject({ ok: true, verdict: "accept", refined: false, needs_user_review: true });
      expect(reviewerCalls).toBe(1);
      const reviewedState = JSON.parse(await readFile(join(run.runDir, "state.json"), "utf8"));
      expect(reviewedState.research_planning.status).toBe("ready_for_user_review");
      expect(reviewedState.research_planning.reviewer_call_count).toBe(1);
      expect(events.map((event) => event.event)).toContain("neuro_prepare_subquestions");
      expect(events.map((event) => event.event)).toContain("neuro_review_research_plan");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it("runs one Reviewer call and at most one Orchestrator refinement", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "seekbrain-research-refine-"));
    try {
      const lifecycle = new RunLifecycleWorkflow(new FileRunRepository());
      const research = await lifecycle.startResearch({
        cwd,
        projectPath: "project",
        question: "Can two evidence branches explain the effect?",
      });
      const run = research.run;
      const task = (id: string) => ({
        id,
        title: "Test an effect",
        analysis_question: "Is the effect present?",
        biological_hypothesis: "The effect is present.",
        analysis_strategy: "Estimate the effect with uncertainty.",
        required_data: ["measurements"],
        expected_evidence: "An estimated effect.",
        supports_conclusion_if: "The estimate is robust.",
        contradicts_conclusion_if: "The estimate is absent.",
      });
      const draft = {
        research_goal: "Explain the effect.",
        planning_rationale: "Use two evidence branches.",
        subquestions: [1, 2].map((index) => ({
          id: `SQ${index}`,
          question: `Does branch ${index} explain the effect?`,
          hypothesis: `Branch ${index} contributes.`,
          role_in_overall_conclusion: `Tests branch ${index}.`,
          dataset_grounding: ["measurements"],
          tasks: [task(`SQ${index}-T1`)],
        })),
        synthesis_strategy: "Compare both branches.",
      };
      await lifecycle.updateState(run, {
        data_info: JSON.stringify({ variables: ["measurements"] }),
        research_planning: { status: "draft_ready", draft_plan: draft, assessment: {} },
      });
      let reviewerCalls = 0;
      let refinementCalls = 0;
      let userRevisionCalls = 0;
      const workflow = new ResearchPlanningWorkflow({
        lifecycle,
        runAgent: async ({ finalizeTool }) => {
          if (finalizeTool === "finalize_research_plan_review") {
            reviewerCalls += 1;
            return { ok: true, result: {
              verdict: "revise",
              summary: "One task needs a clearer contrast.",
              blocking_issues: [{ target_id: "SQ1-T1", dimension: "hypothesis_testability", issue: "Contrast is unclear", required_change: "Define the null result" }],
              non_blocking_suggestions: [], missing_evidence: [], redundancies: [], unsupported_tasks: [], blocked_reason: "", recommended_action: "",
            } };
          }
          if (finalizeTool === "finalize_research_plan_user_revision") {
            userRevisionCalls += 1;
            return { ok: true, result: { feedback_response: "Updated the synthesis emphasis.", final_plan: draft } };
          }
          refinementCalls += 1;
          expect(finalizeTool).toBe("finalize_research_plan_refinement");
          return { ok: true, result: {
            review_response: [{ target_id: "SQ1-T1", resolution: "accepted", explanation: "Defined the null result.", changed_nodes: ["SQ1-T1"] }],
            final_plan: draft,
            unresolved_issues: [],
          } };
        },
        writeJson: async (path, value) => {
          await mkdir(dirname(path), { recursive: true });
          await writeFile(path, JSON.stringify(value, null, 2));
        },
        appendEvent: async () => {},
      });
      const result = await workflow.reviewResearchPlan({
        cwd, runId: run.runId,
        reviewerRolePrompt: "review", reviewerAgentConfig: {}, reviewerFinalizeSchema: {},
        orchestratorRolePrompt: "orchestrate", orchestratorAgentConfig: {}, refinementFinalizeSchema: {},
      });
      expect(result).toMatchObject({ ok: true, verdict: "revise", refined: true, unresolved_issue_count: 0 });
      expect(reviewerCalls).toBe(1);
      expect(refinementCalls).toBe(1);
      const state = JSON.parse(await readFile(join(run.runDir, "state.json"), "utf8"));
      expect(state.research_planning).toMatchObject({ reviewer_call_count: 1, automatic_refinement_count: 1, status: "ready_for_user_review" });
      const accidentalRereview = await workflow.reviewResearchPlan({
        cwd, runId: run.runId,
        reviewerRolePrompt: "review", reviewerAgentConfig: {}, reviewerFinalizeSchema: {},
        orchestratorRolePrompt: "orchestrate", orchestratorAgentConfig: {}, refinementFinalizeSchema: {},
      });
      expect(accidentalRereview).toMatchObject({ ok: false });
      expect(accidentalRereview.error).toContain("explicit user request");
      expect(reviewerCalls).toBe(1);
      const revised = await workflow.recordResearchPlanDecision({
        cwd,
        runId: run.runId,
        decision: "revise",
        feedback: "Emphasize convergence across both branches.",
        orchestratorRolePrompt: "orchestrate",
        orchestratorAgentConfig: {},
        revisionFinalizeSchema: {},
      });
      expect(revised).toMatchObject({ ok: true, decision: "revise", reviewer_called: false, reviewer_call_count: 1, needs_user_review: true });
      expect(reviewerCalls).toBe(1);
      expect(refinementCalls).toBe(1);
      expect(userRevisionCalls).toBe(1);
      const revisedState = JSON.parse(await readFile(join(run.runDir, "state.json"), "utf8"));
      expect(revisedState.research_planning).toMatchObject({ reviewer_call_count: 1, user_revision_count: 1, status: "ready_for_user_review" });
      const approved = await workflow.recordResearchPlanDecision({
        cwd,
        runId: run.runId,
        decision: "approve",
        orchestratorRolePrompt: "orchestrate",
        orchestratorAgentConfig: {},
        revisionFinalizeSchema: {},
      });
      expect(approved).toMatchObject({ ok: true, decision: "approve", status: "approved_for_execution", next_tool: "neuro_materialize_research_tasks" });
      const materialized = await workflow.materializeResearchTasks({ cwd, runId: run.runId });
      expect(materialized).toMatchObject({ ok: true, reused: false, task_count: 2, next_tool: "resolve_targeted_skill" });
      expect(materialized.task_runs.map((item: any) => item.task_id)).toEqual(["SQ1-T1", "SQ2-T1"]);
      expect(materialized.task_runs[0].run_dir).toBe(join(cwd, "project", "research_tasks", "SQ1-T1", "round1"));
      expect(materialized.task_runs[0].task_project_manifest_path).toBe(join(cwd, "project", "research_tasks", "SQ1-T1", "project.json"));
      const taskProject = JSON.parse(await readFile(materialized.task_runs[0].task_project_manifest_path, "utf8"));
      expect(taskProject.rounds[0]).toMatchObject({ round_number: 1, run_id: materialized.task_runs[0].run_id });
      const firstChild = JSON.parse(await readFile(materialized.task_runs[0].state_path, "utf8"));
      expect(firstChild).toMatchObject({
        parent_run_id: run.runId,
        research_task_id: "SQ1-T1",
        research_subquestion_id: "SQ1",
        project_dir: join(cwd, "project", "research_tasks", "SQ1-T1"),
        round_number: 1,
        data_info: JSON.stringify({ variables: ["measurements"] }),
      });
      expect(firstChild.inherited_context.task.biological_hypothesis).toBe("The effect is present.");
      expect(firstChild.research_planning).toMatchObject({ status: "task_execution", enabled: false });
      const parentProject = JSON.parse(await readFile(join(cwd, "project", "project.json"), "utf8"));
      expect(parentProject.research_tasks).toEqual(expect.arrayContaining([
        expect.objectContaining({ task_id: "SQ1-T1", project_dir: join(cwd, "project", "research_tasks", "SQ1-T1") }),
        expect.objectContaining({ task_id: "SQ2-T1", project_dir: join(cwd, "project", "research_tasks", "SQ2-T1") }),
      ]));
      const reused = await workflow.materializeResearchTasks({ cwd, runId: run.runId });
      expect(reused).toMatchObject({ ok: true, reused: true, task_count: 2 });
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});
