import { homedir } from "node:os";
import { join } from "node:path";
import type { AgentConfig } from "../core/index.ts";
import { withModelEnvironment } from "./runtime/shared/scoped-model-runtime.ts";
import { installAnthropicThinkingCompatibility } from "../compat/anthropic-thinking.mjs";
import { mergeEnvironment } from "../platform/environment.mjs";
import { pythonProcessEnvironment, resolvePythonCommand } from "../platform/python.mjs";

type JsonObject = Record<string, unknown>;
type ModuleLoader = () => Promise<any>;

export interface ExistingPiCustomTool {
  name: string;
  label?: string;
  description: string;
  promptSnippet?: string;
  promptGuidelines?: string[];
  parameters: unknown;
  execute: (...args: any[]) => Promise<unknown> | unknown;
}

export interface ExistingPiAgentRequest {
  runDir: string;
  finalizeTool: string;
  finalizeSchema: unknown;
  prompt: string;
  agentConfig?: Readonly<AgentConfig>;
  tools?: string[];
  customTools?: ExistingPiCustomTool[];
  images?: JsonObject[];
  skillPaths?: string[];
  signal?: AbortSignal;
  onEvent?: (event: JsonObject) => void;
  onFinalize?: (payload: JsonObject) => Promise<void> | void;
  beforeToolCall?: (event: { toolName: string; toolCallId?: string; args: unknown }) => Promise<void> | void;
  afterToolCall?: (
    event: {
      toolName: string;
      toolCallId?: string;
      args: unknown;
      content: unknown[];
      details?: unknown;
      isError: boolean;
    },
    signal?: AbortSignal,
  ) => Promise<{
    content?: unknown[];
    details?: unknown;
    isError?: boolean;
    terminate?: boolean;
  } | undefined>;
}

export interface ExistingPiAgentResult {
  ok: boolean;
  normal_end?: boolean;
  result?: JsonObject;
  error?: string;
  stats?: JsonObject;
  timeout_seconds?: number;
}

export interface ExistingPiAgentAdapterOptions {
  agentDir?: string;
  prepareEnvironment?: () => Promise<void>;
  loadEnvironment?: () => Promise<NodeJS.ProcessEnv>;
  codingSdkLoader?: ModuleLoader;
}

export class ExistingPiAgentAdapter {
  readonly #options: ExistingPiAgentAdapterOptions;
  #codingSdk: any;
  #modelRuntime: Promise<any> | undefined;

  constructor(options: ExistingPiAgentAdapterOptions = {}) {
    this.#options = options;
  }

