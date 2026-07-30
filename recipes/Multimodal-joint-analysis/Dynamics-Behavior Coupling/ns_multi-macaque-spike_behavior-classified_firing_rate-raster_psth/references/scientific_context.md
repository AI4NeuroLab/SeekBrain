# Scientific context

## Methodological requirements

*   **Spike Sorting**: Criteria for isolating single units (e.g., waveform shape, refractory period violations).
*   **Normalization/Averaging**: The process of Gaussian smoothing or binning spike trains to generate continuous firing rate traces.
*   **Trial Alignment**: Definition of "Time Zero" (typically stimulus onset or "go" signal).
*   **Difficulty Sorting**: Method for categorizing trials based on stimulus difficulty (e.g., grouping trials by dot motion coherence).

## Required data

*   **Spike Train Matrix**: Time-stamped event data for individual trials.
*   **Behavioral Metadata**: Trial indices corresponding to chosen side (correct/error) and stimulus difficulty level.
*   **Electrode Metadata**: Spatial coordinates confirming the recording location is in the dorsal premotor cortex.

## Validation criteria

To determine if a study successfully answers this question, it must provide:
1.  **Visual Representation**: A clear distinction between high-difficulty and low-difficulty traces on the same graph.
2.  **Directionality**: Evidence that the neuron shows a divergence in activity based on the target side (spatial selectivity).
3.  **Temporal Resolution**: Indication of when the neural activity begins to deviate from baseline (the "decision time").
4.  **Statistical Validation**: Mention of whether the observed modulation is statistically significant across the population (not just an isolated anecdotal neuron).
