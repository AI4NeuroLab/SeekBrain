# Scientific context

## Methodological requirements

*   **PSTH Construction**: Calculation of firing rates using a **75-ms sliding window** stepped at **10-ms intervals**.
*   **Normalization/Trial Averaging**: Computation of the mean firing rate across trials within the four groups: *Left-Easy, Left-Hard, Right-Easy, Right-Hard*.
*   **Standard Error Calculation**: Use of $SEM = \sigma / \sqrt{n}$ for each time bin to establish confidence intervals.
*   **Decision-Formation Window**: Restriction of data to the interval $[120ms + \text{stimulus onset}]$ to $[RT]$.

## Required data

*   **Neural Spike Trains**: Single-unit isolation data from the dorsal premotor cortex (PMd).
*   **Behavioral Metadata**: Trial-by-trial indices including:
    *   **Choice**: Left vs. Right.
    *   **Coherence**: Easy (High coherence) vs. Hard (Low coherence).
    *   **Timestamp markers**: Stimulus onset time, Go-cue, and RT.

## Validation criteria

To consider your characterization successful, the following criteria must be met:
1.  **Temporal Profile Classification**: The visualization must clearly show distinct categories: ramping (monotonic), transient (peak/trough), and non-monotonic (reverting).
2.  **Condition Separation**: Each plot must display 4 distinct traces (L-Easy, L-Hard, R-Easy, R-Hard) to demonstrate whether the difficulty effect is modulated by the choice effect.
3.  **Statistical Validity**: The inclusion of SEM bars or shading is mandatory to ensure that the "diversity" observed is not an artifact of low trial counts in specific coherence conditions.
4.  **Model comparison**: Quantify the proportion of non-ramping neurons before concluding that a uniform ramping model is inadequate.

***

Mask samples beyond each trial's reaction time before applying sliding-window averaging.
