---
name: ns_multi-zebrafish-ca_behavior-circular_statistics-tuning_curve
description: Analyzes and visualizes head-direction cell tuning transformations in symmetric environments by generating synchronized heatmaps across pre-learning, learning, and post-learning epochs.
triggers:
  - How do HD-cell tuning curves change when exposed to a symmetric visual scene?
  - Generate a centered heatmap of neural tuning curves for spatial orientation.
  - Assess bimodality in head-direction cell activity during virtual reality learning epochs.
  - Sort ROI tuning curves by preferred orientation across multiple experimental phases.
  - Compare pre-learning and post-learning HD-cell responses using normalized color-scaled heatmaps.
tags:
  - Head-Direction Cells
  - Spatial Navigation
  - Circular Statistics
  - Virtual Reality
  - Neural Population Dynamics
  - Tuning Curve Analysis
version: '1.0'
---

# Analyzing Head-Direction Cell Tuning Shifts in Symmetric Visual Scenes

This recipe provides a framework for analyzing how Head-Direction (HD) cell tuning transforms when an animal navigates a symmetric virtual environment. The analysis tracks the evolution of neural responses across three distinct experimental epochs: Pre-learning, Learning, and Post-learning. By aligning tuning curves based on the preferred orientation ($b$) identified during the Pre-learning epoch, we can visualize systematic shifts—such as the emergence of bimodal or double-peaked tuning—that indicate how visual symmetries influence spatial representation in the cortex.

The implementation leverages custom libraries for circular statistical fitting and standardized visualization. It requires synchronization between behavioral VR tracking (scene orientation $\theta$) and neural fluorescence traces ($\Delta F/F$) to quantify changes in directional preference.

## When to use this

- Center head-direction tuning curves on pre-learning preferred orientation and compare learning epochs.
- Assess whether symmetric scenes induce organized bimodal tuning while preserving one ROI order and color scale.
- Do not use this workflow when ROI identities cannot be matched across epochs.

## Scientific context

HD cells typically exhibit unimodal tuning in asymmetric environments. In symmetric visual arenas, these cells often develop double-peaked tuning, representing the spatial ambiguity introduced by identical landmarks. Evaluating this transformation requires identifying stable populations and observing whether shifts are systematic relative to the initial preferred orientation.

## Preconditions

- MATLAB (Statistics and Machine Learning Toolbox).
- Circular-fitting and plotting utilities such as `Kent_func`, `stats_plot`, and `im_dissim`.

## Inputs and outputs

1. Behavioral file containing `theta` (scene orientation) and `epoch_indices`.
2. Neural file containing `fluorescence_traces` ($\Delta F/F$) and `ROI_IDs`.
3. Epoch metadata defining start/stop frames for Pre, Learning, and Post sessions.

- Three-panel figure: Heatmaps for Pre, Learning, and Post epochs.
- Data structures: `centered_tuning_matrices.mat`, `preferred_orientations.mat`, and `ROI_order.mat`.
- Summary report: Statistical output of Gaussian mixture model goodness-of-fit.

## Procedure

1. **Identification:** HD cells are isolated based on significant Rayleigh vector lengths or circular-linear correlation during the Pre-learning baseline.
2. **Estimation:** The preferred orientation $b$ is computed for each cell using circular mean or von Mises distribution fitting.
3. **Normalization:** Tuning curves are shifted by $\theta - b$ and wrapped to $[-\pi, \pi]$ to align all cells to a common $0^\circ$ peak.
4. **Consistency:** ROIs are sorted by $b$ in the Pre-learning phase; this index order is strictly maintained for Learning and Post-learning epochs.

1. **Data Sync**: Use epoch metadata to slice neural and behavioral streams into the three required phases.
2. **Tuning Calculation**: Generate $\Delta F/F$ tuning curves for each ROI as a function of $\theta$.
3. **Parameterization**: Fit the Pre-learning epoch curves using `Kent_func` to extract $b$.
4. **Transformation**: Apply centering ($\theta - b$) and modular wrapping (`mod(x + pi, 2*pi) - pi`).
5. **Visualization**: Use `stats_plot` to plot the 3-panel heatmap, passing a global `vmin`/`vmax` to ensure the shared color scale.
6. **Bimodality Assessment**: Use `fitgmdist` (MATLAB) or equivalent mixture modeling to fit a double-Gaussian to the Learning data and quantify the secondary peak amplitude.

1. Filter ROIs: Identify cells with Rayleigh $p < 0.05$ in the Pre-learning epoch.
2. Estimate $b$: Calculate the circular mean of the tuning curve for each HD cell in the Pre-learning epoch.
3. Center Curves: Subtract $b$ from $\theta$ for each cell; apply `mod(x + pi, 2*pi) - pi`.
4. Define Order: Generate an `ROI_sort_index` using `sort(b)`.
5. Compute Heatmaps: Create 3 matrices (ROI × Centered_Theta) using the sorted indices.
6. Assess Bimodality: Fit a 2-component Gaussian mixture model to each row in the Learning heatmap; extract the magnitude of the second peak.

## Expected results

The "Learning" heatmap should exhibit a clear transition from a singular diagonal ridge to a double-peaked pattern (at $0$ and $\pm\pi$), confirming that neurons tuned to specific landmarks have split their response to accommodate visual ambiguity.

- Shared colormap: Ensure `clim` is consistent across all three panels.
- Indexing: The `ROI_sort_index` must be identical for all three epochs.
- Wrapping: Ensure all centered orientations remain within $[-\pi, \pi]$.

## Pitfalls

- Ensure that neurons which drop out or become silent in later epochs are retained as zero-filled rows to preserve the fixed `ROI_order`.
- If the bimodality assessment is ambiguous, verify that the bin size is sufficiently small (e.g., 6°) to capture the peak separation clearly.

## Bundled files

- [`scripts/run_analysis.py`](scripts/run_analysis.py): Run the primary analysis workflow.
- [`scripts/utils.py`](scripts/utils.py): Reusable analysis and plotting helpers.
- [`references/scientific_context.md`](references/scientific_context.md): Review methodological requirements, required data, and validation criteria.
- [`references/implementation_notes.md`](references/implementation_notes.md): Review execution details, expected artifacts, known gaps, and troubleshooting guidance.

## Usage

```bash
# Example logic for executing the pipeline in MATLAB
[pre, learn, post] = process_hd_epochs(data_struct, epoch_meta);
b = estimate_preferred_orientation(pre);
[ordered_pre, ordered_learn, ordered_post] = sort_and_center(pre, learn, post, b);
plot_three_epoch_heatmaps(ordered_pre, ordered_learn, ordered_post);
```
