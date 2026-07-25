import { describe, expect, it } from "vitest";
import {
  createDependencyInstallToolResultHandler,
  DependencyInstallApprovalQueue,
  detectMissingPythonDependencies,
  installPythonDependency,
  resolvePythonInstallEnvironment,
  SerializedReviewGate,
  type PythonInstallEnvironment,
} from "../../src/extension/dependency-install.ts";

const environment: PythonInstallEnvironment = {
  kind: "conda",
  name: "InternAgent",
  python: "/opt/conda/envs/InternAgent/bin/python",
  installArgs: ["-m", "pip", "install", "--no-input"],
  description: "conda environment InternAgent (/opt/conda/envs/InternAgent)",
};

describe("missing dependency installation", () => {
  it("detects Python missing-module errors and maps common import names to distributions", () => {
    expect(detectMissingPythonDependencies([
      "Traceback (most recent call last):",
      "ModuleNotFoundError: No module named 'sklearn.metrics'",
      "ImportError: Missing optional dependency 'openpyxl'. Use pip or conda to install openpyxl.",
    ].join("\n"))).toEqual([
      expect.objectContaining({ moduleName: "sklearn.metrics", packageName: "scikit-learn" }),
      expect.objectContaining({ moduleName: "openpyxl", packageName: "openpyxl" }),
    ]);
    expect(detectMissingPythonDependencies("ImportError: pyarrow is required for parquet support")).toEqual([
      expect.objectContaining({ moduleName: "pyarrow", packageName: "pyarrow" }),
    ]);
    expect(detectMissingPythonDependencies("ImportError: Missing optional dependency 'scikit-learn'.")).toEqual([
      expect.objectContaining({ moduleName: "sklearn", packageName: "scikit-learn" }),
    ]);
  });

  it("targets the conda environment that launched SeekBrain and otherwise uses a local user install", () => {
    expect(resolvePythonInstallEnvironment({
      CONDA_PREFIX: "/opt/conda/envs/InternAgent",
      CONDA_DEFAULT_ENV: "InternAgent",
      PATH: process.env.PATH,
    })).toMatchObject({
      kind: "conda",
      name: "InternAgent",
      python: "/opt/conda/envs/InternAgent/bin/python",
    });
    expect(resolvePythonInstallEnvironment({ PATH: process.env.PATH })).toMatchObject({ kind: "local_user" });
    expect(resolvePythonInstallEnvironment({ PATH: process.env.PATH }).installArgs).toContain("--user");
  });

  it("runs pip and verifies the import with the same environment interpreter", async () => {
    const calls: Array<{ command: string; args: string[] }> = [];
    const result = await installPythonDependency(
      { moduleName: "sklearn.metrics", packageName: "scikit-learn", evidence: "missing" },
      environment,
      {
        runner: async (command, args) => {
          calls.push({ command, args });
          return { ok: true, exitCode: 0, stdout: "ok", stderr: "" };
        },
      },
    );
    expect(result.status).toBe("installed");
    expect(calls).toHaveLength(2);
    expect(calls[0]).toEqual({
      command: environment.python,
      args: [...environment.installArgs, "scikit-learn"],
    });
    expect(calls[1].command).toBe(environment.python);
    expect(calls[1].args.at(-1)).toBe("sklearn");
  });

  it("serializes concurrent task requests and applies allow-all to queued installs", async () => {
    let active = 0;
    let maximumActive = 0;
    let approveAllPersisted = 0;
    const reviews: string[] = [];
    const installs: string[] = [];
    const queue = new DependencyInstallApprovalQueue({
      environment,
      review: async (request) => {
        active += 1;
        maximumActive = Math.max(maximumActive, active);
        reviews.push(request.packageName);
        await new Promise((resolve) => setTimeout(resolve, 5));
        active -= 1;
        return "yes_to_all";
      },
      onApproveAll: async () => { approveAllPersisted += 1; },
      install: async (request) => {
        active += 1;
        maximumActive = Math.max(maximumActive, active);
        installs.push(request.packageName);
        await new Promise((resolve) => setTimeout(resolve, 5));
        active -= 1;
        return { status: "installed" };
      },
    });

    const [first, second] = await Promise.all([
      queue.request({ moduleName: "scipy", packageName: "scipy", evidence: "missing", taskId: "T1" }),
      queue.request({ moduleName: "pandas", packageName: "pandas", evidence: "missing", taskId: "T2" }),
    ]);

    expect(maximumActive).toBe(1);
    expect(approveAllPersisted).toBe(1);
    expect(reviews).toEqual(["scipy"]);
    expect(installs).toEqual(["scipy", "pandas"]);
    expect(first).toMatchObject({ decision: "yes_to_all", status: "installed", approveAllActive: true });
    expect(second).toMatchObject({ decision: "yes_to_all", status: "installed", approveAllActive: true });
  });

  it("restores allow-all approval without reopening review after a Research Planning resume", async () => {
    let reviews = 0;
    let persistenceCalls = 0;
    const queue = new DependencyInstallApprovalQueue({
      environment,
      initialApproveAll: true,
      review: async () => { reviews += 1; return "no"; },
      onApproveAll: async () => { persistenceCalls += 1; },
      install: async () => ({ status: "installed" }),
    });

    const outcome = await queue.request({
      moduleName: "scipy",
      packageName: "scipy",
      evidence: "ModuleNotFoundError: No module named 'scipy'",
      parentRunId: "planning-run",
      taskId: "SQ2-T1",
    });

    expect(reviews).toBe(0);
    expect(persistenceCalls).toBe(0);
    expect(outcome).toMatchObject({ decision: "yes_to_all", status: "installed", approveAllActive: true });
  });

  it("falls back to installed packages only after an explicit No", async () => {
    const queue = new DependencyInstallApprovalQueue({
      environment,
      review: async () => "no",
      install: async () => { throw new Error("install must not run"); },
    });
    const handler = createDependencyInstallToolResultHandler(queue, { runId: "run-1" });
    const result = await handler({
      toolName: "bash",
      args: { command: "python generated_code.py" },
      content: [{ type: "text", text: "ModuleNotFoundError: No module named 'cv2'" }],
      isError: true,
    });
    const text = (result?.content || []).map((item: any) => item.text || "").join("\n");
    expect(text).toContain("User selected No");
    expect(text).toContain("Only now may you retry with packages already available");
    expect(result?.details).toMatchObject({
      seekbrain_dependency_installs: [expect.objectContaining({ package_name: "opencv-python", status: "declined" })],
    });
  });

  it("keeps package reviews and plan reviews behind the same interaction gate", async () => {
    const gate = new SerializedReviewGate();
    const order: string[] = [];
    await Promise.all([
      gate.run(async () => { order.push("plan:start"); await new Promise((resolve) => setTimeout(resolve, 5)); order.push("plan:end"); }),
      gate.run(async () => { order.push("pip:start"); order.push("pip:end"); }),
    ]);
    expect(order).toEqual(["plan:start", "plan:end", "pip:start", "pip:end"]);
  });
});
