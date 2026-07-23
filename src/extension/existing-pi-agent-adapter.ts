import { homedir } from "node:os";
import { join } from "node:path";
import type { AgentConfig } from "../core/index.ts";

type JsonObject = Record<string, unknown>;
type ModuleLoader = () => Promise<any>;

export interface ExistingPiAgentRequest {
  runDir: string;
  finalizeTool: string;
  finalizeSchema: unknown;
  prompt: string;
  agentConfig?: Readonly<AgentConfig>;
  tools?: string[];
  images?: JsonObject[];
  signal?: AbortSignal;
  onEvent?: (event: JsonObject) => void;
  onFinalize?: (payload: JsonObject) => Promise<void> | void;
}

export interface ExistingPiAgentResult {
  ok: boolean;
  result?: JsonObject;
  error?: string;
  stats?: JsonObject;
  timeout_seconds?: number;
}

export interface ExistingPiAgentAdapterOptions {
  agentDir?: string;
  prepareEnvironment?: () => Promise<void>;
  codingSdkLoader?: ModuleLoader;
  aiSdkLoader?: ModuleLoader;
}

export class ExistingPiAgentAdapter {
  readonly #options: ExistingPiAgentAdapterOptions;
  #codingSdk: any;
  #aiSdk: any;
  #modelRegistry: any;

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
      const { defineTool, createAgentSession, SessionManager } = sdk;
      if (!defineTool || !createAgentSession || !SessionManager) {
        throw new Error("Pi SDK subagent APIs are unavailable in this runtime");
      }

      let finalPayload: JsonObject | undefined;
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

      const activeTools = [...new Set([...(request.tools ?? []), request.finalizeTool])];
      const modelOptions = await this.resolveModel(request.agentConfig ?? {});
      const agentDir = this.#options.agentDir
        ?? process.env.PI_CODING_AGENT_DIR
        ?? join(homedir(), ".pi", "agent");
      ({ session } = await createAgentSession({
        cwd: request.runDir,
        agentDir,
        tools: activeTools,
        customTools: [finalize],
        sessionManager: SessionManager.inMemory(request.runDir),
        ...modelOptions,
        ...(request.agentConfig?.thinking ? { thinkingLevel: request.agentConfig.thinking } : {}),
      }));
      unsubscribe = session.subscribe((event: JsonObject) => request.onEvent?.(event));

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
        return { ok: false, error: `subagent did not call ${request.finalizeTool}`, stats, timeout_seconds: timeoutSeconds || undefined };
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
    const agentDir = this.#options.agentDir
      ?? process.env.PI_CODING_AGENT_DIR
      ?? join(homedir(), ".pi", "agent");
    const authStorage = this.#codingSdk.AuthStorage?.create?.(join(agentDir, "auth.json"));
    this.#modelRegistry = this.#codingSdk.ModelRegistry?.create?.(authStorage, join(agentDir, "models.json"));
    return this.#codingSdk;
  }

  private async resolveModel(agentConfig: Readonly<AgentConfig>): Promise<JsonObject> {
    if (!agentConfig.provider || !agentConfig.model) return {};
    try {
      await this.codingSdk();
      const custom = this.#modelRegistry?.find?.(agentConfig.provider, agentConfig.model);
      if (custom) return { model: custom };
    } catch {
      // Fall through to the Pi AI built-in registry.
    }
    try {
      const piAiModule = "@earendil-works/pi-ai";
      this.#aiSdk ??= await (this.#options.aiSdkLoader?.() ?? import(piAiModule));
      const model = this.#aiSdk.getModel?.(agentConfig.provider, agentConfig.model);
      return model ? { model } : {};
    } catch {
      return {};
    }
  }
}
