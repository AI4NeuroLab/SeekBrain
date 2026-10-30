import { Type, type Static } from "typebox";

export const TaskIntentModeSchema = Type.Union([
  Type.Literal("focused_analysis"),
  Type.Literal("open_discovery"),
]);

export const TaskIntentStatusSchema = Type.Union([
  Type.Literal("ready"),
  Type.Literal("ambiguous"),
]);

const TaskBriefSemanticFields = {
  scientific_goal: Type.String({ minLength: 1 }),
  intent_mode: TaskIntentModeSchema,
  intent_status: TaskIntentStatusSchema,
  biological_scope: Type.Array(Type.String(), { maxItems: 12 }),
  requested_data: Type.Array(Type.String(), { maxItems: 16 }),
  hard_constraints: Type.Array(Type.String(), { maxItems: 20 }),
  output_preferences: Type.Array(Type.String(), { maxItems: 12 }),
};

/** Agent-authored semantic intake. raw_question is stamped deterministically. */
export const TaskBriefDraftSchema = Type.Object(
  TaskBriefSemanticFields,
  { additionalProperties: false },
);

/** Lightweight authoritative handoff used by Route, RecipeScout, Plan, and Validation. */
export const TaskBriefSchema = Type.Object({
  raw_question: Type.String({ minLength: 1 }),
  ...TaskBriefSemanticFields,
}, { additionalProperties: false });

export const ExecutionTopologySchema = Type.Union([
  Type.Literal("single_pipeline"),
  Type.Literal("independent_branches"),
  Type.Literal("open_discovery"),
]);

export type TaskBrief = Static<typeof TaskBriefSchema>;
export type TaskBriefDraft = Static<typeof TaskBriefDraftSchema>;
export type TaskIntentMode = Static<typeof TaskIntentModeSchema>;
export type TaskIntentStatus = Static<typeof TaskIntentStatusSchema>;
export type ExecutionTopology = Static<typeof ExecutionTopologySchema>;
