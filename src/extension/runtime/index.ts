import type { SeekBrainRuntimeOptions } from "./runtime-options.ts";
import { getModeController } from "./mode-controller.ts";
import { registerStudyReportCommand } from "../commands/study-report-command.ts";
import { createUnifiedStudyTools } from "./stages/unified-study-tools.ts";
import { createStudyStatusTools } from "./stages/study-status-tools.ts";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { FileRunRepository, PlanFinalizeSchema } from "../../core/index.ts";
import { ExistingPiAgentAdapter } from "../existing-pi-agent-adapter.ts";
import { createResearchPlanningTools, researchRouteSchema } from "./stages/research-planning-tools.ts";
import { createSystemTools } from "./stages/system-tools.ts";
import { createDatasetTools } from "./stages/dataset-tools.ts";
import { createReportingTools } from "./stages/reporting-tools.ts";
import { createRecipeResearchTools } from "./stages/recipe-research-tools.ts";
import { createLifecycleTools } from "./stages/lifecycle-tools.ts";
import { createReviewTools } from "./stages/review-tools.ts";
import { createCodeReviewTools } from "./stages/code-review-tools.ts";
import { createResearchExecutionTools } from "./stages/research-execution-tools.ts";
import { createFormulationTools } from "./stages/formulation-tools.ts";
import { createCodeExecutionTools } from "./stages/code-execution-tools.ts";
import { createValidationTools } from "./stages/validation-tools.ts";
import { createFigureRefinementTools } from "./stages/figure-refinement-tools.ts";
import { createInterpretationTools } from "./stages/interpretation-tools.ts";
import { createRuntimeSession } from "./create-runtime-session.ts";
import { createRuntimeServices } from "./create-runtime-services.ts";
import { researchCardMarkdown, skillCardMarkdown } from "./shared/transparency-content.ts";
import { createDependencyApprovalQueueFactory } from "./shared/dependency-approval-service.ts";
import { seekbrainReportFinalizeSchema } from "./shared/runtime-schemas.ts";
import { registerTools } from "./tool-registry.ts";
import type { SeekBrainToolDefinition } from "./runtime-types.ts";
import { readJson, writeJson } from "./shared/file-service.ts";
import { createRunAccess } from "./shared/run-access.ts";
import { createObservabilityService } from "./shared/observability-service.ts";
import { createConfigService } from "./shared/config-service.ts";
import { createSubagentRunner } from "./shared/subagent-runner.ts";
import { createCodeEditService } from "./shared/code-edit-service.ts";
import { registerSeekBrainRuntimeHooks } from "../runtime-hooks.ts";
import { registerSystemCommands } from "../commands/system-commands.ts";
import { registerShowCommand } from "../commands/show-command.ts";
import { registerSaveSkillCommand } from "../commands/save-skill-command.ts";
import { registerValidatedRepositoryScripts } from "../../targeted-skill/repository-cache.ts";
import { registerTransparencyCardRenderers } from "../tui/transparency-card.ts";
import { toPiToolResult } from "../tool-adapter.ts";
import {
  RunLifecycleWorkflow,
  type WorkflowRunContext,
} from "../../workflows/index.ts";
import { DEFAULT_MAX_CODE_ATTEMPTS } from "../../workflows/seekbrain/validation-policy.js";
import { writeSkill } from "../../targeted-skill/index.ts";

type Json = Record<string, any>;

const PACKAGE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const PROMPT_DIR = join(PACKAGE_ROOT, "prompts");
const DEFAULT_CONFIG_PATH = join(PACKAGE_ROOT, "config", "default.yaml");
const RUN_INDEX_FILE = ".pi/seekbrain/run_index.json";
const CONFIG_FILE = "seekbrain.config.yaml";

function content(details: Json, text?: string) {
  return toPiToolResult(details, limitForMain, text);
}

function limitForMain(details: Json) {
  const copy = { ...details };
  if (typeof copy.analysis_recipe === "string" && copy.analysis_recipe.length > 1200) {
    copy.analysis_recipe_preview = copy.analysis_recipe.slice(0, 1200);
    delete copy.analysis_recipe;
  }
  if (typeof copy.targeted_skill === "string" && copy.targeted_skill.length > 1200) {
    copy.targeted_skill_preview = copy.targeted_skill.slice(0, 1200);
    delete copy.targeted_skill;
  }
  if (typeof copy.subagent_transcript === "string") {
    delete copy.subagent_transcript;
  }
  return copy;
}

async function readPrompt(name: string) {
  return await readFile(join(PROMPT_DIR, `${name}.md`), "utf8");
}

