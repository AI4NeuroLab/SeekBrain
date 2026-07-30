---
name: ns_multi-mouse-spike_behavior_visual_stim-spearman-scatter_plot
description: Computes and visualizes the Spearman correlation between electrophysiology and widefield imaging neurometric shift values across 32 defined cortical regions.
triggers:
  - compare electrophysiology and widefield imaging shifts
  - compute Spearman correlation for cortical neurometric shifts
  - plot ephys vs wfi neurometric shift with regression
  - analyze cross-modal visual response correspondence
  - calculate regional neurometric shift correlation between ephys and wfi
tags:
  - neuroscience
  - Allen Institute
  - electrophysiology
  - widefield imaging
  - statistical correlation
  - data visualization
version: '1.0'
---

# Cross-Modal Neurometric Correlation Analysis of Cortical Regions

This recipe implements a cross-modal comparison of visual response properties between electrophysiology (Neuropixels) and widefield calcium imaging (WFI). The analysis objective is to determine the correspondence of post-stimulus neurometric shifts across 32 matched cortical regions. By correlating these modalities, researchers can validate the sensitivity of widefield signals against the ground-truth firing rate shifts measured at the single-neuron level.

This implementation relies on retrieving standardized experimental data via the Allen Institute SDK and applying robust statistical validation to ensure that observed correlations are not artifacts of global signal drifts or non-stationary noise.

## When to use this

- Compare regional neurometric shifts measured by electrophysiology and widefield imaging.
- Compute a Spearman correlation across matched cortical regions and inspect influential observations.
- Do not use this workflow when region labels or shift definitions differ between modalities.

## Scientific context

The Neuropixels/Widefield visual coding dataset allows for the examination of how different cortical areas process visual stimuli. Because WFI measures localized calcium transients and Ephys measures neuronal firing, comparing these modalities requires mapping both to the Common Coordinate Framework (CCF) to ensure that the 32 responsive regions are compared on a one-to-one basis.

## Preconditions

*   `allensdk`
*   `scipy`
*   `seaborn`
*   `matplotlib`
*   `pandas`
*   `numpy`

## Inputs and outputs

1.  Access to Allen Institute Brain Observatory (Ephys/WFI manifests).
2.  List of 32 CCF cortical area indices.
3.  Post-stimulus neurometric shift parameters (window: 0–200ms).

*   A scatter plot (PNG/PDF) showing 32 points.
*   A regression line with a 95% confidence interval (shaded).
*   Annotated text: `Spearman ρ = [value], p = [value]`.

## Procedure

1.  **Alignment:** Map sessions to the 32 standard CCF cortical areas.
2.  **Shift Calculation:** Calculate neurometric shift (typically $\Delta d'$ or population vector shift) for both modalities relative to a pre-stimulus baseline.
3.  **Correction:** Apply baseline activity subtraction or noise normalization to account for differences in vascularization or probe depth.
4.  **Statistical Inference:** Compute Spearman’s $\rho$ to assess monotonicity.
5.  **Fitting:** Perform linear regression with 95% confidence intervals to visualize the relationship.

1.  **SDK Interface:** Use `allensdk.brain_observatory` to pull session data.
2.  **Data Harmonization:** Filter for experimental sessions that overlap in the 32 defined cortical regions.
3.  **Calculation Logic:** Define a function to compute neurometric shifts using `scipy.stats` for baseline-corrected $d'$ calculations.
4.  **Statistical Engine:** Use `scipy.stats.spearmanr` for correlation and `seaborn.regplot` for regression visualization.
5.  **Validation:** Apply label-shuffling (as demonstrated in `nonsense.ipynb`) to establish a null distribution for your $p$-values.

1.  **Retrieve Data:** Use `BrainObservatoryCache` to load `ophys` and `ephys` experiments.
2.  **Align Regions:** Join datasets on CCF labels; filter for the 32 regions present in both.
3.  **Normalize:** Apply the baseline correction: $Shift_{corr} = (Shift - \mu_{baseline}) / \sigma_{noise}$.
4.  **Compute Correlation:** Execute `stats.spearmanr(ephys_shifts, wfi_shifts)`.
5.  **Generate Plot:** Use `sns.regplot(x=wfi, y=ephys, ci=95)` to visualize.
6.  **Annotate:** Append $\rho$ and $p$-value to the figure using `plt.text`.

## Expected results

A statistically significant positive correlation would indicate that regions with higher WFI neurometric sensitivity also have higher electrophysiological sensitivity, supporting widefield imaging as a population-level proxy.

*   Ensure exactly 32 regions are used.
*   Confirm Spearman (not Pearson) correlation is used.
*   Verify that the 95% confidence interval is calculated via bootstrap or linear regression methods.

## Pitfalls

*   **Data Alignment:** If sessions do not perfectly match, ensure you are aggregating across the mean of multiple experimental sessions per region rather than attempting to pair raw session IDs directly.
*   **Statistical Significance:** Do not rely on parametric $p$-values if the data is highly non-normal; use permutation-based significance testing if the sample size appears to violate normality assumptions.

## Bundled files

- [`scripts/run_analysis.py`](scripts/run_analysis.py): Run the primary analysis workflow.
- [`scripts/utils.py`](scripts/utils.py): Reusable analysis and plotting helpers.
- [`references/scientific_context.md`](references/scientific_context.md): Review methodological requirements, required data, and validation criteria.
- [`references/implementation_notes.md`](references/implementation_notes.md): Review execution details, expected artifacts, known gaps, and troubleshooting guidance.

## Usage

```bash
python cross_modal_analysis.py --region_count 32 --output_dir ./plots
```
