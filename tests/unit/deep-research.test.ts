import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { StudyWorkflow } from "../../src/workflows/unified/study-workflow.ts";
import { createUnifiedStudyTools } from "../../src/extension/runtime/stages/unified-study-tools.ts";
import * as exporter from "../../src/workflows/seekbrain/report-pdf-exporter.ts";

const directories: string[] = [];
afterEach(async () => { vi.restoreAllMocks(); delete process.env.SEEKBRAIN_RUN_ROOT; await Promise.all(directories.splice(0).map(path => rm(path, { recursive: true, force: true }))); });
async function fixture(options: { maxRounds?: number; behavior?: (input: any) => Promise<any>; initialMode?: string } = {}) {
  const cwd = await mkdtemp(join(tmpdir(), "seekbrain-deep-")); directories.push(cwd);
  let mode = options.initialMode || "deep-research";
  const calls: any[] = [];
  const workflow = new StudyWorkflow({ runAgent: async input => {
    calls.push(input);
    const custom = await options.behavior?.(input);
    if (custom !== undefined) return custom;
    if (input.stage === "plan") {
      const targets = input.run.state.stage_write_paths;
      for (const target of targets) { await mkdir(dirname(target), { recursive: true }); await writeFile(target, target.endsWith(".json") ? '{"comparison":"donor-level"}' : "Compare independent donor measurements; resolve the question with appropriate controls."); }
      return { plan_paths: targets };
    }
    if (input.stage === "formulation") {
      const round = input.run.state.deep_research?.round || 1;
      return { tasks: [{ id: "analysis", instruction: "Measure actual donor differences.", depends_on: round > 1 ? ["r01_analysis"] : [] }] };
    }
    if (input.stage === "code") {
      await writeFile(join(input.workDir, "statistics.tsv"), "donor\tvalue\na\t2\nb\t4\n");
      await writeFile(join(input.workDir, "ANALYSIS_NOTES.md"), "Donor measurements, not independent cells.");
      return { outputs: [{ path: "statistics.tsv", role: "statistics" }, { path: "ANALYSIS_NOTES.md" }], summary: "Donor differences measured." };
    }
    if (input.stage === "validation") return { decision: "accepted" };
    const target = /Write the report Markdown to this exact path: (.+)\n/.exec(input.prompt)![1];
    await writeFile(target, `# Donor study\n\nRound ${input.run.state.deep_research?.round || 1}: donor measurements support a limited descriptive conclusion.\n`);
    return { report_path: target, mode: "scientific_report" };
  } });
  const tools = createUnifiedStudyTools({ workflow, getMode: () => mode, setActiveRunDir() {}, content: value => value, deepResearchMaxRounds: async () => options.maxRounds || 3 });
  const request = "Compare donor measurements. Dataset: ./data.csv. Relevant studies: ./References. Save outputs in ./study";
  const ctx: any = { cwd, sessionManager: { getBranch: () => [{ type: "message", id: "original-user-request", message: { role: "user", content: request } }] } };
  const invoke = (name: string, args: any = {}, signal?: AbortSignal) => tools.find(tool => tool.name === name)!.execute("test", args, signal, undefined, ctx) as Promise<any>;
  const start: any = await invoke("seekbrain_research_start", { dataset_paths: ["./data.csv"], reference_paths: ["./References"] });
  const round = async (reportArgs: any = {}) => {
    await invoke("seekbrain_plan_generate"); await invoke("seekbrain_formulation_generate"); await invoke("seekbrain_execution_run");
    return invoke("seekbrain_report_generate", reportArgs);
  };
  const state = async () => JSON.parse(await readFile(join(start.project_dir, ".seekbrain/state.json"), "utf8"));
  return { cwd, root: start.project_dir, calls, workflow, tools, invoke, round, state, request, setMode: (value: string) => { mode = value; }, ctx };
}

