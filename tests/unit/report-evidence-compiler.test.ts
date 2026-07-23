import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { atomicWriteJson } from "../../src/core/index.ts";
import { ReportEvidenceCompiler } from "../../src/workflows/index.ts";

async function completedRound(runDir: string, runId: string, marker: string, inheritedContext: any = {}) {
  await mkdir(runDir, { recursive: true });
  await writeFile(join(runDir, "plan.md"), `# Plan\n${marker}`);
  await writeFile(join(runDir, "figure.png"), marker);
  await writeFile(join(runDir, "figure.pdf"), `${marker} PDF`);
  await atomicWriteJson(join(runDir, "validation.json"), { pass: true, summary: `${marker} validated`, methodological_caveats: [] });
  await atomicWriteJson(join(runDir, "interpretation.json"), { summary: `${marker} interpreted`, conclusions: [`${marker} conclusion`], limitations: [], confidence: 0.9 });
  await atomicWriteJson(join(runDir, "statistics.json"), { marker });
  await atomicWriteJson(join(runDir, "state.json"), {
    schema_version: 2,
    run_id: runId,
    run_dir: runDir,
    question: `${marker} question`,
    inherited_context: inheritedContext,
    plan: { summary: `${marker} plan` },
    interpretation: { summary: `${marker} interpreted` },
    artifacts: [
      { path: "figure.png", kind: "figure", role: "main", description: marker },
      { path: "figure.pdf", kind: "figure", role: "main_pdf", description: `${marker} vector` },
      { path: "statistics.json", kind: "statistics" },
    ],
  });
}

describe("ReportEvidenceCompiler", () => {
  it("compiles only explicitly selected normal and task rounds and snapshots selected figures", async () => {
    const projectDir = await mkdtemp(join(tmpdir(), "seekbrain-report-evidence-"));
    try {
      const round1 = join(projectDir, "round1");
      const round2 = join(projectDir, "round2");
      const taskDir = join(projectDir, "research_tasks", "SQ1-T1");
      const taskRound = join(taskDir, "round1");
      await completedRound(round1, "normal-1", "UNSELECTED_SENTINEL");
      await completedRound(round2, "normal-2", "SELECTED_NORMAL");
      await completedRound(taskRound, "task-1", "SELECTED_TASK", {
        research_goal: "overall goal",
        subquestion: { question: "subquestion" },
        task: { title: "task title", biological_hypothesis: "task hypothesis" },
      });
      await atomicWriteJson(join(taskDir, "project.json"), {
        schema_version: 1,
        project_id: "task-project",
        rounds: [{ round_number: 1, run_id: "task-1", run_dir: taskRound, status: "concluded" }],
      });
      await atomicWriteJson(join(projectDir, "project.json"), {
        schema_version: 1,
        project_id: "parent-project",
        rounds: [
          { round_number: 1, run_id: "normal-1", run_dir: round1, status: "concluded" },
          { round_number: 2, run_id: "normal-2", run_dir: round2, status: "concluded" },
        ],
        research_tasks: [{ task_id: "SQ1-T1", project_dir: taskDir, project_manifest_path: join(taskDir, "project.json") }],
      });

      const compiler = new ReportEvidenceCompiler({ writeJson: atomicWriteJson });
      const result = await compiler.compile({
        projectPath: projectDir,
        selectedEvidence: ["ROUND:2", "SQ1-T1:R1"],
        reportGoal: "Compare the selected results.",
      });
      expect(result).toMatchObject({ ok: true, selected_count: 2, figure_count: 2 });
      const selection = JSON.parse(await readFile(result.selection_path, "utf8"));
      const bundleText = await readFile(result.evidence_bundle_path, "utf8");
      const bundle = JSON.parse(bundleText);
      expect(selection.selected_evidence.map((item: any) => item.evidence_id)).toEqual(["ROUND:2", "SQ1-T1:R1"]);
      expect(bundle.evidence.map((item: any) => item.evidence_id)).toEqual(["ROUND:2", "SQ1-T1:R1"]);
      expect(bundleText).not.toContain("UNSELECTED_SENTINEL");
      expect(bundle.evidence[1].scientific_context.biological_hypothesis).toBe("task hypothesis");
      expect(bundle.evidence.flatMap((item: any) => item.figures).map((item: any) => item.figure_number)).toEqual([1, 2]);
      expect(bundle.evidence.flatMap((item: any) => item.figures).every((item: any) => item.asset_path.endsWith(".png"))).toBe(true);
      expect(bundle.evidence.flatMap((item: any) => item.figures).every((item: any) => item.supplemental_assets[0].asset_path.endsWith(".pdf"))).toBe(true);
      expect(bundleText).not.toContain('"markdown"');
      for (const figure of bundle.evidence.flatMap((item: any) => item.figures)) expect(await readFile(figure.asset_path, "utf8")).toContain("SELECTED");
    } finally {
      await rm(projectDir, { recursive: true, force: true });
    }
  });

  it("rejects duplicate, malformed, and incomplete selections", async () => {
    const projectDir = await mkdtemp(join(tmpdir(), "seekbrain-report-invalid-"));
    try {
      const roundDir = join(projectDir, "round1");
      await mkdir(roundDir, { recursive: true });
      await atomicWriteJson(join(roundDir, "state.json"), { schema_version: 2, run_id: "r1", run_dir: roundDir, artifacts: [] });
      await atomicWriteJson(join(projectDir, "project.json"), {
        schema_version: 1, project_id: "p", rounds: [{ round_number: 1, run_id: "r1", run_dir: roundDir, status: "active" }],
      });
      const compiler = new ReportEvidenceCompiler({ writeJson: atomicWriteJson });
      await expect(compiler.compile({ projectPath: projectDir, selectedEvidence: ["ROUND:1", "R1"] })).rejects.toThrow(/unique/);
      await expect(compiler.compile({ projectPath: projectDir, selectedEvidence: ["bad"] })).rejects.toThrow(/Invalid evidence selector/);
      await expect(compiler.compile({ projectPath: projectDir, selectedEvidence: ["ROUND:1"] })).rejects.toThrow(/not complete/);
    } finally {
      await rm(projectDir, { recursive: true, force: true });
    }
  });
});
