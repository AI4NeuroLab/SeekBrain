import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { atomicWriteJson, FileRunRepository } from "../../src/core/index.ts";
import { CodeWorkflow, RunLifecycleWorkflow } from "../../src/workflows/index.ts";

async function fixture() {
  const cwd = await mkdtemp(join(tmpdir(), "seekbrain-code-stage-"));
  const lifecycle = new RunLifecycleWorkflow(new FileRunRepository());
  const run = await lifecycle.startRun(cwd, "run", undefined, "compare 120 neurons");
  return { cwd, lifecycle, run };
}

describe("code workflow", () => {
  it("blocks before invoking the coder when plan approval is required", async () => {
    const item = await fixture();
    try {
      let invoked = false;
      const workflow = new CodeWorkflow({
        lifecycle: item.lifecycle,
        retryPolicy: () => ({ allowed: true, reason: "initial_attempt", previousAttempt: 0, feedback: "" }),
        runAgent: async () => { invoked = true; return { ok: false }; },
        writeText: (path, value) => writeFile(path, value),
        writeJson: atomicWriteJson,
        snapshot: async () => undefined,
        appendEvent: async () => undefined,
      });
      const result = await workflow.execute({
        cwd: item.cwd,
        runId: item.run.runId,
        rolePrompt: "coder role",
        agentConfig: {},
        finalizeSchema: {},
        planReviewRequired: true,
        maxAttempts: 3,
      });
      expect(invoked).toBe(false);
      expect(result).toMatchObject({ ok: false, blocked_by_human_review: true, required_stage: "plan", status: "pending_review" });
    } finally {
      await rm(item.cwd, { recursive: true, force: true });
    }
  });

  it("persists coder artifacts and deterministic checks through injected ports", async () => {
    const item = await fixture();
    try {
      const events: any[] = [];
      const snapshots: string[] = [];
      let capturedPrompt = "";
      let capturedAfterToolCall: unknown;
      const afterToolCall = async () => undefined;
      await writeFile(join(item.run.runDir, "plan.md"), "# Goal\nCompare 120 neurons.\n\n## Inputs\n/data/neurons.npy");
      await writeFile(join(item.run.runDir, "analysis_cache.npz"), "reusable intermediate");
      await item.lifecycle.updateState(item.run, {
        plan: { path: join(item.run.runDir, "plan.md"), review_summary: "Compare neurons", warnings: [] },
        data_info: "THIS MUST NOT ENTER THE CODE PROMPT",
        targeted_skill: "THIS RECIPE MUST NOT ENTER THE CODE PROMPT",
      });
      const workflow = new CodeWorkflow({
        lifecycle: item.lifecycle,
        retryPolicy: () => ({ allowed: true, reason: "initial_attempt", previousAttempt: 0, feedback: "" }),
        runAgent: async ({ runDir, prompt, afterToolCall: handler }) => {
          capturedPrompt = prompt;
          capturedAfterToolCall = handler;
          await writeFile(join(runDir, "generated_code.py"), "print('real data')\n");
          await writeFile(join(runDir, "figure.png"), "png");
          await writeFile(join(runDir, "statistics.json"), JSON.stringify({ n_neurons: 120, detailed_metric: 3.5 }));
          await handler?.({ toolName: "bash", args: {}, content: [{ text: "analysis and verification passed" }], isError: false });
          return {
            ok: true,
            result: {
              code_files: [{ path: "generated_code.py" }],
              summary: "generated",
              warnings: [],
            },
            output_path: "output.json",
          };
        },
        writeText: (path, value) => writeFile(path, value),
        writeJson: atomicWriteJson,
        snapshot: async (_run, label) => { snapshots.push(label); },
        appendEvent: async (event) => { events.push(event); },
      });
      const result = await workflow.execute({
        cwd: item.cwd,
        runId: item.run.runId,
        rolePrompt: "coder role",
        agentConfig: {},
        finalizeSchema: {},
        planReviewRequired: false,
        maxAttempts: 3,
        afterToolCall,
      });

      expect(capturedPrompt).toContain("Detailed methodological plan:\n# Goal\nCompare 120 neurons.");
      expect(capturedPrompt).not.toContain("THIS MUST NOT ENTER THE CODE PROMPT");
      expect(capturedPrompt).not.toContain("THIS RECIPE MUST NOT ENTER THE CODE PROMPT");
      expect(capturedPrompt).not.toContain("Data info:");
      expect(capturedPrompt).not.toContain("Analysis recipe:");
      expect(capturedPrompt).toContain("Required final tool: finalize_code_result");
      expect(capturedPrompt).toContain("Recovery context:");
      expect(capturedPrompt).toContain('"path": "analysis_cache.npz"');
      expect(typeof capturedAfterToolCall).toBe("function");
      expect(await readFile(join(item.run.runDir, "exec.log"), "utf8")).toBe("analysis and verification passed");
      const statistics = JSON.parse(await readFile(join(item.run.runDir, "statistics.json"), "utf8"));
      expect(statistics.n_neurons).toBe(120);
      expect(statistics.detailed_metric).toBe(3.5);
      const state = JSON.parse(await readFile(join(item.run.runDir, "state.json"), "utf8"));
      expect(state.code_attempt).toBe(1);
      expect(state.code.code_files).toEqual([{ path: "generated_code.py" }]);
      expect(state.code.statistics).toBeUndefined();
      expect(state.code.statistics_path).toBe(join(item.run.runDir, "statistics.json"));
      expect(state.artifacts.some((artifact: any) => artifact.kind === "code")).toBe(true);
      expect(result).toMatchObject({ ok: true, code_attempt: 1, blocked_by_dummy_data: false, next_step: { tool: "seekbrain_validation_run" } });
      expect(events[0]).toMatchObject({ event: "seekbrain_code_execute", code_attempt: 1 });
      expect(snapshots).toEqual(["after_code_attempt_1"]);
    } finally {
      await rm(item.cwd, { recursive: true, force: true });
    }
  });

  it("keeps declared artifact kinds authoritative when the agent mislabels every output as code", async () => {
    const item = await fixture();
    try {
      await writeFile(join(item.run.runDir, "plan.md"), "# Inputs\n/data/observations.npy\n\n# Method\nAnalyze the observed data.");
      await item.lifecycle.updateState(item.run, {
        plan: { path: join(item.run.runDir, "plan.md") },
        deliverables: [
          { path: "generated_code.py", kind: "code", role: "analysis_script" },
          { path: "result.npy", kind: "data" },
          { path: "figure.png", kind: "figure", role: "main" },
          { path: "figure.pdf", kind: "figure" },
          { path: "statistics.json", kind: "statistics" },
        ],
      });
      const workflow = new CodeWorkflow({
        lifecycle: item.lifecycle,
        retryPolicy: () => ({ allowed: true, reason: "initial_attempt", previousAttempt: 0, feedback: "" }),
        runAgent: async ({ runDir }) => {
          await writeFile(join(runDir, "generated_code.py"), "import numpy as np\ndata = np.load('/data/observations.npy')\n");
          await writeFile(join(runDir, "result.npy"), "data");
          await writeFile(join(runDir, "figure.png"), "png");
          await writeFile(join(runDir, "figure.pdf"), "pdf");
          await writeFile(join(runDir, "statistics.json"), JSON.stringify({ n: 20 }));
          return {
            ok: true,
            result: {
              code_files: ["generated_code.py", "result.npy", "figure.png", "figure.pdf", "statistics.json"].map((path) => ({ path })),
              summary: "done",
              warnings: [],
            },
          };
        },
        writeText: (path, value) => writeFile(path, value),
        writeJson: atomicWriteJson,
        snapshot: async () => undefined,
        appendEvent: async () => undefined,
      });
      const result = await workflow.execute({
        cwd: item.cwd,
        runId: item.run.runId,
        rolePrompt: "coder role",
        agentConfig: {},
        finalizeSchema: {},
        planReviewRequired: false,
        maxAttempts: 3,
      });
      const state = JSON.parse(await readFile(join(item.run.runDir, "state.json"), "utf8"));
      expect(result.ok).toBe(true);
      expect(state.code.code_files).toEqual([{ path: "generated_code.py" }]);
      expect(Object.fromEntries(state.artifacts.map((artifact: any) => [artifact.path, artifact.kind]))).toMatchObject({
        [join(item.run.runDir, "generated_code.py")]: "code",
        [join(item.run.runDir, "result.npy")]: "data",
        [join(item.run.runDir, "figure.png")]: "figure",
        [join(item.run.runDir, "figure.pdf")]: "figure",
        [join(item.run.runDir, "statistics.json")]: "statistics",
      });
    } finally {
      await rm(item.cwd, { recursive: true, force: true });
    }
  });

  it("allows inferential randomization after reading real input", async () => {
    const item = await fixture();
    try {
      await writeFile(join(item.run.runDir, "plan.md"), "# Inputs\n/data/observations.npy\n\n# Method\nRun a permutation test.");
      const workflow = new CodeWorkflow({
        lifecycle: item.lifecycle,
        retryPolicy: () => ({ allowed: true, reason: "initial_attempt", previousAttempt: 0, feedback: "" }),
        runAgent: async ({ runDir }) => {
          await writeFile(join(runDir, "generated_code.py"), [
            "import numpy as np",
            "observed = np.load('/data/observations.npy')",
            "permuted = np.random.choice(observed, size=observed.shape, replace=False)",
          ].join("\n"));
          await writeFile(join(runDir, "figure.png"), "png");
          await writeFile(join(runDir, "statistics.json"), JSON.stringify({ permutation_count: 1000 }));
          return { ok: true, result: { code_files: [{ path: "generated_code.py" }], summary: "done", warnings: [] } };
        },
        writeText: (path, value) => writeFile(path, value),
        writeJson: atomicWriteJson,
        snapshot: async () => undefined,
        appendEvent: async () => undefined,
      });
      const result = await workflow.execute({
        cwd: item.cwd,
        runId: item.run.runId,
        rolePrompt: "coder role",
        agentConfig: {},
        finalizeSchema: {},
        planReviewRequired: false,
        maxAttempts: 3,
      });
      expect(result.ok).toBe(true);
      expect(result.blocked_by_dummy_data).toBe(false);
      expect(result.checks.dummy_data_signals).toEqual([]);
    } finally {
      await rm(item.cwd, { recursive: true, force: true });
    }
  });

  it("blocks random replacement when a real input is required but never read", async () => {
    const item = await fixture();
    try {
      await writeFile(join(item.run.runDir, "plan.md"), "# Inputs\n/data/observations.npy\n\n# Method\nAnalyze the observed data.");
      const workflow = new CodeWorkflow({
        lifecycle: item.lifecycle,
        retryPolicy: () => ({ allowed: true, reason: "initial_attempt", previousAttempt: 0, feedback: "" }),
        runAgent: async ({ runDir }) => {
          await writeFile(join(runDir, "generated_code.py"), "import numpy as np\nobserved = np.random.normal(size=(20, 5))\n");
          await writeFile(join(runDir, "figure.png"), "png");
          await writeFile(join(runDir, "statistics.json"), JSON.stringify({ n: 20 }));
          return { ok: true, result: { code_files: [{ path: "generated_code.py" }], summary: "done", warnings: [] } };
        },
        writeText: (path, value) => writeFile(path, value),
        writeJson: atomicWriteJson,
        snapshot: async () => undefined,
        appendEvent: async () => undefined,
      });
      const result = await workflow.execute({
        cwd: item.cwd,
        runId: item.run.runId,
        rolePrompt: "coder role",
        agentConfig: {},
        finalizeSchema: {},
        planReviewRequired: false,
        maxAttempts: 3,
      });
      expect(result.ok).toBe(false);
      expect(result.blocked_by_dummy_data).toBe(true);
      expect(result.checks.dummy_data_signals).toContain("random data generation without any recorded real-input read");
    } finally {
      await rm(item.cwd, { recursive: true, force: true });
    }
  });
});
