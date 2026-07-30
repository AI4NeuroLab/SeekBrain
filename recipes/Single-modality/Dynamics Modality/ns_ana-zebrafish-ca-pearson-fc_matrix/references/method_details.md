# Method details — ns_ana-zebrafish-ca-pearson-fc_matrix

## Full parameter list

| Name | Value | Where | Effect |
|---|---|---|---|
| `SMOOTH_SIGMA` | `2` | `gaussian_filter1d(sigma=...)` | Temporal smoothing width in frames. Larger σ raises all correlations by removing independent high-frequency noise; the FC mean is sensitive to this. |
| `TIME_POINTS` | `600` | Truncation | Only the first 600 frames of each larva are used, so all larvae contribute equal-length records. Larvae with `T < 600` are dropped entirely. |
| `arctanh` | `False` | `compute_correlation_matrix` | Raw Pearson r retained. See "Fisher transform" below. |
| mask | `np.triu(..., k=0)` | Display | Masks the upper triangle **and** the diagonal. |
| `cmap` | `'Reds'` | Display | |
| `vmin`, `vmax` | `0.2`, `0.9` | Display | Values outside clip. Display only. |
| `aspect` | `'equal'` | Display | |
| `interpolation` | `'none'` | Display, refine script only | Prevents colour bleeding into masked pixels. |
| `figsize` | `(6, 6)` | Display | |
| `dpi` | `300` | Save | |

## Statistical approach

**Correlation.** Pearson r between every pair of region traces, after smoothing. Symmetric,
unit diagonal.

**Fisher transform.** Not applied (`arctanh=False`). Averaging raw correlation coefficients
across larvae is slightly biased toward zero relative to averaging Fisher-z values and
back-transforming. The bias is small at r ≈ 0.4 but it is a real methodological choice — flag
it when comparing these numbers against studies that z-transform.

**Group averaging.** `np.nanmean` over the larva axis. NaNs arise when a region has no
sampled neurons in a given larva; `nanmean` lets the remaining larvae still contribute to
that entry. This means different matrix entries can be averaged over different numbers of
larvae. The count is not recorded — if that matters, add an n-per-entry map.

**No significance testing.** This recipe produces descriptive matrices only. Null-model
testing of network structure lives in
`ns_ana-zebrafish-ca-circular_null-cofluctuation_event`.

## Recorded statistics (`statistics.json`)

From the original run:

```json
{
  "n_larvae": 22,
  "n_regions_original": 70,
  "n_regions_after_exclusion": 65,
  "n_excluded_regions": 5,
  "fc_mean": 0.41110607347132383,
  "fc_lower_triangle_mean": 0.41110607347132383
}
```

The base script writes a longer set (`fc_std`, `fc_median`, `fc_min`, `fc_max`,
`fc_percentile_25`, `fc_percentile_75`, `n_valid_connections`, `time_points_used`,
`smoothing_sigma`); the refine script trims it to the six fields above, which is what the
stored `statistics.json` contains.

`fc_mean` and `fc_lower_triangle_mean` are identical because the matrix is symmetric and the
lower-triangle vector excludes the diagonal — but `fc_mean` is `nanmean` over the *whole*
matrix including the unit diagonal. That they still match to 17 digits is a coincidence of
this data, not an invariant. Do not treat their equality as a validity check.

## Implementation requirements

Apply the following implementation requirements (three substantive ways:

1). `interpolation='none'` added to `imshow` — fixes the visible coloured diagonal.
2. Exclusion indices bounds-checked: `excluded_regions[excluded_regions < num_regions_orig]`.
3. Output figure renamed to `figure_refine.png`; statistics dict trimmed.

Everything else is removed progress prints. **Use the refine script.**

## Scientific conclusion supported

> The group-averaged functional connectivity matrix derived from spontaneous calcium activity
> in 65 brain regions across 22 zebrafish larvae exhibits a moderate global network
> synchronization, characterized by a mean Pearson correlation coefficient of approximately
> 0.41.

## Output requirements

Square figure, 6×6 in. Lower triangle of the group-average FC, diagonal excluded. `Reds`
colormap scaled `[0.2, 0.9]`, colorbar on the right labelled `FC` (rotated 270°, labelpad 15,
`fraction=0.046`, `pad=0.04`). Tick labels only at the first and last region — `[0, N-1]`
positions labelled `[1, N]` — on both x and y. Y-axis labelled `Brain regions`, x-axis blank.
Title: `Average functional connectivity\n(n=22 larvae)`.

The known rendering failure was the diagonal appearing coloured; see Pitfalls in `RECIPE.md`.
