# Method details — ns_pre-zebrafish-ca_atlas-region_census-exclusion_mask

## Contents

- [Full parameter list](#full-parameter-list)
- [Statistical approach](#statistical-approach)
- [Recorded statistics (`statistics.json`)](#recorded-statistics-statisticsjson)
- [Scientific conclusions supported](#scientific-conclusions-supported)
- [Figure specification](#figure-specification)

## Full parameter list

| Name | Value | Where | Effect |
|---|---|---|---|
| `N_regions` | `70` | Census allocation, exclusion loop, projection loop | Hard-coded atlas region count. Filling is guarded by `min(N_regions, region_labels.shape[1])`, so a narrower `region_labels` leaves trailing rows at zero and those regions get excluded by the sampling rule. |
| retina id | `10` | Exclusion seed, projection `continue` | Excluded unconditionally *and* omitted from both anatomical background images. |
| `threshold_count` | `25` | `N_neurons_per_region[r, :] >= threshold_count` | Minimum neurons for a region to count as adequately sampled in one larva. |
| `threshold_fraction` | `0.5` | `n_datasets_above_threshold < (N_fish * threshold_fraction)` | Fraction of larvae that must clear `threshold_count`. Strict `<`, so with `N_fish = 22` a region survives at ≥ 11 larvae and is dropped at ≤ 10. |
| `ddof` | `1` | `np.std(neurons_per_fish, ddof=1)` | Sample standard deviation across larvae. |
| representative index | `1` | `datasets[1]` | Positional selection of the "2nd dataset". No name matching. |
| `n_base_colors` | `11` | Palette | `np.linspace(0, 1, 11, endpoint=False)` hues. |
| palette saturation | `0.65` | `colorsys.hsv_to_rgb(h, 0.65, 0.90)` | |
| palette value | `0.90` | same | |
| palette tiling | `(max_region_id // 11) + 1` | Palette extension | Colours repeat every 11 region ids. |
| scatter `s` | `2` | Both panels | |
| scatter `alpha` | `0.6` | Both panels | |
| scatter `edgecolors` | `'none'` | Both panels | |
| `cmap` | `'binary'` | Both backgrounds | |
| `vmin`, `vmax` | `0`, `1` | Both backgrounds | Matches the max-normalised projections. |
| `origin` | `'lower'` | Both backgrounds | Cancels against the inverted `ylim`. |
| `aspect` | `'equal'` | Both backgrounds | |
| side rotation | `np.rot90(projection_side, k=3)` | Side background | `k=3` is 90° clockwise. |
| `SIDE_Z_MAX` | `359` | `z_inverted = 359 - z_coords` | Inverts depth to match the rotated background. Written as a literal, not a named constant. |
| top view xlim | `[65, 505]` | | |
| top view ylim | `[850, 50]` | | Inverted: anterior at top. |
| side view xlim | `[40, 359]` | | |
| side view ylim | `[850, 50]` | | Matched to the top view. |
| `figsize` | `(8, 6)` | | |
| grid width ratios | `[0.6, 0.4]` | `fig.add_gridspec(1, 2, ...)` | Top view 60 % width, side view 40 %. `hspace=0, wspace=0`. |
| `dpi` | `300` | `savefig` | With `bbox_inches='tight'`. |

## Statistical approach

**Census.** Pure counting — `np.sum(region_labels[:, r])` per region per larva. No weighting,
no normalisation by region volume. A large region will naturally carry more neurons; the
threshold is on absolute count, so it is implicitly a joint test of region size and imaging
coverage.

**Exclusion rule.** Two independent criteria combined by union:

1. *Anatomical*: region 10 (retina). Rule-based, not data-driven. The retina is sensory
   periphery rather than brain, so leaving it in would inject a non-central signal into every
   downstream connectivity matrix.
2. *Sampling density*: a region is dropped unless at least half the larvae contain at least 25
   neurons in it. The rationale is variance control — a region averaged over a handful of cells
   has a regional ΔF/F₀ trace dominated by single-cell noise, and its Pearson correlations with
   other regions would be driven by sampling error rather than physiology.

The criterion is deliberately per-larva-then-count, not pooled. Pooling counts across larvae
would let one exceptionally well-sampled fish rescue a region that is empty in the other 21.

**Assumptions worth naming.** The rule assumes larvae are exchangeable (each fish gets one
vote) and that 25 neurons is enough to stabilise a regional mean. Neither is tested here.
Both thresholds are free parameters that were fixed once and then treated as constants by the
whole pipeline.

**Population statistics.** Neurons per fish is the sum over included regions only, so the
reported 54 415 ± 5 234 excludes retinal and sparsely sampled cells. Mean and sample SD
(`ddof=1`) across the 22 larvae. Min, max and median are also recorded. No inferential test is
performed — these are descriptive.

**Projections.** Each region mask is reduced by an unweighted mean along one axis, and the
region-wise means are summed. Because masks overlap little, the sum behaves like a coverage
map; the final division by the maximum is a display normalisation, not a probability. The top
and side images are normalised independently and are therefore not on a common scale.

## Recorded statistics (`statistics.json`)

Verbatim from the reference implementation:

```json
{
  "total_fish": 22,
  "total_regions": 70,
  "n_excluded_regions": 5,
  "excluded_region_ids": [
    10,
    34,
    44,
    49,
    69
  ],
  "mean_neurons_per_fish": 54414.59090909091,
  "std_neurons_per_fish": 5234.19979474819,
  "min_neurons_per_fish": 44140.0,
  "max_neurons_per_fish": 66010.0,
  "median_neurons_per_fish": 55462.5,
  "representative_fish_index": 1,
  "representative_fish_name": "",
  "n_neurons_in_representative_fish_after_filtering": 44027
}
```

`representative_fish_name` is empty because `os.path.basename` was applied to a path ending in
a separator. The analytical report calls this larva "Fish 2", but the run itself recorded no
identity — the selection is `datasets[1]` in `get_datasets` order. If you need a stable
identity, add `.rstrip('/')` before `basename`, or select by name.

The `exec.log` for this analysis corroborates the two headline numbers:

```
Found 22 fish datasets
Excluded 5 regions: [10 34 44 49 69]
Mean neurons per fish (included regions): 54414.6 ± 5234.2
```

## Scientific conclusions supported

From `conclusions.json`:

> The statistical analysis of 22 zebrafish larvae indicates that the average number of
> identified neurons mapped to the brain atlas is 54,415 ± 5,234 (mean ± SD) per fish, after
> excluding the retina and regions with insufficient sampling.

> The spatial distribution of neuronal somata in the representative larva demonstrates
> comprehensive coverage across the forebrain, midbrain, and hindbrain with clear bilateral
> symmetry, confirming the effective mapping of whole-brain activity excluding the retina.

The workflow description adds the interpretive point that an SD of roughly 10 % of the mean indicates
consistent labelling efficiency across samples while still reflecting genuine biological
variability.

## Figure specification

Two-panel figure, 8 × 6 in, built with `fig.add_gridspec(1, 2, width_ratios=[0.6, 0.4],
hspace=0, wspace=0)`.

**Left panel — Top view (horizontal / XY), 60 % width.** Background:
`Figure1_projection_regions_top.npy` via `imshow(cmap='binary', aspect='equal',
origin='lower', vmin=0, vmax=1)`. Overlay: scatter of the representative larva's centroids at
`(centroids[:, 0], centroids[:, 1])`, `s=2`, `alpha=0.6`, `edgecolors='none'`, coloured by
region id from the repeated 11-hue palette. Limits x `[65, 505]`, y `[850, 50]`. `axis('off')`.

**Right panel — Side view (sagittal / XZ), 40 % width.** Background:
`Figure1_projection_regions_side.npy` rotated 90° clockwise (`np.rot90(..., k=3)`), same
`imshow` parameters. Overlay: the same neurons at `(359 - centroids[:, 2], centroids[:, 1])`,
identical marker style and colours. Limits x `[40, 359]`, y `[850, 50]`. `axis('off')`.

`plt.tight_layout()`, saved to `$SAVE_DIR/figure.png` at 300 dpi with `bbox_inches='tight'`.

No axis labels, no titles, no legend, no colorbar — the palette is categorical and repeats
every 11 regions, so it carries no readable key by design.
