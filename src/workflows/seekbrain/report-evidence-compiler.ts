import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { copyFile, mkdir, readFile } from "node:fs/promises";
import { basename, dirname, extname, join, resolve } from "node:path";
import type { WorkflowJson } from "./run-lifecycle.ts";

export interface ReportEvidenceCompilerDependencies {
  writeJson(path: string, value: WorkflowJson): Promise<void>;
}

export interface CompileReportEvidenceInput {
  projectPath: string;
  reportGoal?: string;
  selectedEvidenceIds?: string[];
}

interface ResearchPlanningProject {
  projectDir: string;
  manifestPath: string;
  manifest: WorkflowJson;
  planningStatePath: string;
  planningState: WorkflowJson;
  planPath: string;
  plan: WorkflowJson;
}

function timestamp(): string {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}

async function readJson(path: string, required = false): Promise<WorkflowJson> {
  try {
    return JSON.parse(await readFile(path, "utf8")) as WorkflowJson;
  } catch (error) {
    if (!required && (error as NodeJS.ErrnoException).code === "ENOENT") return {};
    throw new Error(`Unable to read report evidence JSON '${path}': ${String(error)}`);
  }
}

function compactArrays(value: unknown): unknown {
  if (Array.isArray(value)) {
    if (value.length > 12) return { count: value.length, sample: value.slice(0, 5).map(compactArrays) };
    return value.map(compactArrays);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, compactArrays(child)]));
  }
  return value;
}

function completedStatus(value: unknown): boolean {
  return ["complete", "completed", "concluded"].includes(String(value || ""));
}

function evidenceId(taskId: string, roundNumber: number): string {
  return `${taskId}:R${roundNumber}`;
}

function parseEvidenceId(value: unknown): { taskId: string; roundNumber: number } {
  const match = String(value || "").trim().match(/^([^:]+):R([1-9]\d*)$/i);
  if (!match) throw new Error(`Invalid Research Planning report selection '${String(value || "")}'. Expected TASK:Rn.`);
  return { taskId: match[1], roundNumber: Number(match[2]) };
}

async function planningProjectAt(projectDir: string): Promise<ResearchPlanningProject | undefined> {
  const manifestPath = join(projectDir, "project.json");
  const manifest = await readJson(manifestPath);
  if (manifest.schema_version !== 1 || !manifest.planning_run) return undefined;
  const planningStatePath = resolve(String(manifest.planning_run.state_path || join(String(manifest.planning_run.run_dir || ""), "state.json")));
  const planningState = await readJson(planningStatePath, true);
  const planning = planningState.research_planning || {};
  const storedPlanPath = String(planning.research_plan_path || "").trim();
  if (!storedPlanPath) return undefined;
  const planPath = resolve(storedPlanPath);
  const plan = await readJson(planPath, true);
  return { projectDir, manifestPath, manifest, planningStatePath, planningState, planPath, plan };
}

async function resolveResearchPlanningProject(sourcePath: string): Promise<ResearchPlanningProject> {
  const source = resolve(sourcePath);
  const pending = [source];
  const visited = new Set<string>();
  let diagnostic = "";

  // A report may be requested while the active context is the parent planning
  // run, a terminal task round, a task project, a report directory, or another
  // nested artifact directory. Resolve all of them without requiring callers
  // to pre-normalize the path or maintain a second project pointer.
  while (pending.length && visited.size < 32) {
    const candidate = resolve(String(pending.shift() || ""));
    if (!candidate || visited.has(candidate)) continue;
    visited.add(candidate);

    try {
      const direct = await planningProjectAt(candidate);
      if (direct) return direct;
    } catch (error) {
      diagnostic ||= String(error);
    }

    let candidateState: WorkflowJson = {};
    let candidateManifest: WorkflowJson = {};
    try {
      candidateState = await readJson(join(candidate, "state.json"));
    } catch (error) {
      diagnostic ||= String(error);
    }
    try {
      candidateManifest = await readJson(join(candidate, "project.json"));
    } catch (error) {
      diagnostic ||= String(error);
    }

    let roundState: WorkflowJson = {};
    const latestRound = Array.isArray(candidateManifest.rounds) ? candidateManifest.rounds.at(-1) : undefined;
    const latestRunDir = String(latestRound?.run_dir || "").trim();
    if (latestRunDir) {
      try {
        roundState = await readJson(join(resolve(latestRunDir), "state.json"));
      } catch (error) {
        diagnostic ||= String(error);
      }
    }

    const parentRunDirs = [
      candidateState.parent_run_dir,
      candidateState.inherited_context?.parent_run_dir,
      roundState.parent_run_dir,
      roundState.inherited_context?.parent_run_dir,
    ].map((value) => String(value || "").trim()).filter(Boolean);
    for (const parentRunDir of parentRunDirs) {
      pending.unshift(resolve(parentRunDir), dirname(resolve(parentRunDir)));
    }

    const parentDirectory = dirname(candidate);
    if (parentDirectory !== candidate) pending.push(parentDirectory);
  }

  throw new Error([
    `Unable to resolve a Research Planning parent project from '${source}'.`,
    "Pass any path inside the Research Planning project, planning run, task project, or task round.",
    diagnostic ? `Diagnostic: ${diagnostic}` : "",
  ].filter(Boolean).join(" "));
}

