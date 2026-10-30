import { Type, type Static } from "typebox";

export const PlanResultSchema = Type.Object({ plan_path: Type.Optional(Type.String()), plan_paths: Type.Optional(Type.Array(Type.String(), { minItems: 1 })) }, { additionalProperties: false });
const OutputSchema = Type.Object({ path: Type.String(), role: Type.Optional(Type.String()) }, { additionalProperties: false });
export const TaskSchema = Type.Object({
  id: Type.String({ pattern: "^[a-zA-Z][a-zA-Z0-9_-]{0,63}$" }), instruction: Type.String({ minLength: 1 }),
  depends_on: Type.Optional(Type.Array(Type.String())), priority: Type.Optional(Type.Integer()),
  checks: Type.Optional(Type.Array(Type.String())),
  inputs: Type.Optional(Type.Array(Type.Object({ task_id: Type.String(), role: Type.Optional(Type.String()), path: Type.Optional(Type.String()), required: Type.Optional(Type.Boolean()) }, { additionalProperties: false }))),
  expected_results: Type.Optional(Type.Array(Type.String())),
  condition: Type.Optional(Type.Object({ task_id: Type.String(), key: Type.String(), equals: Type.Union([Type.Boolean(), Type.Number(), Type.String(), Type.Null()]) }, { additionalProperties: false })),
}, { additionalProperties: false });
export const FormulationResultSchema = Type.Object({ tasks: Type.Optional(Type.Array(TaskSchema, { minItems: 1 })), formulation_path: Type.Optional(Type.String()) }, { additionalProperties: false });
export const CodeResultSchema = Type.Object({ outputs: Type.Optional(Type.Array(OutputSchema)), summary: Type.Optional(Type.String()), warnings: Type.Optional(Type.Array(Type.String())), decisions: Type.Optional(Type.Record(Type.String(), Type.Union([Type.Boolean(), Type.String(), Type.Number(), Type.Null()]))) }, { additionalProperties: false });
export const ValidationResultSchema = Type.Object({
  decision: Type.Union([Type.Literal("accepted"), Type.Literal("partial"), Type.Literal("retry"), Type.Literal("unusable")]),
  usable_paths: Type.Optional(Type.Array(Type.String())), issues: Type.Optional(Type.Array(Type.String())), limits: Type.Optional(Type.Array(Type.String())), repair: Type.Optional(Type.String()),
}, { additionalProperties: false });
export const ReportResultSchema = Type.Object({ report_path: Type.Optional(Type.String()), supplementary_path: Type.Optional(Type.String()), mode: Type.Optional(Type.Union([Type.Literal("scientific_report"), Type.Literal("progress_report")])) }, { additionalProperties: false });
export type Task = Static<typeof TaskSchema> & { status: "pending" | "running" | "complete" | "partial" | "failed" | "skipped"; attempts?: number; reason?: string; run_id?: string; run_dir?: string; output_dir?: string };
export interface TaskGraph { deep_round?: number; current_task_ids?: string[]; schema_version: 1; plan_sha256: string; status: "pending" | "running" | "complete" | "complete_with_failures"; tasks: Task[] }

export function checkTasks(tasks: Task[]): void {
  const map = new Map(tasks.map(task => [task.id, task]));
  if (map.size !== tasks.length) throw new Error("Duplicate task IDs");
  for (const task of tasks) {
    task.depends_on ||= [];
    if (new Set(task.depends_on).size !== task.depends_on.length) throw new Error(`Repeated dependencies: ${task.id}`);
    for (const id of task.depends_on) if (!map.has(id)) throw new Error(`Unknown dependency: ${id}`);
    for (const input of task.inputs || []) if (!task.depends_on.includes(input.task_id)) throw new Error(`Input producer must be a dependency: ${input.task_id}`);
    if (task.condition && !task.depends_on.includes(task.condition.task_id)) throw new Error("Condition producer must be a dependency");
  }
  const seen = new Set<string>(), active = new Set<string>();
  const visit = (id: string) => { if (active.has(id)) throw new Error("Dependency cycle"); if (seen.has(id)) return; active.add(id); for (const dep of map.get(id)!.depends_on!) visit(dep); active.delete(id); seen.add(id); };
  tasks.forEach(task => visit(task.id));
}
