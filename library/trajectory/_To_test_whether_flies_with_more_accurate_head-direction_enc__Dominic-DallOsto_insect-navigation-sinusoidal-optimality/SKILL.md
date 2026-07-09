---
name: "Fly EPG Bump and Head-Direction Encoding Analysis"
description: "Calculates EPG bump width and head-direction encoding accuracy from calcium imaging data to perform cross-fly Pearson correlation analysis."
triggers:
  - "correlate fly head-direction encoding with EPG bump width"
  - "calculate EPG bump phase accuracy from neural data"
  - "analyze EPG bump dynamics during movement in dim-cue conditions"
  - "compute pearson correlation between bump width and navigation encoding"
  - "generate scatter plot of EPG encoding accuracy across 15 flies"
tags:
  - "Drosophila"
  - "neuroscience"
  - "calcium-imaging"
  - "circular-statistics"
  - "neural-navigation"
version: "1.0"
---

# Skill: Correlating Head-Direction Encoding Accuracy with EPG Bump Width

## Overview
This skill establishes the relationship between the precision of neural head-direction (HD) representation and the spatial tuning of the EPG (Ellipsoid Body) neural bump. By analyzing calcium imaging data from *Drosophila* EPG neurons, this skill quantifies how individual differences in bump width (the spatial spread of neural activity) correlate with HD encoding accuracy during low-contrast visual navigation.

The analysis is based on the neurobiological observation that the EPG circuit functions as a ring attractor. The bump width serves as a proxy for the spatial concentration of activity, while the circular variance of the phase offset between the neural bump and the physical heading indicates representational accuracy.

## Objective
To determine if narrower EPG bump widths are associated with higher HD encoding accuracy across a population of $N=15$ flies, specifically during movement periods in low-contrast ("dim") visual cue conditions.

## Background (from Paper)
### Scientific Context
The EPG network integrates angular velocity and visual landmarks to maintain an internal representation of head direction. Theoretical models suggest that a narrower activity bump increases the signal-to-noise ratio of the representation, thereby improving tracking accuracy.

### Methods Description
1. **Movement Filtering:** Isolate time periods where fly rotational/translational velocity $v > v_{threshold}$ to focus on active navigation.
2. **Phase/Width Extraction:** Fit a von Mises distribution to the EPG population calcium activity at each time point to derive phase ($\phi$) and concentration/width ($\sigma$).
3. **Accuracy Calculation:** Calculate the phase offset $\Delta \theta = \phi_{EPG} - \theta_{HD}$. Define Accuracy as $1 - \text{CircularVariance}(\Delta \theta)$.
4. **Correlation:** Perform Pearson correlation across the 15 fly samples using the mean per-fly values.

### Expected Results
The study expects an inverse relationship between bump width and encoding accuracy, where flies displaying higher spatial precision (narrower bumps) demonstrate lower circular variance (higher encoding accuracy) in their HD representation.

## Implementation Guidance
### Verified Repository Components
No verified repository implementation was available in the provided context. The existing repository is limited to structural connectivity matrices and theoretical Fourier harmonic encoding models.

### Conceptual Implementation Plan
1. **Data Ingestion:** Load synchronized calcium imaging traces (R58G05-GAL4) and behavioral logs for 15 experimental sessions.
2. **Filtering:** Apply a rotational velocity threshold (typically $\sim 10-20^\circ/s$) to mask out stationary periods.
3. **Fitting:** Use `scipy.optimize.curve_fit` to extract bump parameters ($A, \mu, \kappa$) for every frame in the dim-cue block.
4. **Statistical Calculation:** Use `scipy.stats.circvar` to compute accuracy scores; use `scipy.stats.pearsonr` for the cross-fly correlation.
5. **Visualization:** Plot the $N=15$ fly averages using `matplotlib.pyplot.scatter` overlaid with a `scipy.stats.linregress` line.