function taskContract(plan: WorkflowJson, taskId: string): { subquestion: WorkflowJson; task: WorkflowJson } | undefined {
  for (const subquestion of Array.isArray(plan.subquestions) ? plan.subquestions : []) {
    const task = (Array.isArray(subquestion.tasks) ? subquestion.tasks : []).find((item: WorkflowJson) => String(item.id) === taskId);
    if (task) return { subquestion, task };
  }
  return undefined;
}

function artifactPath(runDir: string, path: unknown): string {
  return resolve(runDir, String(path || ""));
}

function figureVariantKey(path: string): string {
  return join(dirname(path), basename(path, extname(path)));
}

const RASTER = new Set([".png", ".jpg", ".jpeg", ".webp"]);

function orderedFigureVariants(left: WorkflowJson, right: WorkflowJson): number {
  const leftSuffix = extname(String(left.path || "")).toLowerCase();
  const rightSuffix = extname(String(right.path || "")).toLowerCase();
  const preferred = [".png", ".jpg", ".jpeg", ".webp", ".pdf"];
  return preferred.indexOf(leftSuffix) - preferred.indexOf(rightSuffix);
}

export class ReportEvidenceCompiler {
  constructor(readonly dependencies: ReportEvidenceCompilerDependencies) {}

  async catalog(projectPath: string): Promise<WorkflowJson> {
    const project = await resolveResearchPlanningProject(projectPath);
    const planning = project.planningState.research_planning || {};
    const taskRuns = Array.isArray(planning.task_runs) ? planning.task_runs : [];
    const subquestions: WorkflowJson[] = [];
    const eligibleEvidenceIds: string[] = [];
    const recommendedEvidenceIds: string[] = [];
    let taskCount = 0;

    for (const subquestion of (Array.isArray(project.plan.subquestions) ? project.plan.subquestions : [])) {
      const tasks: WorkflowJson[] = [];
      for (const task of (Array.isArray(subquestion.tasks) ? subquestion.tasks : [])) {
        taskCount += 1;
        const taskId = String(task.id || "");
        const taskRun = taskRuns.find((item: WorkflowJson) => String(item.task_id) === taskId);
        const taskProjectDir = resolve(String(taskRun?.task_project_dir || (taskRun?.run_dir ? dirname(String(taskRun.run_dir)) : join(project.projectDir, "research_tasks", taskId))));
        const taskManifestPath = resolve(String(taskRun?.task_project_manifest_path || join(taskProjectDir, "project.json")));
        const taskManifest = await readJson(taskManifestPath);
        const rounds: WorkflowJson[] = [];
        for (const round of (Array.isArray(taskManifest.rounds) ? taskManifest.rounds : [])) {
          if (!round.run_dir || !completedStatus(round.status)) continue;
          const roundNumber = Number(round.round_number);
          if (!Number.isInteger(roundNumber) || roundNumber < 1) continue;
          const runDir = resolve(String(round.run_dir));
          const statePath = join(runDir, "state.json");
          const state = await readJson(statePath);
          const validationPath = resolve(String(state.validation?.path || join(runDir, "validation.json")));
          const validation = Object.keys(state.validation || {}).length ? state.validation : await readJson(validationPath);
          const conclusionsPath = resolve(String(round.conclusions_path || state.conclusions?.path || join(runDir, "conclusions.json")));
          const conclusions = await readJson(conclusionsPath);
          if (validation.pass !== true || !Boolean(conclusions.summary || (Array.isArray(conclusions.conclusions) && conclusions.conclusions.length))) continue;
          const id = evidenceId(taskId, roundNumber);
          eligibleEvidenceIds.push(id);
          rounds.push({
            evidence_id: id,
            round_number: roundNumber,
            run_id: state.run_id || round.run_id,
            run_dir: runDir,
            state_path: statePath,
            validation_path: validationPath,
            conclusions_path: conclusionsPath,
          });
        }
        rounds.sort((left, right) => Number(left.round_number) - Number(right.round_number));
        if (rounds.length) recommendedEvidenceIds.push(String(rounds.at(-1)?.evidence_id));
        tasks.push({
          task_id: taskId,
          title: task.title || task.analysis_question || taskRun?.title || taskRun?.question || "",
          rounds,
        });
      }
      subquestions.push({
        subquestion_id: String(subquestion.id || ""),
        title: subquestion.title || subquestion.question || "",
        tasks,
      });
    }

    return {
      ok: true,
      available: eligibleEvidenceIds.length > 0,
      project_id: project.manifest.project_id,
      project_dir: project.projectDir,
      planning_run_id: project.planningState.run_id,
      research_goal: project.plan.research_goal || project.planningState.question || "",
      subquestion_count: subquestions.length,
      task_count: taskCount,
      eligible_task_count: subquestions.flatMap((item) => item.tasks || []).filter((task: WorkflowJson) => Array.isArray(task.rounds) && task.rounds.length > 0).length,
      eligible_round_count: eligibleEvidenceIds.length,
      eligible_evidence_ids: eligibleEvidenceIds,
      recommended_evidence_ids: recommendedEvidenceIds,
      subquestions,
      research_plan_path: project.planPath,
    };
  }

