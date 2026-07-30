# Scientific context

## Methodological requirements

*   **Bump Phase Extraction:** Techniques for decoding the angular position of the activity "bump" within the neural population (e.g., circular mean of the population vector or fitting a von Mises distribution).
*   **Scene Orientation Tracking:** Methods used to track the fish’s rotation relative to the visual scene cues ($\theta$).
*   **Epoch Segmentation:** The criteria used to define the Pre-learning, Learning, and Post-training periods.
*   **Regression/Fitting:** Method for calculating the linear relationship (slope) between the bump phase and $\theta$, specifically the logic for applying `mod 2π` transformations during the learning epoch.

## Required data

*   **Neural Imaging Data:** Time-series data of neural activity (e.g., calcium imaging traces) capable of showing a localized "bump" of activity.
*   **Behavioral Data:** Precise synchronization between the neural activity timestamps and the frame-by-frame orientation ($\theta$) of the visual scene stimulus.
*   **Trial/Epoch Indices:** Metadata identifying which data points belong to the Pre-learning, Learning, and Post-training epochs for individual subjects.

## Validation criteria

*   **Linearity vs. Nonlinearity:** The response must correctly distinguish between the slope = 1 (identity mapping) in stable states and the slope = 2 (transformed mapping) during the learning phase.
*   **Circular Statistics:** Proper handling of angular data using the `mod 2π` operation.
*   **Temporal Fidelity:** Accuracy in matching the observed neural shift specifically to the "Learning" epoch rather than the baseline or recovered states.
*   **Subject Consistency:** Verify that all compared epochs come from the same individual to control for inter-subject variability in neural tuning.
