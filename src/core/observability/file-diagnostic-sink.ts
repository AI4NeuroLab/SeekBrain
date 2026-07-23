import { appendFile, copyFile, mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { PathPolicy } from "../artifacts/path-policy.ts";
import { atomicWriteJson } from "../state/atomic-json.ts";

export interface DiagnosticWarning {
  type: "diagnostic_write_failed";
  operation: string;
  path: string;
  error: string;
}

export class FileDiagnosticSink {
  readonly paths: PathPolicy;

  constructor(readonly runDir: string, readonly enabled = true) {
    this.paths = new PathPolicy(runDir);
  }

  async json(path: string, data: unknown, warnings: DiagnosticWarning[]): Promise<void> {
    await this.attempt("write_json", path, warnings, async (safePath) => atomicWriteJson(safePath, data));
  }

  async text(path: string, data: string, warnings: DiagnosticWarning[]): Promise<void> {
    await this.attempt("write_text", path, warnings, async (safePath) => {
      await mkdir(dirname(safePath), { recursive: true });
      await writeFile(safePath, data, "utf8");
    });
  }

  async jsonl(path: string, entries: unknown[], warnings: DiagnosticWarning[]): Promise<void> {
    const data = entries.map((entry) => JSON.stringify(entry)).join("\n") + (entries.length ? "\n" : "");
    await this.attempt("write_jsonl", path, warnings, async (safePath) => {
      await mkdir(dirname(safePath), { recursive: true });
      await writeFile(safePath, data, "utf8");
    });
  }

  async appendJsonl(path: string, entry: unknown, warnings: DiagnosticWarning[]): Promise<void> {
    await this.attempt("append_jsonl", path, warnings, async (safePath) => {
      await mkdir(dirname(safePath), { recursive: true });
      await appendFile(safePath, `${JSON.stringify(entry)}\n`, "utf8");
    });
  }

  async directory(path: string, warnings: DiagnosticWarning[]): Promise<boolean> {
    if (!this.enabled) return false;
    try {
      await mkdir(this.paths.resolve(path), { recursive: true });
      return true;
    } catch (error) {
      warnings.push(this.warning("mkdir", path, error));
      return false;
    }
  }

  async copy(source: string, target: string, warnings: DiagnosticWarning[]): Promise<boolean> {
    if (!this.enabled) return false;
    try {
      const safeSource = this.paths.resolve(source);
      const safeTarget = this.paths.resolve(target);
      await mkdir(dirname(safeTarget), { recursive: true });
      await copyFile(safeSource, safeTarget);
      return true;
    } catch (error) {
      warnings.push(this.warning("copy_file", target, error));
      return false;
    }
  }

  warning(operation: string, path: string, error: unknown): DiagnosticWarning {
    return { type: "diagnostic_write_failed", operation, path, error: String(error) };
  }

  private async attempt(
    operation: string,
    path: string,
    warnings: DiagnosticWarning[],
    write: (safePath: string) => Promise<void>,
  ): Promise<void> {
    if (!this.enabled) return;
    try {
      await write(this.paths.resolve(path));
    } catch (error) {
      warnings.push(this.warning(operation, path, error));
    }
  }
}
