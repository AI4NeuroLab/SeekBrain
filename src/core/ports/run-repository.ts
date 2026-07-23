import type { RunStateDocument } from "../state/migrations.ts";

export interface CreateRun {
  runId: string;
  runDir: string;
  question: string;
  initialState?: Record<string, unknown>;
}

export type StateMutation = (state: Readonly<RunStateDocument>) => Record<string, unknown>;

export interface WorkflowEvent {
  type: string;
  at: string;
  payload?: Readonly<Record<string, unknown>>;
}

export interface RunRepository {
  create(input: CreateRun): Promise<RunStateDocument>;
  load(runId: string): Promise<RunStateDocument>;
  update(runId: string, mutation: StateMutation): Promise<RunStateDocument>;
  appendEvent(runId: string, event: WorkflowEvent): Promise<void>;
}
