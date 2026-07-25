import { createTwoFilesPatch } from "diff";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { atomicWriteJson } from "../../../core/index.ts";
import type { Json } from "../runtime-types.ts";

export async function readJson(path: string, fallback: Json = {}) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch {
    return fallback;
  }
}

export async function writeJson(path: string, value: Json) {
  await atomicWriteJson(path, value);
}

export async function writeText(path: string, value: string) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, value, "utf8");
}

export function resolveFromCwd(cwd: string, value: string | undefined, fallback: string) {
  return resolve(cwd, value || fallback);
}

export function unifiedDiff(oldText: string, newText: string, fromPath: string, toPath: string) {
  if (oldText === newText) return [`--- ${fromPath}`, `+++ ${toPath}`, "No changes."].join("\n");
  return createTwoFilesPatch(fromPath, toPath, oldText, newText, "", "", { context: 3 });
}

export async function fileStamp(path: string) {
  try {
    const info = await stat(path);
    return { exists: true, mtime_ms: info.mtimeMs, size: info.size };
  } catch {
    return { exists: false, mtime_ms: 0, size: 0 };
  }
}

export async function artifactStamps(paths: string[]) {
  const entries = await Promise.all(paths.map(async (path) => [path, await fileStamp(path)] as const));
  return Object.fromEntries(entries);
}