### Dependencies
* `numpy`: Mathematical processing of neural traces.
* `pandas`: Data aggregation of per-fly results.
* `scipy`: Circular statistics and regression analysis.
* `matplotlib`: Figure generation.
* `astropy`: (Optional) Specialized circular statistics tools.

## Structured Prompt
### Input Specification
1. Calcium imaging activity matrix ($T \times N_{neurons}$).
2. Behavioral heading time series ($\theta_{HD}$ at frequency $f$).
3. Fly ID and metadata labels (identifying the "first dim-cue" block).

### Processing Steps
1. Filter the imaging time series using the provided velocity threshold to select relevant indices.
2. Perform a von Mises fit on the $N_{neurons}$ vector for each valid index to extract the phase $\phi$ and concentration $\kappa$ (where $\sigma = 1/\sqrt{\kappa}$).
3. Calculate the circular variance of $\Delta \theta = (\phi - \theta_{HD}) \pmod{2\pi}$ for each fly.
4. Compute the mean bump width ($\mu_{\sigma}$) across the movement epochs for each fly.
5. Perform a Pearson correlation test between `accuracy` and `mean_bump_width`.

### Output Specification
1. `results.csv`: Table containing columns `fly_id`, `encoding_accuracy`, and `mean_bump_width`.
2. `correlation_stats.txt`: Summary containing Pearson $r$ and $P$-value.
3. `figure_hd_accuracy.png`: Scatter plot with regression line and annotated $P$-value.

### Validation Criteria
1. Accuracy metric must fall within the range $[0, 1]$.
2. Pearson $P$-value must be calculated using $N=15$ data points.
3. Plot must include a fitted regression line.

## File Structure

```
_To_test_whether_flies_with_more_accurate_head-direction_enc__Dominic-DallOsto_insect-navigation-sinusoidal-optimality/
    references/
        matched_files/
            README.md
            connectivity_matrices.py
            encoding_with_multiple_harmonics.ipynb
            fruit_fly_data_analysis.ipynb
            insect_network_graph_analysis.ipynb
            noise_affected_multiple_harmonics_encoding.ipynb
            phase_portaits.ipynb
            polar_coordinates_noise_distribution.ipynb
            sinusoidal-ei-network-maths.ipynb
            sinusoidal_Hebbian_learning_weights.ipynb
            sinusoidal_Hebbian_learning_weights_negative_activity.ipynb
            sinusoidal_Hebbian_learning_weights_negative_activity_with_errors.ipynb
            sinusoidal_Oja_s_rule_negative_activity.ipynb
            sinusoidal_input_rejection.ipynb
            sinusoidal_noise_rejection.ipynb
            sinusoidal_noise_rejection_negative_activity.ipynb
            sinusoidal_phase_portraits_negative_activity.ipynb
            sinusoidal_updating_activity_and_weights.ipynb
        connection_analysis.md
        paper_context.md
        paper_figure_methods.md
        paper_structured_summary.md
        question.md
        repo_context.md
        repo_file_summaries.md
        repo_overview.md
        reproduction_plan.md
    scripts/
        run_analysis.py
        utils.py
```

## Scripts Documentation
* No existing functional scripts. Developers should create a new `analysis_functional.py` to house the fitting and correlation logic.

## References Documentation
* `encoding with multiple harmonics.ipynb`: Theoretical reference for the Fourier-based bump representation used in this analysis.

## Usage Example
```bash
python run_functional_analysis.py --data_dir ./data/dim_cue_blocks --output_dir ./results --n_flies 15
```

## Notes & Caveats
- **Bump Fitting:** Fitting may fail on noisy data; ensure sufficient signal-to-noise in calcium traces before fitting.
- **Independence:** The statistical test is at the fly level; ensure data is averaged *before* correlation, not per time-point.
- **Movement Periods:** The definition of "movement" is sensitive; calibrate the threshold against the specific camera frame rate and fly strain behavior.