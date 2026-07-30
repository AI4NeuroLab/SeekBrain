---
name: "ns_multi-zebrafish-sc_fc_matrix-directionality_anova-matrix_histogram"
description: "Test whether the existence and reciprocity of a structural connection changes functional coupling strength, by classifying every zebrafish region pair as unconnected / unidirectional / bidirectional from the directed structural connectome, pooling the per-larva FC values in each class, and comparing the three distributions with a one-way ANOVA. Reach for this whenever the question is about directionality or reciprocity of anatomy versus function — 'do reciprocally connected regions correlate more strongly', 'does having a structural link raise functional connectivity', 'compare FC for connected vs unconnected pairs', 'effect of connection directionality on correlation', 'bidirectional vs unidirectional coupling', 'SC category FC distributions' — or when someone wants the FC density curves split by structural connection type with significance bars. It produces Figure2_number_of_connections.npy plus the three per-category FC value arrays (Figure2_Directionality_Corr_Bidirection/Unidirection/Unconnect.npy)"
triggers:
- "Analyze directionality of structural connections vs functional coupling strength"
- "Generate directionality of structural connections vs functional coupling strength outputs"
- "Apply the ns_multi-zebrafish-sc_fc_matrix-directionality_anova-matrix_histogram recipe"
tags:
- "zebrafish"
- "sc"
- "fc"
- "matrix"
- "directionality"
version: "1.0"
---

# Directionality of structural connections vs functional coupling strength

Classifies each region pair by how many directed structural edges join it (0, 1, or 2),
pools the functional connectivity values of each class across all larvae, and tests the three
distributions with a one-way ANOVA.

## When to use this

Use this recipe to test whether functional coupling differs among absent, unidirectional, and bidirectional structural-edge classes and to visualize their distributions. Do not use it with an undirected structural matrix or unmatched region indices.

## Preconditions

- Env vars `PROCESS_DATA_DIR` and `SAVE_DIR`. Neither is validated — if `SAVE_DIR` is unset,
  `os.makedirs(None)` raises before any work is done, but an unset `PROCESS_DATA_DIR` fails
  later, at the first `os.path.join`, after the SC load. Set both.
- `ZEBRAFISH_PATH` is **not** read. The script hard-codes `DATA_ROOT` to a path under the dead
  `<data-root>` mount, so the SC file location must be patched by hand — see
  Pitfalls.
- `Figure1_excluded_regions.npy` in `PROCESS_DATA_DIR`, from
  `ns_pre-zebrafish-ca_atlas-region_census-exclusion_mask`.
- `Figure1_FC_matrices.npy` in `PROCESS_DATA_DIR` — the **per-larva stack**, not the group
  average — from `ns_ana-zebrafish-ca-pearson-fc_matrix`.
- The one library module both scripts import is vendored into `scripts/` —
  `zebrafish_Ca_utils.py`. The `sys.path` line points at the script's own directory, so
  `from zebrafish_Ca_utils import *` resolves with no external setup; that line is the only
  edit to the scripts. The import is still dead — no symbol from it is ever resolved — and it
  costs the module's own heavy dependencies (`h5py`, `numba`, `tqdm`, `tifffile`,
  `scikit-image`, `scikit-learn`, `bctpy`, `IPython`) at load time, so it can safely be
  deleted.

## Inputs and outputs

| Direction | File | Shape |
|---|---|---|
| in | `$DATA_ROOT/Files/SC_matrix_directed_terminals_expanded.npy` | (70, 70) float |
| in | `$PROCESS_DATA_DIR/Figure1_excluded_regions.npy` | (5,) int |
| in | `$PROCESS_DATA_DIR/Figure1_FC_matrices.npy` | (22, 65, 65) |
| out | `$PROCESS_DATA_DIR/Figure2_number_of_connections.npy` | (65, 65) int, values in {0,1,2} |
| out | `$PROCESS_DATA_DIR/Figure2_Directionality_Corr_Unconnect.npy` | (10011,) |
| out | `$PROCESS_DATA_DIR/Figure2_Directionality_Corr_Unidirection.npy` | (15965,) |
| out | `$PROCESS_DATA_DIR/Figure2_Directionality_Corr_Bidirection.npy` | (19021,) |
| out | `$SAVE_DIR/figure.png` (or `figure_refine.png`), `$SAVE_DIR/statistics.json` | |

Full detail in `references/data_contract.md`.

## Procedure

1. Load the **directed** SC matrix, cast to float. It is 70×70 and asymmetric — that asymmetry
   is the whole point, so do not substitute the undirected file.
2. Load `Figure1_excluded_regions.npy` and build a boolean keep-mask over the 70 original
   regions; apply it to both axes of SC, giving 65×65.
3. Load `Figure1_FC_matrices.npy`. Apply the same mask to axes 1 and 2 **only if** the FC stack
   is still 70-wide. In this dataset it arrives already at 65, so nothing happens — re-applying
   the mask to a 65-wide matrix would silently drop the wrong regions.
4. Binarize: `SC_binary = (SC_directed > 0).astype(int)`. Any positive terminal count counts as
   a connection; there is no weight threshold.
5. `connection_category = SC_binary + SC_binary.T`. The sum of a binary matrix and its transpose
   is symmetric with entries in {0,1,2}, which is exactly the unconnected / unidirectional /
   bidirectional coding. Save it as `Figure2_number_of_connections.npy`.
6. Take `np.triu_indices(65, k=1)` — 2080 unique pairs, diagonal excluded.
7. For each of the 22 larva FC matrices, read the upper-triangle FC vector and the matching
   category vector, and append the FC values into the three category lists. Pooling across
   larvae (rather than averaging first) is what gives the ANOVA its ~45 000 observations — and
   also what makes it pseudo-replicated; see Pitfalls.
