import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it, vi } from "vitest";
import { FileRunRepository, DEFAULT_SEEKBRAIN_CONFIG } from "../../src/core/index.ts";
import { CreativeResearchPlanningWorkflow, ResearchPlanningWorkflow, RunLifecycleWorkflow,
  TaskBriefWorkflow, ResearchTaskScheduler } from "../../src/workflows/index.ts";
import { createReadTool } from "@earendil-works/pi-coding-agent";
import { createLifecycleTools } from "../../src/extension/runtime/stages/lifecycle-tools.ts";
import { createResearchPlanningTools } from "../../src/extension/runtime/stages/research-planning-tools.ts";

const ideas = "低温：比较各条件的响应。\n\n中温：检验竞争机制。\n\n高温：检验测量偏差。\n";
function tree() {
  return { research_goal: "Explain recorded responses", subquestions: ["Condition", "Competition", "Measurement"].map((direction) => ({
    question: `Test ${direction}`,
    tasks: [{ analysis_question: `Estimate ${direction} effects using response by condition and subject; keep all subjects and report uncertainty.`,
      required_data: ["response", "condition", "subject"], analysis_strategy: "Estimate effects with subject-aware uncertainty.",
      expected_evidence: "Stable effects support the explanation; null or reversed effects weaken it." }],
  })), synthesis_strategy: "Compare independent evidence after every leaf has finished." };
}
async function fixture() {
  const cwd = await mkdtemp(join(tmpdir(), "seekbrain-creative-auto-"));
  const lifecycle = new RunLifecycleWorkflow(new FileRunRepository());
  const run = await lifecycle.startRun(cwd, "run", undefined, "Find useful explanations of responses.");
  await lifecycle.updateState(run, { data_info: JSON.stringify({ variables: ["response", "condition", "subject"] }),
    research_planning: { status: "approved", agent_full_auto: true, assessment: { route: "research_planning",
      planning_mode: "discovery", task_brief: { hard_constraints: ["Keep all subjects"] } } } });
  const writeJson = async (path: string, value: any) => { await mkdir(dirname(path), { recursive: true }); await writeFile(path, JSON.stringify(value)); };
  const runAgent = vi.fn(async (request: any) => request.finalizeTool === "finalize_creative_ideas_text"
    ? { ok: true, result: { text: ideas } } : { ok: true, result: tree() });
  const common = { lifecycle, writeJson, appendEvent: async () => {}, runAgent };
  const creativeWorkflow = new CreativeResearchPlanningWorkflow(common);
  const planningWorkflow = new ResearchPlanningWorkflow(common);
  const deps: any = { projectRoot: cwd, lifecycle, creativeWorkflow, planningWorkflow,
    creativeSearchWorkflow: { search: vi.fn(() => { throw new Error("No mandatory search"); }) },
    surveyWorkflow: { execute: vi.fn(() => { throw new Error("No survey"); }) },
    loadConfig: async () => ({}), workflowConfig: () => ({ research_planning_strategy: "creative", research_planning_peer_review: true }),
    resolveRun: (cwd: string, id: string) => lifecycle.resolveRun(cwd, id), readPrompt: (name: string) => readFile(join(process.cwd(), "prompts", `${name}.md`), "utf8"),
    pickAgentConfig: () => ({}), content: (details: any) => details,
  };
  const tools = createResearchPlanningTools(deps);
  const generate = async (): Promise<any> => tools.find((t) => t.name === "seekbrain_planning_generate")!.execute("generate", { run_id: run.runId }, undefined, undefined, { cwd } as any);
  return { cwd, lifecycle, run, common, deps, tools, generate, runAgent, planningWorkflow };
}

