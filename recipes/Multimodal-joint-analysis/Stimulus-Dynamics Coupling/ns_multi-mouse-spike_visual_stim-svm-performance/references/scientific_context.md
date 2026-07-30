# Scientific context

## Methodological requirements

*   **SVM Decoding Framework:** The use of a multi-class linear Support Vector Machine with cross-validation to assess how well population activity predicts specific stimulus identity.
*   **Visual Responsiveness Index (VRI):** The calculation identifying a neuron as "visually responsive" if its stimulus-evoked activity significantly exceeds the baseline (trial-shuffled) activity (usually a p-value threshold < 0.05).
*   **Area-wise Aggregation:** The grouping of units by their electrode location (via histology/CCF registration) to compare percentages of responsive units per ROI.

## Required data

*   **Spike Trains:** Binned spike counts for each unit aligned to stimulus onset.
*   **Unit Quality Metrics:** Inclusion criteria for "well-isolated" units (e.g., ISI violations, presence ratio, amplitude cutoff).
*   **Stimulus Metadata:** The identity/label of the visual stimulus presented during each trial.
*   **Brain Region Labels:** Corresponding CCF (Common Coordinate Framework) annotations for each unit.

## Validation criteria

To determine if the comparison between brain regions is valid, consider the following metrics:
*   **Normalization:** Did the study control for varying unit counts per region? (e.g., using subsampling to a common number of units before decoding).
*   **Statistical Significance:** Are the decoding results compared against a "shuffled" distribution (null model) for each brain region individually?
*   **Consistency:** Are the "responsive neuron fractions" reported using the same stimulus window (e.g., 0–500ms post-stimulus) for all brain areas?
*   **Standardization:** Are the differences in decoding accuracy attributed to biological differences or to differences in signal-to-noise ratios between regions?
