import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { applyAssistantPrompt } from "../../src/extension/runtime/shared/assistant-prompt.ts";
import { ModeController, MODE_LABELS, type InteractionMode } from "../../src/extension/runtime/mode-controller.ts";
import { buildPiLaunchSpec, buildTaskPrompt, parseArgs } from "../../src/cli/cli.mjs";

const common = readFileSync(new URL("../../prompts/assistant.md", import.meta.url), "utf8");
const research = readFileSync(new URL("../../prompts/research.md", import.meta.url), "utf8");
const native = await import(new URL("../../node_modules/@earendil-works/pi-coding-agent/dist/core/system-prompt.js", import.meta.url).href);
const modes = Object.keys(MODE_LABELS) as InteractionMode[];
function fixture() {
  return { cwd: "/tmp/user-workspace", selectedTools: ["read"],
    contextFiles: [{ path: "/tmp/user-workspace/AGENTS.md", content: "Use the user's biological replicate convention." }],
    skills: [{ name: "neuroscience-background", description: "Inspect background knowledge", filePath: "/tmp/skills/background/SKILL.md", baseDir: "/tmp/skills/background", disableModelInvocation: false, sourceInfo: {} }],
    sections: { unrelated_extension: "Existing extension context" },
  };
}
describe("SeekBrain main prompt integration", () => {
  it.each(modes)("preserves Pi context and skills and explains all modes while operating in %s", mode => {
    const controller = new ModeController(); controller.mode = mode; controller.project = "/tmp/current-study";
    const options = fixture();
    applyAssistantPrompt(options, { common, research, mode, context: controller.prompt() });
    const text = native.buildSystemPrompt(options);
    expect(text).toContain("Use the user's biological replicate convention."); expect(text).toContain("/tmp/user-workspace");
    expect(text).toContain("Existing extension context"); expect(text).toContain("/tmp/skills/background/SKILL.md");
    for (const command of modes) expect(text).toContain(`\`/${command}\``);
    expect(text).toContain(`Current mode: ${MODE_LABELS[mode]}`); expect(text).toContain("/tmp/current-study");
    expect(text).not.toMatch(/not implemented|not yet available|尚未实现|\$@/i);
    expect(text.includes("Use the registered research tools")).toBe(["research", "deep-research"].includes(mode));
  });
  it("replaces only owned sections when switching modes, without accumulating old workflow or project instructions", () => {
    const options = fixture(); const controller = new ModeController();
    applyAssistantPrompt(options, { common, research, mode: "research", context: controller.prompt() });
    controller.mode = "ask"; controller.project = "/tmp/second-study";
    applyAssistantPrompt(options, { common, research, mode: "ask", context: controller.prompt() });
    const text = native.buildSystemPrompt(options);
    expect(text).toContain("Current mode: Ask"); expect(text).not.toContain("Current mode: Research");
    expect(text).not.toContain("Use the registered research tools"); expect(text).toContain("Existing extension context");
    expect(text.split("You are SeekBrain,")).toHaveLength(2);
  });
  it("keeps automation instructions in runtime context rather than wrapping the user's request in a workflow", () => {
    for (const mode of ["ask", "plan", "research"] as InteractionMode[]) {
      const options = fixture(); const controller = new ModeController(); controller.mode = mode;
      applyAssistantPrompt(options, { common, research, mode, context: controller.prompt(), nonInteractive: true });
      expect(native.buildSystemPrompt(options)).toContain("Complete its requested scope without routine approval");
      expect(buildTaskPrompt({ query: "Explain these observations", interactionMode: mode }, "/tmp")).toBe("Explain these observations");
    }
  });
  it("keeps leading option-like text and @ references as literal user messages", async () => {
    const { parseArgs: parsePiArgs } = await import(new URL("../../node_modules/@earendil-works/pi-coding-agent/dist/cli/args.js", import.meta.url).href);
    for (const query of ["--sample-option", "@References explain this material"]) {
      const spec = buildPiLaunchSpec(parseArgs(["run", "--mode", "ask", "--query", query]), { cwd: process.cwd(), homeDir: "/tmp/no-seekbrain-user-config", env: {} });
      const parsed = parsePiArgs(spec.args.slice(1));
      expect(parsed.messages).toHaveLength(1); expect(parsed.messages[0].trim()).toBe(query);
      expect(parsed.fileArgs).toEqual([]); expect(parsed.unknownFlags.has("sample-option")).toBe(false);
    }
  });
  it("launches a plain user message without an entry asset or template", () => {
    const spec = buildPiLaunchSpec(parseArgs(["run", "--mode", "ask", "--query", "Explain this result"]), { cwd: process.cwd(), homeDir: "/tmp/no-seekbrain-user-config", env: {} });
    expect(spec.args.at(-1)).toBe("Explain this result"); expect(spec.args).not.toContain("--prompt-template");
    expect(spec.paths).not.toHaveProperty("entryPrompt"); expect(spec.args.some((arg: string) => arg.includes("/entry"))).toBe(false);
    expect(spec.env.SEEKBRAIN_INTERACTION_MODE).toBe("ask");
  });
});
