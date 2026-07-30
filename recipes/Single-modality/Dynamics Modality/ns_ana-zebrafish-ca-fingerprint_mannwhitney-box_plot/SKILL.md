---
name: ns_ana-zebrafish-ca-fingerprint_mannwhitney-box_plot
description: Test whether zebrafish larvae are significantly self-similar across days by splitting the cross-day FC-similarity matrix into intra-individual (diagonal) and inter-individual (off-diagonal) groups and comparing them with a two-sided Mann-Whitney U test, then plotting both distributions as jittered scatter points under unfilled min-to-max boxplots with the p-value annotated. Use this whenever someone asks whether connectome fingerprinting is statistically significant, whether within-subject FC similarity exceeds between-subject similarity, for a p-value on individual identifiability, test-retest reliability of functional connectivity, "is the fish more like itself than like other fish", or wants the intra- vs inter-individual similarity boxplot. This is the significance half of the fingerprinting pair; the identification-accuracy heatmap lives in ns_ana-zebrafish-ca-cross_day_match-identity_fingerprint. Both write Figure1_FC_fingerprinting.npy; this one additionally writes the
  SameLarva and DiffLarva vectors.
triggers:
- 'Run the Significance of FC fingerprinting: intra- vs inter-individual similarity recipe'
- Test whether zebrafish larvae are significantly self-similar across days by splitting the cross-day FC-similarity matrix into intra-individual (diagonal) and inter-individual (off-diagonal) groups and comparing them with a two-sided Mann-Whitney U test, then plotting both distributions as jittered scatter points under unfilled min-to-max boxplots with the p-value annotated.
- Generate the outputs described by ns_ana-zebrafish-ca-fingerprint_mannwhitney-box_plot
tags:
- zebrafish
- ca
- fingerprint
- mannwhitney
- box
version: '1.0'
---

# Significance of FC fingerprinting: intra- vs inter-individual similarity

Builds the cross-day similarity matrix, splits it into self-matches and cross-matches, and
asks whether the difference is more than sampling noise.

## When to use this

The question is *"is the fingerprinting effect real?"* — you need a p-value and a
distributional comparison, not just an accuracy number.

Reach for **this** recipe for the boxplot and the Mann-Whitney p-value. Reach for
`ns_ana-zebrafish-ca-cross_day_match-identity_fingerprint` for the identification accuracy and
the similarity heatmap. Steps 1–4 of the two runs are the same computation and both overwrite
`Figure1_FC_fingerprinting.npy`; this one additionally saves the two group vectors, so if you
only run one of the pair, run this one — it is a strict superset of the other's artifacts.

Input is the dedicated 7-larva longitudinal cohort (`FC_matrices_fingerprinting_{6,7}dpf.npy`,
116 regions), not the 22-larva 65-region FC stack from `ns_ana-zebrafish-ca-pearson-fc_matrix`.

## Preconditions

- The FC files are read from a **hard-coded** `ROOT_DIR` under the dead mount
  (`<data-root>`), *not* from `ZEBRAFISH_PATH`.
  This is the first thing to change when adapting the script — see Pitfalls.
- `PROCESS_DATA_DIR` and `SAVE_DIR` must be set; both are `os.makedirs(..., exist_ok=True)`'d
  without a `None` check.
- The one library module the base script imports is vendored into `scripts/` —
  `zebrafish_Ca_utils.py`. Its `sys.path` line points at the script's own directory, so
  `from zebrafish_Ca_utils import *` resolves with no external setup; that line is the only
  edit to the script. The import is still dead — **no symbol** from it is resolved anywhere —
  and it costs the module's own heavy dependencies (`h5py`, `numba`, `tqdm`, `tifffile`,
  `scikit-image`, `scikit-learn`, `bctpy`, `IPython`) at load time, so it can safely be
  deleted. The refine script already drops both lines, leaving it dependent only on `numpy`,
  `scipy.stats.mannwhitneyu`, and `matplotlib`.
