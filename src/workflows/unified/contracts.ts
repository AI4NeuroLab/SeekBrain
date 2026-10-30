import { Type, type Static } from "typebox";
import { ExecutionContractSchema } from "../../core/index.ts";

export const ScientificPlanSchema = Type.Object({ plan_markdown: Type.String({ minLength: 1 }) }, { additionalProperties: false });
export const FormulationSchema = Type.Object({
  tasks: Type.Array(Type.Object({
    id: Type.String({ pattern: "^[a-zA-Z][a-zA-Z0-9_-]{0,63}$" }),
    instruction: Type.String({ minLength: 1 }),
    depends_on: Type.Array(Type.String()),
    execution_contract: ExecutionContractSchema,
    priority: Type.Optional(Type.Integer()),
    condition: Type.Optional(Type.Object({
      task_id: Type.String(),
      statistics_key: Type.String({ minLength: 1 }),
      equals: Type.Union([Type.Boolean(), Type.String(), Type.Number(), Type.Null()]),
    }, { additionalProperties: false })),
    deliverables: Type.Optional(Type.Array(Type.Object({
      path: Type.String({ minLength: 1 }),
      kind: Type.Union([Type.Literal("figure"), Type.Literal("table"), Type.Literal("statistics"), Type.Literal("data"), Type.Literal("code"), Type.Literal("other")]),
      optional: Type.Optional(Type.Boolean()),
    }, { additionalProperties: false }))),
  }, { additionalProperties: false }), { minItems: 1 }),
}, { additionalProperties: false });
export const StudyReportSchema = Type.Object({
  mode: Type.Union([Type.Literal("scientific_report"), Type.Literal("progress_report")]),
  title: Type.String({ minLength: 1 }),
  abstract: Type.String(),
  main_text: Type.String({ minLength: 1 }),
  display_items: Type.Array(Type.Object({
    kind: Type.Union([Type.Literal("figure"), Type.Literal("table")]),
    artifact_paths: Type.Array(Type.String(), { minItems: 1 }),
    evidence_ids: Type.Array(Type.String(), { minItems: 1 }),
    caption: Type.String({ minLength: 1 }),
    table_markdown: Type.Optional(Type.String()),
  }, { additionalProperties: false })),
  references: Type.Array(Type.Object({ citation: Type.String({ minLength: 1 }), source: Type.String({ minLength: 1 }),
    read_scope: Type.Optional(Type.Union([Type.Literal("full_text"), Type.Literal("chapter"), Type.Literal("abstract"), Type.Literal("metadata")])) }, { additionalProperties: false })),
  used_evidence_ids: Type.Array(Type.String()),
  supplementary_text: Type.Optional(Type.String()),
}, { additionalProperties: false });
export type StudyReport = Static<typeof StudyReportSchema>;
export const ReportFormatOverrideSchema = Type.Object({
  abstract_sentences: Type.Optional(Type.Integer({ minimum: 1 })),
  abstract_max_words: Type.Optional(Type.Integer({ minimum: 1 })),
  main_min_words: Type.Optional(Type.Integer({ minimum: 0 })),
  main_max_words: Type.Optional(Type.Integer({ minimum: 1 })),
  no_main_headings: Type.Optional(Type.Boolean()),
  max_display_items: Type.Optional(Type.Integer({ minimum: 0 })),
  max_references: Type.Optional(Type.Integer({ minimum: 0 })),
}, { additionalProperties: false });
export type FormulatedTask = Static<typeof FormulationSchema>["tasks"][number];
export type TaskStatus = "pending" | "running" | "complete" | "failed" | "skipped";
export type GraphTask = FormulatedTask & { status: TaskStatus; run_id?: string; run_dir?: string; reason?: string; attempts?: number };
export interface ExecutionGraph {
  schema_version: 1;
  plan_sha256: string;
  status: "pending" | "running" | "complete" | "complete_with_failures";
  tasks: GraphTask[];
  updated_at?: string;
}

/** Only executable invariants, no plan headings or scientific style checks. */
export function validateGraph(tasks: FormulatedTask[]): void {
  const byId = new Map(tasks.map(task => [task.id, task]));
  if (byId.size !== tasks.length) throw new Error("Duplicate task IDs");
  for (const task of tasks) {
    if (new Set(task.depends_on).size !== task.depends_on.length) throw new Error(`Repeated dependency for ${task.id}`);
    for (const dep of task.depends_on) if (!byId.has(dep)) throw new Error(`Unknown dependency ${dep} for ${task.id}`);
    if (task.condition && !task.depends_on.includes(task.condition.task_id)) throw new Error(`Condition producer must be a direct dependency of ${task.id}`);
    for (const item of task.deliverables || []) {
      if (item.path.startsWith("/") || item.path.split(/[\\/]/).includes("..")) throw new Error(`Deliverable must stay inside task directory: ${item.path}`);
    }
  }
  const seen = new Set<string>(), active = new Set<string>();
  const visit = (id: string) => {
    if (active.has(id)) throw new Error(`Dependency cycle at ${id}`);
    if (seen.has(id)) return;
    active.add(id);
    byId.get(id)!.depends_on.forEach(visit);
    active.delete(id); seen.add(id);
  };
  tasks.forEach(task => visit(task.id));
}
