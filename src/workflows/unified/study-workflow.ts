import type { UserRequest, UserConversationMessage } from "./user-request.ts";
import { existsSync } from "node:fs";
import { mkdir, readFile, appendFile, stat, open, unlink, writeFile, readdir, copyFile } from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";
import { hostname } from "node:os";
import { dirname, join, relative, resolve, isAbsolute, extname } from "node:path";
import { Value } from "typebox/value";
import { atomicWriteJson, PathPolicy } from "../../core/index.ts";
import type { WorkflowRunContext } from "../seekbrain/run-lifecycle.ts";
import { reportFormats, type ReportPdfPolicy } from "./report-pdf-policy.ts";
import { exportReportPdf } from "../seekbrain/report-pdf-exporter.ts";
import { PlanResultSchema, FormulationResultSchema, CodeResultSchema, ValidationResultSchema, ReportResultSchema, TaskSchema, checkTasks, type Task, type TaskGraph } from "./interfaces.ts";
import { inventory, recordOutputs, availableOutputs, sealOutputs, decisionValue, type OutputRecord } from "./outputs.ts";
import { resolveReportFormat } from "./report-content.ts";

import { deepState, currentRound, newRound, deepNext, deepContext, decisionRequest, snapshotDocument, type StudyRun, type ResearchDecision } from "./deep-research.ts";

type Json = Record<string, any>;
export interface PlanOptions { userRequest?: UserRequest; action?: "create" | "revise" | "reuse"; output_paths?: string[]; source_paths?: string[] }
export interface ReportTargets { report_path?: string; pdf_path?: string; output_formats?: ("markdown" | "pdf")[] }

type Stage = "plan" | "formulation" | "code" | "validation" | "report";
export interface StudyDependencies {
  env?: NodeJS.ProcessEnv;
  runAgent(input: { stage: Stage; run: WorkflowRunContext; workDir: string; prompt: string; schema: unknown; signal?: AbortSignal }): Promise<Json>;
  maxCodeAttempts?: number;
  reportPdfPolicy?: () => Promise<ReportPdfPolicy>;
}
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const readJson = async (path: string): Promise<Json> => JSON.parse(await readFile(path, "utf8"));
const finished = (task: Task) => ["complete", "partial", "failed", "skipped"].includes(task.status);
const scientific = (state: Json) => ["accepted", "partial"].includes(state.validation?.decision);
const agentEnded = (payload: Json) => !payload.__agent || payload.__agent.ok || payload.__agent.normal_end;

export class StudyWorkflow {
  private roots = new Map<string, string>();
  private activeRoot?: string;
  constructor(readonly dependencies: StudyDependencies) {}
  projectCount(): number { return this.roots.size; }

  private root(run: WorkflowRunContext): string { return run.state.project_dir; }
  private statePath(root: string): string { return join(root, ".seekbrain", "state.json"); }
  private graphPath(run: WorkflowRunContext): string { return join(run.runDir, "tasks.json"); }
  private taskPath(run: WorkflowRunContext, id: string): string { return join(run.runDir, "tasks", id, "state.json"); }
  private async saveRun(run: WorkflowRunContext): Promise<void> {
    const { project_dir: _root, ...persisted } = run.state;
    const root = this.root(run), policy = new PathPolicy(root);
    for (const key of ["dataset_paths", "reference_paths"]) persisted[key] = (persisted[key] || []).map((path: string) => policy.contains(path) ? relative(root, path) || "." : path);
    for (const key of ["request_cwd", "metadata_json_path"]) if (persisted[key] && policy.contains(persisted[key])) persisted[key] = relative(root, persisted[key]) || ".";
    await atomicWriteJson(run.statePath, persisted);
  }
  private async graph(run: WorkflowRunContext): Promise<TaskGraph> { return await readJson(this.graphPath(run)) as TaskGraph; }
  private async event(run: WorkflowRunContext, type: string, payload: Json = {}): Promise<void> {
    try { await appendFile(join(run.runDir, "events.jsonl"), `${JSON.stringify({ at: new Date().toISOString(), type, ...payload })}\n`); }
    catch { /* diagnostics must never change analysis status */ }
  }
  private result(run: WorkflowRunContext, extra: Json): Json { return { ok: true, flow_version: "0.1.4", run_id: run.runId, project_dir: this.root(run), run_dir: run.runDir, state_path: run.statePath, metadata_json_path: run.state.metadata_json_path, ...extra, ...(deepState(run) ? deepNext(deepState(run)!) : {}) }; }

