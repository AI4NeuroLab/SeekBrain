import type { PaperRecord } from "../contracts.ts";
import { decodePmcXml } from "../shared/pmc-enricher.ts";

type Json = Record<string, any>;

function text(value: unknown): string | undefined {
  const normalized = String(value || "").replace(/\s+/g, " ").trim();
  return normalized || undefined;
}

function year(value: unknown): number | undefined {
  const match = String(value || "").match(/\b(19|20)\d{2}\b/);
  return match ? Number(match[0]) : undefined;
}

function articleId(record: Json, ...types: string[]): string | undefined {
  const ids = Array.isArray(record.articleids) ? record.articleids : [];
  const found = ids.find((item: Json) => types.includes(String(item?.idtype || "").toLowerCase()));
  return text(found?.value);
}

export function parsePubMedSummary(body: Json): Map<string, PaperRecord> {
  const result = body.result && typeof body.result === "object" ? body.result : {};
  const uids = Array.isArray(result.uids) ? result.uids.map(String) : [];
  const papers = new Map<string, PaperRecord>();
  for (const pmid of uids) {
    const record = result[pmid];
    const title = text(record?.title);
    if (!title) continue;
    const pmcidRaw = articleId(record, "pmc", "pmcid");
    papers.set(pmid, {
      provider: "pubmed",
      providerId: pmid,
      title,
      authors: Array.isArray(record.authors) ? record.authors.map((author: Json) => text(author?.name)).filter((name: string | undefined): name is string => Boolean(name)) : [],
      ...(year(record.pubdate || record.epubdate) ? { year: year(record.pubdate || record.epubdate) } : {}),
      ...(text(record.fulljournalname || record.source) ? { venue: text(record.fulljournalname || record.source) } : {}),
      ...(articleId(record, "doi") ? { doi: articleId(record, "doi") } : {}),
      pmid,
      ...(pmcidRaw ? { pmcid: `PMC${pmcidRaw.replace(/^PMC/i, "")}` } : {}),
      repositoryCandidates: [],
    });
  }
  return papers;
}

function tag(block: string, name: string): string | undefined {
  const match = block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`, "i"));
  return match ? decodePmcXml(match[1]) : undefined;
}

function identifier(block: string, type: string): string | undefined {
  const expression = new RegExp(`<ArticleId[^>]*IdType=["']${type}["'][^>]*>([\\s\\S]*?)<\\/ArticleId>`, "i");
  const match = block.match(expression);
  return match ? decodePmcXml(match[1]) : undefined;
}

export function parsePubMedFetchXml(xml: string): Map<string, Partial<PaperRecord>> {
  const articles = xml.match(/<PubmedArticle(?:\s[^>]*)?>[\s\S]*?<\/PubmedArticle>/gi) || [];
  const papers = new Map<string, Partial<PaperRecord>>();
  for (const article of articles) {
    const pmid = tag(article, "PMID");
    if (!pmid) continue;
    const abstracts = [...article.matchAll(/<AbstractText(?:\s[^>]*)?>([\s\S]*?)<\/AbstractText>/gi)]
      .map((match) => decodePmcXml(match[1])).filter(Boolean);
    const pmcidRaw = identifier(article, "pmc");
    papers.set(pmid, {
      ...(tag(article, "ArticleTitle") ? { title: tag(article, "ArticleTitle") } : {}),
      ...(abstracts.length ? { abstract: abstracts.join("\n") } : {}),
      ...(identifier(article, "doi") ? { doi: identifier(article, "doi") } : {}),
      pmid,
      ...(pmcidRaw ? { pmcid: `PMC${pmcidRaw.replace(/^PMC/i, "")}` } : {}),
    });
  }
  return papers;
}
