import { createWriteTool, createEditTool } from "@earendil-works/pi-coding-agent";
import { realpath, lstat, readFile, writeFile, access, mkdir } from "node:fs/promises";
import { resolve, dirname, extname } from "node:path";
import type { ExistingPiCustomTool } from "../../existing-pi-agent-adapter.ts";

export async function assertWriteTarget(cwd: string, path: string, targets: string[]): Promise<void> {
  const absolute = resolve(cwd, path);
  if (!targets.some(target => resolve(cwd, target) === absolute)) throw new Error(`Write outside the requested plan files: ${absolute}`);
  // A link introduced in an output path must not redirect a scoped write.
  for (let current = absolute; current !== dirname(current); current = dirname(current)) {
    try { if ((await lstat(current)).isSymbolicLink()) throw new Error(`Symlink output paths are not writable in Plan: ${current}`); }
    catch (error: any) { if (error.code !== "ENOENT") throw error; }
  }
  await realpath(dirname(absolute)).catch(error => { if (error.code !== "ENOENT") throw error; });
}
export function createScopedWriteTools(cwd: string, targets: string[]): ExistingPiCustomTool[] {
  const write = async (path: string, content: string) => {
    await assertWriteTarget(cwd, path, targets);
    if (extname(path).toLowerCase() === ".json") JSON.parse(content);
    await writeFile(path, content, "utf8");
  };
  return [createWriteTool(cwd, { operations: { writeFile: write, mkdir: path => mkdir(path, { recursive: true }).then(() => {}) } }), createEditTool(cwd, { operations: { readFile, writeFile: write, access } })].map(tool => ({
    name: tool.name, label: tool.label, description: `${tool.description} Only the explicitly requested plan files are writable.`, parameters: tool.parameters,
    async execute(id: string, params: any, signal?: AbortSignal) {
      await assertWriteTarget(cwd, params.path, targets);
      return tool.execute(id, params, signal);
    },
  }));
}
