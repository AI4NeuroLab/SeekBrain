export interface WorkflowError {
  code: string;
  message: string;
  details?: Readonly<Record<string, unknown>>;
}

export type StageOutcome<T> =
  | { status: "completed"; value: T }
  | { status: "skipped"; reason: string }
  | { status: "blocked"; reason: string; nextAction: string }
  | { status: "failed"; error: WorkflowError; retryable: boolean };