describe("Deep Research rounds through public tools", () => {
  it("finishes after one round, exports once and resumes without another agent call", async () => {
    const f = await fixture();
    const report = await f.round();
    expect(report.next_tool).toBe("seekbrain_research_decide"); expect(report.deep_research.phase).toBe("decision");
    await expect(readFile(join(f.root, "report.pdf"))).rejects.toMatchObject({ code: "ENOENT" });
    const request = { round: 1, action: "finish", reason: "The available evidence answers the scoped question." };
    const result = await f.invoke("seekbrain_research_decide", request);
    expect(result.deep_research.phase).toBe("complete"); expect(result.awaiting_input).toBe(true);
    expect((await readFile(result.pdf_path)).subarray(0, 5).toString()).toBe("%PDF-");
    expect(f.calls.filter(input => input.stage === "report")).toHaveLength(1);
    expect((await f.invoke("seekbrain_research_decide", request)).reused).toBe(true);
    expect((await f.invoke("seekbrain_run_resume")).next_tool).toBeUndefined();
    expect(f.calls.filter(input => input.stage === "code")[0].workDir).toBe(join(f.root, "tasks/r01_analysis"));
    expect(await readFile(join(f.root, "tasks/r01_analysis.md"), "utf8")).toContain("Donor measurements");
  });

  it("adds only new work, consumes historical outputs and preserves cumulative evidence even when the plan text is unchanged", async () => {
    const f = await fixture(); await f.round({ report_path: "./study/reports/report-0001.md", pdf_path: "./study/reports/report-0001.pdf" });
    const decision = { round: 1, action: "continue", reason: "A donor-level sensitivity check will resolve the remaining uncertainty.", next_focus: "Check donor sensitivity using the existing estimates." };
    const result = await f.invoke("seekbrain_research_decide", decision);
    expect(result.deep_research.round).toBe(2); expect(result.next_tool).toBe("seekbrain_plan_generate");
    expect((await f.invoke("seekbrain_research_decide", decision)).deep_research.round).toBe(2);
    await f.round();
    const plans = f.calls.filter(input => input.stage === "plan"); expect(plans).toHaveLength(2);
    expect(plans[1].prompt).toContain("Check donor sensitivity");
    expect(plans[1].prompt).toContain("not an additional user request");
    const formulation = f.calls.filter(input => input.stage === "formulation"); expect(formulation).toHaveLength(2);
    expect(formulation[1].prompt).toContain("historical_tasks_read_only"); expect(formulation[1].prompt).toContain("tasks/r01_analysis/statistics.tsv");
    expect(f.calls.filter(input => input.stage === "code").map(input => input.run.state.task_id)).toEqual(["r01_analysis", "r02_analysis"]);
    expect(f.calls.filter(input => input.stage === "code")[1].prompt).toContain("tasks/r01_analysis/statistics.tsv");
    const run = await f.workflow.resolve(f.cwd, { projectPath: f.root, mode: "deep-research" });
    expect((await f.workflow.evidence(run)).evidence.map((item: any) => item.evidence_id)).toEqual(["r01_analysis", "r02_analysis"]);
    const saved = await f.state(); expect(saved.original_request).toBe(f.request); expect(saved.user_updates || []).toEqual([]);
    expect(saved.plan_paths).toEqual(["plan.md"]); expect(saved.deep_research.rounds.map((item: any) => item.task_ids)).toEqual([["r01_analysis"], ["r02_analysis"]]);
    expect(f.calls.filter(input => input.stage === "report")[1].prompt).toContain("Update a cumulative report");
    const done = await f.invoke("seekbrain_research_decide", { round: 2, action: "finish", reason: "Sensitivity analysis resolves the remaining uncertainty." });
    expect(done.report_path).toBe(join(f.root, "reports/report-0001.md")); expect(done.pdf_path).toBe(join(f.root, "reports/report-0001.pdf"));
    expect(await readFile(join(f.root, ".seekbrain/rounds/01/report.md"), "utf8")).toContain("Round 1");
    expect(await readFile(done.report_path, "utf8")).toContain("Round 2");
  });

  it("retains failures and does not retry them when another round is started", async () => {
    const f = await fixture({ behavior: async input => {
      if (input.stage === "formulation" && input.run.state.deep_research.round === 1) return { tasks: [
        { id: "analysis", instruction: "Measure donor values." }, { id: "unavailable", instruction: "An unsupported analysis." },
      ] };
      if (input.stage === "validation" && input.run.state.task_id.endsWith("unavailable")) return { decision: "unusable", issues: ["Insufficient donor coverage"] };
    } });
    await f.round();
    await f.invoke("seekbrain_research_decide", { round: 1, action: "continue", reason: "One feasible check remains.", next_focus: "Use accepted donor measurements." });
    await f.round();
    expect(f.calls.filter(input => input.stage === "code" && input.run.state.task_id === "r01_unavailable")).toHaveLength(1);
    const graph = JSON.parse(await readFile(join(f.root, ".seekbrain/tasks.json"), "utf8"));
    expect(graph.tasks.find((item: any) => item.id === "r01_unavailable").status).toBe("failed");
    const report = f.calls.filter(input => input.stage === "report").at(-1)!;
    expect(report.prompt).toContain("Insufficient donor coverage");
  });

  it("enforces the configured total round limit without describing it as scientific success", async () => {
    const f = await fixture({ maxRounds: 1 }); await f.round({ output_formats: ["markdown"] });
    const result = await f.invoke("seekbrain_research_decide", { round: 1, action: "continue", reason: "A question remains unresolved.", next_focus: "Check another age contrast." });
    expect(result.deep_research.phase).toBe("complete"); expect(result.decision.stop_reason).toBe("round_limit");
    expect(result.decision.action).toBe("continue"); expect(result.decision.effective_action).toBe("finish");
    expect(f.calls.filter(input => input.stage === "plan")).toHaveLength(1);
  });

  it("retries PDF export after process recreation without regenerating any scientific stage", async () => {
    const exportPdf = vi.spyOn(exporter, "exportReportPdf");
    const f = await fixture(); await f.round(); exportPdf.mockRejectedValueOnce(new Error("Renderer interrupted"));
    const request = { round: 1, action: "finish" as const, reason: "Report the available evidence and limitations." };
    const failed = await f.invoke("seekbrain_research_decide", request);
    expect(failed.ok).toBe(false); expect(failed.deep_research.phase).toBe("export");
    expect(failed.next_parameters).toEqual(request);
    const resumed = new StudyWorkflow({ runAgent: async () => { throw new Error("Scientific agents must not be called"); } });
    const run = await resumed.resolve(f.cwd, { projectPath: f.root, mode: "deep-research" });
    expect((await resumed.researchStatus(run)).next_parameters).toEqual(request);
    const done = await resumed.decide(run, request);
    expect(done.deep_research.phase).toBe("complete"); expect(exportPdf).toHaveBeenCalledTimes(2);
    expect(f.calls.filter(input => input.stage === "report")).toHaveLength(1);
  });

  it("resumes interrupted Validation without recomputing completed Code", async () => {
    let interrupted = true;
    const f = await fixture({ behavior: async input => {
      if (input.stage === "validation" && interrupted) { interrupted = false; return { __agent: { ok: false, error: "Connection lost" } }; }
    } });
    await f.invoke("seekbrain_plan_generate"); await f.invoke("seekbrain_formulation_generate");
    await expect(f.invoke("seekbrain_execution_run")).rejects.toThrow("Validation did not finish");
    expect((await f.invoke("seekbrain_run_resume")).next_tool).toBe("seekbrain_execution_run");
    await f.invoke("seekbrain_execution_run");
    expect(f.calls.filter(input => input.stage === "code")).toHaveLength(1); expect(f.calls.filter(input => input.stage === "validation")).toHaveLength(2);
    expect((await f.invoke("seekbrain_run_resume")).next_tool).toBe("seekbrain_report_generate");
  });

  it("adopts a completed Research report without rerunning Plan, execution or Report", async () => {
    const f = await fixture({ initialMode: "research" }); await f.round({ output_formats: ["markdown"] });
    expect((await f.state()).deep_research).toBeUndefined();
    expect(f.calls.find(input => input.stage === "code").workDir).toBe(f.root);
    f.setMode("deep-research");
    const status = await f.invoke("seekbrain_run_resume"); expect(status.next_tool).toBe("seekbrain_research_decide");
    expect(status.decision_context.evidence.evidence).toHaveLength(1);
    await f.invoke("seekbrain_research_decide", { round: 1, action: "finish", reason: "The existing report is sufficient." });
    expect(f.calls.map(input => input.stage)).toEqual(["plan", "formulation", "code", "validation", "report"]);
  });

  it("keeps Research as a single pass even in a project with Deep Research history", async () => {
    const f = await fixture(); await f.round({ output_formats: ["markdown"] }); f.setMode("research");
    const result = await f.invoke("seekbrain_report_generate", { output_formats: ["markdown"] });
    expect(result.next_tool).toBeUndefined(); expect(result.deep_research).toBeUndefined();
    expect((await f.invoke("seekbrain_run_resume")).awaiting_input).toBe(true);
    await expect(f.invoke("seekbrain_research_decide", { round: 1, action: "finish", reason: "Finish" })).rejects.toThrow("only in Deep Research");
  });

  it("preserves explicit JSON plans without generating a Markdown duplicate", async () => {
    const f = await fixture(); await f.invoke("seekbrain_plan_generate", { output_paths: ["analyze.json"] });
    await f.invoke("seekbrain_formulation_generate"); await f.invoke("seekbrain_execution_run");
    await f.invoke("seekbrain_report_generate", { output_formats: ["markdown"] });
    await f.invoke("seekbrain_research_decide", { round: 1, action: "continue", reason: "One uncertainty remains.", next_focus: "Assess donor sensitivity." });
    await f.invoke("seekbrain_plan_generate");
    expect(JSON.parse(await readFile(join(f.root, "analyze.json"), "utf8"))).toEqual({ comparison: "donor-level" });
    await expect(readFile(join(f.root, "plan.md"))).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("withdraws only named erroneous outputs and updates the report before finishing", async () => {
    const f = await fixture(); await f.round({ output_formats: ["markdown"] });
    const request = { round: 1, action: "finish", reason: "A donor join error invalidates this table; retain the limitation.", invalidate_paths: ["tasks/r01_analysis/statistics.tsv"] };
    const changed = await f.invoke("seekbrain_research_decide", request);
    expect(changed.needs_report_update).toBe(true); expect(changed.next_tool).toBe("seekbrain_report_generate");
    const run = await f.workflow.resolve(f.cwd, { projectPath: f.root, mode: "deep-research" });
    const bundle = await f.workflow.evidence(run);
    expect(bundle.evidence[0].outputs.map((output: any) => output.path)).not.toContain("tasks/r01_analysis/statistics.tsv");
    await f.invoke("seekbrain_report_generate");
    expect(f.calls.filter(input => input.stage === "report").at(-1)!.prompt).toContain("donor join error");
    expect((await f.invoke("seekbrain_research_decide", request)).deep_research.phase).toBe("complete");
    expect(f.calls.filter(input => input.stage === "code")).toHaveLength(1);
  });

  it("archives local figure links so history survives relocating the whole project", async () => {
    const f = await fixture({ behavior: async input => {
      if (input.stage !== "report") return;
      const path = join(input.workDir, "report.md");
      await writeFile(path, `![Relative](tasks/r01_analysis/statistics.tsv)\n![Absolute](<${join(input.workDir, "tasks/r01_analysis/statistics.tsv")}>)\n`);
      return { report_path: path };
    } });
    await f.round({ output_formats: ["markdown"] });
    const snapshot = join(f.root, ".seekbrain/rounds/01/report.md"), content = await readFile(snapshot, "utf8");
    const links = [...content.matchAll(/\]\(<?([^>\n)]+)>?\)/g)].map(match => match[1]);
    expect(links).toHaveLength(2);
    expect(links[0]).toBe(links[1]);
    const relativeTarget = links[0];
    expect(await readFile(resolve(dirname(snapshot), relativeTarget), "utf8")).toContain("donor");
    const moved = join(f.cwd, "relocated"); await rename(f.root, moved);
    expect(await readFile(resolve(moved, ".seekbrain/rounds/01", relativeTarget), "utf8")).toContain("donor");
  });
  it("opens another round only for a new explicit research request after completion", async () => {
    const f = await fixture(); await f.round({ output_formats: ["markdown"] });
    await f.invoke("seekbrain_research_decide", { round: 1, action: "finish", reason: "The initial question is answered." });
    expect((await f.invoke("seekbrain_research_start", { project_dir: f.root })).deep_research.phase).toBe("complete");
    const previous = f.ctx.sessionManager.getBranch();
    f.ctx.sessionManager.getBranch = () => [...previous, { type: "message", id: "new-user-request", message: { role: "user", content: "Continue this study with a donor sensitivity analysis." } }];
    const start = await f.invoke("seekbrain_research_start", { project_dir: f.root });
    expect(start.deep_research.round).toBe(2); expect(start.next_tool).toBe("seekbrain_plan_generate");
    expect((await f.invoke("seekbrain_research_start", { project_dir: f.root })).deep_research.round).toBe(2);
    await f.round({ output_formats: ["markdown"] });
    expect(f.calls.filter(input => input.stage === "code").map(input => input.run.state.task_id)).toEqual(["r01_analysis", "r02_analysis"]);
    expect((await f.state()).user_updates).toEqual(["Continue this study with a donor sensitivity analysis."]);
  });

  it("uses a supplied existing plan directly without calling Plan", async () => {
    const f = await fixture();
    const existing = join(f.cwd, "existing.json"); await writeFile(existing, '{"question":"compare independent donors"}');
    const graph = await f.invoke("seekbrain_formulation_generate", { plan_paths: [existing] });
    expect(graph.next_tool).toBe("seekbrain_execution_run");
    expect(f.calls.filter(input => input.stage === "plan")).toHaveLength(0);
    await f.invoke("seekbrain_execution_run"); await f.invoke("seekbrain_report_generate", { output_formats: ["markdown"] });
    expect((await f.invoke("seekbrain_run_resume")).next_tool).toBe("seekbrain_research_decide");
  });

  it("preserves partial computation across transport interruption and resumes only the current task", async () => {
    let interrupted = true;
    const f = await fixture({ behavior: async input => {
      if (input.stage === "code" && interrupted) {
        interrupted = false; await writeFile(join(input.workDir, "checkpoint.tsv"), "donor,value\na,2\n");
        return { __agent: { ok: false, error: "Connection reset" } };
      }
    } });
    await f.invoke("seekbrain_plan_generate"); await f.invoke("seekbrain_formulation_generate");
    await expect(f.invoke("seekbrain_execution_run")).rejects.toThrow("Execution incomplete");
    expect((await f.invoke("seekbrain_run_resume")).deep_research.phase).toBe("execution");
    await f.invoke("seekbrain_execution_run");
    expect(f.calls.filter(input => input.stage === "code")[1].prompt).toContain("checkpoint.tsv");
    expect(await readFile(join(f.root, "tasks/r01_analysis/checkpoint.tsv"), "utf8")).toContain("a,2");
  });

  it("keeps user cancellation resumable and prevents a new round from starting", async () => {
    const controller = new AbortController(); let cancelled = false;
    const f = await fixture({ behavior: async input => {
      if (input.stage === "validation" && !cancelled) { cancelled = true; controller.abort(new Error("User cancelled")); return { __agent: { ok: false, error: "User cancelled" } }; }
    } });
    await f.invoke("seekbrain_plan_generate"); await f.invoke("seekbrain_formulation_generate");
    await expect(f.invoke("seekbrain_execution_run", {}, controller.signal)).rejects.toThrow();
    expect((await f.invoke("seekbrain_run_resume")).deep_research.phase).toBe("execution");
    await f.invoke("seekbrain_execution_run");
    expect(f.calls.filter(input => input.stage === "code")).toHaveLength(1);
    expect((await f.state()).deep_research.round).toBe(1);
  });

  it("regenerates a report after withdrawing evidence even when continuation hits the round limit", async () => {
    const f = await fixture({ maxRounds: 1 }); await f.round({ output_formats: ["markdown"] });
    const request = { round: 1, action: "continue", reason: "The table is invalid and needs a future correction.", next_focus: "Correct the donor join.", invalidate_paths: ["tasks/r01_analysis/statistics.tsv"] };
    expect((await f.invoke("seekbrain_research_decide", request)).needs_report_update).toBe(true);
    await f.invoke("seekbrain_report_generate");
    const final = await f.invoke("seekbrain_research_decide", request);
    expect(final.deep_research.phase).toBe("complete"); expect(final.decision.stop_reason).toBe("round_limit");
    expect(f.calls.filter(input => input.stage === "plan")).toHaveLength(1);
  });

  it("honors a later report-only request in Deep Research without reopening execution", async () => {
    const f = await fixture(); await f.round({ output_formats: ["markdown"] });
    await f.invoke("seekbrain_research_decide", { round: 1, action: "finish", reason: "Question addressed." });
    const branch = f.ctx.sessionManager.getBranch();
    f.ctx.sessionManager.getBranch = () => [...branch, { type: "message", id: "report-only", message: { role: "user", content: "Write another named report from these results, without new analysis." } }];
    const result = await f.invoke("seekbrain_report_generate", { report_path: "report-0002.md", output_formats: ["markdown"] });
    expect(result.report_path).toBe(join(f.root, "report-0002.md"));
    expect(result.next_tool).toBeUndefined();
    expect((await f.state()).deep_research.phase).toBe("complete");
    expect(f.calls.filter(input => input.stage === "code")).toHaveLength(1);
    expect(f.calls.filter(input => input.stage === "report")).toHaveLength(2);
  });

  it("honors a later plan-only request without starting a new research round", async () => {
    const f = await fixture(); await f.round({ output_formats: ["markdown"] });
    await f.invoke("seekbrain_research_decide", { round: 1, action: "finish", reason: "Question addressed." });
    const branch = f.ctx.sessionManager.getBranch();
    f.ctx.sessionManager.getBranch = () => [...branch, { type: "message", id: "plan-only", message: { role: "user", content: "Only draft an alternative plan in alternative.json." } }];
    const result = await f.invoke("seekbrain_plan_generate", { output_paths: ["alternative.json"] });
    expect(result.next_tool).toBeUndefined(); expect(result.awaiting_input).toBe(true);
    expect((await f.state()).deep_research.round).toBe(1);
    expect((await f.state()).deep_research.phase).toBe("complete");
    expect(f.calls.filter(input => input.stage === "code")).toHaveLength(1);
    expect(JSON.parse(await readFile(join(f.root, "alternative.json"), "utf8"))).toHaveProperty("comparison");
  });

  it("recovers a persisted task graph if the process stops before the round state is saved", async () => {
    const f = await fixture(); await f.invoke("seekbrain_plan_generate");
    const saveRun = (f.workflow as any).saveRun.bind(f.workflow);
    let saves = 0;
    const crash = vi.spyOn(f.workflow as any, "saveRun").mockImplementation(async (run: any) => {
      if (++saves === 2) throw new Error("Process stopped after task graph write");
      return saveRun(run);
    });
    await expect(f.invoke("seekbrain_formulation_generate")).rejects.toThrow("Process stopped");
    crash.mockRestore();
    expect((await f.state()).deep_research.rounds[0].task_ids).toEqual([]);
    const recovered = await f.invoke("seekbrain_formulation_generate");
    expect(recovered.reused).toBe(true); expect(recovered.next_tool).toBe("seekbrain_execution_run");
    expect(f.calls.filter(input => input.stage === "formulation")).toHaveLength(1);
    await f.invoke("seekbrain_execution_run");
    expect(f.calls.filter(input => input.stage === "code")).toHaveLength(1);
  });

  it("recovers finished execution if the process stops before the Report phase is saved", async () => {
    const f = await fixture(); await f.invoke("seekbrain_plan_generate"); await f.invoke("seekbrain_formulation_generate");
    const saveRun = (f.workflow as any).saveRun.bind(f.workflow);
    const crash = vi.spyOn(f.workflow as any, "saveRun").mockImplementation(async (run: any) => {
      if (run.state.deep_research.phase === "report") throw new Error("Process stopped after execution graph write");
      return saveRun(run);
    });
    await expect(f.invoke("seekbrain_execution_run")).rejects.toThrow("Process stopped");
    crash.mockRestore();
    expect((await f.state()).deep_research.phase).toBe("execution");
    await f.invoke("seekbrain_execution_run");
    expect((await f.invoke("seekbrain_run_resume")).next_tool).toBe("seekbrain_report_generate");
    expect(f.calls.filter(input => input.stage === "code")).toHaveLength(1);
    expect(f.calls.filter(input => input.stage === "validation")).toHaveLength(1);
  });

});


