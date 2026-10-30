import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { SessionManager } from "@earendil-works/pi-coding-agent";
import { Value } from "typebox/value";
import { StudyWorkflow } from "../../src/workflows/unified/study-workflow.ts";
import { createUnifiedStudyTools } from "../../src/extension/runtime/stages/unified-study-tools.ts";
import { userRequestFromSession } from "../../src/extension/runtime/shared/user-request-context.ts";

const dirs: string[] = [];
afterEach(async () => { await Promise.all(dirs.splice(0).map(path => rm(path, { recursive: true, force: true }))); });
async function fixture() {
  const cwd = await mkdtemp(join(tmpdir(), "seekbrain-real-request-")); dirs.push(cwd);
  const session = SessionManager.inMemory(cwd), calls: any[] = [];
  const user = (text: string) => session.appendMessage({ role: "user", content: text, timestamp: Date.now() });
  const assistant = (text: string) => session.appendMessage({ role: "assistant", content: [{ type: "thinking", thinking: "PRIVATE_MARKER" }, { type: "text", text }], timestamp: Date.now() } as any);
  const runAgent = async (input: any) => {
    calls.push(input);
    if (input.stage === "plan") {
      for (const path of input.run.state.stage_write_paths) {
        await mkdir(dirname(path), { recursive: true });
        const content = input.prompt.includes("donor") ? "donor comparison" : "initial comparison";
        await writeFile(path, path.endsWith(".json") ? JSON.stringify({ approach: content }) : content);
      }
      return { plan_paths: input.run.state.stage_write_paths };
    }
    if (input.stage === "formulation") return { tasks: [{ id: "compare", instruction: "Compare actual observations." }] };
    if (input.stage === "report") {
      const path = input.prompt.split("Write the report Markdown to this exact path: ")[1].split("\n")[0];
      await writeFile(path, "# Progress\n\nThe requested comparisons are planned; analysis has not been completed.\n");
      return { report_path: path, mode: "progress_report" };
    }
    throw new Error(`Unexpected stage: ${input.stage}`);
  };
  const workflow = new StudyWorkflow({ runAgent });
  const ctx = { cwd, sessionManager: session } as any;
  const tools = createUnifiedStudyTools({ workflow, setActiveRunDir() {}, getMode: () => "plan", content: value => value });
  const invoke = (name: string, params: any = {}): Promise<any> => tools.find(tool => tool.name === name)!.execute(name, params, undefined, undefined, ctx) as any;
  const start = () => invoke("seekbrain_research_start", { project_dir: "study" });
  return { cwd, session, calls, user, assistant, workflow, runAgent, ctx, tools, invoke, start };
}

