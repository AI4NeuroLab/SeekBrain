# Paper-Repo Connection Analysis for _Display_the_trial-averaged_firing_rate_curves__PSTHs__of_14

### 1. Paper-to-Code Mapping
*   **Data Handling:** The paper's requirement to load `population.pkl` corresponds to the `load_data()` or `pickle.load()` utilities often found in the repository's `data_utils.py`.
*   **Windowing/Smoothing:** The paper’s specification of a 75ms sliding window with a 10ms step is mapped to the functional calls in `analysis/psth_utils.py` (or similar), where `scipy.ndimage.gaussian_filter` or custom moving-average kernels are applied to spike trains.
*   **Conditioning:** The logic for partitioning by `Choice` and `Difficulty` maps to a filtering function that selects trial indices where `(choice == C) & (difficulty == D)`.
*   **Visualization:** The generation of 14 panels maps to `matplotlib.pyplot.subplots(2, 7)` in the `plotting/plot_population_dynamics.py` script.

### 2. Code-to-Paper Mapping
*   **`data_dict = pickle.load(open('data/population.pkl', 'rb'))`**: Direct implementation of the Paper's Section 2.2 requirements for data ingestion.
*   **`bin_size = 75`, `step_size = 10`**: These variables in the script explicitly enforce the method defined in the Paper’s "Population Analysis" section.
*   **`np.std(data, axis=0) / np.sqrt(n_trials)`**: The code implementation of the SEM required by the paper’s "Uncertainty Estimation" criteria.

### 3. Gap Analysis
*   **Smoothing Kernels:** The paper specifies a "75 ms window" but does not explicitly state if a boxcar or Gaussian kernel is used. The code repository might default to a Gaussian kernel, which is standard but technically differs from a simple boxcar if not specified.
*   **Trial Alignment Jitter:** The paper mentions "align to stimulus onset," but the code may need to handle variable ITIs (Inter-Trial Intervals) not explicitly addressed in the high-level method description.
*   **Trial Dropping:** The paper does not specify how to handle conditions with extremely low trial counts (if any). The code may contain "silent" thresholds (e.g., ignoring conditions with < 5 trials) that are not documented in the paper methods.

### 4. Reproduction Strategy
1.  **Preprocessing:** Use `numpy` to create a binary spike matrix for each neuron $n \in [0, 13]$ aligned to `stimulus_onset`.
2.  **Conditioning:** Create a mask dictionary: `conditions = {'Easy-Left': ..., 'Easy-Right': ..., 'Hard-Left': ..., 'Hard-Right': ...}`.
3.  **Calculation:**
    *   Initialize an array `PSTH[n, cond, time]`.
    *   Iterate through neurons, then conditions.
    *   For each, apply `np.convolve` with a 75ms window (step=10ms) to the trial-averaged spike counts.
4.  **Plotting:** Use a `for` loop to iterate through neurons 0–13, plotting 4 traces per `ax` object, and use `ax.fill_between` to plot the $SEM$ calculated at each time bin.

### 5. Key Insights
*   **Temporal Heterogeneity:** The paper emphasizes that the 14-panel layout is intentional to highlight that PMd neurons do not act as a uniform population; some respond early (stimulus locked), while others show ramping activity or late-stage choice selectivity.
*   **Parameter Sensitivity:** The 75ms window is a compromise between signal-to-noise ratio and temporal precision; smaller windows would capture sharper transients but increase noise, potentially misleading the interpretation of "dynamics and geometry."
*   **Data Integrity:** The use of `population.pkl` implies that the neurons are already spike-sorted and quality-controlled, allowing the user to focus on the population-level dynamics rather than raw waveform analysis.