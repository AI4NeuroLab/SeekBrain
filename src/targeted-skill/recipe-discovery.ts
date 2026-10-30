import type { RecipeCard, RecipeQuery, RecipeRequirement, RecipeRole, RecipeSelection, RecipeSet } from "./recipe-card.ts";
import { inferSemanticTerms, isExecutableRecipe, recipeRetrievalText } from "./recipe-card.ts";

export interface DiscoverableRecipe {
  name: string;
  path: string;
  description: string;
  text: string;
  card: RecipeCard;
}

export interface RankedRecipe extends DiscoverableRecipe {
  score: number;
  lexical_score: number;
  covers: string[];
  compatibility: "compatible" | "unknown";
}

const STOPWORDS = new Set([
  "a", "an", "the", "to", "of", "in", "on", "for", "with", "and", "or", "from", "by", "at", "as", "is", "are", "be", "into", "over", "back",
  "how", "what", "use", "using", "data", "dataset", "analysis", "analyze", "analyse",
]);

function basicTokens(value: string): string[] {
  return value.toLowerCase().replace(/[_-]+/g, " ").match(/[\p{L}\p{N}]+/gu)?.filter((token) => token.length > 1 && !STOPWORDS.has(token)) || [];
}

function tokens(value: string): string[] {
  return [...new Set(basicTokens(value))];
}

function intersects(left: string[], right: string[]): boolean {
  const values = new Set(left);
  return right.some((value) => values.has(value));
}

export function recipeCompatibility(query: RecipeQuery, card: RecipeCard): { compatible: boolean; known: boolean; conflicts: string[] } {
  const conflicts: string[] = [];
  const requested = query.accepts.species;
  const accepted = card.accepts.species;
  const known = requested.length > 0 && accepted.length > 0;
  if (known && !intersects(requested, accepted)) conflicts.push(`species: requested ${requested.join(", ")}; recipe accepts ${accepted.join(", ")}`);
  return { compatible: conflicts.length === 0, known, conflicts };
}

function coverage(requirement: RecipeRequirement, card: RecipeCard): boolean {
  const semantic = inferSemanticTerms(requirement.text);
  const generic = new Set(["visualization", "disease_related"]);
  const informative = semantic.filter((term) => !generic.has(term));
  const capabilities = new Set([...card.does, ...card.evidence_for, ...card.produces]);
  if (informative.length) return informative.some((term) => capabilities.has(term));

  // Lexical fallback is deliberately based on surface tokens only. Counting both
  // "disease" and the inferred "disease_related" as separate matches made a
  // disease-comparison Recipe appear to cover any disease visualization.
  const query = new Set(basicTokens(requirement.text));
  const document = new Set(basicTokens(recipeRetrievalText(card)));
  const overlap = [...query].filter((token) => document.has(token));
  return overlap.length >= Math.min(2, query.size);
}

function bm25(query: string, documents: string[]): number[] {
  const queryTokens = tokens(query);
  const tokenized = documents.map(tokens);
  const averageLength = tokenized.reduce((sum, document) => sum + document.length, 0) / Math.max(1, tokenized.length);
  const documentFrequency = new Map<string, number>();
  for (const document of tokenized) for (const token of new Set(document)) documentFrequency.set(token, (documentFrequency.get(token) || 0) + 1);
  const k1 = 1.2;
  const b = 0.75;
  const scores = tokenized.map((document) => {
    const frequencies = new Map<string, number>();
    for (const token of document) frequencies.set(token, (frequencies.get(token) || 0) + 1);
    return queryTokens.reduce((score, token) => {
      const frequency = frequencies.get(token) || 0;
      if (!frequency) return score;
      const df = documentFrequency.get(token) || 0;
      const idf = Math.log(1 + (documents.length - df + 0.5) / (df + 0.5));
      const denominator = frequency + k1 * (1 - b + b * document.length / Math.max(1, averageLength));
      return score + idf * (frequency * (k1 + 1)) / denominator;
    }, 0);
  });
  return scores;
}

export function rankRecipes(query: RecipeQuery, recipes: DiscoverableRecipe[], options: { includeCandidates?: boolean; poolSize?: number } = {}): RankedRecipe[] {
  const eligible = recipes.filter((recipe) => isExecutableRecipe(recipe.card) && recipe.card.status !== "watchlist" && (options.includeCandidates === true || recipe.card.status !== "candidate"));
  const documents = eligible.map((recipe) => recipeRetrievalText(recipe.card));
  const lexical = bm25([query.question, query.objective, ...query.requirements.map((requirement) => requirement.text)].join(" "), documents);
  return eligible.flatMap((recipe, index) => {
    const compatibility = recipeCompatibility(query, recipe.card);
    if (!compatibility.compatible) return [];
    const covers = query.requirements.filter((requirement) => coverage(requirement, recipe.card)).map((requirement) => requirement.id);
    return [{ ...recipe, score: lexical[index], lexical_score: lexical[index], covers, compatibility: compatibility.known ? "compatible" : "unknown" } satisfies RankedRecipe];
  }).sort((left, right) => right.score - left.score || right.covers.length - left.covers.length || left.path.localeCompare(right.path)).slice(0, Math.max(1, options.poolSize ?? 8));
}

export function defaultRole(card: RecipeCard, covers: string[], query: RecipeQuery): RecipeRole {
  if (card.kind === "visualization" || covers.some((id) => query.requirements.find((requirement) => requirement.id === id)?.kind === "visualization")) return "visualization";
  if (card.kind === "validation") return "validation";
  return "primary";
}

export function minimalCoverageSelections(query: RecipeQuery, ranked: RankedRecipe[], maxRecipes: number, threshold: number): RecipeSelection[] {
  const uncovered = new Set(query.requirements.map((requirement) => requirement.id));
  const selected: RecipeSelection[] = [];
  for (const candidate of ranked) {
    if (candidate.score < threshold || selected.length >= maxRecipes) continue;
    const incremental = candidate.covers.filter((requirement) => uncovered.has(requirement));
    if (query.requirements.length && !incremental.length) continue;
    selected.push({
      recipe_id: candidate.card.recipe_id,
      path: candidate.path,
      role: selected.length === 0 ? defaultRole(candidate.card, incremental, query) : candidate.card.kind === "visualization" ? "visualization" : "supporting",
      score: candidate.score,
      reason: incremental.length ? `covers ${incremental.join(", ")}` : "highest compatible retrieval score",
      covers: incremental,
    });
    for (const requirement of incremental) uncovered.delete(requirement);
    if (!uncovered.size) break;
  }
  return selected;
}

export function recipeSet(query: RecipeQuery, selections: RecipeSelection[]): RecipeSet {
  const covered = new Set(selections.flatMap((selection) => selection.covers));
  const uncovered = query.requirements.map((requirement) => requirement.id).filter((id) => !covered.has(id));
  return { schema_version: 1, selected: selections, uncovered_requirement_ids: uncovered, complete: uncovered.length === 0 };
}
