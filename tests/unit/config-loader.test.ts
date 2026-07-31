import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ConfigLoader, ConfigValidationError, literatureCapabilities, literatureQueryConfig, resolveLiteratureProvider } from "../../src/core/index.ts";

describe("ConfigLoader", () => {
  it("applies defaults, user, project, environment, constructor and runtime precedence", async () => {
    const root = await mkdtemp(join(tmpdir(), "seekbrain-config-"));
    try {
      const userPath = join(root, "user.yaml");
      const projectPath = join(root, "project.yaml");
      await writeFile(userPath, [
        "workflow:",
        "  seekbrain:",
        "    image_refine: false",
        "agents:",
        "  seekbrain:",
        "    model: user-model",
      ].join("\n"));
      await writeFile(projectPath, [
        "workflow:",
        "  seekbrain:",
        "    image_refine: true",
        "agents:",
        "  seekbrain:",
        "    model: project-model",
      ].join("\n"));

      const config = await new ConfigLoader({
        userConfigPath: userPath,
        projectConfigPath: projectPath,
        env: { SEEKBRAIN_DATA_ROOT: "/env/data" },
        overrides: { agents: { seekbrain: { model: "constructor-model" } } },
      }).load({ agents: { seekbrain: { model: "runtime-model" } } });

      expect(config.workflow.seekbrain.image_refine).toBe(true);
      expect(config.paths.data_root).toBe("/env/data");
      expect(config.agents.seekbrain.model).toBe("runtime-model");
      expect(config.workflow.seekbrain.deep_research).toBe(false);
      expect(config.workflow.seekbrain.research_planning).toBe(true);
      expect(config.workflow.seekbrain.research_planning_strategy).toBe("standard");
      expect(config.workflow.seekbrain.research_survey).toBe(true);
      expect(config.modules.targeted_skill).toMatchObject({ relevance_threshold: 0.5, top_k: 1 });
      expect((config.modules.targeted_skill as any).compatibility).toMatchObject({ candidate_pool_size: 10, skill_top_k: 2, prefer_repository: true, paper_only_fallback: true });
      expect(config.workflow.seekbrain.report.pdf).toMatchObject({ enabled: true, command: "seekbrain-pdf", timeout_seconds: 120 });
      expect(config.workflow.seekbrain.human_review).toEqual({
        enabled: true,
        gates: { plan: true, code: false, validate: false, interpret: false },
      });
      expect(Object.isFrozen(config.workflow.seekbrain.human_review.gates)).toBe(true);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("rejects invalid values after merging", async () => {
    await expect(new ConfigLoader({
      overrides: { workflow: { seekbrain: { image_refine: "sometimes" } } },
    }).load()).rejects.toBeInstanceOf(ConfigValidationError);
    await expect(new ConfigLoader({
      overrides: { modules: { targeted_skill: { relevance_threshold: 1.1 } } },
    }).load()).rejects.toBeInstanceOf(ConfigValidationError);
    await expect(new ConfigLoader({
      overrides: { workflow: { seekbrain: { research_planning_strategy: "experimental" } } },
    }).load()).rejects.toBeInstanceOf(ConfigValidationError);
  });

  it("allows Research Planning to be disabled explicitly", async () => {
    const config = await new ConfigLoader({
      overrides: { workflow: { seekbrain: { research_planning: false } } },
    }).load();
    expect(config.workflow.seekbrain.research_planning).toBe(false);
  });

  it("selects Creative plan construction independently from Research Planning enablement", async () => {
    const config = await new ConfigLoader({
      overrides: { workflow: { seekbrain: { research_planning_strategy: "creative" } } },
    }).load();
    expect(config.workflow.seekbrain.research_planning).toBe(true);
    expect(config.workflow.seekbrain.research_planning_strategy).toBe("creative");
  });

  it("configures Research Survey independently from Deep Research", async () => {
    const config = await new ConfigLoader({
      overrides: {
        workflow: { seekbrain: { research_survey: false, deep_research: true } },
        agents: {
          seekbrain_survey: { rag: { base_url: "http://survey.example", top_k: 7 } },
          seekbrain_deep_research: { rag: { base_url: "http://deep.example", top_k: 2 } },
        },
      },
    }).load();
    expect(config.workflow.seekbrain.research_survey).toBe(false);
    expect(config.workflow.seekbrain.deep_research).toBe(true);
    expect(config.agents.seekbrain_survey.rag).toMatchObject({ base_url: "http://survey.example", top_k: 7 });
    expect(config.agents.seekbrain_deep_research.rag).toMatchObject({ base_url: "http://deep.example", top_k: 2 });
  });

  it("gates literature capabilities without breaking legacy AILab URLs", () => {
    const none = {
      literature: { paper_source: "none" },
      workflow: { seekbrain: { research_survey: true, deep_research: true, targeted_skill_match: true, targeted_skill_generate: true } },
      agents: { seekbrain_survey: { rag: { base_url: "http://legacy.example" } } },
    };
    expect(resolveLiteratureProvider(none)).toBe("none");
    expect(literatureCapabilities(none)).toMatchObject({ available: false, research_survey: false, deep_research: false, targeted_skill_match: true, targeted_skill_generate: false });

    const legacy = {
      literature: { providers: {} },
      workflow: { seekbrain: { research_survey: true, deep_research: true, targeted_skill_match: true, targeted_skill_generate: true } },
      agents: { seekbrain_survey: { rag: { base_url: "http://legacy.example" } } },
    };
    expect(resolveLiteratureProvider(legacy)).toBe("ailab_rag");
    expect(literatureCapabilities(legacy)).toMatchObject({ available: true, research_survey: true, deep_research: true, targeted_skill_generate: true });
  });

  it("passes only compatibility provider settings without rewriting the frozen AILab options", () => {
    expect(literatureQueryConfig({
      literature: {
        paper_source: "semantic_scholar",
        credential_store: "/protected/credentials.json",
        providers: { semantic_scholar: { base_url: "https://api.example/v1", credential_ref: "semantic_default", timeout_seconds: 45, query_variant_count: 2 } },
      },
    }, { top_k: 4 })).toMatchObject({
      paper_source: "semantic_scholar",
      base_url: "https://api.example/v1",
      credential_ref: "semantic_default",
      credential_store: "/protected/credentials.json",
      timeout: 45,
      query_variant_count: 2,
      top_k: 4,
    });

    expect(literatureQueryConfig({
      literature: { paper_source: "ailab_rag", providers: { ailab_rag: { base_url: "http://ailab.example", top_k: 99 } } },
    }, { top_k: 4, require_github: true })).toMatchObject({ top_k: 4, require_github: true, base_url: "http://ailab.example" });

    expect(literatureQueryConfig({
      literature: { paper_source: "pubmed", providers: { pubmed: { base_url: "https://eutils.example", credential_ref: "pubmed_default", tool: "seekbrain", email: "user@example.org" } } },
    })).toMatchObject({ paper_source: "pubmed", credential_ref: "pubmed_default", tool: "seekbrain", email: "user@example.org" });
  });
});
