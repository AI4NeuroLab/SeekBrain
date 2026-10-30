import { createWebAccessTools } from "../web-access-tools.ts";
import { reportPdfPolicy } from "../../workflows/unified/report-pdf-policy.ts";
import { createScopedWriteTools, assertWriteTarget } from "./shared/scoped-write-tools.ts";
import { StudyWorkflow } from "../../workflows/unified/study-workflow.ts";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import type { RunLifecycleWorkflow, WorkflowRunContext } from "../../workflows/index.ts";
import {
  TaskBriefWorkflow,
  CreativeResearchPlanningWorkflow,
  CreativeScientificSearchWorkflow,
  CodeWorkflow,
  ImageWorkflow,
  InterpretWorkflow,
  PlanWorkflow,
  ReportEvidenceCompiler,
  ReporterWorkflow,
  ResearchPlanningWorkflow,
  ResearchSkillWorkflow,
  ResearchSurveyWorkflow,
  ResearchTaskExecutionCoordinator,
  ResearchTaskScheduler,
  ReviewWorkflow,
  ValidateWorkflow,
  exportReportPdf,
} from "../../workflows/index.ts";
import { createScientificInspirationTool } from "../scientific-inspiration-tool.ts";
import { RagFirstScientificSearchClient } from "../scientific-inspiration-search.ts";
import { TrustedPublisherWebSearchClient } from "../public-web-search.ts";
import { literatureQueryConfig } from "../../core/index.ts";
import { createFormulationLiteratureTools } from "../../formulation-literature/formulation-literature-tools.ts";
import {
  DEFAULT_MAX_CODE_ATTEMPTS,
  codeRetryPolicy,
  currentArtifactsValidated,
  fastPassRefinedValidation,
  normalizeValidation,
  validationNextStep,
} from "../../workflows/seekbrain/validation-policy.js";
import { LiteratureProviderRouter, PubMedRetriever, SemanticScholarRetriever } from "../../literature-compat/index.ts";
import { PaperRagClient, RagSkillGenerator, RecipeRevisionManager, RecipeScoutV2, SkillLibraryManager, TargetedSkillResolver } from "../../targeted-skill/index.ts";
import {
  createRefinementGuard,
  finalizeRefinementGuard,
  loadVisionImages,
} from "./shared/artifact-service.ts";
import { writeJson, writeText } from "./shared/file-service.ts";
import { createResearchTaskExecutor } from "./create-research-task-executor.ts";
import { FormulationFullTextClient } from "../../formulation-literature/full-text-client.ts";
import type { PaperRecord } from "../../literature-compat/contracts.ts";
import type { RuntimeSession } from "./create-runtime-session.ts";
import type { Json } from "./runtime-types.ts";

export interface RuntimeServiceFactoryDependencies {
  pi: ExtensionAPI;
  session: RuntimeSession;
  packageRoot: string;
  projectRoot: string;
  env?: NodeJS.ProcessEnv;
  literatureCacheDir?: string;
  runLifecycle: RunLifecycleWorkflow;
  loadConfig(cwd: string): Promise<Json>;
  workflowConfig(config: Json): Json;
  pickAgentConfig(config: Json, name: string): Json;
  literatureAgentConfig(config: Json, name: string): Json;
  humanGateEnabled(config: Json, stage: string): boolean;
  readPrompt(name: string): Promise<string>;
  runSubagent(input: Json): Promise<any>;
  resolveRun(cwd: string, runId?: string): Promise<WorkflowRunContext>;
  snapshotRunArtifacts(run: WorkflowRunContext, label: string): Promise<Json | undefined>;
  appendStateEntry(pi: ExtensionAPI, event: Json): Promise<void>;
  summarize(details: Json): Json;
  reportFinalizeSchema(): unknown;
}

