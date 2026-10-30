import { mkdtemp, mkdir, readFile, writeFile, rm, rename, utimes } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, it, expect, afterEach, vi } from "vitest";
import * as pdfExporter from "../../src/workflows/seekbrain/report-pdf-exporter.ts";
import { StudyWorkflow } from "../../src/workflows/unified/study-workflow.ts";
import { checkTasks, type Task } from "../../src/workflows/unified/interfaces.ts";
import { availableOutputs } from "../../src/workflows/unified/outputs.ts";
import { atomicWriteJson } from "../../src/core/index.ts";

const dirs: string[] = [];
afterEach(async () => { vi.restoreAllMocks(); delete process.env.SEEKBRAIN_RUN_ROOT; await Promise.all(dirs.splice(0).map(p => rm(p, { force: true, recursive: true }))); });
const task = (id: string, depends_on: string[] = [], extra: any = {}) => ({ id, instruction: `Analyze actual measurements for ${id}`, depends_on, ...extra });
async function fixture(tasks: any[], behavior: (stage: string, input: any, attempt: number) => Promise<any> = async () => undefined) {
  const cwd = await mkdtemp(join(tmpdir(), "seekbrain014-flexible-")); dirs.push(cwd);
  const calls: any[] = [], counts = new Map<string, number>();
  let active = 0, peak = 0;
  const workflow = new StudyWorkflow({ runAgent: async input => {
    calls.push(input);
    const id = input.run.state.task_id || "parent", key = `${input.stage}/${id}`;
    const attempt = (counts.get(key) || 0) + 1; counts.set(key, attempt);
    if (input.stage === "code") { active++; peak = Math.max(peak, active); }
    try {
      const custom = await behavior(input.stage, input, attempt);
      if (custom !== undefined) return custom;
      if (input.stage === "plan") { await writeFile(join(input.workDir, "plan.md"), "Estimate donor means using real observations."); return { plan_path: "plan.md" }; }
      if (input.stage === "formulation") return { tasks };
      if (input.stage === "code") {
        await writeFile(join(input.workDir, "run_pilot.py"), "print('actual analysis')\n");
        await writeFile(join(input.workDir, "measurements.tsv"), "donor\tvalue\na\t2\nb\t4\n");
        return { outputs: [{ path: "measurements.tsv", role: "metadata" }], summary: "Measured actual observations" };
      }
      if (input.stage === "validation") return { decision: "accepted" };
      await writeFile(join(input.workDir, "report.md"), "# Current progress\n\nObserved donor measurements with explicit limitations.\n");
      return { report_path: "report.md", mode: "progress_report" };
    } finally { if (input.stage === "code") active--; }
  } });
  const started = await workflow.start({ cwd, projectPath: "outputs", request: "Analyze donor measurements. Dataset: ./input.csv. Relevant studies: ./References.", datasetPaths: ["./input.csv"], referencePaths: ["./References"] });
  const run = await workflow.resolve(cwd, { runId: started.run_id });
  await workflow.plan(run); await workflow.formulate(run);
  return { cwd, root: join(cwd, "outputs"), workflow, run, calls, counts, peak: () => peak };
}

