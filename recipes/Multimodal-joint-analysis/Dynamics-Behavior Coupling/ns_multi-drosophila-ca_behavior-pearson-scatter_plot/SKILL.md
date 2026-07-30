---
name: ns_multi-drosophila-ca_behavior-pearson-scatter_plot
description: Calculates the Pearson correlation between EPG bump width and heading-direction encoding accuracy across fly trials during active movement periods.
triggers:
  - compare fly EPG bump width to heading accuracy
  - calculate correlation between bump phase variance and head direction encoding
  - analyze relationship between EPG spatial spread and heading representation
  - perform across-fly population analysis of Drosophila navigation metrics
  - generate scatter plot of encoding accuracy vs bump width for EPG neurons
tags:
  - Drosophila
  - neuroscience
  - EPG-neurons
  - circular-statistics
  - navigation
  - population-analysis
version: '1.0'
---

# Correlation Analysis of Head-Direction Encoding Accuracy and EPG Bump Width

This recipe focuses on characterizing the functional relationship between the precision of internal head-direction (HD) representation and the spatial dynamics of the EPG (Ellipsoid-body to Protocerebrum) neural population. In *Drosophila*, the EPG neurons function as a ring attractor, where the spatial width of the activity "bump" is theorized to influence the accuracy of heading navigation.

Process neural calcium imaging data together with concurrent behavioral tracking to test predictions about EPG population tuning and heading accuracy.

## When to use this

- Relate EPG bump width to head-direction encoding accuracy across flies or trials.
- Generate a scatter plot with a Pearson coefficient after restricting analysis to active movement.
- Do not use this workflow when observations are not independent or the relationship is strongly nonlinear.

## Scientific context

The EPG population encodes the fly's head direction through a spatially localized bump of activity. Theoretical models suggest that the "width" of this bump—a measure of population-level tuning—is intrinsically linked to the stability and accuracy of the decoded orientation.

## Preconditions

*   `numpy` (Numerical computation, complex exponentials)
*   `scipy` (Circular statistics, `pearsonr`, `curve_fit`, `linregress`)
*   `matplotlib` (Visualization)

## Inputs and outputs

1. 15 fly datasets containing normalized EPG fluorescence ($\Delta F/F$) at 16 segments.
2. Corresponding behavioral files containing `head_angle` (rad) and `velocity` (mm/s).

1. `population_metrics.csv`: Per-fly values for `accuracy` and `width`.
2. `bump_width_vs_accuracy.pdf`: Publication-quality scatter plot.
3. Console printout: Pearson $r$ and $P$-value.

## Procedure

1. **Movement Gating:** Filter data to include only time points where walking velocity exceeds a defined threshold (e.g., $v > 2\text{ mm/s}$).
2. **Phase Decoding:** Identify the EPG bump phase ($\phi_{EPG}$) using the first Fourier mode of the activity across the population segments.
3. **Accuracy Calculation:** Define the HD offset ($\Delta \theta = \phi_{EPG} - \theta_{head}$) and compute circular variance ($V$), where Accuracy $= 1 - V$.
4. **Bump Width Estimation:** Fit a von Mises distribution to the EPG population activity and extract the concentration parameter ($\kappa$) or the Full-Width at Half-Maximum (FWHM).
5. **Correlation:** Perform a Pearson correlation ($r$) and linear regression on the $N=15$ dataset to determine the statistical relationship.

*   **Bridge:** Treat the logic in `encoding with multiple harmonics.ipynb` as the reference definition for bump width.
*   **Data Aggregation:** Build a container script to iterate through 15 separate fly datasets, calculating metrics per trial.
*   **Stats:** Implement `scipy.stats.pearsonr` to perform the correlation on the resulting arrays of metrics.
*   **Visuals:** Use `matplotlib.pyplot` with `scipy.stats.linregress` to annotate the regression line and $P$-value.

1. **Filter:** Subset each fly’s time series where velocity $> 2\text{ mm/s}$.
2. **Decode Phase:** Calculate $\phi_{EPG}$ by finding the angle of the complex sum of activity.
3. **Compute Metrics:**
    *   `Accuracy`: Calculate circular variance of $(\phi_{EPG} - \theta_{head})$ using `scipy.stats.circvar`.
    *   `Width`: Fit a von Mises function to the 16-segment trace using `scipy.optimize.curve_fit` to determine the concentration parameter $\kappa$.
4. **Aggregate:** Combine the mean `Accuracy` and `Width` for each of the 15 flies into a single DataFrame.
5. **Analyze:** Run `scipy.stats.pearsonr` on the two aggregate arrays.
6. **Plot:** Generate a scatter plot. Use `linregress` to calculate the slope for the regression line. Annotate the plot with $P$-value and $r$-value.

## Expected results

The analysis typically produces a scatter plot showing the population-level trend (e.g., whether narrower bumps correlate with higher accuracy), accompanied by a $P$-value indicating the significance of the relationship across the sample of 15 flies.

*   Ensure phase values are wrapped within $[-\pi, \pi]$ before circular variance calculation.
*   Confirm the sample size $N=15$ is strictly maintained.
*   Validate that movement-gating produces sufficient time points ($>60$ seconds) per fly to ensure reliability.

## Pitfalls

*   **Data Quality:** If experimental data shows "bump jumping," calculate the circular variance only during periods of stable heading.
*   **Metric Choice:** The von Mises fit assumes a single bump. In instances of multi-modal activity, the bump width calculation may fail; implement a sanity check on the fit residuals.

## Bundled files

- [`scripts/run_analysis.py`](scripts/run_analysis.py): Run the primary analysis workflow.
- [`scripts/utils.py`](scripts/utils.py): Reusable analysis and plotting helpers.
- [`references/scientific_context.md`](references/scientific_context.md): Review methodological requirements, required data, and validation criteria.
- [`references/implementation_notes.md`](references/implementation_notes.md): Review execution details, expected artifacts, known gaps, and troubleshooting guidance.

## Usage

```bash
python population_metrics.py --data_dir ./raw_data --output_dir ./results --n_flies 15
```
