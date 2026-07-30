---
name: ns_ana-zebrafish-sc_matrix-eigen_spectrum-sc_scree_plot
description: Draw the scree plot of the structural connectivity (SC) diffusion-map eigenvalue spectrum for the larval zebrafish brain — a black line of eigenvalue against gradient index, read from Figure6_SC_eigenvalues.npy — and summarise the spectrum (first, mean, median, min, max eigenvalue). Reach for this whenever someone asks for a scree plot, an eigenvalue spectrum, an eigenvalue decay curve, "how many gradients do I need", "where is the elbow", "show the relative importance of the SC gradients", "is the structural connectome low-dimensional", or any request to visualise or characterise the eigenvalues produced by the structural gradient decomposition. It writes no .npy artifacts and depends only on Figure6_SC_eigenvalues.npy from ns_multi-zebrafish-sc_ca-diffusion_map-connectivity_gradient; its refine script drops the dead custom-library imports entirely and runs on numpy and matplotlib alone, making it the most nearly executable recipe in this set. Its sibling ns_vis-zebrafish-ca-eigen_spectrum-fc_scree_plot
  does the same for the FC spectrum.
triggers:
- Run the Scree plot of the SC gradient eigenvalue spectrum recipe
- Draw the scree plot of the structural connectivity (SC) diffusion-map eigenvalue spectrum for the larval zebrafish brain — a black line of eigenvalue against gradient index, read from Figure6_SC_eigenvalues.
- Generate the outputs described by ns_ana-zebrafish-sc_matrix-eigen_spectrum-sc_scree_plot
tags:
- zebrafish
- sc
- matrix
- eigen
- spectrum
version: '1.0'
---

# Scree plot of the SC gradient eigenvalue spectrum

Loads the 69 structural-connectivity diffusion-map eigenvalues and renders them as a decay
curve, so the elbow that justifies keeping only the first few gradients is visible.

## When to use this

The gradients already exist and the question is *how many of them matter*. This is a pure
rendering-plus-summary step: it reads one array, draws one line, writes one figure and one
`statistics.json`. No `.npy` artifact is produced and nothing downstream depends on it.

Use it as the justification panel for any analysis that truncates the SC gradient set — the
elbow around gradient 5 is what licenses `ns_multi-zebrafish-sc_ca-hungarian_matching-
gradient_correspondence` to compare only leading components rather than all 69.

For the functional counterpart use `ns_vis-zebrafish-ca-eigen_spectrum-fc_scree_plot`, which
reads `Figure6_FC_eigenvalues.npy` and is otherwise the same analysis.

## Preconditions

- `Figure6_SC_eigenvalues.npy` must exist in `PROCESS_DATA_DIR`, written by
  `ns_multi-zebrafish-sc_ca-diffusion_map-connectivity_gradient`. The script raises an explicit
  `FileNotFoundError` naming the path if it is absent — a good failure.
- Env vars `PROCESS_DATA_DIR` and `SAVE_DIR`. `ZEBRAFISH_PATH` and `ATLAS_PATH` are not used.
- The custom library — **for the base script only**, and nothing has to be supplied. All five
  modules the base wildcard-imports are vendored into `scripts/`: `zebrafish_Ca_utils.py`,
  `zebrafish_Ca_stats_patch_xps.py`, `zebrafish_Ca_utils_patch_xps.py`,
  `zebrafish_Ca_utils_predictors_xps.py`, `zebrafish_Ca_visualization_patch_xps.py`. The
  `sys.path` line now points at the script's own directory, so the imports resolve with no
  external setup; that line is the only edit to the script. The imports are still **dead** —
  the base resolves no symbol from any of the five — and they are not free: pulling those
  modules in drags their own heavy third-party dependencies (`numba`, `bctpy`, `networkx`,
  `hdbscan`, `opencv-python`) into the import path at load time for no benefit, so the five
  lines can safely be deleted. The refine script already does exactly that: its only imports
  are `os`, `sys`, `json`, `numpy` and `matplotlib.pyplot`, and `sys` is itself vestigial.

## Inputs and outputs

| Direction | File | Shape |
|---|---|---|
| in | `$PROCESS_DATA_DIR/Figure6_SC_eigenvalues.npy` | (69,) float |
| out | `$SAVE_DIR/figure.png` (base) / `figure_refine.png` (refine) | 300 dpi |
| out | `$SAVE_DIR/statistics.json` | 6 fields (refine) / 20 fields (base) |

No `.npy` artifacts are written. Full detail in `references/data_contract.md`.

## Procedure

1. Resolve `PROCESS_DATA_DIR/Figure6_SC_eigenvalues.npy` and fail loudly if it is missing.
2. Load it. Prefer the refine handling —
   `np.real(np.squeeze(np.load(path, allow_pickle=True))).astype(float)` — over the base
   script's bare `.astype(float)` plus `assert ndim == 1`. `squeeze` absorbs a `(N, 1)` array
   and `np.real` absorbs a complex dtype; an eigensolver can legitimately return either, and
   `astype(float)` on a complex array raises rather than discarding the imaginary part.
3. Build a **1-based** index `np.arange(1, N + 1)`. The x-axis is "Gradient #", and calling the
   leading gradient "gradient 0" would contradict every other panel and the prose.
4. Summarise: count, first, mean, median, min, max.
5. Plot: `figsize=(5, 5)`, black line, `linewidth=1`, `marker='.'`, `markersize=1`.
6. Style: `xlim=[-1, 51]`, `xticks=[1, 50]`, xlabel `Gradient #`; y bottom fixed at `-0.05`
   and y top at `max * 1.05`; ylabel `Eigenvalue`; hide the top and right spines.
   The `-0.05` floor is not cosmetic — the spectrum genuinely goes negative (min −0.187), so a
   y-axis starting at 0 would clip most of the tail.
