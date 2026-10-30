import assert from "node:assert/strict";
import { createJiti } from "jiti";
import { readFile, readdir } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
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

const directories = await recipeDirectories(join(projectRoot, "recipes"));
const recipes = [];
for (const directory of directories) {
  const card = await loadCard(directory);
  recipes.push({ name: card.recipe_id || basename(directory), path: directory, description: card.summary, text: card.summary, card });
}

const cases = [
  { query: "mouse spike visual stimulus SVM classification", expected: "ns_multi-mouse-spike_visual_stim-svm-performance" },
  { query: "zebrafish calcium regional functional connectivity matrix", expected: "ns_ana-zebrafish-ca-pearson-fc_matrix" },
  { query: "mouse temporal gene expression trajectory", expected: "ns_ana-mouse-omics-hierarchical_clustering-scatter_type_temporal_trajectory" },
  { query: "spike train PSTH analysis", forbiddenModality: "fmri" },
  { query: "gene expression clustering heatmap", forbiddenModality: "fmri" },
];

const results = [];
for (const item of cases) {
  const ranked = rankRecipes(buildRecipeQuery({ question: item.query }), recipes, { poolSize: 5 });
  const top = ranked.map((entry) => entry.card.recipe_id);
  if (item.expected) assert.equal(top[0], item.expected, `${item.query}: expected ${item.expected}, got ${top[0]}`);
  if (item.forbiddenModality) assert(!ranked.some(entry => entry.card.primary_modalities.includes(item.forbiddenModality)), `${item.query}: incompatible modality entered top 5: ${top.join(", ")}`);
  results.push({ query: item.query, top });
}

console.log(JSON.stringify({ recipes: recipes.length, cases: results.length, passed: results.length, results }, null, 2));
