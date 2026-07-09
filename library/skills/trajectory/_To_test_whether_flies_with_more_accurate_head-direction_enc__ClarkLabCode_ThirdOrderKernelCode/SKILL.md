---
name: "Drosophila EPG Compass Accuracy and Bump Width Correlation Analysis"
description: "Computes the Pearson correlation between head-direction encoding accuracy and EPG bump width in Drosophila by processing neural activity and behavioral movement data."
triggers:
  - "How does EPG bump width relate to HD encoding accuracy in flies?"
  - "Correlate fly head-direction accuracy with neural bump width during dim-cue conditions."
  - "Perform statistical analysis on EPG bump dynamics and navigation precision."
  - "Calculate circular variance of EPG phase offset for Drosophila compass studies."
  - "Analyze the relationship between bump sharpness and navigational accuracy in Drosophila."
tags:
  - "Drosophila"
  - "Neuroscience"
  - "Circular Statistics"
  - "Central Complex"
  - "Information Theory"
version: "1.0"
---

# Skill: Quantifying the Relationship Between Head-Direction Encoding Accuracy and EPG Bump Width

## Overview
This skill implements the analysis pipeline to test if *Drosophila* with more accurate head-direction (HD) encoding exhibit narrower EPG (E-PG neuron) bumps under low-contrast visual conditions. The analysis bridges high-resolution neural imaging of the central complex with behavioral tracking to derive two key metrics: HD encoding accuracy (defined as $1 - \text{circular variance of phase offset}$) and bump width (parameterized via Von Mises concentration).

The implementation relies on aggregating data across 15 biological replicates (flies), filtering for active walking periods to minimize spontaneous neural drift, and performing a Pearson correlation to test the functional constraint hypothesis. While the provided repository (`ITE_package_cmu`) offers information-theoretic tools for association, the primary neurobiological analysis requires custom scripting to fit neural population activity profiles to a Von Mises distribution.

## Objective
To quantify the correlation between HD encoding accuracy and EPG bump width during dim-cue navigation and to validate the relationship via a scatter plot with regression analysis.

## Background (from Paper)
### Scientific Context
The *Drosophila* compass system consists of E-PG neurons that form a bump of activity representing the fly's current heading. Encoding accuracy is assumed to be constrained by the "tightness" of this bump, where narrower activity profiles in the protocerebral bridge (PB) potentially represent more precise neural representations of heading.

### Methods Description
1.  **Movement Filtering:** Isolate navigation periods where angular/translational velocity exceeds a predefined threshold (e.g., $|\omega| > 20^\circ/s$).
2.  **Bump Parameterization:** Fit EPG population calcium traces across the PB to a Von Mises distribution to extract the concentration parameter ($\kappa$) or full width at half maximum (FWHM).
3.  **Encoding Accuracy:** Calculate the instantaneous phase offset between the EPG bump peak and the animal's physical head direction. Compute the accuracy as $1 - \text{circular variance}$ of this offset.
4.  **Statistical Integration:** Compute the mean values of bump width and accuracy for each of the 15 flies during the dim-cue block.
5.  **Correlation:** Use Pearson correlation on the $N=15$ fly-averaged vectors.

### Expected Results
The paper suggests a functional correlation where higher encoding accuracy (lower variance of offset) corresponds to higher $\kappa$ values (narrower bumps).

## Implementation Guidance
### Verified Repository Components
No verified repository implementation was available in the provided context for the specific EPG neurobiology analysis. The repository consists of Information-Theoretic Estimators (ITE) for kernel-based dependency measures.

### Conceptual Implementation Plan
1.  **Preprocessing:** Use `numpy` to filter behavioral timestamps and neural traces based on the movement mask.
2.  **Fitting:** Implement a `fit_von_mises` function using `scipy.optimize.curve_fit` on EPG activity profiles.
3.  **Stats:** Use `astropy.stats.circvar` for circular variance calculations.
4.  **Correlation:** Perform Pearson correlation using `scipy.stats.pearsonr`.
5.  **Advanced Analysis:** If Pearson correlation fails, utilize `ITE_package_cmu` tools (e.g., `qmi_cs`) to test for non-linear dependencies.

### Dependencies
*   `python 3.x`
*   `numpy`
*   `scipy` (for optimization and correlation)
*   `astropy` (for circular statistics)
*   `matplotlib` (for plotting)

## Structured Prompt
### Input Specification
1.  `neural_traces_matrix`: $T \times N$ matrix (Time $\times$ PB channels).
2.  `behavioral_log`: Array containing head direction and angular velocity per frame.
3.  `block_metadata`: Start/end indices for "dim-cue" epochs.

### Processing Steps
1.  **Filtering:** Apply thresholding to `behavioral_log` to generate `movement_mask`.
2.  **Calibration:** Calculate the instantaneous bump phase using the Hilbert transform or a weighted circular mean of PB channel activity.
3.  **Extraction:** Fit the Von Mises model to the neural activity vector at each frame. Store the concentration parameter $\kappa$.
4.  **Computation:** Calculate $\Delta\theta$ per frame, and then compute the mean `accuracy = 1 - circ_var(delta_theta)` for the fly.
5.  **Aggregation:** Collect `mean_accuracy` and `mean_width` for all 15 flies into two arrays.
6.  **Analysis:** Execute `scipy.stats.pearsonr(accuracy, width)`.

### Output Specification
1.  **Figure:** Scatter plot with regression line, labeled axes, and Pearson $P$ value.
2.  **Data:** `.csv` or `.npz` file containing fly-ID, encoding accuracy, and bump width.

### Validation Criteria
1.  Pearson correlation must be based on $N=15$ individual fly means, not aggregated time-points (avoids "pseudoreplication").
2.  Circular variance must be calculated on the angular error, not linear deviation.

## File Structure

```
_To_test_whether_flies_with_more_accurate_head-direction_enc__ClarkLabCode_ThirdOrderKernelCode/
    references/
        matched_files/
            naturalSceneSimu_ITE_package_cmu_README.md
            naturalSceneSimu_ITE_package_cmu_code_shared_embedded_ITL_license.txt
            naturalSceneSimu_ITE_package_cmu_code_shared_embedded_ITL_readme.txt
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
*   `analyze_HD_bump_correlation.py` (Custom script to be created): Orchestrates filtering, fitting, and statistical testing.

## References Documentation
*   `ITE_package_cmu/compileDir_simple.m`: Essential to run if utilizing ITE tools for advanced non-linear dependency estimation.

## Usage Example
```bash
python analyze_HD_bump_correlation.py --data_path ./fly_data --block_type dim_cue --output_dir ./results
```

## Notes & Caveats
*   **Pseudoreplication:** Ensure correlation is performed on per-fly averages ($N=15$), as individual frame-level data will grossly inflate degrees of freedom and result in spurious significance.
*   **Stationary Periods:** Ensure strictly that stationary periods are filtered out, as bump width artifacts frequently occur when the fly is not actively navigating.
*   **Von Mises Fit:** If the EPG activity is low, fitting might fail; ensure a goodness-of-fit check is implemented for each frame.