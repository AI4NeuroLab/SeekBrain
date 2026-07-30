---
name: ns_ana-zebrafish-ca-eigen_spectrum-fc_scree_plot
description: Draw the scree plot of the functional connectivity (FC) diffusion-map eigenvalue spectrum for zebrafish whole-brain calcium data — a black line of eigenvalue versus gradient index — to show how fast gradient importance decays and to justify keeping only the leading modes. Use this when someone asks for an FC scree plot, an eigenvalue decay curve, "how many functional gradients should I keep", "plot the eigenvalue spectrum", "show the elbow", "how many dimensions does functional connectivity have", or wants the panel that motivates the 50-mode cutoff used in SC-FC gradient matching. It reads Figure6_FC_eigenvalues.npy from ns_multi-zebrafish-sc_ca-diffusion_map-connectivity_gradient, writes no artifacts, and is the FC twin of ns_vis-zebrafish-sc-eigen_spectrum-sc_scree_plot; reach for both when comparing structural and functional spectral decay.
triggers:
- Run the FC eigenvalue scree plot recipe
- Draw the scree plot of the functional connectivity (FC) diffusion-map eigenvalue spectrum for zebrafish whole-brain calcium data — a black line of eigenvalue versus gradient index — to show how fast gradient importance decays and to justify keeping only the leading modes.
- Generate the outputs described by ns_ana-zebrafish-ca-eigen_spectrum-fc_scree_plot
tags:
- zebrafish
- ca
- eigen
- spectrum
- fc
version: '1.0'
---

# FC eigenvalue scree plot

A one-panel rendering of the diffusion-map eigenvalue spectrum of the group-average
functional connectome. Pure visualisation — it writes no `.npy` artifacts.

## When to use this

The question is *"how quickly does functional gradient importance fall off, and how many
gradients are worth keeping?"* This panel is the justification for the 50-mode truncation used
by `ns_multi-zebrafish-sc_ca-hungarian_matching-gradient_correspondence` (Figure 6C).

Its structural counterpart is `ns_vis-zebrafish-sc-eigen_spectrum-sc_scree_plot` (Figure 6B),
which does the same thing for `Figure6_SC_eigenvalues.npy`. The two scripts are near-identical
in shape; use both together when contrasting SC and FC spectra, and note their statistics
blocks are **not** the same set of fields.

Do not use this recipe to *compute* gradients — that is
`ns_multi-zebrafish-sc_ca-diffusion_map-connectivity_gradient`.

## Preconditions

- `Figure6_FC_eigenvalues.npy` must exist in `PROCESS_DATA_DIR`, written by
  `ns_multi-zebrafish-sc_ca-diffusion_map-connectivity_gradient`. The script raises
  `FileNotFoundError` if it is missing.
- Env vars: `PROCESS_DATA_DIR`, `SAVE_DIR`. Both are checked explicitly and raise `ValueError`
  if unset — the right behaviour, since a silent `None` would put the figure somewhere
  unfindable.
- The array must contain at least 50 values (asserted); this run has 64.
- **No custom-library module is needed, and none is bundled.** `scripts/` holds the two Python
  scripts and nothing else. Both scripts manipulate `sys.path` but **import nothing from the
  library** — no `from zebrafish_Ca_utils import ...`, no anything — so the line is inert and
  there is no vendored module for it to find. This is a genuinely dependency-light recipe:
  delete the `sys.path` line and both scripts run on numpy + matplotlib alone.

## Inputs and outputs

| Direction | File | Shape |
|---|---|---|
| in | `$PROCESS_DATA_DIR/Figure6_FC_eigenvalues.npy` | (64,) float, descending |
| out | `$SAVE_DIR/figure.png` / `figure_refine.png` | 300 dpi |
| out | `$SAVE_DIR/statistics.json` | see below |

No `.npy` artifact is written. Nothing downstream consumes this recipe. Full detail in
`references/data_contract.md`.

## Procedure

1. Validate `PROCESS_DATA_DIR` and `SAVE_DIR`; `os.makedirs(SAVE_DIR, exist_ok=True)`.
2. Load `Figure6_FC_eigenvalues.npy`; flatten if `ndim > 1` so a column vector is handled.
3. Assert at least 50 values are present — the x-limits and the `[1, 50]` ticks assume it.
4. Build 1-based indices: `np.arange(1, n + 1)`. The eigenvalue at array position 0 is
   "Gradient 1" on the plot; keep that offset straight when quoting a gradient number.
5. Plot all `n` eigenvalues against the index — `color='black'`, `linewidth=1`,
   `marker='.'`, `markersize=1`, figsize (5, 5).
6. Set `xlim=[-1, 51]` and `ylim(bottom=-0.05)`. The x-limit is what restricts the visible
   range to the first 50; the data beyond index 50 is plotted but falls outside the view. The
   y-bottom is fixed at -0.05 because part of this spectrum is genuinely negative and would
   otherwise be clipped or autoscaled away.
7. Ticks at `[1, 50]` on x only. Hide the top and right spines.
8. Compute the descriptive statistics over `eigenvalues[:50]` and write `statistics.json`.
   Read the Pitfalls before trusting the variance fields.

## Key parameters

