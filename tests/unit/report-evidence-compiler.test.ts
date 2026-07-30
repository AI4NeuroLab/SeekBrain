import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { atomicWriteJson } from "../../src/core/index.ts";
import { ReportEvidenceCompiler } from "../../src/workflows/index.ts";

async function researchPlanningFixture() {
  const projectDir = await mkdtemp(join(tmpdir(), "seekbrain-rp-report-"));
  const planningDir = join(projectDir, "planning");
  const planDir = join(planningDir, "research_plan");
  const taskProjectDir = join(projectDir, "research_tasks", "SQ1-T1");
  const taskRunDir = join(taskProjectDir, "round1");
  const taskRunDir2 = join(taskProjectDir, "round2");
  await mkdir(planDir, { recursive: true });
  await mkdir(taskRunDir, { recursive: true });
  await mkdir(taskRunDir2, { recursive: true });
  const planPath = join(planDir, "research_plan.json");
  const plan = {
    research_goal: "Test one integrated effect.",
    synthesis_strategy: "Use SQ1 to answer the goal.",
    subquestions: [{
      id: "SQ1", question: "Does the effect exist?", hypothesis: "The effect exists.", role_in_overall_conclusion: "Primary evidence",
      tasks: [{ id: "SQ1-T1", analysis_question: "Estimate the effect.", biological_hypothesis: "Positive effect.", expected_evidence: "Effect estimate.", supports_conclusion_if: "Positive.", contradicts_conclusion_if: "Null." }],
    }],
  };
  await atomicWriteJson(planPath, plan);
  await writeFile(join(taskRunDir, "plan.md"), "# Plan");
  await writeFile(join(taskRunDir, "figure.png"), "PNG");
  await writeFile(join(taskRunDir, "figure.pdf"), "%PDF");
  await writeFile(join(taskRunDir, "table.csv"), "metric,value\neffect,0.5\n");
  await atomicWriteJson(join(taskRunDir, "statistics.json"), { effect: 0.5, samples: Array.from({ length: 20 }, (_, index) => index) });
  await atomicWriteJson(join(taskRunDir, "validation.json"), { pass: true, summary: "Validated", figure_observations: ["Positive effect"], methodological_caveats: [] });
  await atomicWriteJson(join(taskRunDir, "conclusions.json"), { summary: "Effect 0.5", conclusions: ["Positive effect"], limitations: [] });
  await atomicWriteJson(join(taskRunDir, "state.json"), {
    schema_version: 2, run_id: "task-run", run_dir: taskRunDir, question: "Estimate the effect.",
    parent_run_dir: planningDir, inherited_context: { parent_run_dir: planningDir },
    plan: { path: join(taskRunDir, "plan.md"), review_summary: "Estimate effect 0.5." },
    validation: { pass: true, path: join(taskRunDir, "validation.json"), summary: "Validated", figure_observations: ["Positive effect"] },
    conclusions: { path: join(taskRunDir, "conclusions.json"), summary: "Effect 0.5" },
    artifacts: [
      { path: "figure.png", kind: "figure", role: "main", description: "Effect plot" },
      { path: "figure.pdf", kind: "figure", role: "main_pdf", description: "Vector effect plot" },
      { path: "table.csv", kind: "table", description: "Effect table" },
      { path: "statistics.json", kind: "statistics" },
    ],
  });
  await writeFile(join(taskRunDir2, "plan.md"), "# Revised Plan");
  await writeFile(join(taskRunDir2, "figure.png"), "PNG2");
  await writeFile(join(taskRunDir2, "statistics.json"), JSON.stringify({ effect: 0.6 }));
  await atomicWriteJson(join(taskRunDir2, "validation.json"), { pass: true, summary: "Validated revision" });
  await atomicWriteJson(join(taskRunDir2, "conclusions.json"), { summary: "Effect 0.6", conclusions: ["Positive revised effect"], limitations: [] });
  await atomicWriteJson(join(taskRunDir2, "state.json"), {
    schema_version: 2, run_id: "task-run-2", run_dir: taskRunDir2, question: "Estimate the revised effect.",
    parent_run_dir: planningDir, inherited_context: { parent_run_dir: planningDir },
    plan: { path: join(taskRunDir2, "plan.md"), review_summary: "Estimate revised effect 0.6." },
    validation: { pass: true, path: join(taskRunDir2, "validation.json"), summary: "Validated revision" },
    conclusions: { path: join(taskRunDir2, "conclusions.json"), summary: "Effect 0.6" },
    artifacts: [{ path: "figure.png", kind: "figure", role: "main", description: "Revised effect plot" }, { path: "statistics.json", kind: "statistics" }],
  });
  await atomicWriteJson(join(taskProjectDir, "project.json"), {
    schema_version: 1, project_id: "SQ1-T1", project_dir: taskProjectDir,
    rounds: [
      { round_number: 1, run_id: "task-run", run_dir: taskRunDir, status: "concluded", conclusions_path: join(taskRunDir, "conclusions.json") },
      { round_number: 2, run_id: "task-run-2", run_dir: taskRunDir2, status: "concluded", conclusions_path: join(taskRunDir2, "conclusions.json") },
    ],
  });
  const planningStatePath = join(planningDir, "state.json");
  await atomicWriteJson(planningStatePath, {
    schema_version: 2, run_id: "planning-run", run_dir: planningDir, question: "Test one integrated effect.", project_dir: projectDir,
    research_planning: {
      status: "tasks_complete", research_plan_path: planPath,
      survey: { literature_grounding_context: "Background", sources: [{ source_id: "S1", title: "Source" }] },
      task_runs: [{ task_id: "SQ1-T1", subquestion_id: "SQ1", task_project_dir: taskProjectDir, task_project_manifest_path: join(taskProjectDir, "project.json"), run_id: "task-run-2", run_dir: taskRunDir2, status: "complete", plan_summary: "Estimate revised effect 0.6." }],
    },
    research_execution: { status: "complete" },
  });
  await atomicWriteJson(join(projectDir, "project.json"), {
    schema_version: 1, project_id: "rp-project", project_dir: projectDir,
    planning_run: { run_id: "planning-run", run_dir: planningDir, state_path: planningStatePath },
    rounds: [], research_tasks: [{ task_id: "SQ1-T1", subquestion_id: "SQ1", project_dir: join(projectDir, "research_tasks", "SQ1-T1") }],
  });
  return { projectDir, planningDir, taskProjectDir, taskRunDir, taskRunDir2 };
}

