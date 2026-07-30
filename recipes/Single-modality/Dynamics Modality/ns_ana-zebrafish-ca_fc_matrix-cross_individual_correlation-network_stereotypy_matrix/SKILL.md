---
name: ns_ana-zebrafish-ca_fc_matrix-cross_individual_correlation-network_stereotypy_matrix
description: Quantify how stereotyped functional connectivity is across zebrafish larvae by vectorising each larva's FC matrix upper triangle and correlating every pair of larvae, then ordering the resulting larva-by-larva similarity matrix from most to least representative and rendering it as a lower-triangular heatmap. Use this whenever the question is about inter-individual consistency, reproducibility, or conservation of a connectome — "is the functional network the same across fish", "how stereotyped is FC", "how similar are individual connectomes", "inter-subject similarity of connectivity", "which fish is most representative of the group", "is there a canonical connectome", "network stereotypy", or "compare connectivity matrices between animals". Reads Figure1_FC_matrices.npy (the per-larva stack) and writes Figure1_FC_network_similarity_across_larvae.npy plus the ordered larva ID list, so run ns_ana-zebrafish-ca-pearson-fc_matrix first. Distinct from cross-day identity fingerprinting,
  which asks whether an individual can be re-identified rather than how alike the group is.
triggers:
- Run the Inter-larva FC stereotypy from upper-triangle correlations recipe
- Quantify how stereotyped functional connectivity is across zebrafish larvae by vectorising each larva's FC matrix upper triangle and correlating every pair of larvae, then ordering the resulting larva-by-larva similarity matrix from most to least representative and rendering it as a lower-triangular heatmap.
- Generate the outputs described by ns_ana-zebrafish-ca_fc_matrix-cross_individual_correlation-network_stereotypy_matrix
tags:
- zebrafish
- ca
- fc
- matrix
- cross
version: '1.0'
---

# Inter-larva FC stereotypy from upper-triangle correlations

Correlates every pair of larvae's FC matrices to test whether functional network organisation
is conserved across individuals at the same developmental stage.

## When to use this

The question is *"is this network the same animal to animal?"* — a group-level consistency
claim, not a per-individual one. It takes the per-larva FC stack and reduces 22 matrices to a
single 22×22 similarity matrix plus one headline number.

Related but different: `ns_ana-zebrafish-ca-cross_day_match-identity_fingerprint` asks whether
a *specific* larva can be re-identified across recording days, which is an
individual-discriminability question. This recipe asks the opposite — how much everyone has in
common.

## Preconditions

- Env vars: `PROCESS_DATA_DIR` and `SAVE_DIR` only. `ZEBRAFISH_PATH` and `ATLAS_PATH` are not
  used. Neither is validated; an unset `SAVE_DIR` raises `TypeError` in `os.makedirs`.
- `Figure1_FC_matrices.npy`, shape (22, 65, 65), from
  `ns_ana-zebrafish-ca-pearson-fc_matrix`. This is the per-larva **stack**, not the
  group-average `Figure1_FC_matrix.npy` — handing it the 2-D average gives a meaningless
  65×65 "similarity" matrix over regions rather than larvae.
- The script does `from zebrafish_Ca_utils import *`, and the module is **vendored** as
  `scripts/zebrafish_Ca_utils.py` with the `sys.path` line pointing at the script's own
  directory, so the import resolves. But **no symbol from it is ever resolved at a call site** —
  the import is dead weight. It is not free weight, though: importing the module pulls in its
  own heavy dependencies (`numba`, `h5py`, `tifffile`, `scikit-image`, `scikit-learn`, `bctpy`,
  `IPython`) at load time. Delete those two lines and the script runs on stock `numpy`, `scipy`
  and `matplotlib`. Along with the `1I`, `6B` and `6D` refine scripts, this is among the closest
  things to runnable code in the set.

## Inputs and outputs

| Direction | File | Shape |
|---|---|---|
| in | `$PROCESS_DATA_DIR/Figure1_FC_matrices.npy` | (22, 65, 65) |
| out | `$PROCESS_DATA_DIR/Figure1_FC_network_similarity_larvaID.npy` | (22,) **string** dtype |
| out | `$PROCESS_DATA_DIR/Figure1_FC_network_similarity_across_larvae.npy` | (22, 22) float |
| out | `$SAVE_DIR/figure.png` / `figure_refine.png`, `$SAVE_DIR/statistics.json` | |

