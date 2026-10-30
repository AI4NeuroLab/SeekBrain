import { spawn } from "node:child_process";
import { activePythonEnvironment, pythonProcessEnvironment, resolvePythonCommand } from "../platform/python.mjs";
import { stopProcessTree } from "../platform/process-tree.mjs";
import type {
  CodeAgentToolResultEvent,
  CodeAgentToolResultHandler,
  CodeAgentToolResultOverride,
} from "../workflows/seekbrain/code-workflow.ts";

type Json = Record<string, any>;

const PACKAGE_ALIASES: Record<string, string> = {
  bio: "biopython",
  bs4: "beautifulsoup4",
  community: "python-louvain",
  crypto: "pycryptodome",
  cv2: "opencv-python",
  dateutil: "python-dateutil",
  dotenv: "python-dotenv",
  fitz: "PyMuPDF",
  googleapiclient: "google-api-python-client",
  jwt: "PyJWT",
  mpl_toolkits: "matplotlib",
  openpyxl: "openpyxl",
  pil: "Pillow",
  ruamel: "ruamel.yaml",
  serial: "pyserial",
  skimage: "scikit-image",
  sklearn: "scikit-learn",
  socks: "PySocks",
  umap: "umap-learn",
  yaml: "PyYAML",
};

const PACKAGE_IMPORT_ALIASES: Record<string, string> = {
  beautifulsoup4: "bs4",
  biopython: "Bio",
  "google-api-python-client": "googleapiclient",
  "opencv-python": "cv2",
  pillow: "PIL",
  pycryptodome: "Crypto",
  pyjwt: "jwt",
  pymupdf: "fitz",
  pyserial: "serial",
  pysocks: "socks",
  pyyaml: "yaml",
  "python-dateutil": "dateutil",
  "python-dotenv": "dotenv",
  "python-louvain": "community",
  "scikit-image": "skimage",
  "scikit-learn": "sklearn",
  "umap-learn": "umap",
};

const INSTALL_OUTPUT_LIMIT = 12_000;
const INSTALL_TIMEOUT_MS = 10 * 60 * 1000;

export interface MissingPythonDependency {
  moduleName: string;
  packageName: string;
  evidence: string;
}

export interface PythonInstallEnvironment {
  kind: "conda" | "virtualenv" | "local_user" | "configured";
  name: string;
  python: string;
  installArgs: string[];
  description: string;
}

export type DependencyInstallReviewDecision = "yes" | "yes_to_all" | "no" | "unavailable" | "cancel";

export interface DependencyInstallRequest extends MissingPythonDependency {
  runId?: string;
  parentRunId?: string;
  taskId?: string;
  failingCommand?: string;
}

export interface DependencyInstallReviewRequest extends DependencyInstallRequest {
  environment: PythonInstallEnvironment;
  installCommand: string;
  queueLength: number;
  approveAllActive: boolean;
}

export interface DependencyProcessResult {
  ok: boolean;
  exitCode: number | null;
  stdout: string;
  stderr: string;
  error?: string;
}

export type DependencyProcessRunner = (
  command: string,
  args: string[],
  options: { env: NodeJS.ProcessEnv; signal?: AbortSignal; timeoutMs: number },
) => Promise<DependencyProcessResult>;

export interface DependencyInstallOutcome extends DependencyInstallRequest {
  decision: DependencyInstallReviewDecision;
  status: "installed" | "already_installed" | "declined" | "approval_unavailable" | "approval_cancelled" | "install_failed";
  environment: PythonInstallEnvironment;
  installCommand: string;
  approveAllActive: boolean;
  stdout?: string;
  stderr?: string;
  error?: string;
}

function compactOutput(value: string): string {
  return value.length <= INSTALL_OUTPUT_LIMIT ? value : value.slice(-INSTALL_OUTPUT_LIMIT);
}

function safeModuleName(value: unknown): string | undefined {
  const moduleName = String(value || "").trim();
  return /^[A-Za-z_][A-Za-z0-9_.]*$/.test(moduleName) ? moduleName : undefined;
}

function safePackageName(value: unknown): string | undefined {
  const packageName = String(value || "").trim().replace(/[.,;:]+$/, "");
  return /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(packageName) ? packageName : undefined;
}

export function packageNameForModule(moduleName: string): string {
  const root = moduleName.split(".")[0] || moduleName;
  return PACKAGE_ALIASES[root.toLowerCase()] || root;
}

export function moduleNameForPackage(packageName: string): string {
  return PACKAGE_IMPORT_ALIASES[packageName.toLowerCase()] || packageName.replaceAll("-", "_");
}

