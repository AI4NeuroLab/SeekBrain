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
  pi.registerCommand("seekbrain-reload-config", {
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

  pi.registerCommand("seekbrain-tools", {
    description: "Show loaded and active SeekBrain tools.",
    async handler() {
      const allTools = pi.getAllTools().map((tool) => tool.name);
      const activeTools = pi.getActiveTools();
      pi.sendMessage({
        customType: "seekbrain-tools",
        content: JSON.stringify({
          extension: "seekbrain", all_tools: allTools, active_tools: activeTools,
          has_seekbrain_plan_generate: allTools.includes("seekbrain_plan_generate"), active_seekbrain_plan_generate: activeTools.includes("seekbrain_plan_generate"),
          has_seekbrain_research_start: allTools.includes("seekbrain_research_start"), active_seekbrain_research_start: activeTools.includes("seekbrain_research_start"),
          has_seekbrain_execution_run: allTools.includes("seekbrain_execution_run"), active_seekbrain_execution_run: activeTools.includes("seekbrain_execution_run"),
        }, null, 2),
        display: true,
      });
    },
  });
}
