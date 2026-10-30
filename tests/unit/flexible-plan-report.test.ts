import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, readFile, rm, writeFile, access, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { StudyWorkflow } from "../../src/workflows/unified/study-workflow.ts";
import type { UserRequest } from "../../src/workflows/unified/user-request.ts";
import { createUnifiedStudyTools } from "../../src/extension/runtime/stages/unified-study-tools.ts";
import { reportPdfPolicy } from "../../src/workflows/unified/report-pdf-policy.ts";
import { parseArgs, buildTaskPrompt, buildPiLaunchSpec } from "../../src/cli/cli.mjs";
const dirs: string[] = [];
afterEach(async () => { delete process.env.SEEKBRAIN_RUN_ROOT; await Promise.all(dirs.splice(0).map(p => rm(p, { recursive: true, force: true }))); });
async function fixture() {
  const cwd = await mkdtemp(join(tmpdir(), "seekbrain-flex-")); dirs.push(cwd); const calls: any[] = [];
  const workflow = new StudyWorkflow({ runAgent: async input => {
    calls.push(input);
    if (input.stage === "plan") {
      for (const path of input.run.state.stage_write_paths) await writeFile(path, path.endsWith(".json") ? JSON.stringify({ goal: input.prompt.includes("replace the metric") ? "updated metric" : "donor-level comparison" }) : "Compare donor measurements.");
      return { plan_paths: input.run.state.stage_write_paths };
    }
    if (input.stage === "formulation") return { tasks: [{ id: "analyze", instruction: "Summarize observations." }] };
    if (input.stage === "code") { await writeFile(join(input.workDir, "measurements.tsv"), "value\n2\n4\n"); return { outputs: [{ path: "measurements.tsv" }] }; }
    if (input.stage === "validation") return { decision: "accepted" };
    const path = input.prompt.split("Write the report Markdown to this exact path: ")[1].split("\n")[0];
    await writeFile(path, "# Observations\n\nTwo observations were available.\n"); return { report_path: path };
  } });
  const result = await workflow.start({ cwd, projectPath: "results", request: "Analyze observations, accounting for biological replicates." });
  const run = await workflow.resolve(cwd, { runId: result.run_id }); return { cwd, root: result.project_dir, workflow, run, calls };
}
function userRequest(messageId: string, text: string): UserRequest { return { messageId, text, conversation: [{ id: messageId, role: "user", text }] }; }
describe("flexible plan and report files", () => {
  it("creates and revises JSON in place with no forced Markdown duplicate or execution", async () => {
    const f = await fixture();
    await f.workflow.plan(f.run, undefined, { action: "create", output_paths: ["analyze.json"], userRequest: userRequest("u1", "Use a JSON plan.") });
    expect(f.calls.map(call => call.stage)).toEqual(["plan"]); await expect(access(join(f.root, "plan.md"))).rejects.toThrow();
    await f.workflow.plan(f.run, undefined, { action: "revise", output_paths: ["analyze.json"], userRequest: userRequest("u2", "replace the metric") });
    expect(JSON.parse(await readFile(join(f.root, "analyze.json"), "utf8")).goal).toBe("updated metric");
    expect(f.calls[1].prompt).toContain(join(f.root, "analyze.json"));
    expect(f.run.state.user_updates).toContain("replace the metric");
  });
  it("requires a selection among alternatives and passes the selected JSON unchanged to formulation", async () => {
    const f = await fixture(); await f.workflow.plan(f.run, undefined, { action: "create", output_paths: ["baseline.md", "exploratory.json"] });
    expect((await f.workflow.formulate(f.run)).needs_plan_selection).toBe(true); expect(f.calls.map(call => call.stage)).toEqual(["plan"]);
    await f.workflow.formulate(f.run, undefined, ["exploratory.json"]);
    const input = f.calls.find(call => call.stage === "formulation"); expect(input.prompt).toContain('"goal":"donor-level comparison"'); expect(input.prompt).not.toContain("Compare donor measurements.");
    await f.workflow.execute(f.run); expect(f.calls.filter(call => call.stage === "code")).toHaveLength(1);
  });
  it("uses a user-created external plan without generating another plan", async () => {
    const f = await fixture(); const source = join(f.cwd, "user-plan.json"); await writeFile(source, '{"analysis":"Compare donor means"}');
    await f.workflow.formulate(f.run, undefined, [source]); expect(f.calls.map(call => call.stage)).toEqual(["formulation"]);
    expect(f.calls[0].prompt).toContain("Compare donor means");
    await f.workflow.execute(f.run); expect(await readFile(source, "utf8")).toBe('{"analysis":"Compare donor means"}');
  });
  it("writes only a requested named PDF, preserves previous reports, and retains its internal Markdown draft", async () => {
    const f = await fixture(); await f.workflow.plan(f.run); await f.workflow.formulate(f.run); await f.workflow.execute(f.run);
    const old = join(f.root, "report-0000.pdf"); await writeFile(old, "previous report");
    const result = await f.workflow.report(f.run, undefined, undefined, undefined, { pdf_path: "report-0001.pdf", output_formats: ["pdf"] });
    expect(result.pdf_path).toBe(join(f.root, "report-0001.pdf")); expect(result.report_path).toBeUndefined();
    expect((await readFile(result.pdf_path)).subarray(0, 5).toString()).toBe("%PDF-");
    expect(await readFile(old, "utf8")).toBe("previous report");
    await expect(access(join(f.root, "report.md"))).rejects.toThrow();
    expect(await readFile(result.markdown_source_path, "utf8")).toContain("Two observations");
    expect(f.calls.filter(call => call.stage === "report")).toHaveLength(1);
  });
  it("supports independent Markdown and PDF locations, including spaces and a path outside the project", async () => {
    const f = await fixture(); await f.workflow.plan(f.run); await f.workflow.formulate(f.run);
    const pdf = join(f.cwd, "published reports", "report-0002.pdf");
    const result = await f.workflow.report(f.run, undefined, undefined, undefined, { report_path: "draft-0002.md", pdf_path: pdf });
    expect(result.report_path).toBe(join(f.root, "draft-0002.md")); expect(result.pdf_path).toBe(pdf);
    expect((await readFile(pdf)).subarray(0, 5).toString()).toBe("%PDF-");
  });
  it("supports Markdown-only output without creating a PDF", async () => {
    const f = await fixture(); await f.workflow.plan(f.run); await f.workflow.formulate(f.run);
    const result = await f.workflow.report(f.run, undefined, undefined, undefined, { report_path: "summary.md", output_formats: ["markdown"] });
    expect(result.pdf_path).toBeUndefined(); expect(result.pdf_export.skipped).toBe(true); await expect(access(join(f.root, "summary.pdf"))).rejects.toThrow();
  });
  it("uses the current directory for a standalone Plan request rather than adding a project wrapper", async () => {
    const f = await fixture(); const tools = createUnifiedStudyTools({ workflow: f.workflow, setActiveRunDir() {}, getMode: () => "plan", content: result => ({ details: result }) });
    const result: any = await tools.find(tool => tool.name === "seekbrain_research_start")!.execute("start", {}, undefined, undefined, { cwd: f.cwd, sessionManager: { getBranch: () => [{ type: "message", id: "u1", message: { role: "user", content: "Write a general plan, no dataset required." } }] } } as any);
    expect(result.details.project_dir).toBe(f.cwd);
  });
  it("resumes external selected plans and completed reports without requesting another plan or report", async () => {
    const f = await fixture(); const source = join(f.cwd, "external.json"); await writeFile(source, '{"goal":"Compare animals"}');
    await f.workflow.formulate(f.run, undefined, [source]);
    await f.workflow.report(f.run, undefined, undefined, undefined, { pdf_path: "report-0001.pdf", output_formats: ["pdf"] });
    const tools = createUnifiedStudyTools({ workflow: f.workflow, setActiveRunDir() {}, content: result => ({ details: result }) });
    const resumed: any = await tools.find(tool => tool.name === "seekbrain_run_resume")!.execute("resume", { project_path: f.root }, undefined, undefined, { cwd: f.cwd } as any);
    expect(resumed.details.selected_plan_paths).toEqual([source]); expect(resumed.details.completed_stages).toContain("Report");
    expect(resumed.details.next_tool).toBeUndefined(); expect(resumed.details.awaiting_input).toBe(true);
  });
  it("records follow-up instructions when reopening a project", async () => {
    const f = await fixture(); await f.workflow.start({ cwd: f.cwd, projectPath: f.root, request: "Use donor-level tests and write a Chinese report.", referencePaths: ["./new-notes.md"] });
    const run = await f.workflow.resolve(f.cwd, { projectPath: f.root }); expect(run.state.user_updates).toEqual(["Use donor-level tests and write a Chinese report."]);
    expect(run.state.reference_paths).toContain(join(f.cwd, "new-notes.md"));
  });
  it("passes an explicit interaction mode to Pi without leaking stale mode or output roots", async () => {
    const f = await fixture();
    const explicit: any = buildPiLaunchSpec(parseArgs(["--mode", "plan"]), { cwd: f.cwd, homeDir: f.cwd, env: {} });
    expect(explicit.env.SEEKBRAIN_INTERACTION_MODE).toBe("plan");
    const defaults: any = buildPiLaunchSpec(parseArgs([]), { cwd: f.cwd, homeDir: f.cwd, env: { SEEKBRAIN_INTERACTION_MODE: "ask", SEEKBRAIN_RUN_ROOT: "/stale" } });
    expect(defaults.env.SEEKBRAIN_INTERACTION_MODE).toBeUndefined(); expect(defaults.env.SEEKBRAIN_RUN_ROOT).toBeUndefined();
  });
  it("accepts mode flags independently from Pi transport mode and does not inject an execution instruction into Ask/Plan", () => {
    for (const mode of ["ask", "plan", "research", "deep-research"]) {
      const parsed: any = parseArgs(["run", "--mode", mode, "--query", "Read these notes"]); expect(parsed.action).toBe("launch"); expect(parsed.options.interactionMode).toBe(mode);
      const text = buildTaskPrompt(parsed.options, "/tmp");
      if (mode !== "research") expect(text).not.toContain("Continue without routine approval");
    }
    expect(parseArgs(["run", "--mode", "deep-research", "--query", "Analyze"]).action).toBe("launch");
    expect(parseArgs(["--mode", "unknown"]).action).toBe("error");
  });
});


