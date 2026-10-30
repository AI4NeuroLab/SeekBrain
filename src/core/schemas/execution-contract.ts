import { Type, type Static } from "typebox";

export const ExecutionContractSchema = Type.Object({
  requirements: Type.Array(Type.String({ minLength: 1 }), { minItems: 1, maxItems: 24 }),
  validation_checks: Type.Array(Type.String({ minLength: 1 }), { minItems: 1, maxItems: 24 }),
}, { additionalProperties: false });

export const PlanFinalizeSchema = Type.Object({
  plan_markdown: Type.String({ minLength: 1 }),
  execution_contract: ExecutionContractSchema,
  review_summary: Type.String(),
  warnings: Type.Array(Type.String()),
}, { additionalProperties: false });

export type ExecutionContract = Static<typeof ExecutionContractSchema>;