- Both `.npy` files must have identical shapes; asserted.

## Inputs and outputs

| Direction | File | Shape |
|---|---|---|
| in | `$ROOT_DIR/Files/FC_matrices_fingerprinting_6dpf.npy` | (7, 116, 116) |
| in | `$ROOT_DIR/Files/FC_matrices_fingerprinting_7dpf.npy` | (7, 116, 116) |
| out | `$PROCESS_DATA_DIR/Figure1_FC_fingerprinting.npy` | (7, 7) symmetric |
| out | `$PROCESS_DATA_DIR/Figure1_FC_fingerprinting_SameLarva.npy` | (7,) |
| out | `$PROCESS_DATA_DIR/Figure1_FC_fingerprinting_DiffLarva.npy` | (21,) |
| out | `$SAVE_DIR/figure.png` / `figure_refine.png`, `$SAVE_DIR/statistics.json` | |

Full detail in `references/data_contract.md`.

## Procedure

1. Load both FC stacks. Assert the shapes match exactly.
2. Vectorize each larva's FC matrix with `np.triu_indices(n, k=1)` — strict upper triangle.
   `k=1` matters: the diagonal is a constant 1.0 in every larva and would pull all
   correlations toward a shared baseline, shrinking the very contrast being tested.
3. Build `S[i, j] = corr(day6 larva i, day7 larva j)` over all pairs, correlating only over
   positions finite in **both** vectors and writing NaN when fewer than 3 survive.
4. Symmetrize with `(S + S.T) / 2` so no pair's score depends on which animal is called first.
   Save as `Figure1_FC_fingerprinting.npy`.
5. Extract **intra** = `np.diag(symmetric_similarity)` → 7 values. Save as
   `Figure1_FC_fingerprinting_SameLarva.npy`.
6. Extract **inter** = `symmetric_similarity[np.triu_indices(n, k=1)]` → 21 values. Save as
   `Figure1_FC_fingerprinting_DiffLarva.npy`. Using the upper triangle rather than a full
   off-diagonal mask keeps each unordered pair once, which is what a rank test needs.
7. Drop non-finite entries from both groups before testing.
8. `mannwhitneyu(intra_clean, inter_clean, alternative='two-sided')`. A rank test is the right
   choice here: n=7 vs n=21 is far too small to check normality, and the groups have
   different, non-independent sampling structure.
9. Plot at figsize (3, 5): jittered scatter (`np.random.seed(42)`, Gaussian jitter σ=0.02) at
   x=0.5 (intra, blue) and x=1.0 (inter, red), s=20, alpha=0.6.
10. Overlay unfilled boxplots at the same positions, width 0.2, `whis=[0, 100]` so whiskers
    reach the true min and max, `showfliers=False`, black median line. Note `patch_artist=True`
    with `facecolor='none'` — the patch is created but left transparent.
11. Fix `xlim` (0.2, 1.3), `ylim` (0.6, 0.85), yticks every 0.05, y-label `FC similarity`.
    Ticks at 0.5 and 1.0 labelled with the two group names, tick marks removed
    (`length=0`).
12. Draw a horizontal bracket at y=0.83 between the groups and annotate
    `p={pval:.2e}\nMann-Whitney U` above it.

## Key parameters

| Parameter | Value | Why it matters |
|---|---|---|
| `k` in `np.triu_indices` (FC vectorization) | `1` | Excludes the unit diagonal from the 116×116 profile; 6670 edges per larva. |
| `k` in `np.triu_indices` (inter extraction) | `1` | Each unordered larva pair counted **once** → n=21. The sibling recipe uses `~np.eye` and gets 42; that duplication would be invalid input to a rank test. |
| minimum finite overlap | `3` | Below 3 points Pearson r is meaningless; the cell becomes NaN. |
| `alternative` | `'two-sided'` | Conservative. A one-sided test was directionally justified but not used — the reported p is therefore double the one-sided value. |
| `np.random.seed` | `42` | Fixes the scatter jitter only. No statistic depends on it; the p-value is deterministic. |
| jitter σ | `0.02` | Display. |
| `whis` | `[0, 100]` | Whiskers span the full data range, as the figure spec demanded — so no points fall outside the whiskers. |
| `ylim` / `yticks` | `0.6`–`0.85`, step `0.05` | Fixed range. Every observed value (min 0.626, max 0.813) fits inside; check this if rerunning on other data, since points outside would be silently clipped. |
| `figsize` | `(3, 5)` | The narrow width is what caused the x-label overlap the refine pass fixed. |
| `dpi`, `bbox_inches` | `300`, `'tight'` | Save. |