describe("PDF output policy", () => {
  it("uses configuration unless a CLI switch forces the opposite", () => {
    expect(reportPdfPolicy().enabled).toBe(true);
    expect(reportPdfPolicy({ enabled: false }).enabled).toBe(false);
    expect(reportPdfPolicy({ enabled: false }, "true")).toMatchObject({ enabled: true, force: true });
    expect(reportPdfPolicy({ enabled: true }, "false").enabled).toBe(false);
  });
  it("launches each command with a process-local override, clearing stale inheritance", async () => {
    const f = await fixture();
    for (const args of [[], ["run", "--query", "Analyze"], ["report", f.root], ["resume", "existing-session"]]) {
      for (const flag of ["--pdf", "--no-pdf"]) {
        const parsed: any = parseArgs([...args, flag]); expect(parsed.action).toBe("launch");
        const spec = buildPiLaunchSpec(parsed, { cwd: f.cwd, homeDir: f.cwd, env: {} });
        expect(spec.env.SEEKBRAIN_REPORT_PDF_OVERRIDE).toBe(String(flag === "--pdf"));
        expect(spec.args).not.toContain(flag);
      }
    }
    const spec = buildPiLaunchSpec(parseArgs([]), { cwd: f.cwd, homeDir: f.cwd, env: { SEEKBRAIN_REPORT_PDF_OVERRIDE: "false" } });
    expect(spec.env.SEEKBRAIN_REPORT_PDF_OVERRIDE).toBeUndefined();
    expect(parseArgs(["--pdf", "--no-pdf"]).action).toBe("error");
  });
  it("disabled PDF overrides a PDF-only model request and preserves its requested basename", async () => {
    const f = await fixture(); f.workflow.dependencies.reportPdfPolicy = async () => ({ enabled: false, command: "/missing-renderer" });
    await f.workflow.plan(f.run); await f.workflow.formulate(f.run);
    const output = await f.workflow.report(f.run, undefined, undefined, undefined, { pdf_path: "report-0001.pdf", output_formats: ["pdf"] });
    expect(output.report_path).toBe(join(f.root, "report-0001.md")); expect(output.report_status).toBe("progress");
    expect(output.pdf_export.skipped).toBe(true); expect(output.pdf_path).toBeUndefined();
    expect(f.calls.at(-1).prompt).toContain("PDF output is disabled");
    await expect(access(join(f.root, "report-0001.pdf"))).rejects.toThrow();
    await expect(access(join(f.root, "report.md"))).rejects.toThrow();
    expect(await f.workflow.reportComplete(f.run)).toBe(true);
  });
  it("--pdf overrides a Markdown-only model request", async () => {
    const f = await fixture(); f.workflow.dependencies.reportPdfPolicy = async () => ({ enabled: true, force: true });
    await f.workflow.plan(f.run); await f.workflow.formulate(f.run);
    const output = await f.workflow.report(f.run, undefined, undefined, undefined, { report_path: "conclusion.md", output_formats: ["markdown"] });
    expect(output.report_path).toBe(join(f.root, "conclusion.md"));
    expect((await readFile(output.pdf_path)).subarray(0, 5).toString()).toBe("%PDF-");
    expect(await f.workflow.reportComplete(f.run)).toBe(true);
  });
  it("resumes valid Markdown after a failed PDF export without calling Report again", async () => {
    const f = await fixture(); f.workflow.dependencies.reportPdfPolicy = async () => ({ enabled: true, command: "/missing-renderer" });
    await f.workflow.plan(f.run); await f.workflow.formulate(f.run); await f.workflow.execute(f.run);
    const failed = await f.workflow.report(f.run); expect(failed.pdf_export.ok).toBe(false);
    expect(await f.workflow.reportComplete(f.run)).toBe(false);
    f.workflow.dependencies.reportPdfPolicy = async () => ({ enabled: false });
    const tools = createUnifiedStudyTools({ workflow: f.workflow, setActiveRunDir() {}, content: result => result });
    const result: any = await tools.find(tool => tool.name === "seekbrain_run_resume")!.execute("resume", { project_path: f.root }, undefined, undefined, { cwd: f.cwd } as any);
    expect(result.awaiting_input).toBe(true); expect(result.next_tool).toBeUndefined();
    expect(result.report.formats).toEqual(["markdown"]); expect(f.calls.filter(call => call.stage === "report")).toHaveLength(1);
    f.run.state.report.markdown_complete = false; f.run.state.report.status = "draft";
    expect(await f.workflow.reportComplete(f.run)).toBe(false);
  });
});
