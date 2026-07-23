import type { StageAgentRunner, StageOutcome } from "../../core/index.ts";
import type { SeekBrainStage } from "./transitions.ts";

export interface WorkflowStage<I, O> {
  readonly name: SeekBrainStage;
  execute(input: I, runner: StageAgentRunner, signal?: AbortSignal): Promise<StageOutcome<O>>;
}
