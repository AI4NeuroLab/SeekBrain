import { externalLiteratureQueries } from "../query-planner.ts";

export function planSemanticScholarQueries(question: string, maximum = 3, plannedQueries?: unknown): string[] {
  return externalLiteratureQueries(question, plannedQueries, maximum);
}
