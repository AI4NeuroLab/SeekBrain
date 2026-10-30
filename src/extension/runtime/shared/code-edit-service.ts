import { spawn } from "node:child_process";
import { pythonProcessEnvironment, resolvePythonCommand } from "../../../platform/python.mjs";
import { stopProcessTree } from "../../../platform/process-tree.mjs";
import { randomUUID } from "node:crypto";
import { extname } from "node:path";
import type { Json } from "../runtime-types.ts";

const CODE_EDIT_EXEC_OUTPUT_LIMIT = 1_000_000;

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

function appendLimitedOutput(current: string, chunk: any) {
  if (current.length >= CODE_EDIT_EXEC_OUTPUT_LIMIT) return current;
  return (current + String(chunk)).slice(0, CODE_EDIT_EXEC_OUTPUT_LIMIT);
}

export interface CodeEditServiceDependencies {
  projectRoot: string;
  loadEnv(cwd: string): Promise<NodeJS.ProcessEnv>;
}

export function createCodeEditService(deps: CodeEditServiceDependencies) {
  return {
    createEditId() {
      return `edit_${shortTimestamp()}_${randomUUID().slice(0, 8)}`;
    },

    async rerunApprovedPythonCode(codePath: string, runDir: string, signal?: AbortSignal) {
      if (extname(codePath).toLowerCase() !== ".py") {
        return { ok: false, exit_code: null, error: `Automatic rerun only supports Python code artifacts: ${codePath}` };
      }
      const startedAt = Date.now();
      const env = await deps.loadEnv(deps.projectRoot);
      const pythonCommand = resolvePythonCommand(env);
      return await new Promise<Json>((done) => {
        let stdout = "";
        let stderr = "";
        let settled = false;
        const child = spawn(pythonCommand, [codePath], { cwd: runDir, env: pythonProcessEnvironment(env) });
        const finish = (result: Json) => {
          if (settled) return;
          settled = true;
          signal?.removeEventListener("abort", abort);
          done({ ...result, command: pythonCommand, stdout, stderr, duration_ms: Date.now() - startedAt });
        };
        const abort = () => stopProcessTree(child);
        signal?.addEventListener("abort", abort, { once: true });
        child.stdout?.on("data", (chunk) => { stdout = appendLimitedOutput(stdout, chunk); });
        child.stderr?.on("data", (chunk) => { stderr = appendLimitedOutput(stderr, chunk); });
        child.on("error", (error) => finish({ ok: false, exit_code: null, error: `${error}. Set SEEKBRAIN_PYTHON to a working interpreter.` }));
        child.on("close", (code, childSignal) => finish({
          ok: code === 0,
          exit_code: code,
          signal: childSignal || undefined,
          error: code === 0 ? undefined : `Regeneration exited with code ${code ?? "unknown"}.`,
        }));
        if (signal?.aborted) abort();
      });
    },
  };
}

export type CodeEditService = ReturnType<typeof createCodeEditService>;
