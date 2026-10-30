import { describe, expect, it } from "vitest";
import { registerSaveSkillCommand } from "../../src/extension/commands/save-skill-command.ts";
import { registerShowCommand, skillFullMarkdown } from "../../src/extension/commands/show-command.ts";
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
      getAllTools: () => [{ name: "seekbrain_plan_generate" }, { name: "seekbrain_research_start" }],
      getActiveTools: () => ["seekbrain_plan_generate"],
    },
  };
}

describe("Pi slash commands", () => {
  it("labels composed Recipe sets as matches in the full recipe view", () => {
    const markdown = skillFullMarkdown({
      targeted_skill: "RECIPE: rna-classifier\n\nRECIPE: annotated-heatmap",
      targeted_skill_result: { source: "composed_recipe_set" },
    });
    expect(markdown).toContain("Analysis Recipe — composed from local and RAG candidates");
    expect(markdown).not.toContain("no match");
  });

  it("registers config reload and tool diagnostics", async () => {
    const item = commandApi();
    let invalidated = false;
    registerSystemCommands(item.api, {
      workflowRoot: "/root",
      invalidateConfig: () => { invalidated = true; },
      loadConfig: async () => ({ workflow: { seekbrain: { deep_research: { max_rounds: 3 } } } }),
    });
    await item.commands.get("seekbrain-reload-config").handler("", { cwd: "/project" });
    await item.commands.get("seekbrain-tools").handler();
    expect(invalidated).toBe(true);
    expect(JSON.parse(item.messages[0].content)).toMatchObject({ reloaded: true, workflow: { seekbrain: { deep_research: { max_rounds: 3 } } } });
    expect(JSON.parse(item.messages[1].content)).toMatchObject({ has_seekbrain_plan_generate: true, active_seekbrain_research_start: false });
  });

  it("renders stored research in headless show mode", async () => {
    const item = commandApi();
    registerShowCommand(item.api, {
      getActiveRunDir: () => undefined,
      readJson: async () => ({ runs: {} }),
      resolveRun: async () => ({ state: { deep_research: { round: 1, phase: "complete", rounds: [{ number: 1, decision: { reason: "Finding" }, report: { original_path: "report.md" } }] } } }),
      loadRunState: async () => ({}),
      runIndexPath: () => "index.json",
    });
    await item.commands.get("seekbrain-show").handler("research run-1", { cwd: "/project", hasUI: false, mode: "rpc" });
    expect(item.messages[0]).toMatchObject({ customType: "seekbrain-research", display: true });
    expect(item.messages[0].content).toContain("Finding");
    expect(item.messages[0].content).toContain("report.md");
  });

  it("creates a headless save-skill proposal without authoring before approval", async () => {
    const item = commandApi();
    const writes: any[] = [];
    let writerCalled = false;
    let capturedPrompt = "";
    const run = { runId: "run-1", runDir: "/run", state: { run_id: "run-1", question: "question", code_attempt: 1, validation: { pass: true, validated_code_attempt: 1 }, code: { code_files: [{ path: "analysis.py" }], statistics: { n: 10 } }, plan: { summary: "plan" } } };
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

  it("generates a Research Planning report from selected task rounds", async () => {
    const item = commandApi();
    const calls: any[] = [];
    registerReportCommand(item.api, {
      getActiveProjectPath: () => "/project",
      catalog: async () => ({
        available: true, research_goal: "goal", project_dir: "/project", task_count: 1,
        recommended_evidence_ids: ["SQ1-T1:R2"], eligible_evidence_ids: ["SQ1-T1:R1", "SQ1-T1:R2"],
        subquestions: [{ subquestion_id: "SQ1", title: "Question", tasks: [{ task_id: "SQ1-T1", title: "Task", rounds: [{ evidence_id: "SQ1-T1:R1", round_number: 1 }, { evidence_id: "SQ1-T1:R2", round_number: 2 }] }] }],
      }),
      generate: async (input) => {
        calls.push(input);
        return { ok: true, title: "Report", report_path: "/project/reports/report/report.md", pdf_generated: false };
      },
    });
    const widgets: any[] = [];
    const statuses: any[] = [];
    await item.commands.get("seekbrain-report").handler("/project SQ1-T1:R1 SQ1-T1:R2", {
      ui: {
        notify() {},
        setWidget: (...args: any[]) => widgets.push(args),
        setStatus: (...args: any[]) => statuses.push(args),
      },
    });
    expect(calls[0]).toMatchObject({ projectPath: "/project", selectedEvidenceIds: ["SQ1-T1:R1", "SQ1-T1:R2"] });
    expect(calls[0].onProgress).toEqual(expect.any(Function));
    expect(item.messages[0]).toMatchObject({ customType: "seekbrain-report", display: true });
    expect(widgets[0][1]).toContain("○ Report Agent · hierarchical synthesis");
    expect(widgets.at(-1)).toEqual(["seekbrain-report-progress", undefined]);
    expect(statuses.at(-1)).toEqual(["seekbrain-report", undefined]);
  });

  it("renders one hierarchical SQ-task-round card and allows multiple rounds from one task", async () => {
    const item = commandApi();
    const calls: any[] = [];
    registerReportCommand(item.api, {
      getActiveProjectPath: () => "/project",
      catalog: async () => ({
        available: true, project_dir: "/project", task_count: 1,
        recommended_evidence_ids: ["SQ1-T1:R2"], eligible_evidence_ids: ["SQ1-T1:R1", "SQ1-T1:R2"],
        subquestions: [{ subquestion_id: "SQ1", title: "Inter-individual network variation", tasks: [{ task_id: "SQ1-T1", title: "Quantify FC heterogeneity", rounds: [{ evidence_id: "SQ1-T1:R1", round_number: 1 }, { evidence_id: "SQ1-T1:R2", round_number: 2 }] }] }],
      }),
      generate: async (input) => { calls.push(input); return { ok: true, report_path: "/project/report.md", pdf_generated: false, task_count: 1, round_count: 2, report_scope: "complete" }; },
    });
    let renderedCard = "";
    await item.commands.get("seekbrain-report").handler("", {
      mode: "tui",
      ui: {
        custom: async (factory: any) => await new Promise((resolve) => {
          const component = factory({ requestRender() {} }, { fg: (_name: string, value: string) => value, bold: (value: string) => value }, undefined, resolve);
          renderedCard = component.render(92).join("\n");
          component.handleInput(" ");
          component.handleInput("g");
        }),
        notify() {}, setWidget() {}, setStatus() {},
      },
    });
    expect(renderedCard).toContain("SQ1 · Inter-individual network variation");
    expect(renderedCard).toContain("SQ1-T1 · Quantify FC heterogeneity");
    expect(renderedCard).toContain("Round 1");
    expect(renderedCard).toContain("Round 2");
    expect(calls[0].selectedEvidenceIds).toEqual(["SQ1-T1:R2", "SQ1-T1:R1"]);
  });
});
