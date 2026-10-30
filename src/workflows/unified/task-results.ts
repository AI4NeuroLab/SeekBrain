import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { ArtifactService, atomicWriteJson } from "../../core/index.ts";
import type { WorkflowJson, WorkflowRunContext, RunLifecycleWorkflow } from "../seekbrain/run-lifecycle.ts";

export function currentTaskValidated(run: WorkflowRunContext): boolean {
  return Number(run.state.code_attempt) > 0 && run.state.validation?.pass === true
    && run.state.validation_invalidated_by_code_edit !== true
    && Number(run.state.validation.validated_code_attempt ?? run.state.code_attempt) === Number(run.state.code_attempt);
}

/** Collect existing experimental outputs; no model call or biological conclusion. */
export async function collectTaskResults(run: WorkflowRunContext): Promise<WorkflowJson> {
  if (!currentTaskValidated(run)) throw new Error("Task has no current validated code results");
  const service = new ArtifactService(run.runDir);
  const statisticsPath = service.paths.resolve(String(run.state.code?.statistics_path || "statistics.json"));
  const statisticsText = await readFile(statisticsPath, "utf8");
  const statistics = JSON.parse(statisticsText);
  if (!statistics || typeof statistics !== "object" || Array.isArray(statistics)) throw new Error("Task statistics must be an object");
  const declared = service.normalizeMany(run.state.deliverables || []);
  const artifacts = service.merge(declared, run.state.artifacts || []);
  const fingerprints: WorkflowJson[] = [];
  for (const artifact of artifacts) {
    try {
      const details = await stat(artifact.path);
      if (!details.isFile()) throw new Error("not a file");
      fingerprints.push({ path: artifact.path, size: details.size, mtime_ms: details.mtimeMs });
    } catch (error) {
      if (!artifact.optional) throw new Error(`Validated artifact is unavailable: ${artifact.path}: ${error}`);
    }
  }
  const codeFiles = service.normalizeMany((run.state.code?.code_files || declared.filter(a => a.kind === "code"))
    .map((file: WorkflowJson) => ({ ...file, kind: "code" })));
  if (!codeFiles.length) throw new Error("Task has no recorded code files");
  const sourceHashes: WorkflowJson = { statistics: createHash("sha256").update(statisticsText).digest("hex"), code: {} };
  for (const file of codeFiles) sourceHashes.code[file.path] = createHash("sha256").update(await readFile(file.path)).digest("hex");
  const available = new Set(fingerprints.map(file => file.path));
  return {
    schema_version: 1, run_id: run.runId, run_dir: run.runDir, code_attempt: run.state.code_attempt,
    statistics_path: statisticsPath, statistics, code_files: codeFiles,
    artifacts: artifacts.filter(a => available.has(a.path)), file_fingerprints: fingerprints, source_hashes: sourceHashes,
    exec_log_path: run.state.code?.exec_log_path,
    execution_summary: run.state.code?.summary || "", code_warnings: run.state.code?.warnings || [],
    validation: run.state.validation, execution_contract: run.state.execution_contract,
  };
}

export async function taskResults(run: WorkflowRunContext): Promise<WorkflowJson> {
  const result = await collectTaskResults(run);
  if (run.state.execution_result?.path && Number(run.state.execution_result.code_attempt) === Number(run.state.code_attempt)) {
    const recorded = JSON.parse(await readFile(run.state.execution_result.path, "utf8"));
    if (JSON.stringify(recorded.source_hashes) !== JSON.stringify(result.source_hashes)
      || JSON.stringify(recorded.file_fingerprints) !== JSON.stringify(result.file_fingerprints)) {
      throw new Error("Validated outputs changed after task completion; revalidation is required");
    }
  }
  return result;
}

export async function persistTaskResults(run: WorkflowRunContext, lifecycle: RunLifecycleWorkflow): Promise<WorkflowJson> {
  const result = await taskResults(run);
  const path = join(run.runDir, "result_manifest.json");
  await atomicWriteJson(path, result);
  await lifecycle.updateState(run, { execution_result: { path, code_attempt: run.state.code_attempt }, status: "completed" });
  return { ...result, result_manifest_path: path };
}
