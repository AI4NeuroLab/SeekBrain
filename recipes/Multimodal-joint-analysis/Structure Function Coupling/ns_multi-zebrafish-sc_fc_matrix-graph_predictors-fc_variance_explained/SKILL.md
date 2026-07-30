---
name: "ns_multi-zebrafish-sc_fc_matrix-graph_predictors-fc_variance_explained"
description: "Compute ~40 structural graph-theoretic predictors from the zebrafish connectome (shortest path, communicability, search information, mean first passage time, matching index, cosine similarity, adjacency, Euclidean distance and their in/out/all directed variants) via the Predictors class, correlate each one edgewise against the functional connectivity matrix, and rank them by how much FC variance they explain relative to a plain undirected-SC baseline. Reach for this whenever someone asks which network metric best predicts function — 'which structural predictor explains functional connectivity', 'do communication models beat direct wiring', 'compare shortest path vs communicability vs matching index', 'delta explained variance', 'does topology explain FC better than SC weights', 'graph-theoretic predictors of functional connectivity', 'structure-function prediction benchmark'. It writes Figure2_SC_predictors.npy, Figure2_SC_predictor_names.npy, Figure2_SC_predictor_rsquared_single.npy"
triggers:
- "Analyze which structural graph predictor explains functional connectivity best?"
- "Generate which structural graph predictor explains functional connectivity best? outputs"
- "Apply the ns_multi-zebrafish-sc_fc_matrix-graph_predictors-fc_variance_explained recipe"
tags:
- "zebrafish"
- "sc"
- "fc"
- "matrix"
- "graph"
version: "1.0"
---

# Which structural graph predictor explains functional connectivity best?

Builds a battery of ~40 structural predictor matrices from the connectome and the anatomical
distance matrix, scores each against FC by squared Pearson correlation over the upper triangle,
and reports the gain or loss relative to using the raw undirected SC matrix itself.

## When to use this

Use this recipe to rank structural graph predictors by the functional-connectivity variance they explain alone and beyond a baseline model. Do not compare predictors built from inconsistent masks or treat squared correlation as causal evidence.

## Preconditions

- Install NumPy, SciPy, Matplotlib, and any additional packages imported by the selected script.
- Set `ZEBRAFISH_PATH`, `PROCESS_DATA_DIR`, `SAVE_DIR`, and `ATLAS_PATH` when they are referenced; do not rely on fallback paths.
- Provide the input artifacts listed below and validate their shapes, finite values, and shared region ordering before analysis.
- Use the bundled helper modules in `scripts/` when the implementation imports project-specific functions.

## Inputs and outputs

| Direction | File | Shape |
|---|---|---|
| in | `$PROCESS_DATA_DIR/Figure1_FC_matrix.npy` | (65, 65) |
| in | `$ZEBRAFISH_PATH/Files/SC_matrix_directed_terminals_expanded.npy` | (70, 70) |
| in | `$ZEBRAFISH_PATH/Files/SC_matrix_undirected_terminals_expanded.npy` | (70, 70) |
| in | `$PROCESS_DATA_DIR/Figure1_excluded_regions.npy` | (5,) int |
| in | atlas `.regionCentroids['left']`, `['right']` | (70, 3) each |
| out | `$PROCESS_DATA_DIR/Figure2_SC_predictor_names.npy` | (40,) object array of str |
| out | `$PROCESS_DATA_DIR/Figure2_SC_predictors.npy` | (40,) object array of (65, 65) matrices |
| out | `$PROCESS_DATA_DIR/Figure2_SC_predictor_rsquared_single.npy` | (40,) float |
| out | `$PROCESS_DATA_DIR/Figure2_SC_predictor_rsquared_baseline.npy` | scalar |
| out | `$SAVE_DIR/figure.png` (or `figure_refine.png`), `$SAVE_DIR/statistics.json` | |

Full detail in `references/data_contract.md`.

## Procedure

