# Repository Context for _Display_the_trial-averaged_firing_rate_curves__PSTHs__of_14

To address the requirement of displaying the trial-averaged firing rate curves (PSTHs) for the specified population of PMd neurons, the following analysis outlines the necessary implementation steps within the repository structure.

### 1. Relevant Files (Ranked)
1.  **`examples/2024_the_dynamics_and_geometry/scripts/plot_psth_population.py`** (Priority: **HIGH**): This is the primary script expected for generating visualization panels. It should contain the logic for sub-plotting the 14 neurons and handling the condition-based splitting.
2.  **`examples/2024_the_dynamics_and_geometry/src/analysis.py`** (Priority: **HIGH**): Likely contains the utility functions for smoothing spike trains (sliding window) and calculating the SEM for condition-averaged trials.
3.  **`examples/2024_the_dynamics_and_geometry/src/utils.py`** (Priority: **MEDIUM**): Contains data loading functions for parsing `population.pkl` and filtering based on the requested indices (0–13).

### 2. Code Execution Order
1.  **Data Loading:** Use `src/utils.py` to load `population.pkl`. Extract spike times and the associated `trial_info` metadata.
2.  **Trial Partitioning:** Iterate through the `trial_info` to generate masks for the four conditions: `(Choice: Left/Right) * (Difficulty: Easy/Hard)`.
3.  **Firing Rate Computation:** For each neuron (0–13):
    *   Align spikes to `stimulus_onset`.
    *   Apply the sliding window (75 ms window, 10 ms step) to convert spike trains to firing rates per trial.
4.  **Averaging & Error Calculation:** Calculate the mean and standard error (SEM) across trials for each condition-neuron pair.
5.  **Visualization:** Create a multi-panel figure (e.g., $7 \times 2$ or $4 \times 4$ layout) using `matplotlib.pyplot.subplots`. Plot all four conditions per panel and add a legend.

### 3. Key Code Patterns
*   **Sliding Window Smoothing:**
    ```python
    # Example pattern for 75ms window / 10ms step
    def compute_psth(spike_times, window=0.075, step=0.01):
        # Implementation using np.convolve or binning logic
        ...
    ```
*   **Subplot Iteration:**
    ```python
    fig, axes = plt.subplots(7, 2, figsize=(10, 15))
    for i, ax in enumerate(axes.flatten()):
        # Filter neuron 'i', calculate conditions, and plot
        ...
    ```
*   **Condition Masking:**
    ```python
    # Boolean indexing for trials
    easy_left = (df['difficulty'] == 'easy') & (df['choice'] == 'left')
    ```

### 4. Data Files Referenced
*   `examples/2024_the_dynamics_and_geometry/data/population.pkl`: The primary source file containing the dictionary/DataFrame of PMd neural spike data and trial labels.

### 5. Missing Pieces
*   **Window Function Detail:** The specific implementation of the smoothing window (e.g., Gaussian vs. rectangular boxcar) is implied by "75 ms window" but not explicitly defined in the code patterns. Ensure the boxcar length matches the `window_size / bin_size` ratio if using discrete convolution.
*   **Temporal Bounds:** The start and end times for the PSTH x-axis are not explicitly constrained by the prompt; standard practice is [-0.5s to +1.5s] relative to stimulus onset, which may need to be inferred from the dataset metadata.
*   **Figure Layout:** While the prompt asks for 14 neurons, the code must account for the empty 16th panel if using a standard $4 \times 4$ grid (or use a non-standard grid layout).