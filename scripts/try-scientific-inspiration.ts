import { resolve } from "node:path";
import { createScientificInspirationTool, type ScientificInspirationIntent } from "../src/extension/scientific-inspiration-tool.ts";
import { TrustedPublisherWebSearchClient } from "../src/extension/public-web-search.ts";

const intent = String(process.argv[2] || "remote_analogy") as ScientificInspirationIntent;
const targetAbstraction = String(process.argv[3]
  || "many heterogeneous neural measurements share a dominant latent global component while meaningful information may survive in residual subspaces");
const currentHypothesis = String(process.argv[4]
  || "a shared movement or arousal state coordinates regional decoders, while condition-invariant residual geometry isolates task-specific neural representations");
const ledgerPath = resolve(process.argv[5] || "/tmp/seekbrain-scientific-inspiration-live.json");
const tool = createScientificInspirationTool({
  cwd: process.cwd(),
  ledgerPath,
  webSearch: new TrustedPublisherWebSearchClient({ monthsBack: 24 }),
  maxDistinctQueries: 3,
});

const result = await tool.execute("standalone-trial", {
  intent,
  target_abstraction: targetAbstraction,
  current_hypothesis: currentHypothesis,
});
process.stdout.write(`${result.content?.[0]?.text || JSON.stringify(result)}\n`);
