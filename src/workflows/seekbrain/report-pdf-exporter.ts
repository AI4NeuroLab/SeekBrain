import { spawn } from "node:child_process";
import { access } from "node:fs/promises";
import { basename, dirname } from "node:path";

export interface ReportPdfExportInput {
  markdownPath: string;
  pdfPath: string;
  command?: string;
  timeoutSeconds?: number;
  signal?: AbortSignal;
}

export async function exportReportPdf(input: ReportPdfExportInput) {
  const command = String(input.command || "seekbrain-pdf").trim();
  const timeoutMs = Math.max(1, Number(input.timeoutSeconds || 120)) * 1000;
  const startedAt = Date.now();
  return await new Promise<Record<string, unknown>>((done) => {
    let stderr = "";
    let settled = false;
    const child = spawn(command, [basename(input.markdownPath)], {
      cwd: dirname(input.markdownPath),
      stdio: ["ignore", "ignore", "pipe"],
    });
    const finish = async (result: Record<string, unknown>) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      input.signal?.removeEventListener("abort", abort);
      let exists = false;
      try { await access(input.pdfPath); exists = true; } catch {}
      done({ ...result, ok: result.ok === true && exists, pdf_path: input.pdfPath, command, stderr, duration_ms: Date.now() - startedAt,
        ...(result.ok === true && !exists ? { error: `PDF command completed without creating '${input.pdfPath}'.` } : {}) });
    };
    const abort = () => child.kill("SIGTERM");
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      void finish({ ok: false, timed_out: true, error: `PDF generation exceeded ${timeoutMs / 1000} seconds.` });
    }, timeoutMs);
    timer.unref?.();
    input.signal?.addEventListener("abort", abort, { once: true });
    child.stderr?.on("data", (chunk) => { stderr = (stderr + String(chunk)).slice(-20_000); });
    child.on("error", (error: NodeJS.ErrnoException) => void finish({
      ok: false,
      error: error.code === "ENOENT"
        ? `Configured PDF renderer '${command}' was not found.`
        : String(error),
    }));
    child.on("close", (code, childSignal) => void finish({
      ok: code === 0,
      exit_code: code,
      signal: childSignal || undefined,
      ...(code === 0 ? {} : { error: stderr.trim() || `PDF renderer exited with code ${code ?? "unknown"}.` }),
    }));
    if (input.signal?.aborted) abort();
  });
}
