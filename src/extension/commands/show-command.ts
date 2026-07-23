type Json = Record<string, any>;

export interface ShowCommandAPI {
  registerCommand(name: string, command: Json): void;
  sendMessage(message: Json): void;
}

export interface ShowCommandDependencies {
  getActiveRunDir(): string | undefined;
  readJson(path: string, fallback: Json): Promise<Json>;
  resolveRun(cwd: string, runId: string): Promise<Json>;
  loadRunState(runId: string, runDir: string): Promise<Json>;
  runIndexPath(cwd: string): string;
}

function year(value: unknown): string {
  const match = String(value || "").match(/(?:19|20)\d{2}/);
  return match?.[0] || "";
}

export function researchFullMarkdown(state: Json): string {
  const context = String(state.deep_research_context || "").replace(/^\[Deep Research Background\]\s*/, "").trim();
  const sources: Json[] = Array.isArray(state.deep_research_sources) ? state.deep_research_sources : [];
  const parts = ["# 🔬 Deep Research", "", context || "_No synthesized background was produced._"];
  if (sources.length) {
    parts.push("", `## Sources (${sources.length})`);
    for (const source of sources) {
      const meta = [String(source.magazine || "").trim(), year(source.pub_time)].filter(Boolean).join(" · ");
      parts.push("", `### ${String(source.title || "(untitled paper)").trim()}`);
      if (meta) parts.push(`*${meta}*`);
      if (Array.isArray(source.github_links) && source.github_links.length) parts.push(source.github_links.map((link: string) => `[repo](${link})`).join(" · "));
      const text = String(source.text || "").trim();
      if (text) parts.push("", text);
    }
  }
  return parts.join("\n");
}

export function skillFullMarkdown(state: Json): string {
  const targeted = String(state.targeted_skill || "").trim();
  const source = String(state.targeted_skill_result?.source || (targeted ? "existing_skill" : "none"));
  const label = source === "generated_from_rag" ? "generated" : source === "existing_skill" ? "matched" : "no match";
  return targeted ? `# 🧩 Targeted Skill — ${label}\n\n${targeted}` : `# 🧩 Targeted Skill — ${label}\n\n_No matching skill was used for this question._`;
}

async function openOverlay(context: Json, title: string, markdown: string): Promise<void> {
  const tuiPackage = "@mariozechner/pi-tui";
  const corePackage = "@mariozechner/pi-coding-agent";
  const tui: any = await import(tuiPackage);
  const core: any = await import(corePackage);
  const { Markdown, truncateToWidth, matchesKey, Key } = tui;
  const markdownTheme = core.getMarkdownTheme();
  const viewHeight = 26;
  let scroll = 0;
  await context.ui.custom((tuiContext: Json, theme: Json, _keyboard: unknown, done: (value: unknown) => void) => ({
    render(width: number): string[] {
      const inner = Math.max(10, width - 4);
      let body: string[];
      try { body = new Markdown(markdown, 0, 0, markdownTheme).render(inner); } catch { body = markdown.split("\n"); }
      scroll = Math.min(Math.max(0, scroll), Math.max(0, body.length - viewHeight));
      const window = body.slice(scroll, scroll + viewHeight);
      const rule = theme.fg("accent", "─".repeat(width));
      const output = [rule, truncateToWidth(` ${theme.fg("accent", theme.bold(title))}  ${theme.fg("dim", `${scroll + 1}-${Math.min(scroll + viewHeight, body.length)}/${body.length}`)}`, width), ""];
      for (const line of window) output.push(truncateToWidth("  " + line, width));
      for (let index = window.length; index < viewHeight; index++) output.push("");
      output.push("", truncateToWidth(theme.fg("dim", " ↑/↓ scroll · space/b page · Esc close"), width), rule);
      return output;
    },
    handleInput(data: string) {
      if (matchesKey(data, Key.up)) scroll -= 1;
      else if (matchesKey(data, Key.down)) scroll += 1;
      else if (data === " " || data === "f") scroll += viewHeight;
      else if (data === "b") scroll -= viewHeight;
      else if (matchesKey(data, Key.escape)) { done(undefined); return; }
      tuiContext.requestRender();
    },
    invalidate() {},
  }), { overlay: true, overlayOptions: { width: "85%", anchor: "center" } });
}

export function registerShowCommand(pi: ShowCommandAPI, dependencies: ShowCommandDependencies): void {
  pi.registerCommand("neuro-show", {
    description: "Show the deep-research report or targeted-skill content for a run (scrollable). Usage: /neuro-show research|skill [run_id]",
    getArgumentCompletions: (prefix: string) => {
      const items = [{ value: "research", label: "research — the deep-research report" }, { value: "skill", label: "skill — the targeted-skill content" }];
      const filtered = items.filter((item) => item.value.startsWith(prefix));
      return filtered.length ? filtered : null;
    },
    async handler(args: string, context: Json) {
      const tokens = String(args || "").trim().split(/\s+/).filter(Boolean);
      let which = tokens.find((token) => token === "research" || token === "skill");
      if (!which && context.hasUI) { which = await context.ui.select("Show which?", ["research", "skill"]); if (!which) return; }
      if (!which) which = "research";
      let run: Json | undefined;
      try {
        const runId = tokens.find((token) => token !== "research" && token !== "skill" && !token.startsWith("-"));
        if (runId) run = await dependencies.resolveRun(context.cwd, runId);
        else if (dependencies.getActiveRunDir()) {
          const runDir = dependencies.getActiveRunDir()!;
          const state = await dependencies.readJson(`${runDir}/state.json`, {});
          if (state.run_id) run = await dependencies.loadRunState(state.run_id, runDir);
        }
        if (!run) {
          const index = await dependencies.readJson(dependencies.runIndexPath(context.cwd), { runs: {} });
          const ids = Object.keys(index.runs || {});
          if (!ids.length) { context.ui?.notify?.("No runs found.", "error"); return; }
          run = await dependencies.resolveRun(context.cwd, ids[ids.length - 1]);
        }
      } catch (error) { context.ui?.notify?.(`Could not locate run: ${error}`, "error"); return; }
      const full = which === "skill" ? skillFullMarkdown(run.state) : researchFullMarkdown(run.state);
      const title = which === "skill" ? "🧩 Targeted Skill" : "🔬 Deep Research";
      if (context.mode === "tui") await openOverlay(context, title, full);
      else pi.sendMessage({ customType: which === "skill" ? "neuro-skill" : "neuro-research", content: full, display: true });
    },
  });
}
