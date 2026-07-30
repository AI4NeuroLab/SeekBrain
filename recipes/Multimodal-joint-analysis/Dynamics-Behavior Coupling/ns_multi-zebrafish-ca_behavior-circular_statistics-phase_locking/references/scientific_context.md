# Scientific context

## Methodological requirements

*   **Phase Offset Calculation:** The method used to define the "scene–bump offset." This involves calculating the angular difference between the position of the visual scene and the position of the neural activity bump (the circular mean or distance between the two).
*   **Out-phase Definition:** The threshold used to classify an offset as "out-phase" (e.g., typically defined as the range beyond a specific angular deviation, such as $\pm \pi/2$ or $90^\circ$ from the perfectly aligned position).
*   **Fractional Time Computation:** The formula for the fraction of time spent in the out-phase, likely calculated as: $T_{out} / T_{total}$ for each epoch.
*   **Statistical Analysis:** Paired analysis (e.g., repeated-measures ANOVA or paired t-tests) used to compare the means of these fractions across epochs, given the "grey lines connecting the same fish."

## Required data

*   **Neural Activity Data:** Time-series data of the neural "bump" location (e.g., population vector or decoded position).
*   **Visual Scene Data:** Time-series data of the visual scene position relative to the fish.
*   **Temporal Epoch Labels:** Timestamps or indexing for the Pre-learning, Learning, and Post-learning phases.
*   **Subject IDs:** Unique identifiers for each fish to facilitate the paired visualization (the "grey lines connecting the same fish").

## Validation criteria

*   **Alignment Metric Validity:** Does the calculated offset capture the instantaneous relationship between visual input and internal state?
*   **Threshold Sensitivity:** Is the "out-phase" range scientifically justified based on the neural representation's tuning curve?
*   **Epoch Normalization:** Does the fraction calculation account for variations in recording duration across the different epochs?
*   **Statistical Rigor:** Do the grey lines correctly represent within-subject variance, and is the reported significance (if any) corrected for multiple comparisons across the three epochs?
