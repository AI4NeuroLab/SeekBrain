# Method details — ns_vis-zebrafish-sc-eigen_spectrum-sc_scree_plot

## Contents

- [Full parameter list](#full-parameter-list)
- [Statistical approach](#statistical-approach)
- [Recorded statistics (`statistics.json`)](#recorded-statistics-statisticsjson)
- [Implementation requirements](#implementation-requirements)
- [Scientific conclusion supported](#scientific-conclusion-supported)
- [Output requirements](#output-requirements)
- [Relationship to sibling recipes](#relationship-to-sibling-recipes)


## Full parameter list

| Name | Value | Where | Effect |
|---|---|---|---|
| `figsize` | `(5, 5)` | `plt.subplots` | From the required configuration. |
| line `color` | `'black'` | `ax.plot` | |
| `linewidth` | `1` | `ax.plot` | |
| `marker` | `'.'` | `ax.plot` | |
| `markersize` | `1` | `ax.plot` | At size 1 the markers are essentially invisible; the line carries the shape. Spec'd explicitly, so keep it. |
| x index base | `1` | `np.arange(1, N + 1)` | 1-based "Gradient #". |
| `xlim` | `[-1, 51]` | `ax.set_xlim` | Crops to the leading 50 of 69 eigenvalues. |
| `xticks` | `[1, 50]` | `ax.set_xticks` | Endpoints only. |
| xlabel | `"Gradient #"` | | |
| y bottom | `-0.05` | `ax.set_ylim` | Hard floor, spec'd. Load-bearing: the spectrum reaches −0.187, so a floor of 0 would clip most of the tail. Even at −0.05 the deepest values are still cut off. |
| y top | `np.max(eigenvalues) * 1.05` | `ax.set_ylim` | 5 % headroom above 0.6387 → ≈ 0.6707. |
| ylabel | `"Eigenvalue"` | | |
| spines | `top` and `right` set invisible | | |
| `dpi` | `300` | `savefig` | |
| `bbox_inches` | `'tight'` | `savefig` | Preceded by `plt.tight_layout()`. |
| output name | `figure.png` (base) / `figure_refine.png` (refine) | | |
| size assertion | `eigenvalues.size >= 50` (base only) | | Hard failure, tied to the cosmetic `xlim`. |
| `allow_pickle` | `True` (both) | `np.load` | Unnecessary for a plain float array. |

No thresholds, seeds, sigmas, percentiles or permutation counts exist in this recipe — it
performs no inference.

## Statistical approach

There is none, in the inferential sense. The recipe computes six descriptive summaries of a
spectrum that was produced elsewhere and draws it.

**What the plot is for.** A scree plot answers "where does the spectrum stop being
informative". Here the answer is read off the elbow: the first eigenvalue is 0.639, and the
values fall steeply over roughly the first five indices before flattening into a long,
low-magnitude, partly negative tail. That justifies keeping only the leading gradients when
comparing SC against FC organisation.

**Why cumulative-variance reasoning does not apply.** In PCA the eigenvalues are variances —
non-negative, summing to the total variance, so "gradient *k* explains *x* %" is well defined.
Diffusion map embedding provides no such guarantee: the operator is built from a
density-normalised affinity matrix that has had its diagonal zeroed, is not positive
semi-definite, and in the FC case is built from a matrix containing negative correlations. The
resulting spectrum here has:

- mean **−0.005007**
- median **−0.021169** (i.e. more than half the eigenvalues are negative)
- minimum **−0.186719**

`np.cumsum` over such a spectrum is non-monotonic and its total is a small number near zero, so
dividing by it and calling `np.searchsorted` produces arbitrary indices. The base script does
exactly this and the results are not interpretable. The refine script removes them.

The same failure is visible, and documented, in the functional sibling
`ns_vis-zebrafish-ca-eigen_spectrum-fc_scree_plot`, whose stored `statistics.json` retains
cumulative-variance fields that are all `0.0` with `gradients_for_50/80/90pct_variance` all
equal to 64. Do not quote those, and do not reintroduce the calculation here.

Report the spectrum qualitatively — first value, elbow location, presence of a negative tail —
and cite `first_eigenvalue`, `max`, `min`, `mean`, `median` as the quantitative summary.

## Recorded statistics (`statistics.json`)

Verbatim, as stored in the source directory (this is the refine script's six-field version):

```json
{
  "n_eigenvalues": 69,
  "first_eigenvalue": 0.6387332312244718,
  "mean_eigenvalue": -0.005007237508854417,
  "median_eigenvalue": -0.021168811736469607,
  "min_eigenvalue": -0.186718534616406,
  "max_eigenvalue": 0.6387332312244718
}
```

`max_eigenvalue == first_eigenvalue` confirms the spectrum arrives in descending order. That
equality is a useful cheap check on the upstream artifact; if it ever fails, the eigenvalues
were sorted or filtered between recipes.

`mean_eigenvalue` is bit-identical to `sc_eigenvalues_mean` in
`ns_multi-zebrafish-sc_ca-diffusion_map-connectivity_gradient`'s `statistics.json`
(−0.005007237508854417). Use that as the staleness check on
`Figure6_SC_eigenvalues.npy`.

`n_eigenvalues = 69` matches the first axis of `Figure6_SC_gradients.npy`, shape (69, 65).
Both derive from `n_components=69` in the upstream diffusion mapping, not from any region
count.

### Fields the base script writes and the refine script deletes

The base script's `statistics.json` has 20 fields. The 14 extra ones:

`std_eigenvalue`, `eigenvalue_range` (`np.ptp`), `p25_eigenvalue`, `p50_eigenvalue`,
`p75_eigenvalue`, `p90_eigenvalue`, `p95_eigenvalue`, `first_10_eigenvalues` (list),
`decay_ratio_first_to_last`, and
`n_eigenvalues_for_{50,80,90,95}pct_variance`.

Of these:

- The percentiles, `std`, `ptp` and `first_10_eigenvalues` are harmless and arguably useful —
  `first_10_eigenvalues` in particular localises the elbow numerically. They were dropped for
  brevity, not because they are wrong.
- `decay_ratio_first_to_last = eigenvalues[0] / eigenvalues[-1]` is **invalid**: the last
  eigenvalue is negative, so the ratio is negative and describes nothing.
- `n_eigenvalues_for_*pct_variance` is **invalid** for the cumulative-sum reason above.

The stored file is the refine version, so none of these appear in it.

## Implementation requirements

Visual inspection identified three issues, all addressed:

1. **Unused imports.** The base points `sys.path` at its own directory and wildcard-imports
   `zebrafish_Ca_utils`, `zebrafish_Ca_stats_patch_xps`, `zebrafish_Ca_utils_patch_xps`,
   `zebrafish_Ca_utils_predictors_xps`, `zebrafish_Ca_visualization_patch_xps` — all five
   vendored into `scripts/`, and it calls nothing from any of them. The imports therefore
   resolve, but they still cost the five modules' own heavy third-party dependencies (`numba`,
   `bctpy`, `networkx`, `hdbscan`, `opencv-python`) at load time for no return. The refine
   script removes the path line and all five imports, leaving `os`, `sys` (now itself unused),
   `json`, `numpy`, `matplotlib.pyplot`. **This is what makes the refine script
   dependency-light and runnable off numpy and matplotlib alone**, given only the input
   array. It is one of three such scripts in the set, alongside
   `ns_ana-zebrafish-ca-mannwhitney-fingerprint_significance` and
   `ns_vis-zebrafish-ca-eigen_spectrum-fc_scree_plot`.
2. **Output filename.** `figure.png` → `figure_refine.png`.
3. **Load robustness.** `np.load(...).astype(float)` with `assert ndim == 1` becomes
   `np.real(np.squeeze(np.load(...))).astype(float)` with a post-squeeze `ValueError` check.
   This tolerates a `(N, 1)` shape and a complex dtype, both of which an eigensolver can
   legitimately return.

Not mentioned in the critique but also changed:

4. The `assert eigenvalues.size >= 50` guard is dropped.
5. The statistics dict is trimmed from 20 fields to 6, removing the two invalid ones.
6. `ax.set_ylim([y_min, y_max])` becomes `ax.set_ylim(bottom=y_min, top=y_max)`;
   `eigenvalues.max()` becomes `np.max(eigenvalues)`; the summaries are guarded with
   `if n_eigenvalues > 0 else None`. Cosmetic.

The figure itself is byte-for-byte equivalent in intent — no styling parameter changed. The
refinement here was entirely about dependencies and robustness, not about a rendering error.

**Use the refine script.**

## Scientific conclusion supported

> The eigenvalues of the structural connectivity (SC) gradients exhibit a rapid decay across
> the first few components (approximately gradients 1 to 5), indicating that the primary
> topological organization of the structural network is effectively captured by a
> low-dimensional embedding.

The report adds that this decay profile is consistent with small-world biological networks, and
correctly notes that "the presence of negative eigenvalues in the tail may reflect specific
properties of the normalized similarity matrix or Laplacian used in the gradient
decomposition". Its Conclusion line — "the first few gradients capture the majority of the
variance" — overstates what the data can support, for the reasons in "Statistical approach"
above; the decay is real, the variance fraction is not computable from this spectrum.

The elbow location ("approximately gradients 1 to 5") is a visual reading. Nothing in either
script computes an elbow, a knee point, or a component count.

## Output requirements

The output must satisfy these requirements:

1. Load the SC eigenvalues from `PROCESS_DATA_DIR/Figure6_SC_eigenvalues.npy`.
2. `figsize=(5, 5)`.
3. Line plot: x = eigenvalue index (1 to N), y = eigenvalue.
4. Styling: black line, linewidth 1, marker size 1; `xlim=[-1, 51]`, `xticks=[1, 50]`, xlabel
   "Gradient #"; y-axis starting at −0.05, ylabel "Eigenvalue"; top and right spines invisible.

There was no rendering failure to correct — the critique concerned imports, the output
filename, and load robustness only.

## Relationship to sibling recipes

- **Upstream:** `ns_multi-zebrafish-sc_ca-diffusion_map-connectivity_gradient` (Figure 6A)
  produces `Figure6_SC_eigenvalues.npy` along with three other artifacts. Any change to its
  `alpha`, `n_components`, or matrix cleaning propagates directly into this plot.
- **Functional counterpart:** `ns_vis-zebrafish-ca-eigen_spectrum-fc_scree_plot` (Figure 6D)
  is the same analysis on `Figure6_FC_eigenvalues.npy` (64 values, mean −0.012640). Its stored
  statistics still carry the degenerate cumulative-variance fields that this recipe's refine
  script removed — a direct illustration of the pitfall.
- **Downstream:** nothing. This recipe writes no artifacts.
- The elbow shown here is the practical justification for
  `ns_multi-zebrafish-sc_ca-hungarian_matching-gradient_correspondence` comparing only leading
  components rather than all 69.
