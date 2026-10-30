import { Type, type Static } from "typebox";
import { ArtifactSchema } from "./artifact.ts";
import { ExecutionContractSchema } from "./execution-contract.ts";
import { TaskBriefSchema } from "./task-brief.ts";

export const RunStatusSchema = Type.Union([
  Type.Literal("created"),
  Type.Literal("running"),
  Type.Literal("blocked"),
  Type.Literal("failed"),
  Type.Literal("completed"),
]);

export const StageStatusSchema = Type.Union([
  Type.Literal("pending"),
  Type.Literal("running"),
  Type.Literal("blocked"),
  Type.Literal("failed"),
  Type.Literal("completed"),
  Type.Literal("skipped"),
]);

export const StageStateSchema = Type.Object({
  status: StageStatusSchema,
  started_at: Type.Optional(Type.String()),
  finished_at: Type.Optional(Type.String()),
  detail: Type.Optional(Type.String()),
}, { additionalProperties: true });

export const RunStateSchema = Type.Object({
  schema_version: Type.Literal(2),
  run_id: Type.String({ minLength: 1 }),
  run_dir: Type.String({ minLength: 1 }),
  question: Type.Optional(Type.String()),
  original_question: Type.Optional(Type.String()),
  original_question_history: Type.Optional(Type.Array(Type.Object({
    at: Type.String(),
    text: Type.String(),
  }, { additionalProperties: false }))),
  task_brief: Type.Optional(TaskBriefSchema),
  task_brief_path: Type.Optional(Type.String()),
  execution_contract: Type.Optional(ExecutionContractSchema),
  execution_contract_path: Type.Optional(Type.String()),
  created_at: Type.Optional(Type.String()),
  updated_at: Type.Optional(Type.String()),
  status: Type.Optional(RunStatusSchema),
  stages: Type.Optional(Type.Record(Type.String(), StageStateSchema)),
  artifacts: Type.Array(ArtifactSchema),
  deliverables: Type.Optional(Type.Array(Type.Record(Type.String(), Type.Unknown()))),
  reviews: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
  usage: Type.Optional(Type.Record(Type.String(), Type.Number({ minimum: 0 }))),
}, { additionalProperties: true });

export type RunState = Static<typeof RunStateSchema>;
export type RunStatus = Static<typeof RunStatusSchema>;
export type StageState = Static<typeof StageStateSchema>;
