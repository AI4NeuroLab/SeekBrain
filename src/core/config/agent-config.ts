import type { AgentConfig, SeekBrainConfig } from "../schemas/config.ts";

const INHERITED_AGENT_FIELDS = ["provider", "model", "thinking", "timeout_seconds"] as const;

export function resolveAgentConfig(
  config: Readonly<SeekBrainConfig>,
  agentName: string,
): AgentConfig {
  const specific = config.agents[agentName] ?? {};
  if (agentName === "seekbrain") return { ...specific };

  const defaults = config.agents.seekbrain_default ?? {};
  const resolved: AgentConfig = { ...specific };
  for (const field of INHERITED_AGENT_FIELDS) {
    if (resolved[field] === undefined && defaults[field] !== undefined) {
      Object.assign(resolved, { [field]: defaults[field] });
    }
  }
  return resolved;
}

export function mainPiArguments(agent: Readonly<AgentConfig>): string[] {
  const args: string[] = [];
  if (agent.provider) args.push("--provider", agent.provider);
  if (agent.model) {
    args.push("--model", agent.thinking ? `${agent.model}:${agent.thinking}` : agent.model);
  } else if (agent.thinking) {
    args.push("--thinking", agent.thinking);
  }
  return args;
}