The larva ID array holds strings like `"Fish 7"`, not integers. Full detail in
`references/data_contract.md`.

## Procedure

1. Load `Figure1_FC_matrices.npy` with `allow_pickle=True` and replace NaN with 0 via
   `np.nan_to_num(..., nan=0.0)`. Understand the consequence before keeping it: a NaN means the
   region was unsampled in that larva, and substituting 0 asserts "no correlation" instead of
   "no data". Because unsampled regions tend to be the *same* regions in every larva, the
   injected zeros land at the same vector positions for all of them and inflate the apparent
   similarity. Masking pairwise instead of filling would be the conservative choice.
2. Build identifiers `["Fish 1", …, "Fish 22"]` from the stack length. These are positional
   labels over the stacking order of `Figure1_FC_matrices.npy`, not experimental fish names.
3. Vectorise each matrix with `np.triu_indices(n, k=1)` — upper triangle, diagonal excluded.
   `k=1` matters: including the diagonal would add 65 constant entries to every vector and
   dilute the correlation toward a shared artefact. Each vector has 2080 elements.
4. For every ordered pair `(i, j)`, compute `scipy.stats.pearsonr` over the entries finite in
   both, requiring at least 3 valid points. The full 22×22 loop is run, so the matrix is
   computed twice per pair and is symmetric by construction rather than by assignment.
5. Rank larvae by `np.nanmean(similarity, axis=1)` and sort descending with
   `np.argsort(...)[::-1]`. The row mean includes the diagonal 1.0, which adds the same
   constant to every larva and so cannot change the ranking — harmless, but do not read the
   mean itself as a similarity-to-others.
6. Save the reordered ID list as `Figure1_FC_network_similarity_larvaID.npy`.
7. Reorder the matrix symmetrically, `sim[idx, :][:, idx]`, and save as
   `Figure1_FC_network_similarity_across_larvae.npy`. Reordering a precomputed matrix is
   equivalent to recomputing it in the new order and much cheaper — the task text asks for a
   "recalculation" but a permutation is the same thing.
8. Report the off-diagonal statistics: mask with `~np.eye(n, dtype=bool)`, keep finite values,
   and take mean, SD, min, max, median and the 25th/75th percentiles.
9. Plot the lower triangle **including** the diagonal — mask with `np.triu(..., k=1)` → NaN,
   which is one index different from the FC-matrix figure's `np.triu(..., k=0)`. `imshow` with
   `cmap='Reds'`, `vmin=0.25`, `vmax=0.80`, `aspect='auto'`. Tick labels are the *original*
   1-based fish numbers in sorted order. Colorbar labelled `FC similarity`. Y-axis labelled
   `Larvae`; the refine script drops the redundant x-axis label.

## Key parameters

| Parameter | Value | Why it matters |
|---|---|---|
| NaN handling | `np.nan_to_num(nan=0.0)` | Injects shared artificial zeros; inflates similarity. See Pitfalls. |
| `k` in `triu_indices` | 1 | Excludes the diagonal. Including it would add 65 constants to every 2080-element vector. |
| minimum valid points | 3 | `pearsonr` guard. Never triggers here — `nan_to_num` already removed every NaN, so the `isfinite` mask is all-True. |
| correlation | `scipy.stats.pearsonr` | Raw r, no Fisher transform, consistent with the upstream FC matrices. |
| sort | `np.argsort(mean_similarity)[::-1]` | Descending by mean row similarity. Ties are reversed relative to a stable descending sort. |
| SD | `np.std(...)` with default `ddof=0` | Population SD over 462 values. The upstream census recipe uses `ddof=1`; this one does not. |
| `vmin`, `vmax` | 0.25, 0.80 | Display only. The observed minimum is 0.1215, which clips to the palest red. |
| `cmap` | `'Reds'` | |
| `aspect` | `'auto'` | Not `'equal'` — the square matrix is stretched to the axes box. |
| `figsize` | (8, 7) | |
| `dpi` | 300 | |