| Parameter | Value | Why it matters |
|---|---|---|
| eigenvalues plotted | all 64 | The full spectrum is drawn; only the x-limit hides the tail. |
| statistics window | `eigenvalues[:50]` | Every summary field is over the first 50, not all 64. |
| `xlim` | `[-1, 51]` | Frames indices 1–50 with a little padding. Changing it changes what a reader sees, not the data. |
| `ylim(bottom=)` | `-0.05` | Keeps the negative tail visible; the top autoscales to ≈ 0.37. |
| `xticks` | `[1, 50]` | End labels only, matching the figure spec. |
| `color`, `linewidth`, `marker`, `markersize` | black, 1, `'.'`, 1 | Thin line, near-invisible markers — the shape is the message. |
| `figsize`, `dpi` | (5, 5), 300 | `bbox_inches='tight'`. |
| `fontsize` (labels / ticks) | 14 / 12 | Refine script only. |
| y formatter | `FormatStrFormatter('%.2f')` | Refine script only; fixes ragged default decimal places. |
| minor ticks | `AutoMinorLocator()` on x | Refine script only; lets a reader estimate indices between 1 and 50. |

## Expected results

From `statistics.json` — the base and refine scripts compute an identical statistics block, so
these hold for either:

- `n_eigenvalues` = **64**
- `eigenvalue_1` = **0.36940** — the distinct maximum
- `eigenvalue_50` = **-0.032175** — also the minimum of the first 50
- first-50 `mean` = **-0.003790**, `std` = **0.063299**, `median` = **-0.022502**,
  `min` = **-0.032175**, `max` = **0.369404**, `percentile_25` = **-0.026346**,
  `percentile_75` = **-0.012902**
- `decay_ratio_50_to_1` = **-0.087099**
- `total_variance_first_50` = **-0.189509**

The median being negative is the headline structural fact: after roughly the first eight
gradients the spectrum crosses zero and settles into a shallow negative plateau. The shape is
one dominant mode, a steep drop over ~5 gradients, then a long flat tail.

**Do not quote `cumulative_variance_explained` or `gradients_for_variance_thresholds`.** See
Pitfalls — they are degenerate artifacts of a guard clause, not measurements.

The stored conclusion: the spectrum decays rapidly, the first gradient (≈ 0.37) far exceeds
all others, so the principal variance of functional network organisation sits in the first few
dimensions.

## Pitfalls

- **The cumulative-variance fields are meaningless and must not be reported.** They read
  `cumulative_variance_explained` = {gradient_10: 0.0, gradient_20: 0.0, gradient_30: 0.0,
  gradient_50: 0.0} and `gradients_for_50pct/80pct/90pct_variance` = 64, 64, 64. Here is the
  mechanism: the code does `total_variance = np.cumsum(eigenvalues[:50])[-1]`, which is
  **-0.1895** because most of this spectrum is negative. The guard
  `ratios = cumsum / total if total > 0 else np.zeros_like(cumsum)` then takes the `else`
  branch and fills the ratio array with zeros. Zeros never reach 0.5, 0.8 or 0.9, so the
  threshold search finds nothing and falls back to `n_eigenvalues` = 64 for all three. The
  identical value 64 across all three thresholds is the tell.
- **Why negative eigenvalues break variance ratios at all.** A "proportion of variance
  explained" only means something when the components are non-negative and additive, as in
  PCA on a positive-semi-definite covariance matrix. The diffusion-map operator applied here
  is not PSD, so its spectrum contains genuinely negative eigenvalues. Once that happens the
  cumulative sum is non-monotonic, the total can be small, zero, or negative, and the ratio
  `cumsum[k] / total` can exceed 1, go negative, or flip sign partway through — there is no
  interpretation in which "gradients needed for 80% of variance" is a well-defined quantity.
  If you need a dimensionality estimate from this spectrum, use the positive part only, or an
  eigenvalue-gap / elbow criterion, and say which you used.
- **`decay_ratio_50_to_1` is negative (-0.087) and is not a decay ratio.** It is
  `eigenvalue_50 / eigenvalue_1` with a negative numerator, so its sign encodes "the spectrum
  crossed zero", not "how much it decayed". Report the two eigenvalues rather than the ratio.
- **The report claims variance concentration the data cannot support.** `analytical_report.md`
  says "the majority of the variance is captured by the first few gradients". With a spectrum
  that goes negative, "variance captured" is undefined — see above. The defensible statement is
  the shape of the curve: one dominant eigenvalue at 0.37 and a rapid fall to a near-zero
  plateau within about 10 indices.
- **The x-limit hides data rather than filtering it.** All 64 eigenvalues are plotted; indices
  51–64 sit outside `xlim=[-1, 51]`. Nothing is subset, so if you change the x-limit more
  points appear. Statistics, by contrast, really are computed on `[:50]` — the plot window and
  the statistics window agree here only by coincidence of the chosen limits.
- **This recipe writes no artifact.** `analytical_report.md` correctly lists "Artifacts: None".
  Nothing downstream can depend on it; it exists to produce the panel.
- **The `sys.path` line survives into the refine script.** Unlike the sibling refine scripts
  that strip it, the bundled plotting implementation here keeps it — but since no custom symbol is ever
  imported in either script, and this recipe bundles no library modules for it to point at, the
  line is pure vestige. Remove it and both run anywhere.

## Bundled files

- `scripts/reference_implementation.py` — the original run, verbatim.
- `scripts/refine_implementation.py` — larger fonts, x minor ticks, 2-decimal y formatter.
  **Prefer this one**; the statistics it writes are byte-for-byte the same.
- `references/data_contract.md` — env vars, input shape, why there are no outputs.
- `references/method_details.md` — every parameter, full statistics verbatim, the negative-
  eigenvalue analysis, provenance.
