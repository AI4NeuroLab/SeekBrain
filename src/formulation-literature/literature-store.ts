import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile, rename, rm } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { atomicWriteJson } from "../core/index.ts";
import type { FullTextPaper, StoredPaper } from "./types.ts";

function hash(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function extractPaperAbstract(fullText: string): string {
  const normalized = fullText.replace(/\r\n/g, "\n").trim();
  const heading = normalized.match(/(?:^|\n)#{0,3}\s*abstract\s*\n+([\s\S]*?)(?=\n#{1,3}\s+|\n\s*(?:introduction|keywords?)\s*\n|$)/i);
  const labeled = heading?.[1]
    || normalized.match(/(?:^|\n)\s*abstract\s*[:.-]\s*([\s\S]*?)(?=\n\s*(?:introduction|keywords?)\s*[:.-]?\s*\n|$)/i)?.[1]
    || "";
  return labeled.replace(/\s+/g, " ").trim().slice(0, 3_000);
}

/** Application cache shared by conversations, agents and resumed sessions. */
export class FormulationLiteratureStore {
  constructor(readonly rootDir = join(process.env.XDG_CACHE_HOME || join(homedir(), ".cache"), "seekbrain", "literature")) {}

  async persistSearch(_query: string, papers: FullTextPaper[]): Promise<StoredPaper[]> {
    await mkdir(this.rootDir, { recursive: true });
    const stored: StoredPaper[] = [];
    const seen = new Set<string>();
    for (const paper of papers) {
      if (seen.has(paper.paper_id)) continue;
      seen.add(paper.paper_id);
      const { full_text, ...metadata } = paper;
      // Content-addressed text and per-paper atomic metadata avoid a shared-index
      // read/modify/write race when several agents save different papers.
      const fullTextPath = join(this.rootDir, `${hash(full_text)}.md`);
      const temporary = `${fullTextPath}.${randomUUID()}.tmp`;
      try {
        await writeFile(temporary, full_text, { encoding: "utf8", mode: 0o600 });
        await rename(temporary, fullTextPath);
      } finally { await rm(temporary, { force: true }); }
      const abstract = paper.abstract?.trim() || extractPaperAbstract(full_text);
      const record: StoredPaper = {
        ...metadata,
        abstract,
        ...(!abstract && full_text.trim() ? { preview: full_text.replace(/\s+/g, " ").trim().slice(0, 1_000) } : {}),
        full_text_available: Boolean(full_text.trim()),
        full_text_path: fullTextPath,
        full_text_chars: full_text.length,
      };
      await atomicWriteJson(join(this.rootDir, `${hash(paper.paper_id)}.json`), record);
      stored.push(record);
    }
    return stored;
  }

  async readPaper(paperId: string): Promise<{ paper: StoredPaper; full_text: string } | undefined> {
    let paper: StoredPaper;
    try {
      paper = JSON.parse(await readFile(join(this.rootDir, `${hash(paperId)}.json`), "utf8"));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
      throw error;
    }
    return { paper, full_text: await readFile(paper.full_text_path, "utf8") };
  }
}
