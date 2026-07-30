# Scientific context

## Methodological requirements

*   **Preprocessing:** $\Delta F/F$ calculation using the 10th-percentile baseline per trial per ROI to correct for slow photobleaching.
*   **Bump Estimation:** Circular convolution or center-of-mass calculation of the E-PG population activity to derive the azimuthal bump position ($\theta$).
*   **Encoding Accuracy Metric:** Calculation of **Vector Strength (VS)**, defined as the magnitude of the resultant vector $R = |\frac{1}{N}\sum e^{i(\theta_{bump} - \theta_{heading})}|$, where $N$ is the number of time points.
*   **Statistical Analysis:** One-way repeated measures ANOVA or Kruskal-Wallis test followed by post-hoc pairwise comparisons (e.g., Tukey-Kramer or Bonferroni-Holm correction) for the three conditions: [No Cue, Dim Cue, Bright Cue].

## Required data

*   **Input Data:** Raw fluorescence time series (F) for all ROIs in the ellipsoid body (EB) across the three visual conditions.
*   **Metadata:** Synchronized fly heading (azimuth) data from the treadmill or tracking system.
*   **Sample Size:** Data from $n=15$ flies, ensuring each fly is represented in all three conditions for paired/grouped analysis.

## Validation criteria

*   **Normalization Accuracy:** Ensure baseline subtraction uses the 10th-percentile method per trial to account for baseline drift.
*   **Visualization Consistency:** The plot must represent individual flies as linked lines to demonstrate consistent behavior across intensities, with a superimposed mean $\pm$ SEM.
*   **Statistical Rigor:** Failure to report multiple-comparison corrected p-values (e.g., adjusted $p < 0.05$ for post-hoc comparisons between Dim vs. Bright) renders the analysis incomplete.
*   **Metric Validity:** Ensure Vector Strength is calculated over the full duration of the trial to capture stationary and moving epochs.
