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
  selectedEvidence: string[];
  reportGoal?: string;
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

const REPORT_VISION_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp"]);

function figureVariantKey(path: string): string {
  const suffix = extname(path);
  return join(dirname(path), basename(path, suffix));
}

function canonicalFigureVariant(left: WorkflowJson, right: WorkflowJson): number {
  const leftSuffix = extname(String(left.path || "")).toLowerCase();
  const rightSuffix = extname(String(right.path || "")).toLowerCase();
  const leftVision = REPORT_VISION_EXTENSIONS.has(leftSuffix);
  const rightVision = REPORT_VISION_EXTENSIONS.has(rightSuffix);
  if (leftVision !== rightVision) return leftVision ? -1 : 1;
  const preferred = [".png", ".jpg", ".jpeg", ".webp", ".pdf"];
  return preferred.indexOf(leftSuffix) - preferred.indexOf(rightSuffix);
}

function canonicalSelection(value: unknown): { sourceType: "project_round" | "research_task_round"; evidenceId: string; taskId?: string; roundNumber: number } {
  const text = String(value || "").trim();
  const normal = /^(?:ROUND:|R)(\d+)$/i.exec(text);
  if (normal) return { sourceType: "project_round", evidenceId: `ROUND:${Number(normal[1])}`, roundNumber: Number(normal[1]) };
  const task = /^([^:]+):R(\d+)$/i.exec(text);
  if (task) return { sourceType: "research_task_round", evidenceId: `${task[1]}:R${Number(task[2])}`, taskId: task[1], roundNumber: Number(task[2]) };
  throw new Error(`Invalid evidence selector '${text}'. Use ROUND:<n> or <task-id>:R<n>, for example ROUND:3 or SQ1-T1:R2.`);
}

async function resolveProject(sourcePath: string): Promise<{ projectDir: string; manifestPath: string; manifest: WorkflowJson }> {
  const source = resolve(sourcePath);
  const sourceState = await readJson(join(source, "state.json"));
  const declared = typeof sourceState.project_dir === "string" ? resolve(sourceState.project_dir) : "";
  for (const projectDir of [...new Set([source, dirname(source), declared].filter(Boolean))]) {
    const manifestPath = join(projectDir, "project.json");
    const manifest = await readJson(manifestPath);
    if (manifest.schema_version === 1 && Array.isArray(manifest.rounds)) return { projectDir, manifestPath, manifest };
  }
  throw new Error(`No SeekBrain project.json was found for '${sourcePath}'.`);
}

function findRound(manifest: WorkflowJson, roundNumber: number): WorkflowJson {
  const round = (manifest.rounds as WorkflowJson[]).find((item) => Number(item.round_number) === roundNumber);
  if (!round?.run_dir) throw new Error(`Round ${roundNumber} is not present in '${manifest.project_id || "project"}'.`);
  return round;
}

async function taskManifest(parent: WorkflowJson, taskId: string): Promise<WorkflowJson> {
  const task = (Array.isArray(parent.research_tasks) ? parent.research_tasks : []).find((item: WorkflowJson) => String(item.task_id) === taskId);
  if (!task) throw new Error(`Research task '${taskId}' is not registered in the project manifest.`);
  const path = String(task.project_manifest_path || join(String(task.project_dir || ""), "project.json"));
  return readJson(path, true);
}

function completed(round: WorkflowJson, state: WorkflowJson): boolean {
  return ["concluded", "complete", "completed"].includes(String(round.status || ""))
    || Boolean(state.interpretation || state.conclusions);
}

export class ReportEvidenceCompiler {
  constructor(readonly dependencies: ReportEvidenceCompilerDependencies) {}

  async listAvailable(projectPath: string): Promise<WorkflowJson> {
    const project = await resolveProject(projectPath);
    const available: WorkflowJson[] = [];
    for (const round of project.manifest.rounds as WorkflowJson[]) {
      if (!round.run_dir) continue;
      const state = await readJson(join(String(round.run_dir), "state.json"));
      if (!completed(round, state)) continue;
      available.push({
        evidence_id: `ROUND:${Number(round.round_number)}`,
        source_type: "project_round",
        round_number: Number(round.round_number),
        question: state.question || round.question || "",
        summary: state.interpretation?.summary || state.conclusions?.summary || round.summary || "",
      });
    }
    for (const task of Array.isArray(project.manifest.research_tasks) ? project.manifest.research_tasks : []) {
      const taskId = String(task.task_id || "");
      if (!taskId) continue;
      const manifest = await taskManifest(project.manifest, taskId);
      for (const round of manifest.rounds as WorkflowJson[]) {
        if (!round.run_dir) continue;
        const state = await readJson(join(String(round.run_dir), "state.json"));
        if (!completed(round, state)) continue;
        available.push({
          evidence_id: `${taskId}:R${Number(round.round_number)}`,
          source_type: "research_task_round",
          task_id: taskId,
          round_number: Number(round.round_number),
          question: state.question || round.question || "",
          summary: state.interpretation?.summary || state.conclusions?.summary || round.summary || "",
        });
      }
    }
    return { ok: true, project_id: project.manifest.project_id, project_dir: project.projectDir, available };
  }