1. Load FC (65×65, already filtered), both 70×70 SC matrices, and the exclusion list.
2. Build the anatomical distance matrix. Take `.regionCentroids['left']` and `['right']`,
   average them elementwise — `centroids_full = 0.5 * (left + right)` — then
   `squareform(pdist(centroids_full, metric='euclidean'))` and zero the diagonal. The
   left/right average collapses each bilateral pair to a midline-symmetric point, which is
   what makes a 70-region (not 140-region) distance matrix meaningful.
3. Decide the filtering direction by comparing FC's width to the atlas's. Because FC arrives at
   65 and the atlas is 70, the script takes the "FC already filtered" branch and applies the
   keep-mask to the two SC matrices and the distance matrix instead. Assert all four end up
   65×65 — three separate asserts guard this, and they are the only thing standing between a
   stale exclusion list and a silently misaligned 40-way comparison.
4. Zero the diagonals of FC and both SC matrices.
5. Instantiate `Predictors(A_dir=sc_directed_filtered, A_und=sc_undirected_filtered,
   ED=distance_filtered, excluded=None, directed=True)`. Pass `excluded=None` — the matrices are
   already pruned, and passing the list again would prune twice.
6. `predictor_model.compute_predictors(directed=True)` populates the object. Read
   `.predictors_names` (list of 40 strings) and `.predictors_list` (list of 40 65×65 matrices).
   Save both as object arrays.
7. Take `np.triu_indices(65, k=1)` — 2080 unique edges — and flatten FC once.
8. For each predictor: flatten with the same indices, mask to entries finite in both vectors,
   and if enough survive compute `pearsonr` and square it. Predictors whose matrices contain
   infinities (shortest path between disconnected nodes, for instance) lose those edges rather
   than the whole predictor, which is why the finite mask is per-predictor and not global.
9. Baseline: the same squared Pearson correlation between FC and the **undirected** SC matrix
   over the same 2080 edges. This is the "raw wiring" reference every predictor is scored
   against.
10. `relative_rsquared = predictor_rsquared - baseline_rsquared`. Positive means the predictor
    beats raw structural weights; negative means it is worse.
11. Bar chart of ΔR², black bars width 0.5, a zero reference line, predictor names rotated 90°,
    top and right spines removed, y-axis `△Exp. var.`.

## Key parameters

| Parameter | Value | Why it matters |
|---|---|---|
| `Predictors(...)` args | `A_dir`, `A_und`, `ED`, `excluded=None`, `directed=True` | `excluded=None` because filtering already happened. Passing the list would double-prune. |
| `compute_predictors` | `directed=True` | Enables the in/out/all directed variants; with `False` the predictor count and names would change. |
| n predictors | 40 | Fixed by the library, not by a parameter here. |
| distance metric | `'euclidean'` on `0.5*(left+right)` centroids | Bilateral averaging, then pdist. Units are atlas voxels. |
| triangle | `np.triu_indices(65, k=1)` | 2080 unique edges, diagonal excluded. |
| valid-data threshold | `> 3` in the reference implementation) / `> 10` in the recommended implementation | Minimum finite edges before computing r. Never binds here — all 40 predictors have thousands of finite edges. |
| baseline | squared Pearson r of FC vs **undirected** SC | The reference point. Using directed SC would change every ΔR². |
| bar `width`, `color` | 0.5, black | |
| zero line | `axhline(0, color='black', linewidth=0.75)` | |
| tick labels | rotation 90, fontsize 7, `ha='right'` in the reference implementation) / `ha='center'` in the recommended implementation | |
| `xlim` | `(-0.5, n-0.5)` | Padding on both sides. |
| `figsize`, `dpi` | `(12, 5)`, `300` | Wide, because 40 rotated labels need the room. |

## Expected results

- **Baseline R² = 0.3225** (undirected SC vs FC; the reference implementation also logged r = 0.5679,
  p = 6.63e-178)
- Single-predictor R² range across the 40: **[0.1132, 0.4214]**
- 40 ΔR² values, ranging from **−0.2093** to **+0.0989**

Selected named predictor results:

| Predictor | ΔR² |
|---|---|
| Matching ind. (all) | **+0.099** |
| Matching ind. (in) | **+0.085** |
| Adjacency | **+0.009** (≈ 0, the sanity check) |
| Mean first passage time | **−0.111** |
| Search information | **−0.172** |
| Shortest path | **−0.209** |