  async start(input: { cwd: string; projectPath?: string; request: string; userRequest?: UserRequest; referencePaths?: string[]; datasetPaths?: string[]; metadataPath?: string; extraPathInfo?: string; mode?: string; maxRounds?: number; defaultMaxRounds?: number }): Promise<Json> {
    if (!input.request.trim()) throw new Error("A user request is required");
    const explicit = /(?:output\s*(?:directory|folder|path)|work[_ -]?dir|results?\s*(?:directory|folder)|(?:save|put)\s+(?:the\s+)?(?:results?|files?|outputs?)\s+(?:to|in)|输出(?:目录|文件夹|路径)|结果(?:目录|文件夹|路径)|(?:文件|结果)(?:放|保存)(?:到|在))\s*[:：=]?\s*(?:为|是|到|在)?\s*(?:["'`]([^"'`\n]+)["'`]|([^\s\n,，;；]+))/i.exec(input.request);
    const root = resolve(input.cwd, explicit?.[1] || explicit?.[2] || (this.dependencies.env ?? process.env).SEEKBRAIN_RUN_ROOT || input.projectPath || `study-${new Date().toISOString().replace(/[:.]/g, "-")}`);
    const runDir = join(root, ".seekbrain");
    await mkdir(runDir, { recursive: true });
    return this.exclusive({ runDir } as WorkflowRunContext, async () => {
      if (existsSync(this.statePath(root))) {
        const run = await this.resolve(input.cwd, { projectPath: root });
        for (const [key, paths] of [["reference_paths", input.referencePaths], ["dataset_paths", input.datasetPaths]] as const) {
          if (paths?.length) run.state[key] = [...new Set([...(run.state[key] || []), ...paths.map(path => resolve(input.cwd, path))])];
        }
        if (input.metadataPath) run.state.metadata_json_path = resolve(input.cwd, input.metadataPath);
        if (input.request !== run.state.original_request && !(run.state.user_updates || []).includes(input.request)) {
          run.state.user_updates = [...(run.state.user_updates || []), input.request];
        }
        if (input.userRequest) this.recordUserRequest(run, input.userRequest);
        (run as StudyRun).interactionMode = input.mode;
        if (input.mode === "deep-research") {
          await this.initializeDeepResearch(run, input.maxRounds ?? input.defaultMaxRounds);
          const deep = deepState(run)!;
          if (deep.phase === "complete" && input.userRequest && deep.request_id !== input.userRequest.messageId) {
            const next = deep.round + 1;
            if (input.maxRounds !== undefined && input.maxRounds < next) throw new Error("max_rounds must include the already completed research rounds");
            deep.max_rounds = input.maxRounds ?? Math.max(deep.max_rounds, next + (input.defaultMaxRounds ?? 3) - 1);
            deep.round = next; deep.rounds.push(newRound(next)); deep.phase = "plan"; deep.request_id = input.userRequest!.messageId;
            await this.saveRun(run);
          }
        }
        await this.saveRun(run);
        return this.result(run, { reused: true, next_tool: "seekbrain_run_resume" });
      }
      const runId = randomUUID();
      const run: WorkflowRunContext = { runId, runDir: join(root, ".seekbrain"), statePath: this.statePath(root), state: {
        schema_version: 1, flow_version: "0.1.4", run_id: runId, project_dir: root, original_request: input.request,
        request_cwd: resolve(input.cwd), reference_paths: (input.referencePaths || []).map(p => resolve(input.cwd, p)),
        dataset_paths: (input.datasetPaths || []).map(p => resolve(input.cwd, p)),
        metadata_json_path: input.metadataPath ? resolve(input.cwd, input.metadataPath) : undefined,
        extra_path_info: input.extraPathInfo || "", created_at: new Date().toISOString(), plan_path: "plan.md",
      } };
      (run as StudyRun).interactionMode = input.mode;
      if (input.userRequest) this.recordUserRequest(run, input.userRequest);
      await this.saveRun(run);
      if (input.mode === "deep-research") await this.initializeDeepResearch(run, input.maxRounds ?? input.defaultMaxRounds);
      this.roots.set(runId, root); this.activeRoot = root;
      await this.event(run, "study_started");
      return this.result(run, { next_tool: "seekbrain_plan_generate" });
    });
  }

  async resolve(cwd: string, target: { runId?: string; projectPath?: string; mode?: string }): Promise<WorkflowRunContext> {
    const root = target.projectPath ? resolve(cwd, target.projectPath) : this.roots.get(target.runId || "") || this.activeRoot || resolve(cwd, (this.dependencies.env ?? process.env).SEEKBRAIN_RUN_ROOT || ".");
    const state = await readJson(this.statePath(root));
    for (const key of ["dataset_paths", "reference_paths"]) state[key] = (state[key] || []).map((path: string) => resolve(root, path));
    for (const key of ["request_cwd", "metadata_json_path"]) if (state[key]) state[key] = resolve(root, state[key]);
    if (target.runId && target.runId !== state.run_id) throw new Error("Requested run does not match this output directory");
    this.roots.set(state.run_id, root); this.activeRoot = root;
    return { runId: state.run_id, runDir: join(root, ".seekbrain"), statePath: this.statePath(root), state: { ...state, project_dir: root }, interactionMode: target.mode } as StudyRun;
  }

  private recordUserRequest(run: WorkflowRunContext, request: UserRequest): void {
    if (deepState(run) && deepState(run)!.phase !== "complete") deepState(run)!.request_id = request.messageId;
    const previous: UserConversationMessage[] = run.state.user_conversation || [];
    if (previous.at(-1)?.id === request.messageId) return;
    if (request.text !== run.state.original_request && !(run.state.user_updates || []).includes(request.text)) {
      run.state.user_updates = [...(run.state.user_updates || []), request.text];
    }
    // A completed plan is the baseline for later dialogue. Retain discussion
    // since that request, including assistant proposals with their actual role.
    const boundary = request.conversation.findIndex(message => message.id === run.state.plan_request_key);
    run.state.user_conversation = request.conversation.slice(boundary < 0 ? 0 : boundary + 1);
    if (!run.state.user_conversation.length) run.state.user_conversation = request.conversation.slice(-1);
    run.state.conversation_summary = request.contextSummary;
  }

  private async context(run: WorkflowRunContext): Promise<string> {
    const requests = new Set([run.state.original_request, ...(run.state.user_updates || [])]);
    const discussion = (run.state.user_conversation || []).filter((message: UserConversationMessage) => message.role === "assistant" || !requests.has(message.text));
    const summary = run.state.conversation_summary ? `\n\nEarlier conversation summary (generated by Pi, not an additional user request):\n${run.state.conversation_summary}` : "";
    const conversation = summary + (discussion.length ? `\n\nConversation context (speakers retained; assistant suggestions are discussion, not additional user requirements):\n${JSON.stringify(discussion.map(({ role, text }: UserConversationMessage) => ({ role, text })))}` : "");
    return `Original request:\n${run.state.original_request}\n\nSubsequent user requests:\n${(run.state.user_updates || []).join("\n\n")}${conversation}\n\nInput relative paths resolve against: ${run.state.request_cwd}\nOutput root (never rename or append a suffix): ${this.root(run)}\nDataset locations:\n${JSON.stringify(run.state.dataset_paths || [])}\nOptional dataset metadata: ${run.state.metadata_json_path || "not provided"}\nReference materials:\n${JSON.stringify(run.state.reference_paths || [])}\nAdditional access information:\n${run.state.extra_path_info || ""}${deepContext(run)}`;
  }

  private storedPath(run: WorkflowRunContext, path: string): string { return new PathPolicy(this.root(run)).contains(path) ? relative(this.root(run), path) : path; }
  private requestedPath(run: WorkflowRunContext, path: string): string {
    return resolve(isAbsolute(path) || path.includes("/") || path.includes("\\") ? run.state.request_cwd : this.root(run), path);
  }
  private planPaths(run: WorkflowRunContext): string[] {
    return (run.state.selected_plan_paths || run.state.plan_paths || [run.state.plan_path || "plan.md"]).map((p: string) => resolve(this.root(run), p));
  }
  private async planText(run: WorkflowRunContext): Promise<string> {
    return (await Promise.all(this.planPaths(run).map(async path => `Source plan: ${this.storedPath(run, path)}\n${await readFile(path, "utf8")}`))).join("\n\n");
  }
  private rememberPlanPaths(run: WorkflowRunContext, paths: string[], requestKey: string): void {
    const root = this.root(run);
    run.state.plan_request_key = requestKey;
    if (deepState(run)) {
      run.state.plan_paths = paths.map(path => this.storedPath(run, path));
      run.state.plan_path = run.state.plan_paths[0];
      run.state.selected_plan_paths = [...run.state.plan_paths];
      run.state.selection_explicit = true;
      return;
    }
    run.state.plan_paths = [...new Set([...(run.state.plan_paths || (run.state.plan_path && existsSync(resolve(root, run.state.plan_path)) ? [run.state.plan_path] : [])), ...paths.map(path => this.storedPath(run, path))])];
    run.state.plan_path = run.state.plan_paths[0];
    if (run.state.plan_paths.length === 1) run.state.selected_plan_paths = [...run.state.plan_paths];
    else if (!run.state.selection_explicit) run.state.selected_plan_paths = undefined;
  }

  async plan(run: WorkflowRunContext, signal?: AbortSignal, options: PlanOptions = {}): Promise<Json> {
    const completed = deepState(run);
    if (completed?.phase === "complete" && options.userRequest && completed.request_id !== options.userRequest.messageId) {
      const result = await this.plan({ ...run, interactionMode: "plan" } as StudyRun, signal, options);
      return { ...result, next_tool: undefined, awaiting_input: true };
    }
    return this.exclusive(run, async () => {
      const deep = deepState(run);
      if (deep && !["plan", "formulation"].includes(deep.phase)) return this.result(run, { reused: true });
      const root = this.root(run);
      const targets = options.output_paths?.length ? options.output_paths.map(path => this.requestedPath(run, path)) : [resolve(root, run.state.plan_path || "plan.md")];
      if (targets.some(path => ![".md", ".json", ".txt", ".yaml", ".yml"].includes(extname(path).toLowerCase()))) throw new Error("Plan outputs support Markdown, JSON, text or YAML files.");
      if (options.userRequest) { this.recordUserRequest(run, options.userRequest); await this.saveRun(run); }
      const requestKey = options.userRequest?.messageId || hash(JSON.stringify([run.state.original_request, run.state.user_updates || []]));
      const existing = targets.filter(existsSync);
      const changedRequest = run.state.plan_request_key !== requestKey || !!deep && !currentRound(deep).plan_paths.length;
      let action = options.action || (existing.length ? "revise" : "create");
      if (!options.action && !changedRequest && existing.length === targets.length) action = "reuse";
      if (action === "reuse" && existing.length === targets.length) {
        this.rememberPlanPaths(run, targets, requestKey);
        if (deep) await this.recordRoundPlan(run, targets);
        await this.saveRun(run);
        return this.result(run, { plan_path: targets[0], plan_paths: targets, reused: true, next_tool: "seekbrain_formulation_generate" });
      }
      if (action === "reuse") action = existing.length ? "revise" : "create";
      const sources = (options.source_paths || (action === "revise" ? existing : [])).map(path => this.requestedPath(run, path));
      if (action === "revise" && !sources.length) action = "create";
      const agentRun = { ...run, state: { ...run.state, stage_write_paths: targets } };
      const result = await this.dependencies.runAgent({ stage: "plan", run: agentRun, workDir: root, schema: PlanResultSchema, signal,
        prompt: `${await this.context(run)}\n\nAction: ${action}\nSource plans: ${JSON.stringify(sources)}\nRequested plan output paths: ${JSON.stringify(targets)}\nWrite the requested plans to these paths, using the requested formats and user schemas. Do not create a Markdown duplicate of a JSON plan. Read any supplied source plans. Read existing target content before revising. Finalize plan_paths with the actual paths only.` });
      const paths = (result.plan_paths || (result.plan_path ? [result.plan_path] : targets)).map((path: string) => resolve(root, path));
      if (!agentEnded(result) || paths.length !== targets.length || paths.some((path: string) => !targets.includes(path)) || new Set(paths).size !== paths.length) throw new Error(result.__agent?.error || "The requested plans were not completed");
      for (const path of paths) { const text = await readFile(path, "utf8"); if (!text.trim()) throw new Error(`Empty plan: ${path}`); if (extname(path).toLowerCase() === ".json") JSON.parse(text); }
      this.rememberPlanPaths(run, paths, requestKey);
      if (deep) await this.recordRoundPlan(run, paths);
      await this.saveRun(run); await this.event(run, "plan_generated", { paths: paths.map((path: string) => this.storedPath(run, path)), action });
      return this.result(run, { plan_path: paths[0], plan_paths: paths, next_tool: "seekbrain_formulation_generate" });
    });
  }

  async formulate(run: WorkflowRunContext, signal?: AbortSignal, planPaths?: string[], userRequest?: UserRequest): Promise<Json> {
    return this.exclusive(run, async () => {
      const deep = deepState(run);
      if (deep && deep.phase === "plan" && planPaths?.length) {
        const paths = planPaths.map(path => this.requestedPath(run, path));
        this.rememberPlanPaths(run, paths, run.state.plan_request_key || "supplied-plan");
        await this.recordRoundPlan(run, paths);
        await this.saveRun(run);
      }
      if (deep && deep.phase !== "formulation") return this.result(run, { reused: true });
      if (userRequest) { this.recordUserRequest(run, userRequest); await this.saveRun(run); }
      const root = this.root(run);
      if (planPaths?.length) { run.state.selection_explicit = true; run.state.selected_plan_paths = planPaths.map(path => this.storedPath(run, this.requestedPath(run, path))); await this.saveRun(run); }
      if (!run.state.selected_plan_paths && (run.state.plan_paths || []).length > 1) return this.result(run, { needs_plan_selection: true, plan_paths: run.state.plan_paths, message: "Select the plan or plans to execute." });
      const plan = await this.planText(run);
      const previous = existsSync(this.graphPath(run)) ? await this.graph(run) : undefined;
      if (deep && previous?.deep_round === deep.round && previous.current_task_ids?.length) {
        currentRound(deep).task_ids = [...previous.current_task_ids];
      }
      if (previous?.plan_sha256 === hash(plan) && (!deep || currentRound(deep).task_ids.length)) {
        if (deep) { deep.phase = "execution"; await this.saveRun(run); }
        return this.result(run, { graph: previous, reused: true, next_tool: "seekbrain_execution_run" });
      }
      const roundIds = new Set(deep ? currentRound(deep).task_ids : []);
      const history = deep ? previous?.tasks.filter(task => !roundIds.has(task.id)) || [] : [];
      const existing = deep ? await this.evidence(run).catch(() => ({ evidence: [], progress: [] })) : undefined;
      const result = await this.dependencies.runAgent({ stage: "formulation", run, workDir: root, schema: FormulationResultSchema, signal,
        prompt: `${await this.context(run)}\n\nScientific plan(s), in their original format:\n${plan}\n\nExisting tasks and results (keep unchanged IDs and definitions when still applicable):\n${JSON.stringify(deep ? { historical_tasks_read_only: history, current_round_tasks: previous?.tasks.filter(task => roundIds.has(task.id)) || [], reviewed_results: existing } : previous?.tasks || [])}\n${deep ? `Return only new or corrected work for round ${deep.round}; do not return or rewrite historical tasks. Use IDs prefixed r${String(deep.round).padStart(2, "0")}_ and depend on historical task IDs when consuming their reviewed outputs. Keep each new task reasonably sized; one task may suffice. Never overwrite historical result files.` : ""}\n\nReturn only executable task instructions and dependencies. No execution contract or fixed deliverable filenames. You may write .seekbrain/task_draft.json and finalize its path instead.` });
      const proposed = result.tasks || (existsSync(new PathPolicy(root).resolve(result.formulation_path || ".seekbrain/task_draft.json")) ? (await readJson(new PathPolicy(root).resolve(result.formulation_path || ".seekbrain/task_draft.json"))).tasks : undefined);
      if (!agentEnded(result) || !Array.isArray(proposed) || !proposed.length || proposed.some(t => !Value.Check(TaskSchema, t))) throw new Error("No executable task graph was returned");
      const prefix = deep ? `r${String(deep.round).padStart(2, "0")}_` : "";
      const ids = new Map<string, string>(proposed.map(task => [task.id, prefix && !task.id.startsWith(prefix) ? prefix + task.id : task.id]));
      const tasks: Task[] = proposed.map(task => ({ ...task, id: ids.get(task.id)!,
        depends_on: (task.depends_on || []).map((id: string) => ids.get(id) || id),
        ...(task.inputs ? { inputs: task.inputs.map((input: any) => ({ ...input, task_id: ids.get(input.task_id) || input.task_id })) } : {}),
        ...(task.condition ? { condition: { ...task.condition, task_id: ids.get(task.condition.task_id) || task.condition.task_id } } : {}), status: "pending" }));
      const allTasks = [...history, ...tasks];
      if (tasks.some(task => !/^[a-zA-Z][a-zA-Z0-9_-]{0,63}$/.test(task.id))) throw new Error("Task IDs exceed the supported length after assigning the round prefix");
      checkTasks(allTasks);
      const changed = new Set<string>();
      for (const task of tasks) {
        const old = previous?.tasks.find(t => t.id === task.id);
        if (old && (!deep || roundIds.has(old.id)) && this.taskDefinition(old) === this.taskDefinition(task)) Object.assign(task, { status: old.status, attempts: old.attempts, reason: old.reason });
        else changed.add(task.id);
      }
      let expanded = true;
      while (expanded) { expanded = false; for (const task of tasks) if (!changed.has(task.id) && task.depends_on!.some(id => changed.has(id))) { changed.add(task.id); expanded = true; } }
      for (const task of tasks) if (changed.has(task.id)) { task.status = "pending"; task.attempts = 0; task.reason = undefined; }
      const graph: TaskGraph = { schema_version: 1, plan_sha256: hash(plan), status: "pending", tasks: allTasks,
        ...(deep ? { deep_round: deep.round, current_task_ids: tasks.map(task => task.id) } : {}) };
      await atomicWriteJson(this.graphPath(run), graph as unknown as Json);
      if (deep) { currentRound(deep).task_ids = tasks.map(task => task.id); deep.phase = "execution"; await this.saveRun(run); }
      await this.event(run, "formulated", { task_ids: tasks.map(t => t.id), invalidated: [...changed] });
      return this.result(run, { graph, formulation_path: this.graphPath(run), next_tool: "seekbrain_execution_run" });
    });
  }
  private taskDefinition(task: Task): string { const { status, attempts, reason, run_id, run_dir, output_dir, ...definition } = task; return JSON.stringify(definition); }

  async execute(run: WorkflowRunContext, concurrency = 2, signal?: AbortSignal, onProgress?: (progress: Json) => void, userRequest?: UserRequest): Promise<Json> {
    if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 16) throw new Error("Invalid concurrency");
    return this.exclusive(run, async () => {
      const deep = deepState(run);
      if (deep && deep.phase !== "execution") return this.result(run, { reused: true });
      if (userRequest) { this.recordUserRequest(run, userRequest); await this.saveRun(run); }
      const root = this.root(run), graph = await this.graph(run);
      const roundIds = new Set(deep ? currentRound(deep).task_ids : graph.tasks.map(task => task.id));
      const activeTasks = graph.tasks.filter(task => roundIds.has(task.id));
      const plan = await this.planText(run);
      if (graph.plan_sha256 !== hash(plan)) {
        if (deep) { deep.phase = "formulation"; await this.saveRun(run); }
        return this.result(run, { needs_formulation: true, next_tool: "seekbrain_formulation_generate", message: "Plan changed; re-formulate affected tasks in this same directory." });
      }
      for (const task of activeTasks) {
        if (task.status === "running") task.status = "pending";
        if (!deep && ["failed", "skipped"].includes(task.status)) { task.status = "pending"; task.attempts = 0; }
        if (["complete", "partial"].includes(task.status)) {
          const saved = await readJson(this.taskPath(run, task.id));
          const actual = await availableOutputs(root, saved.result?.usable_outputs || []);
          if (actual.warnings.length) { task.status = "pending"; saved.verify_only = true; saved.repair = actual.warnings.join("\n"); await atomicWriteJson(this.taskPath(run, task.id), saved); }
          else await this.copyTaskSummary(run, task, !deep && graph.tasks.length === 1 ? root : join(root, "tasks", task.id));
        }
      }
      graph.status = "running";
      const active = new Map<string, Promise<void>>(), byId = new Map(graph.tasks.map(t => [t.id, t]));
      let queue: Promise<unknown> = Promise.resolve();
      const save = () => { const snapshot = structuredClone(graph); const write = queue.then(() => atomicWriteJson(this.graphPath(run), snapshot as unknown as Json)); queue = write.catch(() => {}); return write; };
      await save();
      try {
        while (activeTasks.some(t => !finished(t))) {
          signal?.throwIfAborted();
          const ready = activeTasks.filter(t => t.status === "pending" && t.depends_on!.every(id => finished(byId.get(id)!))).sort((a, b) => (b.priority || 0) - (a.priority || 0));
          for (const task of ready) {
            if (active.size >= concurrency) break;
            const dependency = await this.inputs(run, task);
            if (dependency.blocked) { task.status = "skipped"; task.reason = dependency.blocked; await save(); continue; }
            if (task.condition) {
              const producer = await readJson(this.taskPath(run, task.condition.task_id));
              if (await decisionValue(root, producer.result || {}, task.condition.key) !== task.condition.equals) { task.status = "skipped"; task.reason = `Pilot condition not met: ${task.condition.key}`; await save(); continue; }
            }
            task.status = "running"; task.reason = undefined; await save();
            const operation = this.runTask(run, task, graph, dependency.inputs, signal, onProgress).then(() => save()).finally(() => active.delete(task.id));
            active.set(task.id, operation);
          }
          if (active.size) await Promise.race(active.values());
          else if (activeTasks.some(t => !finished(t))) throw new Error("No task can make progress; check dependency inputs");
        }
        graph.status = activeTasks.every(t => t.status === "complete") ? "complete" : "complete_with_failures";
        await save();
        if (deep) { deep.phase = "report"; await this.saveRun(run); }
        await this.event(run, "execution_finished", { status: graph.status });
      } finally { await Promise.allSettled(active.values()); await queue; await save(); }
      return this.result(run, { graph, next_tool: "seekbrain_report_generate" });
    });
  }

  private async inputs(run: WorkflowRunContext, task: Task): Promise<{ inputs: Json[]; blocked?: string }> {
    const inputs: Json[] = [];
    for (const id of task.depends_on || []) {
      let producer: Json;
      try { producer = await readJson(this.taskPath(run, id)); } catch { return { inputs, blocked: `Dependency has no usable result: ${id}` }; }
      const actual = await availableOutputs(this.root(run), producer.result?.usable_outputs || []);
      const withdrawn = new Set(deepState(run)?.invalidated_outputs.map(output => output.path) || []);
      actual.outputs = actual.outputs.filter(output => !withdrawn.has(output.path));
      const requested = (task.inputs || []).filter(i => i.task_id === id);
      if (!requested.length && !actual.outputs.length) return { inputs, blocked: `Dependency has no reviewed usable outputs: ${id}` };
      for (const input of requested) {
        const producerPath = input.path ? relative(this.root(run), new PathPolicy(this.root(run)).resolve(resolve(this.root(run), producer.output_dir || ".", input.path))) : undefined;
        if (input.required !== false && !actual.outputs.some(a => (!input.role || a.role === input.role) && (!input.path || a.path === input.path || a.path === producerPath))) return { inputs, blocked: `Required dependency output unavailable: ${id} ${input.role || input.path || ""}` };
      }
      inputs.push({ task_id: id, outputs: actual.outputs, limits: producer.validation?.limits || [], warnings: actual.warnings });
    }
    return { inputs };
  }

  private async copyTaskSummary(run: WorkflowRunContext, task: Task, workDir: string): Promise<void> {
    try {
      const candidates = (await readdir(workDir, { withFileTypes: true })).filter(entry =>
        entry.isFile() && extname(entry.name).toLowerCase() === ".md",
      );
      if (candidates.length !== 1) return;
      const paths = new PathPolicy(this.root(run));
      const source = paths.resolve(join(workDir, candidates[0].name));
      const destination = paths.resolve(join("tasks", `${task.id}.md`));
      if (source === destination) return;
      await mkdir(dirname(destination), { recursive: true });
      await copyFile(source, destination);
    } catch (error) {
      // This browsing copy must never change the scientific task's status.
      await this.event(run, "task_summary_copy_failed", { task_id: task.id, error: String(error) });
    }
  }

  private async runTask(parent: WorkflowRunContext, task: Task, graph: TaskGraph, inputs: Json[], signal?: AbortSignal, onProgress?: (progress: Json) => void): Promise<void> {
    const root = this.root(parent), statePath = this.taskPath(parent, task.id), runDir = dirname(statePath);
    await mkdir(runDir, { recursive: true });
    const workDir = !deepState(parent) && graph.tasks.length === 1 ? root : join(root, "tasks", task.id);
    await mkdir(workDir, { recursive: true });
    let old: Json = {}; try { old = await readJson(statePath); } catch { /* first attempt */ }
    if (old.instruction && old.instruction !== task.instruction) { old.result = undefined; old.validation = undefined; old.repair = undefined; old.verify_only = false; }
    const state: Json = { ...old, error: undefined, run_id: old.run_id || randomUUID(), task_id: task.id, output_dir: relative(root, workDir), instruction: task.instruction };
    const run: WorkflowRunContext = { runId: state.run_id, runDir, statePath, state: { ...state, project_dir: root } };
    const persist = () => atomicWriteJson(statePath, state);
    const progress = async (stage: string) => { await this.event(parent, stage, { task_id: task.id, output_dir: state.output_dir }); try { onProgress?.({ task_id: task.id, task_status: task.status, stage, project_dir: root, output_dir: workDir }); } catch { /* display only */ } };
    try {
      await persist();
      const instruction = `${task.instruction}\n\nWorking/output directory: ${workDir}\nAll outputs must remain inside: ${root}\nInput paths are read-only and resolve against: ${parent.state.request_cwd}\nDatasets: ${JSON.stringify(parent.state.dataset_paths)}\nReference materials: ${JSON.stringify(parent.state.reference_paths)}\nRelevant plans: ${JSON.stringify(this.planPaths(parent))}\nUsable dependency inputs:\n${JSON.stringify(inputs)}\nExpected results: ${JSON.stringify(task.expected_results || [])}\nKey scientific checks: ${JSON.stringify(task.checks || [])}`;
      const maxAttempts = this.dependencies.maxCodeAttempts || 3;
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        signal?.throwIfAborted(); task.attempts = (task.attempts || 0) + 1;
        await progress(state.verify_only ? "validation_resumed" : "code_started");
        const before = await inventory(workDir, root);
        const payload = state.verify_only ? { summary: state.execution?.summary || "Reusing completed computation" } : await this.dependencies.runAgent({ stage: "code", run, workDir, schema: CodeResultSchema, signal,
          prompt: `${instruction}\n\nExisting outputs: ${JSON.stringify(state.result?.outputs || [])}\nRepair feedback: ${state.repair || ""}\nInspect existing results before computing; reuse complete results and repair only affected code/rendering. Return actual output paths; no fixed filenames, separate conclusion or mandatory statistics JSON.` });
        const recorded = await recordOutputs(root, workDir, before, payload, state.result?.outputs || []);
        state.execution = { status: agentEnded(payload) ? "completed" : "incomplete", summary: payload.summary || "", error: payload.__agent?.error, warnings: [...(payload.warnings || []), ...(payload.__agent?.warnings || []), ...recorded.warnings], finalize_recovered: payload.__agent?.normal_end && !payload.__agent?.ok };
        state.result = { outputs: recorded.outputs, usable_outputs: [], decisions: payload.decisions || state.result?.decisions || {} };
        await persist();
        if (!agentEnded(payload)) {
          if (signal?.aborted) throw new Error("Task interrupted");
          state.repair = `Execution incomplete: ${payload.__agent?.error || "unknown error"}. Inspect and reuse existing outputs before a local repair.`;
          throw new Error(state.repair);
        }
        await progress("validation_started");
        state.verify_only = true;
        state.validation = { decision: "unreviewed", issues: ["Verification has not completed"] };
        await persist();
        const verdict = await this.dependencies.runAgent({ stage: "validation", run, workDir, schema: ValidationResultSchema, signal,
          prompt: `${instruction}\n\nActual output inventory:\n${JSON.stringify(recorded.outputs)}\nExecution information:\n${JSON.stringify(state.execution)}\nJudge scientific validity, not filenames or missing auxiliary files. Select usable_paths relative to the output root for partial results; accepted may omit usable_paths to accept the inventory. Require a repair only for an actual scientific/computational error.` });
        if (!agentEnded(verdict) || !["accepted", "partial", "retry", "unusable"].includes(verdict.decision)) {
          state.validation = { decision: "unreviewed", issues: [verdict.__agent?.error || "No scientific verdict was returned"] };
          state.repair = "Validation did not finish. Preserve the computation; retry verification rather than redoing the analysis.";
          state.verify_only = true;
          await persist();
          throw new Error(state.repair);
        }
        state.validation = { decision: verdict.decision, issues: verdict.issues || [], limits: verdict.limits || [], repair: verdict.repair || "" };
        const selected = new Set<string>();
        for (const path of verdict.usable_paths || []) {
          try {
            const fromRoot = new PathPolicy(root).resolve(path);
            const actual = existsSync(fromRoot) ? fromRoot : new PathPolicy(root).resolve(resolve(workDir, path));
            selected.add(relative(root, actual));
          } catch (error) { state.validation.issues.push(`Usable path could not be registered: ${String(error)}`); }
        }
        state.result.usable_outputs = recorded.outputs.filter(a => a.kind !== "log" && (verdict.decision === "accepted" && !verdict.usable_paths || selected.has(a.path) || recorded.outputs.some(parent => parent.entry_type === "directory" && selected.has(parent.path) && a.path.startsWith(`${parent.path}/`))));
        state.verify_only = false;
        await sealOutputs(root, state.result.usable_outputs);
        await persist(); await progress("validation_completed");
        if (["accepted", "partial"].includes(verdict.decision)) { task.status = verdict.decision === "accepted" && state.result.usable_outputs.length ? "complete" : "partial"; task.reason = verdict.issues?.join("; "); await progress("task_completed"); return; }
        state.repair = verdict.repair || verdict.issues?.join("\n") || "Correct the identified scientific error.";
        await persist();
        if (verdict.decision !== "retry" || attempt + 1 >= maxAttempts) { task.status = state.result.usable_outputs.length ? "partial" : "failed"; task.reason = state.repair; return; }
      }
    } catch (error) {
      task.status = signal?.aborted ? "pending" : "failed"; task.reason = String(error);
      state.error = task.reason;
      const interrupted = !!deepState(parent) && (signal?.aborted || state.verify_only || state.execution?.status === "incomplete");
      if (interrupted) task.status = "pending";
      await persist(); await progress(signal?.aborted || interrupted ? "task_interrupted" : "task_failed");
      if (interrupted) throw error;
    } finally {
      await this.copyTaskSummary(parent, task, workDir);
    }
  }

  async evidence(run: WorkflowRunContext): Promise<Json> {
    const graph = await this.graph(run), evidence: Json[] = [], progress: Json[] = [], coverage: Json[] = [];
    for (const task of graph.tasks) {
      let state: Json = {}; try { state = await readJson(this.taskPath(run, task.id)); } catch { /* task has not started */ }
      const available = await availableOutputs(this.root(run), state.result?.usable_outputs || []);
      const withdrawn = new Set(deepState(run)?.invalidated_outputs.map(output => output.path) || []);
      available.outputs = available.outputs.filter(output => !withdrawn.has(output.path));
      if (available.outputs.length) evidence.push({ evidence_id: task.id, outputs: available.outputs, validation: state.validation, execution: state.execution, warnings: available.warnings });
      progress.push({ task_id: task.id, status: task.status, reason: task.reason, execution: state.execution, validation: state.validation, outputs: state.result?.outputs || [] });
      coverage.push({ task_id: task.id, status: task.status, included: available.outputs.length > 0, reason: task.reason, warnings: available.warnings });
    }
    return { ok: true, flow_version: "0.1.4", original_request: run.state.original_request, output_root: this.root(run), execution_status: graph.status, evidence, progress, coverage, ...(deepState(run) ? { invalidated_outputs: deepState(run)!.invalidated_outputs } : {}), partial: coverage.some(c => !c.included || c.status !== "complete") };
  }

  async report(run: WorkflowRunContext, goal?: string, signal?: AbortSignal, formatOverrides?: Json, targets: ReportTargets = {}, userRequest?: UserRequest): Promise<Json> {
    const completed = deepState(run);
    if (completed && ["decision", "complete"].includes(completed.phase) && userRequest && currentRound(completed).report_request_id !== userRequest.messageId) {
      return this.report({ ...run, interactionMode: "research" } as StudyRun, goal, signal, formatOverrides, targets, userRequest);
    }
    return this.exclusive(run, async () => {
      if (userRequest) { this.recordUserRequest(run, userRequest); await this.saveRun(run); }
      const deep = deepState(run);
      if (deep && ["decision", "export", "complete"].includes(deep.phase)) return this.result(run, { reused: true, report: run.state.report });
      const root = this.root(run), bundle = await this.evidence(run), reportDir = join(run.runDir, "reports", randomUUID());
      await mkdir(reportDir, { recursive: true });
      const evidencePath = join(reportDir, "evidence.json"); await atomicWriteJson(evidencePath, bundle);
      const previousReport = deep && run.state.report ? { ...run.state.report } : undefined;
      const pdfPolicy = await this.pdfPolicy();
      const formats = reportFormats(targets.output_formats || (deep ? run.state.report?.formats : undefined), pdfPolicy);
      const markdownTarget = targets.report_path ? this.requestedPath(run, targets.report_path) : deep && run.state.report?.path ? resolve(root, run.state.report.path) : !formats.includes("markdown") ? join(reportDir, "draft.md") : targets.pdf_path && !pdfPolicy.enabled ? this.requestedPath(run, targets.pdf_path).replace(/\.pdf$/i, ".md") : resolve(root, "report.md");
      if (extname(markdownTarget).toLowerCase() !== ".md") throw new Error("The report writing target must be Markdown; pass pdf_path for a PDF.");
      const pdfPath = targets.pdf_path ? this.requestedPath(run, targets.pdf_path) : deep && run.state.report?.pdf_target ? resolve(root, run.state.report.pdf_target) : markdownTarget.replace(/\.md$/i, ".pdf");
      if (formats.includes("pdf") && extname(pdfPath).toLowerCase() !== ".pdf") throw new Error("PDF output must use the .pdf extension.");
      await mkdir(dirname(markdownTarget), { recursive: true });
      const format = resolveReportFormat([run.state.original_request, ...(run.state.user_updates || []), goal || ""].join("\n"), formatOverrides || (deep ? run.state.report?.format : undefined));
      // Only the current target is invalidated; other named reports remain intact.
      if (formats.includes("pdf")) await unlink(pdfPath).catch(error => { if (error.code !== "ENOENT") throw error; });
      if (run.state.report && resolve(root, run.state.report.path) === markdownTarget) {
        run.state.report = { ...run.state.report, pdf_path: undefined, markdown_complete: false, status: "draft" }; await this.saveRun(run);
      }
      const reportRun = { ...run, runDir: reportDir };
      const result = await this.dependencies.runAgent({ stage: "report", run: reportRun, workDir: root, schema: ReportResultSchema, signal,
        prompt: `${await this.context(run)}\n\nPlans: ${JSON.stringify(this.planPaths(run))}\nReport goal: ${goal || "Follow the original request."}\nReport format: ${JSON.stringify(format)}\n${deep ? `Update a cumulative report using the previous report at ${previousReport?.path || "none"} and all still-valid evidence across rounds. Reuse verified background, methods and references when applicable; revise conclusions when evidence changes. Clearly distinguish unresolved limitations and exploratory follow-up. This round produces Markdown; any enabled PDF export happens only after the research decision is finish.\n` : ""}Current evidence and progress:\n${JSON.stringify(bundle)}\nRead actual files against the output root. Unreviewed/invalid outputs support progress explanations only, never scientific findings. Write the report Markdown to this exact path: ${markdownTarget}\nUse absolute figure links for an internal draft outside the output root's display location. Finalize the exact report_path. ${formats.includes("pdf") ? `The program renders PDF to ${pdfPath}; do not render it yourself.` : "PDF output is disabled for this report. Finish after writing Markdown; do not generate a PDF."} References and conclusions belong here, not in execution tasks.` });
      const path = resolve(root, result.report_path || markdownTarget);
      if (path !== markdownTarget) throw new Error("Report was not written to the requested path");
      if (!agentEnded(result) || !(await readFile(path, "utf8")).trim()) throw new Error(result.__agent?.error || "No completed report is available");
      const mode = bundle.evidence.length ? result.mode || "scientific_report" : "progress_report";
      let pdf: Json = { ok: true, skipped: true };
      if (formats.includes("pdf") && !deep) {
        await mkdir(dirname(pdfPath), { recursive: true });
        try { pdf = await exportReportPdf({ markdownPath: path, pdfPath, style: "brief_communication", command: pdfPolicy.command, timeoutSeconds: pdfPolicy.timeoutSeconds, signal }); }
        catch (error) { pdf = { ok: false, error: String(error) }; }
        if (!pdf.ok) await unlink(pdfPath).catch(error => { if (error.code !== "ENOENT") pdf.cleanup_warning = String(error); });
      }
      run.state.report = { markdown_complete: true, path: this.storedPath(run, path), pdf_path: pdf.ok && !pdf.skipped ? this.storedPath(run, pdfPath) : undefined, pdf_target: formats.includes("pdf") ? this.storedPath(run, pdfPath) : undefined, formats, ...(deep ? { format, pdf_pending: formats.includes("pdf") } : {}), mode, status: !pdf.ok ? "draft" : mode === "progress_report" ? "progress" : "complete" };
      if (deep) {
        currentRound(deep).report = await snapshotDocument(run, deep.round, path, "report.md");
        currentRound(deep).report_request_id = userRequest?.messageId || deep.request_id;
        if (["complete", "complete_with_failures"].includes(bundle.execution_status)) deep.phase = "decision";
      }
      await this.saveRun(run); await this.event(run, "report_generated", run.state.report);
      return this.result(run, { report_path: formats.includes("markdown") ? path : undefined, markdown_source_path: path, pdf_path: pdf.ok && !pdf.skipped ? pdfPath : undefined, report_status: run.state.report.status, pdf_export: pdf, evidence_path: evidencePath, partial: bundle.partial, coverage: bundle.coverage });
    });
  }

