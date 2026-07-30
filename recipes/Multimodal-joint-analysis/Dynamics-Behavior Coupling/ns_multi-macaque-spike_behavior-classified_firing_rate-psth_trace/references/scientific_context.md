# Scientific context

## Methodological requirements

*   **Spike Binning & Smoothing:** Convert spike trains into firing rates using a sliding window.
    *   *Parameters:* Window size = 75 ms; Step size = 10 ms.
*   **Trial Alignment:** Temporal alignment of spikes to $t=0$ (Stimulus Onset).
*   **Condition Partitioning:** Categorization of trials by Choice (Left/Right) $\times$ Difficulty (Easy/Hard).
*   **Averaging:** Calculation of $\mu = \frac{1}{N}\sum R_{i,t}$ where $R$ is the firing rate for trial $i$ at time $t$.
*   **Uncertainty Estimation:** Calculation of the Standard Error of the Mean ($SEM = \frac{\sigma}{\sqrt{N}}$) for each condition/neuron combination.

## Required data

*   **Dataset:** `examples/2024_the_dynamics_and_geometry/data/population.pkl`.
*   **Variables Needed:**
    *   `spike_times`: Spike timestamps for each unit.
    *   `trial_info`: A structure containing `stimulus_onset`, `choice` (Left/Right), and `difficulty` (Easy/Hard) labels for each trial index.
*   **Neuron Selection:** Slice indices `0` through `13` (14 total neurons).

## Validation criteria

*   **Temporal Resolution:** The code must strictly implement the 75ms/10ms sliding window configuration.
*   **Condition Fidelity:** The legend/plot must clearly distinguish between four distinct traces (e.g., [Easy-Left, Easy-Right, Hard-Left, Hard-Right]).
*   **Visualization:** Must produce a 14-panel subplot (e.g., $2 \times 7$ or $3 \times 5$ layout) where each neuron's specific PSTHs are self-contained.
*   **Error bars:** The shaded area or error bars must reflect the $SEM$ calculated from the trials corresponding to the specific condition for that neuron.
