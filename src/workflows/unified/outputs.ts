import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { existsSync } from "node:fs";
import { readdir, stat, readFile } from "node:fs/promises";
import { extname, relative, resolve } from "node:path";
import { PathPolicy } from "../../core/artifacts/path-policy.ts";

type Json = Record<string, any>;
const codeExtensions = new Set([".py", ".r", ".jl", ".m", ".sh", ".js", ".mjs", ".ts"]);
const imageExtensions = new Set([".png", ".jpg", ".jpeg", ".svg", ".pdf", ".webp"]);
export interface OutputRecord { path: string; kind: string; role?: string; entry_type: "file" | "directory"; size: number; sha256?: string }

export function outputKind(path: string): string {
  const suffix = extname(path).toLowerCase();
  if (codeExtensions.has(suffix)) return "code";
  if (imageExtensions.has(suffix)) return "figure";
  if (suffix === ".log") return "log";
  if ([".csv", ".tsv", ".xlsx", ".parquet"].includes(suffix)) return "table";
  if (suffix === ".json") return "statistics";
  if (suffix === ".md") return "markdown";
  return "data";
}

export async function inventory(directory: string, projectRoot: string): Promise<Map<string, string>> {
  const files = new Map<string, string>();
  const walk = async (dir: string, depth: number) => {
    if (depth > 8 || files.size >= 5000) return;
    let entries;
    try { entries = await readdir(dir, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      if (entry.name.startsWith(".") || ["node_modules", "__pycache__"].includes(entry.name) || entry.isSymbolicLink()) continue;
      const path = resolve(dir, entry.name);
      if (entry.isDirectory()) await walk(path, depth + 1);
      else if (entry.isFile()) {
        const info = await stat(path);
        files.set(relative(projectRoot, path), `${info.size}:${info.mtimeMs}`);
      }
    }
  };
  await walk(directory, 0);
  return files;
}

export async function digestFile(path: string): Promise<string> {
  const digest = createHash("sha256");
  for await (const chunk of createReadStream(path)) digest.update(chunk);
  return digest.digest("hex");
}

export async function recordOutputs(root: string, workDir: string, before: Map<string, string>, payload: Json, previous: OutputRecord[] = []): Promise<{ outputs: OutputRecord[]; warnings: string[] }> {
  const paths = new PathPolicy(root);
  const warnings: string[] = [];
  const candidates = new Map<string, Json>();
  for (const entry of previous) candidates.set(entry.path, entry);
  const after = await inventory(workDir, root);
  for (const [path, stamp] of after) if (stamp !== before.get(path)) candidates.set(path, { path });
  for (const entry of [...(payload.outputs || []), ...(payload.code_files || [])]) {
    try {
      const workingPath = resolve(workDir, String(entry.path));
      const path = paths.resolve(existsSync(workingPath) ? workingPath : resolve(root, String(entry.path)));
      candidates.set(relative(root, path), { ...entry, path: relative(root, path) });
    } catch (error) { warnings.push(`Output not registered: ${String(error)}`); }
  }
  const outputs: OutputRecord[] = [];
  for (const [path, entry] of candidates) {
    try {
      if (path.split(/[\\/]/).includes(".seekbrain")) continue;
      const physical = paths.resolve(path);
      const info = await stat(physical);
      if (!info.isFile() && !info.isDirectory()) continue;
      if (info.isFile() && info.size === 0) { warnings.push(`Empty output: ${path}`); continue; }
      outputs.push({ path, kind: entry.kind || outputKind(path), role: entry.role, entry_type: info.isDirectory() ? "directory" : "file", size: info.size });
    } catch (error) { warnings.push(`Output unavailable: ${path}: ${String(error)}`); }
  }
  return { outputs, warnings };
}

export async function sealOutputs(root: string, outputs: OutputRecord[]): Promise<void> {
  const paths = new PathPolicy(root);
  for (const output of outputs) {
    if (output.entry_type === "file" && output.kind !== "log") {
      const physical = paths.resolve(output.path), before = await stat(physical);
      output.sha256 = await digestFile(physical);
      const after = await stat(physical);
      if (before.size === after.size && before.mtimeMs === after.mtimeMs) digestCache.set(physical, { stamp: `${after.size}:${after.mtimeMs}`, digest: output.sha256 });
    }
  }
}

const digestCache = new Map<string, { stamp: string; digest: string }>();
export async function availableOutputs(root: string, outputs: OutputRecord[]): Promise<{ outputs: OutputRecord[]; warnings: string[] }> {
  const paths = new PathPolicy(root), available: OutputRecord[] = [], warnings: string[] = [];
  for (const output of outputs) {
    if (output.kind === "log") continue;
    try {
      const physical = paths.resolve(output.path), info = await stat(physical);
      if (output.sha256 && info.isFile()) {
        const stamp = `${info.size}:${info.mtimeMs}`, cached = digestCache.get(physical);
        const digest = cached?.stamp === stamp ? cached.digest : await digestFile(physical);
        digestCache.set(physical, { stamp, digest });
        if (digest !== output.sha256) { warnings.push(`Content changed; only this output needs revalidation: ${output.path}`); continue; }
      }
      available.push(output);
    } catch (error) { warnings.push(`Output unavailable: ${output.path}: ${String(error)}`); }
  }
  return { outputs: available, warnings };
}

export async function decisionValue(root: string, result: Json, key: string): Promise<unknown> {
  const lookup = (value: Json) => key.split(".").reduce<any>((current, part) => current != null ? current[part] : undefined, value);
  const direct = lookup(result.decisions || {});
  if (direct !== undefined) return direct;
  for (const output of result.outputs || []) if (output.kind === "statistics" && extname(output.path) === ".json") {
    try { const value = lookup(JSON.parse(await readFile(new PathPolicy(root).resolve(output.path), "utf8"))); if (value !== undefined) return value; } catch { /* another output may contain the decision */ }
  }
  return undefined;
}