export function createRuntimeServices(deps: RuntimeServiceFactoryDependencies) {
  const env = { ...(deps.env ?? process.env) };
  const {
    pi,
    session,
    packageRoot: PACKAGE_ROOT,
    projectRoot: PROJECT_ROOT,
    runLifecycle,
    loadConfig: loadConfigCached,
    workflowConfig: seekbrainWorkflowConfig,
    pickAgentConfig,
    literatureAgentConfig,
    humanGateEnabled,
    readPrompt,
    runSubagent,
    resolveRun,
    snapshotRunArtifacts,
    appendStateEntry,
    summarize: limitForMain,
    reportFinalizeSchema: seekbrainReportFinalizeSchema,
  } = deps;
  const paperRagClient = new PaperRagClient();
  const semanticScholarRetriever = new SemanticScholarRetriever();
  const pubMedRetriever = new PubMedRetriever();
  const literatureProviderRouter = new LiteratureProviderRouter(paperRagClient, {
    semantic_scholar: semanticScholarRetriever,
    pubmed: pubMedRetriever,
  });
  const resolveFormulationLiteratureConfig = async () => {
    const config = await loadConfigCached(PROJECT_ROOT);
    const legacy = config.agents?.seekbrain_survey?.rag
      || {};
    const resolved = literatureQueryConfig(config, legacy);
    const toolConfig = config.workflow?.seekbrain?.formulation_literature || {};
    return {
      provider: String(resolved.paper_source || resolved.literature_provider || "none"),
      baseUrl: String(resolved.base_url || resolved.rag_base_url || ""),
      topK: Number(toolConfig.search_result_limit || resolved.top_k || 4),
      timeoutMs: Number(toolConfig.timeout_seconds || resolved.timeout || resolved.rag_timeout || 600) * 1_000,
      readOutputCharLimit: Number(toolConfig.read_output_char_limit || 50_000),
    };
  };
  const fullTextClient = new FormulationFullTextClient();
  const sharedLiteratureTools = createFormulationLiteratureTools({
    cacheDir: deps.literatureCacheDir,
    resolveConfig: resolveFormulationLiteratureConfig,
    retrievePapers: async (settings, query, signal) => {
      if (settings.provider === "ailab_rag") return fullTextClient.query({
        baseUrl: settings.baseUrl, query, topK: settings.topK || 4,
        timeoutMs: settings.timeoutMs || 600_000, signal,
      });
      const config = await loadConfigCached(PROJECT_ROOT);
      const result = await literatureProviderRouter.query({
        ...literatureQueryConfig(config, config.agents?.seekbrain_survey?.rag || {}), question: query, require_github: false,
        include_papers: true, top_k: settings.topK || 4,
        timeout: (settings.timeoutMs || 600_000) / 1_000,
      }, PROJECT_ROOT, signal);
      if (result.ok === false) throw new Error(String(result.error || "Literature retrieval failed"));
      return ((result.papers || []) as PaperRecord[]).map(paper => ({
        paper_id: `${paper.provider}:${paper.providerId}`, track_id: paper.providerId,
        title: paper.title, abstract: paper.abstract, full_text: paper.fullText || "",
        authors: paper.authors, published_at: paper.year ? String(paper.year) : undefined,
        venue: paper.venue, doi: paper.doi, pmid: paper.pmid, pmcid: paper.pmcid,
        url: paper.openAccessPdf, similarity_score: paper.relevanceScore,
        github_links: paper.repositoryCandidates.map(candidate => candidate.url),
      }));
    },
  });
  const literatureTools = () => sharedLiteratureTools;
  const sharedWebTools = createWebAccessTools({
    isEnabled: async () => (await loadConfigCached(PROJECT_ROOT)).workflow?.seekbrain?.web_search !== false,
  });
  const webTools = (config?: Json) => config?.workflow?.seekbrain?.web_search === false ? [] : sharedWebTools;
  const taskBriefWorkflow = new TaskBriefWorkflow({
    lifecycle: runLifecycle,
    runAgent: async (input) => runSubagent({
      runDir: input.runDir,
      agentName: "seekbrain_task_brief",
      finalizeTool: "finalize_task_brief",
      finalizeSchema: input.finalizeSchema,
      prompt: input.prompt,
      agentConfig: input.agentConfig,
      tools: [],
      signal: input.signal,
    }),
    writeJson,
    appendEvent: (event) => appendStateEntry(pi, event),
  });
  const skillLibrary = new SkillLibraryManager({ packageRoot: PACKAGE_ROOT });
  const ragSkillGenerator = new RagSkillGenerator(async (input) => {
    const runDir = session.getActiveRunDir() || PROJECT_ROOT;
    const config = await loadConfigCached(PROJECT_ROOT);
    const paperPrompt = await readPrompt("recipe_crystallization");
    const repositoryCode = input.matchedFiles
      .map((file) => `### ${file.path}\n\n${file.content}`)
      .join("\n\n")
      .slice(0, 60_000);
    const prompt = paperPrompt
      .replaceAll("{tag}", "repository_recipe")
      .replaceAll("{question_text}", input.question)
      .replaceAll("{matched_paper_context}", input.matchedPaperContext.slice(0, 40_000))
      .replaceAll("{repo_code_excerpts}", repositoryCode);
    const authored = await runSubagent({
      runDir,
      agentName: "seekbrain_skill_generate",
      finalizeTool: "finalize_targeted_skill",
      finalizeSchema: Type.Object({
        name: Type.String(),
        description: Type.String(),
        triggers: Type.Array(Type.String()),
        tags: Type.Array(Type.String()),
        skill_body: Type.String(),
        analysis_script: Type.Optional(Type.String()),
        utility_script: Type.Optional(Type.String()),
        recipe_card: Type.Object({
          recipe_id: Type.String(),
          version: Type.String(),
          kind: Type.Union([Type.Literal("analysis"), Type.Literal("preprocess"), Type.Literal("visualization"), Type.Literal("validation"), Type.Literal("reference")]),
          summary: Type.String(),
          aliases: Type.Array(Type.String()),
          does: Type.Array(Type.String()),
          evidence_for: Type.Array(Type.String()),
          accepts: Type.Object({
            species: Type.Array(Type.String()),
            modalities: Type.Array(Type.String()),
            observation_units: Type.Array(Type.String()),
            requires: Type.Array(Type.String()),
          }),
          produces: Type.Array(Type.String()),
          use_when: Type.Array(Type.String()),
          avoid_when: Type.Array(Type.String()),
        }),
      }),
      prompt: [
        prompt,
        "Compile exactly one reusable capability supported by the evidence. If the evidence cannot support executable code, keep analysis_script empty and state the boundary explicitly.",
        "If no executable capability can be compiled from the repository, set recipe_card.kind=reference, leave does/evidence_for/produces empty, and use recipe_card.use_when to describe the request scope for which this repository boundary applies. A reference card is negative repository memory, not an executable Recipe.",
        "An executable Recipe must state its objective, required inputs, procedure, expected outputs, validation criteria, paper-to-code mapping, and gaps. A reference card should instead state the evidence boundary and why no executable operation is admitted.",
        "Also produce recipe_card: a concise retrieval contract with does, evidence_for, accepts, produces, use_when, and avoid_when. Use evidence_for for evidence the operation can generate; do not claim that a Recipe itself explains a biological mechanism.",
        "Do not invent repository functions, parameters, dependencies, data schemas, or results. Never retain task-instance absolute paths, output directories, dataset IDs, or observed result values.",
        "Return only through finalize_targeted_skill.",
        `Repository URL: ${input.repoLink || "No verified repository"}`,
        `Repository overview:\n${input.repoOverview || "Paper-only evidence"}`,
      ].join("\n\n"),
      agentConfig: pickAgentConfig(config, "seekbrain_skill_generate"),
      tools: [],
      signal: input.signal,
    });
    if (!authored.ok || !authored.result) throw new Error((authored as Json).error || "Recipe Crystallization Agent did not finalize");
    return authored.result;
  }, async (input) => {
    const runDir = session.getActiveRunDir() || PROJECT_ROOT;
    const config = await loadConfigCached(PROJECT_ROOT);
    const repositoryEvidence = input.repositoryFiles
      .map((file) => `### ${file.path} (${file.extension}, ${file.size} chars)\n${file.excerpt || ""}`)
      .join("\n\n")
      .slice(0, 45_000);
    const context = await runSubagent({
      runDir,
      agentName: "seekbrain_skill_context",
      finalizeTool: "finalize_targeted_skill_context",
      finalizeSchema: Type.Object({
        repo_overview: Type.String(),
        selected_files: Type.Array(Type.String(), { maxItems: 8 }),
        matched_paper_context: Type.String(),
        matched_repo_context: Type.String(),
        connection_analysis: Type.String(),
        reproduction_plan: Type.String(),
      }),
      prompt: [
        "Build a compact evidence pack for exactly the requested scientific capability.",
        "Select no more than eight repository files. Connect paper method claims to visible repository evidence and explicitly state gaps. Do not propose a Recipe yet and do not invent absent functions or parameters.",
        `Question:\n${input.question}`,
        `Paper title:\n${input.title}`,
        `Paper evidence:\n${input.paperText.slice(0, 35_000)}`,
        `Repository evidence windows:\n${repositoryEvidence}`,
      ].join("\n\n"),
      agentConfig: pickAgentConfig(config, "seekbrain_skill_context"),
      tools: [],
      signal: input.signal,
    });
    if (!context.ok || !context.result) throw new Error((context as Json).error || "Recipe evidence-context agent did not finalize");
    return context.result as any;
  });
  const targetedSkillResolver = new TargetedSkillResolver(literatureProviderRouter, {
    ensureTrajectoryDir: () => skillLibrary.ensureTrajectory(),
    userSkillsRoot: skillLibrary.userSkillsRoot,
    generatedSkillDir: join(skillLibrary.userSkillsRoot, "from_rag"),
    ragSkillGenerator,
    selectSkills: async (input) => {
      const runDir = input.traceDir ? resolve(input.traceDir, "..") : session.getActiveRunDir() || PROJECT_ROOT;
      const config = await loadConfigCached(PROJECT_ROOT);
      const candidateText = input.candidates.map((candidate) => JSON.stringify(candidate)).join("\n").slice(0, 60_000);
      const selected = await runSubagent({
        runDir,
        agentName: "targeted_skill_matcher",
        finalizeTool: "finalize_targeted_skill_match",
        finalizeSchema: Type.Object({
          selected: Type.Array(Type.Object({
            name: Type.String(),
            path: Type.String(),
            score: Type.Number(),
            role: Type.Union([Type.Literal("primary"), Type.Literal("supporting"), Type.Literal("visualization"), Type.Literal("validation")]),
            reason: Type.String(),
            covers: Type.Array(Type.String()),
          })),
        }),
        prompt: [
          "You are the isolated SeekBrain analysis-recipe set matcher. Match scientific requirements to explicit Recipe capability cards, not to incidental wording or paths.",
          `Return the smallest non-redundant set of at most ${input.topK} Recipes. Every selected Recipe must cover at least one requirement not covered by earlier selections and must score at least ${input.threshold}.`,
          "Use species as the only hard compatibility filter. Do not reject or prioritize a Recipe from modality labels.",
          "Use role=primary for the main scientific operation, supporting for a complementary operation, visualization for an evidence display, and validation for a check. Return requirement IDs in covers.",
          "If no Recipe is relevant, return an empty selected array. Partial coverage is allowed; never force a match.",
          "Return exact candidate name and path only through finalize_targeted_skill_match.",
          `Question:\n${input.question}`,
          `Structured RecipeQuery:\n${JSON.stringify(input.query, null, 2)}`,
          `Candidates:\n${candidateText}`,
        ].join("\n\n"),
        agentConfig: pickAgentConfig(config, "seekbrain_skill_match"),
        tools: [],
        signal: input.signal,
      });
      if (!selected.ok || !Array.isArray(selected.result?.selected)) throw new Error((selected as Json).error || "analysis-recipe matcher did not finalize");
      return selected.result.selected;
    },
  });
  const scoutFailureSchema = Type.Union([
    Type.Literal("upstream_only"),
    Type.Literal("reference_mapping_only"),
    Type.Literal("paper_repo_mismatch"),
    Type.Literal("no_executable_workflow"),
    Type.Literal("scientifically_unrelated"),
  ]);
  const recipeScout = new RecipeScoutV2(literatureProviderRouter, {
    ensureTrajectoryDir: () => skillLibrary.ensureTrajectory(),
    userSkillsRoot: skillLibrary.userSkillsRoot,
    interpretScientificQuery: async (input, signal) => {
      const runDir = session.getActiveRunDir() || PROJECT_ROOT;
      const config = await loadConfigCached(PROJECT_ROOT);
      const rolePrompt = await readPrompt("recipe_scout_query");
      const interpreted = await runSubagent({
        runDir,
        agentName: "seekbrain_recipe_scout_query",
        finalizeTool: "finalize_recipe_scout_query",
        finalizeSchema: Type.Object({
          objective: Type.String(),
          biological_scope: Type.Array(Type.String()),
          data_abstraction: Type.Array(Type.String()),
          hard_constraints: Type.Array(Type.String()),
          output_preferences: Type.Array(Type.String()),
          species: Type.Array(Type.String()),
          species_evidence: Type.Array(Type.String()),
          query_text: Type.String(),
          method_query_text: Type.String(),
        }),
        prompt: [
          rolePrompt,
          `Original question:\n${input.question}`,
          `Dataset metadata.json:\n${input.dataset_metadata || "(not available)"}`,
        ].join("\n\n"),
        agentConfig: pickAgentConfig(config, "seekbrain_skill_match"),
        tools: [],
        signal,
      });
      if (!interpreted.ok || !interpreted.result) throw new Error((interpreted as Json).error || "RecipeScout query interpreter did not finalize");
      return interpreted.result;
    },
    triageCandidates: async (input, signal) => {
      const runDir = session.getActiveRunDir() || PROJECT_ROOT;
      const config = await loadConfigCached(PROJECT_ROOT);
      const rolePrompt = await readPrompt("recipe_scout_triage");
      const candidates = input.candidates.map((candidate) => ({
        candidate_id: candidate.candidate_id,
        display_id: candidate.display_id,
        origin: candidate.origin,
        title: candidate.title,
        summary: candidate.summary.slice(0, 1_200),
        repository_url: candidate.repository_url,
        paper_key: candidate.paper_key,
        repository_options: candidate.repository_options?.map((option) => ({
          repository_url: option.repository_url,
          relation: option.relation,
          order: option.order,
        })),
        parent_candidate_id: candidate.parent_candidate_id,
        recipe_path: candidate.recipe_path,
        recipe_card: candidate.recipe_card ? {
          kind: candidate.recipe_card.kind,
          status: candidate.recipe_card.status,
          summary: String(candidate.recipe_card.summary || "").slice(0, 800),
          transferable_roles: candidate.recipe_card.transferable_roles,
        } : undefined,
        known_boundary: candidate.known_boundary,
        boundary_reason: candidate.boundary_reason,
        retrieval: candidate.retrieval.slice(0, 2).map(({ paper_text: paperText, paper_chunks: paperChunks, ...retrieval }) => ({
          round: retrieval.round,
          query_kind: retrieval.query_kind,
          rank: retrieval.rank,
          score: retrieval.score,
          repository_relation: retrieval.repository_relation,
          paper_title: retrieval.paper_title,
          method_passages: paperChunks?.slice(0, 2).map((chunk) => ({
            heading: chunk.heading,
            text: chunk.text.slice(0, 1_200),
            score: chunk.score,
          })),
          ...(!paperChunks?.length && paperText ? { paper_text_preview: paperText.slice(0, 1_200) } : {}),
        })),
      }));
      const triaged = await runSubagent({
        runDir,
        agentName: "seekbrain_recipe_scout_triage",
        finalizeTool: "finalize_recipe_scout_triage",
        finalizeSchema: Type.Object({
          decisions: Type.Array(Type.Object({
            candidate_id: Type.String(),
            inspect: Type.Boolean(),
            priority: Type.Number(),
            round_rank: Type.Optional(Type.Number()),
            scientific_relevance: Type.Union([Type.Literal("high"), Type.Literal("medium"), Type.Literal("low")]),
            hypothesized_capabilities: Type.Array(Type.String()),
            reason: Type.String(),
            failure_code: Type.Optional(scoutFailureSchema),
          })),
          warnings: Type.Optional(Type.Array(Type.String())),
        }),
        prompt: [
          rolePrompt,
          `Inspection budget: ${input.inspection_budget}`,
          `Retrieval round: ${input.round}`,
          `Scientific query:\n${JSON.stringify(input.scientific_query, null, 2)}`,
          `Candidates (every listed candidate must receive exactly one decision):\n${JSON.stringify(candidates, null, 2)}`,
        ].join("\n\n"),
        agentConfig: pickAgentConfig(config, "seekbrain_recipe_scout_triage"),
        tools: [],
        signal,
      });
      if (!triaged.ok || !Array.isArray(triaged.result?.decisions)) throw new Error((triaged as Json).error || "RecipeScout triage agent did not finalize");
      return triaged.result;
    },
    finalizeCandidates: async (input, signal) => {
      const runDir = session.getActiveRunDir() || PROJECT_ROOT;
      const config = await loadConfigCached(PROJECT_ROOT);
      const rolePrompt = await readPrompt("recipe_scout_finalize");
      const candidates = input.candidates.map((candidate) => ({
        candidate_id: candidate.candidate_id,
        display_id: candidate.display_id,
        origin: candidate.origin,
        title: candidate.title,
        summary: candidate.summary,
        repository_url: candidate.repository_url,
        paper_key: candidate.paper_key,
        parent_candidate_id: candidate.parent_candidate_id,
        recipe_path: candidate.recipe_path,
        recipe_card: candidate.recipe_card,
        known_boundary: candidate.known_boundary,
        boundary_basis: candidate.boundary_basis,
        boundary_evidence: candidate.boundary_evidence,
        boundary_reason: candidate.boundary_reason,
      }));
      const inspections = await Promise.all(input.inspections.map(async (inspection) => ({
        candidate_id: inspection.candidate_id,
        ok: inspection.ok,
        repository_url: inspection.repository_url,
        recipe_path: inspection.recipe_path,
        source_commit: inspection.source_commit,
        files: await Promise.all(inspection.candidate_files.slice(0, 6).map(async (file) => {
          let excerpt = "";
          if (file.local_path) {
            try { excerpt = (await readFile(file.local_path, "utf8")).slice(0, 8_000); }
            catch { /* file summary remains available */ }
          }
          return { path: file.path, summary: file.summary, excerpt };
        })),
        error: inspection.error,
      })));
      const finalized = await runSubagent({
        runDir,
        agentName: "seekbrain_recipe_scout_finalize",
        finalizeTool: "finalize_recipe_scout",
        finalizeSchema: Type.Object({
          selected: Type.Array(Type.Object({
            candidate_id: Type.String(),
            role: Type.Union([Type.Literal("scientific_backbone"), Type.Literal("supporting")]),
            transfer_level: Type.Union([Type.Literal("direct"), Type.Literal("near"), Type.Literal("structural")]),
            evidence_strength: Type.Union([Type.Literal("strong"), Type.Literal("moderate"), Type.Literal("weak"), Type.Literal("none")]),
            reason: Type.String(),
            executable_capabilities: Type.Array(Type.String()),
            adaptation_gaps: Type.Array(Type.String()),
          }), { maxItems: 2 }),
          retry_query: Type.Optional(Type.String()),
          retry_reason: Type.Optional(Type.String()),
          retry_mode: Type.Optional(Type.Union([Type.Literal("recovery"), Type.Literal("improvement")])),
          unresolved_gap: Type.Optional(Type.String()),
          warnings: Type.Optional(Type.Array(Type.String())),
        }),
        prompt: [
          rolePrompt,
          `Acceptance round: ${input.round}`,
          input.retry_mode ? `Retry mode: ${input.retry_mode}` : "",
          `Scientific query:\n${JSON.stringify(input.scientific_query, null, 2)}`,
          `Candidates:\n${JSON.stringify(candidates, null, 2).slice(0, 24_000)}`,
          `Triage decisions:\n${JSON.stringify(input.triage, null, 2)}`,
          `Candidate file evidence:\n${JSON.stringify(inspections, null, 2).slice(0, 70_000)}`,
          input.previous_result ? `Previous selection:\n${JSON.stringify(input.previous_result.selected, null, 2).slice(0, 12_000)}` : "",
        ].join("\n\n"),
        agentConfig: pickAgentConfig(config, "seekbrain_recipe_scout_finalize"),
        tools: [],
        signal,
      });
      if (!finalized.ok || !Array.isArray(finalized.result?.selected)) throw new Error((finalized as Json).error || "RecipeScout finalizer did not finalize");
      return finalized.result;
    },
  });
  const researchSkillWorkflow = new ResearchSkillWorkflow({
    lifecycle: runLifecycle,
    resolveSkill: (input, cwd, signal) => input.resolution_mode === "legacy_resolver"
      ? targetedSkillResolver.resolve(input, cwd, signal)
      : recipeScout.resolve(input, cwd, signal),
    writeText,
    appendEvent: (event) => appendStateEntry(pi, event),
    summarize: limitForMain,
  });
  const recipeRevisionManager = new RecipeRevisionManager(async (input) => {
    const config = await loadConfigCached(PROJECT_ROOT);
    const revised = await runSubagent({
      runDir: input.runDir,
      agentName: "seekbrain_skill_revise",
      finalizeTool: "finalize_recipe_revision",
      finalizeSchema: Type.Object({
        revised_skill_body: Type.String(),
        recipe_card: Type.Record(Type.String(), Type.Unknown()),
        change_summary: Type.String(),
        executor_guidance: Type.String(),
        expected_acceptance_signals: Type.Array(Type.String()),
        preserved_checks: Type.Array(Type.String()),
      }),
      prompt: [
        "Perform one bounded, trace-conditioned local revision of a reusable neuroscience Recipe. Do not rewrite unrelated sections.",
        "Use only these repair classes: trigger/contraindication, input precondition, procedural step, output-validation contract, or removal of task-instance hard-coding.",
        "Preserve already-passing behavior. Do not retain absolute paths, dataset IDs, observed result values, hidden answers, or verifier-specific shortcuts.",
        "Return the revised SKILL.md body without YAML frontmatter, a complete updated recipe_card, concise executor_guidance for the next existing Code retry, observable acceptance signals, and preserved checks.",
        `Recipe id: ${input.recipeId}`,
        `Current RecipeCard:\n${JSON.stringify(input.sourceCard, null, 2)}`,
        `Current Recipe:\n${input.sourceRecipe.slice(0, 35_000)}`,
        `Validation diagnosis:\n${JSON.stringify(input.diagnosis, null, 2)}`,
        `Validation result:\n${JSON.stringify({ blocking_issues: input.validation.blocking_issues, overall_mismatches: input.validation.overall_mismatches, methodological_caveats: input.validation.methodological_caveats }, null, 2)}`,
      ].join("\n\n"),
      agentConfig: pickAgentConfig(config, "seekbrain_skill_revise"),
      tools: [],
      signal: input.signal,
    });
    if (!revised.ok || !revised.result) throw new Error((revised as Json).error || "Recipe revision agent did not finalize");
    return revised.result as any;
  });
  const researchSurveyWorkflow = new ResearchSurveyWorkflow({
  lifecycle: runLifecycle,
  retrievePapers: (input, cwd, signal) => literatureProviderRouter.query(input, cwd, signal),
  runAgent: async (input) => runSubagent({
    runDir: input.runDir,
    agentName: "seekbrain_research_survey",
    finalizeTool: "finalize_research_survey",
    finalizeSchema: input.finalizeSchema,
    prompt: input.prompt,
    agentConfig: input.agentConfig,
    tools: [],
    signal: input.signal,
  }),
  writeJson,
  writeText,
  appendEvent: (event) => appendStateEntry(pi, event),
});
const researchPlanningWorkflow = new ResearchPlanningWorkflow({
  lifecycle: runLifecycle,
  runAgent: async (input) => runSubagent({
    runDir: input.runDir,
    agentName: input.finalizeTool === "finalize_research_route"
      ? "seekbrain_research_route"
      : input.finalizeTool === "finalize_research_plan_review"
        ? "seekbrain_research_plan_reviewer"
        : "seekbrain_research_planning",
    finalizeTool: input.finalizeTool,
    finalizeSchema: input.finalizeSchema,
    prompt: input.prompt,
    agentConfig: input.agentConfig,
    tools: input.tools ?? [],
    customTools: input.tools ? literatureTools() : [],
    signal: input.signal,
  }),
  writeJson,
  appendEvent: (event) => appendStateEntry(pi, event),
});
const creativeResearchPlanningWorkflow = new CreativeResearchPlanningWorkflow({
  lifecycle: runLifecycle,
  runAgent: async (input) => runSubagent({
    runDir: input.runDir,
    agentName: "seekbrain_research_planning",
    finalizeTool: input.finalizeTool,
    finalizeSchema: input.finalizeSchema,
    prompt: input.prompt,
    agentConfig: input.agentConfig,
    tools: input.tools ?? ["read", "bash", "grep", "find", "ls"],
    customTools: input.finalizeTool === "finalize_creative_ideas_text" ? literatureTools() : [],
    signal: input.signal,
  }),
  writeJson,
  appendEvent: (event) => appendStateEntry(pi, event),
});
const creativeScientificSearchWorkflow = new CreativeScientificSearchWorkflow({
  lifecycle: runLifecycle,
  runAgent: async (input) => runSubagent({
    runDir: input.runDir,
    agentName: "seekbrain_creative_search",
    finalizeTool: input.finalizeTool,
    finalizeSchema: input.finalizeSchema,
    prompt: input.prompt,
    agentConfig: input.agentConfig,
    tools: [],
    customTools: input.customTools,
    signal: input.signal,
  }),
  createSearchTool: (runDir) => createScientificInspirationTool({
    cwd: runDir,
    ledgerPath: join(runDir, "creative_research", "creative_search_pool.json"),
    webSearch: new RagFirstScientificSearchClient({
      cwd: runDir,
      retrieveRag: (input, cwd, signal) => paperRagClient.query(input, cwd, signal),
      resolveRagInput: async () => {
        const config = await loadConfigCached(PROJECT_ROOT);
        const legacy = config.agents?.seekbrain_survey?.rag
          || {};
        return literatureQueryConfig({
          ...config,
          literature: { ...(config.literature || {}), paper_source: "ailab_rag" },
        }, legacy);
      },
      ncsSupplement: new TrustedPublisherWebSearchClient(),
    }),
    maxDistinctQueries: 9,
    maxCallsPerToolInstance: 3,
    resultLimit: 6,
    sourceCharLimit: 4_000,
  }),
  writeJson,
  appendEvent: (event) => appendStateEntry(pi, event),
});
const researchTaskScheduler = new ResearchTaskScheduler({
  lifecycle: runLifecycle,
  writeJson,
});
const reportEvidenceCompiler = new ReportEvidenceCompiler({ writeJson });
const reporterWorkflow = new ReporterWorkflow({
  runAgent: async (input) => runSubagent({
    runDir: input.runDir,
    agentName: "seekbrain_report",
    finalizeTool: "finalize_seekbrain_report",
    finalizeSchema: input.finalizeSchema,
    prompt: input.prompt,
    agentConfig: input.agentConfig,
    tools: input.tools || [],
    images: input.images,
    signal: input.signal,
  }),
  writeJson,
  writeText,
  exportPdf: exportReportPdf,
});
const generateScientificReport = async (input: {
  projectPath: string;
  selectedEvidenceIds?: string[];
  reportGoal?: string;
  signal?: AbortSignal;
  onProgress?: (progress: Json) => void;
}) => {
  input.onProgress?.({
    stage: "compiling",
    message: "Compiling the completed Research Planning evidence tree",
  });
  const compiled = await reportEvidenceCompiler.compile({
    projectPath: input.projectPath,
    selectedEvidenceIds: input.selectedEvidenceIds,
    reportGoal: input.reportGoal,
  });
  const config = await loadConfigCached(PROJECT_ROOT);
  return reporterWorkflow.execute({
    hierarchicalEvidencePath: compiled.hierarchical_evidence_path,
    rolePrompt: await readPrompt("report"),
    agentConfig: pickAgentConfig(config, "seekbrain_report"),
    finalizeSchema: seekbrainReportFinalizeSchema(),
    signal: input.signal,
    onProgress: input.onProgress,
    pdf: config.workflow?.seekbrain?.report?.pdf,
  });
};
const planWorkflow = new PlanWorkflow({
  lifecycle: runLifecycle,
  createCustomTools: () => literatureTools(),
  runAgent: async (input) => runSubagent({
    runDir: input.runDir,
    agentName: "seekbrain_formulation_generate",
    finalizeTool: "finalize_plan",
    finalizeSchema: input.finalizeSchema,
    prompt: input.prompt,
    agentConfig: input.agentConfig,
    tools: ["read", "bash", "grep", "find", "ls"],
    customTools: input.customTools,
    signal: input.signal,
    beforeToolCall: input.beforeToolCall,
  }),
  writeText,
  writeJson,
  appendEvent: (event) => appendStateEntry(pi, event),
});
const codeWorkflow = new CodeWorkflow({
  lifecycle: runLifecycle,
  retryPolicy: codeRetryPolicy,
  runAgent: async (input) => runSubagent({
    runDir: input.runDir,
    agentName: "seekbrain_code_execute",
    finalizeTool: "finalize_code_result",
    finalizeSchema: input.finalizeSchema,
    prompt: input.prompt,
    agentConfig: input.agentConfig,
    tools: ["read", "write", "edit", "bash"],
    signal: input.signal,
    afterToolCall: input.afterToolCall,
  }),
  writeText,
  writeJson,
  snapshot: snapshotRunArtifacts,
  appendEvent: (event) => appendStateEntry(pi, event),
});
const validateWorkflow = new ValidateWorkflow({
  lifecycle: runLifecycle,
  loadImages: loadVisionImages,
  runAgent: async (input) => runSubagent({
    runDir: input.runDir,
    agentName: "seekbrain_validation_run",
    finalizeTool: "finalize_validation",
    finalizeSchema: input.finalizeSchema,
    prompt: input.prompt,
    agentConfig: input.agentConfig,
    tools: ["read"],
    images: input.images,
    signal: input.signal,
  }),
  normalize: normalizeValidation,
  nextStep: validationNextStep,
  writeJson,
  snapshot: snapshotRunArtifacts,
  appendEvent: (event) => appendStateEntry(pi, event),
  handleRecipeFeedback: (input) => recipeRevisionManager.handle(input),
});
const imageWorkflow = new ImageWorkflow({
  lifecycle: runLifecycle,
  loadImages: loadVisionImages,
  runRefiner: async (input) => runSubagent({
    runDir: input.runDir,
    agentName: "seekbrain_figure_refine",
    finalizeTool: "finalize_refinement",
    finalizeSchema: input.finalizeSchema,
    prompt: input.prompt,
    agentConfig: input.agentConfig,
    tools: ["read", "write", "edit", "bash", "grep", "find", "ls"],
    images: input.images,
    signal: input.signal,
  }),
  createGuard: createRefinementGuard,
  finalizeGuard: (guard, succeeded) => finalizeRefinementGuard(
    guard as Awaited<ReturnType<typeof createRefinementGuard>>,
    succeeded,
  ),
  fastPass: fastPassRefinedValidation,
  nextStep: validationNextStep,
  writeJson,
  snapshot: snapshotRunArtifacts,
  appendEvent: (event) => appendStateEntry(pi, event),
});
const interpretWorkflow = new InterpretWorkflow({
  lifecycle: runLifecycle,
  currentArtifactsValidated,
  nextStep: validationNextStep,
  retrievePapers: (input, cwd, signal) => literatureProviderRouter.query(input, cwd, signal),
  loadImages: loadVisionImages,
  runAgent: async (input) => runSubagent({
    runDir: input.runDir,
    agentName: "seekbrain_interpretation_run",
    finalizeTool: "finalize_interpretation",
    finalizeSchema: input.finalizeSchema,
    prompt: input.prompt,
    agentConfig: input.agentConfig,
    tools: ["read"],
    customTools: input.customTools,
    images: input.images,
    signal: input.signal,
  }),
  writeJson,
  writeText,
  snapshot: snapshotRunArtifacts,
  appendEvent: (event) => appendStateEntry(pi, event),
  publishTaskEvent: async (event) => {
    const parent = await resolveRun(event.cwd, event.parentRunId);
    if (!parent.state.research_execution?.scheduler_path) return false;
    await researchTaskScheduler.publishEvent({
      cwd: event.cwd,
      parentRunId: event.parentRunId,
      taskId: event.taskId,
      type: "task_completed",
      payload: event.payload,
    });
    return true;
  },
});
  const executeResearchTask = createResearchTaskExecutor({
  runLifecycle,
  projectRoot: PROJECT_ROOT,
  loadConfig: loadConfigCached,
  workflowConfig: seekbrainWorkflowConfig,
  readPrompt,
    resolveRun,
    pickAgentConfig,
    literatureAgentConfig,
    humanGateEnabled,
  defaultMaxCodeAttempts: DEFAULT_MAX_CODE_ATTEMPTS,
  codeWorkflow,
  validateWorkflow,
  imageWorkflow,
  interpretWorkflow,
});
const researchTaskExecution = new ResearchTaskExecutionCoordinator({
  scheduler: researchTaskScheduler,
  executeTask: executeResearchTask,
});
const reviewWorkflow = new ReviewWorkflow({
  lifecycle: runLifecycle,
  writeText,
  writeJson,
  appendEvent: (event) => appendStateEntry(pi, event),
});

  const studyWorkflow = new StudyWorkflow({
    env,
    reportPdfPolicy: async () => {
      const config = await loadConfigCached(PROJECT_ROOT);
      return reportPdfPolicy(config.workflow?.seekbrain?.report?.pdf, env.SEEKBRAIN_REPORT_PDF_OVERRIDE);
    },
    maxCodeAttempts: DEFAULT_MAX_CODE_ATTEMPTS,
    runAgent: async ({ stage, run, workDir, prompt, schema, signal }) => {
      const config = await loadConfigCached(PROJECT_ROOT);
      const agentName = stage === "plan" ? "seekbrain_plan" : stage === "formulation" ? "seekbrain_formulation" : stage === "code" ? "seekbrain_code" : stage === "validation" ? "seekbrain_validate" : "seekbrain_report";
      const configuredName = config.agents?.[agentName] ? agentName : stage === "report" ? "seekbrain_interpret" : "seekbrain_plan";
      const customTools = stage === "plan" || stage === "report" ? [...literatureTools(), ...webTools(config)] : [];
      if (stage === "plan") customTools.push(...createScopedWriteTools(workDir, run.state.stage_write_paths || []));
      const reportSkillRoot = join(PACKAGE_ROOT, "skills", "report");
      const resourceUsage: Json = { skills_read: [], images_read: [], files_read: [], literature_queries: [] };
      const result = await runSubagent({
        runDir: run.runDir, workDir, agentName: `seekbrain_${stage}_014`,
        finalizeTool: stage === "plan" ? "finalize_scientific_plan" : stage === "formulation" ? "finalize_formulation" : stage === "code" ? "finalize_code_result" : stage === "validation" ? "finalize_validation" : "finalize_study_report",
        finalizeSchema: schema,
        prompt: `${await readPrompt(stage === "plan" ? "scientific_plan" : stage === "formulation" ? "task_formulation" : stage === "code" ? "study_code" : stage === "validation" ? "study_validation" : "study_report")}\n\n${prompt}`,
        // Old user overrides (e.g. Validation=300s) must not restore the
        // removed whole-stage deadline in the unified workflow.
        agentConfig: { ...pickAgentConfig(config, configuredName),
          ...(["code", "validation"].includes(stage) ? { timeout_seconds: 0 } : {}) },
        ...(stage === "plan" ? { beforeToolCall: async (event: any) => {
          const allowed = new Set(["read", "ls", "grep", "find", "bash", "finalize_scientific_plan", ...customTools.map(tool => tool.name)]);
          if (!allowed.has(event.toolName)) throw new Error(`Tool unavailable during planning: ${event.toolName}`);
          if (["write", "edit"].includes(event.toolName)) await assertWriteTarget(workDir, event.args?.path || "", run.state.stage_write_paths || []);
        } } : {}),
        tools: stage === "plan" ? ["read", "ls", "grep", "find", "bash"] : ["read", "write", "edit", "ls", "bash", "grep", "find"], customTools: [...new Map(customTools.map(tool => [tool.name, tool])).values()], signal,
        ...(stage === "plan" ? { skillPaths: [join(PACKAGE_ROOT, "skills", "plan")] } : {}),
        ...(stage === "report" ? {
          skillPaths: [reportSkillRoot],
          afterToolCall: async (event: any) => {
            if (event.isError) return;
            if (event.toolName === "read" && event.args?.path) {
              const path = resolve(workDir, event.args.path);
              if (path.startsWith(`${reportSkillRoot}/`) && path.endsWith("/SKILL.md")) resourceUsage.skills_read.push(path);
              else if (event.content?.some((part: any) => part.type === "image")) resourceUsage.images_read.push(path);
              else resourceUsage.files_read.push(path);
            }
            if (event.toolName === "seekbrain_literature_search") resourceUsage.literature_queries.push(event.args?.query);
            return undefined;
          },
        } : {}),
      });
      if (stage === "report") {
        try { await writeJson(join(run.runDir, "resource_usage.json"), resourceUsage); } catch { /* usage is diagnostic only */ }
      }
      return { ...(result.result || {}), __agent: { ok: result.ok, normal_end: result.normal_end === true, error: result.error, warnings: result.diagnostic_warnings } };
    },
  });
  return {
    studyWorkflow,
    literatureTools,
    webTools,
    taskBriefWorkflow,
    researchSkillWorkflow,
    researchSurveyWorkflow,
    researchPlanningWorkflow,
  creativeResearchPlanningWorkflow,
    creativeScientificSearchWorkflow,
    researchTaskScheduler,
    reportEvidenceCompiler,
    generateScientificReport,
    planWorkflow,
    codeWorkflow,
    validateWorkflow,
    imageWorkflow,
    interpretWorkflow,
    executeResearchTask,
    researchTaskExecution,
    reviewWorkflow,
  };
}