  async enableDeepResearch(run: WorkflowRunContext, maxRounds?: number): Promise<void> {
    if ((run as StudyRun).interactionMode !== "deep-research") return;
    await this.exclusive(run, () => this.initializeDeepResearch(run, maxRounds));
  }

  private async initializeDeepResearch(run: WorkflowRunContext, maxRounds?: number): Promise<void> {
    if (run.state.deep_research?.rounds) return;
    const limit = maxRounds ?? 3;
    if (!Number.isInteger(limit) || limit < 1) throw new Error("max_rounds must be a positive integer");
    const round = newRound(1);
    const plans = this.planPaths(run).filter(existsSync);
    let graph: TaskGraph | undefined;
    try { graph = await this.graph(run); } catch { /* a new project has no tasks */ }
    round.task_ids = graph?.tasks.map(task => task.id) || [];
    const report = run.state.report;
    const hasReport = report && report.mode && existsSync(resolve(this.root(run), report.path));
    run.state.deep_research = { round: 1, max_rounds: limit,
      phase: hasReport && graph && graph.tasks.every(finished) ? "decision" : graph ? graph.tasks.every(finished) ? "report" : "execution" : plans.length ? "formulation" : "plan",
      request_id: [...(run.state.user_conversation || [])].reverse().find((message: UserConversationMessage) => message.role === "user")?.id || run.state.plan_request_key,
      rounds: [round], invalidated_outputs: [] };
    if (plans.length) {
      round.plan_paths = plans.map(path => this.storedPath(run, path));
      round.plan_snapshots = await Promise.all(plans.map((path, index) => snapshotDocument(run, 1, path, `plan-${index + 1}${extname(path)}`)));
      run.state.selected_plan_paths = [...round.plan_paths];
    }
    if (hasReport) {
      round.report = await snapshotDocument(run, 1, resolve(this.root(run), report.path), "report.md");
      round.report_request_id = deepState(run)!.request_id;
    }
    await this.saveRun(run);
  }

