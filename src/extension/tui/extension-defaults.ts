import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { Text, truncateToWidth } from "@earendil-works/pi-tui";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const PACKAGE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const VERSION = JSON.parse(readFileSync(join(PACKAGE_ROOT, "package.json"), "utf8")).version;

function seekBrainHeader(theme: any) {
  let expanded = false;
  const text = new Text("", 1, 0);
  const compact = () => [
    theme.bold(theme.fg("accent", "seekbrain")) + theme.fg("dim", ` v${VERSION}`),
    theme.fg("dim", "escape interrupt · ctrl+c/ctrl+d clear/exit · / commands · ! bash · ctrl+o more"),
    theme.fg("dim", "Press ctrl+o to show full startup help and loaded resources."),
  ];
  const full = () => [
    theme.bold(theme.fg("accent", "seekbrain")) + theme.fg("dim", ` v${VERSION}`),
    theme.fg("dim", "escape interrupt · ctrl+c clear · ctrl+d exit · / commands · ! bash"),
    theme.fg("dim", "ctrl+p models · shift+tab thinking · ctrl+o compact view · drop files to attach"),
    "",
    theme.fg("mdHeading", "[Prompts]"),
    theme.fg("dim", "  /entry"),
    "",
    theme.fg("mdHeading", "[Extensions]"),
    theme.fg("dim", "  SeekBrain workflow, usage footer"),
  ];
  return {
    setExpanded(value: boolean) { expanded = value; },
    invalidate() { text.invalidate(); },
    render(width: number): string[] {
      const lines = (expanded ? full() : compact()).map((line) => truncateToWidth(line, Math.max(1, width - 2), ""));
      text.setText(lines.join("\n"));
      return text.render(width);
    },
  };
}

export function applySeekBrainDefaults(ctx: ExtensionContext): void {
  if (!ctx.hasUI) return;
  const configuredTheme = String(process.env.SEEKBRAIN_THEME || "").trim();
  if (configuredTheme) ctx.ui.setTheme(configuredTheme);
  ctx.ui.setHeader((_tui, theme) => seekBrainHeader(theme));
  setTimeout(() => ctx.ui.setTitle("π - seekbrain"), 150);
}