## Expected results

From `statistics.json`, over 22 larvae:

- **average Pearson r = 0.4911**
- SD **0.1302**, median **0.5061**
- range **0.1215 to 0.7436**
- 25th percentile **0.3969**, 75th percentile **0.5942**
- **n_valid_comparisons = 462**

462 is `22 × 21` — every off-diagonal cell of the symmetric matrix, so each of the 231 distinct
larva pairs is counted twice. The mean and median are unaffected by the duplication, but the
sample size is 231, not 462. Do not feed 462 into a degrees-of-freedom calculation.

The claim these support: FC is stereotyped across larvae at this developmental stage, average
pairwise r ≈ 0.49 ± 0.13 between individual connectomes.

## Pitfalls

- **`nan_to_num` runs before the `isfinite` guard, making the guard dead code.** The script
  computes `valid_mask = np.isfinite(vec_i) & np.isfinite(vec_j)` and checks
  `valid_mask.sum() >= 3`, but NaNs were already replaced with 0 at load time, so the mask is
  always all-True and the `else: np.nan` branch never executes. The `np.nanmean`, the
  `np.isfinite` filter on `valid_correlations`, and the "n_valid_comparisons" framing are all
  defensive scaffolding around a condition that cannot arise. Harmless as written — but if you
  remove the `nan_to_num` to fix the next point, that scaffolding suddenly becomes live and the
  results will change.
- **Filling NaN with 0 biases the answer upward.** An unsampled region yields a NaN row
  upstream, and those regions are largely consistent across larvae. Substituting 0 puts
  identical values at identical vector positions in every larva, which is perfectly correlated
  structure that no biology produced. The reported r ≈ 0.49 is therefore an upper bound. A
  pairwise-complete correlation — masking positions NaN in either larva — is the conservative
  alternative and would need the `isfinite` guard to actually work.
- **The saved larva ID array is strings, not indices.** `Figure1_FC_network_similarity_larvaID.npy`
  contains `"Fish 7"`-style strings with a `<U7`-ish dtype. A consumer doing arithmetic on it,
  or using it to index the FC stack, will fail or silently misbehave. The integer order lives
  only in the local `sorted_indices` variable, which is never saved — recover it by parsing the
  strings.
- **Tick labels are original fish numbers, not positions.** `str(sorted_indices[i] + 1)` puts
  the pre-sort 1-based identity on the axis. Row `k` of the saved matrix is the larva labelled
  at tick `k`, not larva `k`.
- **`aspect='auto'` stretches a square matrix.** The FC heatmap in
  `ns_ana-zebrafish-ca-pearson-fc_matrix` uses `aspect='equal'`. Cells here are not square,
  which makes the two figures look inconsistent side by side. visual inspection did not identify
  it.
- **The diagonal is shown here but hidden in the FC-matrix figure.** This recipe masks with
  `np.triu(..., k=1)` (diagonal kept — the self-similarity 1.0 values); the FC recipe masks with
  `np.triu(..., k=0)` (diagonal hidden). Both are deliberate; do not copy one mask into the
  other figure.
- **Diagonal values of 1.0 sit above `vmax=0.80`** and render as the most saturated red,
  drawing the eye to the least informative cells.
- **The ordering is descriptive, not a finding.** Sorting by mean similarity guarantees a
  visual gradient from bright top-left to pale bottom-right whatever the data. The report reads
  that gradient as evidence of a "canonical" connectome; the gradient would appear even in pure
  noise. The evidence for stereotypy is the magnitude of r, not the shape of the sorted matrix.
- The 22×22 `pearsonr` double loop computes each pair twice. Negligible here; use
  `np.corrcoef(fc_vectors)` if you scale up.

## Bundled files

- `scripts/reference_implementation.py` — the original run, verbatim.
- `scripts/refine_implementation.py` — identical analysis; removes the redundant x-axis label
  and writes `figure_refine.png`. **Prefer this one**, though the saved `.npy` artifacts and
  `statistics.json` are bit-for-bit the same either way.
- `references/data_contract.md` — env vars, file shapes, artifact dtypes, indexing conventions.
- `references/method_details.md` — every parameter, full statistics, figure spec, provenance.
