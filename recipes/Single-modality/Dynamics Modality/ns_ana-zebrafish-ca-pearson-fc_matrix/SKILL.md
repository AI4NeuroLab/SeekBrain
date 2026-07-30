---
name: ns_ana-zebrafish-ca-pearson-fc_matrix
description: Build per-larva and group-average functional connectivity (FC) matrices from zebrafish whole-brain calcium imaging, by Gaussian-smoothing region-averaged ΔF/F₀ traces and computing Pearson correlations between brain regions. Use this whenever someone asks for a functional connectivity matrix, an FC matrix, a region-by-region correlation matrix, brain-wide functional coupling, or a group-averaged connectivity map from calcium time series — including phrasings like "correlate the regional activity", "how synchronized are the brain regions", or "average the connectivity across fish". This is the upstream step that produces Figure1_FC_matrix.npy and Figure1_FC_matrices.npy, which almost every structure–function, gradient, fingerprinting, and network-topology analysis in this dataset depends on, so reach for it before any of those.
triggers:
- Run the Group-average functional connectivity from regional calcium traces recipe
- Build per-larva and group-average functional connectivity (FC) matrices from zebrafish whole-brain calcium imaging, by Gaussian-smoothing region-averaged ΔF/F₀ traces and computing Pearson correlations between brain regions.
- Generate the outputs described by ns_ana-zebrafish-ca-pearson-fc_matrix
tags:
- zebrafish
- ca
- pearson
- fc
- matrix
version: '1.0'
---

# Group-average functional connectivity from regional calcium traces

Computes one FC matrix per larva and their group average, over the brain regions that
survived quality-control exclusion.

## When to use this

The question is some form of *"which brain regions co-activate?"* and the input is
region-averaged calcium activity. This is the entry point to the whole structure–function
side of the dataset — the two artifacts it writes are consumed by 9 other recipes.

Do **not** use this to build FC from raw per-neuron traces. Region averaging and ΔF/F₀
baseline correction happen upstream in
`ns_pre-zebrafish-ca-minfilter-dff_region_series`; this recipe starts from
`region_series_dff.npy`.

## Preconditions

- The custom library is **vendored**: `scripts/zebrafish_Ca_utils.py` sits beside both scripts
  and supplies `get_datasets` and `compute_correlation_matrix`. The `sys.path` line points at
  the script's own directory, so the imports resolve with no external setup. That line is the
  only edit to either script; everything else is exactly as it ran.
- Env vars: `ZEBRAFISH_PATH`, `PROCESS_DATA_DIR`, `SAVE_DIR`. The script raises immediately
  if any is unset, which is the right behaviour — silently writing to the wrong directory
  would corrupt the shared artifact bus.
- `Figure1_excluded_regions.npy` must already exist in `PROCESS_DATA_DIR`, produced by
  `ns_pre-zebrafish-ca_atlas-region_census-exclusion_mask`.

## Inputs and outputs

| Direction | File | Shape |
|---|---|---|
| in | `$ZEBRAFISH_PATH/**/fish*/region_series_dff.npy` | (70 regions, T) per larva |
| in | `$PROCESS_DATA_DIR/Figure1_excluded_regions.npy` | (5,) — region indices |
| out | `$PROCESS_DATA_DIR/Figure1_FC_matrices.npy` | (22, 65, 65) |
| out | `$PROCESS_DATA_DIR/Figure1_FC_matrix.npy` | (65, 65) |
| out | `$SAVE_DIR/figure.png`, `$SAVE_DIR/statistics.json` | |

Full detail in `references/data_contract.md`.

## Procedure

1. Discover larva folders with `get_datasets(ZEBRAFISH_PATH, keywords=['fish'])`.
2. Load `Figure1_excluded_regions.npy`.
3. For each larva:
   - Load `region_series_dff.npy`, shape (regions, time).
   - Truncate to the **first 600 time points**. Skip the larva if it has fewer — do not pad,
     since a shorter record would bias its correlations relative to the others.
   - Smooth each region independently along time with `gaussian_filter1d(sigma=2)`. This
     suppresses high-frequency imaging noise so the correlations reflect the slow
     co-fluctuations that carry the functional signal.
   - `fc = compute_correlation_matrix(smoothed, arctanh=False)` — raw Pearson r, no Fisher
     transform.
4. Stack into (n_larvae, 70, 70).
5. Drop the excluded regions from **both** axes symmetrically, giving (n_larvae, 65, 65).
6. Save the stack as `Figure1_FC_matrices.npy`.
7. Group-average with `np.nanmean(..., axis=0)` — `nanmean`, not `mean`, because a region
   unsampled in one larva contributes NaN and would otherwise poison the whole entry.
8. Save as `Figure1_FC_matrix.npy`.
9. Plot the lower triangle only (mask `np.triu(..., k=0)` → NaN), `imshow` with `cmap='Reds'`,
   `vmin=0.2`, `vmax=0.9`, `aspect='equal'`, `interpolation='none'`. Tick labels at the first
   and last region only. Colorbar labelled `FC`. Title carries the larva count.

## Key parameters

| Parameter | Value | Why it matters |
|---|---|---|
| `TIME_POINTS` | 600 | Truncation point. Changing it changes every correlation. |
| `SMOOTH_SIGMA` | 2 | Gaussian σ in time steps. Higher inflates correlations. |
| `arctanh` | `False` | Raw r, not Fisher-z. Averaging raw r across larvae is a mild downward bias — deliberate here, but note it if comparing to Fisher-z literature. |
| colour scale | `[0.2, 0.9]` | Display only; does not affect saved data. |

## Expected results

A correct re-run on the same data should land at:

- 22 larvae processed, 70 → 65 regions, 5 excluded
- `fc_mean` ≈ **0.4111**
- `fc_lower_triangle_mean` ≈ **0.4111** (matches `fc_mean` because the matrix is symmetric
  with a unit diagonal excluded from the lower-triangle vector)

The headline claim these support: the network shows moderate global synchronization, mean
Pearson r ≈ 0.41 across 65 regions.

## Pitfalls

- **Mask the diagonal, and turn interpolation off.** The first run left a visible coloured
  diagonal: `imshow`'s default interpolation bleeds colour from valid neighbours into the
  NaN-masked diagonal pixels. `interpolation='none'` fixes it. The refined script does this;
  the base one does not.
- **Bounds-check the exclusion indices.** The refined script filters
  `excluded_regions[excluded_regions < num_regions]` before applying the mask. This matters:
  `ns_vis-zebrafish-sc_ca-scatter_polyfit-pc1_fc_regression` re-applies the same exclusion
  list to already-filtered matrices and silently drops index 69 as out of bounds, ending up
  with 61 regions where everything else uses 65.
- **Apply the exclusion once, at the right stage.** Downstream recipes receive matrices that
  are *already* 65×65. Re-excluding is a real bug in this dataset, not a hypothetical.
- The per-larva loop swallows exceptions and continues. Check the printed count — a silent
  drop from 22 to fewer larvae changes the group average without any error.

## Bundled files

- `scripts/reference_implementation.py` — the original run, verbatim.
- `scripts/refine_implementation.py` — the corrected version (diagonal masking + bounds
  check). **Prefer this one.**
- `references/data_contract.md` — env vars, file shapes, artifact consumers.
- `references/method_details.md` — every parameter, full statistics, provenance.