describe("simplified study input/output and recovery", () => {
  it("copies the sole Markdown per task regardless of filename case without registering duplicate evidence", async () => {
    const f = await fixture([task("prepare"), task("analyze", ["prepare"])], async (stage, input) => {
      if (stage !== "code") return;
      const name = input.run.state.task_id === "prepare" ? "task_report.md" : "Analysis_Notes.MD";
      await writeFile(join(input.workDir, name), `# ${input.run.state.task_id}\n\nActual execution notes.\n`);
      await mkdir(join(input.workDir, "nested"));
      await writeFile(join(input.workDir, "nested", "README.md"), "Not a top-level candidate");
    });
    expect((await f.workflow.execute(f.run)).graph.status).toBe("complete");
    for (const [id, name] of [["prepare", "task_report.md"], ["analyze", "Analysis_Notes.MD"]]) {
      expect(await readFile(join(f.root, "tasks", `${id}.md`))).toEqual(await readFile(join(f.root, "tasks", id, name)));
    }
    const evidence = await f.workflow.evidence(f.run);
    expect(evidence.evidence.flatMap((item: any) => item.outputs).some((output: any) => ["tasks/prepare.md", "tasks/analyze.md"].includes(output.path))).toBe(false);
    const downstream = f.calls.find(call => call.stage === "code" && call.run.state.task_id === "analyze");
    expect(downstream.prompt).toContain("tasks/prepare/task_report.md");
    expect(downstream.prompt).not.toContain('"path":"tasks/prepare.md"');
  });

  it("skips missing and ambiguous Markdown notes without blocking execution", async () => {
    const f = await fixture([task("missing"), task("ambiguous")], async (stage, input) => {
      if (stage !== "code") return;
      if (input.run.state.task_id === "ambiguous") {
        await writeFile(join(input.workDir, "HANDOFF.md"), "Handoff");
        await writeFile(join(input.workDir, "notes.md"), "Lowercase notes");
      }
    });
    expect((await f.workflow.execute(f.run)).graph.status).toBe("complete");
    for (const id of ["missing", "ambiguous"]) await expect(readFile(join(f.root, "tasks", `${id}.md`))).rejects.toMatchObject({ code: "ENOENT" });
    expect(f.counts.get("code/missing")).toBe(1);
    expect(f.counts.get("code/ambiguous")).toBe(1);
  });

  it("refreshes notes on verification resume and restores a missing copy without rerunning agents", async () => {
    const f = await fixture([task("single"), task("other")], async (stage, input) => {
      if (stage === "code" && input.run.state.task_id === "single") await writeFile(join(input.workDir, "task_report.md"), "Initial notes");
    });
    await f.workflow.execute(f.run);
    const copy = join(f.root, "tasks", "single.md");
    expect(await readFile(copy, "utf8")).toBe("Initial notes");
    await writeFile(join(f.root, "tasks", "single", "task_report.md"), "Updated notes");
    await f.workflow.execute(f.run);
    expect(await readFile(copy, "utf8")).toBe("Updated notes");
    await rm(copy);
    await f.workflow.execute(f.run);
    expect(await readFile(copy, "utf8")).toBe("Updated notes");
    expect(f.counts.get("code/single")).toBe(1);
    expect(f.counts.get("validation/single")).toBe(2);
  });

  it("does not fail or retry a task when its browsing copy cannot be written", async () => {
    const f = await fixture([task("a"), task("b")], async (stage, input) => {
      if (stage !== "code" || input.run.state.task_id !== "a") return;
      await writeFile(join(input.workDir, "task_report.md"), "Completed execution");
      await mkdir(join(input.workDir, "..", "a.md"), { recursive: true });
    });
    expect((await f.workflow.execute(f.run)).graph.tasks[0].status).toBe("complete");
    expect(f.counts.get("code/a")).toBe(1);
    expect(f.counts.get("validation/a")).toBe(1);
    expect(await readFile(join(f.root, ".seekbrain", "events.jsonl"), "utf8")).toContain('"type":"task_summary_copy_failed"');
  });

  it("runs a pilot with three source files, directories and TSV results without contracts or fixed filenames", async () => {
    const f = await fixture([task("pilot")], async (stage, input) => {
      if (stage !== "code") return;
      for (const name of ["estimators.py", "run_pilot.py", "test_estimators.py"]) await writeFile(join(input.workDir, name), "print(1)\n");
      await mkdir(join(input.workDir, "summaries")); await writeFile(join(input.workDir, "summaries", "counts.tsv"), "donor\tn\na\t3\n");
      return { outputs: [{ path: "summaries", role: "summaries" }] };
    });
    const result = await f.workflow.execute(f.run);
    expect(result.graph.tasks[0].status).toBe("complete");
    const bundle = await f.workflow.evidence(f.run);
    expect(bundle.evidence[0].outputs.some((a: any) => a.entry_type === "directory")).toBe(true);
    expect(bundle.evidence[0].outputs.filter((a: any) => a.kind === "code")).toHaveLength(3);
    expect(f.calls.every(c => !c.prompt.includes("Execution contract:"))).toBe(true);
    const state = JSON.parse(await readFile(join(f.root, ".seekbrain/tasks/pilot/state.json"), "utf8"));
    expect(state.execution_contract).toBeUndefined(); expect(state.validation.decision).toBe("accepted");
  });

  it.each(["single", "parallel", "serial", "mixed"])("supports %s execution without an output template", async topology => {
    const tasks = topology === "single" ? [task("a")] : topology === "parallel" ? [task("a"), task("b")] : topology === "serial" ? [task("a"), task("b", ["a"])] : [task("a"), task("b", ["a"]), task("c", ["a"])];
    const f = await fixture(tasks, async stage => { if (stage === "code") await new Promise(r => setTimeout(r, 15)); });
    const result = await f.workflow.execute(f.run, 2);
    expect(result.graph.status).toBe("complete");
    expect(f.peak()).toBe(["parallel", "mixed"].includes(topology) ? 2 : 1);
    for (const input of f.calls.filter(c => c.stage === "code")) expect(input.workDir.startsWith(f.root)).toBe(true);
  });

  it("binds explicit output root even if the model proposes another project name", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "seekbrain014-bound-")); dirs.push(cwd);
    process.env.SEEKBRAIN_RUN_ROOT = join(cwd, "specified");
    const workflow = new StudyWorkflow({ runAgent: async () => ({}) });
    const result = await workflow.start({ cwd, projectPath: "specified_project", request: "Analyze" });
    expect(result.project_dir).toBe(join(cwd, "specified"));
    const again = await workflow.start({ cwd, projectPath: "other", request: "Analyze" });
    expect(again.run_id).toBe(result.run_id); expect(again.reused).toBe(true);
  });

  it("honors an output path in plain text instead of an invented project suffix", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "seekbrain014-plain-root-")); dirs.push(cwd);
    const workflow = new StudyWorkflow({ runAgent: async () => ({}) });
    const result = await workflow.start({ cwd, projectPath: "Q1_project", request: 'Analyze the data. 输出目录："./Q1 outputs"' });
    expect(result.project_dir).toBe(join(cwd, "Q1 outputs"));
  });

  it("does not restart an interrupted validator automatically and explicitly resumes without recomputing", async () => {
    const f = await fixture([task("a")], async (stage, _input, attempt) => stage === "validation" && attempt === 1 ? { __agent: { ok: false, error: "Verification interrupted" } } : undefined);
    expect((await f.workflow.execute(f.run)).graph.tasks[0].status).toBe("failed");
    expect(f.counts.get("validation/a")).toBe(1);
    const interrupted = JSON.parse(await readFile(join(f.root, ".seekbrain/tasks/a/state.json"), "utf8"));
    expect(interrupted.execution.status).toBe("completed");
    expect(interrupted.validation.decision).toBe("unreviewed");
    expect(interrupted.verify_only).toBe(true);
    expect(await readFile(join(f.root, "measurements.tsv"), "utf8")).toContain("a\t2");
    expect((await f.workflow.execute(f.run)).graph.tasks[0].status).toBe("complete");
    expect(f.counts.get("code/a")).toBe(1); expect(f.counts.get("validation/a")).toBe(2);
  });

  it("revalidates changed results without automatically repeating the computation", async () => {
    const f = await fixture([task("a")]); await f.workflow.execute(f.run);
    await writeFile(join(f.root, "measurements.tsv"), "donor\tvalue\na\t3\n");
    await f.workflow.execute(f.run);
    expect(f.counts.get("code/a")).toBe(1); expect(f.counts.get("validation/a")).toBe(2);
  });

  it("recovers a moved project using relative output paths and no working-directory run registry", async () => {
    const f = await fixture([task("a")]); await f.workflow.execute(f.run);
    const moved = join(f.cwd, "moved"); await rename(f.root, moved);
    const workflow = new StudyWorkflow(f.workflow.dependencies);
    const run = await workflow.resolve("/tmp", { projectPath: moved });
    const evidence = await workflow.evidence(run);
    expect(evidence.evidence).toHaveLength(1); expect(evidence.output_root).toBe(moved);
    expect(evidence.evidence[0].outputs.every((a: any) => !a.path.startsWith("/"))).toBe(true);
  });

  it("does not invalidate scientific outputs when timestamps or execution logs change", async () => {
    const f = await fixture([task("a")], async (stage, input) => {
      if (stage === "code") await writeFile(join(input.workDir, "execution.log"), "operational log");
    }); await f.workflow.execute(f.run);
    await utimes(join(f.root, "measurements.tsv"), new Date(0), new Date(0));
    await writeFile(join(f.root, "execution.log"), "updated operational log");
    await rm(join(f.root, "execution.log"));
    expect((await f.workflow.evidence(f.run)).evidence).toHaveLength(1);
    await f.workflow.execute(f.run);
    expect(f.counts.get("validation/a")).toBe(1);
  });

  it("treats text results as evidence and excludes them if their content changes", async () => {
    const f = await fixture([task("a")], async (stage, input) => {
      if (stage === "code") await writeFile(join(input.workDir, "estimates.txt"), "donor-level estimate: 3\n");
    }); await f.workflow.execute(f.run);
    expect((await f.workflow.evidence(f.run)).evidence[0].outputs.map((a: any) => a.path)).toContain("estimates.txt");
    await writeFile(join(f.root, "estimates.txt"), "donor-level estimate: 99\n");
    expect((await f.workflow.evidence(f.run)).evidence[0].outputs.map((a: any) => a.path)).not.toContain("estimates.txt");
  });

  it("excludes only the changed numerical output instead of discarding the whole task", async () => {
    const f = await fixture([task("a")]); await f.workflow.execute(f.run);
    await writeFile(join(f.root, "measurements.tsv"), "donor\tvalue\na\t999\n");
    const evidence = await f.workflow.evidence(f.run);
    expect(evidence.evidence[0].outputs.map((a: any) => a.path)).not.toContain("measurements.tsv");
    expect(evidence.evidence[0].warnings.join(" ")).toContain("Content changed");
    expect(evidence.evidence[0].outputs.map((a: any) => a.path)).toContain("run_pilot.py");
  });

  it("continues usable upstream outputs after a partial scientific failure", async () => {
    const f = await fixture([task("pilot"), task("usable", ["pilot"], { inputs: [{ task_id: "pilot", role: "metadata" }] }), task("unavailable", ["pilot"], { inputs: [{ task_id: "pilot", role: "fractions" }] })], async (stage, input) => {
      if (stage === "validation" && input.run.state.task_id === "pilot") return { decision: "unusable", usable_paths: ["tasks/pilot/measurements.tsv"], issues: ["Fraction is unsupported"], limits: ["Use metadata only"] };
    });
    const result = await f.workflow.execute(f.run);
    expect(result.graph.tasks.map((t: any) => t.status)).toEqual(["partial", "complete", "skipped"]);
    expect((await f.workflow.evidence(f.run)).progress[0].validation.issues).toEqual(["Fraction is unsupported"]);
  });

  it("locally repairs actual science errors with a bounded retry", async () => {
    const f = await fixture([task("a")], async (stage, _input, attempt) => {
      if (stage === "validation" && attempt === 1) return { decision: "retry", issues: ["Wrong replicate unit"], repair: "Aggregate by donor" };
    });
    expect((await f.workflow.execute(f.run)).graph.tasks[0].status).toBe("complete");
    expect(f.counts.get("code/a")).toBe(2);
    expect(f.calls.filter(c => c.stage === "code")[1].prompt).toContain("Aggregate by donor");
  });

  it("retains invalid/unreviewed outputs for a progress report without endorsing them", async () => {
    const f = await fixture([task("bad"), task("independent")], async (stage, input) => {
      if (stage === "validation" && input.run.state.task_id === "bad") return { decision: "unusable", issues: ["Identity join is wrong"] };
    });
    await f.workflow.execute(f.run);
    const bundle = await f.workflow.evidence(f.run);
    expect(bundle.evidence.map((e: any) => e.evidence_id)).toEqual(["independent"]);
    expect(bundle.progress.find((e: any) => e.task_id === "bad").outputs.length).toBeGreaterThan(0);
    const report = await f.workflow.report(f.run);
    expect(report.report_path).toBe(join(f.root, "report.md"));
    expect((await readFile(report.pdf_path)).subarray(0, 5).toString()).toBe("%PDF-");
  });

  it("completes one report call with reference markers and a References heading without a format gate", async () => {
    const f = await fixture([task("a")], async (stage, input) => {
      if (stage !== "report") return;
      await writeFile(join(input.workDir, "report.md"), `# Donor study\n\n<!-- seekbrain:abstract -->\nWe measured donor values. The values differed across donors. These observations support a descriptive summary.\n\n<!-- seekbrain:main -->\n${Array(1000).fill("measurement").join(" ")} [1]\n\n<!-- seekbrain:references -->\n## References\n\n1. A consulted source.\n`);
      return { report_path: "report.md", mode: "scientific_report" };
    });
    await f.workflow.execute(f.run);
    const result = await f.workflow.report(f.run);
    expect(result.report_status).toBe("complete");
    expect(result.report_checks).toBeUndefined();
    expect(f.counts.get("report/parent")).toBe(1);
    await expect(readFile(join(result.evidence_path, "../checks.json"), "utf8")).rejects.toThrow();
    expect((await readFile(result.pdf_path)).subarray(0, 5).toString()).toBe("%PDF-");
  });

  it("invalidates the previous PDF before editing and retains Markdown when rendering fails", async () => {
    const f = await fixture([task("a")], async (stage, input) => {
      if (stage === "report") await expect(readFile(join(input.workDir, "report.pdf"))).rejects.toMatchObject({ code: "ENOENT" });
    });
    await f.workflow.execute(f.run);
    await writeFile(join(f.root, "report.pdf"), "Old PDF");
    f.run.state.report = { path: "report.md", pdf_path: "report.pdf", status: "complete" };
    vi.spyOn(pdfExporter, "exportReportPdf").mockImplementationOnce(async input => {
      await writeFile(input.pdfPath, "Incomplete PDF");
      return { ok: false, error: "Renderer failed" };
    });
    const result = await f.workflow.report(f.run);
    expect(result.report_status).toBe("draft"); expect(result.pdf_path).toBeUndefined();
    expect(await readFile(result.report_path, "utf8")).toContain("Observed donor measurements");
    await expect(readFile(join(f.root, "report.pdf"))).rejects.toMatchObject({ code: "ENOENT" });
    expect(f.counts.get("report/parent")).toBe(1);
    expect(f.run.state.report.pdf_path).toBeUndefined();
  });

  it("keeps independent work available when another task's verification is interrupted", async () => {
    const f = await fixture([task("a"), task("b")], async (stage, input) => stage === "validation" && input.run.state.task_id === "a" ? { __agent: { ok: false, error: "Connection closed" } } : undefined);
    const result = await f.workflow.execute(f.run);
    expect(result.graph.tasks.map((t: any) => t.status)).toEqual(["failed", "complete"]);
    expect(f.counts.get("validation/a")).toBe(1);
    expect((await f.workflow.evidence(f.run)).evidence.map((e: any) => e.evidence_id)).toEqual(["b"]);
  });

  it("recovers files on normal termination without finalize but does not treat cancellation as completion", async () => {
    const f = await fixture([task("a")], async (stage, input) => {
      if (stage !== "code") return;
      await writeFile(join(input.workDir, "result.csv"), "donor,value\na,3\n");
      return { __agent: { ok: false, normal_end: true, error: "Missing finalize" } };
    });
    expect((await f.workflow.execute(f.run)).graph.tasks[0].status).toBe("complete");
    const broken = await fixture([task("b")], async stage => stage === "code" ? { __agent: { ok: false, normal_end: false, error: "Cancelled" } } : undefined);
    expect((await broken.workflow.execute(broken.run)).graph.tasks[0].status).toBe("failed");
    expect(broken.counts.get("code/b")).toBe(1);
  });

  it("uses primitive pilot decisions without requiring statistics.json", async () => {
    const f = await fixture([task("pilot"), task("next", ["pilot"], { condition: { task_id: "pilot", key: "ready", equals: true } })], async (stage, input) => {
      if (stage === "code") { await writeFile(join(input.workDir, "cohort.tsv"), "donor\tn\na\t10\n"); return { decisions: { ready: true } }; }
    });
    expect((await f.workflow.execute(f.run)).graph.status).toBe("complete");
  });

  it("allows plan edits and re-formulates in place instead of requiring a new project", async () => {
    const tasks = [task("a")], f = await fixture(tasks); await f.workflow.execute(f.run);
    await writeFile(join(f.root, "plan.md"), "New comparison using existing donor data.");
    expect((await f.workflow.execute(f.run)).needs_formulation).toBe(true);
    tasks[0].instruction = "Updated analysis scope";
    const result = await f.workflow.formulate(f.run);
    expect(result.project_dir).toBe(f.root); expect(result.graph.tasks[0].status).toBe("pending");
  });

  it("rejects unsafe dependency graphs while allowing tasks without a validation template", () => {
    expect(() => checkTasks([{ ...task("a"), status: "pending" }] as Task[])).not.toThrow();
    for (const tasks of [[task("a", ["a"])], [task("a", ["missing"])], [task("a"), task("a")]]) expect(() => checkTasks(tasks as Task[])).toThrow();
  });
});
