# Method details — ns_multi-zebrafish-sc_ca-graph_predictors-fc_variance_explained

## Contents

- [Full parameter list](#full-parameter-list)
- [The `Predictors` class contract](#the-predictors-class-contract)
- [Statistical approach](#statistical-approach)
- [Recorded statistics (`statistics.json`)](#recorded-statistics-statisticsjson)
- [Scientific conclusion supported](#scientific-conclusion-supported)
- [Figure specification](#figure-specification)

## Full parameter list

| Name | Value | Where | Effect |
|---|---|---|---|
| `ROOT_DIR` | `os.getenv("ZEBRAFISH_PATH", "<data-root>")` | module level | Dead hard-coded default; set the env var. |
| `ATLAS_PATH` | `os.getenv("ATLAS_PATH", os.path.join(ROOT_DIR, "Atlas"))` | module level | Derived from `ROOT_DIR` when unset — unique to this script in the set. |
| centroid source | `atlas.regionCentroids['left'|'right']` | distances | **Not** `atlas.centroids`. |
| centroid combination | `0.5 * (left + right)` | distances | Bilateral midpoint per region, giving one (70, 3) array. |
| distance metric | `'euclidean'` | `pdist` | Atlas voxel units. |
| distance diagonal | `np.fill_diagonal(..., 0.0)` | distances | `squareform` already gives a zero diagonal; belt-and-braces. |
| filter branch | `fc_already_filtered = (n_regions_fc < n_regions_atlas)` | preprocessing | 65 < 70 → True, so SC and distance are filtered and FC is left alone. |
| diagonals | `np.fill_diagonal(x, 0.0)` on FC, `sc_directed`, `sc_undirected` | preprocessing | Removes self-loops and FC's unit diagonal before any correlation. The distance matrix is zeroed separately. |
| shape asserts | FC vs directed SC, FC vs undirected SC, FC vs distance | preprocessing | Three asserts. The only guard against a stale exclusion list silently misaligning a 40-way comparison. |
| `Predictors` args | `A_dir=`, `A_und=`, `ED=`, `excluded=None`, `directed=True` | predictors | `excluded=None` because the caller already pruned. Passing the list would prune twice and yield 60 regions. |
| `compute_predictors` | `directed=True` | predictors | Enables the in/out/all directed variants. `False` would change both count and names. |
| n predictors | 40 | fixed by the library | Not a tunable parameter of this script. |
| object-array saves | `np.array(x, dtype=object)` for names and matrices | save | Both require `allow_pickle=True` to read back. |
| triangle | `np.triu_indices(fc.shape[0], k=1)` | correlation | 2080 unique edges at N=65. |
| finite mask | `np.isfinite(fc_upper) & np.isfinite(pred_upper)`, per predictor | correlation | Non-finite predictor entries (unreachable pairs in path-based metrics) drop those edges only. |
| minimum valid count | `valid_mask.sum() > 3` (base) / `np.sum(mask) > 10` (refine) | correlation | Never binds — all 40 predictors retain thousands of edges. Fallback is `np.nan`. |
| R² | `pearsonr(...)[0] ** 2` | correlation | Squared correlation, not a fitted model's R². |
| baseline | `pearsonr(fc_upper, sc_und_upper)[0] ** 2` over the same edges | baseline | Undirected SC, not directed. Changing this shifts all 40 ΔR² by a constant. |
| ΔR² | `predictor_rsquared - baseline_rsquared` | relative variance | Elementwise subtraction of a scalar. |
| bar `width`, `color` | `0.5`, `'black'` | figure | |
| zero line | `axhline(0, color='black', linewidth=0.75, linestyle='-')` | figure | Represents the undirected-SC baseline. |
| tick labels | `rotation=90`, `fontsize=7`, `ha='right'` in the reference implementation) / `ha='center'` in the recommended implementation | figure | See "Base vs refine". |
| `xlim` | `(-0.5, len(names) - 0.5)` | figure | Half-bar padding either side. |
| y label | `"△Exp. var."`, fontsize 10 (base) / default (refine) | figure | |
| spines | top and right hidden | figure | |
| `figsize`, `dpi` | `(12, 5)`, `300` | figure | Wide, to fit 40 rotated labels. `bbox_inches='tight'`. |

## The `Predictors` class contract

Documented in full in `references/data_contract.md`. Summary, since three recipes depend on it:

```python
model = Predictors(A_dir, A_und, ED, excluded=None, directed=True)
model.compute_predictors(directed=True)

model.predictors_names   # list[str],   len 40
model.predictors_list    # list[(N,N)], len 40
model.predictors         # (N*N, 40) float — flattened full matrices as columns, (4225, 40) at N=65
```

`.predictors_list` is the per-edge view used here; `.predictors` is the multivariate view used by
`ns_feat-zebrafish-sc-pca-predictor_dimensionality` and
`ns_multi-zebrafish-sc_ca-pca_pc1-fc_prediction`. Both are populated by the same
`compute_predictors` call. The class also accepts positional construction
`Predictors(A_dir, A_und, ED)`, so `excluded` and `directed` both have defaults.

`zebrafish_Ca_utils_predictors_xps.py` is vendored into this recipe's `scripts/` directory (along
with `zebrafish_Ca_utils.py` and its transitive dependency `zebrafish_Ca_utils_patch_xps.py`), so
the 40 predictors are exactly those the reference implementation used. Use that copy; do not substitute a
hand-rolled battery and compare against the numbers below.

## Statistical approach

**Edgewise squared correlation.** Every predictor is scored by a single `pearsonr(...)²` over the
2080 upper-triangle edges. This measures linear association between the predictor matrix and FC —
it is not a fitted regression, and R² here is just r² by definition.

**The reference implementationline.** The undirected SC matrix's own r² against FC, 0.3225. Subtracting it converts
each predictor's absolute score into "does this beat raw wiring". The "Adjacency" predictor,
being essentially the SC matrix, lands at ΔR² ≈ +0.009 — near zero, as it must, which is the
built-in consistency check on the whole comparison.

**Assumptions and what they cost:**

1. *Edges are not independent.* The 2080 entries share 65 nodes; a hub's edges covary strongly.
   The reference implementationline's p = 6.63e-178 is astronomically optimistic for this reason. No p values are
   reported per predictor, which is the right call.
2. *No multiple-comparison correction.* Forty predictors are compared against one baseline with
   no adjustment. Since no per-predictor significance is claimed, this is defensible — but it
   means a ΔR² of +0.099 cannot be called "significantly better than baseline".
3. *Predictors are heavily intercorrelated.* PCA on the same predictor matrix
   (`ns_feat-zebrafish-sc-pca-predictor_dimensionality`) gives 64.9% of variance on PC1 alone
   and 89.3% in four components. The 40 bars are therefore not 40 independent tests of 40
   independent ideas; they are a handful of underlying factors sampled repeatedly.
4. *No cross-validation.* All R² values are in-sample. There is no held-out estimate of
   predictive power anywhere in this analysis.
5. *Per-predictor finite masks.* Because non-finite entries are dropped per predictor, the 40 R²
   values are technically computed on slightly different edge subsets. Immaterial for large
   differences, relevant when comparing two predictors within a few thousandths.

Read the output as a **ranking**, which is what the conclusion claims, not as a model
comparison with error bars.

## Recorded statistics (`statistics.json`)

Verbatim, from the source run. This is the **refine** script's two-key dict — the 40 values are
in `.predictors_names` order, but those names are not stored:

```json
{
  "baseline_r2": 0.3224725309974822,
  "relative_r2": [
    -0.10322983433708713,
    -0.11280394142444736,
    -0.1397776687151981,
    -0.20928436803293135,
     0.0150915038664714,
     0.03969841284331482,
     0.05965429474810685,
     0.08428792987483491,
     0.08454356293610116,
     0.009368970418873857,
    -0.0988793998842745,
    -0.1431107383211763,
     0.036447636016685325,
    -0.0314775041947703,
     0.03179394389004736,
    -0.03789777399729466,
    -0.022762653789945686,
     0.014899790726575046,
    -0.015462740096181038,
    -0.03177497840588617,
     0.07469496420229033,
     0.012815522525589873,
    -0.013889785064657878,
    -0.01449803568094521,
    -0.019644702600961572,
    -0.019544758790605465,
    -0.019049716946856976,
    -0.018875432808292014,
    -0.03540528051013253,
    -0.04415692713955732,
    -0.17221669484561183,
    -0.11076396676338857,
    -0.11076126938704811,
    -0.11073887769816165,
    -0.11280079218639216,
    -0.09194968084172098,
    -0.151708183343646,
     0.02570060332956625,
     0.0989427022811819,
    -0.17681008411588184
  ]
}
```

**The predictor names are lost.** The reference implementation's `statistics.json` carried
`predictor_names` (list of 40), `predictor_correlations` (name → r), `predictor_rsquared`
(name → R²), all four matrix shapes before and after exclusion, and
`relative_rsquared_{mean,median,std}`. The figure-oriented implementation run overwrote the file with the two keys above.
Only these names survive, from the stated requirement and the figure description:

| Predictor | ΔR² | Likely index |
|---|---|---|
| Matching ind. (all) | +0.0989 | 38 |
| Matching ind. (in) | +0.0845 | 8 (or 7, +0.0843 — the stated requirement rounds both to ≈ +0.085) |
| Adjacency | +0.0094 | 9 |
| Mean first passage time | ≈ −0.1108 | 31–33 (three near-identical values) |
| Search information | −0.1722 | 30 |
| Shortest path | −0.2093 | 3 |

The index column is inference from value matching, not recorded fact. Treat it as a hint. If you
re-run, use the reference implementation so the names are saved.

Printed by the reference implementation but not stored (`exec.log`):

- `Loaded FC matrix: (65, 65)`, `Loaded SC directed: (70, 70)`, `Loaded SC undirected: (70, 70)`
- `Atlas regions: 70, FC regions: 65, SC regions: 70`
- `FC matrix appears already filtered. Removing excluded regions from SC and distance matrices...`
- `All matrices aligned: (65, 65)`
- `Computed 40 structural predictors`
- `Single predictor R² range: [0.1132, 0.4214]`
- `Baseline SC-FC: r=0.5679, R²=0.3225, p=6.63e-178`

Cross-run corroboration that the predictor set is stable: `.predictors` is `(4225, 40)` in both
`ns_feat-zebrafish-sc-pca-predictor_dimensionality` and
`ns_multi-zebrafish-sc_ca-pca_pc1-fc_prediction`, both computed from the same 65-region filtering.

## Scientific conclusion supported

From `conclusions.json`:

> In the analysis of zebrafish brain network coupling, structural predictors based on the matching
> index (quantifying the similarity of connectivity profiles) explain a greater proportion of
> functional connectivity variance than the reference implementationline structural connectivity weights (positive
> ΔR²), whereas path-length-dependent metrics such as shortest path and search information explain
> less variance than the direct structural connections alone.

The workflow description's interpretation, worth carrying forward: functional connectivity is better predicted
by *structural homophily* — regions sharing similar input/output profiles couple more strongly —
than by *communication efficiency* along shortest or most-searchable routes. The failure of
routing metrics to beat raw adjacency argues against a model in which activity propagates
primarily along efficient polysynaptic paths.

## Figure specification

Wide landscape figure, 12×5 in at 300 dpi, single axes.

Bar chart of the 40 ΔR² values at `x = np.arange(40)`, solid black bars of width 0.5. A horizontal
black reference line at `y = 0` (`linewidth=0.75`) marks the undirected-SC baseline — bars above
it beat raw wiring, bars below it do worse.

X axis: one tick per predictor, labelled with `predictors_names`, rotated 90°, fontsize 7. Limits
`(-0.5, 39.5)` so the first and last bars get half-bar padding. Y axis: labelled `△Exp. var.`,
observed range roughly −0.21 to +0.10 (the figure review reported the rendered axis as ≈ −0.10 to
+0.25, which does not match the stored values — trust the stored values).

Top and right spines removed. `tight_layout`, saved with `bbox_inches='tight'`.

No rendering failure was found in the figure itself; the figure-oriented implementationment pass changed only the tick
label horizontal alignment and the import style.
