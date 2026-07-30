import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { join, resolve } from "node:path";
import type { RunLifecycleWorkflow, WorkflowRunContext } from "../../workflows/index.ts";
import {
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
import {
  DEFAULT_MAX_CODE_ATTEMPTS,
  codeRetryPolicy,
  currentArtifactsValidated,
  fastPassRefinedValidation,
  normalizeValidation,
  validationNextStep,
} from "../../workflows/seekbrain/validation-policy.js";
import { LiteratureProviderRouter, PubMedRetriever, SemanticScholarRetriever } from "../../literature-compat/index.ts";
import { PaperRagClient, RagSkillGenerator, SkillLibraryManager, TargetedSkillResolver } from "../../targeted-skill/index.ts";
import {
  createRefinementGuard,
  finalizeRefinementGuard,
  loadVisionImages,
} from "./shared/artifact-service.ts";
import { writeJson, writeText } from "./shared/file-service.ts";
import { createResearchTaskExecutor } from "./create-research-task-executor.ts";
import type { RuntimeSession } from "./create-runtime-session.ts";
import type { Json } from "./runtime-types.ts";

export interface RuntimeServiceFactoryDependencies {
  pi: ExtensionAPI;
  session: RuntimeSession;
  packageRoot: string;
  projectRoot: string;
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
    }),
    prompt: [
      prompt,
      "Convert the five requested mapping sections into a reusable SeekBrain SKILL.md body while preserving their scientific content and evidence boundaries.",
      "The Recipe must state its objective, required inputs, procedure, expected outputs, validation criteria, paper-to-code mapping, and gaps.",
      "Do not invent repository functions, parameters, dependencies, data schemas, or results. Include analysis_script only when the supplied repository excerpts support it; otherwise return an empty string.",
      "Return only through finalize_targeted_skill with { name, description, triggers, tags, skill_body, analysis_script?, utility_script? }.",
      `Repository URL: ${input.repoLink}`,
      `Repository overview:\n${input.repoOverview}`,
    ].join("\n\n"),
    agentConfig: pickAgentConfig(config, "seekbrain_skill_generate"),
    tools: [],
    signal: input.signal,
  });
  if (!authored.ok || !authored.result) throw new Error((authored as Json).error || "Recipe Crystallization Agent did not finalize");
  return authored.result;
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
        selected: Type.Array(Type.Object({ name: Type.String(), path: Type.String(), score: Type.Number(), reason: Type.String() })),
      }),
      prompt: [
        "You are the isolated SeekBrain analysis-recipe matcher. Carefully read the name and description of each recipe and assess its relevance to the user's question.",
        `Assign a relevance score between 0 and 1 to each relevant recipe. Only keep scores greater than or equal to ${input.threshold}, and return at most ${input.topK}.`,
        "If no analysis recipe is relevant, return an empty selected array.",
        "Return exact candidate name and path only through finalize_targeted_skill_match.",
        `Question:\n${input.question}`,
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
const researchSkillWorkflow = new ResearchSkillWorkflow({
  lifecycle: runLifecycle,
  resolveSkill: (input, cwd, signal) => targetedSkillResolver.resolve(input, cwd, signal),
  retrievePapers: (input, cwd, signal) => literatureProviderRouter.query(input, cwd, signal),
  runAgent: async (input) => runSubagent({
    runDir: input.runDir,
    agentName: "seekbrain_deep_research",
    finalizeTool: "finalize_deep_research",
    finalizeSchema: input.finalizeSchema,
    prompt: input.prompt,
    agentConfig: input.agentConfig,
    tools: [],
    signal: input.signal,
  }),
  writeJson,
  writeText,
  appendEvent: (event) => appendStateEntry(pi, event),
  summarize: limitForMain,
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
    tools: [],
    signal: input.signal,
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
    tools: [],
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
  runAgent: async (input) => runSubagent({
    runDir: input.runDir,
    agentName: "seekbrain_formulation_generate",
    finalizeTool: "finalize_plan",
    finalizeSchema: input.finalizeSchema,
    prompt: input.prompt,
    agentConfig: input.agentConfig,
    tools: [],
    signal: input.signal,
  }),
  writeText,
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
  loadImages: loadVisionImages,
  runAgent: async (input) => runSubagent({
    runDir: input.runDir,
    agentName: "seekbrain_interpretation_run",
    finalizeTool: "finalize_interpretation",
    finalizeSchema: input.finalizeSchema,
    prompt: input.prompt,
    agentConfig: input.agentConfig,
    tools: ["read"],
    images: input.images,
    signal: input.signal,
  }),
  writeJson,
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
  projectRoot: PROJECT_ROOT,
  loadConfig: loadConfigCached,
  workflowConfig: seekbrainWorkflowConfig,
  readPrompt,
  resolveRun,
  pickAgentConfig,
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
  appendEvent: (event) => appendStateEntry(pi, event),
});

  return {
    researchSkillWorkflow,
    researchSurveyWorkflow,
    researchPlanningWorkflow,
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
