# Repository Context for _Plot_the_trial-averaged_firing-rate_curves__PSTHs__for_the_

Based on the requirements for reproducing the trial-averaged PSTH analysis for the 14 PMd neurons, here is the identification of the relevant files and implementation logic within the `mlib-spike-data` repository.

### 1. Relevant Files (Ranked by Relevance)

| File Path | Priority | Role |
| :--- | :--- | :--- |
| `compute_psth.m` | **HIGH** | Core function for spike binning, smoothing (75ms kernel), and trial averaging. |
| `plot_rasters_and_psths.m` | **HIGH** | Visualization script; handles the layout of the 14-panel grid and shading of the SEM. |
| `examples/2024_the_dynamics_and_geometry/data/population.pkl` | **HIGH** | The source data containing spike times and experimental metadata. |
| `utils/load_data.m` | **MEDIUM** | Utility to parse `.pkl` (via Python-MATLAB interop) or structured data arrays. |
| `utils/compute_sem.m` | **LOW** | Helper function for calculating Standard Error of the Mean. |

---

### 2. Code Execution Order
To reproduce the requested figure, the workflow should follow this sequence:

1.  **Data Ingestion:** Use `load_data.m` to extract `spike_times` and `trial_metadata` from `population.pkl`.
2.  **Trial Indexing:** Sort trials into four logical groups: `[Left/Right] x [Easy/Hard]` based on the metadata labels.
3.  **Firing Rate Computation:** Loop through each neuron (1-14) and each condition (1-4). Call `compute_psth.m` using:
    *   Window/Kernel: 75 ms (boxcar or Gaussian).
    *   Sampling Step: 10 ms.
4.  **Statistics:** Calculate Mean and SEM (standard deviation / sqrt(number of trials)) for each group.
5.  **Visualization:** Use a `subplot(4, 4, i)` or `tiledlayout` call to populate the 14 panels, ensuring each panel contains all 4 condition traces.

---

### 3. Key Code Patterns
*   **Smoothing Kernel:** The implementation of the PSTH must involve a convolution operation:
    ```matlab
    % Pseudo-code for 75ms smoothing
    kernel = ones(1, 75/dt) / (75/dt); 
    smoothed_rate = conv(binned_spikes, kernel, 'same');
    ```
*   **Handling Uncertainty:** Use `fill()` or `patch()` in MATLAB to plot the shaded SEM region:
    ```matlab
    fill([time_axis, fliplr(time_axis)], [mean+sem, fliplr(mean-sem)], color, 'FaceAlpha', 0.2);
    ```
*   **Grid Iteration:** Iterate through neurons using a `for` loop to generate subplots, mapping `neuron_id` to index `i`.

---

### 4. Data Files Referenced
*   **`examples/2024_the_dynamics_and_geometry/data/population.pkl`**: This is the primary dataset.
    *   *Requirement:* Ensure the MATLAB environment has a bridge (like `py.pickle` or a converter script) to read the Python-formatted `.pkl` file into a native MATLAB structure/cell array.

---

### 5. Missing Pieces
*   **Python-MATLAB Compatibility:** Since the data is in `.pkl` format (standard Python), the repository might lack a dedicated `import_python_data.m` script, requiring users to manually convert the data to `.mat` or use `pyload` in MATLAB.
*   **Metadata Mapping:** There is no explicit reference to a `metadata_parser.m` file. The user must write a logic bridge to map the trial labels in `population.pkl` to the binary flags required to distinguish `Left/Right` and `Easy/Hard` conditions.
*   **Normalization:** The prompt specifies PSTHs, but does not state if firing rates should be baseline-subtracted or z-scored; ensure the implementation accounts for whether raw firing rates (Hz) are sufficient.