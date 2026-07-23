import type { ExtensionContext } from "@earendil-works/pi-coding-agent";

export function applySeekBrainDefaults(ctx: ExtensionContext): void {
  if (!ctx.hasUI) return;
  const configuredTheme = String(process.env.SEEKBRAIN_THEME || "").trim();
  if (configuredTheme) ctx.ui.setTheme(configuredTheme);
  setTimeout(() => ctx.ui.setTitle("π - seekbrain"), 150);
}