8. Drop entries that are exactly zero or non-finite from each of the three arrays, then save
   each to its `Figure2_Directionality_Corr_*.npy` file.
9. `f_oneway(fc_unconnected, fc_unidirectional, fc_bidirectional)` → F and P. Map P to an
   asterisk marker at the 0.05 / 0.01 / 0.001 / 0.0001 boundaries.
10. Figure, two stacked panels sharing a column: top is the lower triangle of the category
    matrix via `imshow(cmap='gray', vmin=0, vmax=2)` with the upper triangle including the
    diagonal set to NaN, with an inline three-swatch legend placed in data coordinates in the
    empty upper-right; bottom is three Gaussian-smoothed density curves plus a significance bar
    spanning the unconnected and bidirectional peaks.

## Key parameters

| Parameter | Value | Why it matters |
|---|---|---|
| SC file | `SC_matrix_directed_terminals_expanded.npy` | The directed variant. The undirected file would collapse categories 1 and 2 and destroy the analysis. |
| binarization | `> 0` | No weight threshold. A single traced terminal makes a pair "connected", so category counts are sensitive to how the connectome was thresholded upstream. |
| category coding | `B + Bᵀ` | 0 / 1 / 2 = unconnected / unidirectional / bidirectional. |
| triangle | `np.triu_indices(n, k=1)` | Unique pairs only, no diagonal. 2080 pairs at n=65. |
| zero filter | `!= 0` | Drops exact-zero FC values before the test. Cosmetic in practice but it does remove real data — see Pitfalls. |
| histogram bins | 200 | Density estimation grid before smoothing. |
| interpolation grid | 512 points | `np.linspace(fc_min, fc_max, 512)`. |
| `sigma` | 20 | Gaussian smoothing of the interpolated density, in grid points — roughly 4% of the axis. Large; it visibly broadens the curves. Display only. |
| `vmin`, `vmax` | 0, 2 | Fixes gray → category mapping: 0 black, 1 mid-gray, 2 white. |
| `figsize` | (6, 8) | Two panels, `height_ratios=[1, 1]`, `hspace=0.3`. |
| `dpi` | 300 | |

## Expected results

| Category | n | mean FC | s.d. |
|---|---|---|---|
| Unconnected | 10 011 | **0.2425** | 0.2692 |
| Unidirectional | 15 965 | **0.3546** | 0.2769 |
| Bidirectional | 19 021 | **0.5545** | 0.2603 |

One-way ANOVA: **F = 5047.88**, p reported as `0.0`, marker `****`.

The category matrix itself (from the recorded outputs, full 65×65 including both triangles and the
diagonal): 997 entries at 0, 1478 at 1, 1750 at 2.

Headline claim: functional coupling rises monotonically with structural connection complexity —
bidirectional > unidirectional > unconnected.

## Pitfalls

- **The SC path is hard-coded and dead.** `DATA_ROOT` is a literal
  `<data-root>`, with
  no `os.getenv` fallback at all — unlike the sibling Figure2 scripts, this one does not even
  consult `ZEBRAFISH_PATH`. Edit the constant before running.
- **`p_value` is stored as exactly `0.0`.** That is float underflow in `f_oneway`, not a true
  zero probability. Report it as `P < 1e-300` or as "below double precision", never as "P = 0".
  Report this value as `$P < 0.0001$` because floating-point underflow prevents a more precise value.
- **The ANOVA is pseudo-replicated.** Each of the 2080 region pairs contributes 22 values, one
  per larva, and all are treated as independent observations. With n ≈ 45 000 the F statistic is
  inflated by roughly the larva multiplicity; the *ordering* and the effect sizes (0.24 → 0.35 →
  0.55) are the trustworthy result, the F value is not a defensible significance estimate. A
  mixed model with larva as a random effect, or averaging FC per pair before testing, would be
  the stricter analysis.
- **ANOVA assumes equal variances and normality; neither holds cleanly here.** The three s.d.
  values are similar (0.26–0.28), so the homoscedasticity assumption survives, but bounded
  correlation values in [-1, 1] are not normal. Given the effect size this does not change the
  conclusion — say so rather than implying the test was assumption-free.
- **Sample sizes are not multiples of 22.** 10 011 / 22 = 455.05, so the zero/non-finite filter
  removed a handful of values unevenly across larvae. Expected; just do not compute
  "pairs per category" by dividing.
- **The reference implementation's white "Bidirectional" curve is invisible.** Plotted in white on a white
  background, both the curve and its legend entry vanish. The figure-oriented implementation keeps the requested
  white colour but adds a black `patheffects.Stroke(linewidth=4)` outline underneath so it
  reads. Keep this curve visible against the selected background.
- **`aspect='auto'` distorts the matrix panel.** The reference implementation lets the connectivity matrix
  stretch to fill the subplot; the figure-oriented implementation sets `aspect='equal'` so pixels stay square.
- **The figure-oriented implementation writes a shorter `statistics.json`.** Medians, quartiles and the three
  density-peak positions exist only in the reference implementation's dict and are absent from the stored
  file. If you need them, run the reference implementation's statistics block.

## Bundled files

- `scripts/reference_implementation.py` — executable implementation or helper module.
- `scripts/refine_implementation.py` — executable implementation or helper module.
- `scripts/zebrafish_Ca_utils.py` — executable implementation or helper module.
- `references/data_contract.md` — input, output, shape, and indexing contract.
- `references/method_details.md` — parameters, statistical details, and validation notes.

## Usage

```bash
python scripts/refine_implementation.py
```