describe("ReportEvidenceCompiler", () => {
  it("compiles the complete Research Planning tree into one traceable hierarchical evidence file", async () => {
    const fixture = await researchPlanningFixture();
    try {
      const compiler = new ReportEvidenceCompiler({ writeJson: atomicWriteJson });
      await expect(compiler.catalog(fixture.projectDir)).resolves.toMatchObject({ available: true, task_count: 1, eligible_round_count: 2, recommended_evidence_ids: ["SQ1-T1:R2"] });
      const result = await compiler.compile({ projectPath: fixture.projectDir, selectedEvidenceIds: ["SQ1-T1:R1"] });
      expect(result).toMatchObject({ ok: true, task_count: 1, round_count: 1, subquestion_count: 1, figure_count: 1, table_count: 1, report_scope: "complete" });
      const hierarchy = JSON.parse(await readFile(result.hierarchical_evidence_path, "utf8"));
      expect(hierarchy.kind).toBe("research_planning_hierarchical_evidence");
      expect(hierarchy.plan_evidence[0]).toMatchObject({ evidence_id: "SQ1-T1:R1", task_id: "SQ1-T1", round_number: 1, subquestion_id: "SQ1", summary: "Effect 0.5", figure_ids: ["SQ1-T1:R1:F1"], table_ids: ["SQ1-T1:R1:T1"] });
      expect(hierarchy.plan_evidence[0].supporting_statistics.samples).toMatchObject({ count: 20 });
      expect(hierarchy.figures[0].relative_path).toBe("assets/figure-001.png");
      expect(hierarchy.figures[0].supplemental_assets[0].relative_path).toBe("assets/figure-001.pdf");
      expect(hierarchy.tables[0].source_path).toBe(join(fixture.taskRunDir, "table.csv"));
    } finally {
      await rm(fixture.projectDir, { recursive: true, force: true });
    }
  });

  it("allows multiple selected rounds from the same task without counting them as separate tasks", async () => {
    const fixture = await researchPlanningFixture();
    try {
      const compiler = new ReportEvidenceCompiler({ writeJson: atomicWriteJson });
      const result = await compiler.compile({ projectPath: fixture.projectDir, selectedEvidenceIds: ["SQ1-T1:R1", "SQ1-T1:R2"] });
      expect(result).toMatchObject({ task_count: 1, round_count: 2, report_scope: "complete", selected_evidence_ids: ["SQ1-T1:R1", "SQ1-T1:R2"] });
      const hierarchy = JSON.parse(await readFile(result.hierarchical_evidence_path, "utf8"));
      expect(hierarchy.plan_evidence.map((item: any) => item.evidence_id)).toEqual(["SQ1-T1:R1", "SQ1-T1:R2"]);
      expect(hierarchy.selection).toMatchObject({ selected_task_count: 1, selected_round_count: 2, report_scope: "complete" });
    } finally {
      await rm(fixture.projectDir, { recursive: true, force: true });
    }
  });

  it("resolves the canonical parent from planning, task, round, and nested artifact paths", async () => {
    const fixture = await researchPlanningFixture();
    const nestedReportDir = join(fixture.projectDir, "reports", "report-test", "assets");
    const nestedTaskDir = join(fixture.taskRunDir2, "_snapshots", "after-validation");
    try {
      await mkdir(nestedReportDir, { recursive: true });
      await mkdir(nestedTaskDir, { recursive: true });
      const compiler = new ReportEvidenceCompiler({ writeJson: atomicWriteJson });
      for (const path of [fixture.planningDir, fixture.taskProjectDir, fixture.taskRunDir2, nestedTaskDir, nestedReportDir]) {
        await expect(compiler.catalog(path)).resolves.toMatchObject({
          available: true,
          project_dir: fixture.projectDir,
          eligible_evidence_ids: ["SQ1-T1:R1", "SQ1-T1:R2"],
        });
      }
    } finally {
      await rm(fixture.projectDir, { recursive: true, force: true });
    }
  });

  it("rejects standard projects instead of flattening normal rounds into a report", async () => {
    const projectDir = await mkdtemp(join(tmpdir(), "seekbrain-standard-report-"));
    try {
      await atomicWriteJson(join(projectDir, "project.json"), { schema_version: 1, project_id: "standard", rounds: [] });
      const compiler = new ReportEvidenceCompiler({ writeJson: atomicWriteJson });
      await expect(compiler.readiness(projectDir)).rejects.toThrow(/Unable to resolve a Research Planning parent project/);
    } finally {
      await rm(projectDir, { recursive: true, force: true });
    }
  });
});