  async readiness(projectPath: string): Promise<WorkflowJson> {
    return this.catalog(projectPath);
  }

  async compile(input: CompileReportEvidenceInput): Promise<WorkflowJson> {
    const project = await resolveResearchPlanningProject(input.projectPath);
    const catalog = await this.catalog(project.projectDir);
    if (catalog.available !== true) throw new Error("No completed, validated Research Planning rounds are available for reporting.");
    const selectedIds: string[] = (input.selectedEvidenceIds?.length ? input.selectedEvidenceIds : catalog.recommended_evidence_ids).map(String);
    if (!selectedIds.length) throw new Error("Select at least one Research Planning task round for the report.");
    if (new Set(selectedIds).size !== selectedIds.length) throw new Error("Research Planning report selections must be unique.");
    const eligible = new Set<string>((catalog.eligible_evidence_ids || []).map(String));
    const invalid = selectedIds.filter((id) => !eligible.has(id));
    if (invalid.length) throw new Error(`Selected Research Planning rounds are unavailable: ${invalid.join(", ")}.`);

    const planning = project.planningState.research_planning || {};
    const taskRuns = planning.task_runs as WorkflowJson[];
    const reportDir = join(project.projectDir, "reports", `report-${timestamp()}-${randomUUID().slice(0, 8)}`);
    const assetsDir = join(reportDir, "assets");
    await mkdir(assetsDir, { recursive: true });
    const planEvidence: WorkflowJson[] = [];
    const figureRegistry: WorkflowJson[] = [];
    const tableRegistry: WorkflowJson[] = [];
    let figureNumber = 0;
    let tableNumber = 0;

    for (const selectedId of selectedIds) {
      const selector = parseEvidenceId(selectedId);
      const taskId = selector.taskId;
      const taskRun = taskRuns.find((item: WorkflowJson) => String(item.task_id) === taskId) || {};
      const contract = taskContract(project.plan, taskId);
      if (!contract) throw new Error(`Task '${taskId}' is not present in the approved Research Plan.`);
      const taskCatalog = (catalog.subquestions as WorkflowJson[]).flatMap((item) => item.tasks || []).find((item: WorkflowJson) => String(item.task_id) === taskId);
      const roundCatalog = (taskCatalog?.rounds || []).find((item: WorkflowJson) => Number(item.round_number) === selector.roundNumber);
      if (!roundCatalog?.run_dir) throw new Error(`Selected evidence '${selectedId}' is unavailable.`);
      const runDir = resolve(String(roundCatalog.run_dir));
      const statePath = join(runDir, "state.json");
      const state = await readJson(statePath, true);
      const planPath = resolve(String(state.plan?.path || join(runDir, "plan.md")));
      const validationPath = resolve(String(roundCatalog.validation_path || state.validation?.path || join(runDir, "validation.json")));
      const conclusionsPath = resolve(String(roundCatalog.conclusions_path || state.conclusions?.path || join(runDir, "conclusions.json")));
      const statisticsArtifact = (Array.isArray(state.artifacts) ? state.artifacts : []).find((item: WorkflowJson) => item.kind === "statistics")?.path;
      const statisticsPath = artifactPath(runDir, statisticsArtifact || state.code?.statistics_path || "statistics.json");
      const validation = Object.keys(state.validation || {}).length ? state.validation : await readJson(validationPath, true);
      const conclusions = await readJson(conclusionsPath, true);
      const statistics = await readJson(statisticsPath);
      const taskFigures: string[] = [];
      const taskTables: string[] = [];

      const variants = new Map<string, WorkflowJson[]>();
      for (const artifact of (Array.isArray(state.artifacts) ? state.artifacts : []).filter((item: WorkflowJson) => item.kind === "figure")) {
        const sourcePath = artifactPath(runDir, artifact.path);
        if (!existsSync(sourcePath)) continue;
        const key = figureVariantKey(sourcePath);
        variants.set(key, [...(variants.get(key) || []), { ...artifact, path: sourcePath }]);
      }
      for (const group of variants.values()) {
        const ordered = [...group].sort(orderedFigureVariants);
        const raster = ordered.find((item) => RASTER.has(extname(String(item.path)).toLowerCase()));
        if (!raster) continue;
        figureNumber += 1;
        const figureId = `${selectedId}:F${taskFigures.length + 1}`;
        const copied: WorkflowJson[] = [];
        for (const artifact of ordered) {
          const sourcePath = String(artifact.path);
          const suffix = extname(sourcePath).toLowerCase();
          const assetPath = join(assetsDir, `figure-${String(figureNumber).padStart(3, "0")}${suffix}`);
          await copyFile(sourcePath, assetPath);
          copied.push({ source_path: sourcePath, asset_path: assetPath, relative_path: `assets/${basename(assetPath)}`, media_type: suffix.slice(1), role: artifact.role });
        }
        const canonical = copied.find((item) => RASTER.has(`.${item.media_type}`)) || copied[0];
        figureRegistry.push({
          figure_id: figureId,
          figure_number: figureNumber,
          evidence_id: selectedId,
          task_id: taskId,
          round_number: selector.roundNumber,
          run_id: state.run_id || roundCatalog.run_id,
          ...canonical,
          description: raster.description || ordered.find((item) => item.description)?.description || "",
          validation_observations: validation.figure_observations || [],
          per_figure_validation: (Array.isArray(validation.per_figure) ? validation.per_figure : []).filter((item: WorkflowJson) => basename(String(item.path || "")) === basename(String(raster.path))),
          supplemental_assets: copied.filter((item) => item.asset_path !== canonical.asset_path),
        });
        taskFigures.push(figureId);
      }

      for (const artifact of (Array.isArray(state.artifacts) ? state.artifacts : []).filter((item: WorkflowJson) => item.kind === "table")) {
        const sourcePath = artifactPath(runDir, artifact.path);
        if (!existsSync(sourcePath)) continue;
        tableNumber += 1;
        const tableId = `${selectedId}:T${taskTables.length + 1}`;
        const suffix = extname(sourcePath).toLowerCase() || ".txt";
        const assetPath = join(assetsDir, `table-${String(tableNumber).padStart(3, "0")}${suffix}`);
        await copyFile(sourcePath, assetPath);
        tableRegistry.push({ table_id: tableId, table_number: tableNumber, evidence_id: selectedId, task_id: taskId, round_number: selector.roundNumber, source_path: sourcePath, asset_path: assetPath, relative_path: `assets/${basename(assetPath)}`, description: artifact.description || "" });
        taskTables.push(tableId);
      }

      planEvidence.push({
        evidence_id: selectedId,
        subquestion_id: String(contract.subquestion.id || taskRun.subquestion_id || ""),
        task_id: taskId,
        round_number: selector.roundNumber,
        run_id: state.run_id || roundCatalog.run_id,
        question: contract.task.analysis_question || taskRun.question || state.question || "",
        biological_hypothesis: contract.task.biological_hypothesis || taskRun.biological_hypothesis || "",
        expected_evidence: contract.task.expected_evidence || taskRun.expected_evidence || "",
        supports_conclusion_if: contract.task.supports_conclusion_if || "",
        contradicts_conclusion_if: contract.task.contradicts_conclusion_if || "",
        plan_summary: state.plan?.review_summary || state.plan?.summary || taskRun.plan_summary || "",
        conclusions: Array.isArray(conclusions.conclusions) ? conclusions.conclusions : [],
        summary: conclusions.summary || taskRun.summary || "",
        supporting_statistics: compactArrays(statistics),
        validation: {
          pass: validation.pass === true,
          summary: validation.summary || "",
          methodological_caveats: validation.methodological_caveats || [],
          figure_observations: validation.figure_observations || [],
        },
        limitations: conclusions.limitations || [],
        figure_ids: taskFigures,
        table_ids: taskTables,
        source_paths: { state: statePath, plan: planPath, statistics: statisticsPath, validation: validationPath, conclusions: conclusionsPath },
      });
    }

    const selectedTaskIds = [...new Set(planEvidence.map((item) => String(item.task_id)))];
    const subquestions = (project.plan.subquestions as WorkflowJson[]).map((subquestion) => ({
      id: subquestion.id,
      question: subquestion.question,
      hypothesis: subquestion.hypothesis,
      role_in_overall_conclusion: subquestion.role_in_overall_conclusion,
      evidence_ids: planEvidence.filter((item) => item.subquestion_id === subquestion.id).map((item) => item.evidence_id),
    })).filter((subquestion) => subquestion.evidence_ids.length > 0);
    const reportScope = selectedTaskIds.length === Number(catalog.task_count || 0) ? "complete" : "partial";
    const createdAt = new Date().toISOString();
    const hierarchy = {
      schema_version: 2,
      kind: "research_planning_hierarchical_evidence",
      project_id: project.manifest.project_id,
      project_dir: project.projectDir,
      planning_run_id: project.planningState.run_id,
      research_goal: project.plan.research_goal || project.planningState.question || "",
      report_goal: String(input.reportGoal || "Answer the approved Research Planning goal from the completed terminal-task evidence."),
      synthesis_strategy: project.plan.synthesis_strategy || "",
      research_plan_path: project.planPath,
      subquestions,
      plan_evidence: planEvidence,
      subquestion_conclusions: [],
      overall_synthesis: null,
      figures: figureRegistry,
      tables: tableRegistry,
      literature: {
        context: planning.survey?.literature_grounding_context || "",
        sources: planning.survey?.sources || [],
      },
      selection: {
        selected_evidence_ids: selectedIds,
        selected_task_ids: selectedTaskIds,
        selected_round_count: selectedIds.length,
        selected_task_count: selectedTaskIds.length,
        planned_task_count: Number(catalog.task_count || 0),
        report_scope: reportScope,
      },
      selection_authoritative: true,
      created_at: createdAt,
    };
    const hierarchyPath = join(reportDir, "hierarchical_evidence.json");
    await this.dependencies.writeJson(hierarchyPath, hierarchy);
    return {
      ok: true,
      project_id: project.manifest.project_id,
      project_dir: project.projectDir,
      report_dir: reportDir,
      hierarchical_evidence_path: hierarchyPath,
      task_count: selectedTaskIds.length,
      round_count: planEvidence.length,
      subquestion_count: subquestions.length,
      figure_count: figureRegistry.length,
      table_count: tableRegistry.length,
      report_scope: reportScope,
      selected_evidence_ids: selectedIds,
    };
  }
}
