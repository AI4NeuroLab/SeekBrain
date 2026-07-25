import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { copyFile, mkdir, readFile, rm } from "node:fs/promises";
import { basename, dirname, extname, join, relative } from "node:path";
import { ArtifactService } from "../../../core/index.ts";
import type { WorkflowRunContext } from "../../../workflows/index.ts";
import type { Json } from "../runtime-types.ts";

export type Artifact = {
  name?: string;
  path: string;
  kind: "figure" | "statistics" | "data" | "code" | "markdown" | "json" | "log" | "other";
  role?: string;
  description?: string;
  optional?: boolean;
  produced_by?: string;
  content?: string;
};

export const DEFAULT_DELIVERABLES: Artifact[] = [
  { path: "generated_code.py", kind: "code" },
  { path: "figure.png", kind: "figure", role: "main" },
  { path: "figure.pdf", kind: "figure", role: "main_pdf", optional: true },
  { path: "statistics.json", kind: "statistics" },
];

function imageMediaType(path: string) {
  const suffix = extname(path).toLowerCase();
  if (suffix === ".png") return "image/png";
  if (suffix === ".jpg" || suffix === ".jpeg") return "image/jpeg";
  if (suffix === ".webp") return "image/webp";
  throw new Error(`unsupported vision image type '${suffix || "unknown"}'`);
}

const VISION_IMAGE_EXTS = new Set([".png", ".jpg", ".jpeg", ".webp"]);

export function isVisionImage(path: string) {
  return VISION_IMAGE_EXTS.has(extname(path).toLowerCase());
}

export function resolveArtifactPath(runDir: string, artifactPath: string) {
  return new ArtifactService(runDir).paths.resolve(artifactPath);
}

export function inferArtifactKind(name: string, path: string): Artifact["kind"] {
  return new ArtifactService(process.cwd()).inferKind(name, path) as Artifact["kind"];
}

export function normalizeArtifact(raw: any, runDir: string, fallbackName?: string): Artifact | undefined {
  if (!raw || typeof raw !== "object" || !raw.path) return undefined;
  try {
    return new ArtifactService(runDir).normalize(raw, fallbackName) as Artifact;
  } catch {
    return undefined;
  }
}

export function normalizeArtifacts(input: any, runDir: string): Artifact[] {
  return new ArtifactService(runDir).normalizeMany(input) as Artifact[];
}

export function mergeArtifacts(existing: any, incoming: any, runDir: string): Artifact[] {
  return new ArtifactService(runDir).merge(existing, incoming) as Artifact[];
}

export function makeArtifact(runDir: string, name: string, path: string, kind: Artifact["kind"], extra: Partial<Artifact> = {}) {
  return new ArtifactService(runDir).make(name, path, kind, extra as any) as Artifact;
}

export function stateArtifacts(run: WorkflowRunContext) {
  return normalizeArtifacts(run.state.artifacts || [], run.runDir);
}

export function figureArtifacts(deliverables: Artifact[]): Artifact[] {
  return (deliverables || []).filter((artifact) => artifact.kind === "figure" && isVisionImage(artifact.path));
}

export async function createRefinementGuard(run: WorkflowRunContext) {
  const backupDir = join(run.runDir, ".neuro-refine-guard", randomUUID());
  const guarded: Array<{ source: string; backup: string; immutable: boolean }> = [];
  const candidates = stateArtifacts(run).filter((artifact) =>
    ["data", "statistics", "code", "figure"].includes(artifact.kind)
  );
  for (const [index, artifact] of candidates.entries()) {
    const source = resolveArtifactPath(run.runDir, artifact.path);
    const rel = relative(run.runDir, source);
    if (!rel || rel.startsWith("..") || rel.startsWith("/") || !existsSync(source)) continue;
    const backup = join(backupDir, `${index}-${basename(source)}`);
    await mkdir(dirname(backup), { recursive: true });
    await copyFile(source, backup);
    guarded.push({
      source,
      backup,
      immutable: artifact.kind === "data" || artifact.kind === "statistics",
    });
  }
  return { backupDir, guarded };
}

export async function finalizeRefinementGuard(
  guard: Awaited<ReturnType<typeof createRefinementGuard>>,
  subagentSucceeded: boolean,
) {
  const violations: string[] = [];
  if (subagentSucceeded) {
    for (const item of guard.guarded.filter((entry) => entry.immutable)) {
      try {
        const [before, after] = await Promise.all([readFile(item.backup), readFile(item.source)]);
        if (!before.equals(after)) violations.push(item.source);
      } catch {
        violations.push(item.source);
      }
    }
  }
  const accepted = subagentSucceeded && violations.length === 0;
  if (!accepted) {
    for (const item of guard.guarded) {
      try {
        await copyFile(item.backup, item.source);
      } catch {
        // Best-effort rollback; the caller reports the integrity failure.
      }
    }
  }
  await rm(guard.backupDir, { recursive: true, force: true }).catch(() => {});
  return { accepted, violations };
}

async function loadImageForPrompt(path: string) {
  const data = await readFile(path);
  return {
    type: "image",
    mimeType: imageMediaType(path),
    data: data.toString("base64"),
  };
}

export async function loadVisionImages(paths: string[]) {
  const images: Json[] = [];
  const warnings: string[] = [];
  const loadedPaths: string[] = [];
  for (const path of paths.filter(Boolean)) {
    try {
      images.push(await loadImageForPrompt(path));
      loadedPaths.push(path);
    } catch (error) {
      warnings.push(`failed to load image '${path}': ${String(error)}`);
    }
  }
  return { images, warnings, loaded_paths: loadedPaths };
}

export function codeArtifactsFromRun(run: WorkflowRunContext) {
  return stateArtifacts(run).filter((artifact) => artifact.kind === "code");
}

export function resolveEditableCodePath(run: WorkflowRunContext, requestedPath?: string) {
  const codeArtifacts = codeArtifactsFromRun(run);
  if (requestedPath) {
    const resolved = resolveArtifactPath(run.runDir, requestedPath);
    const known = codeArtifacts.find((artifact) => artifact.path === resolved || artifact.path === requestedPath);
    if (known) return known.path;
    const relativeToRun = relative(run.runDir, resolved);
    if (relativeToRun && !relativeToRun.startsWith("..") && !relativeToRun.startsWith("/")) return resolved;
    return "";
  }
  if (codeArtifacts.length === 1) return codeArtifacts[0].path;
  const defaultPath = resolveArtifactPath(run.runDir, "generated_code.py");
  return existsSync(defaultPath) ? defaultPath : "";
}

export function generatedArtifactsForCodeEdit(run: WorkflowRunContext, codePath: string, scope: string) {
  const produced = stateArtifacts(run).filter((artifact) => artifact.produced_by === codePath);
  const scoped = scope === "presentation"
    ? produced.filter((artifact) => artifact.kind === "figure")
    : produced.filter((artifact) => artifact.kind !== "code" && artifact.kind !== "log");
  if (scoped.length) return scoped;
  return scope === "presentation" ? stateArtifacts(run).filter((artifact) => artifact.kind === "figure") : [];
}

