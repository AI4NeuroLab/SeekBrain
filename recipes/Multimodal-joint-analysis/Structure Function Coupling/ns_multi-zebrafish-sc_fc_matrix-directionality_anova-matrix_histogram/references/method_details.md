# Method details — ns_multi-zebrafish-sc_ca-anova-directionality_effect

## Contents

- [Full parameter list](#full-parameter-list)
- [Statistical approach](#statistical-approach)
- [Recorded statistics (`statistics.json`)](#recorded-statistics-statisticsjson)
- [Scientific conclusion supported](#scientific-conclusion-supported)
- [Figure specification](#figure-specification)

## Full parameter list

| Name | Value | Where | Effect |
|---|---|---|---|
| `DATA_ROOT` | `<data-root>` | module constant | Hard-coded, no env fallback. Dead mount — must be patched. |
| SC variant | `SC_matrix_directed_terminals_expanded.npy` | load | The directed connectome. Using the undirected file would make every connected pair category 2. |
| `allow_pickle` | `True` | both `np.load` calls for SC and the excluded list | Not required by these arrays; harmless. |
| binarization threshold | `> 0` | `SC_binary = (SC_directed > 0)` | No weight cut-off. Category assignment therefore inherits whatever thresholding produced the terminal-expanded connectome. |
| category formula | `SC_binary + SC_binary.T` | categorization | Yields {0,1,2}, symmetric. |
| triangle | `np.triu_indices(n_regions, k=1)` | extraction | 2080 unique pairs at n=65; diagonal excluded. |
| value filter | `(x != 0) & np.isfinite(x)` | after pooling | Removes exact zeros and NaN/inf. |
| ANOVA | `scipy.stats.f_oneway(unconn, unidir, bidir)` | statistics | Argument order sets nothing but readability; F is order-invariant. |
| significance thresholds | 0.05 / 0.01 / 0.001 / 0.0001 → `*` / `**` / `***` / `****`, else `ns` | marker | |
| histogram `bins` | `200` | `compute_smoothed_density` | Density estimated on 200 bins, `density=True`. |
| interpolation grid | `np.linspace(fc_min, fc_max, 512)` | density panel | Shared grid across all three categories, spanning the global min/max of the pooled values. |
| `sigma` | `20` | `gaussian_filter1d` | In grid points, i.e. ~20/512 ≈ 4% of the x-range. Heavy smoothing; it is a display choice and does not touch the saved arrays or the ANOVA. |
| `np.interp` fill | `left=0, right=0` | density panel | Densities go to zero outside each category's own histogram support. |
| `cmap` | `'gray'` | matrix panel | |
| `vmin`, `vmax` | `0`, `2` | matrix panel | Pins 0→black, 1→mid-gray, 2→white. Without these the mapping would rescale per-panel. |
| `aspect` | `'auto'` (base) / `'equal'` (refine) | matrix panel | See "Base vs refine". |
| upper-triangle mask | `np.triu_indices(n, k=0)` → NaN | matrix panel | Masks the diagonal as well as the upper triangle. |
| legend placement | `x = n*0.75`, `y = n*0.15`, steps of `n*0.08` | matrix panel | Data coordinates, three `ax.text` calls with coloured `bbox` swatches. Scales with `n`, so it survives a different region count. |
| line widths | `2` (density curves), `1.5` (significance bar), `4` (refine's black stroke under the white curve) | density panel | |
| fill `alpha` | `0.3` | density panel | Fills under all three curves. |
| significance bar `y` | `max_density * 1.1`, text at `bar_y * 1.05` | density panel | Spans the unconnected peak to the bidirectional peak. |
| `figsize` | `(6, 8)` | figure | `add_gridspec(2, 1, height_ratios=[1, 1], hspace=0.3)` |
| `dpi` | `300` | save | `bbox_inches='tight'` |

## Statistical approach

**Categorical predictor from a directed graph.** Binarizing the directed SC matrix and adding
its transpose is a compact way to count how many of the two possible directed edges exist
between a pair. It discards all weight information — a pair joined by one very strong
projection and a pair joined by one very weak one both land in category 1.

**One-way ANOVA.** `f_oneway` compares the means of the three pooled FC distributions.
Two assumptions deserve explicit statement:

1. *Independence.* Violated. Each of the 2080 region pairs appears once per larva, 22 times in
   total, and the same anatomical pair is strongly correlated with itself across larvae (that is
   the whole finding of `ns_ana-zebrafish-ca-triu_pearson-network_stereotypy`). The effective
   sample size is closer to 2080 than to 45 000, so the stated requiremented F is inflated. The rank ordering
   and the mean differences are robust; the F statistic and P value are not defensible as
   calibrated inference. A larva-level random effect, or averaging each pair across larvae
   before testing, is the stricter route.
2. *Normality and equal variance.* FC values are bounded correlations, not normal. The three
   standard deviations (0.269, 0.277, 0.260) are close enough that heteroscedasticity is not a
   concern. Given effect sizes of 0.11 and 0.20 correlation units between adjacent categories,
   the conclusion does not hinge on the parametric assumptions.

**No post-hoc test.** The ANOVA is omnibus only — it says the three means are not all equal, not
which pairs differ. The figure's single significance bar is drawn between the unconnected and
bidirectional peaks, but no pairwise test backs it. If pairwise claims matter, add Tukey HSD or
Games-Howell.

**The zero filter.** `x != 0` was specified in the original task ("remove any zero values"). For
continuous Pearson correlations an exact zero is essentially measure-zero, so this mostly removes
padding/NaN artifacts. It is nonetheless a filter on the response variable and would bias results
if the FC pipeline ever wrote structural zeros for unsampled pairs.

## Recorded statistics (`statistics.json`)

Verbatim, from the source run:

```json
{
  "sample_sizes": {
    "unconnected": 10011,
    "unidirectional": 15965,
    "bidirectional": 19021
  },
  "means": {
    "unconnected": 0.24246971812539989,
    "unidirectional": 0.3545929008900852,
    "bidirectional": 0.5545347086161025
  },
  "std_devs": {
    "unconnected": 0.2692153383797925,
    "unidirectional": 0.27689910364610043,
    "bidirectional": 0.26026187858451294
  },
  "anova_test": {
    "f_statistic": 5047.881242339335,
    "p_value": 0.0,
    "significance_marker": "****"
  }
}
```

This is the **refine** script's dict. The reference implementation additionally writes `medians`,
`percentiles` (25th/75th per category) and `peak_densities` (the grid position of each smoothed
curve's argmax); those blocks were overwritten when the figure-oriented implementation run executed and are not
recoverable from the output file.

`p_value: 0.0` is double-precision underflow inside `f_oneway`, not a true zero. Quote it as
`P < 1e-300` or simply `P < 0.0001`, as the stated requirement does.

Additional numbers printed by the run but not stored in JSON (from `exec.log`, identical in the
base and refine runs):

- SC matrix `(70, 70)` → `(65, 65)` after removing 5 regions
- FC stack loaded at `(22, 65, 65)`; no re-exclusion applied
- Category counts over the full 65×65 matrix: `0 = 997`, `1 = 1478`, `2 = 1750`
- `One-way ANOVA: F=5047.8812, P=0.0000e+00`

## Scientific conclusion supported

From `conclusions.json`:

> The functional connectivity strength between zebrafish brain regions is significantly
> modulated by the existence and directionality of structural connections, with bidirectionally
> connected regions exhibiting the highest mean correlation (0.55), followed by unidirectionally
> connected regions (0.35), and structurally unconnected regions showing the lowest baseline
> coupling (0.24), as confirmed by a one-way ANOVA (F ≈ 5047.88, P < 0.0001).

The workflow description adds the interpretive point worth carrying forward: unconnected pairs still show
substantial coupling (mean 0.24), which is attributable to indirect polysynaptic pathways and
common input rather than to noise.

## Figure specification

Portrait figure, 6×8 in, two vertically stacked panels of equal height, `hspace=0.3`.

**Top panel — structural connection matrix.** The 65×65 category matrix with the upper triangle
*including the diagonal* set to NaN, drawn with `imshow(cmap='gray', vmin=0, vmax=2)`. Category
0 renders black, 1 mid-gray, 2 white; masked cells fall through to the figure background. Top
and right spines hidden, all ticks and tick labels removed. A three-entry inline legend sits in
the empty upper-right of the axes at data coordinates `(0.75n, 0.15n)` and two further rows
`0.08n` apart, each an `ax.text` with a rounded `bbox` in the category's own colour (`0:
Unconnected` white-on-black, `1: Unidirectional` black-on-gray, `2: Bidirectional`
black-on-white), `alpha=0.8`, fontsize 8.

**Bottom panel — FC density distributions.** Three Gaussian-smoothed density curves on a shared
512-point grid spanning the pooled min to max: unconnected black, unidirectional gray,
bidirectional white (with a black outline in the axes-anchored implementation), all `linewidth=2`, each with a
matching `fill_between` at `alpha=0.3` (black / gray / lightgray). A horizontal significance bar
at `1.1 ×` the global peak density runs from the unconnected curve's peak x-position to the
bidirectional curve's peak x-position, with the asterisk marker centred just above it. Top and
right spines hidden. X-axis `Edge strength (FC)`, y-axis `Density`, both fontsize 12. Legend
frameless, fontsize 10.

The known rendering failures — invisible white curve and a stretched matrix — are recorded in
`RECIPE.md` Pitfalls.
