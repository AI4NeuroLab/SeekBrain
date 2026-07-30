# Implementation notes

## Prerequisites

*   **Data:** Raw spike timestamps, behavioral metadata (Trial IDs, Choice, Stimulus Coherence/Difficulty, Alignment timestamps).
*   **Environment:** Python (NumPy, Pandas, Scipy, Matplotlib/Seaborn) or MATLAB (Signal Processing Toolbox).
*   **Kernel:** Defined smoothing window (typically a Gaussian kernel $\sigma = 20-50$ ms).

---

## Execution details

| Step | Action | Method basis | Implementation basis | Input | Output | Validation |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **1. Trial Filtering** | Filter trials based on difficulty/choice. | "Methods: Behavioral Analysis" | `df.groupby(['choice', 'diff'])` | Raw Metadata | Sub-sampled trial indices | Match `N` trials to study figure captions. |
| **2. Spike Binning** | Discretize spike times into fixed bins (e.g., 1ms or 10ms). | "Methods: Electrophysiology" | `np.histogram` or `spike_binning.m` | Raw timestamps | Binary matrix (trials x bins) | Confirm sum of bins = total spike count. |
| **3. Smoothing** | Convolve binned spikes with a Gaussian/Boxcar kernel. | "Statistical Analysis: PSTH construction" | `scipy.ndimage.gaussian_filter1d` | Binary spike matrix | Smoothed spike rate matrix | Verify kernel $\sigma$ matches study methods. |
| **4. Alignment** | Shift time vector so `t=0` is Stimulus Onset. | "Methods: Alignment" | `time_vec - stim_onset` | Time series | Aligned PSTHs | Ensure pre-stimulus activity is stable. |
| **5. Averaging** | Compute mean across all trials per neuron/condition. | "Results: Population Dynamics" | `np.mean(data, axis=0)` | Sorted rate matrix | Population PSTH vector | Check for SEM/Shaded error bars. |

---

## Expected artifacts

1.  **Figure Panel:** A grid of line plots.
    *   *X-axis:* Time (aligned to stimulus onset).
    *   *Y-axis:* Firing rate (spikes/sec).
    *   *Grouping:* Line color/style representing "Difficulty" (e.g., low-alpha to high-alpha colors); Line facets (rows/cols) representing "Choice" (Left vs. Right).
2.  **Quantitative Matrix:** A 4D array: `(N_neurons, N_timepoints, N_difficulties, N_choices)`.

---

## Troubleshooting

*   **Issue: PSTH is too noisy/spiky.**
    *   *Check:* The smoothing kernel width ($\sigma$). If the study specifies a 50ms Gaussian kernel, ensure the code is not using a 5ms window.
*   **Issue: Choice selectivity is missing or "washed out".**
    *   *Check:* Trial-to-event alignment. If `stim_onset` timestamps are relative to `trial_start` but the code treats them as absolute time, the alignment will be jittered.
*   **Issue: Firing rates are orders of magnitude different for the analysis.**
    *   *Check:* Normalization. Does the study report *raw firing rates* or *z-scored relative to baseline*? If the latter, ensure the baseline window (e.g., -500ms to 0ms) is correctly subtracted and normalized by the baseline standard deviation.
*   **Issue: Artifactual peaks at edges.**
    *   *Check:* "Edge effects" in convolution. Ensure the window is sufficiently padded before convolving to avoid boundary distortion near $t=0$.