  private async recordRoundPlan(run: WorkflowRunContext, paths: string[]): Promise<void> {
    const state = deepState(run)!, round = currentRound(state);
    round.plan_paths = paths.map(path => this.storedPath(run, path));
    round.plan_snapshots = await Promise.all(paths.map((path, index) => snapshotDocument(run, state.round, path, `plan-${index + 1}${extname(path)}`)));
    state.phase = "formulation";
  }

  private async pdfPolicy(): Promise<ReportPdfPolicy> {
    return this.dependencies.reportPdfPolicy ? this.dependencies.reportPdfPolicy() : { enabled: true };
  }

  async reportComplete(run: WorkflowRunContext): Promise<boolean> {
    return this.exclusive(run, async () => {
      const report = run.state.report;
      if (!report || !existsSync(resolve(this.root(run), report.path))) return false;
      const policy = await this.pdfPolicy();
      const formats = reportFormats(report.formats, policy);
      // A completed Markdown survives a failed PDF export, but not an interrupted rewrite.
      if (!policy.enabled && (report.markdown_complete || ["complete", "progress"].includes(report.status))) {
        report.formats = formats; report.pdf_path = undefined; report.pdf_target = undefined; report.pdf_pending = false;
        report.status = report.mode === "progress_report" ? "progress" : "complete";
        await this.saveRun(run);
      }
      return ["complete", "progress"].includes(report.status) && (!formats.includes("pdf") || !!report.pdf_path && existsSync(resolve(this.root(run), report.pdf_path)));
    });
  }

