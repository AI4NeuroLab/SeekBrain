import { basename, extname } from "node:path";
import type { Artifact, ArtifactKind } from "../schemas/artifact.ts";
import { PathPolicy } from "./path-policy.ts";

export type ArtifactInput = Partial<Omit<Artifact, "path" | "kind">> & {
  path: string;
  kind?: ArtifactKind;
};

const FIGURES = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif", ".pdf"]);
const DATA = new Set([".csv", ".tsv", ".xlsx", ".xls", ".parquet", ".feather", ".npy", ".npz"]);

export class ArtifactService {
  readonly paths: PathPolicy;

  constructor(readonly runDir: string) {
    this.paths = new PathPolicy(runDir);
  }

  inferKind(name: string, path: string): ArtifactKind {
    const lowerName = name.toLowerCase();
    const suffix = extname(path).toLowerCase();
    if (lowerName.includes("statistics")) return "statistics";
    if (lowerName.includes("code") || [".py", ".r", ".jl"].includes(suffix)) return "code";
    if (lowerName.includes("log") || suffix === ".log") return "log";
    if (suffix === ".md") return "markdown";
    if (suffix === ".json") return "json";
    if (FIGURES.has(suffix)) return "figure";
    if (DATA.has(suffix)) return "data";
    return "other";
  }

  normalize(raw: ArtifactInput, fallbackName?: string): Artifact {
    const path = this.paths.resolve(String(raw.path));
    const kind = raw.kind ?? this.inferKind(String(raw.name ?? ""), path);
    const stem = basename(path).replace(/\.[^.]+$/, "");
    return {
      ...raw,
      name: String(raw.name || fallbackName || (stem ? `${kind}_${stem}` : kind)),
      path,
      kind,
      optional: Boolean(raw.optional),
      produced_by: raw.produced_by ? this.paths.resolve(String(raw.produced_by)) : undefined,
    };
  }

  normalizeMany(input: unknown): Artifact[] {
    if (Array.isArray(input)) {
      return input.flatMap((raw) => {
        if (!raw || typeof raw !== "object" || !("path" in raw)) return [];
        return [this.normalize(raw as ArtifactInput)];
      });
    }
    if (!input || typeof input !== "object") return [];
    return Object.entries(input).flatMap(([name, value]) => {
      if (typeof value !== "string" || !value) return [];
      return [this.normalize({ name, path: value, kind: this.inferKind(name, value) }, name)];
    });
  }

  merge(existing: unknown, incoming: unknown): Artifact[] {
    const byPath = new Map<string, Artifact>();
    for (const artifact of this.normalizeMany(existing)) byPath.set(artifact.path, artifact);
    for (const artifact of this.normalizeMany(incoming)) {
      byPath.set(artifact.path, { ...byPath.get(artifact.path), ...artifact });
    }
    return [...byPath.values()];
  }

  make(name: string, path: string, kind: ArtifactKind, extra: Partial<Artifact> = {}): Artifact {
    return this.normalize({ ...extra, name, path, kind }, name);
  }
}