7. Save at 300 dpi with `bbox_inches='tight'`, then write `statistics.json`.

## Key parameters

| Parameter | Value | Why it matters |
|---|---|---|
| `figsize` | `(5, 5)` | From the task spec. |
| line colour / width | `'black'` / `1` | |
| `marker`, `markersize` | `'.'`, `1` | Effectively invisible at this size; the line carries the shape. |
| `xlim` | `[-1, 51]` | Crops to the first 50 gradients even though 69 exist — the decay is all in the leading components. |
| `xticks` | `[1, 50]` | Endpoints only. |
| y bottom | `-0.05` | Hard floor. Required, because eigenvalues reach −0.187. |
| y top | `max * 1.05` | 5 % headroom above 0.6387. |
| spines | top and right hidden | |
| `dpi` | `300`, `bbox_inches='tight'` | |
| index base | 1 | `np.arange(1, N + 1)`. |

## Expected results

From `statistics.json` (the six-field refine version, which is what is stored):

- `n_eigenvalues` = **69**
- `first_eigenvalue` = **0.6387332312244718**
- `mean_eigenvalue` = **−0.005007237508854417**
- `median_eigenvalue` = **−0.021168811736469607**
- `min_eigenvalue` = **−0.186718534616406**
- `max_eigenvalue` = **0.6387332312244718** (identical to `first_eigenvalue`, confirming the
  spectrum is returned in descending order — a cheap validity check)

Two consistency checks worth running:

- `mean_eigenvalue` here equals `sc_eigenvalues_mean` in
  `ns_multi-zebrafish-sc_ca-diffusion_map-connectivity_gradient`'s `statistics.json` to all 17
  digits. A mismatch means the `.npy` on disk is stale.
- `n_eigenvalues` = 69 matches the first axis of `Figure6_SC_gradients.npy`, shape (69, 65).

The claim these support: the SC eigenvalues decay rapidly over roughly gradients 1–5, so the
structural network's topology is captured by a low-dimensional embedding.

## Pitfalls

- **Do not compute variance explained from these eigenvalues.** The base script does, and the
  numbers are meaningless. It builds `cumsum_eigenvalues`, divides by `total_sum`, and reports
  `n_eigenvalues_for_{50,80,90,95}pct_variance`. With a spectrum whose mean is −0.005 and whose
  median is −0.021, the running sum is not monotonic and `total_sum` is near zero, so
  `np.searchsorted` on it returns nonsense. The refine script deletes all of these fields and
  the stored `statistics.json` does not contain them. The identical failure is visible and
  documented in the sibling `ns_vis-zebrafish-ca-eigen_spectrum-fc_scree_plot`, whose
  cumulative-variance entries are all 0.0 with every threshold reporting 64. The negative
  eigenvalues are a real property of diffusion mapping applied to a matrix that is not positive
  semi-definite; they are not a bug to be clipped away, they simply invalidate the
  variance-decomposition framing.
- Also dropped by the refine script and equally suspect:
  `decay_ratio_first_to_last = eigenvalues[0] / eigenvalues[-1]` — the last eigenvalue is
  negative, so the ratio is negative and does not describe decay.
- **The base script's custom imports are pure liability.** It wildcard-imports
  `zebrafish_Ca_utils`, `zebrafish_Ca_stats_patch_xps`, `zebrafish_Ca_utils_patch_xps`,
  `zebrafish_Ca_utils_predictors_xps` and `zebrafish_Ca_visualization_patch_xps`, and resolves
  no symbol from any of them. All five are vendored into `scripts/`, so the imports do succeed —
  but succeeding is not the same as being free: each module carries its own heavy third-party
  dependencies (`numba`, `bctpy`, `networkx`, `hdbscan`, `opencv-python`) that must be installed
  and are then loaded before a single byte of data is read, all for symbols the script never
  uses. Delete the five lines. The refine script removes the
  `sys.path` line and all five imports. `ns_ana-zebrafish-ca-mannwhitney-fingerprint_
  significance` and `ns_vis-zebrafish-ca-eigen_spectrum-fc_scree_plot` had the same cleanup
  applied; those three refine scripts are the only genuinely runnable code in this set.
- **The base script asserts `eigenvalues.size >= 50`.** That holds at 69 but is a hard failure,
  not a warning, and it is coupled to the cosmetic `xlim=[-1, 51]` rather than to anything
  scientific. Re-running the upstream gradient recipe with a smaller `n_components` would abort
  here. The refine script drops the assertion.
- **The x-axis crops at 51 while 69 eigenvalues are plotted.** Points 51–69 exist in the line
  data but fall outside the view. That is intentional, but do not read the plotted extent as
  the length of the spectrum.
- **The base script's `assert ndim == 1` is brittle.** A `(69, 1)` array or a complex dtype
  from a different eigensolver would abort or raise inside `astype(float)`. The refine
  `np.real(np.squeeze(...))` handles both.
- Base and refine write to different filenames (`figure.png` vs `figure_refine.png`) but the
  **same** `statistics.json`, so running base after refine silently replaces the six-field
  file with the twenty-field version containing the degenerate variance entries.

## Bundled files

- `scripts/reference_implementation.py` — the original run, verbatim. Carries the dead imports
  and the invalid cumulative-variance statistics.
- `scripts/refine_implementation.py` — dependency-free (numpy + matplotlib), robust loading,
  trimmed statistics, saves `figure_refine.png`. **Prefer this one**; it is the closest thing
  to executable code in this recipe set.
- `references/data_contract.md` — env vars, input provenance, why there are no artifacts.
- `references/method_details.md` — every parameter, full statistics, provenance.
