import { readdir, readFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { inferRecipeAccepts, inferSemanticTerms, isExecutableRecipe, loadRecipeCard, type RecipeCard } from "../targeted-skill/recipe-card.ts";

interface IndexedRecipe {
  path: string;
  card: RecipeCard;
  document: string;
}

export interface LocalRecipeSearchResult {
  path: string;
  card: RecipeCard;
}

const STOPWORDS = new Set([
  "a", "an", "the", "to", "of", "in", "on", "for", "with", "and", "or", "from", "by", "as", "is", "are",
  "be", "use", "using", "data", "dataset", "analysis", "analyze", "analyse", "neuroscience", "reproduction",
]);

function tokens(value: string): string[] {
  return value.toLowerCase().replace(/[_-]+/g, " ").match(/[\p{L}\p{N}]+/gu)
    ?.filter((token) => token.length > 1 && !STOPWORDS.has(token)) || [];
}

function meaningfulAliases(card: RecipeCard): string[] {
  return card.aliases.filter((alias) => tokens(alias).length > 0);
}

function retrievalDocument(card: RecipeCard): string {
  const repeated = (values: string[], count: number) => Array.from({ length: count }, () => values).flat();
  return [
    card.recipe_id,
    ...repeated([card.summary], 3),
    ...repeated([...card.does, ...card.evidence_for], 4),
    ...repeated([...card.accepts.requires, ...card.accepts.observation_units], 3),
    ...repeated(card.produces, 2),
    ...meaningfulAliases(card),
    ...card.use_when,
  ].join(" ");
}

async function recipeDirectories(root: string, maximumDepth = 5): Promise<string[]> {
  const queue: Array<{ path: string; depth: number }> = [{ path: resolve(root), depth: 0 }];
  const found: string[] = [];
  while (queue.length) {
    const current = queue.shift()!;
    let entries;
    try { entries = await readdir(current.path, { withFileTypes: true }); }
    catch { continue; }
    if (entries.some((entry) => entry.isFile() && entry.name === "SKILL.md")) {
      found.push(current.path);
      continue;
    }
    if (current.depth >= maximumDepth) continue;
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith(".") || ["node_modules", "references", "scripts", "from_rag"].includes(entry.name)) continue;
      queue.push({ path: join(current.path, entry.name), depth: current.depth + 1 });
    }
  }
  return found;
}

function bm25(query: string, documents: string[]): number[] {
  const queryTokens = [...new Set(tokens(query))];
  const tokenized = documents.map(tokens);
  const averageLength = tokenized.reduce((sum, document) => sum + document.length, 0) / Math.max(1, tokenized.length);
  const documentFrequency = new Map<string, number>();
  for (const document of tokenized) {
    for (const token of new Set(document)) documentFrequency.set(token, (documentFrequency.get(token) || 0) + 1);
  }
  return tokenized.map((document) => {
    const frequencies = new Map<string, number>();
    for (const token of document) frequencies.set(token, (frequencies.get(token) || 0) + 1);
    return queryTokens.reduce((score, token) => {
      const frequency = frequencies.get(token) || 0;
      if (!frequency) return score;
      const frequencyInDocuments = documentFrequency.get(token) || 0;
      const inverseFrequency = Math.log(1 + (documents.length - frequencyInDocuments + 0.5) / (frequencyInDocuments + 0.5));
      const denominator = frequency + 1.2 * (1 - 0.75 + 0.75 * document.length / Math.max(1, averageLength));
      return score + inverseFrequency * (frequency * 2.2) / denominator;
    }, 0);
  });
}

export class LocalRecipeIndex {
  #recipes?: Promise<IndexedRecipe[]>;

  constructor(readonly resolveRoots: () => Promise<string[]>) {}

  private async load(): Promise<IndexedRecipe[]> {
    this.#recipes ??= (async () => {
      const roots = [...new Set((await this.resolveRoots()).map((root) => resolve(root)))];
      const directories = (await Promise.all(roots.map((root) => recipeDirectories(root)))).flat();
      const byId = new Map<string, IndexedRecipe>();
      for (const path of directories) {
        try {
          const skillText = await readFile(join(path, "SKILL.md"), "utf8");
          const card = await loadRecipeCard(path, skillText);
          if (!isExecutableRecipe(card) || card.status === "watchlist" || card.source.type === "rag") continue;
          const id = card.recipe_id || basename(path);
          if (!byId.has(id)) byId.set(id, { path, card, document: retrievalDocument(card) });
        } catch { /* Ignore malformed or incomplete local Recipe directories. */ }
      }
      return [...byId.values()];
    })();
    return this.#recipes;
  }

  async search(query: string, contextText: string, limit: number): Promise<LocalRecipeSearchResult[]> {
    const recipes = await this.load();
    const requestedSpecies = inferRecipeAccepts({ text: `${query} ${contextText}` }).species;
    const eligible = recipes.filter(({ card }) => {
      const acceptedSpecies = card.accepts.species;
      return !requestedSpecies.length || !acceptedSpecies.length || requestedSpecies.some((species) => acceptedSpecies.includes(species));
    });
    const lexical = bm25(query, eligible.map((recipe) => recipe.document));
    const querySemantics = new Set(inferSemanticTerms(query));
    return eligible.map((recipe, index) => {
      const capabilities = new Set([...recipe.card.does, ...recipe.card.evidence_for]);
      const products = new Set(recipe.card.produces);
      const semanticScore = [...querySemantics].reduce((score, term) => (
        score + (capabilities.has(term) ? 4 : products.has(term) ? 2 : 0)
      ), 0);
      return { recipe, score: lexical[index] + semanticScore };
    })
      .filter((item) => item.score > 0)
      .sort((left, right) => right.score - left.score || left.recipe.path.localeCompare(right.recipe.path))
      .slice(0, Math.max(1, limit))
      .map(({ recipe }) => ({ path: recipe.path, card: recipe.card }));
  }
}
