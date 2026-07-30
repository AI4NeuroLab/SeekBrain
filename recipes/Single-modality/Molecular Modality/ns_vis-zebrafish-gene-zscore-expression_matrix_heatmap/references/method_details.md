# Method details — ns_vis-zebrafish-st-zscore-gene_region_heatmap

## Contents

- [Full parameter list](#full-parameter-list)
- [Statistical approach and assumptions](#statistical-approach-and-assumptions)
- [Recorded statistics (`statistics.json`)](#recorded-statistics-statisticsjson)
- [Scientific conclusion supported](#scientific-conclusion-supported)
- [Figure specification](#figure-specification)

## Full parameter list

| Name | Value | Where | Effect |
|---|---|---|---|
| shape assertion | `gene_expression.ndim == 2` | load, base only | Catches a malformed file, not a transposed one. |
| exclusion-index assertion | `0 <= idx < n_regions` for all | load, base only | Guarantees the calcium-derived mask is valid for the 70-column expression matrix. |
| filtering | boolean `keep_mask`, columns only | step 3 | 70 → 65 regions. All 290 genes retained. |
| `zscore` axis | `0` | `zscore(filtered, axis=0, ...)` | **The single most consequential parameter.** Standardises down the gene axis, so each region column ends with mean 0 and sd 1 across the 290 genes. `axis=1` would standardise each gene across regions and answer a different question entirely. |
| `zscore` ddof | `0` (default) | | Population sd over 290 genes. With n = 290 the ddof choice moves values by ~0.2%. |
| `nan_policy` | `'propagate'` | | NaNs pass through to be handled explicitly rather than being silently dropped. |
| NaN handling | `np.nan_to_num(..., nan=0.0)` | step 5 | Covers a zero-variance region (0/0 → NaN). `posinf`/`neginf` are left at numpy's defaults (±1.797e308), so an infinity would survive as an enormous finite number. |
| transpose | `.T` before `imshow` | step 6 | Display only — (290, 65) → (65, 290). All statistics are computed pre-transpose. |
| `aspect` | `'auto'` | `imshow` | Required: 65×290 cells in an 18×3 in figure are far from square. |
| `cmap` | `'gray_r'` | `imshow` | Reversed grayscale: white = low, black = high, per the spec ("white-to-black map, flipped 'gray'"). |
| `vmin`, `vmax` | `-1`, `4` | `imshow` | Display clipping only; the underlying values are untouched. Asymmetric by design — see "Why the colour range is asymmetric" below. |
| `interpolation` | `'nearest'` | `imshow` | Genes have no meaningful ordering along x, so smoothing between adjacent columns would invent structure. |
| `figsize` | `(18, 3)` | `plt.subplots` | Very wide, matching the 290:65 aspect of the data. |
| colorbar | `orientation='vertical'`, `fraction=0.02`, `pad=0.02`, label `"Expression (z-scored)"`, `rotation=270`, `labelpad=15` | | `fraction=0.02` is much thinner than the 0.046 used elsewhere in the set, because the figure is so wide. |
| x ticks | `[0, n_genes-1]` labelled `['1', '290']` | | |
| y ticks | `[0, n_regions_kept-1]` labelled `['1', '65']` | | |
| `tick_params` | `length=0` (base); `length=0, pad=5` (refine) | | Removes tick marks while keeping the end labels. |
| spines | all hidden | refine only | `for spine in ax.spines.values(): spine.set_visible(False)` |
| `dpi` | `300`, `bbox_inches='tight'` | `savefig` | Preceded by `plt.tight_layout()`. |

No seed, no permutation count, no sigma, no percentile threshold — the transform is
deterministic.

## Statistical approach and assumptions

**What the z-score does and why `axis=0`.** The matrix is (genes, regions).
`zscore(X, axis=0)` operates down the gene axis, so for every region column *r*:

```
z[g, r] = (x[g, r] - mean_over_genes(x[:, r])) / sd_over_genes(x[:, r])
```

Each region ends up with mean 0 and sd 1 across its 290 gene measurements. The stated purpose
in the task spec is "to account for signal spatial heterogeneity": regions differ in tissue
volume, total RNA capture and staining intensity, so raw values are not comparable between
regions. Without this step a region that simply picked up more signal would appear uniformly
dark across all 290 genes and the panel would map dissection quality rather than biology.

After the transform a cell answers: *how far does this gene sit from the typical gene measured
in this region?* That is relative specificity within a region.

**What this normalisation does not do, and the consequences.**

- It does not remove gene-level baseline differences. A gene that is abundant in every region
  scores high in every region and renders as a solid dark stripe running the full height of
  the panel. The rendered figure is in fact dominated by such stripes. Genuine regional
  specificity appears as *patchy* dark cells inside a column. `analytical_report.md` reads the
  solid vertical features as region-specific enrichment, which inverts the meaning.
- It destroys cross-region comparability of magnitude. Each column has its own mean and sd, so
  z = 2 in region A and z = 2 in region B do not correspond to equal expression. Any statement
  of the form "gene X is higher in region A than region B" requires the raw matrix or a
  `axis=1` normalisation.
- It forces every region to look equally "expressed" on average — the column mean is exactly 0
  by construction. Differences in total regional expression are not attenuated; they are
  removed. If total regional expression is the quantity of interest, do not z-score.

**Why the colour range is asymmetric (`vmin=-1`, `vmax=4`).** Within a region, expression
across 290 genes is strongly right-skewed: most genes sit near or just below the mean while a
small number of markers spike. A z-score computed on a right-skewed distribution therefore has
a hard floor not far below the mean — with 290 genes, a value near zero abundance lands around
z ≈ -1 — but a long upper tail. Clipping at [-1, 4] spends the full grayscale on the range
where data actually lives. The cost is saturation: everything above z = 4 renders identically
black, so a strong marker cannot be distinguished from an extreme one, and the figure-oriented implementation's
statistics do not record the normalised maximum either.

**No hypothesis test.** This is an `ns_vis` recipe. There is no null model, no significance
threshold, no correction. The recorded statistics are descriptive.

## Recorded statistics (`statistics.json`)

The output file is the figure-oriented implementation's nine-field version. Scalar fields verbatim:

```json
{
  "n_genes": 290,
  "n_regions_original": 70,
  "n_excluded_regions": 5,
  "excluded_region_ids": [10, 34, 44, 49, 69],
  "n_regions_kept": 65,
  "expression_mean_per_gene": [ ... 290 floats ... ],
  "expression_std_per_gene":  [ ... 290 floats ... ],
  "normalized_expression_mean": -1.696255867862308e-18,
  "normalized_expression_std": 1.0
}
```

The two elided entries are 290-element lists, one value per gene, computed on the **filtered
but unnormalised** matrix over the 65 kept regions (`np.nanmean(..., axis=1)` and
`np.nanstd(..., axis=1)`). Their characteristics:

| List | First three | Last three | Min | Max | Mean of list |
|---|---|---|---|---|---|
| `expression_mean_per_gene` | 2.0367851893358275, 4.834166222299855, 4.4918219206698105 | 5.9276580349782035, 11.032856112070927, 1.8006442099381497 | 0.37454314941599326 (index 113) | 22.39824711165103 (index 175) | 5.460014466561009 |
| `expression_std_per_gene` | 0.812325581305895, 1.3009720267917444, 4.942426731491263 | 15.230139000221602, 11.443845890467271, 0.7731084640060766 | 0.09589674520447017 (index 201) | 23.409986253617355 (index 103) | — |

Indices above are 0-based list positions; add 1 for the figure's gene numbering.

Field-by-field guidance:

| Field | Trustworthy? | Note |
|---|---|---|
| `n_genes`, `n_regions_original`, `n_excluded_regions`, `n_regions_kept` | yes | 290, 70, 5, 65 |
| `excluded_region_ids` | yes | `[10, 34, 44, 49, 69]`, identical to the list every calcium recipe uses — the point of reading the shared mask |
| `expression_mean_per_gene`, `expression_std_per_gene` | yes | Raw scale. The 60-fold spread in per-gene means (0.37 to 22.40) is the "wide dynamic range of baseline transcript abundance" quoted in `conclusions.json`, and is the reason a within-region z-score is needed before the panel is readable |
| `normalized_expression_mean` | **tautological** | -1.7e-18 is floating-point zero. Every column was centred, so the grand mean must be 0 |
| `normalized_expression_std` | **tautological** | Exactly 1.0. Every column was scaled to sd 1, so the pooled sd is 1 |

The last two confirm the transform ran. They are not results and must not be presented as
such.

**Fields the reference implementation computes that the output file no longer contains:**
`expression_median_per_gene`, `expression_min_per_gene`, `expression_max_per_gene` (each 290
floats), and `normalized_expression_median`, `normalized_expression_min`,
`normalized_expression_max`, `normalized_expression_percentile_25`,
`normalized_expression_percentile_75`, `normalized_expression_percentile_95`. The figure-oriented implementation run
overwrote `statistics.json`, so these values are not preserved anywhere in the source
directory. Notably this means the actual maximum z-score is unrecorded — the claim in
`conclusions.json` that markers reach "z-scores approaching 4" traces to the colour limit
`vmax=4`, not to a measured maximum.

## Scientific conclusion supported

From `conclusions.json`:

> The spatially resolved transcriptomic analysis of 290 genes across 65 larval zebrafish brain
> regions reveals a highly heterogeneous molecular architecture, characterized by specific
> genes acting as distinct regional markers with relative expression z-scores approaching 4,
> despite the wide dynamic range of baseline transcript abundance (raw means ranging from 0.37
> to 22.40) across the gene panel.

The raw-abundance range is directly supported by `expression_mean_per_gene` (0.37454 to
22.398). The "z-scores approaching 4" clause is weaker than it looks: the maximum normalised
value was computed by the reference implementation but not preserved, and 4 is the display ceiling, so the
number reflects `vmax` rather than a measurement. If the claim matters, recompute
`np.nanmax(gene_expression_normalized)`.

`analytical_report.md` additionally claims the panel "clearly demarcates genes that are
uniquely enriched in specific regions (dark vertical features)". Full-height dark columns
indicate genes abundant across all regions, not regionally specific ones — see the analysis
above.

## Figure specification

Wide panel, 18×3 in. `imshow` of the transposed z-scored matrix, 65 rows (brain regions) by
290 columns (genes). `aspect='auto'`, `cmap='gray_r'` so white is low and black is high,
`vmin=-1`, `vmax=4`, `interpolation='nearest'`. Vertical colorbar on the right,
`fraction=0.02`, `pad=0.02`, labelled `Expression (z-scored)` rotated 270° with `labelpad=15`.
X-axis labelled `Genes` with ticks only at positions 0 and 289, shown as `1` and `290`; Y-axis
labelled `Brain regions` with ticks only at 0 and 64, shown as `1` and `65`. Tick marks are
zero-length; the axes-anchored implementation also pads the labels by 5 points and removes all four spines,
giving a floating heatmap. No title, no grid. `tight_layout()`, saved at 300 dpi with
`bbox_inches='tight'`.

The rendered panel is dominated by vertical banding — see the interpretive caveat above.

The known rendering complaints were visible spines and crowded end labels, both addressed in
the figure-oriented implementation.
