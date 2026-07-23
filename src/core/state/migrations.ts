import { Value } from "typebox/value";
import { RunStateSchema, type RunState } from "../schemas/run-state.ts";

export type RunStateDocument = RunState & Record<string, unknown>;

export interface RunMigrationContext {
  runId?: string;
  runDir?: string;
}

function inferArtifactKind(path: string): string {
  const suffix = path.toLowerCase().match(/\.[^.]+$/)?.[0] ?? "";
  if ([".png", ".jpg", ".jpeg", ".webp", ".gif", ".pdf"].includes(suffix)) return "figure";
  if ([".py", ".r", ".jl"].includes(suffix)) return "code";
  if ([".csv", ".tsv", ".parquet", ".npy", ".npz"].includes(suffix)) return "data";
  if (suffix === ".json") return "json";
  if (suffix === ".md") return "markdown";
  if (suffix === ".log") return "log";
  return "other";
}

function migrateArtifacts(value: unknown): unknown[] {
  if (Array.isArray(value)) {
    return value.flatMap((artifact) => {
      if (!artifact || typeof artifact !== "object") return [];
      const item = artifact as Record<string, unknown>;
      const path = typeof item.path === "string" ? item.path : "";
      if (!path) return [];
      const stem = path.split(/[\\/]/).at(-1)?.replace(/\.[^.]+$/, "") || "artifact";
      return [{
        ...item,
        name: typeof item.name === "string" && item.name ? item.name : stem,
        kind: typeof item.kind === "string" && item.kind ? item.kind : inferArtifactKind(path),
      }];
    });
  }
  if (!value || typeof value !== "object") return [];
  return Object.entries(value)
    .filter((entry): entry is [string, string] => typeof entry[1] === "string" && Boolean(entry[1]))
    .map(([name, path]) => ({ name, path, kind: inferArtifactKind(path) }));
}

export function migrateRunState(
  input: Record<string, unknown>,
  context: RunMigrationContext = {},
): RunStateDocument {
  const rawVersion = input.schema_version ?? input.schemaVersion ?? 1;
  const version = Number(rawVersion);
  if (!Number.isInteger(version) || version < 1 || version > 2) {
    throw new Error(`Unsupported SeekBrain run state schema version: ${String(rawVersion)}`);
  }

  const runId = String(input.run_id ?? input.runId ?? context.runId ?? "").trim();
  if (!runId) throw new Error("SeekBrain run state is missing run_id");

  const migrated: Record<string, unknown> = { ...input };
  delete migrated.schemaVersion;
  delete migrated.runId;
  delete migrated.runDir;
  migrated.schema_version = 2;
  migrated.run_id = runId;
  if (context.runDir && migrated.run_dir === undefined) migrated.run_dir = context.runDir;
  migrated.artifacts = migrateArtifacts(migrated.artifacts);
  const issues = [...Value.Errors(RunStateSchema, migrated)];
  if (issues.length) {
    throw new Error(`Invalid SeekBrain run state: ${issues.map((issue) =>
      `${issue.instancePath || "/"}: ${issue.message}`
    ).join(", ")}`);
  }
  return migrated as RunStateDocument;
}
