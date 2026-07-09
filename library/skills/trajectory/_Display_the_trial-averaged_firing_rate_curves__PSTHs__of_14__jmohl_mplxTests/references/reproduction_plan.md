# Reproduction Plan for _Display_the_trial-averaged_firing_rate_curves__PSTHs__of_14

This reproduction plan outlines the steps required to generate the trial-averaged firing rate curves (PSTHs) for the specified population of PMd neurons, based on the provided methodology.

---

### ## Prerequisites
*   **Environment:** Python 3.9+ with `numpy`, `pandas`, `matplotlib`, and `scipy`.
*   **Data:** `examples/2024_the_dynamics_and_geometry/data/population.pkl`.
*   **Knowledge:** Familiarity with the `pandas` DataFrame structure (for trial metadata) and `numpy` array manipulation.

---

### ## Step-by-Step Procedure

| Step | Action | Paper/Repo Reference | Input | Output | Parameters/Validation |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **1** | **Load Data** | `data_utils.py` | `population.pkl` | Dict/DataFrame | Validate keys: `spikes`, `choice`, `difficulty`. |
| **2** | **Filter Neurons** | Methods: Section 2.2 | `all_neurons` | `n_subset` (0-13) | Ensure shape matches expected neuron count (14). |
| **3** | **Alignment** | Methods: Sec 3.1 | `spike_times`, `stim_onset` | Aligned spike vectors | Align to $t=0$ (Stimulus Onset). |
| **4** | **Partitioning** | Methods: Sec 3.1 | `trial_labels` | Indices for 4 conditions | `Easy-L, Easy-R, Hard-L, Hard-R`. |
| **5** | **Windowing** | Methods: Pop. Analysis | Aligned spikes | Firing rates (Hz) | Window=75ms, Step=10ms. |
| **6** | **Statistical Agg.** | Methods: Uncertainty Est. | Binned rates | Mean ($\mu$) and SEM | Verify `SEM = std/sqrt(n)`. |
| **7** | **Visualization** | Section: Visuals | $\mu$ and $SEM$ | 14-panel plot | Layout: `2x7` grid. |

---

### ## Detailed Procedure
1.  **Data Ingestion**: Load the `population.pkl`. Identify the dictionary structure; isolate the `spike_times` (a list of arrays per neuron) and the `metadata` (a DataFrame containing trial conditions).
2.  **Trial Alignment**: For each neuron $n \in [0, 13]$, create a spike matrix relative to `stimulus_onset`. Clip data to a standard window (e.g., -500ms to 1500ms post-stimulus).
3.  **Condition Masking**: Create binary masks for the four conditions:
    *   `Mask_1`: Choice == Left & Difficulty == Easy
    *   `Mask_2`: Choice == Right & Difficulty == Easy
    *   `Mask_3`: Choice == Left & Difficulty == Hard
    *   `Mask_4`: Choice == Right & Difficulty == Hard
4.  **PSTH Computation**: 
    *   Define a sliding window kernel (75ms). 
    *   For each condition mask, slice the spike matrix. 
    *   Compute the average spike count in each 10ms bin across the selected trials. Convert to firing rate ($count / (bin\_size \times num\_trials)$).
5.  **Uncertainty Calculation**: For every time bin, compute the standard deviation of firing rates across trials belonging to that condition, then divide by $\sqrt{N_{trials}}$.
6.  **Plotting**: Use `matplotlib.pyplot.subplots(2, 7)`. Iterate through `n=0` to `13`. For each axis:
    *   `ax.plot()` for the four condition means.
    *   `ax.fill_between()` for the SEM.
    *   Add labels for the four conditions and ensure clear axis limits.

---

### ## Expected Output
*   **Visual**: A high-resolution figure featuring 14 subplots. Each subplot displays four colored lines representing the trial-averaged PSTH for that neuron, with shaded regions representing the SEM.
*   **Data Structure**: A 3D numpy array of shape `(14, 4, time_bins)` containing the final PSTH values for plotting.

---

### ## Troubleshooting
*   **Mismatch in Trial Counts**: If certain conditions (e.g., Hard-Left) have very few trials, the SEM may be artificially inflated. **Resolution**: Implement a check `if n_trials > 5` to ensure statistical reliability.
*   **Negative Time**: Ensure the windowing logic handles the period prior to `stimulus_onset` correctly without inducing boundary artifacts. **Resolution**: Pad spike trains with zeros before convolution.
*   **Temporal Offset**: If curves look "delayed," double-check the bin-centering in the `75ms` sliding window. Use `centered=True` in your convolution or adjust the time axis by `window_size/2`.
*   **Data Missing**: If `population.pkl` structure differs from expectations, inspect the keys using `print(data_dict.keys())` to ensure the neuron indexing aligns with the provided labels.