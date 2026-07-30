# Method details — ns_ana-zebrafish-ca-triu_pearson-network_stereotypy

## Contents

- [Full parameter list](#full-parameter-list)
- [Statistical approach](#statistical-approach)
- [Recorded statistics (`statistics.json`)](#recorded-statistics-statisticsjson)
- [Implementation requirements](#implementation-requirements)
- [Visualization refinements](#visualization-refinements)
- [Scientific conclusion supported](#scientific-conclusion-supported)
- [Output requirements](#output-requirements)


## Full parameter list

| Name | Value | Where | Effect |
|---|---|---|---|
| `allow_pickle` | `True` | `np.load(fc_matrices_path, allow_pickle=True)` | Unnecessary for a plain float array. Harmless, but it disables the safety refusal on object arrays. |
| NaN handling | `np.nan_to_num(fc_matrices, nan=0.0)` | Immediately after load | Replaces every NaN with 0 across the whole stack. This is the single most consequential parameter in the recipe — see "Statistical approach". |
| `k` | `1` | `vectorize_upper_triangle(matrix, k=1)` → `np.triu_indices(n, k=1)` | Upper triangle, diagonal excluded. Each 65×65 matrix becomes a 2080-element vector. |
| vector dtype | `.astype(float)` | Inside the inline helper | Forces float even if the input were integer. |
| minimum valid points | `3` | `if valid_mask.sum() >= 3:` | Guard for `pearsonr`. **Dead code** — `nan_to_num` has already removed every NaN, so `valid_mask` is always all-True and `valid_mask.sum()` is always 2080. |
| correlation | `scipy.stats.pearsonr(vec_i[valid_mask], vec_j[valid_mask])` | Similarity loop | Raw Pearson r; the returned p-value is discarded. No Fisher z-transform, consistent with the upstream FC matrices which also skip it (`arctanh=False`). |
| loop range | full `n × n` | `for i in range(n): for j in range(n):` | Each pair computed twice, and the diagonal computed as `pearsonr(v, v) = 1.0`. Symmetry arises by construction, not by assignment. |
| ranking statistic | `np.nanmean(initial_similarity_matrix, axis=1)` | Ordering | Row mean **including** the diagonal 1.0. Adds the same `1/22` to every larva, so the ranking is unaffected — but the value itself is not a mean similarity-to-others. |
| sort | `np.argsort(mean_similarity)[::-1]` | Ordering | Descending. `argsort` defaults to quicksort (not stable), and the `[::-1]` reversal flips tie order; exact ties are vanishingly unlikely on continuous r. |
| off-diagonal mask | `~np.eye(n_larvae, dtype=bool)` | Statistics | Selects all 462 off-diagonal cells, i.e. each of the 231 distinct pairs twice. |
| finite filter | `valid_correlations[np.isfinite(...)]` | Statistics | Dead code for the same reason as the `>= 3` guard. |
| SD | `np.std(valid_correlations)` — default `ddof=0` | Statistics | Population SD. `ns_pre-zebrafish-ca_atlas-region_census-exclusion_mask` uses `ddof=1` for its neuron counts; the two recipes are not consistent. At n = 462 the difference is in the fourth decimal. |
| percentiles | `np.percentile(..., 25)` and `..., 75` | Statistics | Linear interpolation, numpy default. |
| plot mask | `np.triu(np.ones_like(m, dtype=bool), k=1)` → NaN | Visualisation | `k=1`, so the **diagonal is kept**. The FC-matrix figure uses `k=0` and hides it. |
| `cmap` | `'Reds'` | `imshow` | |
| `vmin`, `vmax` | `0.25`, `0.80` | `imshow` | Display only. The observed minimum r is 0.1215 (clips to palest) and the diagonal is 1.0 (clips to most saturated). |
| `aspect` | `'auto'` | `imshow` | Stretches the square matrix to the axes box. The FC-matrix figure uses `'equal'`. |
| colorbar | `fraction=0.046`, `pad=0.04`, label `"FC similarity"`, `rotation=270`, `labelpad=20` | | |
| tick labels | `str(sorted_indices[i] + 1)`, fontsize 8 | Both axes | Original 1-based fish numbers in sorted order. |
| `ylabel` | `"Larvae"`, fontsize 12 | | |
| `xlabel` | `"Larvae"` (base only) | | Removed by the refine script. |
| tick length | `0` | `ax.tick_params(which='both', length=0)` | Labels without tick marks. |
| spines | top and right hidden | | |
| title | `f"FC Network Similarity Across Larvae (n={n_larvae})"`, fontsize 14, `pad=15` | | |
| `figsize` | `(8, 7)` | | |
| `dpi` | `300` | `savefig(..., bbox_inches='tight')` | |

## Statistical approach

**Network vectorisation.** Each larva's 65×65 symmetric FC matrix is reduced to its 2080
unique off-diagonal entries via `np.triu_indices(65, k=1)`. Every larva uses the same index
ordering, so position `p` in one vector is the same region pair as position `p` in another.
That correspondence is the whole basis of the comparison — it silently requires that all
matrices came from the same region set in the same order, which holds because they were built
together by `ns_ana-zebrafish-ca-pearson-fc_matrix`.

Excluding the diagonal (`k=1`) is not cosmetic. Diagonal entries are self-correlations,
identical across larvae by construction, so including them would add 65 constant elements to
every 2080-element vector and pull all pairwise correlations upward toward a shared artefact.

**Similarity.** Pearson r between vectorised networks. This measures whether the *pattern* of
strong and weak connections is conserved, and is invariant to any linear rescaling of one
larva's connectivity. Two larvae with the same topology but different overall coupling strength
score as identical. That is usually what "stereotypy" should mean, but it does mean this metric
cannot detect a global amplitude difference between animals.

No Fisher z-transform is applied, matching the upstream convention. Averaging raw r is mildly
biased toward zero relative to averaging z and back-transforming; at r ≈ 0.49 over 231 pairs the
bias is small, but flag it against literature that z-transforms.

**The NaN-to-zero substitution is the main threat to validity.** Upstream, a region unsampled in
a given larva produces a NaN row and column in that larva's FC matrix. Replacing those NaNs
with 0 asserts "this pair is uncorrelated" rather than "this pair was not measured". Because
sampling failures are largely consistent across larvae — that is exactly why five regions were
excluded outright — the injected zeros land at the *same vector positions* in most larvae. That
is perfectly shared structure contributed by no biology, and it pushes every pairwise r upward.
The reported 0.4911 should be read as an upper bound on stereotypy.

The conservative alternative is pairwise-complete correlation: keep the NaNs and correlate only
over positions finite in both larvae. The script already contains the machinery for this —
`valid_mask = np.isfinite(vec_i) & np.isfinite(vec_j)` and the `>= 3` guard — but the
`nan_to_num` call upstream of it renders the mask always-true. Removing the `nan_to_num` line
activates that path and yields the conservative estimate, at the cost of different pairs being
computed over different numbers of points.

**Ordering is presentation, not inference.** Sorting larvae by mean similarity guarantees a
monotone gradient from the bright top-left to the pale bottom-right of the plotted matrix. That
gradient would appear in a matrix of pure noise sorted the same way. The report reads it as
evidence that "a common template exists" while "individual variation places some subjects closer
to the population mean" — the second half is defensible from the spread of r, the visual
gradient itself is not evidence of anything. The real evidence for stereotypy is that
r ≈ 0.49 ± 0.13 with a minimum of 0.12, i.e. no larva is uncorrelated with the group.

**Sample size.** `n_valid_comparisons = 462 = 22 × 21` counts each unordered pair twice. There
are 231 distinct pairs, and they are not independent of each other either — each larva appears
in 21 of them. Mean and median are unaffected by the duplication, but any significance test
built on n = 462 would be badly anticonservative. No such test is performed here, which is the
right call.

**No null model.** There is no permutation test, no comparison against surrogate networks, and
no correction. The claim is descriptive: the average inter-individual correlation is 0.49.
Whether 0.49 is "stereotyped" relative to chance is not tested in this run.

## Recorded statistics (`statistics.json`)

Verbatim from the original run. Both scripts write this identical dict:

```json
{
  "n_larvae": 22,
  "average_pearson_r": 0.49112579272601414,
  "std_pearson_r": 0.13024291490603293,
  "min_pearson_r": 0.1215072817213064,
  "max_pearson_r": 0.7435733968794711,
  "median_pearson_r": 0.5060948081058415,
  "n_valid_comparisons": 462,
  "percentile_25": 0.3968743378338515,
  "percentile_75": 0.5941970705443275
}
```


```
Loaded 22 FC matrices with shape (22, 65, 65)
Average Pearson's r across larvae: 0.4911
Standard deviation: 0.1302
Range: [0.1215, 0.7436]
```

Regression checks worth keeping:

- `n_valid_comparisons` must equal `n_larvae × (n_larvae − 1)`. Anything less means NaNs
  survived, which would mean the `nan_to_num` was removed or the input changed.
- The mean sitting between the 25th and 75th percentiles and close to the median indicates a
  roughly symmetric distribution of pairwise similarities — no single outlier larva dominates.
- `min_pearson_r = 0.1215` is well above zero: every larva is positively correlated with every
  other, which is the qualitative form of the stereotypy claim.

## Implementation requirements

Apply the following implementation requirements (exactly three ways:

1). Removes `ax.set_xlabel("Larvae", fontsize=12)`. The task text asked only for a y-axis
   label, and on a symmetric matrix the x-label is redundant.
2. Renames the output figure from `figure.png` to `figure_refine.png`.
3. Adds three explanatory comments.

**Nothing in the analysis changes.** The saved `.npy` artifacts and `statistics.json` are
bit-for-bit identical from either script. This is the mildest base-vs-refine delta in the set —
the figure critique found only cosmetic issues.

**Use `scripts/refine_implementation.py`** for consistency with the archived figure, but either
one reproduces the numbers.

## Visualization refinements

Visual inspection identified:

1. Unnecessary x-axis label — the instructions requested a y-axis label "Larvae" only; the
   x-axis label is redundant for a symmetric matrix and was not requested.
2. Incorrect output filename — the refined image must be saved as `figure_refine.png`, but the
   previous code saved it as `figure.png`.

Neither the `aspect='auto'` stretching nor the saturated 1.0 diagonal was flagged.

## Scientific conclusion supported

From `conclusions.json`:

> Analysis of functional connectivity matrices from 22 zebrafish larvae at a similar
> developmental stage reveals a stereotyped network organization, characterized by an average
> pairwise Pearson correlation of approximately 0.49 (standard deviation = 0.13) between
> individual connectomes.

The report adds the interpretation that an average inter-individual correlation near 0.5
indicates the core functional wiring diagram is preserved despite biological variability and
differences in internal state, suggesting developmental constraint. It also proposes that the
ordering identifies larvae closest to a "canonical" functional connectome — a reading that
should be treated cautiously given that the ordering produces a gradient by construction.

## Output requirements

Single-panel heatmap, 8 × 7 in.

**Matrix.** The ordered 22×22 similarity matrix with its upper triangle set to NaN via
`np.triu(np.ones_like(m, dtype=bool), k=1)` — so the **lower triangle plus the diagonal** is
shown. `imshow(cmap='Reds', vmin=0.25, vmax=0.80, aspect='auto')`.

**Colorbar.** Right side, `fraction=0.046`, `pad=0.04`, labelled `"FC similarity"` rotated
270° with `labelpad=20`.

**Ticks.** Positions `np.arange(22)` on both axes; labels `str(sorted_indices[i] + 1)` at
fontsize 8 — the original 1-based fish numbers in sorted order. Tick marks suppressed with
`ax.tick_params(which='both', length=0)`.

**Labels.** Y-axis `"Larvae"` at fontsize 12. No x-axis label (refine script). Title
`"FC Network Similarity Across Larvae (n=22)"`, fontsize 14, `pad=15`.

**Spines.** Top and right hidden; left and bottom retained.

`plt.tight_layout()`, saved to `$SAVE_DIR/figure_refine.png` at 300 dpi with
`bbox_inches='tight'`.
