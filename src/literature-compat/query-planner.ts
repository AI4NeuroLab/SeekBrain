const STOP_WORDS = new Set([
  "a", "about", "after", "against", "all", "also", "among", "an", "analysis", "analyze", "and", "are", "as", "at",
  "before", "between", "by", "can", "could", "data", "dataset", "decode", "do", "does", "during", "each", "example",
  "figure", "for", "from", "how", "in", "into", "is", "it", "method", "methods", "of", "on", "or", "our", "paper",
  "please", "plot", "plots", "prediction", "relative", "research", "result", "results", "selected", "show", "side", "simple",
  "study", "test", "than", "that", "the", "their", "these", "this", "three", "through", "to", "under", "using", "versus",
  "via", "was", "were", "what", "when", "where", "which", "with", "would",
]);

function cleanQuery(value: unknown): string {
  return String(value || "").replace(/[\r\n\t]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 120);
}

export function providedLiteratureQueries(value: unknown, maximum = 3): string[] {
  if (!Array.isArray(value)) return [];
  const limit = Number.isFinite(maximum) ? Math.max(1, Math.min(3, Math.floor(maximum))) : 3;
  return [...new Set(value.map(cleanQuery).filter(Boolean))].slice(0, limit);
}

function fallbackTerms(question: string): string[] {
  const raw = question.match(/[\p{L}\p{N}][\p{L}\p{N}+.-]*/gu) || [];
  return raw.flatMap((word) => {
    const trimmed = word.replace(/^[.+-]+|[.+-]+$/g, "");
    if (!trimmed) return [];
    const normalized = /^[A-Z][A-Z0-9]{1,7}$/.test(trimmed) ? trimmed : trimmed.toLowerCase();
    if (STOP_WORDS.has(normalized.toLowerCase())) return [];
    const pieces = normalized.split(/[-]+/).filter((piece) => piece && !STOP_WORDS.has(piece.toLowerCase()));
    if (!pieces.length) return [];
    const compact = pieces.join(" ");
    if (compact.length < 3 && !/^[A-Z0-9]{2,}$/.test(compact)) return [];
    return [compact];
  });
}

export function fallbackLiteratureQueries(question: string, maximum = 3): string[] {
  const terms = fallbackTerms(question);
  if (!terms.length) return [];
  const limit = Number.isFinite(maximum) ? Math.max(1, Math.min(3, Math.floor(maximum))) : 3;
  const width = 5;
  const starts = [0, Math.max(0, Math.floor((terms.length - width) / 2)), Math.max(0, terms.length - width)];
  const compact = (values: string[]) => {
    const words: string[] = [];
    for (const value of values) {
      const next = value.split(/\s+/).filter(Boolean);
      if (words.length + next.length > 6) break;
      words.push(...next);
    }
    return cleanQuery(words.join(" "));
  };
  const queries = starts.map((start) => compact(terms.slice(start, start + width))).filter(Boolean);
  return [...new Set(queries)].slice(0, limit);
}

export function externalLiteratureQueries(question: string, planned: unknown, maximum = 3): string[] {
  const provided = providedLiteratureQueries(planned, maximum);
  return provided.length ? provided : fallbackLiteratureQueries(question, maximum);
}
