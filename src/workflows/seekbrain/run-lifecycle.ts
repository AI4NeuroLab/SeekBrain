import { existsSync } from "node:fs";
import { mkdir, readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { basename, dirname, join, resolve } from "node:path";
import {
  ArtifactService,
  atomicWriteJson,
  type ArtifactKind,
  type RunStateDocument,
  type StateMutation,
} from "../../core/index.ts";

export type WorkflowJson = Record<string, any>;

export interface WorkflowArtifact {
  name?: string;
  path: string;
  kind: ArtifactKind;
  role?: string;
  description?: string;
  optional?: boolean;
  produced_by?: string;
  content?: string;
}

export interface WorkflowRunContext {
  runId: string;
  runDir: string;
  statePath: string;
  state: WorkflowJson;
}

export interface RunLifecycleStorage {
  loadAt(runId: string, runDir: string): Promise<RunStateDocument>;
  save(runId: string, runDir: string, state: Record<string, unknown>): Promise<RunStateDocument>;
  updateAt(runId: string, runDir: string, mutation: StateMutation): Promise<RunStateDocument>;
}

export interface StartResearchInput {
  cwd: string;
  projectPath: string;
  question: string;
  deliverables?: WorkflowArtifact[];
  metadata?: { data_info?: string; extra_path_info?: string; metadata_json_path?: string; user_background?: string };
  deferInitialRound?: boolean;
}

export const DEFAULT_DELIVERABLES: WorkflowArtifact[] = [
  { path: "generated_code.py", kind: "code" },
  { path: "figure.png", kind: "figure", role: "main" },
  { path: "figure.pdf", kind: "figure", role: "main_pdf", optional: true },
  { path: "statistics.json", kind: "statistics" },
];

export function normalizeDeliverables(input: unknown): WorkflowArtifact[] {
  if (!Array.isArray(input)) return [];
  return input.flatMap((raw) => {
    if (!raw || typeof raw !== "object") return [];
    const item = raw as WorkflowJson;
    if (!item.path || !item.kind) return [];
    return [{
      path: String(item.path),
      kind: item.kind as ArtifactKind,
      role: item.role ? String(item.role) : undefined,
      description: item.description ? String(item.description) : undefined,
      optional: Boolean(item.optional),
      produced_by: item.produced_by ? String(item.produced_by) : undefined,
    }];
  });
}

export function ensureInfrastructure(deliverables: WorkflowArtifact[]): WorkflowArtifact[] {
  const merged = [...deliverables];
  if (!merged.some((artifact) => artifact.kind === "code")) {
    merged.push({ path: "generated_code.py", kind: "code" });
  }
  if (!merged.some((artifact) => artifact.kind === "statistics")) {
    merged.push({ path: "statistics.json", kind: "statistics" });
  }
  return merged;
}

function timestamp(): string {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  return [
    now.getFullYear(), pad(now.getMonth() + 1), pad(now.getDate()), "-",
    pad(now.getHours()), pad(now.getMinutes()), pad(now.getSeconds()),
  ].join("");
}

async function readJson(path: string, fallback: WorkflowJson): Promise<WorkflowJson> {
  try {
    return JSON.parse(await readFile(path, "utf8")) as WorkflowJson;
  } catch {
    return fallback;
  }
}

export class RunLifecycleWorkflow {
  static readonly RUN_INDEX_FILE = ".pi/seekbrain/run_index.json";
  static readonly CURRENT_RUN_FILE = ".pi/seekbrain/current_run.json";
  static readonly PROJECT_MANIFEST_FILE = "project.json";

  constructor(readonly storage: RunLifecycleStorage) {}

  async ping(cwd: string): Promise<{ runCount: number }> {
    const index = await readJson(resolve(cwd, RunLifecycleWorkflow.RUN_INDEX_FILE), { runs: {} });
    return { runCount: Object.keys(index.runs || {}).length };
  }

  async loadRunState(runId: string, runDir: string): Promise<WorkflowRunContext> {
    const statePath = join(runDir, "state.json");
    const existing = await this.storage.loadAt(runId, runDir) as WorkflowJson;
    const state = {
      ...existing,
      run_id: runId,
      artifacts: new ArtifactService(runDir).normalizeMany(existing.artifacts || []),
    };
    return { runId, runDir, statePath, state };
  }

  async startRun(
    cwd: string,
    workDir: string,
    userDeliverables?: WorkflowArtifact[],
    question?: string,
  ): Promise<WorkflowRunContext> {
    const runDir = resolve(cwd, workDir);
    const runId = `${timestamp()}-${basename(runDir) || "run"}-${randomUUID().slice(0, 8)}`;
    await mkdir(join(runDir, "subagents"), { recursive: true });
    const deliverables = ensureInfrastructure(
      userDeliverables?.length ? normalizeDeliverables(userDeliverables) : DEFAULT_DELIVERABLES,
    );
    const statePath = join(runDir, "state.json");
    const existing = await readJson(statePath, {});
    const baseState = {
      ...existing,
      run_id: runId,
      created_at: existing.created_at || new Date().toISOString(),
      artifacts: new ArtifactService(runDir).normalizeMany(existing.artifacts || []),
      deliverables,
    };
    const state = await this.storage.save(runId, runDir, {
      ...baseState,
      ...this.questionUpdate(baseState, question),
    }) as WorkflowJson;
    await this.writeRunIndex(cwd, runId, runDir);
    await this.writeCurrentInteractiveRun(cwd, runId, runDir);
    return { runId, runDir, statePath, state };
  }

  async resumeRun(cwd: string, workDir: string, question?: string): Promise<WorkflowRunContext> {
    const runDir = resolve(cwd, workDir);
    const statePath = join(runDir, "state.json");
    const existing = await readJson(statePath, {});
    const runId = existing.run_id;
    if (!runId || typeof runId !== "string") {
      throw new Error(`Cannot resume: ${statePath} is missing run_id. Call neuro_start_run first.`);
    }
    await mkdir(join(runDir, "subagents"), { recursive: true });
    const run = await this.loadRunState(runId, runDir);
    await this.writeRunIndex(cwd, runId, runDir);
    await this.writeCurrentInteractiveRun(cwd, runId, runDir, run.state);
    const patch = this.questionUpdate(run.state, question);
    if (Object.keys(patch).length) await this.updateState(run, patch);
    return run;
  }

  async resolveRun(cwd: string, requestedRunId?: string): Promise<WorkflowRunContext> {
    if (!requestedRunId) {
      throw new Error("run_id is required. Call neuro_start_run first, then pass the returned run_id to this tool.");
    }
    const index = await readJson(resolve(cwd, RunLifecycleWorkflow.RUN_INDEX_FILE), { runs: {} });
    const entry = index.runs?.[requestedRunId];
    if (!entry?.run_dir) {
      throw new Error(`Unknown run_id '${requestedRunId}'. Call neuro_start_run first or use the run_id returned by it.`);
    }
    await mkdir(join(entry.run_dir, "subagents"), { recursive: true });
    return this.loadRunState(requestedRunId, entry.run_dir);
  }

  async updateState(run: WorkflowRunContext, patch: WorkflowJson): Promise<void> {
    const hasArtifacts = Object.prototype.hasOwnProperty.call(patch, "artifacts");
    const next = await this.storage.updateAt(run.runId, run.runDir, (document) => {
      const current = document as WorkflowJson;
      const artifacts = new ArtifactService(run.runDir);
      return {
        ...current,
        ...patch,
        artifacts: hasArtifacts
          ? artifacts.merge(current.artifacts || [], patch.artifacts || [])
          : artifacts.normalizeMany(current.artifacts || []),
        updated_at: new Date().toISOString(),
      };
    }) as WorkflowJson;
    run.state = next;
  }

  async startResearch(input: StartResearchInput) {
    const question = input.question.trim();
    if (!question) throw new Error("question is required to start round1.");
    const projectDir = resolve(input.cwd, input.projectPath);
    const manifestPath = join(projectDir, RunLifecycleWorkflow.PROJECT_MANIFEST_FILE);
    if (existsSync(manifestPath)) {
      throw new Error(`Research project already exists at '${projectDir}'. Use neuro_continue_research to create the next round.`);
    }
    const projectId = basename(projectDir) || `research-${timestamp()}-${randomUUID().slice(0, 8)}`;
    const deferred = input.deferInitialRound === true;
    const roundNumber = deferred ? 0 : 1;
    const roundName = deferred ? "planning" : "round1";
    const run = await this.startRun(input.cwd, join(projectDir, roundName), input.deliverables, question);
    const metadata = {
      data_info: String(input.metadata?.data_info || ""),
      extra_path_info: String(input.metadata?.extra_path_info || ""),
      metadata_json_path: String(input.metadata?.metadata_json_path || ""),
      user_background: String(input.metadata?.user_background || ""),
    };
    await this.updateState(run, {
      project_id: projectId, project_dir: projectDir, round_number: roundNumber,
      round_name: roundName, metadata_locked: true, planning_context: deferred, ...metadata,
    });
    const manifest = {
      schema_version: 1,
      project_id: projectId,
      project_dir: projectDir,
      created_at: new Date().toISOString(),
      metadata_locked: true,
      metadata,
      planning_run: deferred ? {
        run_id: run.runId,
        run_dir: run.runDir,
        state_path: run.statePath,
        question,
        created_at: new Date().toISOString(),
      } : undefined,
      rounds: deferred ? [] : [{
        round_number: roundNumber, round_name: roundName, run_id: run.runId,
        run_dir: run.runDir, question, status: "active", created_at: new Date().toISOString(),
      }],
    };
    await this.writeResearchProject(manifestPath, manifest);
    await this.writeCurrentInteractiveRun(input.cwd, run.runId, run.runDir, run.state);
    return { run, projectDir, projectId, roundNumber, roundName, manifestPath };
  }

  async materializeInitialRound(cwd: string, planningRunId: string) {
    const planningRun = await this.resolveRun(cwd, planningRunId);
    const projectDir = String(planningRun.state.project_dir || dirname(planningRun.runDir));
    const manifestPath = join(projectDir, RunLifecycleWorkflow.PROJECT_MANIFEST_FILE);
    const manifest = await readJson(manifestPath, {});
    if (manifest.schema_version !== 1 || !Array.isArray(manifest.rounds)) {
      throw new Error(`Cannot materialize round1: '${manifestPath}' is not a SeekBrain project manifest.`);
    }
    const existing = manifest.rounds.find((entry: WorkflowJson) => Number(entry.round_number) === 1);
    if (existing?.run_id && existing?.run_dir) {
      const run = await this.loadRunState(String(existing.run_id), String(existing.run_dir));
      await this.writeCurrentInteractiveRun(cwd, run.runId, run.runDir, run.state);
      return { run, projectDir, projectId: manifest.project_id, roundNumber: 1, roundName: "round1", manifestPath, reused: true };
    }
    const roundName = "round1";
    const run = await this.startRun(cwd, join(projectDir, roundName), planningRun.state.deliverables, String(planningRun.state.question || ""));
    const metadata = manifest.metadata || this.researchMetadata(planningRun.state);
    await this.updateState(run, {
      project_id: manifest.project_id,
      project_dir: projectDir,
      round_number: 1,
      round_name: roundName,
      metadata_locked: true,
      data_info: String(metadata.data_info || ""),
      extra_path_info: String(metadata.extra_path_info || ""),
      metadata_json_path: String(metadata.metadata_json_path || ""),
      user_background: String(metadata.user_background || ""),
      planning_source_run_id: planningRun.runId,
      planning_source_run_dir: planningRun.runDir,
      ...(Array.isArray(planningRun.state.literature_queries) ? { literature_queries: planningRun.state.literature_queries } : {}),
    });
    manifest.rounds.push({
      round_number: 1,
      round_name: roundName,
      run_id: run.runId,
      run_dir: run.runDir,
      question: run.state.question,
      status: "active",
      created_at: new Date().toISOString(),
    });
    manifest.updated_at = new Date().toISOString();
    await this.writeResearchProject(manifestPath, manifest);
    await this.updateState(planningRun, {
      materialized_round1_run_id: run.runId,
      materialized_round1_run_dir: run.runDir,
    });
    await this.writeCurrentInteractiveRun(cwd, run.runId, run.runDir, run.state);
    return { run, projectDir, projectId: manifest.project_id, roundNumber: 1, roundName, manifestPath, reused: false };
  }

  async continueResearch(cwd: string, sourcePath: string, direction: string, deliverables?: WorkflowArtifact[]) {
    const question = direction.trim();
    if (!question) throw new Error("direction is required to continue research.");
    const { projectDir, manifestPath, manifest, sourceState } = await this.readResearchProject(resolve(cwd, sourcePath));
    const rounds = [...manifest.rounds].sort((a: WorkflowJson, b: WorkflowJson) => Number(a.round_number) - Number(b.round_number));
    const namedRound = /^round(\d+)$/i.exec(basename(resolve(cwd, sourcePath)))?.[1];
    const sourceNumber = Number(sourceState.round_number || namedRound || rounds.at(-1)?.round_number);
    const sourceRound = rounds.find((entry: WorkflowJson) => Number(entry.round_number) === sourceNumber) || rounds.at(-1);
    if (!sourceRound?.run_dir) throw new Error("The research project has no reusable source round.");
    const roundNumber = Math.max(0, ...rounds.map((entry: WorkflowJson) => Number(entry.round_number) || 0)) + 1;
    const roundName = `round${roundNumber}`;
    const roundDir = join(projectDir, roundName);
    if (existsSync(roundDir)) throw new Error(`Refusing to overwrite existing round directory '${roundDir}'.`);
    const metadata = manifest.metadata || this.researchMetadata(sourceState);
    const run = await this.startRun(cwd, roundDir, deliverables, question);
    const sourceRunState = await readJson(join(sourceRound.run_dir, "state.json"), {});
    const reusableArtifacts = new ArtifactService(sourceRound.run_dir).normalizeMany(sourceRunState.artifacts || []);
    await this.updateState(run, {
      project_id: manifest.project_id, project_dir: projectDir, round_number: roundNumber,
      round_name: roundName, parent_round: sourceRound.round_number, parent_run_id: sourceRound.run_id,
      metadata_locked: true,
      data_info: String(metadata.data_info || ""),
      extra_path_info: String(metadata.extra_path_info || ""),
      metadata_json_path: String(metadata.metadata_json_path || ""),
      user_background: String(metadata.user_background || ""),
      inherited_context: {
        source_round: sourceRound.round_number,
        source_run_id: sourceRound.run_id,
        source_run_dir: sourceRound.run_dir,
        source_state_path: join(sourceRound.run_dir, "state.json"),
        conclusions_path: join(sourceRound.run_dir, "conclusions.json"),
        conclusions: sourceRunState.conclusions || null,
        reusable_artifacts: reusableArtifacts,
        note: "Prior artifacts are read-only inputs unless the new round explicitly writes new outputs. Do not overwrite files in earlier rounds.",
      },
    });
    manifest.rounds.push({
      round_number: roundNumber, round_name: roundName, run_id: run.runId, run_dir: run.runDir,
      question, parent_round: sourceRound.round_number, parent_run_id: sourceRound.run_id,
      status: "active", created_at: new Date().toISOString(),
    });
    await this.writeResearchProject(manifestPath, manifest);
    await this.writeCurrentInteractiveRun(cwd, run.runId, run.runDir, run.state);
    return { run, projectDir, projectId: manifest.project_id, roundNumber, roundName, sourceRound, manifestPath };
  }

  async updateResearchRoundManifest(run: WorkflowRunContext, patch: WorkflowJson): Promise<void> {
    if (!run.state.project_dir || !run.state.round_number) return;
    const path = join(run.state.project_dir, RunLifecycleWorkflow.PROJECT_MANIFEST_FILE);
    const manifest = await readJson(path, {});
    if (!Array.isArray(manifest.rounds)) return;
    manifest.rounds = manifest.rounds.map((entry: WorkflowJson) => Number(entry.round_number) === Number(run.state.round_number)
      ? { ...entry, ...patch, updated_at: new Date().toISOString() }
      : entry);
    await this.writeResearchProject(path, manifest);
  }

  async reportAvailability(run: WorkflowRunContext): Promise<WorkflowJson> {
    if (!run.state.project_dir) return { completed_round_count: 0, available: false };
    const manifest = await readJson(join(String(run.state.project_dir), RunLifecycleWorkflow.PROJECT_MANIFEST_FILE), {});
    const completed = (Array.isArray(manifest.rounds) ? manifest.rounds : []).filter((entry: WorkflowJson) =>
      ["concluded", "complete", "completed"].includes(String(entry.status || "")));
    return {
      completed_round_count: completed.length,
      available: completed.length >= 2,
      hint: completed.length >= 2
        ? `${completed.length} completed rounds are available for synthesis. Type "generate a report" or run /neuro-report when needed.`
        : undefined,
    };
  }

  async registerResearchTaskProject(parentRun: WorkflowRunContext, taskProject: WorkflowJson): Promise<void> {
    if (!parentRun.state.project_dir) return;
    const path = join(String(parentRun.state.project_dir), RunLifecycleWorkflow.PROJECT_MANIFEST_FILE);
    const manifest = await readJson(path, {});
    if (manifest.schema_version !== 1 || !Array.isArray(manifest.rounds)) return;
    const existing = Array.isArray(manifest.research_tasks) ? manifest.research_tasks : [];
    const taskId = String(taskProject.task_id || "");
    manifest.research_tasks = [
      ...existing.filter((item: WorkflowJson) => String(item.task_id || "") !== taskId),
      taskProject,
    ];
    await this.writeResearchProject(path, manifest);
  }

  questionUpdate(state: WorkflowJson, question?: string): WorkflowJson {
    const text = String(question || "").trim();
    if (!text) return {};
    const current = String(state.question || "").trim();
    if (current === text) return { question: text };
    const history = Array.isArray(state.question_history)
      ? state.question_history.filter((entry: any) => entry && typeof entry.text === "string")
      : [];
    if (!current) return { question: text };
    return { question: text, question_history: [...history, { at: new Date().toISOString(), text: current }] };
  }

  private async writeRunIndex(cwd: string, runId: string, runDir: string): Promise<void> {
    const path = resolve(cwd, RunLifecycleWorkflow.RUN_INDEX_FILE);
    const index = await readJson(path, { runs: {} });
    await atomicWriteJson(path, {
      ...index,
      runs: { ...index.runs, [runId]: { run_id: runId, run_dir: runDir, updated_at: new Date().toISOString() } },
      updated_at: new Date().toISOString(),
    });
  }

  private async writeCurrentInteractiveRun(cwd: string, runId: string, runDir: string, state?: WorkflowJson): Promise<void> {
    if (process.env.SEEKBRAIN_NON_INTERACTIVE === "1") return;
    await atomicWriteJson(resolve(cwd, RunLifecycleWorkflow.CURRENT_RUN_FILE), {
      schema_version: 2, source: "neuro-seekbrain", run_id: runId, run_dir: runDir,
      project_id: state?.project_id, project_dir: state?.project_dir,
      round_number: state?.round_number, round_name: state?.round_name,
      updated_at: new Date().toISOString(),
    });
  }

  private async readResearchProject(sourcePath: string) {
    const source = resolve(sourcePath);
    const sourceState = await readJson(join(source, "state.json"), {});
    const declared = typeof sourceState.project_dir === "string" ? resolve(sourceState.project_dir) : "";
    for (const projectDir of [...new Set([source, dirname(source), declared].filter(Boolean))]) {
      const manifestPath = join(projectDir, RunLifecycleWorkflow.PROJECT_MANIFEST_FILE);
      const manifest = await readJson(manifestPath, {});
      if (manifest.schema_version === 1 && Array.isArray(manifest.rounds)) {
        return { projectDir, manifestPath, manifest, sourceState };
      }
    }
    throw new Error(`No multi-round research project found for '${sourcePath}'. Expected project.json in the project directory or its round parent.`);
  }

  private async writeResearchProject(path: string, manifest: WorkflowJson): Promise<void> {
    await atomicWriteJson(path, { ...manifest, updated_at: new Date().toISOString() });
  }

  private researchMetadata(state: WorkflowJson) {
    return {
      data_info: String(state.data_info || ""),
      extra_path_info: String(state.extra_path_info || ""),
      metadata_json_path: String(state.metadata_json_path || ""),
      user_background: String(state.user_background || ""),
    };
  }
}
