import { defineTool } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import {
  applySemanticEnrichment,
  DATASET_ROLES,
  DatasetMetadataStore,
  profileDatasetDeterministically,
  semanticEvidenceBundle,
} from "../../../data-resolve/index.ts";
import { renderSeekBrainResult } from "../../tui/compact-tool-results.ts";
import type { RunSubagentOptions } from "../shared/subagent-runner.ts";
import type { Json, SeekBrainToolDefinition } from "../runtime-types.ts";

const SEMANTIC_FALLBACK_MAX_COLLECTIONS = 24;

export interface DatasetToolDependencies {
  loadEnv?(cwd: string): Promise<NodeJS.ProcessEnv>;
  loadConfig(cwd: string): Promise<Json>;
  readPrompt(name: string): Promise<string>;
  pickAgentConfig(config: Json, name: string): Json;
  runSubagent(options: RunSubagentOptions): Promise<any>;
  content(details: Json): any;
}

export function createDatasetTools(deps: DatasetToolDependencies): SeekBrainToolDefinition[] {
  return [defineTool({
    name: "seekbrain_data_resolve",
    label: "Profile Dataset",
    description: "Build a question-independent structural catalog for a user-provided dataset directory. Reuses the user-level cache unless refresh=true.",
    parameters: Type.Object({
      data_dir: Type.String({ description: "Dataset directory explicitly supplied by the user. It is inspected read-only." }),
      refresh: Type.Optional(Type.Boolean({ description: "Regenerate metadata even when this dataset is already cached." })),
    }),
    async execute(_toolCallId, params, signal, _onUpdate, ctx) {
      const config = await deps.loadConfig(ctx.cwd);
      const configuredCacheRoot = String(config.paths?.dataset_cache || "").trim() || undefined;
      const datasetMetadataStore = new DatasetMetadataStore(configuredCacheRoot);
      const identity = await datasetMetadataStore.identify(params.data_dir);
      const cached = params.refresh === true ? undefined : await datasetMetadataStore.load(identity);
      if (cached) {
        return deps.content({
          ok: true,
          source: "cache",
          generated: false,
          dataset_id: identity.datasetId,
          data_dir: identity.canonicalRoot,
          metadata: cached.metadata,
          metadata_path: identity.metadataPath,
          manifest_path: identity.manifestPath,
          warnings: cached.manifest.warnings || [],
        });
      }

      try {
        const profile = await profileDatasetDeterministically(identity.canonicalRoot, await deps.loadEnv?.(ctx.cwd));
        let metadata = profile.metadata;
        let profiler = "deterministic";
        const ambiguousCollections = Array.isArray(metadata.quality?.unresolved_family_ids)
          ? metadata.quality.unresolved_family_ids.length
          : 0;
        if (ambiguousCollections > 0 && ambiguousCollections <= SEMANTIC_FALLBACK_MAX_COLLECTIONS) {
          const semantic = await deps.runSubagent({
            runDir: identity.workDir,
            agentName: "data_resolve_semantics",
            finalizeTool: "finalize_data_resolve_semantics",
            finalizeSchema: Type.Object({
              description: Type.String(),
              family_updates: Type.Array(Type.Object({
                family_id: Type.String(),
                role: Type.Union(DATASET_ROLES.filter((role) => role !== "opaque_binary").map((role) => Type.Literal(role)) as any),
                axis_semantics: Type.Optional(Type.Array(Type.String())),
                evidence: Type.Array(Type.String()),
              })),
              warnings: Type.Array(Type.String()),
            }),
            prompt: [
              await deps.readPrompt("data_resolve"),
              "",
              "# Deterministic evidence bundle",
              JSON.stringify(semanticEvidenceBundle(metadata)),
            ].join("\n"),
            agentConfig: deps.pickAgentConfig(config, "seekbrain_data_resolve"),
            tools: [],
            signal,
          });
          if (!semantic.ok) {
            if (signal?.aborted) {
              return deps.content({ ok: false, error: "Dataset profiling was cancelled", dataset_id: identity.datasetId, data_dir: identity.canonicalRoot });
            }
            metadata.warnings = [...(metadata.warnings || []), `Optional semantic enrichment did not complete: ${semantic.error || "unknown error"}`];
          }
          else {
            metadata = applySemanticEnrichment(metadata, semantic.result as Json);
            profiler = "deterministic+semantic";
          }
        }
        else if (ambiguousCollections > SEMANTIC_FALLBACK_MAX_COLLECTIONS) {
          metadata.warnings = [
            ...(metadata.warnings || []),
            `Semantic enrichment was skipped for ${ambiguousCollections} ambiguous structural collections; structural metadata is complete and ambiguity is preserved explicitly.`,
          ];
        }
        if (metadata.quality?.status !== "complete") {
          return deps.content({
            ok: false,
            error: "Dataset metadata did not pass the quality gate",
            dataset_id: identity.datasetId,
            data_dir: identity.canonicalRoot,
            quality: metadata.quality,
            warnings: metadata.warnings || [],
            message: "Structurally incomplete metadata was not saved or passed downstream.",
          });
        }
        const saved = await datasetMetadataStore.save(identity, metadata, {
          dataset_type: profile.datasetType,
          summary: profile.summary,
          inspected_paths: profile.inspectedPaths,
          warnings: metadata.warnings || profile.warnings,
          profiler,
          elapsed_ms: profile.elapsedMs,
        });
        return deps.content({
          ok: true,
          source: "generated",
          generated: true,
          profiler,
          elapsed_ms: profile.elapsedMs,
          dataset_id: identity.datasetId,
          data_dir: identity.canonicalRoot,
          metadata: saved.metadata,
          metadata_path: identity.metadataPath,
          manifest_path: identity.manifestPath,
          dataset_type: profile.datasetType,
          summary: profile.summary,
          inspected_paths: profile.inspectedPaths,
          warnings: metadata.warnings || profile.warnings,
        });
      } catch (error) {
        return deps.content({
          ok: false,
          error: error instanceof Error ? error.message : String(error),
          dataset_id: identity.datasetId,
          data_dir: identity.canonicalRoot,
          message: "Dataset inventory failed before valid metadata could be saved.",
        });
      }
    },
    renderResult: renderSeekBrainResult("seekbrain_data_resolve"),
  })];
}
