---
name: ns_multi-drosophila-ca_behavior-circular_statistics-encoding_accuracy
description: Quantifies HD encoding accuracy in Drosophila E-PG neurons by calculating vector strength from fluorescence imaging and heading data across varying visual cue conditions.
triggers:
  - calculate HD encoding accuracy from calcium imaging data
  - compare Drosophila compass fidelity across different visual landmark intensities
  - compute vector strength for head-direction encoding in EB neurons
  - perform statistical analysis on fly heading versus bump position metrics
  - preprocess neuroethology fluorescence data for cue intensity comparison
tags:
  - neuroethology
  - drosophila
  - calcium-imaging
  - circular-statistics
  - vector-strength
  - computational-neuroscience
version: '1.0'
---

# Quantifying Head-Direction Encoding Accuracy Across Visual Cue Intensities

This recipe provides a methodology for assessing how the fly brain’s internal compass (the E-PG neuron activity in the ellipsoid body) tracks head direction under varying visual feedback. By comparing "no cue," "dim cue," and "bright cue" conditions, researchers can determine the influence of visual landmarks on the fidelity of the internal compass.

Calculate and compare E-PG encoding accuracy (vector strength) across the three visual-cue conditions, retaining individual-fly variability alongside population summaries.

## When to use this

- Quantify E-PG head-direction encoding accuracy under no-cue, dim-cue, and bright-cue conditions.
- Compare vector strength across visual conditions while retaining within-fly observations.
- Do not use this workflow for linear variables that do not require circular statistics.

## Scientific context

The *Drosophila* central complex functions as an internal compass. In total darkness (no cue), the compass maintains stability through path integration, but visual landmarks (dim/bright cues) significantly increase the accuracy and stabilization of the neural "bump" relative to the fly's actual heading.

## Preconditions

* **MATLAB:** Required for `plot2svg` and statistical toolboxes.
* **Custom Functions:** `prctile` (for baseline), `angle` / `exp` (for circular math), `plot2svg` (for output).

## Inputs and outputs

1. `F`: Matrix of raw fluorescence values ($Time \times ROIs$).
2. `heading`: Column vector of fly azimuthal position in radians ($Time \times 1$).
3. `condition`: Metadata array (Integer 0, 1, or 2 representing No, Dim, Bright).

* **Metric:** A scalar Vector Strength value for each fly/condition.
* **Graphic:** An SVG-format grouped scatter plot with SEM error bars and significance annotations.

## Procedure

1. **Preprocessing:** Normalize raw fluorescence ($F$) to $\Delta F/F = (F - F_{base})/F_{base}$, using the 10th-percentile of the trial/ROI as the baseline ($F_{base}$) to account for photobleaching.
2. **Bump Estimation:** Extract the azimuthal bump position ($\theta_{bump}$) using a circular center-of-mass calculation or circular convolution of the E-PG population activity.
3. **Encoding Accuracy:** Compute Vector Strength (VS) as $R = |\frac{1}{N}\sum e^{i(\theta_{bump} - \theta_{heading})}|$, where $N$ is the total time points.
4. **Statistics:** Apply a Kruskal-Wallis test followed by post-hoc pairwise comparisons (e.g., Bonferroni-Holm) to evaluate differences between the three cue conditions.

The implementation requires bridging external data with the available implementation's plotting utilities:
1. **Custom Pipeline:** Implement the $\Delta F/F$ and VS calculation in a custom MATLAB script (assumed to be developed).
2. **Statistical Processing:** Perform statistical tests using native MATLAB functions (`kruskalwallis`, `multcompare`).
3. **Visualization:** Pass the calculated VS metrics to the `plot2svg` utility to generate publication-ready plots.

1. **Normalization:** For each ROI, compute `F_base = prctile(F, 10, 1)`. Calculate `dF_F = (F - F_base) ./ F_base`.
2. **Bump Extraction:** Compute the phase of the E-PG population activity using a Fourier Transform or circular weighted mean to find $\theta_{bump}$.
3. **Vector Strength:** Compute the circular difference $\Delta \theta = \theta_{bump} - \theta_{heading}$. Calculate $R = \text{abs(mean(exp(i * \Delta \theta)))}$.
4. **Group Stats:** Aggregate $R$ values per fly per condition. Apply `kruskalwallis(R, condition)`.
5. **Visualization:** Plot individual fly lines (gray) and the across-fly mean (black) using `plot2svg` to export the figure.

## Expected results

Expected results show whether encoding accuracy (vector strength) increases as visual cue intensity transitions from "none" to "bright," with individual fly trajectories displayed in a grouped scatter plot.

* Baseline drift in $\Delta F/F$ should be negligible.
* VS values must be bounded between 0 (random) and 1 (perfect alignment).
* Pairwise p-values must be corrected for multiple comparisons.

## Pitfalls

* **Data Alignment:** Ensure the `heading` and `bump` data are sampled at the same frequency. Use linear interpolation if frame rates between the tracker and the microscope differ.
* **Circular Stats:** Always use circular differences before averaging; never average raw angles directly without complex exponential conversion.
* **Method mismatch:** Do not use image-segmentation methods such as `NCut` for neural time-series analysis.

## Bundled files

- [`scripts/run_analysis.py`](scripts/run_analysis.py): Run the primary analysis workflow.
- [`scripts/utils.py`](scripts/utils.py): Reusable analysis and plotting helpers.
- [`references/scientific_context.md`](references/scientific_context.md): Review methodological requirements, required data, and validation criteria.
- [`references/implementation_notes.md`](references/implementation_notes.md): Review execution details, expected artifacts, known gaps, and troubleshooting guidance.

## Usage

```bash
# Example execution of the plotting logic in MATLAB
plot_grouped_results(vector_strengths, conditions);
plot2svg('HD_Encoding_Accuracy.svg', gcf);
```
