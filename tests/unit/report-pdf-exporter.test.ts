import { chmod, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { exportReportPdf } from "../../src/workflows/index.ts";

describe("exportReportPdf", () => {
  it("runs an optional user-level renderer and verifies report.pdf", async () => {
    const dir = await mkdtemp(join(tmpdir(), "seekbrain-pdf-"));
    try {
      const markdownPath = join(dir, "report.md");
      const pdfPath = join(dir, "report.pdf");
      const renderer = join(dir, "md-to-pdf-test.mjs");
      await writeFile(markdownPath, "# Report\n");
      await writeFile(renderer, [
        "#!/usr/bin/env node",
        "import { writeFile } from 'node:fs/promises';",
        "await writeFile(new URL('./report.pdf', import.meta.url), '%PDF-test');",
      ].join("\n"));
      await chmod(renderer, 0o755);
      const result = await exportReportPdf({ markdownPath, pdfPath, command: renderer, timeoutSeconds: 5 });
      expect(result).toMatchObject({ ok: true, pdf_path: pdfPath, command: renderer });
      expect(await readFile(pdfPath, "utf8")).toBe("%PDF-test");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("returns an install instruction when the optional renderer is absent", async () => {
    const dir = await mkdtemp(join(tmpdir(), "seekbrain-pdf-missing-"));
    try {
      const markdownPath = join(dir, "report.md");
      await writeFile(markdownPath, "# Report\n");
      const result = await exportReportPdf({ markdownPath, pdfPath: join(dir, "report.pdf"), command: "seekbrain-missing-pdf-renderer", timeoutSeconds: 5 });
      expect(result).toMatchObject({ ok: false });
      expect(String(result.error)).toContain("was not found");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
