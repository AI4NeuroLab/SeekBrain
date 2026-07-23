# Literature compatibility fixtures

These compact fixtures were derived from public official API responses on
2026-07-23. They intentionally retain only fields and short excerpts required
for deterministic compatibility tests. No request headers, API keys, complete
full text, or protected credentials are stored.

Sources:

- Semantic Scholar Graph API `paper/DOI:{doi}`
- NCBI E-utilities `esummary.fcgi` and `efetch.fcgi`
- NCBI PMC XML `efetch.fcgi?db=pmc`

Cases:

- MINT — DOI `10.1371/journal.pcbi.1012934`, PMID `40233091`, PMCID
  `PMC12043240`, repository `https://github.com/panzerilab/MINT`.
- Wilson/Basnak — DOI `10.1038/s41593-024-01823-z`, PMID `40702322`, PMCID
  `PMC12321575`. Its GitHub links exercise dependency and cited-resource
  classification; the paper's own analysis archive is on Zenodo and is not
  treated as a repository in the current compatibility policy.