  async researchStatus(run: WorkflowRunContext): Promise<Json> {
    const state = deepState(run);
    if (!state) return this.result(run, {});
    const evidence = existsSync(this.graphPath(run)) ? await this.evidence(run) : undefined;
    return this.result(run, { report: run.state.report, execution_status: evidence?.execution_status, coverage: evidence?.coverage,
      plan_paths: currentRound(state).plan_paths, invalidated_outputs: state.invalidated_outputs,
      ...(state.phase === "decision" ? { decision_context: { report: currentRound(state).report, evidence, instructions: "Read the current report and relevant execution/validation evidence. Record continue with a concrete useful next_focus, or finish with the actual reason. Failed computation is not a negative finding. Do not extend the user's scope or seek statistical significance through repeated analyses." } } : {}) });
  }

  async decide(run: WorkflowRunContext, request: ResearchDecision, signal?: AbortSignal): Promise<Json> {
    return this.exclusive(run, async () => {
      const state = deepState(run);
      if (!state) throw new Error("Research decisions are available only in Deep Research mode");
      signal?.throwIfAborted();
      const round = state.rounds.find(round => round.number === request.round);
      if (!round) throw new Error("Unknown research round");
      const input = decisionRequest(request);
      if (round.decision) {
        if (JSON.stringify(decisionRequest(round.decision)) !== JSON.stringify(input)) throw new Error("This round already has a recorded decision; resume the current round instead");
        if (state.phase !== "export" || state.round !== request.round) return this.result(run, { reused: true, decision: round.decision });
      } else {
        if (state.round !== request.round || state.phase !== "decision" || !round.report) throw new Error("Complete this round's report before recording its decision");
        if (!request.reason?.trim()) throw new Error("A brief decision reason is required");
        if (request.action === "continue" && !request.next_focus?.trim()) throw new Error("Continuing requires a concrete next_focus");
        const graph = await this.graph(run);
        if (graph.tasks.some(task => round.task_ids.includes(task.id) && !finished(task))) throw new Error("The current execution is still incomplete; resume it before deciding the next round");
        const known = new Set<string>();
        for (const task of graph.tasks) {
          const saved = await readJson(this.taskPath(run, task.id)).catch(() => ({} as Json));
          for (const output of saved.result?.outputs || []) known.add(output.path);
        }
        const paths = [...new Set((request.invalidate_paths || []).map(path => relative(this.root(run), new PathPolicy(this.root(run)).resolve(path))))];
        for (const path of paths) if (!known.has(path)) throw new Error(`Cannot withdraw an unregistered output: ${path}`);
        let changedEvidence = false;
        for (const path of paths) if (!state.invalidated_outputs.some(output => output.path === path)) {
          state.invalidated_outputs.push({ path, reason: request.reason, round: request.round }); changedEvidence = true;
        }
        if (changedEvidence && (request.action === "finish" || state.round >= state.max_rounds)) {
          state.phase = "report";
          await this.saveRun(run);
          return this.result(run, { needs_report_update: true, message: "Evidence was withdrawn. Update the current report against the corrected evidence before finishing." });
        }
        round.decision = { ...input, effective_action: request.action,
          ...(request.action === "continue" && state.round >= state.max_rounds ? { effective_action: "finish", stop_reason: "round_limit" } : {}) };
        if (round.decision.effective_action === "continue") {
          state.round++;
          state.rounds.push(newRound(state.round));
          state.phase = "plan";
        } else state.phase = "export";
        await this.saveRun(run);
        await this.event(run, "research_decision", round.decision);
      }
      if (state.phase === "export") {
        const report = run.state.report;
        const pdfPolicy = await this.pdfPolicy();
        report.formats = reportFormats(report.formats, pdfPolicy);
        if (!pdfPolicy.enabled) { report.pdf_path = undefined; report.pdf_target = undefined; }
        if (report.formats.includes("pdf") && !report.pdf_path) {
          report.pdf_target ||= report.path.replace(/\.md$/i, ".pdf");
          const source = resolve(this.root(run), report.path), destination = resolve(this.root(run), report.pdf_target);
          await mkdir(dirname(destination), { recursive: true });
          let exported: Json;
          try { exported = await exportReportPdf({ markdownPath: source, pdfPath: destination, style: "brief_communication", command: pdfPolicy.command, timeoutSeconds: pdfPolicy.timeoutSeconds, signal }); }
          catch (error) { exported = { ok: false, error: String(error) }; }
          if (!exported.ok) {
            await unlink(destination).catch(() => {});
            signal?.throwIfAborted();
            return this.result(run, { ok: false, decision: round.decision, pdf_export: exported, markdown_source_path: source });
          }
          report.pdf_path = this.storedPath(run, destination);
        }
        report.pdf_pending = false;
        state.phase = "complete";
        await this.saveRun(run);
        await this.event(run, "research_finished", { round: state.round, reason: round.decision?.stop_reason || round.decision?.reason });
      }
      return this.result(run, { decision: round.decision, report_path: run.state.report?.formats.includes("markdown") ? resolve(this.root(run), run.state.report.path) : undefined,
        markdown_source_path: run.state.report ? resolve(this.root(run), run.state.report.path) : undefined,
        pdf_path: run.state.report?.pdf_path ? resolve(this.root(run), run.state.report.pdf_path) : undefined });
    });
  }

  private async exclusive<T>(run: WorkflowRunContext, operation: () => Promise<T>): Promise<T> {
    const path = join(run.runDir, ".workflow.lock"); let lock;
    try { lock = await open(path, "wx"); } catch (error: any) {
      if (error.code !== "EEXIST") throw error;
      let owner: Json;
      try { owner = await readJson(path); } catch { throw new Error("Study already has an active workflow"); }
      let stale = false;
      if (owner.host === hostname()) { try { process.kill(owner.pid, 0); } catch (failure: any) { stale = failure.code === "ESRCH"; } }
      if (!stale) throw new Error("Study already has an active workflow");
      await unlink(path); return this.exclusive(run, operation);
    }
    try { await lock.writeFile(JSON.stringify({ pid: process.pid, host: hostname() })); return await operation(); }
    finally { await lock.close(); await unlink(path); }
  }
}
