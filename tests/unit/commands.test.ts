import { describe, expect, it } from "vitest";
import { registerSaveSkillCommand } from "../../src/extension/commands/save-skill-command.ts";
import { registerShowCommand } from "../../src/extension/commands/show-command.ts";
import { registerSystemCommands } from "../../src/extension/commands/system-commands.ts";
import { registerReportCommand } from "../../src/extension/commands/report-command.ts";

function commandApi() {
  const commands = new Map<string, any>();
  const messages: any[] = [];
  return {
    commands,
    messages,
    api: {
      registerCommand(name: string, command: any) { commands.set(name, command); },
      sendMessage(message: any) { messages.push(message); },
      getAllTools: () => [{ name: "seekbrain_run_start" }, { name: "seekbrain_research_start" }],
      getActiveTools: () => ["seekbrain_run_start"],
    },
  };
}

describe("Pi slash commands", () => {
  it("registers config reload and tool diagnostics", async () => {
    const item = commandApi();
    let invalidated = false;
    registerSystemCommands(item.api, {
      workflowRoot: "/root",
      invalidateConfig: () => { invalidated = true; },
      loadConfig: async () => ({ workflow: { seekbrain: { deep_research: true } } }),
    });
    await item.commands.get("seekbrain-reload-config").handler("", { cwd: "/project" });
    await item.commands.get("seekbrain-tools").handler();
    expect(invalidated).toBe(true);
    expect(JSON.parse(item.messages[0].content)).toMatchObject({ reloaded: true, workflow: { seekbrain: { deep_research: true } } });
    expect(JSON.parse(item.messages[1].content)).toMatchObject({ has_seekbrain_run_start: true, active_seekbrain_research_start: false });
  });

  it("renders stored research in headless show mode", async () => {
    const item = commandApi();
    registerShowCommand(item.api, {
      getActiveRunDir: () => undefined,
      readJson: async () => ({ runs: {} }),
      resolveRun: async () => ({ state: { deep_research_context: "[Deep Research Background]\nFinding", deep_research_sources: [{ title: "Paper", pub_time: "2024", text: "Evidence" }] } }),
      loadRunState: async () => ({}),
      runIndexPath: () => "index.json",
    });
    await item.commands.get("seekbrain-show").handler("research run-1", { cwd: "/project", hasUI: false, mode: "rpc" });
    expect(item.messages[0]).toMatchObject({ customType: "seekbrain-research", display: true });
    expect(item.messages[0].content).toContain("Finding");
    expect(item.messages[0].content).toContain("Paper");
  });

  it("creates a headless save-skill proposal without authoring before approval", async () => {
    const item = commandApi();
    const writes: any[] = [];
    let writerCalled = false;
    let capturedPrompt = "";
    const run = { runId: "run-1", runDir: "/run", state: { run_id: "run-1", question: "question", code: { code_files: [{ path: "analysis.py" }], statistics: { n: 10 } }, plan: { summary: "plan" } } };
    registerSaveSkillCommand(item.api, {
      workflowRoot: "/project",
      getActiveRunDir: () => undefined,
      loadConfig: async () => ({ modules: {} }),
      saveSkillEnabled: () => true,
      readJson: async () => ({}),
      writeJson: async (path, value) => { writes.push([path, value]); },
      resolveRun: async () => run,
      loadRunState: async () => run,
      runIndexPath: () => "index.json",
      readRolePrompt: async () => "skill namer role",
      runNamer: async ({ prompt }) => {
        capturedPrompt = prompt;
        return { ok: true, result: { stage: "ns ana", species: "mouse", modality: "calcium", method: "glm", target: "neuron", rationale: "reuse", proposed_description: "description", triggers: [], tags: [] } };
      },
      writeSkill: async () => { writerCalled = true; return {}; },
      updateState: async () => undefined,
      appendEvent: async () => undefined,
    });
    await item.commands.get("seekbrain-save-recipe").handler("run-1", { cwd: "/project", hasUI: false, sessionManager: { getBranch: () => [] }, ui: { notify() {} } });
    expect(capturedPrompt).toContain("Required final tool: finalize_smmt");
    expect(writerCalled).toBe(false);
    expect(writes[0][0]).toBe("/run/save_skill_proposal.json");
    expect(writes[0][1]).toMatchObject({ folder_name: "ns_ana-mouse-calcium-glm-neuron" });
    expect(item.messages[0].content).toContain("--yes");
  });

  it("collects an explicit report selection before generating", async () => {
    const item = commandApi();
    const calls: any[] = [];
    registerReportCommand(item.api, {
      getActiveProjectPath: () => "/project",
      listAvailable: async () => ({ available: [
        { evidence_id: "ROUND:1", question: "first" },
        { evidence_id: "SQ1-T1:R1", question: "task" },
      ] }),
      generate: async (input) => {
        calls.push(input);
        return { ok: true, title: "Report", report_path: "/project/reports/report/report.md", pdf_generated: false };
      },
    });
    const choices = ["[ ] ROUND:1 — first", "[ ] SQ1-T1:R1 — task", "Generate report from 2 selected results"];
    const widgets: any[] = [];
    const statuses: any[] = [];
    await item.commands.get("seekbrain-report").handler("", {
      ui: {
        select: async () => choices.shift(),
        notify() {},
        setWidget: (...args: any[]) => widgets.push(args),
        setStatus: (...args: any[]) => statuses.push(args),
      },
    });
    expect(calls[0]).toMatchObject({ projectPath: "/project", selectedEvidence: ["ROUND:1", "SQ1-T1:R1"] });
    expect(calls[0].onProgress).toEqual(expect.any(Function));
    expect(item.messages[0]).toMatchObject({ customType: "seekbrain-report", display: true });
    expect(widgets[0][1]).toContain("○ Report Agent · generating");
    expect(widgets.at(-1)).toEqual(["seekbrain-report-progress", undefined]);
    expect(statuses.at(-1)).toEqual(["seekbrain-report", undefined]);
  });
});
