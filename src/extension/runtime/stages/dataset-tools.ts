import { defineTool } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { DatasetMetadataStore } from "../../../data-resolve/index.ts";
import { renderSeekBrainResult } from "../../tui/compact-tool-results.ts";
import type { RunSubagentOptions } from "../shared/subagent-runner.ts";
import type { Json, SeekBrainToolDefinition } from "../runtime-types.ts";

export interface DatasetToolDependencies {
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
    description: "Profile a user-provided dataset directory into persistent factual metadata. Reuses the user-level cache for the same canonical dataset directory unless refresh=true.",
    parameters: Type.Object({
      data_dir: Type.String({ description: "Dataset directory explicitly supplied by the user. It is inspected read-only." }),
      question: Type.Optional(Type.String({ description: "Research question, used only to prioritize relevant metadata details." })),
      paper_hint: Type.Optional(Type.String({ description: "Optional paper or dataset name supplied by the user." })),
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
          data_info: JSON.stringify(cached.metadata, null, 2),
          metadata_path: identity.metadataPath,
          manifest_path: identity.manifestPath,
          warnings: cached.manifest.warnings || [],
        });
      }

      await datasetMetadataStore.prepare(identity);
      const prompt = [
        await deps.readPrompt("data_resolve"),
        "",
        "# Current request",
        `DATA_DIR (canonical, read-only): ${identity.canonicalRoot}`,
        `Work directory (writable probes only): ${identity.workDir}`,
        params.paper_hint ? `Paper / dataset hint: ${params.paper_hint}` : "",
        params.question ? `Downstream question (context only): ${params.question}` : "",
      ].filter(Boolean).join("\n\n");
      const resolved = await deps.runSubagent({
        runDir: identity.workDir,
        agentName: "data_resolve",
        finalizeTool: "finalize_data_resolve",
        finalizeSchema: Type.Object({
          metadata: Type.Record(Type.String(), Type.Unknown()),
          dataset_type: Type.Union([Type.Literal("A"), Type.Literal("B"), Type.Literal("C")]),
          summary: Type.String(),
          inspected_paths: Type.Array(Type.String()),
          warnings: Type.Array(Type.String()),
        }),
        prompt,
        agentConfig: deps.pickAgentConfig(config, "seekbrain_data_resolve"),
        tools: ["read", "bash", "grep", "find", "ls", "write"],
        signal,
      });
      if (!resolved.ok) {
        return deps.content({
          ok: false,
          error: resolved.error || "Data Analysis Agent failed to produce a dataset profile",
          dataset_id: identity.datasetId,
          data_dir: identity.canonicalRoot,
        });
      }
      const result = resolved.result as Json;
      const metadata = result.metadata as Json;
      if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
        return deps.content({ ok: false, error: "Data Analysis Agent returned an invalid dataset profile", dataset_id: identity.datasetId });
      }
      metadata.root_dir = identity.canonicalRoot;
      const saved = await datasetMetadataStore.save(identity, metadata, {
        dataset_type: result.dataset_type,
        summary: result.summary,
        inspected_paths: result.inspected_paths,
        warnings: result.warnings,
      });
      return deps.content({
        ok: true,
        source: "generated",
        generated: true,
        dataset_id: identity.datasetId,
        data_dir: identity.canonicalRoot,
        metadata: saved.metadata,
        data_info: JSON.stringify(saved.metadata, null, 2),
        metadata_path: identity.metadataPath,
        manifest_path: identity.manifestPath,
        dataset_type: result.dataset_type,
        summary: result.summary,
        inspected_paths: result.inspected_paths,
        warnings: result.warnings,
      });
    },
    renderResult: renderSeekBrainResult("seekbrain_data_resolve"),
  })];
}

