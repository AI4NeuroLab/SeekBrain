# Paper-Repo Connection Analysis for _Display_the_trial-averaged_firing_rate_curves__PSTHs__of_14

This analysis connects the research methods described in the paper regarding PMd neural dynamics to the implementation requirements of the provided repository.

---

### 1. Paper-to-Code Mapping
*   **Methodology to Implementation:** The paper’s requirement for "trial-averaged firing rate curves" corresponds to the PSTH generation logic required in the analysis script. 
*   **Data Structure:** The paper defines `population.pkl` as the source of truth for neural activity. The code repository is expected to contain a data-loading module (likely `load_data.py` or similar) that parses this pickle file into a format compatible with numerical analysis (e.g., `pandas` DataFrame or `numpy` arrays).
*   **Parameter Consistency:** The paper specifies a **75ms sliding window** and **10ms step size**. These values must be mapped as explicit arguments in the repository's `compute_psth` or `get_firing_rate` utility functions.

### 2. Code-to-Paper Mapping
*   **Toolbox Capability:** The `mlib-spike-data` repository functions as the technical bridge. While the paper describes *what* to compute (PSTHs), the repository provides the *how* (likely through optimized spike-binning functions within the `mlib` namespace).
*   **Trial Alignment:** The repository code is expected to leverage the `trial_info` metadata mentioned in the paper to perform vector-based indexing, allowing for the rapid filtering of trials based on `choice` and `difficulty`.

### 3. Gap Analysis
*   **Language Mismatch:** The README describes `mlib` as a "Matlab toolbox," but the data format mentioned in the prompt is `.pkl` (Python Pickle). There is a significant infrastructure gap: the code must either include a Python-to-Matlab adapter (e.g., `scipy.io.savemat`) or be refactored into a Python-native analysis suite (e.g., `numpy/scipy/matplotlib`).
*   **Missing Visualization Module:** The repo identifies itself as a spike data toolbox, but it does not explicitly mention plotting utilities. The user must manually implement the $14$-panel subplot grid (`matplotlib.pyplot.subplots(2, 7)`) using the data processed by the library.
*   **Smoothing Implementation:** The paper specifies a 75ms "sliding window." The code must clarify if this is a boxcar, Gaussian, or causal/non-causal kernel, as this significantly changes the shape of the PSTH.

### 4. Reproduction Strategy
1.  **Preprocessing:** Load `population.pkl`. Iterate through `range(14)` to isolate `neuron_0` to `neuron_13`.
2.  **Condition Indexing:** Create a mask:
    *   `mask = (df['choice'].isin(['Left', 'Right'])) & (df['difficulty'].isin(['Easy', 'Hard']))`
3.  **Kernel Application:** Define a boxcar of length $75ms/dt$. Use `np.convolve` to apply the kernel to the binned spike counts per trial.
4.  **Averaging:**
    *   `mean_psth = group.mean(axis=0)`
    *   `sem_psth = group.std(axis=0) / np.sqrt(group.shape[0])`
5.  **Plotting:** Use `matplotlib` to iterate through the 14 neurons, creating a subplot for each. Overlay the 4 conditions using distinct `color` (Choice) and `linestyle` (Difficulty) mappings.

### 5. Key Insights
*   **Heterogeneity:** The primary goal of this plot is to visualize "temporal response heterogeneity." When generating the plots, ensure the y-axis scales are consistent (or auto-scaled per neuron) to highlight the variability in firing rates—some PMd neurons show rapid onset bursts, while others exhibit slow, ramping dynamics prior to movement.
*   **Performance:** Given the 10ms step size, ensure that spike alignment is robust to jitter. The code should explicitly verify that `spike_times` are relative to `stim_onset` to avoid temporal drift.
*   **Statistical Validity:** The choice of SEM is standard for demonstrating population-level consistency in PMd, but if the trial count per condition is low, the code should optionally allow for the calculation of Confidence Intervals (CI) via bootstrapping to verify the reliability of the observed ramping.