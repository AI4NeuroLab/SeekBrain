import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  codeArtifactsFromRun,
  loadVisionImages,
  normalizeArtifact,
  resolveEditableCodePath,
} from "../../src/extension/runtime/shared/artifact-service.ts";
import { createConfigService } from "../../src/extension/runtime/shared/config-service.ts";
import { createObservabilityService } from "../../src/extension/runtime/shared/observability-service.ts";
import { createRunAccess } from "../../src/extension/runtime/shared/run-access.ts";
import { createSubagentRunner } from "../../src/extension/runtime/shared/subagent-runner.ts";
import { createCodeEditService } from "../../src/extension/runtime/shared/code-edit-service.ts";
import { createRuntimeSession } from "../../src/extension/runtime/create-runtime-session.ts";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

describe("artifact service", () => {
  it("normalizes artifacts, resolves editable code, and loads supported images", async () => {
    const root = await mkdtemp(join(tmpdir(), "seekbrain-artifact-service-"));
    roots.push(root);
    const codePath = join(root, "generated_code.py");
    const imagePath = join(root, "figure.png");
    await writeFile(codePath, "print('ok')\n");
    await writeFile(imagePath, Buffer.from([0x89, 0x50, 0x4e, 0x47]));
    const run = {
      runDir: root,
      state: { artifacts: [{ path: "generated_code.py", kind: "code" }] },
    } as any;

    expect(normalizeArtifact({ path: "generated_code.py", kind: "code" }, root)?.path).toBe(codePath);
    expect(codeArtifactsFromRun(run)).toHaveLength(1);
    expect(resolveEditableCodePath(run)).toBe(codePath);
    expect(await loadVisionImages([imagePath, join(root, "missing.jpg")])).toMatchObject({
      loaded_paths: [imagePath],
      warnings: [expect.stringContaining("failed to load image")],
    });
  });
});

describe("code edit service", () => {
  it("creates stable edit ids and rejects non-Python automatic reruns before loading env", async () => {
    const loadEnv = vi.fn(async () => ({}));
    const service = createCodeEditService({ projectRoot: "/project", loadEnv });

    expect(service.createEditId()).toMatch(/^edit_\d{8}-\d{6}_[0-9a-f]{8}$/);
    await expect(service.rerunApprovedPythonCode("/run/generated_code.R", "/run")).resolves.toMatchObject({
      ok: false,
      exit_code: null,
      error: expect.stringContaining("only supports Python"),
    });
    expect(loadEnv).not.toHaveBeenCalled();
  });
});

describe("runtime session", () => {
  it("owns active-run state and keeps a missing config watcher inert", () => {
    const invalidateConfig = vi.fn();
    const loadConfig = vi.fn(async () => ({}));
    const session = createRuntimeSession({
      projectRoot: "/missing-project",
      configFile: "seekbrain.config.yaml",
      invalidateConfig,
      loadConfig,
    });

    expect(session.getActiveRunDir()).toBeUndefined();
    session.setActiveRunDir("/run/round1");
    expect(session.getActiveRunDir()).toBe("/run/round1");
    expect(() => session.startConfigWatcher("/cwd")).not.toThrow();
    session.stopConfigWatcher();
    expect(invalidateConfig).not.toHaveBeenCalled();
    expect(loadConfig).not.toHaveBeenCalled();
  });
});

describe("run access", () => {
  it("preserves locked metadata and delegates lifecycle operations", async () => {
    const lifecycle = {
      startRun: vi.fn(async () => ({ started: true })),
      resolveRun: vi.fn(async () => ({ resolved: true })),
      resumeRun: vi.fn(async () => ({ resumed: true })),
      loadRunState: vi.fn(async () => ({ loaded: true })),
      updateState: vi.fn(async (run, patch) => Object.assign(run.state, patch)),
    };
    const access = createRunAccess({ lifecycle: lifecycle as any, debugDiskWritesEnabled: () => false });
    const run = { runDir: "/run", state: { metadata_locked: true, data_info: "locked", extra_path_info: "paths", question: "stored" } } as any;

    expect(access.effectiveMetadata(run, "new", "new paths")).toEqual({ data_info: "locked", extra_path_info: "paths" });
    expect(access.resolveQuestion(run)).toBe("stored");
    expect(() => access.resolveQuestion({ runDir: "/run", state: {} } as any)).toThrow(/question is required/);
    expect(await access.startRun("/cwd", "run")).toEqual({ started: true });
    expect(await access.snapshotRunArtifacts(run, "test")).toBeUndefined();
  });
});

describe("config and observability services", () => {
  it("shares one cached config and exposes pure event/usage adapters", async () => {
    const root = await mkdtemp(join(tmpdir(), "seekbrain-config-service-"));
    roots.push(root);
    const defaultConfigPath = join(root, "default.yaml");
    await writeFile(defaultConfigPath, `
workflow:
  debug_disk_writes: true
  seekbrain:
    research_planning: false
    transparency: true
agents: {}
paths: {}
literature:
  paper_source: none
`);
    const config = createConfigService({ projectRoot: root, defaultConfigPath, configFile: "missing.yaml" });
    const first = await config.loadConfigCached(root);
    expect(await config.loadConfigCached(root)).toBe(first);
    expect(config.debugDiskWritesEnabled()).toBe(true);
    expect(config.seekbrainWorkflowConfig(first).transparency).toBe(true);

    const observability = createObservabilityService({ debugDiskWritesEnabled: () => false });
    expect(observability.readableLogEntriesFromEvent({ type: "agent_start", timestamp: 0 }, "subagent", "test")).toMatchObject([
      { scope: "subagent", agent: "test", event: "system", text: "agent_start" },
    ]);
    expect(observability.usageEntry("test", { tokens: { input: 2, output: 3, total: 5 }, cost: 1 })).toMatchObject({
      component: "test",
      tokens: { input: 2, output: 3, total: 5 },
      cost: 1,
    });
  });
});

describe("subagent runner", () => {
  it("maps a successful adapter result without diagnostic disk writes", async () => {
    const tryAppendUsageEntry = vi.fn(async () => {});
    const runner = createSubagentRunner({
      adapter: { run: vi.fn(async () => ({ ok: true, result: { answer: 42 }, stats: { tokens: { total: 1 } } })) } as any,
      debugDiskWritesEnabled: () => false,
      pushReadableLog: vi.fn(),
      usageEntry: (_component, stats) => stats,
      tryAppendUsageEntry,
      writeDiagnosticJson: vi.fn(),
      writeDiagnosticText: vi.fn(),
      writeDiagnosticJsonl: vi.fn(),
      snapshotSubagentFiles: vi.fn(),
    });

    await expect(runner({
      runDir: "/run",
      agentName: "agent",
      finalizeTool: "finalize",
      finalizeSchema: {},
      prompt: "prompt",
    })).resolves.toMatchObject({ ok: true, result: { answer: 42 } });
    expect(tryAppendUsageEntry).toHaveBeenCalledOnce();
  });
});
