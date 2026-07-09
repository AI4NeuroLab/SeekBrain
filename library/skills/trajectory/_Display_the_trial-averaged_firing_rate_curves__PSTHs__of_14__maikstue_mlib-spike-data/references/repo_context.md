# Repository Context for _Display_the_trial-averaged_firing_rate_curves__PSTHs__of_14

Based on the analysis of the `mlib-spike-data` repository architecture and the specific research requirements for the 14-neuron PMd population PSTH analysis, here is the identification of relevant files and implementation strategy.

### 1. Relevant Files (Ranked)

| File Path | Priority | Role |
| :--- | :--- | :--- |
| `src/analysis/compute_psth.m` | **HIGH** | Core function for calculating firing density; will be adapted for condition-based averaging and sliding window parameters. |
| `src/viz/plot_population_dynamics.m` | **HIGH** | Likely contains the plotting framework for tiled subplots and handling multi-condition figure layouts. |
| `examples/2024_the_dynamics_and_geometry/scripts/run_analysis.m` | **MEDIUM** | Main execution script where the 14-neuron selection (`neuron_0` to `neuron_13`) and data filtering will be orchestrated. |
| `src/utils/load_population_data.m` | **MEDIUM** | Helper function to ingest `population.pkl` and parse the `trial_info` structure. |

### 2. Code Execution Order
1.  **Data Ingestion:** Initialize the workspace using `load_population_data.m` to extract `spike_times` and `trial_info` from `population.pkl`.
2.  **Trial Filtering:** In the execution script, iterate through the four condition combinations: `(Choice: Left/Right) x (Difficulty: Easy/Hard)`.
3.  **Firing Rate Computation:** Loop through neurons `0–13`. For each neuron, call `compute_psth.m` using the aligned `stim_onset` timestamps, applying a 75ms window and 10ms step.
4.  **SEM Calculation:** Compute the standard error of the mean across the trial subset for each condition within the sliding window.
5.  **Visualization:** Pass the calculated PSTH arrays and SEMs to a plotting routine (e.g., `plot_population_dynamics.m`) to generate the $2 \times 7$ or $7 \times 2$ grid of panels.

### 3. Key Code Patterns
*   **Windowing:** Implementation of a sliding boxcar or Gaussian window: 
    `rate = conv(spike_counts, ones(window_size, 1)/window_size, 'same')`.
*   **Condition Masking:** Using logical indexing for condition separation: 
    `mask = (trial_info.choice == current_choice) & (trial_info.difficulty == current_difficulty)`.
*   **Tiled Layout:** Using MATLAB's `tiledlayout` or `subplot` to iterate through the 14 neurons:
    ```matlab
    for i = 0:13
        nexttile;
        plot_neuron_conditions(neuron_data{i}); % Helper to plot 4 lines + SEM shading
    end
    ```

### 4. Data Files Referenced
*   **Primary Data:** `examples/2024_the_dynamics_and_geometry/data/population.pkl`
    *   *Note:* As this is a Python-style pickle, ensure the MATLAB environment utilizes a Python-to-MATLAB interface (e.g., `pyrun` or `py.pickle.load`) or ensure the data has been exported to a `.mat` format prior to processing.

### 5. Missing Pieces
*   **Condition Mapping:** The repository does not explicitly define the schema for `trial_info` inside `population.pkl`. A validation script is needed to confirm the exact string/integer values for `Choice` (e.g., 0/1 vs 'Left'/'Right') and `Difficulty`.
*   **Python/MATLAB Interoperability:** Because the source file is `.pkl`, the `load_data.m` script may require a specialized wrapper if it was not specifically designed to read Python objects natively.
*   **Normalization:** The requirements imply a need for raw firing rates, but if the neurons have vastly different baseline firing rates, a common z-scoring or normalization step might be missing from the provided standard library.