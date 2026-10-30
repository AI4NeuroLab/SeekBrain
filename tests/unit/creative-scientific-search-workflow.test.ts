import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { FileRunRepository } from "../../src/core/index.ts";
import { CreativeScientificSearchWorkflow, RunLifecycleWorkflow } from "../../src/workflows/index.ts";

describe("creative scientific search workflow", () => {
  it("appends interpreted methods with stable IDs without changing Idea Cards", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "seekbrain-creative-search-"));
    try {
      const lifecycle = new RunLifecycleWorkflow(new FileRunRepository());
      const run = await lifecycle.startRun(cwd, "run", undefined, "Find a useful mechanism for a temporal population change.");
      const creativeDir = join(run.runDir, "creative_research");
      const poolPath = join(creativeDir, "creative_search_pool.json");
      const sessionPath = join(creativeDir, "creative_session.json");
      await mkdir(creativeDir, { recursive: true });
      await writeFile(sessionPath, JSON.stringify({ status: "awaiting_selection", ideas: [{ idea_id: "H1" }] }));

      let call = 0;
      const workflow = new CreativeScientificSearchWorkflow({
        lifecycle,
        createSearchTool: () => ({ name: "search_scientific_inspiration" }),
        runAgent: async ({ customTools }) => {
          expect(customTools?.map((tool) => tool.name)).toEqual(["search_scientific_inspiration"]);
          call += 1;
          let pool: any = {};
          try { pool = JSON.parse(await readFile(poolPath, "utf8")); } catch {}
          const evidenceId = `E${call}`;
          await mkdir(dirname(poolPath), { recursive: true });
          await writeFile(poolPath, JSON.stringify({
            version: 1,
            created_at: pool.created_at || "2026-01-01T00:00:00.000Z",
            updated_at: "2026-01-01T00:00:00.000Z",
            max_distinct_queries: 9,
            provider_calls: call,
            entries: [...(pool.entries || []), {
              evidence_id: evidenceId,
              intent: "remote_analogy",
              query: `query ${call}`,
              source_ids: [`S${call}`],
              ok: true,
            }],
            sources: [...(pool.sources || []), { source_id: `S${call}`, title: `Paper ${call}` }],
            search_requests: pool.search_requests || [],
            methods: pool.methods || [],
          }));
          return {
            ok: true,
            result: {
              request_summary: `Search ${call}`,
              status: "sufficient",
              unresolved_gap: "",
              attempt_assessments: [{ evidence_id: evidenceId, assessment: "Useful", next_gap: "" }],
              methods: [{
                component_type: "analysis",
                label: "Coupled transition model",
                reusable_component: "Fit a coupled transition model.",
                application_to_current_problem: "Test whether changes are coordinated rather than independent.",
                limitation: "Requires repeated observations.",
                evidence_ids: [evidenceId],
              }],
            },
          };
        },
        writeJson: async (path, value) => {
          await mkdir(dirname(path), { recursive: true });
          await writeFile(path, JSON.stringify(value, null, 2));
        },
        appendEvent: async () => {},
      });

      const first = await workflow.search({
        cwd, runId: run.runId, instruction: "Find a transferable mechanism", trigger: "initial",
        rolePrompt: "search role", agentConfig: {}, finalizeSchema: {},
      });
      expect(first).toMatchObject({ request_id: "SR1", method_count: 1, method_briefs: [{ method_id: "M1" }] });

      const second = await workflow.search({
        cwd, runId: run.runId, instruction: "Search again for a stronger test", trigger: "user",
        rolePrompt: "search role", agentConfig: {}, finalizeSchema: {},
      });
      expect(second).toMatchObject({ request_id: "SR2", method_count: 1, method_briefs: [{ method_id: "M1" }] });
      const pool = JSON.parse(await readFile(poolPath, "utf8"));
      expect(pool.search_requests.map((request: any) => request.request_id)).toEqual(["SR1", "SR2"]);
      expect(pool.methods.map((method: any) => method.method_id)).toEqual(["M1"]);
      expect(JSON.parse(await readFile(sessionPath, "utf8"))).toEqual({ status: "awaiting_selection", ideas: [{ idea_id: "H1" }] });
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});
