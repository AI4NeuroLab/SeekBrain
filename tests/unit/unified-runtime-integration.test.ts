import { Value } from "typebox/value";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it, vi } from "vitest";
import { createBashTool, createReadTool } from "@earendil-works/pi-coding-agent";
import { FileRunRepository, atomicWriteJson } from "../../src/core/index.ts";
import { RunLifecycleWorkflow } from "../../src/workflows/index.ts";
import { createRuntimeServices } from "../../src/extension/runtime/create-runtime-services.ts";
import { PubMedRetriever, SemanticScholarRetriever } from "../../src/literature-compat/index.ts";
import { createUnifiedStudyTools } from "../../src/extension/runtime/stages/unified-study-tools.ts";

// Real runtime composition, existing Code/Validate workflows and local computation.
// Only model responses are simulated; no network/provider calls are made.
describe("unified runtime integration", () => {
  it.each((["ailab_rag", "pubmed", "semantic_scholar"] as const).flatMap(provider => [true, false].map(web_search => ({ provider, web_search }))))("shares literature tools independently of web access ($provider, web=$web_search)", async ({ provider, web_search }) => {
    const cwd = await mkdtemp(join(tmpdir(), "seekbrain-plan-literature-"));
    const fullText = "# Abstract\nDevelopmental evidence.\n\n# Methods\nDonor-level comparisons.";
    await writeFile(join(cwd, "observations.csv"), "donor,value\na,2\nb,4\n");
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async () => new Response(JSON.stringify([
      { track_id: "planning-paper", title: "Developmental study", full_text: fullText },
    ]), { status: 200, headers: { "content-type": "application/json" } }));
    const paperId = `${provider}:planning-paper`;
    const external = provider === "ailab_rag" ? undefined : vi.spyOn(provider === "pubmed" ? PubMedRetriever.prototype : SemanticScholarRetriever.prototype, "query").mockResolvedValue({
      ok: true, papers: [{ provider, providerId: "planning-paper", title: "Developmental study", abstract: "Developmental evidence.",
        fullText, authors: ["A. Author"], doi: "10.123/development", repositoryCandidates: [] }],
    });
    try {
      const lifecycle = new RunLifecycleWorkflow(new FileRunRepository());
      const services = createRuntimeServices({
        pi: { appendEntry: async () => {} } as any,
        session: { setActiveRunDir() {} } as any,
        packageRoot: process.cwd(), projectRoot: cwd, runLifecycle: lifecycle, literatureCacheDir: join(cwd, "cache"),
        loadConfig: async () => ({ agents: {}, paths: {}, workflow: { seekbrain: { web_search, report: { pdf: { enabled: false, command: "/missing-renderer", timeout_seconds: 5 } } } }, literature: {
          paper_source: provider, providers: { ailab_rag: { base_url: "http://rag.example" } },
        } }),
        workflowConfig: () => ({}), pickAgentConfig: () => ({}), literatureAgentConfig: () => ({}),
        humanGateEnabled: () => false,
        readPrompt: name => readFile(join(process.cwd(), "prompts", `${name}.md`), "utf8"),
        resolveRun: (workingDir, id) => lifecycle.resolveRun(workingDir, id),
        snapshotRunArtifacts: async () => undefined, appendStateEntry: async () => {}, summarize: x => x,
        reportFinalizeSchema: () => ({}),
        runSubagent: async (input: any) => {
          if (["finalize_scientific_plan", "finalize_study_report"].includes(input.finalizeTool)) {
            const names = input.customTools.map((tool: any) => tool.name);
            for (const name of ["web_search", "fetch_content", "get_search_content"]) expect(names.includes(name)).toBe(web_search);
            expect(names).toEqual(expect.arrayContaining(["seekbrain_literature_search", "seekbrain_paper_read"]));
          }
          if (input.finalizeTool === "finalize_formulation") return { ok: true, result: { tasks: [
            { id: "compare", instruction: "Compare donor developmental measurements.", depends_on: [] },
          ] } };
          if (input.finalizeTool === "finalize_study_report") {
            const read = input.customTools.find((tool: any) => tool.name === "seekbrain_paper_read");
            const paper = JSON.parse((await read.execute("report-read", { paper_id: paperId })).content[0].text);
            expect(paper.full_text).toBe(fullText);
            await writeFile(join(input.workDir, "report.md"), "Planning progress supported by Developmental study.");
            return { ok: true, result: { report_path: "report.md", mode: "progress_report" } };
          }
          expect(input.finalizeTool).toBe("finalize_scientific_plan");
          expect(input.skillPaths).toEqual([join(process.cwd(), "skills", "plan")]);
          const skillPath = join(input.skillPaths[0], "plan-genetic-molecular", "SKILL.md");
          await input.beforeToolCall({ toolName: "read", args: { path: skillPath } });
          const skill = await createReadTool(input.workDir).execute("plan-skill", { path: skillPath });
          expect(JSON.stringify(skill.content)).toContain("Single-cell RNA sequencing");
          expect(JSON.stringify(skill.content)).toContain("not a textbook excerpt");
          expect(JSON.stringify(skill.content)).not.toContain("references/14.13.md");
          expect(input.customTools.filter((tool: any) => tool.name.startsWith("seekbrain_")).map((tool: any) => tool.name)).toEqual([
            "seekbrain_literature_search", "seekbrain_paper_read",
          ]);
          for (const toolName of ["seekbrain_recipe_search_local", "seekbrain_recipe_search_rag", "seekbrain_recipe_generate_from_rag"]) {
            await expect(input.beforeToolCall({ toolName, args: {} })).rejects.toThrow("unavailable");
          }
          expect(input.tools).toContain("bash");
          const command = `python3 -c 'import csv, json; rows = list(csv.DictReader(open("../observations.csv"))); print(json.dumps({"donors": [r["donor"] for r in rows]}))'`;
          await input.beforeToolCall({ toolName: "bash", args: { command } });
          const preview = await createBashTool(input.workDir).execute("inspect", { command });
          expect(preview.content.filter(part => part.type === "text").map(part => part.text).join("\n")).toContain('"donors": ["a", "b"]');
          expect(await readFile(join(cwd, "observations.csv"), "utf8")).toBe("donor,value\na,2\nb,4\n");
          expect(input.prompt).not.toContain("Use seekbrain_literature_search");
          const search = input.customTools.find((tool: any) => tool.name === "seekbrain_literature_search");
          const read = input.customTools.find((tool: any) => tool.name === "seekbrain_paper_read");
          expect(search.promptGuidelines.join(" ")).toContain("Follow up with seekbrain_paper_read");
          const found = { papers: [{ paper_id: paperId }] };
          await input.beforeToolCall({ toolName: read.name, args: { paper_id: found.papers[0].paper_id } });
          const paper = JSON.parse((await read.execute("read", { paper_id: found.papers[0].paper_id })).content[0].text);
          expect(paper.full_text).toBe(fullText);
          const path = join(input.workDir, "plan.md");
          await writeFile(path, "Compare donor-level developmental measurements.");
          return { ok: true, result: { plan_paths: [path] } };
        },
      });
      const [search] = services.literatureTools();
      const searchResult: any = await search.execute("main-search", { query: "neural development" });
      const found = JSON.parse(searchResult.content[0].text);
      expect(found.papers).toEqual([expect.objectContaining({ paper_id: paperId })]);
      const started = await services.studyWorkflow.start({ cwd, projectPath: "study", request: "Plan a developmental comparison." });
      const run = await services.studyWorkflow.resolve(cwd, { runId: started.run_id });
      await services.studyWorkflow.plan(run);
      await services.studyWorkflow.formulate(run);
      const report = await services.studyWorkflow.report(run, undefined, undefined, undefined, { output_formats: ["markdown", "pdf"] });
      expect(report.pdf_export.skipped).toBe(true); expect(report.pdf_path).toBeUndefined();
      expect(run.state.report.formats).toEqual(["markdown"]);
      expect(await readFile(join(cwd, "study", "report.md"), "utf8")).toContain("Developmental study");
      if (provider === "ailab_rag") expect(fetchMock).toHaveBeenCalledOnce();
      else {
        expect(fetchMock).not.toHaveBeenCalled();
        expect(external).toHaveBeenCalledOnce();
        expect(external).toHaveBeenCalledWith(expect.objectContaining({ include_papers: true, require_github: false, paper_source: provider }), cwd, undefined);
      }
      expect(await readFile(join(cwd, "study", "plan.md"), "utf8")).toContain("donor-level");
    } finally {
      fetchMock.mockRestore();
      external?.mockRestore();
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it.each([false, true])("executes preparation, dependency consumption, bounded repair (%s), result manifests and report through public tools", async (repair) => {
    const cwd = await mkdtemp(join(tmpdir(), "seekbrain014-runtime-"));
    try {
      await mkdir(join(cwd, "References"));
      await writeFile(join(cwd, "References", "protocol.md"), "Compute donor-level measurements, not cell-level pseudoreplicates.");
      await writeFile(join(cwd, "observations.csv"), "donor,value\na,2\nb,4\nc,6\nd,8\n");
      const lifecycle = new RunLifecycleWorkflow(new FileRunRepository());
      const calls: string[] = [];
      let activeRunDir = "";
      let prepareAttempts = 0;
      const services = createRuntimeServices({
        pi: { appendEntry: async () => {} } as any,
        session: { setActiveRunDir: (path: string) => { activeRunDir = path; } } as any,
        packageRoot: process.cwd(), projectRoot: cwd, runLifecycle: lifecycle, literatureCacheDir: join(cwd, "cache"),
        loadConfig: async () => ({ agents: { seekbrain_plan: {}, seekbrain_formulation: {}, seekbrain_report: {} }, paths: {}, literature: { providers: {} } }),
        workflowConfig: () => ({ image_refine: false }), pickAgentConfig: () => ({ vision: true, timeout_seconds: 300 }),
        literatureAgentConfig: () => ({ vision: true, rag: { paper_source: "none" } }),
        humanGateEnabled: () => true, // v014 must bypass the old Plan approval gate
        readPrompt: name => readFile(join(process.cwd(), "prompts", `${name}.md`), "utf8"),
        resolveRun: (workingDir, id) => lifecycle.resolveRun(workingDir, id),
        snapshotRunArtifacts: async () => undefined, appendStateEntry: async () => {}, summarize: x => x, reportFinalizeSchema: () => ({}),
        runSubagent: async (input: any) => {
          const response = await (async () => {
          calls.push(input.finalizeTool);
          const names = (input.customTools || []).map((tool: any) => tool.name);
          for (const name of ["web_search", "fetch_content", "get_search_content"]) {
            if (["finalize_scientific_plan", "finalize_study_report"].includes(input.finalizeTool)) expect(names).toContain(name);
            else expect(names).not.toContain(name);
          }
          if (["finalize_code_result", "finalize_validation"].includes(input.finalizeTool)) expect(input.agentConfig.timeout_seconds).toBe(0);
          else expect(input.agentConfig.timeout_seconds).toBe(300);
          if (input.finalizeTool === "finalize_scientific_plan") {
            expect(input.customTools.map((t: any) => t.name)).toContain("seekbrain_literature_search");
            expect(input.tools).toEqual(expect.arrayContaining(["read", "bash"]));
            expect(input.customTools.map((t: any) => t.name)).toEqual(expect.arrayContaining(["write", "edit"]));
            await input.beforeToolCall({ toolName: "bash", args: { command: "pwd" } });
            await expect(input.beforeToolCall({ toolName: "seekbrain_execution_run", args: {} })).rejects.toThrow("unavailable");
            await expect(input.beforeToolCall({ toolName: "write", args: { path: "source.txt" } })).rejects.toThrow("outside");
            const reference = await createReadTool(cwd).execute("read", { path: join(cwd, "References", "protocol.md") });
            expect(JSON.stringify(reference.content)).toContain("donor-level");
            await writeFile(join(input.workDir, "plan.md"), "Prepare actual donor measurements and verify their mean.");
            return { ok: true, result: { plan_path: "plan.md" } };
          }
          if (input.finalizeTool === "finalize_formulation") return { ok: true, result: { tasks: [
            { id: "prepare", instruction: `Read ${join(cwd, "observations.csv")} and summarize actual donor values.`, depends_on: [] },
            { id: "analyze", instruction: "Consume validated preparation output, then verify the mean.", depends_on: ["prepare"],
              checks: ["Verify the mean equals the observed donor mean"] },
          ] } };
          if (input.finalizeTool === "finalize_code_result") {
            expect(input.prompt).not.toContain("Execution contract");
            const isPreparation = input.runDir.includes("prepare");
            const erroneousFirstAttempt = repair && isPreparation && ++prepareAttempts === 1;
            const script = isPreparation
              ? `import csv, json, statistics\nwith open(${JSON.stringify(join(cwd, "observations.csv"))}) as f:\n    values = [float(row['value']) for row in csv.DictReader(f)]\nwith open('statistics.json', 'w') as f:\n    json.dump({'n_samples': len(values), 'estimate': statistics.mean(values)${erroneousFirstAttempt ? " / 2" : ""}}, f)\n`
              : `import json, base64\nwith open(${JSON.stringify(join(cwd, "study", "tasks", "prepare", "statistics.json"))}) as f:\n    prepared = json.load(f)\nassert prepared['n_samples'] == 4\nwith open('statistics.json', 'w') as f:\n    json.dump(prepared, f)\nwith open('summary.png', 'wb') as f:\n    f.write(base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAEAAAAAgCAIAAAAt/+nTAAAAQElEQVR4nO3PQQ0AIBDAMMC/50MEj4ZkVbDtmVk/OzrgVQNaA1oDWgNaA1oDWgNaA1oDWgNaA1oDWgNaA1oD2gUyKwM953EnbgAAAABJRU5ErkJggg=='))\n`;
            await writeFile(join(input.workDir, "analysis.py"), script);
            await createBashTool(input.workDir).execute("compute", { command: "python3 analysis.py" });
            return { ok: true, result: { outputs: [{ path: "analysis.py" }, { path: "statistics.json" }], summary: "Computed donor mean", warnings: [] } };
          }
          if (input.finalizeTool === "finalize_validation") {
            expect(input.prompt).toContain("Actual output inventory");
            const statistics = JSON.parse(await readFile(join(input.workDir, "statistics.json"), "utf8"));
            if (repair && statistics.estimate !== 5) return { ok: true, result: { decision: "retry", issues: ["Incorrect mean"], repair: "Recompute without dividing by two" } };
            expect(statistics).toEqual({ n_samples: 4, estimate: 5 });
            return { ok: true, result: { decision: "accepted" } };
          }
          if (input.finalizeTool === "finalize_study_report") {
            expect(input.prompt).toContain("no headings");
            expect(input.skillPaths).toEqual([join(process.cwd(), "skills", "report")]);
            const reader = createReadTool(input.workDir);
            const skillPath = join(input.skillPaths[0], "report-purves-neuroscience", "SKILL.md");
            const skill = await reader.execute("skill", { path: skillPath });
            expect(JSON.stringify(skill.content)).toContain("Interpretation focus");
            await input.afterToolCall({ toolName: "read", args: { path: skillPath }, content: skill.content, isError: false });
            const evidence = JSON.parse(await readFile(join(input.runDir, "evidence.json"), "utf8"));
            const imagePath = evidence.evidence.find((e: any) => e.evidence_id === "analyze").outputs.find((a: any) => a.kind === "figure").path;
            const actualImagePath = join(input.workDir, imagePath);
            const image = await reader.execute("image", { path: actualImagePath });
            expect(image.content.some((part: any) => part.type === "image")).toBe(true);
            await input.afterToolCall({ toolName: "read", args: { path: actualImagePath }, content: image.content, isError: false });
            await writeFile(join(input.workDir, "report.md"), `# Donor measurements\n\nThe four-donor measurement mean was 5. This is a technical result. No biological mechanism was tested.\n\n![Technical figure](${imagePath})\n`);
            return { ok: true, result: { report_path: "report.md", mode: "scientific_report" } };
          }
          throw new Error(`Unexpected model stage ${input.finalizeTool}`);
          })();
          expect(Value.Check(input.finalizeSchema, response.result), `Model finalizer contract: ${input.finalizeTool}`).toBe(true);
          return response;
        },
      });
      const tools = createUnifiedStudyTools({ workflow: services.studyWorkflow, setActiveRunDir: path => { activeRunDir = path; }, content: x => x });
      const ctx = { cwd, sessionManager: { getBranch: () => [{ type: "message", id: "study-request", message: { role: "user", content: "Analyze donor measurements. Relevant material: ./References. Report with no headings." } }] } };
      const invoke = (name: string, params: any): Promise<any> => tools.find(t => t.name === name)!.execute(name, params, undefined, undefined, ctx as any) as any;
      const start = await invoke("seekbrain_research_start", { project_dir: "study", dataset_paths: ["./observations.csv"], reference_paths: ["./References"] });
      await invoke("seekbrain_plan_generate", { run_id: start.run_id });
      await invoke("seekbrain_formulation_generate", { run_id: start.run_id });
      const execution = await invoke("seekbrain_execution_run", { run_id: start.run_id });
      expect(execution.graph.tasks[0].reason).toBeUndefined();
      expect(execution.graph.tasks.map((t: any) => ({ id: t.id, status: t.status }))).toEqual([{ id: "prepare", status: "complete" }, { id: "analyze", status: "complete" }]);
      const graphPath = join(cwd, "study", ".seekbrain", "tasks.json");
      const graph = JSON.parse(await readFile(graphPath, "utf8"));
      graph.tasks[1].status = "complete"; graph.status = "running";
      await atomicWriteJson(graphPath, graph);
      const recovered = await invoke("seekbrain_execution_run", { project_path: "study" });
      expect(recovered.graph.status).toBe("complete");
      const report = await invoke("seekbrain_report_generate", { project_path: "study" });
      expect(report.partial).toBe(false); expect(await readFile(report.report_path, "utf8")).toContain("mean was 5");
      expect(report.report_status).toBe("complete");
      expect(report.report_checks).toBeUndefined();
      expect(calls.filter(t => t === "finalize_study_report")).toHaveLength(1);
      expect(calls.filter(t => t === "finalize_scientific_plan")).toHaveLength(1);
      expect(calls.filter(t => t === "finalize_code_result")).toHaveLength(repair ? 3 : 2);
      expect(calls.filter(t => t === "finalize_validation")).toHaveLength(repair ? 3 : 2);
      expect(calls.filter(t => t === "finalize_interpretation")).toHaveLength(0);
      expect(report.pdf_path).toBeTruthy();
      expect((await readFile(report.pdf_path)).subarray(0, 5).toString()).toBe("%PDF-");
      expect((await readFile(report.pdf_path)).toString("latin1")).toContain("/Subtype /Image");
      const usage = JSON.parse(await readFile(join(dirname(report.evidence_path), "resource_usage.json"), "utf8"));
      expect(usage.skills_read).toEqual([join(process.cwd(), "skills", "report", "report-purves-neuroscience", "SKILL.md")]);
      expect(usage.images_read).toHaveLength(1);
      for (const t of graph.tasks) {
        const child = JSON.parse(await readFile(join(cwd, "study", ".seekbrain", "tasks", t.id, "state.json"), "utf8"));
        expect(child.validation.decision).toBe("accepted");
        expect(child.execution.status).toBe("completed");
        expect(child.execution_contract).toBeUndefined();
      }
      expect(activeRunDir).toBe(join(cwd, "study", ".seekbrain"));
    } finally { await rm(cwd, { recursive: true, force: true }); }
  });
});