Headline claim: neighbour-similarity metrics (matching index) beat raw structural weights at
predicting FC, while path-length and routing metrics (shortest path, search information) do
worse than the direct connections they were derived from.

Related runs confirming the predictor set is stable: `Predictors` yields a `(4225, 40)`
`.predictors` matrix in both `ns_feat-zebrafish-sc-pca-predictor_dimensionality` and
`ns_multi-zebrafish-sc_ca-pca_pc1-fc_prediction`, whose PCA gives 64.9% variance on PC1.

## Pitfalls

- **The predictor names are lost.** The figure-oriented implementation's `statistics.json` contains only
  `baseline_r2` and a bare 40-element `relative_r2` list — no names, no per-predictor R². The
  reference implementation wrote `predictor_names`, `predictor_correlations` and `predictor_rsquared` dicts,
  but the figure-oriented implementation overwrote the file. The only surviving names are the six quoted in the
  named table above. Positions in the list are therefore not reliably
  interpretable without re-running; if you re-run, save the names alongside the values.
- **`Predictors` defines what the 40 predictors *are*, so use the bundled copy.** Everything
  else in this recipe is reproducible from `numpy` and `scipy`; the core computation is not.
  Do not substitute your own predictor battery and compare numbers against the Expected results
  — the ordering depends entirely on which predictors the library defines. The vendored
  `scripts/zebrafish_Ca_utils_predictors_xps.py` is that definition; a hand-rolled replacement
  is not.
- **`ATLAS_PATH` silently defaults to `$ZEBRAFISH_PATH/Atlas`.** Unique to this script. If
  `ZEBRAFISH_PATH` is also unset, the atlas path is built from the dead hard-coded default and
  the failure comes from `MapzebrainAtlas`, far from the real cause.
- **`.regionCentroids`, not `.centroids`.** Both members exist on `MapzebrainAtlas` and are used
  across this dataset. Substituting one for the other changes every inter-regional distance and
  hence every distance-derived predictor, without raising anything.
- **Baseline and predictors are not independent quantities.** "Adjacency" is essentially the SC
  matrix, so its ΔR² ≈ +0.009 is a self-consistency check, not a result — it should sit near zero
  by construction, and it does. Any large deviation there means the reference implementationline and the predictor
  battery disagree about what the connectome is.
- **ΔR² is descriptive, not a model comparison.** Each predictor is scored by a single squared
  Pearson correlation over 2080 non-independent edges. There is no cross-validation, no
  correction for the 40 comparisons, and no accounting for the fact that predictors are heavily
  intercorrelated (PC1 alone captures 64.9% of their variance, per
  `ns_feat-zebrafish-sc-pca-predictor_dimensionality`). Read the ranking as a ranking; do not
  claim that a +0.099 gain is statistically significant.
- **Edges are not independent observations.** The 2080 upper-triangle entries share 65 nodes, so
  a hub's edges covary. p = 6.63e-178 on the reference implementationline is astronomically optimistic for the same
  reason.
- **The figure-oriented implementation bypasses the FC-shape branch structure.** It always filters the SC and
  distance matrices, then separately decides what to do with FC. Same result here, but the reference implementation
  script's `fc_already_filtered` branch is the more explicit statement of intent.
- **The figure-oriented implementation's `from ... import *` was mandated, not chosen.** The original task
  specification demanded `from zebrafish_Ca_utils_predictors_xps import *`; the reference implementation's
  cleaner `from ... import Predictors` is equivalent. Functionally
  identical.

## Bundled files

- `scripts/reference_implementation.py` — executable implementation or helper module.
- `scripts/refine_implementation.py` — executable implementation or helper module.
- `scripts/zebrafish_Ca_utils.py` — executable implementation or helper module.
- `scripts/zebrafish_Ca_utils_patch_xps.py` — executable implementation or helper module.
- `scripts/zebrafish_Ca_utils_predictors_xps.py` — executable implementation or helper module.
- `references/data_contract.md` — input, output, shape, and indexing contract.
- `references/method_details.md` — parameters, statistical details, and validation notes.

## Usage

```bash
python scripts/refine_implementation.py
```
