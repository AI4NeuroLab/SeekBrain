import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { ConfigLoader } from "../src/core/config/config-loader.ts";
import { literatureQueryConfig } from "../src/core/config/literature-config.ts";
import { PaperRagClient } from "../src/targeted-skill/rag-client.ts";

const FIXED_QUERY = "zebrafish molecular subtype classification";

const loader = new ConfigLoader({
  defaultConfigPath: resolve("config/default.yaml"),
  userConfigPath: process.env.SEEKBRAIN_USER_CONFIG
    || join(homedir(), ".config", "seekbrain", "config.yaml"),
  projectConfigPath: process.env.SEEKBRAIN_CONFIG
    || resolve("seekbrain.config.yaml"),
  env: process.env,
});

const config = await loader.load();
const ragConfig = literatureQueryConfig(
  config as Record<string, any>,
  config.modules?.targeted_skill as Record<string, any> | undefined,
);

const result = await new PaperRagClient().query({
  question: FIXED_QUERY,
  top_k: 2,
  require_github: true,
  source_char_limit: 2_500,
  rag_base_url: String(ragConfig.rag_base_url || ragConfig.base_url || ""),
  rag_timeout: Number(ragConfig.rag_timeout || ragConfig.timeout || 600),
});

if (!result.ok) {
  process.stderr.write(`${JSON.stringify({
    ok: false,
    query: FIXED_QUERY,
    error: result.error,
    warnings: result.warnings || [],
  }, null, 2)}\n`);
  process.exitCode = 1;
} else {
  const papers = (Array.isArray(result.sources) ? result.sources : [])
    .filter((source: Record<string, any>) => Array.isArray(source.github_links) && source.github_links.length > 0)
    .slice(0, 2)
    .map((source: Record<string, any>) => ({
      source_id: String(source.source_id || ""),
      title: String(source.title || ""),
      publication_time: source.pub_time || null,
      journal: source.magazine || null,
      repositories: source.github_links.map(String),
      abstract_excerpt: String(source.text || "").slice(0, 1_500),
    }));

  process.stdout.write(`${JSON.stringify({
    ok: true,
    query: FIXED_QUERY,
    requested_top_k: 2,
    require_github: true,
    returned_count: papers.length,
    papers,
    warnings: result.warnings || [],
  }, null, 2)}\n`);
}
