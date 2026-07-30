# Method details — ns_multi-zebrafish-sc_ca-hungarian_matching-gradient_correspondence

## Contents

- [Full parameter list](#full-parameter-list)
- [Statistical approach and assumptions](#statistical-approach-and-assumptions)
- [Recorded statistics (`statistics.json`)](#recorded-statistics-statisticsjson)
- [Scientific conclusions supported](#scientific-conclusions-supported)
- [Figure specification](#figure-specification)

## Full parameter list

| Name | Value | Where | Effect |
|---|---|---|---|
| number of modes | `50` | `sc_gradients[:50, :]`, `fc_gradients[:50, :]` | How many leading gradients enter the comparison. The task spec justifies 50 as the point by which "eigenvalues quickly decayed". Because the assignment is global, changing this does not merely crop the matrix — it can change which SC↔FC pairs are selected. |
| `method` | `'pearson'` | `compute_mode_similarity_matrix(..., method='pearson')` | Linear correlation across the 65 regions. `'spearman'` is implemented but unused; it would make the result rank-based and insensitive to a few extreme-loading regions. |
| `return_mapping` | `True` | same call | Makes the function return `(sorted_corrs, mapping)` instead of just the matrix. |
| cost matrix | `1 - np.abs(corrs)` | inside the helper | The objective for the assignment. Absolute value makes the matching invariant to eigenvector sign. |
| solver | `scipy.optimize.linear_sum_assignment` | inside the helper | Exact minimum-cost one-to-one assignment (Hungarian / Jonker-Volgenant). No parameters, no randomness, no seed — the result is deterministic given the inputs. |
| kept output of solver | `col_ind` (second return value) | `_, mapping = linear_sum_assignment(...)` | `row_ind` is discarded because it is the identity `0..49` for a square cost matrix. |
| display transform | `np.abs(correlations)` (base) / `np.abs(correlations).T` (refine) | plotting | Absolute value for colour; the transpose in the figure-oriented implementation fixes the axis semantics. |
| `figsize` | `(5, 5)` | `plt.subplots` | Square, per the figure spec. |
| `cmap` | `'Reds'` | `imshow` | Sequential — appropriate because the plotted quantity is \|r\| ∈ [0, 1], one-sided. |
| `aspect` | `'equal'` | `imshow` | Keeps cells square. |
| vmin / vmax | not set | `imshow` | The colour scale autoscales to the data, topping out near \|r\| ≈ 0.63 for the recorded dataset. A re-run on different data will rescale, so the visual "strength" of the diagonal is not comparable across runs. |
| tick positions | `[0, 49]` labelled `['1', '50']` | figure-oriented implementation | End IDs only. |
| `tick_params(length=0)` | — | figure-oriented implementation | Satisfies "remove all ticks" while keeping the labels anchored. |
| colorbar | `fraction=0.046`, `pad=0.04`, label `"Gradient similarity \|r\|"`, `rotation=270`, `labelpad=20` | both | |
| `dpi` | `300`, `bbox_inches='tight'` | `savefig` | |

No seed, no threshold, no percentile, no permutation count — the method is fully deterministic.

## Statistical approach and assumptions

**Similarity.** Pearson r between an SC mode and an FC mode, each a length-65 vector of
per-region loadings. n = 65 for every correlation, so all entries are equally powered. The
p-value returned by `pearsonr` is discarded and no multiple-comparison correction is applied —
there is no hypothesis test here, only a descriptive similarity matrix.

**Sign invariance.** A diffusion-map / eigendecomposition gradient is defined only up to a
global sign flip: if `v` is an eigenvector so is `-v`, and the embedding they produce is
identical. Whichever sign the solver happened to emit is arbitrary. The matching therefore
scores on `|r|`, so an SC/FC pair correlating at r = -0.8 is treated as exactly as good a
match as one at r = +0.8. Scoring on signed r would discard roughly half the true
correspondences purely on a numerical convention. The consequence is visible in the recorded
statistics: `correlation_mean` = 0.0047 (signed, essentially zero from sign cancellation)
against `abs_correlation_mean` = 0.0997.

**One-to-one constraint.** `linear_sum_assignment` finds the permutation minimising total
cost, i.e. maximising Σ|r| along the diagonal, with each FC mode used exactly once. This is
the "optimal linear mapping" the task asks for. A greedy alternative — take each SC mode's
best FC partner independently — would let several SC modes collapse onto one popular FC mode
and would not produce a permutation. The trade-off is that the Hungarian solution optimises
the *total*, so an individual pair may be matched to a slightly worse partner in order to free
up a better global assignment; per-pair values are not each individually maximal.

**Interpretive caveat.** The permutation guarantees a diagonal exists. A structured-looking
diagonal is therefore not by itself evidence of SC–FC correspondence — even unrelated random
modes would produce one. The evidence is the contrast between diagonal magnitude and the
off-diagonal background (`abs_correlation_mean` ≈ 0.0997). This run produces no null model
against which to test that contrast.

## Recorded statistics (`statistics.json`)

The output file, verbatim:

```json
{
  "n_modes": 50,
  "correlation_mean": 0.004672124152915211,
  "abs_correlation_mean": 0.0996670268028613,
  "diagonal_mean": 0.06096144556390645
}
```

These four fields come from the **refine** script. The reference implementation computes a larger dict that
was overwritten:

```python
{
  "n_modes", "correlation_matrix_shape", "correlation_min", "correlation_max",
  "correlation_mean", "correlation_std", "abs_correlation_min", "abs_correlation_max",
  "abs_correlation_mean", "abs_correlation_std", "diagonal_correlations",
  "diagonal_mean", "diagonal_std"
}
```

The per-mode `diagonal_correlations` list (50 floats) and every min/max/std field are
therefore **not preserved** anywhere in the source directory. Recompute them from
`Figure6_FC_SC_gradients_correlations.npy` if needed.

How to read the three numbers:

- `correlation_mean` ≈ 0.0047 — mean of the signed 50×50 matrix. Near zero is the expected
  outcome of arbitrary eigenvector signs, not a finding.
- `abs_correlation_mean` ≈ 0.0997 — mean |r| over all 2500 entries. Treat this as the
  background level against which the diagonal should be compared.
- `diagonal_mean` ≈ 0.0610 — mean of the **signed** diagonal `correlations[i, i]`. Because it
  is signed, it is depressed by cancellation and lands *below* the absolute background. It is
  not a measure of match quality and must not be quoted as one. The corresponding mean |r| on
  the diagonal is not recorded.

Shapes logged during the run (`exec.log`): SC gradients `(69, 65)`, FC gradients `(64, 65)`,
sliced modes `(50, 65)` each, correlation matrix `(50, 50)`, mapping `(50,)`.

## Scientific conclusions supported

From `conclusions.json`:

> The absolute Pearson correlation matrix between the first 50 structural connectivity (SC)
> and functional connectivity (FC) gradients displays a prominent diagonal structure after
> optimal reordering, indicating a one-to-one spatial correspondence where specific structural
> eigenmodes serve as the geometric basis for functional connectivity patterns.

> The linear alignment between structural connectivity (SC) and functional connectivity (FC)
> gradients is visually stronger in the lower-order modes (earlier indices) compared to higher-
> order modes, suggesting that the dominant, large-scale spatial organization of the functional
> brain is more tightly constrained by structural connectivity than fine-scale functional
> features.

The second is the better-supported of the two and is consistent with the figure. The first
leans on the word "prominent"; see the interpretive caveat above and the Pitfalls in
`RECIPE.md` — a diagonal is constructed by the permutation regardless of the data, and the
report's stronger phrasing ("dark red diagonal", "|r| > 0.5 for many modes", "off-diagonal
elements appeared sparse and near-zero") is not supported by `abs_correlation_mean` ≈ 0.10 or
by the rendered panel.

## Figure specification

Square figure, 5×5 in. `imshow` of the 50×50 absolute sorted correlation matrix, transposed so
rows are FC modes and columns are SC modes. `cmap='Reds'`, `aspect='equal'`, autoscaled colour
limits (≈ 0.02 to 0.63 for the recorded dataset). No ticks visible: tick marks are set to zero length, and
only the first and last positions carry labels — `[0, 49]` shown as `['1', '50']` — on both
axes. Y-axis label `FC gradients`, x-axis label `SC gradients`. Vertical colorbar on the right,
`fraction=0.046`, `pad=0.04`, label `Gradient similarity |r|` rotated 270° with `labelpad=20`.
`tight_layout()`, saved at 300 dpi with `bbox_inches='tight'`.

The two known rendering failures — inverted axis semantics and drifting manual end labels —
are described under "Base vs figure-oriented implementation".