  async compile(input: CompileReportEvidenceInput): Promise<WorkflowJson> {
    const project = await resolveProject(input.projectPath);
    const selectors = input.selectedEvidence.map(canonicalSelection);
    if (!selectors.length) throw new Error("Select at least one completed result for the report.");
    if (new Set(selectors.map((item) => item.evidenceId)).size !== selectors.length) throw new Error("Report evidence selections must be unique.");

    const reportDir = join(project.projectDir, "reports", `report-${timestamp()}-${randomUUID().slice(0, 8)}`);
    const assetsDir = join(reportDir, "assets");
    await mkdir(assetsDir, { recursive: true });
    const selected: WorkflowJson[] = [];
    const evidence: WorkflowJson[] = [];
    let figureNumber = 0;

    for (const selector of selectors) {
      const manifest = selector.sourceType === "project_round"
        ? project.manifest
        : await taskManifest(project.manifest, String(selector.taskId));
      const round = findRound(manifest, selector.roundNumber);
      const runDir = resolve(String(round.run_dir));
      const state = await readJson(join(runDir, "state.json"), true);
      if (!completed(round, state)) throw new Error(`Selected evidence '${selector.evidenceId}' is not complete.`);
      const planPath = join(runDir, "plan.md");
      const validationPath = join(runDir, "validation.json");
      const interpretationPath = join(runDir, "interpretation.json");
      const conclusionsPath = join(runDir, "conclusions.json");
      const statisticsArtifact = (Array.isArray(state.artifacts) ? state.artifacts : []).find((item: WorkflowJson) => item.kind === "statistics")?.path;
      const statisticsPath = statisticsArtifact ? resolve(runDir, String(statisticsArtifact)) : join(runDir, "statistics.json");
      const validation = await readJson(validationPath);
      const interpretation = Object.keys(await readJson(interpretationPath)).length
        ? await readJson(interpretationPath)
        : await readJson(conclusionsPath);
      const figures: WorkflowJson[] = [];
      const variants = new Map<string, WorkflowJson[]>();
      for (const artifact of (Array.isArray(state.artifacts) ? state.artifacts : []).filter((item: WorkflowJson) => item.kind === "figure")) {
        const sourcePath = resolve(runDir, String(artifact.path));
        if (!existsSync(sourcePath)) continue;
        const key = figureVariantKey(sourcePath);
        variants.set(key, [...(variants.get(key) || []), { ...artifact, path: sourcePath }]);
      }
      for (const group of variants.values()) {
        const ordered = [...group].sort(canonicalFigureVariant);
        const canonical = ordered[0];
        figureNumber += 1;
        const copied = await Promise.all(ordered.map(async (artifact) => {
          const sourcePath = String(artifact.path);
          const extension = extname(sourcePath) || ".png";
          const assetPath = join(assetsDir, `figure-${String(figureNumber).padStart(3, "0")}${extension}`);
          await copyFile(sourcePath, assetPath);
          return {
            source_path: sourcePath,
            asset_path: assetPath,
            relative_path: `assets/${basename(assetPath)}`,
            role: artifact.role,
            media_type: extension.toLowerCase().slice(1),
          };
        }));
        const canonicalAsset = copied[0];
        figures.push({
          figure_id: `${selector.evidenceId}:F${figures.length + 1}`,
          figure_number: figureNumber,
          ...canonicalAsset,
          description: canonical.description || ordered.find((item) => item.description)?.description,
          produced_by: canonical.produced_by,
          supplemental_assets: copied.slice(1),
        });
      }
      const inherited = state.inherited_context || {};
      const task = inherited.task || {};
      const subquestion = inherited.subquestion || {};
      selected.push({
        evidence_id: selector.evidenceId,
        source_type: selector.sourceType,
        ...(selector.taskId ? { task_id: selector.taskId } : {}),
        round_number: selector.roundNumber,
        run_id: state.run_id || round.run_id,
        run_dir: runDir,
      });
      evidence.push({
        evidence_id: selector.evidenceId,
        source_type: selector.sourceType,
        question: state.question || round.question || "",
        scientific_context: {
          research_goal: inherited.research_goal || "",
          subquestion: subquestion.question || "",
          task_title: task.title || "",
          biological_hypothesis: task.biological_hypothesis || state.biological_hypothesis || "",
        },
        plan: { path: planPath, summary: state.plan?.summary || state.plan?.review_summary || "" },
        validation: {
          path: validationPath,
          pass: validation.pass,
          summary: validation.summary || "",
          methodological_caveats: validation.methodological_caveats || [],
          blocking_issues: validation.blocking_issues || [],
        },
        interpretation: {
          path: Object.keys(await readJson(interpretationPath)).length ? interpretationPath : conclusionsPath,
          summary: interpretation.summary || "",
          conclusions: interpretation.conclusions || [],
          limitations: interpretation.limitations || [],
          confidence: interpretation.confidence,
        },
        statistics: await readJson(statisticsPath),
        data_artifacts: (Array.isArray(state.artifacts) ? state.artifacts : []).filter((item: WorkflowJson) => item.kind === "data" || item.kind === "statistics"),
        table_paths: (Array.isArray(state.artifacts) ? state.artifacts : []).filter((item: WorkflowJson) => item.kind === "table").map((item: WorkflowJson) => item.path),
        figures,
      });
    }

    const createdAt = new Date().toISOString();
    const selection = {
      project_id: project.manifest.project_id,
      report_goal: String(input.reportGoal || "Synthesize the selected findings."),
      selected_evidence: selected,
      created_at: createdAt,
    };
    const bundle = {
      schema_version: 1,
      project_id: project.manifest.project_id,
      report_goal: selection.report_goal,
      evidence,
      created_at: createdAt,
      selection_authoritative: true,
    };
    const selectionPath = join(reportDir, "selection.json");
    const bundlePath = join(reportDir, "evidence_bundle.json");
    await this.dependencies.writeJson(selectionPath, selection);
    await this.dependencies.writeJson(bundlePath, bundle);
    return {
      ok: true,
      project_id: project.manifest.project_id,
      project_dir: project.projectDir,
      report_dir: reportDir,
      selection_path: selectionPath,
      evidence_bundle_path: bundlePath,
      selected_count: selected.length,
      figure_count: figureNumber,
      selected_evidence: selected,
    };
  }
}