describe("planning from actual user requests", () => {
  it("preserves the submitted request exactly, supplies it once, and removes model-authored request fields", async () => {
    const f = await fixture();
    const request = "Compare Gini and surplus across three games.\nDataset: ./data.csv\nRelevant material: ./References.\nSave the final PDF as report-0001.pdf.";
    f.user(request); f.assistant("DELEGATION_MARKER: add an unrelated method and report requirements.");
    const started = await f.start();
    const plan = f.tools.find(tool => tool.name === "seekbrain_plan_generate")!;
    const start = f.tools.find(tool => tool.name === "seekbrain_research_start")!;
    expect(Value.Check(start.parameters as any, { question: "invented request" })).toBe(false);
    expect(Value.Check(plan.parameters as any, { instruction: "invented requirements" })).toBe(false);
    await f.invoke("seekbrain_plan_generate", { run_id: started.run_id });
    const input = f.calls[0];
    expect(input.prompt.split(request)).toHaveLength(2);
    expect(input.prompt).toContain("Action: create");
    expect(input.prompt).not.toContain("Current instruction:");
    expect(input.prompt).not.toContain("DELEGATION_MARKER");
    const state = JSON.parse(await readFile(started.state_path, "utf8"));
    expect(state.original_request).toBe(request); expect(state.user_updates).toBeUndefined();
    expect(await readFile(join(f.cwd, "study", "plan.md"), "utf8")).toBe("initial comparison");
  });

  it("reuses a completed plan on a duplicate call in the same user turn", async () => {
    const f = await fixture(); f.user("Write a feasible plan without running the analysis.");
    const started = await f.start();
    await f.invoke("seekbrain_plan_generate", { run_id: started.run_id });
    const reused = await f.invoke("seekbrain_plan_generate", { run_id: started.run_id });
    expect(reused.reused).toBe(true); expect(f.calls.map(call => call.stage)).toEqual(["plan"]);
    expect(reused.next_tool).toBeUndefined(); expect(reused.awaiting_input).toBe(true);
  });

  it("uses a genuine follow-up to revise the existing plan without duplicate instructions", async () => {
    const f = await fixture(); f.user("Plan the group comparison.");
    const started = await f.start(); await f.invoke("seekbrain_plan_generate", { run_id: started.run_id });
    f.assistant("We can compare group means or use a donor-level approach.");
    const update = "Use donor as the independent unit; keep the rest unchanged."; f.user(update);
    f.assistant("DELEGATION_MARKER: also generate an environment manifest.");
    await f.invoke("seekbrain_plan_generate", { run_id: started.run_id });
    const revised = f.calls[1];
    expect(revised.prompt).toContain("Action: revise");
    expect(revised.prompt).toContain(`Source plans: ["${join(f.cwd, "study", "plan.md")}"]`);
    expect(revised.prompt.split(update)).toHaveLength(2);
    expect(revised.prompt).toContain('"role":"assistant"');
    expect(revised.prompt).not.toContain("DELEGATION_MARKER"); expect(revised.prompt).not.toContain("PRIVATE_MARKER");
    expect(await readFile(join(f.cwd, "study", "plan.md"), "utf8")).toBe("donor comparison");
    const state = JSON.parse(await readFile(started.state_path, "utf8")); expect(state.user_updates).toEqual([update]);
  });

  it("creates alternatives in requested formats and revises only the selected file", async () => {
    const f = await fixture(); f.user("Give me baseline.md and exploratory.json as two alternative plans. Stop after planning.");
    const started = await f.start();
    await f.invoke("seekbrain_plan_generate", { run_id: started.run_id, output_paths: ["baseline.md", "exploratory.json"] });
    const baseline = await readFile(join(f.cwd, "study", "baseline.md"), "utf8");
    f.assistant("The first plan is baseline.md; the second is exploratory.json.");
    f.user("Change the second plan to a donor comparison; keep the first unchanged.");
    await f.invoke("seekbrain_plan_generate", { run_id: started.run_id, source_paths: ["exploratory.json"], output_paths: ["exploratory.json"] });
    expect(await readFile(join(f.cwd, "study", "baseline.md"), "utf8")).toBe(baseline);
    expect(JSON.parse(await readFile(join(f.cwd, "study", "exploratory.json"), "utf8"))).toEqual({ approach: "donor comparison" });
    expect(f.calls.map(call => call.stage)).toEqual(["plan", "plan"]);
    const state = JSON.parse(await readFile(started.state_path, "utf8")); expect(state.plan_paths).toEqual(["baseline.md", "exploratory.json"]);
    expect(state.selected_plan_paths).toBeUndefined();
    await expect(readFile(join(f.cwd, "study", "plan.md"), "utf8")).rejects.toThrow();
  });

  it("keeps prior proposals as assistant discussion when a user accepts one", async () => {
    const f = await fixture(); f.user("How could we analyze this dataset?");
    const proposal = "Route 1: compare cell means. Route 2: compare donor means."; f.assistant(proposal);
    f.user("Use your second route and save analyze.json.");
    const started = await f.start(); await f.invoke("seekbrain_plan_generate", { run_id: started.run_id, output_paths: ["analyze.json"] });
    expect(f.calls[0].prompt).toContain(JSON.stringify({ role: "assistant", text: proposal }));
    const state = JSON.parse(await readFile(started.state_path, "utf8"));
    expect(state.original_request).toBe("Use your second route and save analyze.json."); expect(state.user_updates).toBeUndefined();
    expect(JSON.parse(await readFile(join(f.cwd, "study", "analyze.json"), "utf8"))).toEqual({ approach: "donor comparison" });
  });

  it("uses an existing external plan directly for formulation", async () => {
    const f = await fixture(); const source = join(f.cwd, "my_plan.md"); await writeFile(source, "Compare real animal measurements.");
    f.user("Execute ./my_plan.md without regenerating it."); const started = await f.start();
    await f.invoke("seekbrain_formulation_generate", { run_id: started.run_id, plan_paths: [source] });
    expect(f.calls.map(call => call.stage)).toEqual(["formulation"]);
    expect(f.calls[0].prompt).toContain("Compare real animal measurements.");
    expect(await readFile(source, "utf8")).toBe("Compare real animal measurements.");
  });

  it("registers an existing JSON plan for reuse and subsequent formulation", async () => {
    const f = await fixture(); f.user("Use ready.json as the plan for this study."); const started = await f.start();
    await writeFile(join(f.cwd, "study", "ready.json"), '{"approach":"Compare actual animal measurements"}');
    await f.invoke("seekbrain_plan_generate", { run_id: started.run_id, action: "reuse", output_paths: ["ready.json"] });
    const duplicate = await f.invoke("seekbrain_plan_generate", { run_id: started.run_id });
    expect(duplicate.reused).toBe(true);
    await f.invoke("seekbrain_formulation_generate", { run_id: started.run_id });
    expect(f.calls.map(call => call.stage)).toEqual(["formulation"]);
    expect(f.calls[0].prompt).toContain("Compare actual animal measurements");
    await expect(readFile(join(f.cwd, "study", "plan.md"), "utf8")).rejects.toThrow();
  });

  it("carries a report-only follow-up to Report without regenerating the plan", async () => {
    const f = await fixture(); f.user("Plan the group comparison."); const started = await f.start();
    await f.invoke("seekbrain_plan_generate", { run_id: started.run_id }); await f.invoke("seekbrain_formulation_generate", { run_id: started.run_id });
    const before = await readFile(join(f.cwd, "study", "plan.md"), "utf8");
    const update = "Give me the current progress as report-0001.pdf only."; f.user(update);
    const report = await f.invoke("seekbrain_report_generate", { run_id: started.run_id, pdf_path: "report-0001.pdf", output_formats: ["pdf"] });
    expect(f.calls.filter(call => call.stage === "plan")).toHaveLength(1);
    expect(f.calls.at(-1).prompt.split(update)).toHaveLength(2);
    expect((await readFile(report.pdf_path)).subarray(0, 5).toString()).toBe("%PDF-");
    expect(await readFile(join(f.cwd, "study", "plan.md"), "utf8")).toBe(before);
    const state = JSON.parse(await readFile(started.state_path, "utf8")); expect(state.user_updates).toEqual([update]);
  });

  it("resumes a project in a new session with the original request and a real new revision", async () => {
    const f = await fixture(); f.user("Plan the group comparison."); const started = await f.start();
    await f.invoke("seekbrain_plan_generate", { run_id: started.run_id });
    const session = SessionManager.inMemory(f.cwd); session.appendMessage({ role: "user", content: "Revise the plan using donor as the unit.", timestamp: Date.now() });
    const workflow = new StudyWorkflow({ runAgent: f.runAgent });
    const tools = createUnifiedStudyTools({ workflow, setActiveRunDir() {}, content: value => value });
    await tools.find(tool => tool.name === "seekbrain_plan_generate")!.execute("revise", { project_path: join(f.cwd, "study") }, undefined, undefined, { cwd: f.cwd, sessionManager: session } as any);
    expect(f.calls[1].prompt).toContain("Plan the group comparison."); expect(f.calls[1].prompt).toContain("Action: revise");
    expect(await readFile(join(f.cwd, "study", "plan.md"), "utf8")).toBe("donor comparison");
  });

  it("requires a real session message rather than fabricating a request from tool arguments", async () => {
    const f = await fixture();
    await expect(f.start()).rejects.toThrow("No user request"); expect(f.calls).toEqual([]);
  });
});

