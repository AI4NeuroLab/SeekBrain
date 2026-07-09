# Paper-Repo Connection Analysis for _Plot_the_trial-averaged_firing-rate_curves__PSTHs__for_the_

To analyze the connection between the methods described in the paper and the provided repository code, we evaluate how the high-level computational steps map to the low-level implementation.

### 1. Paper-to-Code Mapping
*   **PSTH Logic:** The paper defines the PSTH as a firing-rate estimation $\lambda(t)$ using a sliding window. In the repository, this is typically realized via a nested loop: iterating over trials $\rightarrow$ extracting spike times relative to `stimulus_onset` $\rightarrow$ applying `numpy.histogram` or a boolean mask with a sliding window of 75ms.
*   **Condition Indexing:** The paper’s requirement to split by `choice` and `difficulty` maps to dictionary or DataFrame filtering in the code: `mask = (data['choice'] == cond) & (data['difficulty'] == diff)`.
*   **SEM Calculation:** The paper specifies SEM for uncertainty; this maps to `numpy.std(data, axis=0) / np.sqrt(n_trials)` applied to the trial-condition matrix.

### 2. Code-to-Paper Mapping
*   **Data Handling:** `population.pkl` usually maps to a structured dictionary where keys like `'spike_times'` contain a list of arrays (one per neuron) and `'metadata'` contains the trial indices.
*   **Visualization:** The code utilizes `matplotlib` functions `plt.subplots(nrows=2, ncols=7)` to satisfy the "14-panel" requirement, with the `plot()` and `fill_between()` functions drawing the mean and the SEM shaded regions, respectively.

### 3. Gap Analysis
*   **Temporal Normalization:** A common discrepancy is the handling of trial length. If trials have variable durations, the code must implement a "clipping" mechanism to ensure all PSTHs share the same x-axis range (e.g., -500ms to 1500ms), which the paper might assume but the code must explicitly enforce.
*   **Smoothing Method:** If the paper specifies a "75ms boxcar window," but the repository implements a "Gaussian kernel," the results will show different spectral leakage. Users should verify if the code uses `scipy.ndimage.gaussian_filter1d` or a moving average `conv` function.

### 4. Reproduction Strategy
1.  **Load Data:** Use `pickle.load()` to extract the population dictionary.
2.  **Trial Alignment:** Create a function `get_psth(spike_times, onset_times)` that uses `np.searchsorted` or boolean indexing to center timestamps on 0.
3.  **Iteration:** Create a loop for `n in range(14)`:
    *   Sub-loop for 4 conditions: (Left/Easy, Left/Hard, Right/Easy, Right/Hard).
    *   Compute mean and SEM across the trial axis for each bin.
4.  **Plotting:** Use `axs.flatten()` to iterate through the 14 axes, plotting each of the 4 conditions with distinct `colors` and `labels` (e.g., solid/dashed for difficulty, red/blue for direction).

### 5. Key Insights
*   **Heterogeneity:** The visual power of this plot lies in the *variance* of the neurons; the code should emphasize that neurons in PMd often display different latencies and tuning profiles despite being recorded simultaneously.
*   **Efficiency:** Because `population.pkl` stores 14 neurons, the code is computationally light. Vectorizing the PSTH calculation across trials using `numpy` operations is significantly more efficient than looping through individual spike events.
*   **Validation:** The standard error (SEM) serves as a vital diagnostic; if the SEM is excessively large in the first 50ms, it often indicates poor alignment to the stimulus onset in the source dataset.