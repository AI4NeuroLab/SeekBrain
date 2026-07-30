# Implementation notes

## Prerequisites

1.  **Software**: Python 3.9+, `numpy`, `pandas`, `scipy`, `matplotlib`.
2.  **bundled implementation Dependencies**: `phy` (to access the `TemplateModel`), and the processed experimental data files containing behavioral timestamps and stimulus conditions.
3.  **Data**: A dataset containing:
    *   `spike_times.npy` and `spike_clusters.npy` (extracted via `phy`).
    *   Behavioral log file containing `stim_onset_times`, `reaction_times`, `coherence_levels`, and `choice_vectors`.

---

## Execution details

| Step | Action | Method basis | Code/Lib Reference | Input/Parameters | Output | Validation |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **1. Data Alignment** | Align spike events with trial metadata based on `stim_onset`. | Methods: Trial Selection | `TemplateModel.spike_times` | `spike_times`, `stim_onset` | Trial-indexed spikes | Check against known session trial counts. |
| **2. Trial Partitioning** | Separate trials into 4 categories: {L-Easy, L-Hard, R-Easy, R-Hard}. | Results: Diversity of PMd | `pandas` dataframe | `coherence`, `choice` | Grouped trial indices | Sum of counts equals total trial count. |
| **3. PSTH Computation** | Calculate firing rates in 75ms bins, 10ms slide. | Methods: PSTHs | `numpy.convolve` | Window=75ms, Step=10ms | Firing rate array ($N_{bins} \times N_{trials}$) | Verify rate units (Hz). |
| **4. RT-Capping** | Mask activity after RT to focus on decision formation. | Methods: Decision Window | `logic masking` | `RT` | Variable-length trial segments | Mean firing rate at RT is consistent with choice. |
| **5. Statistics** | Compute mean and SEM for each condition across time. | Results: Population Summary | `scipy.stats.sem` | Grouped trial arrays | Mean $\pm$ SEM arrays | SEM shading reflects trial count $N$. |
| **6. Visualization** | Plot the 4 conditions on a single axis for each neuron. | Figures: Example Neurons | `matplotlib.pyplot` | 4 arrays per neuron | PSTH plot with shading | Visual check for "ramping vs. non-monotonic." |

---

## Expected artifacts

*   **A collection of plots** (one per unit), each featuring four color-coded lines:
    *   **Solid/Dashed lines** for Left/Right choices.
    *   **Thick/Thin lines** for Easy/Hard coherence.
*   **Heterogeneity Matrix**: A categorical table mapping units to their temporal profile (Ramping, Transient, Non-monotonic) based on the computed slopes and extrema of the traces.

---

## Troubleshooting

1.  **Low Trial Counts for Hard Trials**: If SEM bars are extremely wide, it implies insufficient trials for that specific coherence level. 
    *   *Fix*: Combine "Hard" and "Medium" difficulty if necessary, or check the `phy` sorting quality (ensure unit is stable across the whole session).
2.  **Firing Rate Bias**: Differences in baseline firing might obscure dynamics.
    *   *Fix*: Z-score firing rates relative to a pre-stimulus baseline (-200ms to 0ms) before plotting.
3.  **Variable RT artifacts**: Abrupt drops in firing rate at the end of traces often occur if trials have vastly different RTs.
    *   *Fix*: Only plot up to the 25th percentile of RTs, or ensure that you are strictly masking the data `if t > RT` before averaging.
4.  **`phy` GUI Connectivity**: If you cannot see units in the GUI, ensure the `params.py` file is correctly pointing to the `.npy` files. Use the `phy` Python API `model = TemplateModel(path_to_params)` to access spikes programmatically if manual export fails.