it("reads a real Pi branch without exposing tool output or assistant reasoning as user requests", () => {
  const session = SessionManager.inMemory("/tmp");
  const userId = session.appendMessage({ role: "user", content: [{ type: "text", text: "Original user wording." }], timestamp: Date.now() });
  session.appendMessage({ role: "assistant", content: [{ type: "thinking", thinking: "PRIVATE_MARKER" }, { type: "toolCall", id: "call", name: "read", arguments: {} }], timestamp: Date.now() } as any);
  session.appendMessage({ role: "toolResult", toolCallId: "call", toolName: "read", content: [{ type: "text", text: "TOOL_OUTPUT_MARKER" }], isError: false, timestamp: Date.now() });
  const request = userRequestFromSession({ sessionManager: session });
  expect(request).toEqual({ messageId: userId, text: "Original user wording.", conversation: [{ id: userId, role: "user", text: "Original user wording." }] });
});


it("uses Pi's compacted context instead of replaying the entire old dialogue", () => {
  const session = SessionManager.inMemory("/tmp");
  session.appendMessage({ role: "user", content: "OBSOLETE_MARKER".repeat(1_000), timestamp: Date.now() });
  const kept = session.appendMessage({ role: "assistant", content: [{ type: "text", text: "The second route compares donor means." }], timestamp: Date.now() } as any);
  session.appendCompaction("Earlier discussion selected two routes; the second uses donors.", kept, 5_000);
  const id = session.appendMessage({ role: "user", content: "Use the second route.", timestamp: Date.now() });
  const request = userRequestFromSession({ sessionManager: session });
  expect(request.text).toBe("Use the second route."); expect(request.messageId).toBe(id);
  expect(request.contextSummary).toContain("second uses donors");
  expect(request.conversation.map(message => message.text).join("\n")).not.toContain("OBSOLETE_MARKER");
  expect(request.conversation).toContainEqual({ id: kept, role: "assistant", text: "The second route compares donor means." });
});
