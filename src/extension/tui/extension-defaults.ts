import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";
import { readFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const PACKAGE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const VERSION = JSON.parse(readFileSync(join(PACKAGE_ROOT, "package.json"), "utf8")).version;
const WIDE_HEADER_MIN_WIDTH = 104;

function fit(text: string, width: number): string {
  if (width <= 0) return "";
  return truncateToWidth(text, width, "", true);
}

function topBorder(theme: any, width: number, title: string): string {
  if (width < 4) return truncateToWidth(title, width, "");
  const shownTitle = truncateToWidth(title, Math.max(1, width - 4), "");
  const fill = Math.max(0, width - visibleWidth(shownTitle) - 3);
  return theme.fg("borderAccent", "╭─")
    + shownTitle
    + theme.fg("borderAccent", `${"─".repeat(fill)}╮`);
}

function bottomBorder(theme: any, width: number): string {
  if (width < 2) return theme.fg("borderAccent", "─".repeat(width));
  return theme.fg("borderAccent", `╰${"─".repeat(width - 2)}╯`);
}

function divider(theme: any, width: number): string {
  if (width < 2) return theme.fg("borderMuted", "─".repeat(width));
  return theme.fg("borderMuted", `├${"─".repeat(width - 2)}┤`);
}

function framedRow(theme: any, width: number, content: string): string {
  if (width < 2) return truncateToWidth(content, width, "");
  return theme.fg("borderAccent", "│")
    + fit(content, width - 2)
    + theme.fg("borderAccent", "│");
}

function splitToFullDivider(theme: any, width: number, leftWidth: number): string {
  const innerWidth = width - 2;
  const rightWidth = innerWidth - leftWidth - 1;
  if (rightWidth < 1) return divider(theme, width);
  return theme.fg(
    "borderMuted",
    `├${"─".repeat(leftWidth)}┴${"─".repeat(rightWidth)}┤`,
  );
}

function splitRow(theme: any, width: number, leftWidth: number, left: string, right: string): string {
  const innerWidth = width - 2;
  const rightWidth = innerWidth - leftWidth - 1;
  if (rightWidth < 1) return framedRow(theme, width, right);
  return theme.fg("borderAccent", "│")
    + fit(left, leftWidth)
    + theme.fg("borderMuted", "│")
    + fit(right, rightWidth)
    + theme.fg("borderAccent", "│");
}

function wordmark(theme: any): string {
  return theme.bold(theme.fg("accent", "Seek"))
    + theme.bold(theme.fg("text", "Brain"));
}

function pipeline(theme: any, narrow = false): string {
  const stages = narrow
    ? ["ASK", "ANALYZE", "VALIDATE", "INSIGHT"]
    : ["QUESTION", "PLAN", "ANALYZE", "VALIDATE", "INSIGHT"];
  return stages
    .map((stage) => theme.fg("muted", stage))
    .join(theme.fg("accent", "  ›  "));
}

function action(theme: any, key: string, label: string): string {
  return theme.fg("mdHeading", key) + theme.fg("dim", ` ${label}`);
}

function workspaceName(): string {
  const root = process.env.SEEKBRAIN_PROJECT_ROOT || process.cwd();
  return basename(resolve(root)) || "workspace";
}

function displayWordmark(theme: any): string[] {
  return [
    `  ${theme.fg("accent", "█▀▀ █▀▀ █▀▀ █▄▀")}  ${theme.fg("text", "█▄▄ █▀█ ▄▀█ █ █▄ █")}`,
    `  ${theme.fg("accent", "▄▄█ ██▄ ██▄ █ █")}  ${theme.fg("text", "█▄█ █▀▄ █▀█ █ █ ▀█")}`,
  ];
}

function startHint(theme: any, expanded: boolean, narrow = false): string {
  return theme.bold(theme.fg("text", "Type below to begin"))
    + theme.fg("dim", "  ·  ")
    + action(theme, "ctrl+o", expanded ? "compact" : "guide")
    + (narrow
      ? ""
      : theme.fg("dim", "  ·  ") + action(theme, "/seekbrain-setup", "models"));
}

function detailRows(theme: any): Array<[string, string]> {
  return [
    ["START", theme.fg("text", "Type a research question or dataset path directly in the editor below")],
    ["DATA", theme.fg("dim", "a dataset path alone profiles the dataset and suggests research directions")],
    ["MODELS", action(theme, "/seekbrain-setup", "choose Core / Fast models")],
    ["KEYS", theme.fg("dim", "esc interrupt · ctrl+p models · shift+tab thinking · ctrl+c clear · ctrl+d exit")],
    ["LOADED", theme.fg("dim", `research workflow · adaptive stage tracker · usage footer · ${workspaceName()}`)],
  ];
}

function renderWideHeader(theme: any, width: number, expanded: boolean): string[] {
  const leftWidth = Math.min(44, Math.max(40, Math.floor(width * 0.3)));
  const title = ` ${wordmark(theme)}${theme.fg("dim", ` v${VERSION}`)} `;
  const logo = displayWordmark(theme);
  const lines = [
    topBorder(theme, width, title),
    splitRow(theme, width, leftWidth, logo[0], `  ${theme.fg("success", "● READY FOR RESEARCH")}`),
    splitRow(theme, width, leftWidth, logo[1], `  ${theme.bold(theme.fg("text", "SCIENTIFIC RESEARCH AGENT"))}`),
    splitToFullDivider(theme, width, leftWidth),
    framedRow(theme, width, `  ${theme.fg("text", "Ask a research question. Add data when it helps. SeekBrain handles the workflow.")}`),
    framedRow(theme, width, `  ${pipeline(theme)}`),
    framedRow(theme, width, `  ${startHint(theme, expanded)}`),
  ];
  if (expanded) {
    lines.push(divider(theme, width));
    for (const [label, detail] of detailRows(theme)) {
      lines.push(framedRow(
        theme,
        width,
        `  ${theme.bold(theme.fg("mdHeading", label))} ${theme.fg("dim", "·")} ${detail}`,
      ));
    }
  }
  lines.push(bottomBorder(theme, width));
  return lines;
}

function renderCompactHeader(theme: any, width: number, expanded: boolean): string[] {
  const title = ` ${wordmark(theme)}${theme.fg("dim", ` v${VERSION}`)} `;
  const narrow = width < 64;
  const lines = [
    topBorder(theme, width, title),
    framedRow(
      theme,
      width,
      `  ${theme.fg("success", "● READY")} ${theme.fg("dim", "·")} ${theme.bold(theme.fg("text", narrow ? "RESEARCH AGENT" : "SCIENTIFIC RESEARCH AGENT"))}`,
    ),
    framedRow(
      theme,
      width,
      `  ${theme.fg("text", narrow ? "Ask a question. Add data when useful." : "Ask a research question. Add data when it helps. SeekBrain handles the workflow.")}`,
    ),
    framedRow(theme, width, `  ${pipeline(theme, narrow)}`),
    framedRow(theme, width, `  ${startHint(theme, expanded, narrow)}`),
  ];
  if (expanded) {
    lines.push(divider(theme, width));
    for (const [label, detail] of detailRows(theme)) {
      lines.push(framedRow(
        theme,
        width,
        `  ${theme.bold(theme.fg("mdHeading", label))} ${theme.fg("dim", "·")} ${detail}`,
      ));
    }
  }
  lines.push(bottomBorder(theme, width));
  return lines;
}

function renderHeader(theme: any, width: number, expanded: boolean): string[] {
  const safeWidth = Math.max(1, width);
  if (safeWidth >= WIDE_HEADER_MIN_WIDTH) return renderWideHeader(theme, safeWidth, expanded);
  return renderCompactHeader(theme, safeWidth, expanded);
}

function seekBrainHeader(theme: any) {
  let expanded = false;
  let cacheKey = "";
  let cachedLines: string[] = [];
  return {
    setExpanded(value: boolean) {
      if (expanded === value) return;
      expanded = value;
      cacheKey = "";
    },
    invalidate() { cacheKey = ""; },
    render(width: number): string[] {
      const nextKey = `${width}:${expanded}`;
      if (nextKey !== cacheKey) {
        cachedLines = renderHeader(theme, width, expanded);
        cacheKey = nextKey;
      }
      return cachedLines;
    },
  };
}

export function applySeekBrainDefaults(ctx: ExtensionContext): void {
  if (!ctx.hasUI) return;
  const configuredTheme = String(process.env.SEEKBRAIN_THEME || "").trim();
  if (configuredTheme) ctx.ui.setTheme(configuredTheme);
  ctx.ui.setHeader((_tui, theme) => seekBrainHeader(theme));
  setTimeout(() => ctx.ui.setTitle("SeekBrain · Research Console"), 150);
}