  async run(request: ExistingPiAgentRequest): Promise<ExistingPiAgentResult> {
    let session: any;
    let unsubscribe: (() => void) | undefined;
    let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
    let signalAbort: (() => void) | undefined;
    const timeoutSeconds = this.timeoutSeconds(request.agentConfig);
    try {
      const sdk = await this.codingSdk();
      const environment = await this.#options.loadEnvironment?.();
      const agentDir = this.#options.agentDir
        ?? process.env.PI_CODING_AGENT_DIR
        ?? join(homedir(), ".pi", "agent");
      const settingsManager = sdk.SettingsManager?.create(request.runDir, agentDir);
      const { defineTool, createAgentSession, SessionManager } = sdk;
      if (!defineTool || !createAgentSession || !SessionManager) {
        throw new Error("Pi SDK subagent APIs are unavailable in this runtime");
      }

      let finalPayload: JsonObject | undefined;
      let normalEnd = false;
      const finalize = defineTool({
        name: request.finalizeTool,
        label: request.finalizeTool,
        description: "Finalize the isolated SeekBrain subagent result.",
        parameters: request.finalizeSchema,
        async execute(_toolCallId: string, params: JsonObject) {
          finalPayload = params;
          await request.onFinalize?.(params);
          return {
            content: [{ type: "text", text: "Finalized." }],
            details: params,
            terminate: true,
          };
        },
      });

      const customTools = (request.customTools ?? []).map((tool) => defineTool(tool));
      if (environment && request.tools?.includes("bash") && sdk.createBashToolDefinition && !customTools.some((tool: any) => tool.name === "bash")) {
        const python = resolvePythonCommand(environment);
        const bash = sdk.createBashToolDefinition(request.runDir, {
          shellPath: settingsManager?.getShellPath(),
          commandPrefix: settingsManager?.getShellCommandPrefix(),
          spawnHook: (context: any) => ({ ...context, env: mergeEnvironment(context.env, {
            ...pythonProcessEnvironment(environment),
            SEEKBRAIN_PYTHON: process.platform === "win32" ? python.replace(/\\/g, "/") : python,
          }) }),
        });
        bash.promptGuidelines = [...(bash.promptGuidelines || []),
          'Run Python with "$SEEKBRAIN_PYTHON" so analysis uses the configured interpreter, including paths containing spaces.'];
        customTools.push(bash);
      }
      const activeTools = [...new Set([
        ...(request.tools ?? []),
        ...customTools.map((tool: { name: string }) => tool.name),
        request.finalizeTool,
      ])];
      const modelOptions = await this.resolveModel(request.agentConfig ?? {});
      if (environment && modelOptions.modelRuntime) {
        modelOptions.modelRuntime = withModelEnvironment(modelOptions.modelRuntime as object, environment, { agentDir: this.#options.agentDir });
        // The SDK checks its synchronous auth snapshot before starting a turn.
        // Populate the session-scoped snapshot for keys supplied only by .env.
        await (modelOptions.modelRuntime as any).getAvailable?.();
      }
      let resourceLoader: any;
      if (request.skillPaths?.length) {
        if (!sdk.DefaultResourceLoader) throw new Error("Pi SDK skill resource loader is unavailable");
        resourceLoader = new sdk.DefaultResourceLoader({ cwd: request.runDir, agentDir, additionalSkillPaths: request.skillPaths });
        await resourceLoader.reload();
      }
      ({ session } = await createAgentSession({
        cwd: request.runDir,
        agentDir,
        tools: activeTools,
        customTools: [finalize, ...customTools],
        sessionManager: SessionManager.inMemory(request.runDir),
        ...(settingsManager ? { settingsManager } : {}),
        ...(resourceLoader ? { resourceLoader } : {}),
        ...modelOptions,
        ...(request.agentConfig?.thinking ? { thinkingLevel: request.agentConfig.thinking } : {}),
      }));
      // Also cover SDK-selected runtimes when no explicit model/env was passed.
      installAnthropicThinkingCompatibility(session.modelRuntime, { agentDir });
      if (request.afterToolCall && session.agent) {
        const previousAfterToolCall = session.agent.afterToolCall?.bind(session.agent);
        session.agent.afterToolCall = async (context: any, signal?: AbortSignal) => {
          const previous = await previousAfterToolCall?.(context, signal);
          const content = previous?.content ?? context.result?.content ?? [];
          const details = previous?.details ?? context.result?.details;
          const isError = previous?.isError ?? context.isError;
          const next = await request.afterToolCall?.({
            toolName: String(context.toolCall?.name || ""),
            toolCallId: context.toolCall?.id,
            args: context.args,
            content,
            details,
            isError,
          }, signal);
          if (!next) return previous;
          return {
            content: next.content ?? content,
            details: next.details ?? details,
            isError: next.isError ?? isError,
            terminate: next.terminate ?? previous?.terminate,
          };
        };
      }
      if (request.beforeToolCall && session.agent) {
        const previousBeforeToolCall = session.agent.beforeToolCall?.bind(session.agent);
        session.agent.beforeToolCall = async (context: any) => {
          const previous = await previousBeforeToolCall?.(context);
          await request.beforeToolCall?.({
            toolName: String(context.toolCall?.name || ""),
            toolCallId: context.toolCall?.id,
            args: context.args,
          });
          return previous;
        };
      }
      unsubscribe = session.subscribe((event: JsonObject) => {
        const message = event.message as JsonObject | undefined;
        if (event.type === "message_end" && message?.role === "assistant") normalEnd = message.stopReason === "stop";
        request.onEvent?.(event);
      });

      const promptPromise = request.images?.length
        ? session.prompt(request.prompt, { images: request.images })
        : session.prompt(request.prompt);
      const guards: Promise<never>[] = [];
      if (timeoutSeconds > 0) {
        guards.push(new Promise((_, reject) => {
          timeoutHandle = setTimeout(
            () => reject(new Error(`subagent timed out after ${timeoutSeconds}s`)),
            timeoutSeconds * 1000,
          );
        }));
      }
      if (request.signal) {
        guards.push(new Promise((_, reject) => {
          signalAbort = () => reject(new Error("subagent aborted by caller"));
          if (request.signal?.aborted) signalAbort();
          else request.signal?.addEventListener("abort", signalAbort, { once: true });
        }));
      }
      await (guards.length ? Promise.race([promptPromise, ...guards]) : promptPromise);
      const stats = session.getSessionStats?.() as JsonObject | undefined;
      if (!finalPayload) {
        return { ok: false, normal_end: normalEnd, error: `subagent did not call ${request.finalizeTool}`, stats, timeout_seconds: timeoutSeconds || undefined };
      }
      return { ok: true, result: finalPayload, stats };
    } catch (error) {
      const stats = session?.getSessionStats?.() as JsonObject | undefined;
      return { ok: false, error: String(error), stats, timeout_seconds: timeoutSeconds || undefined };
    } finally {
      if (timeoutHandle) clearTimeout(timeoutHandle);
      if (request.signal && signalAbort) request.signal.removeEventListener("abort", signalAbort);
      unsubscribe?.();
      await session?.dispose?.();
    }
  }

  timeoutSeconds(agentConfig: Readonly<AgentConfig> | undefined): number {
    const value = Number(agentConfig?.timeout_seconds ?? 0);
    return Number.isFinite(value) && value > 0 ? value : 0;
  }

  private async codingSdk(): Promise<any> {
    if (this.#codingSdk) return this.#codingSdk;
    await this.#options.prepareEnvironment?.();
    this.#codingSdk = await (this.#options.codingSdkLoader?.()
      ?? import("@earendil-works/pi-coding-agent"));
    return this.#codingSdk;
  }

  private async resolveModel(agentConfig: Readonly<AgentConfig>): Promise<JsonObject> {
    const explicitModel = Boolean(agentConfig.provider && agentConfig.model);
    if (!explicitModel && !this.#options.loadEnvironment) return {};
    const sdk = await this.codingSdk();
    const agentDir = this.#options.agentDir
      ?? process.env.PI_CODING_AGENT_DIR
      ?? join(homedir(), ".pi", "agent");
    this.#modelRuntime ??= sdk.ModelRuntime.create({
      authPath: join(agentDir, "auth.json"),
      modelsPath: join(agentDir, "models.json"),
      allowModelNetwork: false,
    });
    const modelRuntime = await this.#modelRuntime;
    await modelRuntime.refresh({ allowNetwork: false });
    if (!explicitModel) return { modelRuntime };
    const model = modelRuntime.getModel(agentConfig.provider, agentConfig.model);
    if (!model) throw new Error(`Configured subagent model is unavailable: ${agentConfig.provider}/${agentConfig.model}`);
    return { model, modelRuntime };
  }
}