## Expected results

From `statistics.json` of the original run:

- Intra-individual: **n = 7**, mean **0.7863**, SD **0.0251**
- Inter-individual: **n = 21**, mean **0.7089**, SD **0.0370**
- Mann-Whitney U test, two-sided: **p = 3.209351035437992e-05**
- From `exec.log`, the U statistic (written by the base script only): **U = 142.00**

7 × 21 = 147 is the maximum possible U, so U = 142 means 142 of the 147 intra/inter pairwise
comparisons favoured the intra group — five did not, consistent with the single
misidentification seen in the sibling recipe.

The claim these support: intra-individual FC similarity (≈0.79) is significantly higher than
inter-individual similarity (≈0.71), p < 0.001, so functional network patterns carry stable
individual-specific features sufficient for fingerprinting.

## Pitfalls

- **The input path is hard-coded and dead.** Both the base and refine scripts set
  `ROOT_DIR = "<data-root>"`
  and never read `ZEBRAFISH_PATH`. The sibling recipe *does* use `ZEBRAFISH_PATH` for the same
  two files. Point `ROOT_DIR` at your dataset root or the script cannot find its input at all.
- **The report says "Mann-Whitney U test, U statistic computed" without giving the value, and
  the stored `statistics.json` omits it too.** The base script computed `test_statistic` and
  wrote it; the refine script dropped that field, and the stored file is the refine one. U =
  142 survives only in `exec.log`. Where prose and code disagree, the code is the truth — and
  here the code changed between passes.
- **n=7 vs n=21 is a small, structurally dependent comparison.** Every value in both groups is
  derived from the same 7 larvae, so the 21 inter values are not independent of each other
  (each larva appears in 6 of them). The Mann-Whitney U test assumes independent observations;
  the p-value is optimistic. A permutation test over larva identity labels would be the honest
  version. Report the p-value with that caveat rather than as an exact type-I error rate.
- **The two-sided p is reported although the hypothesis is directional.** Halve it if you need
  the one-sided value; do not silently switch, since the stored number is two-sided.
- **The base script's statistics dict is richer than the stored file.** It writes `n_larvae`,
  `n_regions`, medians, min/max, quartiles, `test_statistic`, and `alternative`; the refine
  script trims to nine fields. The stored `statistics.json` is the refine version.
- **The diagonal values are not averaged the way off-diagonal values are.** Symmetrization
  averages `S[i,j]` with `S[j,i]`, but `S[i,i]` is its own mirror. Intra values are raw
  single correlations, inter values are means of two — slightly different sampling variance
  between the groups being compared.
- The figure critique found the two x-labels overlapping in the 3-inch-wide figure; the refine
  script splits them across two lines (`"intra-\nindividual"`). **Prefer the refine script** —
  it is also the dependency-free one.

## Bundled files

- `scripts/reference_implementation.py` — the original run, verbatim.
- `scripts/refine_implementation.py` — two-line x-labels, no dead library import, trimmed
  statistics. **Prefer this one.**
- `scripts/zebrafish_Ca_utils.py` — the vendored library module the base script imports (and
  never uses); the refine script does not touch it.
- `references/data_contract.md` — env vars, file shapes, artifact consumers, indexing.
- `references/method_details.md` — every parameter, full statistics, base-vs-refine, provenance.
