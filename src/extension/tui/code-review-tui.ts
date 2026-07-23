import { Box, Spacer, Text, truncateToWidth, type Component } from "@earendil-works/pi-tui";
import { structuredPatch } from "diff";
import { extname } from "node:path";
import { renderCodeEditCompletionResult } from "./compact-tool-results.ts";

type Json = Record<string, any>;

export function preloadDiffComponent(): Promise<any> {
  return Promise.resolve(SeekBrainDiffComponent);
}

export class SeekBrainDiffComponent implements Component {
  constructor(private readonly diff: Json, private readonly theme: any) {}
  render(width: number): string[] {
    const oldWidth = Math.max(1, String(Math.max(0, ...this.diff.lines.map((line: Json) => line.oldNum || 0))).length);
    const newWidth = Math.max(1, String(Math.max(0, ...this.diff.lines.map((line: Json) => line.newNum || 0))).length);
    const bodyWidth = Math.max(1, width - oldWidth - newWidth - 5);
    return this.diff.lines.map((line: Json) => {
      if (line.type === "sep") return this.theme.fg("dim", truncateToWidth(`  ··· ${line.newNum ? `${line.newNum} unchanged lines` : "section"} ···`, width, ""));
      const oldNumber = line.oldNum === null ? " ".repeat(oldWidth) : String(line.oldNum).padStart(oldWidth);
      const newNumber = line.newNum === null ? " ".repeat(newWidth) : String(line.newNum).padStart(newWidth);
      const marker = line.type === "add" ? "+" : line.type === "del" ? "-" : " ";
      const color = line.type === "add" ? "success" : line.type === "del" ? "error" : "toolOutput";
      const prefix = this.theme.fg("dim", `${oldNumber} ${newNumber} `) + this.theme.fg(color, `${marker} `);
      return prefix + this.theme.fg(color, truncateToWidth(String(line.content || ""), bodyWidth, ""));
    });
  }
  invalidate(): void {}
}

export function parsedDiff(oldText: string, newText: string) {
  const patch = structuredPatch("", "", oldText, newText, "", "", { context: 3 });
  const lines: Array<{ type: "add" | "del" | "ctx" | "sep"; oldNum: number | null; newNum: number | null; content: string }> = [];
  let added = 0;
  let removed = 0;
  patch.hunks.forEach((hunk: { oldStart: number; oldLines: number; newStart: number; lines: string[] }, index: number) => {
    if (index > 0) {
      const previous = patch.hunks[index - 1]!;
      const gap = hunk.oldStart - (previous.oldStart + previous.oldLines);
      lines.push({ type: "sep", oldNum: null, newNum: gap > 0 ? gap : null, content: "" });
    }
    let oldNum = hunk.oldStart;
    let newNum = hunk.newStart;
    for (const rawLine of hunk.lines) {
      if (rawLine === "\\ No newline at end of file") continue;
      const marker = rawLine[0];
      const content = rawLine.slice(1);
      if (marker === "+") { lines.push({ type: "add", oldNum: null, newNum: newNum++, content }); added++; }
      else if (marker === "-") { lines.push({ type: "del", oldNum: oldNum++, newNum: null, content }); removed++; }
      else lines.push({ type: "ctx", oldNum: oldNum++, newNum: newNum++, content });
    }
  });
  return { lines, added, removed, chars: oldText.length + newText.length };
}

function diffLanguage(path: string): string | undefined {
  const languages: Record<string, string> = {
    ".c": "c", ".cpp": "cpp", ".css": "css", ".go": "go", ".html": "html", ".java": "java", ".js": "javascript", ".json": "json", ".jsx": "jsx",
    ".md": "markdown", ".py": "python", ".r": "r", ".rb": "ruby", ".rs": "rust", ".sh": "bash", ".sql": "sql", ".ts": "typescript", ".tsx": "tsx", ".xml": "xml", ".yaml": "yaml", ".yml": "yaml",
  };
  return languages[extname(path).toLowerCase()];
}

export function createCodeReviewDetails(input: { codePath: string; diffPath: string; summary: string; oldCode: string; proposedCode: string; extra?: Json }): Json {
  return { _type: "neuroCodeUpdateReview", codePath: input.codePath, diffPath: input.diffPath, summary: input.summary, diff: parsedDiff(input.oldCode, input.proposedCode), language: diffLanguage(input.codePath), ...input.extra };
}

export function renderCodeEditCall(args: Json, theme: Json) {
  const target = args.code_path ? ` ${theme.fg("muted", args.code_path)}` : "";
  return new Text(`${theme.fg("toolTitle", theme.bold("review code edit"))}${target}`, 0, 0);
}

export function renderCodeUpdateCall(args: Json, theme: Json) {
  const edit = args.edit_id ? ` ${theme.fg("muted", args.edit_id)}` : "";
  return new Text(`${theme.fg("toolTitle", theme.bold("review code update"))}${edit}`, 0, 0);
}

function renderCodeReviewResult(title: string, result: Json, { isPartial }: Json, theme: Json, context: Json) {
  const details = result.details as Json | undefined;
  if (details?._type === "neuroCodeUpdateReview") {
    const shell = new Box(1, 1, (text: string) => theme.bg(isPartial ? "toolPendingBg" : "toolSuccessBg", text));
    shell.addChild(new Text(theme.fg("toolTitle", theme.bold(title)), 0, 0));
    shell.addChild(new Text(theme.fg("accent", details.codePath), 0, 0));
    if (details.summary) { shell.addChild(new Spacer(1)); shell.addChild(new Text(theme.fg("toolOutput", details.summary), 0, 0)); }
    shell.addChild(new Spacer(1));
    shell.addChild(new SeekBrainDiffComponent(details.diff, theme));
    shell.addChild(new Spacer(1));
    shell.addChild(new Text(theme.fg("muted", `Full patch: ${details.diffPath}`), 0, 0));
    return shell;
  }
  return renderCodeEditCompletionResult(result, { isPartial, expanded: context?.expanded === true }, theme);
}

export function renderCodeEditResult(result: Json, state: Json, theme: Json, context: Json) {
  return renderCodeReviewResult("SeekBrain Code Edit Review", result, state, theme, context);
}

export function renderCodeUpdateResult(result: Json, state: Json, theme: Json, context: Json) {
  return renderCodeReviewResult("SeekBrain Code Update Review", result, state, theme, context);
}