describe("Creative automatic planning", () => {
  it("passes ideas verbatim, makes only two calls, bypasses all tree reviews, and materializes isolated leaves", async () => {
    const f = await fixture();
    try {
      const result = await f.generate();
      expect(result).toMatchObject({ ok: true, creative_auto: true, task_count: 3,
        ideas_text: ideas, needs_user_review: false, needs_reviewer_review: false, next_tool: "seekbrain_analysis_tasks_prepare" });
      expect(result).not.toHaveProperty("subquestions"); // no duplicate tree payload
      expect(f.runAgent).toHaveBeenCalledTimes(2);
      expect(f.runAgent.mock.calls[0][0].prompt).toContain("No reference input is required.");
      const plannerPrompt = f.runAgent.mock.calls[1][0].prompt;
      expect(plannerPrompt).toContain(ideas);
      expect(plannerPrompt).not.toContain("TaskBrief from research intake");
      expect(plannerPrompt).not.toContain("Selected Creative Research Question Certificate");
      expect(f.deps.creativeSearchWorkflow.search).not.toHaveBeenCalled();
      expect(f.deps.surveyWorkflow.execute).not.toHaveBeenCalled();
      const parent = await f.lifecycle.resolveRun(f.cwd, f.run.runId);
      expect(parent.state.research_planning).toMatchObject({ status: "approved_for_execution", creative_auto: true, agent_full_auto: true, peer_review_required: false });
      for (const name of ["seekbrain_planning_peer_review", "seekbrain_planning_researcher_review"]) {
        const skipped = await f.tools.find((t) => t.name === name)!.execute(name, { run_id: f.run.runId }, undefined, undefined, { cwd: f.cwd } as any);
        expect(skipped).toMatchObject({ skipped: true, needs_user_review: false, next_tool: "seekbrain_analysis_tasks_prepare" });
      }
      expect((await f.generate()).reused).toBe(true);
      expect(f.runAgent).toHaveBeenCalledTimes(2);
      const prepared = await f.planningWorkflow.materializeResearchTasks({ cwd: f.cwd, runId: f.run.runId });
      expect(new Set(prepared.task_runs.map((t: any) => t.run_dir)).size).toBe(3);
      const taskBrief = new TaskBriefWorkflow(f.common);
      for (const task of prepared.task_runs) {
        const child = await f.lifecycle.resolveRun(f.cwd, task.run_id);
        expect(child.state).toMatchObject({ independent_leaf: true, question: task.question, research_planning: { agent_full_auto: true } });
        expect(child.state.research_task_contract.required_data).toEqual(["response", "condition", "subject"]);
        expect(child.state.research_task_contract).not.toHaveProperty("sibling_results");
        const brief = await taskBrief.resolveDirect({ cwd: f.cwd, runId: task.run_id, rolePrompt: "unused", agentConfig: {} });
        expect(brief.agent_called).toBe(false);
        expect(brief.question).toBe(task.question);
      }
      expect(f.runAgent).toHaveBeenCalledTimes(2);
      const scheduler = new ResearchTaskScheduler(f.common);
      await scheduler.initialize({ cwd: f.cwd, runId: f.run.runId, planningConcurrency: 3 });
      const claimed = await scheduler.claimPlanningTasks(f.cwd, f.run.runId);
      expect(claimed.claimed_task_ids).toHaveLength(3);
      await scheduler.publishEvent({ cwd: f.cwd, parentRunId: f.run.runId, taskId: "SQ1-T1", type: "task_failed", payload: { error: "leaf failure" } });
      const status = await scheduler.status(f.cwd, f.run.runId);
      expect(status.tasks.map((t: any) => t.status)).toEqual(["failed", "planning", "planning"]);
    } finally { await rm(f.cwd, { recursive: true, force: true }); }
  });

  it("starts Creative CLI automatic mode with consent already recorded and no selection gate", async () => {
    const f = await fixture();
    vi.stubEnv("SEEKBRAIN_RUN_MODE", "research_planning_auto");
    try {
      f.planningWorkflow.assess = async (input: any) => f.planningWorkflow.recordAssessment({
        cwd: input.cwd, runId: input.runId, assessment: { route: "research_planning",
          task_brief: { scientific_goal: "Find useful explanations", intent_mode: "open_discovery", intent_status: "ready",
            biological_scope: [], requested_data: [], hard_constraints: [], output_preferences: [] } },
      });
      const deps = { ...f.deps, writeJson: f.common.writeJson, setActiveRunDir() {},
        loadConfig: async () => DEFAULT_SEEKBRAIN_CONFIG,
        workflowConfig: () => ({ research_planning: true, research_planning_strategy: "creative" }),
        taskBriefWorkflow: new TaskBriefWorkflow(f.common), researchRouteSchema: () => ({}),
      };
      const start = createLifecycleTools(deps).find((t) => t.name === "seekbrain_research_start")!;
      const result: any = await start.execute("start", { project_dir: "cli-project",
        question: "Find useful explanations of recorded responses. Relevant material: ./References and ./notes.md",
        reference_paths: ["./References", "./notes.md"], data_info: '{"variables":["response"]}' },
        undefined, undefined, { cwd: f.cwd } as any);
      expect(result.research_route).toMatchObject({ planning_consent: "agent_full_auto", needs_user_review: false,
        next_tool: "seekbrain_planning_generate" });
      const parent = await f.lifecycle.resolveRun(f.cwd, result.run_id);
      expect(parent.state.research_planning).toMatchObject({ status: "approved", agent_full_auto: true });
      expect(parent.state.reference_paths).toEqual([join(f.cwd, "References"), join(f.cwd, "notes.md")]);
      expect(parent.state.request_cwd).toBe(f.cwd);
    } finally { vi.unstubAllEnvs(); await rm(f.cwd, { recursive: true, force: true }); }
  });

  it("gives both automatic agents generic reference paths and working read tools, then inherits references to leaves", async () => {
    const f = await fixture();
    try {
      const references = join(f.cwd, "Reference Materials");
      await mkdir(references);
      const note = join(references, "design.md");
      await writeFile(note, "Prior protocol: keep all subjects and estimate within-subject effects.");
      await f.lifecycle.updateState(f.run, { reference_paths: [references, note], request_cwd: f.cwd,
        extra_path_info: "Reference Materials contains a protocol and analysis notes, not just papers." });
      const responses: any[] = [];
      f.runAgent.mockImplementation(async (request: any) => {
        expect(request.tools).toEqual(expect.arrayContaining(["read", "ls"]));
        expect(request.prompt).toContain(references);
        expect(request.prompt).toContain(note);
        expect(request.prompt).toContain(f.cwd);
        expect(request.prompt).toContain("Reference material can be any relevant file");
        const result = await createReadTool(request.runDir).execute("reference", { path: note });
        responses.push(result.content);
        return request.finalizeTool === "finalize_creative_ideas_text"
          ? { ok: true, result: { text: ideas } } : { ok: true, result: tree() };
      });
      expect((await f.generate()).ok).toBe(true);
      expect(responses).toHaveLength(2);
      for (const content of responses) expect(JSON.stringify(content)).toContain("Prior protocol");
      const prepared = await f.planningWorkflow.materializeResearchTasks({ cwd: f.cwd, runId: f.run.runId });
      for (const task of prepared.task_runs) {
        const child = await f.lifecycle.resolveRun(f.cwd, task.run_id);
        expect(child.state.reference_paths).toEqual([references, note]);
        expect(child.state.request_cwd).toBe(f.cwd);
      }
    } finally { await rm(f.cwd, { recursive: true, force: true }); }
  });

  it("reuses ideas on a failed planner retry instead of restarting creative generation", async () => {
    const f = await fixture();
    try {
      const responses: any[] = [{ ok: true, result: { text: ideas } }, { ok: false, error: "interrupted planner" }, { ok: true, result: tree() }];
      f.runAgent.mockImplementation(async () => responses.shift());
      expect((await f.generate()).ok).toBe(false);
      expect((await f.generate()).ok).toBe(true);
      expect(f.runAgent.mock.calls.map(([r]) => r.finalizeTool)).toEqual([
        "finalize_creative_ideas_text", "finalize_research_plan", "finalize_research_plan",
      ]);
    } finally { await rm(f.cwd, { recursive: true, force: true }); }
  });

  it.each([
    { depends_on: ["SQ1-T1"] },
    { dependencies: ["earlier analysis"] },
    { required_data: ["/project/research_tasks/SQ1-T1/result.csv"] },
    { analysis_question: "Use SQ1-T1 selected features to fit a model." },
  ])("rejects an explicit cross-leaf dependency: %j", async (dependency) => {
    const f = await fixture();
    try {
      const invalid = tree();
      Object.assign(invalid.subquestions[1].tasks[0], dependency);
      f.runAgent.mockImplementation(async (request: any) => request.finalizeTool === "finalize_creative_ideas_text"
        ? { ok: true, result: { text: ideas } } : { ok: true, result: invalid });
      const result = await f.generate();
      expect(result.ok).toBe(false);
      expect(result.error).toContain("Independent leaf");
      expect((await f.lifecycle.resolveRun(f.cwd, f.run.runId)).state.research_planning.status).toBe("approved");
    } finally { await rm(f.cwd, { recursive: true, force: true }); }
  });

  it("does not call the planner after an empty ideas response", async () => {
    const f = await fixture();
    try {
      f.runAgent.mockImplementation(async () => ({ ok: true, result: { text: "  " } }));
      expect((await f.generate()).ok).toBe(false);
      expect(f.runAgent).toHaveBeenCalledTimes(1);
    } finally { await rm(f.cwd, { recursive: true, force: true }); }
  });
});