describe("Deep Research PDF switch", () => {
  it("finishes without PDF when disabled, even if the model requests PDF", async () => {
    const f = await fixture();
    f.workflow.dependencies.reportPdfPolicy = async () => ({ enabled: false, command: "/missing-renderer" });
    await f.round({ output_formats: ["markdown", "pdf"] });
    const done = await f.invoke("seekbrain_research_decide", { round: 1, action: "finish", reason: "Question addressed." });
    expect(done.deep_research.phase).toBe("complete"); expect(done.pdf_path).toBeUndefined();
    expect((await f.state()).report.formats).toEqual(["markdown"]);
    expect(f.calls.filter(call => call.stage === "report")).toHaveLength(1);
  });
  it("can disable a failed final PDF export and finish from saved Markdown", async () => {
    const f = await fixture();
    f.workflow.dependencies.reportPdfPolicy = async () => ({ enabled: true, command: "/missing-renderer" });
    await f.round();
    const request = { round: 1, action: "finish", reason: "Question addressed." };
    const failed = await f.invoke("seekbrain_research_decide", request);
    expect(failed.ok).toBe(false); expect(failed.deep_research.phase).toBe("export");
    f.workflow.dependencies.reportPdfPolicy = async () => ({ enabled: false });
    const done = await f.invoke("seekbrain_research_decide", request);
    expect(done.deep_research.phase).toBe("complete"); expect(done.pdf_path).toBeUndefined();
    expect(f.calls.filter(call => call.stage === "report")).toHaveLength(1);
  });
  it("forces final PDF after a Markdown-only round without regenerating Report", async () => {
    const f = await fixture(); await f.round({ output_formats: ["markdown"] });
    f.workflow.dependencies.reportPdfPolicy = async () => ({ enabled: true, force: true });
    const done = await f.invoke("seekbrain_research_decide", { round: 1, action: "finish", reason: "Question addressed." });
    expect(done.deep_research.phase).toBe("complete"); expect(done.pdf_path).toBeTruthy();
    expect(f.calls.filter(call => call.stage === "report")).toHaveLength(1);
  });
});
