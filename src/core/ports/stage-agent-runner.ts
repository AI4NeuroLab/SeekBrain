import type { StageOutcome } from "../schemas/stage-outcome.ts";

export interface StageAgentRequest<T> {
  role: string;
  prompt: string;
  tools: readonly string[];
  timeoutMs: number;
  signal?: AbortSignal;
  parse(output: unknown): T;
}

export interface StageAgentRunner {
  run<T>(request: StageAgentRequest<T>): Promise<StageOutcome<T>>;
}
