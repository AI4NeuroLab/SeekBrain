import { readFile } from "node:fs/promises";

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

export function researchFullMarkdown(state: Json): string {
  const research = state.deep_research;
  if (!research?.rounds) return "# Deep Research\n\nNo research rounds recorded.";
  return ["# Deep Research", `Round ${research.round} · ${research.phase}`,
    ...research.rounds.map((round: Json) => `\n## Round ${round.number}\n\n${round.decision?.reason || "In progress"}${round.report ? `\n\nReport: ${round.report.original_path}` : ""}`)].join("\n\n");
}

export function skillFullMarkdown(state: Json): string {
  const targeted = String(state.targeted_skill || "").trim();
  const source = String(state.targeted_skill_result?.source || (targeted ? "existing_skill" : "none"));
  const label = source === "method_pack" ? "scientific method pack assembled"
    : source === "composed_recipe_set" ? "composed from local and RAG candidates"
    : source === "repository_reference" ? "repository method found"
      : source === "validated_repository_recipe" ? "validated repository recipe reused"
        : source === "paper_reference" ? "literature method found"
          : source === "generated_from_rag" || source === "crystallized" ? "crystallized from literature and code"
            : source === "existing_skill" || source === "repertoire" ? "retrieved from the Neuroscience Analysis Repertoire"
              : "no match";
  return targeted ? `# 🧩 Analysis Recipe — ${label}\n\n${targeted}` : `# 🧩 Analysis Recipe — ${label}\n\n_No matching analysis recipe was found for this question._`;
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
  pi.registerCommand("seekbrain-show", {
    description: "Show the Deep Research rounds or analysis-recipe content for a run (scrollable). Usage: /seekbrain-show research|recipe [run_id]",
    getArgumentCompletions: (prefix: string) => {
      const items = [{ value: "research", label: "research — the Deep Research rounds" }, { value: "recipe", label: "recipe — the analysis recipe" }];
      const filtered = items.filter((item) => item.value.startsWith(prefix));
      return filtered.length ? filtered : null;
    },
    async handler(args: string, context: Json) {
      const tokens = String(args || "").trim().split(/\s+/).filter(Boolean);
      let which = tokens.find((token) => token === "research" || token === "recipe" || token === "skill");
      if (!which && context.hasUI) {
        const selected = await context.ui.select("Show which?", ["Deep Research rounds", "Analysis recipe"]);
        if (!selected) return;
        which = selected === "Analysis recipe" ? "recipe" : "research";
      }
      if (!which) which = "research";
      let run: Json | undefined;
      try {
        const runId = tokens.find((token) => token !== "research" && token !== "recipe" && token !== "skill" && !token.startsWith("-"));
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
      const showRecipe = which === "recipe" || which === "skill";
      let recipeText = String(run.state.targeted_skill || "");
      if (showRecipe && run.state.targeted_skill_path) {
        recipeText = await readFile(String(run.state.targeted_skill_path), "utf8").catch(() => recipeText);
      }
      const full = showRecipe ? skillFullMarkdown({ ...run.state, targeted_skill: recipeText }) : researchFullMarkdown(run.state);
      const title = showRecipe ? "🧩 Analysis Recipe" : "🔬 Deep Research";
      if (context.mode === "tui") await openOverlay(context, title, full);
      else pi.sendMessage({ customType: showRecipe ? "seekbrain-recipe" : "seekbrain-research", content: full, display: true });
    },
  });
}
