// Console Host fonts can render box drawing and block glyphs with different
// cell widths. Prefer simple decoration unless a modern terminal is identified.
export function useAsciiTui(env = process.env, platform = process.platform): boolean {
  if (env.SEEKBRAIN_TUI_STYLE === "ascii") return true;
  if (env.SEEKBRAIN_TUI_STYLE === "unicode") return false;
  return platform === "win32" && !(
    env.WT_SESSION || env.WEZTERM_PANE || env.ANSICON || env.ConEmuANSI === "ON"
    || /^(vscode|wezterm|alacritty|ghostty|mintty|windows_terminal)$/i.test(env.TERM_PROGRAM || "")
  );
}

// Each replacement occupies one cell, preserving padding and ANSI sequences.
// User content (including Chinese text) is retained.
export function terminalText(text: string): string {
  if (!useAsciiTui()) return text;
  return text.replace(/[╭╮╰╯┌┐└┘├┤┬┴┼]/g, "+")
    .replace(/─/g, "-").replace(/│/g, "|")
    .replace(/[●•·]/g, "*").replace(/›/g, ">")
    .replace(/…/g, ".").replace(/[—–]/g, "-")
    .replace(/↑/g, "^").replace(/↓/g, "v");
}

export function terminalTheme<T extends { fg: (tone: any, text: string) => string }>(theme: T): T {
  if (!useAsciiTui()) return theme;
  const adjusted = Object.create(theme);
  adjusted.fg = (tone: string, text: string) => theme.fg(
    tone === "dim" || tone === "muted" ? "text" : tone, text,
  );
  return adjusted;
}
