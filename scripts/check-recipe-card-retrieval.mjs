import assert from "node:assert/strict";
import { createJiti } from "jiti";
import { readFile, readdir } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const fmriRoot = process.argv.find((item) => item.startsWith("--fmri-root="))?.slice("--fmri-root=".length)
  || "/mnt/shared-storage-gpfs2/ai4neuro-share/zhuyuqing/fmri-neuroimaging-recipes";
const jiti = createJiti(import.meta.url);
const { buildRecipeQuery } = await jiti.import("../src/targeted-skill/recipe-card.ts");
const { rankRecipes } = await jiti.import("../src/targeted-skill/recipe-discovery.ts");

async function recipeDirectories(root) {
  const entries = await readdir(root, { withFileTypes: true });
  if (entries.some((entry) => entry.isFile() && entry.name === "SKILL.md")) return [root];
  const found = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith(".") || ["references", "scripts"].includes(entry.name)) continue;
    found.push(...await recipeDirectories(join(root, entry.name)));
  }
  return found;
}

async function loadCard(directory) {
  for (const filename of ["recipe-card.json", "recipe-card.draft.json"]) {
    try { return JSON.parse(await readFile(join(directory, filename), "utf8")); }
    catch {}
  }
  throw new Error(`RecipeCard not found: ${directory}`);
}

const directories = [
  ...await recipeDirectories(join(projectRoot, "recipes")),
  ...await recipeDirectories(resolve(fmriRoot)),
];
const recipes = [];
for (const directory of directories) {
  const card = await loadCard(directory);
  recipes.push({ name: card.recipe_id || basename(directory), path: directory, description: card.summary, text: card.summary, card });
}

const fmriIds = new Set([
  "brain-connectivity-modeler", "fmri-glm-analysis-guide", "fmri-preprocessing-pipeline-guide", "fmri-task-design-guide",
  "fmriprep", "netneurotools-guide", "neural-decoding-analysis", "pycortex-guide",
]);
const cases = [
  { query: "BIDS fMRI preprocessing with confounds and output spaces", expected: "fmriprep" },
  { query: "fMRI GLM design matrix contrasts and group inference", expected: "fmri-glm-analysis-guide" },
  { query: "cortical flatmap visualization of fMRI statistical maps", expected: "pycortex-guide" },
  { query: "fMRI MVPA decoding with leakage-safe cross-validation", expected: "neural-decoding-analysis" },
  { query: "mouse spike visual stimulus SVM classification", expected: "ns_multi-mouse-spike_visual_stim-svm-performance" },
  { query: "zebrafish calcium regional functional connectivity matrix", expected: "ns_ana-zebrafish-ca-pearson-fc_matrix" },
  { query: "mouse temporal gene expression trajectory", expected: "ns_ana-mouse-omics-hierarchical_clustering-scatter_type_temporal_trajectory" },
  { query: "spike train PSTH analysis", forbidden: fmriIds },
  { query: "gene expression clustering heatmap", forbidden: fmriIds },
];

const results = [];
for (const item of cases) {
  const ranked = rankRecipes(buildRecipeQuery({ question: item.query }), recipes, { poolSize: 5 });
  const top = ranked.map((entry) => entry.card.recipe_id);
  if (item.expected) assert.equal(top[0], item.expected, `${item.query}: expected ${item.expected}, got ${top[0]}`);
  if (item.forbidden) assert(!top.some((id) => item.forbidden.has(id)), `${item.query}: incompatible fMRI Recipe entered top 5: ${top.join(", ")}`);
  results.push({ query: item.query, top });
}

console.log(JSON.stringify({ recipes: recipes.length, cases: results.length, passed: results.length, results }, null, 2));