function evidenceLine(text: string, index: number): string {
  const start = Math.max(0, text.lastIndexOf("\n", index) + 1);
  const endIndex = text.indexOf("\n", index);
  const end = endIndex < 0 ? text.length : endIndex;
  return text.slice(start, end).trim().slice(0, 500);
}

export function detectMissingPythonDependencies(text: string): MissingPythonDependency[] {
  const found = new Map<string, MissingPythonDependency>();
  const modulePatterns = [
    /ModuleNotFoundError:\s*No module named\s+['"]([^'"]+)['"]/gi,
    /ImportError:\s*No module named\s+['"]?([A-Za-z_][A-Za-z0-9_.]*)['"]?/gi,
    /\bNo module named\s+['"]([^'"]+)['"]/gi,
  ];
  for (const pattern of modulePatterns) {
    for (const match of text.matchAll(pattern)) {
      const moduleName = safeModuleName(match[1]);
      if (!moduleName) continue;
      const packageName = safePackageName(packageNameForModule(moduleName));
      if (!packageName) continue;
      const key = `${moduleName.toLowerCase()}\0${packageName.toLowerCase()}`;
      if (!found.has(key)) found.set(key, { moduleName, packageName, evidence: evidenceLine(text, match.index || 0) });
    }
  }

  const optionalPatterns = [
    /Missing optional dependency\s+['"]([^'"]+)['"]/gi,
    /Optional dependency\s+['"]([^'"]+)['"]\s+is required/gi,
    /ImportError:[^\n]*?\b([A-Za-z0-9][A-Za-z0-9._-]*)\s+is required(?:\s|[.,])/gi,
    /ImportError:[^\n]*?\b(?:please\s+)?install\s+['"]?([A-Za-z0-9][A-Za-z0-9._-]*)/gi,
    /PackageNotFoundError:\s*No package metadata was found for\s+([A-Za-z0-9][A-Za-z0-9._-]*)/gi,
  ];
  for (const pattern of optionalPatterns) {
    for (const match of text.matchAll(pattern)) {
      const packageName = safePackageName(match[1]);
      if (!packageName) continue;
      const moduleName = safeModuleName(moduleNameForPackage(packageName)) || packageName;
      const key = `${moduleName.toLowerCase()}\0${packageName.toLowerCase()}`;
      if (!found.has(key)) found.set(key, { moduleName, packageName, evidence: evidenceLine(text, match.index || 0) });
    }
  }
  return [...found.values()].slice(0, 5);
}

export function resolvePythonInstallEnvironment(
  env: NodeJS.ProcessEnv = process.env,
  platform: NodeJS.Platform = process.platform,
): PythonInstallEnvironment {
  const active = activePythonEnvironment(env, platform);
  const explicit = String(env.SEEKBRAIN_PYTHON || "").trim();
  if (active && (!explicit || explicit === active.python)) {
    return {
      ...active,
      installArgs: ["-m", "pip", "install", "--disable-pip-version-check", "--no-input"],
      description: `${active.kind} environment ${active.name} (${active.python})`,
    };
  }
  const python = resolvePythonCommand(env, platform);
  return {
    kind: explicit ? "configured" : "local_user",
    name: explicit ? "configured interpreter" : "user site",
    python,
    installArgs: ["-m", "pip", "install", "--disable-pip-version-check", "--no-input", ...(explicit ? [] : ["--user"])],
    description: explicit ? `configured Python interpreter (${python})` : `local Python user site via ${python}`,
  };
}

function displayArgument(value: string): string {
  return /^[A-Za-z0-9_./:@+-]+$/.test(value) ? value : JSON.stringify(value);
}

export function dependencyInstallCommand(environment: PythonInstallEnvironment, packageName: string): string {
  return [environment.python, ...environment.installArgs, packageName].map(displayArgument).join(" ");
}

export const runDependencyProcess: DependencyProcessRunner = async (command, args, options) => new Promise((resolve) => {
  let stdout = "";
  let stderr = "";
  let settled = false;
  let timedOut = false;
  const child = spawn(command, args, { env: pythonProcessEnvironment(options.env), stdio: ["ignore", "pipe", "pipe"] });
  const finish = (result: DependencyProcessResult) => {
    if (settled) return;
    settled = true;
    clearTimeout(timeout);
    options.signal?.removeEventListener("abort", abort);
    resolve({ ...result, stdout: compactOutput(stdout), stderr: compactOutput(stderr) });
  };
  const abort = () => stopProcessTree(child);
  const timeout = setTimeout(() => {
    timedOut = true;
    stopProcessTree(child);
  }, options.timeoutMs);
  options.signal?.addEventListener("abort", abort, { once: true });
  child.stdout?.on("data", (chunk) => { stdout = compactOutput(stdout + String(chunk)); });
  child.stderr?.on("data", (chunk) => { stderr = compactOutput(stderr + String(chunk)); });
  child.on("error", (error) => finish({ ok: false, exitCode: null, stdout, stderr, error: String(error) }));
  child.on("close", (code) => finish({
    ok: code === 0 && !timedOut && !options.signal?.aborted,
    exitCode: code,
    stdout,
    stderr,
    error: options.signal?.aborted
      ? "Package installation was aborted."
      : timedOut ? `Package installation timed out after ${Math.round(options.timeoutMs / 1000)} seconds.`
        : code === 0 ? undefined : `Package installer exited with code ${code ?? "unknown"}.`,
  }));
  if (options.signal?.aborted) abort();
});

export async function installPythonDependency(
  request: DependencyInstallRequest,
  environment: PythonInstallEnvironment,
  options: {
    env?: NodeJS.ProcessEnv;
    runner?: DependencyProcessRunner;
    signal?: AbortSignal;
  } = {},
): Promise<Pick<DependencyInstallOutcome, "status" | "stdout" | "stderr" | "error">> {
  const runner = options.runner || runDependencyProcess;
  const processEnv = options.env || process.env;
  const installed = await runner(
    environment.python,
    [...environment.installArgs, request.packageName],
    { env: processEnv, signal: options.signal, timeoutMs: INSTALL_TIMEOUT_MS },
  );
  if (!installed.ok) {
    return { status: "install_failed", stdout: installed.stdout, stderr: installed.stderr, error: installed.error || installed.stderr || installed.stdout };
  }
  const rootModule = request.moduleName.split(".")[0] || request.moduleName;
  const verified = await runner(
    environment.python,
    ["-c", "import importlib.util,sys; sys.exit(0 if importlib.util.find_spec(sys.argv[1]) is not None else 3)", rootModule],
    { env: processEnv, signal: options.signal, timeoutMs: 60_000 },
  );
  if (!verified.ok) {
    return {
      status: "install_failed",
      stdout: installed.stdout,
      stderr: [installed.stderr, verified.stderr].filter(Boolean).join("\n"),
      error: `pip completed, but module '${rootModule}' is still unavailable from ${environment.python}.`,
    };
  }
  return { status: "installed", stdout: installed.stdout, stderr: installed.stderr };
}

export class SerializedReviewGate {
  private tail: Promise<void> = Promise.resolve();

  run<T>(operation: () => Promise<T>): Promise<T> {
    const current = this.tail.then(operation);
    this.tail = current.then(() => undefined, () => undefined);
    return current;
  }
}

export class DependencyInstallApprovalQueue {
  private tail: Promise<void> = Promise.resolve();
  private pendingCount = 0;
  private approveAll: boolean;
  private completed = new Map<string, DependencyInstallOutcome>();

  constructor(readonly options: {
    environment: PythonInstallEnvironment;
    env?: NodeJS.ProcessEnv;
    review(request: DependencyInstallReviewRequest): Promise<DependencyInstallReviewDecision>;
    install?: typeof installPythonDependency;
    runner?: DependencyProcessRunner;
    initialApproveAll?: boolean;
    onApproveAll?: () => Promise<void>;
  }) {
    this.approveAll = options.initialApproveAll === true;
  }

  get approveAllActive(): boolean {
    return this.approveAll;
  }

  request(request: DependencyInstallRequest, signal?: AbortSignal): Promise<DependencyInstallOutcome> {
    this.pendingCount += 1;
    const current = this.tail.then(() => this.process(request, signal));
    this.tail = current.then(() => undefined, () => undefined);
    return current.finally(() => { this.pendingCount = Math.max(0, this.pendingCount - 1); });
  }

  private async process(request: DependencyInstallRequest, signal?: AbortSignal): Promise<DependencyInstallOutcome> {
    const installCommand = dependencyInstallCommand(this.options.environment, request.packageName);
    const key = `${this.options.environment.python}\0${request.packageName.toLowerCase()}\0${request.moduleName.toLowerCase()}`;
    const completed = this.completed.get(key);
    if (completed?.status === "installed" || completed?.status === "install_failed") {
      return completed.status === "installed"
        ? { ...completed, status: "already_installed", approveAllActive: this.approveAll }
        : { ...completed, approveAllActive: this.approveAll };
    }

    let decision: DependencyInstallReviewDecision = this.approveAll ? "yes_to_all" : "unavailable";
    if (!this.approveAll) {
      try {
        decision = await this.options.review({
          ...request,
          environment: this.options.environment,
          installCommand,
          queueLength: this.pendingCount,
          approveAllActive: false,
        });
      } catch {
        decision = "unavailable";
      }
    }
    if (decision === "yes_to_all" && !this.approveAll) {
      this.approveAll = true;
      await this.options.onApproveAll?.();
    }
    const base = {
      ...request,
      decision,
      environment: this.options.environment,
      installCommand,
      approveAllActive: this.approveAll,
    };
    if (decision === "no") return { ...base, status: "declined" };
    if (decision === "cancel") return { ...base, status: "approval_cancelled" };
    if (decision === "unavailable") return { ...base, status: "approval_unavailable" };

    const install = this.options.install || installPythonDependency;
    const result = await install(request, this.options.environment, {
      env: this.options.env,
      runner: this.options.runner,
      signal,
    });
    const outcome: DependencyInstallOutcome = { ...base, ...result };
    this.completed.set(key, outcome);
    return outcome;
  }
}

function resultText(content: unknown[]): string {
  return content
    .filter((item): item is { type: "text"; text: string } => Boolean(item) && typeof item === "object" && (item as Json).type === "text" && typeof (item as Json).text === "string")
    .map((item) => item.text)
    .join("\n\n");
}

function outcomeMessage(outcome: DependencyInstallOutcome): string {
  const target = `${outcome.environment.description} using ${outcome.environment.python}`;
  if (outcome.status === "installed") {
    const allowAll = outcome.approveAllActive
      ? outcome.parentRunId
        ? " All pip installs requested by remaining tasks in this Research Planning run are approved automatically and remain serialized."
        : " Future missing-package requests in this run are approved automatically and remain serialized."
      : "";
    return `User approved installing '${outcome.packageName}' for missing module '${outcome.moduleName}'. Installation succeeded in ${target}. Rerun the exact failing command before changing the implementation.${allowAll}`;
  }
  if (outcome.status === "already_installed") {
    return `Package '${outcome.packageName}' was already installed successfully by this approval queue in ${target}. Rerun the exact failing command.`;
  }
  if (outcome.status === "declined") {
    return `User selected No for installing '${outcome.packageName}' (missing module '${outcome.moduleName}'). The package was not installed. Only now may you retry with packages already available in the environment.`;
  }
  if (outcome.status === "install_failed") {
    const detail = String(outcome.error || outcome.stderr || outcome.stdout || "unknown installer error").trim().slice(-2000);
    return `User approved installing '${outcome.packageName}', but installation or import verification failed in ${target}: ${detail}. This was not a No decision; do not silently switch to a substitute package. Inspect the installer failure, correct the package mapping if justified, or report the blocker.`;
  }
  return `Installation approval for '${outcome.packageName}' was ${outcome.status === "approval_cancelled" ? "cancelled" : "unavailable"}. No explicit No decision was recorded. Do not silently switch to a substitute package; stop and report that package approval is still required.`;
}

function appendDependencyDetails(details: unknown, outcomes: DependencyInstallOutcome[]): Json {
  const base = details && typeof details === "object" && !Array.isArray(details) ? details as Json : {};
  return {
    ...base,
    seekbrain_dependency_installs: outcomes.map((outcome) => ({
      module_name: outcome.moduleName,
      package_name: outcome.packageName,
      decision: outcome.decision,
      status: outcome.status,
      environment: outcome.environment.description,
      install_command: outcome.installCommand,
      task_id: outcome.taskId,
    })),
  };
}

export function createDependencyInstallToolResultHandler(
  queue: DependencyInstallApprovalQueue,
  context: { runId?: string; parentRunId?: string; taskId?: string } = {},
): CodeAgentToolResultHandler {
  return async (event: CodeAgentToolResultEvent, signal?: AbortSignal): Promise<CodeAgentToolResultOverride | undefined> => {
    if (event.toolName !== "bash") return undefined;
    const text = resultText(event.content);
    const missing = detectMissingPythonDependencies(text);
    if (!missing.length) return undefined;
    const failingCommand = typeof (event.args as Json)?.command === "string" ? String((event.args as Json).command).slice(0, 1000) : undefined;
    const outcomes: DependencyInstallOutcome[] = [];
    for (const dependency of missing) {
      outcomes.push(await queue.request({ ...dependency, ...context, failingCommand }, signal));
    }
    return {
      content: [
        ...event.content,
        { type: "text", text: `[SeekBrain missing-dependency review]\n${outcomes.map((outcome) => `- ${outcomeMessage(outcome)}`).join("\n")}` },
      ],
      details: appendDependencyDetails(event.details, outcomes),
      isError: event.isError,
    };
  };
}
