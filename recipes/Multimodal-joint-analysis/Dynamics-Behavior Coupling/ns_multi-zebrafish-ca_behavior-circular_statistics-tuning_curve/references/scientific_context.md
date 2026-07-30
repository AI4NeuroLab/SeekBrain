# Scientific context

## Methodological requirements

*   **Identification of HD Cells:** Selection criterion based on Rayleigh vector length or circular-linear correlation between fluorescence and head direction (or scene orientation).
*   **Preferred Orientation Estimation ($b$):** Use of circular mean or peak estimation on the pre-learning epoch's tuning curve.
*   **Normalization/Centering:** Fluorescence ($\Delta F/F$) tuning curves must be computed relative to scene orientation ($\theta$) and shifted by the individual's preferred orientation ($\theta - b$), with periodic wrapping to $[-\pi, \pi]$.
*   **Sorting:** Sorting ROIs by $b$ based on the Pre-learning epoch and maintaining that specific index mapping for the Learning and Post-learning heatmaps.
*   **Color Mapping:** Application of a normalized, shared color scale across the three epochs to ensure visual comparability of firing rates.

## Required data

*   **Time-series fluorescence data:** ROI-extracted $\Delta F/F$ traces synchronized with VR frame triggers.
*   **Behavioral variables:** Continuous tracking of animal head direction and scene orientation ($\theta$) throughout the pre-learning, learning, and post-learning periods.
*   **Temporal Epoch Indices:** Start/stop timestamps for the three experimental phases.

## Validation criteria

To consider the analysis complete, the following criteria must be met:
1.  **Alignment Consistency:** The $y$-axis (ROI index) must be identical across the Pre, Learning, and Post heatmaps to visualize the "drift" or "splitting" of tuning.
2.  **Symmetry Assessment:** The summary must quantify the degree of bimodality in the "Learning" heatmap—specifically, whether cells develop a second peak at $\pi$ offset (typical in symmetric scenes) and whether this occurs across the population or only for specific orientations.
3.  **Visualization:** The three-panel heatmap must use a uniform color range (e.g., min to max of the aggregated data) so that shifts in fluorescence intensity are not artifacts of the scaling.
4.  **Statistical Validation:** Explicitly state if the emergence of the double-peaked tuning is statistically significant compared to a null distribution (e.g., shuffling the ROI identities or scene orientations).
