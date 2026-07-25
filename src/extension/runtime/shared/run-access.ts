import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { copyFile, mkdir } from "node:fs/promises";
import { basename, dirname, join, relative } from "node:path";
import type { RunLifecycleWorkflow, WorkflowRunContext } from "../../../workflows/index.ts";
import type { Json } from "../runtime-types.ts";
import {
  DEFAULT_DELIVERABLES,
  resolveArtifactPath,
  stateArtifacts,
  type Artifact,
} from "./artifact-service.ts";
import { writeJson } from "./file-service.ts";

export interface RunAccessDependencies {
  lifecycle: RunLifecycleWorkflow;
  debugDiskWritesEnabled(): boolean;
}

function shortTimestamp() {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  return [
    now.getFullYear(),
    pad(now.getMonth() + 1),
    pad(now.getDate()),
    "-",
    pad(now.getHours()),
    pad(now.getMinutes()),
    pad(now.getSeconds()),
  ].join("");
}

export function createRunAccess(deps: RunAccessDependencies) {
  async function loadRunState(runId: string, runDir: string): Promise<WorkflowRunContext> {
    return deps.lifecycle.loadRunState(runId, runDir);
  }

  function effectiveMetadata(run: WorkflowRunContext, requestedDataInfo?: string, requestedExtraPathInfo?: string) {
    const locked = run.state.metadata_locked === true;
    return {
      data_info: locked ? String(run.state.data_info || "") : String(requestedDataInfo || run.state.data_info || ""),
      extra_path_info: locked ? String(run.state.extra_path_info || "") : String(requestedExtraPathInfo || run.state.extra_path_info || ""),
    };
  }

  function resolveQuestion(run: WorkflowRunContext, question?: string): string {
    const text = String(question || run.state.question || "").trim();
    if (!text) {
      throw new Error("question is required. Pass it to the tool, or persist it first via seekbrain_run_start/seekbrain_run_resume.");
    }
    return text;
  }

  async function startRun(cwd: string, workDir: string, userDeliverables?: any[], question?: string) {
    return deps.lifecycle.startRun(cwd, workDir, userDeliverables, question);
  }

  async function resolveRun(cwd: string, requestedRunId?: string) {
    return deps.lifecycle.resolveRun(cwd, requestedRunId);
  }

  async function resumeRun(cwd: string, workDir: string, question?: string) {
    return deps.lifecycle.resumeRun(cwd, workDir, question);
  }

  async function updateState(run: WorkflowRunContext, patch: Json) {
    await deps.lifecycle.updateState(run, patch);
    return run.state;
  }

  async function snapshotRunArtifacts(run: WorkflowRunContext, label: string) {
    if (!deps.debugDiskWritesEnabled()) return undefined;
    const safeLabel = label.replace(/[^a-zA-Z0-9_.-]+/g, "_").replace(/^_+|_+$/g, "") || "snapshot";
    const snapshotDir = join(run.runDir, "_snapshots", `${shortTimestamp()}_${safeLabel}_${randomUUID().slice(0, 8)}`);
    const deliverables: Artifact[] = run.state.deliverables || DEFAULT_DELIVERABLES;
    const candidates: string[] = [
      join(run.runDir, "exec.log"),
      join(run.runDir, "generated_code.py"),
      join(run.runDir, "figure.png"),
      join(run.runDir, "figure.pdf"),
      join(run.runDir, "statistics.json"),
      join(run.runDir, "validation.json"),
      join(run.runDir, "interpretation.json"),
      join(run.runDir, "conclusions.json"),
      join(run.runDir, "image_analysis.md"),
      join(run.runDir, "figure_analysis.md"),
      ...deliverables.map((artifact) => artifact.path),
      ...stateArtifacts(run).map((artifact) => artifact.path),
    ].filter(Boolean) as string[];
    const seen = new Set<string>();
    const copied: Json[] = [];
    for (const candidate of candidates) {
      const source = resolveArtifactPath(run.runDir, candidate);
      if (seen.has(source) || !existsSync(source)) continue;
      seen.add(source);
      const rel = relative(run.runDir, source);
      const target = rel && !rel.startsWith("..") && !rel.startsWith("/")
        ? join(snapshotDir, rel)
        : join(snapshotDir, "external", basename(source));
      try {
        await mkdir(dirname(target), { recursive: true });
        await copyFile(source, target);
        copied.push({ source, snapshot_path: target });
      } catch {
        continue;
      }
    }
    if (!copied.length) return undefined;
    const manifest = {
      label,
      created_at: new Date().toISOString(),
      copied,
    };
    try {
      await writeJson(join(snapshotDir, "manifest.json"), manifest);
    } catch {
      return { snapshot_dir: snapshotDir, copied, manifest_warning: "diagnostic_write_failed" };
    }
    return { snapshot_dir: snapshotDir, copied };
  }

  return {
    loadRunState,
    effectiveMetadata,
    resolveQuestion,
    startRun,
    resolveRun,
    resumeRun,
    updateState,
    snapshotRunArtifacts,
  };
}

