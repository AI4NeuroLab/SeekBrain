import { readdir, readFile, writeFile } from "node:fs/promises";
import { basename, dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseYaml } from "yaml";

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const recipesRoot = join(projectRoot, "recipes");
const expectedClassifications = ["Multimodal-joint-analysis", "Single-modality"];

function frontmatter(text) {
  if (!text.startsWith("---")) return {};
  const end = text.indexOf("\n---", 3);
  if (end < 0) return {};
  try {
    return parseYaml(text.slice(3, end)) || {};
  } catch {
    return {};
  }
}

async function discover(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  if (entries.some((entry) => entry.isFile() && entry.name === "SKILL.md")) return [directory];
  const nested = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (!entry.isDirectory() || entry.name.startsWith(".") || entry.name === ".cache") continue;
    nested.push(...await discover(join(directory, entry.name)));
  }
  return nested;
}

const rootEntries = await readdir(recipesRoot, { withFileTypes: true });
const classifications = rootEntries
  .filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
  .map((entry) => entry.name)
  .sort();
if (JSON.stringify(classifications) !== JSON.stringify([...expectedClassifications].sort())) {
  throw new Error(`recipes must contain exactly: ${expectedClassifications.join(", ")}`);
}

const directories = await discover(recipesRoot);
const recipes = [];
const names = new Set();
for (const directory of directories) {
  const document = await readFile(join(directory, "SKILL.md"), "utf8");
  const metadata = frontmatter(document);
  const name = String(metadata.name || basename(directory)).trim();
  const description = String(metadata.description || "").trim().replace(/\s+/g, " ");
  if (!name || !description) throw new Error(`SKILL.md requires name and description: ${directory}`);
  if (name !== basename(directory)) throw new Error(`Recipe name must match its folder: ${directory}`);
  if (names.has(name)) throw new Error(`duplicate recipe name: ${name}`);
  names.add(name);
  const parts = relative(recipesRoot, directory).split(/[\\/]+/);
  if (parts.length < 3) throw new Error(`recipe must be nested under classification/category: ${directory}`);
  recipes.push({ classification: parts[0], category: parts.slice(1, -1).join(" / "), name, description });
}

recipes.sort((a, b) =>
  a.classification.localeCompare(b.classification)
  || a.category.localeCompare(b.category)
  || a.name.localeCompare(b.name));

const lines = [
  "# Analysis Recipe Index",
  "",
  "> Bundled with SeekBrain",
  `> Total recipes: ${recipes.length}`,
  "",
];
for (const classification of expectedClassifications) {
  lines.push(`## ${classification}`, "");
  const categories = [...new Set(recipes.filter((recipe) => recipe.classification === classification).map((recipe) => recipe.category))];
  for (const category of categories) {
    lines.push(`### ${category}`, "");
    for (const recipe of recipes.filter((item) => item.classification === classification && item.category === category)) {
      lines.push(`#### \`${recipe.name}\``, "", recipe.description, "");
    }
  }
}

await writeFile(join(recipesRoot, "INDEX.md"), `${lines.join("\n").trimEnd()}\n`, "utf8");
console.log(`Generated recipes/INDEX.md for ${recipes.length} recipes.`);
