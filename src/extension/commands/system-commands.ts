type Json = Record<string, any>;

export interface SystemCommandAPI {
  registerCommand(name: string, command: Json): void;
  sendMessage(message: Json): void;
  getAllTools(): Array<{ name: string }>;
  getActiveTools(): string[];
}

export interface SystemCommandDependencies {
  workflowRoot: string;
  invalidateConfig(): void;
  loadConfig(cwd: string): Promise<Json>;
}

export function registerSystemCommands(pi: SystemCommandAPI, dependencies: SystemCommandDependencies): void {
  pi.registerCommand("neuro_reload_config", {
    description: "Force-reload SeekBrain config (bypasses the in-memory cache).",
    async handler(_args: string, context: Json) {
      dependencies.invalidateConfig();
      try {
        const next = await dependencies.loadConfig(context?.cwd || dependencies.workflowRoot || process.cwd());
        pi.sendMessage({ customType: "seekbrain-config", content: JSON.stringify({ extension: "seekbrain", reloaded: true, workflow: next.workflow || {} }, null, 2), display: true });
      } catch (error) {
        pi.sendMessage({ customType: "seekbrain-config", content: JSON.stringify({ extension: "seekbrain", reloaded: false, error: String(error) }, null, 2), display: true });
      }
    },
  });

  pi.registerCommand("neuro_tools", {
    description: "Show SeekBrain loaded and active tools.",
    async handler() {
      const allTools = pi.getAllTools().map((tool) => tool.name);
      const activeTools = pi.getActiveTools();
      pi.sendMessage({
        customType: "seekbrain-tools",
        content: JSON.stringify({
          extension: "seekbrain", all_tools: allTools, active_tools: activeTools,
          has_neuro_start_run: allTools.includes("neuro_start_run"), active_neuro_start_run: activeTools.includes("neuro_start_run"),
          has_neuro_start_research: allTools.includes("neuro_start_research"), active_neuro_start_research: activeTools.includes("neuro_start_research"),
          has_neuro_continue_research: allTools.includes("neuro_continue_research"), active_neuro_continue_research: activeTools.includes("neuro_continue_research"),
        }, null, 2),
        display: true,
      });
    },
  });
}