type RunContext = WorkflowRunContext;

async function appendStateEntry(pi: ExtensionAPI, event: Json) {
  try {
    await pi.appendEntry("seekbrain-state", event);
  } catch {
    // appendEntry is best-effort; state.json remains the source of truth.
  }
}

export async function registerSeekBrainRuntime(pi: ExtensionAPI, options: SeekBrainRuntimeOptions = {}) {
  // Every extension registration owns its services, including when Pi reuses a cached factory.
  const env = { ...(options.env ?? process.env) };
  const PROJECT_ROOT = resolve(options.projectRoot || env.SEEKBRAIN_PROJECT_ROOT || env.SEEKBRAIN_ROOT || process.cwd());
  const runRepository = new FileRunRepository();
  const runLifecycle = new RunLifecycleWorkflow(runRepository);

  const configService = createConfigService({
    projectRoot: PROJECT_ROOT,
    defaultConfigPath: DEFAULT_CONFIG_PATH,
    configFile: CONFIG_FILE,
    env,
  });
  const {
    invalidateConfigCache,
    loadConfig,
    loadConfigCached,
    debugDiskWritesEnabled,
    syncWorkflowWritePolicy,
    seekbrainWorkflowConfig,
    pickAgentConfig,
    literatureAgentConfig,
    humanGateEnabled,
    loadEnv,
  } = configService;

  const codeEditService = createCodeEditService({
    projectRoot: PROJECT_ROOT,
    loadEnv,
  });

  const piAgentAdapter = new ExistingPiAgentAdapter({
    agentDir: env.SEEKBRAIN_CODING_AGENT_DIR || env.PI_CODING_AGENT_DIR,
    loadEnvironment: () => loadEnv(PROJECT_ROOT),
  });

  const observability = createObservabilityService({ debugDiskWritesEnabled });
  const {
    numberValue,
    readableLogEntriesFromEvent,
    appendReadableLog,
    appendRawCotLog,
    usageEntry,
    usageEntryFromMessage,
    tryAppendUsageEntry,
    flushUsageSummaries,
    mainSessionStats,
    writeDiagnosticJson,
    writeDiagnosticText,
    writeDiagnosticJsonl,
    snapshotSubagentFiles,
  } = observability;

  const runSubagent = createSubagentRunner({
    adapter: piAgentAdapter,
    debugDiskWritesEnabled,
    usageEntry,
    tryAppendUsageEntry,
    writeDiagnosticJson,
    writeDiagnosticText,
    writeDiagnosticJsonl,
    readableLogEntriesFromEvent,
    snapshotSubagentFiles,
  });

  const runAccess = createRunAccess({
    lifecycle: runLifecycle,
    debugDiskWritesEnabled,
  });
  const {
    loadRunState,
    effectiveMetadata,
    resolveQuestion,
    startRun,
    resolveRun,
    resumeRun,
    updateState,
    snapshotRunArtifacts,
  } = runAccess;
  const createDependencyApprovalQueue = createDependencyApprovalQueueFactory({
    projectRoot: PROJECT_ROOT,
    loadEnv,
    resolveRun,
    updateState,
  });

  const collectedToolDefinitions: SeekBrainToolDefinition[] = [];
  const toolDefinitions = {
    push: ((definition: SeekBrainToolDefinition) => collectedToolDefinitions.push(definition)) as ExtensionAPI["registerTool"],
  };
  const session = createRuntimeSession({
    projectRoot: PROJECT_ROOT,
    configFile: CONFIG_FILE,
    invalidateConfig: invalidateConfigCache,
    loadConfig: loadConfigCached,
    env,
  });
  registerTransparencyCardRenderers(pi);
  const {
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
  } = createRuntimeServices({
    pi,
    session,
    packageRoot: PACKAGE_ROOT,
    projectRoot: PROJECT_ROOT,
    env,
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
  });
  // Pre-warm the validated TypeScript config loader so the first tool call
  // does not pay YAML parsing and schema-validation cost.
  //
  // IMPORTANT: do NOT `await` here. This factory registers all commands/tools
  // below; an `await` before those registrations suspends the (async) factory
  // and defers registration past pi's command-palette snapshot, so slash
  // Commands such as /seekbrain-show and /seekbrain-save-recipe must remain available. Fire-and-forget.
  void loadConfigCached(PROJECT_ROOT || process.cwd()).catch(() => {
    // Best-effort warm-up; real error surfaces at first tool call.
  });

  registerSeekBrainRuntimeHooks(pi, {
    restoreSessionRun: () => session.setActiveRunDir(getModeController(pi).project ? join(getModeController(pi).project!, ".seekbrain") : undefined),
    getActiveRunDir: session.getActiveRunDir,
    setActiveRunDir: session.setActiveRunDir,
    startConfigWatcher: session.startConfigWatcher,
    stopConfigWatcher: session.stopConfigWatcher,
    flushUsageSummaries,
    syncWorkflowWritePolicy,
    usageEntryFromMessage,
    appendUsage: tryAppendUsageEntry,
    readableLogEntries: readableLogEntriesFromEvent,
    appendReadableLog,
    appendRawCotLog,
    transparencyEnabled: async () => seekbrainWorkflowConfig(await loadConfig(PROJECT_ROOT)).transparency,
    readRunState: (runDir) => readJson(join(runDir, "state.json"), {}),
    researchCard: researchCardMarkdown,
    skillCard: skillCardMarkdown,
    numberValue,
  });

  registerSystemCommands(pi, {
    workflowRoot: PROJECT_ROOT,
    invalidateConfig: invalidateConfigCache,
    loadConfig: loadConfigCached,
  });

  registerShowCommand(pi, {
    getActiveRunDir: session.getActiveRunDir,
    readJson,
    resolveRun,
    loadRunState,
    runIndexPath: (cwd) => resolve(cwd, RUN_INDEX_FILE),
  });

  registerSaveSkillCommand(pi, {
    workflowRoot: PROJECT_ROOT,
    getActiveRunDir: session.getActiveRunDir,
    loadConfig,
    saveSkillEnabled: (config) => seekbrainWorkflowConfig(config).save_skill,
    readJson,
    writeJson,
    resolveRun,
    loadRunState,
    runIndexPath: (cwd) => resolve(cwd, RUN_INDEX_FILE),
    readRolePrompt: () => readPrompt("save_skill"),
    runNamer: async ({ runDir, prompt, config }) => runSubagent({
      runDir,
      agentName: "save_skill_namer",
      finalizeTool: "finalize_smmt",
      finalizeSchema: Type.Object({
        stage: Type.String(),
        species: Type.String(),
        modality: Type.String(),
        method: Type.String(),
        target: Type.String(),
        rationale: Type.String(),
        proposed_description: Type.String(),
        triggers: Type.Array(Type.String()),
        tags: Type.Array(Type.String()),
      }),
      prompt,
      agentConfig: pickAgentConfig(config, "seekbrain_save_skill"),
      tools: [],
    }),
    writeSkill,
    updateState: async (run, patch) => {
      await updateState(run as RunContext, patch);
    },
    appendEvent: (event) => appendStateEntry(pi, event),
    registerRepositoryScripts: (input) => registerValidatedRepositoryScripts(input),
  });

  registerStudyReportCommand(pi, { workflow: studyWorkflow, getActiveRunDir: session.getActiveRunDir });

  collectedToolDefinitions.push(...createReportingTools({
    compiler: reportEvidenceCompiler,
    generate: generateScientificReport,
    content,
  }));

  collectedToolDefinitions.push(...createSystemTools({
    lifecycle: runLifecycle,
    loadConfig: loadConfigCached,
    content,
  }));
  collectedToolDefinitions.push(...createDatasetTools({
    loadEnv,
    loadConfig: loadConfigCached,
    readPrompt,
    pickAgentConfig,
    runSubagent,
    content,
  }));
  collectedToolDefinitions.push(...createLifecycleTools({
    lifecycle: runLifecycle,
    taskBriefWorkflow,
    planningWorkflow: researchPlanningWorkflow,
    loadConfig: loadConfigCached,
    workflowConfig: seekbrainWorkflowConfig,
    readPrompt,
    pickAgentConfig,
    researchRouteSchema,
    startRun,
    resumeRun,
    writeJson,
    setActiveRunDir: session.setActiveRunDir,
    content,
  }));

  collectedToolDefinitions.push(...createResearchPlanningTools({
    projectRoot: PROJECT_ROOT,
    lifecycle: runLifecycle,
    taskBriefWorkflow,
    planningWorkflow: researchPlanningWorkflow,
    creativeWorkflow: creativeResearchPlanningWorkflow,
    creativeSearchWorkflow: creativeScientificSearchWorkflow,
    scheduler: researchTaskScheduler,
    surveyWorkflow: researchSurveyWorkflow,
    loadConfig: loadConfigCached,
    workflowConfig: seekbrainWorkflowConfig,
    readPrompt,
    pickAgentConfig,
    pickLiteratureAgentConfig: literatureAgentConfig,
    resolveRun,
    setActiveRunDir: session.setActiveRunDir,
    content,
  }));
  collectedToolDefinitions.push(...createResearchExecutionTools({
    projectRoot: PROJECT_ROOT,
    scheduler: researchTaskScheduler,
    executionCoordinator: researchTaskExecution,
    executeTask: executeResearchTask,
    reviewWorkflow,
    researchSkillWorkflow,
    planWorkflow,
    loadConfig: loadConfigCached,
    workflowConfig: seekbrainWorkflowConfig,
    humanGateEnabled,
    readPrompt,
    resolveRun,
    pickAgentConfig,
    createDependencyApprovalQueue,
    content,
  }));
  collectedToolDefinitions.push(...createReviewTools({
    workflow: reviewWorkflow,
    resolveRun,
    revisePlan: async (input) => {
      const config = await loadConfigCached(PROJECT_ROOT);
      return planWorkflow.revise({
        ...input,
        rolePrompt: await readPrompt("plan"),
        agentConfig: pickAgentConfig(config, "seekbrain_plan"),
        finalizeSchema: PlanFinalizeSchema,
      });
    },
    content,
  }));

  collectedToolDefinitions.push(...createCodeReviewTools({
    workflow: reviewWorkflow,
    codeEditService,
    resolveRun,
    snapshotRunArtifacts,
    content,
  }));
  collectedToolDefinitions.push(...createRecipeResearchTools({
    workflowRoot: PROJECT_ROOT,
    workflow: researchSkillWorkflow,
    loadConfig: loadConfigCached,
    workflowConfig: seekbrainWorkflowConfig,
    literatureAgentConfig,
    readPrompt,
    content,
  }));
  collectedToolDefinitions.push(...createFormulationTools({
    workflow: planWorkflow,
    loadConfig: loadConfigCached,
    readPrompt,
    pickAgentConfig,
    humanGateEnabled,
    content,
  }));

  collectedToolDefinitions.push(...createCodeExecutionTools({
    workflow: codeWorkflow,
    loadConfig: loadConfigCached,
    readPrompt,
    pickAgentConfig,
    humanGateEnabled,
    defaultMaxCodeAttempts: DEFAULT_MAX_CODE_ATTEMPTS,
    createDependencyApprovalQueue,
    content,
  }));

  collectedToolDefinitions.push(...createValidationTools({
    workflow: validateWorkflow,
    loadConfig: loadConfigCached,
    readPrompt,
    pickAgentConfig,
    defaultMaxCodeAttempts: DEFAULT_MAX_CODE_ATTEMPTS,
    content,
  }));

  collectedToolDefinitions.push(...createFigureRefinementTools({
    workflow: imageWorkflow,
    loadConfig: loadConfigCached,
    workflowConfig: seekbrainWorkflowConfig,
    readPrompt,
    pickAgentConfig,
    content,
  }));

  collectedToolDefinitions.push(...createInterpretationTools({
    workflow: interpretWorkflow,
    loadConfig: loadConfigCached,
    readPrompt,
    literatureAgentConfig,
    content,
  }));
  const unified = createUnifiedStudyTools({ deepResearchMaxRounds: async () => (await loadConfigCached(PROJECT_ROOT)).workflow?.seekbrain?.deep_research?.max_rounds ?? 3, workflow: studyWorkflow, setActiveRunDir: session.setActiveRunDir, getMode: () => getModeController(pi).mode, getProjectPath: () => getModeController(pi).project, content });
  const datasetTools = collectedToolDefinitions.filter(tool => tool.name === "seekbrain_data_resolve");
  const system = [...createStudyStatusTools({ workflow: studyWorkflow, getProjectPath: () => getModeController(pi).project, content }), ...datasetTools];
  const controller = getModeController(pi);
  const refreshWebAccess = async () => {
    const config = await loadConfigCached(PROJECT_ROOT);
    controller.webSearchEnabled = config.workflow?.seekbrain?.web_search !== false;
    pi.setActiveTools(pi.getAllTools().map(tool => tool.name).filter(name => controller.allows(name)));
  };
  pi.on("session_start", refreshWebAccess);
  pi.on("before_agent_start", refreshWebAccess);
  const definitions = [...system, ...unified, ...literatureTools(), ...webTools()];
  registerTools(pi, definitions.map(tool => ({ ...tool,
    execute: (id: string, params: any, signal: AbortSignal | undefined, update: any, ctx: any) => controller.run(tool.name, signal, combined => Promise.resolve(tool.execute(id, params, combined, update, ctx)) as Promise<any>),
  })) as SeekBrainToolDefinition[]);
}
