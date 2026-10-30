import { Type, type Static } from "typebox";

export const AgentConfigSchema = Type.Object({
  provider: Type.Optional(Type.String()),
  model: Type.Optional(Type.String()),
  thinking: Type.Optional(Type.String()),
  timeout_seconds: Type.Optional(Type.Number({ minimum: 0 })),
  vision: Type.Optional(Type.Boolean()),
  rag: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
}, { additionalProperties: true });

export const LiteratureConfigSchema = Type.Object({
  paper_source: Type.Optional(Type.Union([
    Type.Literal("ailab_rag"),
    Type.Literal("semantic_scholar"),
    Type.Literal("pubmed"),
    Type.Literal("none"),
  ])),
  providers: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
  credential_store: Type.Optional(Type.String()),
}, { additionalProperties: true });

export const HumanReviewConfigSchema = Type.Object({
  enabled: Type.Boolean(),
  gates: Type.Object({
    plan: Type.Boolean(),
    code: Type.Boolean(),
    validate: Type.Boolean(),
    interpret: Type.Boolean(),
    conclude: Type.Optional(Type.Boolean()),
  }, { additionalProperties: false }),
}, { additionalProperties: false });

export const ResearchPlanningStrategySchema = Type.Union([
  Type.Literal("standard"),
  Type.Literal("creative"),
]);

export const SeekBrainWorkflowConfigSchema = Type.Object({
  web_search: Type.Optional(Type.Boolean()),
  research_planning: Type.Boolean(),
  research_planning_strategy: ResearchPlanningStrategySchema,
  research_survey: Type.Boolean(),
  research_planning_peer_review: Type.Boolean(),
  research_execution: Type.Object({
    planning_concurrency: Type.Number({ minimum: 1, maximum: 16 }),
    execution_concurrency: Type.Number({ minimum: 1, maximum: 16 }),
  }, { additionalProperties: false }),
  report: Type.Object({
    pdf: Type.Object({
      enabled: Type.Boolean(),
      command: Type.String({ minLength: 1 }),
      timeout_seconds: Type.Number({ minimum: 1 }),
    }, { additionalProperties: false }),
  }, { additionalProperties: false }),
  deep_research: Type.Object({ max_rounds: Type.Integer({ minimum: 1 }) }, { additionalProperties: false }),
  targeted_skill_match: Type.Boolean(),
  targeted_skill_generate: Type.Boolean(),
  rag_recipe_crystallization: Type.Boolean(),
  image_refine: Type.Boolean(),
  save_skill: Type.Boolean(),
  transparency: Type.Boolean(),
  human_review: HumanReviewConfigSchema,
}, { additionalProperties: true });

export const TargetedSkillConfigSchema = Type.Object({
  resolution_mode: Type.Optional(Type.Union([
    Type.Literal("recipe_scout_v2"),
    Type.Literal("legacy_resolver"),
    Type.Literal("recipe_2_2"),
  ])),
  relevance_threshold: Type.Number({ minimum: 0, maximum: 1 }),
  top_k: Type.Integer({ minimum: 1, maximum: 3 }),
  compatibility: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
  revision: Type.Optional(Type.Object({
    enabled: Type.Boolean(),
    budget: Type.Integer({ minimum: 0, maximum: 1 }),
    generated_only: Type.Boolean(),
  }, { additionalProperties: false })),
  resource_filter: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
}, { additionalProperties: true });

export const SeekBrainConfigSchema = Type.Object({
  paths: Type.Record(Type.String(), Type.Unknown()),
  modules: Type.Object({
    targeted_skill: TargetedSkillConfigSchema,
  }, { additionalProperties: true }),
  literature: LiteratureConfigSchema,
  workflow: Type.Object({
    debug_disk_writes: Type.Boolean(),
    seekbrain: SeekBrainWorkflowConfigSchema,
  }, { additionalProperties: true }),
  agents: Type.Record(Type.String({ pattern: "^seekbrain(?:_|$)" }), AgentConfigSchema),
  models: Type.Array(Type.Record(Type.String(), Type.Unknown())),
}, { additionalProperties: true });

export type AgentConfig = Static<typeof AgentConfigSchema>;
export type ResearchPlanningStrategy = Static<typeof ResearchPlanningStrategySchema>;
export type SeekBrainConfig = Static<typeof SeekBrainConfigSchema>;
