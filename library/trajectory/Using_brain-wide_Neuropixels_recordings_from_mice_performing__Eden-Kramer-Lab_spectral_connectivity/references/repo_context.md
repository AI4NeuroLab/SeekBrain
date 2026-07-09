# Repository Context for Using_brain-wide_Neuropixels_recordings_from_mice_performing

To conduct this analysis based on the International Brain Laboratory (IBL) Brain-Wide Map (BWM) framework, the following components are required.

### 1. Relevant Files (Ranked)
1. **`brainwidemap/analysis/task_mod/calculate_modulation.py` (HIGH):** Contains the core logic for the Mann-Whitney U test, trial-stratified permutation testing, and the 0–100ms window logic.
2. **`brainwidemap/analysis/swanson_plotting.py` (HIGH):** Implements the interface with `iblatlas` to map Beryl-level statistics to the Swanson flatmap.
3. **`brainwidemap/bwm_loading.py` (HIGH):** Standardized loading scripts for the IBL `bwm_sessions.csv` and the associated spike/trial objects.
4. **`brainwidemap/decoding/settings.py` (MEDIUM):** Provides the definitions for Beryl-level mappings and the `label >= 1` cluster metric threshold.
5. **`brainwidemap/scripts/plot_swanson_modulation.py` (MEDIUM):** A visualization script often used to aggregate the output of the modulation analysis for the final figure.

### 2. Code Execution Order
1. **`bwm_loading.py`**: Iterate through `bwm_sessions.csv` to load `_ibl_trials.table.pqt` and raw spike files.
2. **`clusters.metrics.pqt`**: Filter for units with `label >= 1` and map to Beryl regions using `channels.brainLocationIds_ccf_2017.npy`.
3. **`calculate_modulation.py`**: 
   - Slice spikes in the [0, 0.1s] window relative to `stimOn_times`.
   - Stratify by block and choice; execute 3000 shuffles per block episode.
   - Perform the Mann-Whitney U test for stimulus side (Left vs. Right).
4. **Aggregation logic**: Calculate fraction of sig. cells per region, applying the $\ge 5$ units/session and $\ge 2$ sessions/region criteria.
5. **`swanson_plotting.py`**: Map results to the `iblatlas` anatomy object and generate the portrait-orientation plot with FDR-corrected thresholding.

### 3. Key Code Patterns
*   **Permutation within Blocks:**
    ```python
    # Logic pattern for controlling for drift
    for block_idx in unique_blocks:
        shuffle(stimulus_labels[block_idx]) 
    ```
*   **Mann-Whitney U Aggregation:**
    ```python
    # Combine U-stats across the four block x choice conditions
    u_stat = combined_u_test(trials_group_A, trials_group_B)
    ```
*   **FDR Correction:**
    ```python
    from statsmodels.stats.multitest import multipletests
    _, p_adj, _, _ = multipletests(p_values, alpha=0.01, method='fdr_bh')
    ```

### 4. Data Files Referenced
*   `bwm_sessions.csv`: List of recordings included in the BWM study.
*   `spikes.times.npy` / `spikes.clusters.npy`: Spike events and IDs.
*   `_ibl_trials.table.pqt`: Behavioral metadata including `stimOn_times` and `probabilityLeft`.
*   `channels.brainLocationIds_ccf_2017.npy`: Allen CCF alignment data.
*   `clusters.metrics.pqt`: Quality control data (firing rate, presence ratio, unit label).

### 5. Missing Pieces
*   **Null Distribution Storage:** The analysis requires a local cache or intermediate output file that stores the results of the 3000 shuffles per session to compute the p-values for the population-level FDR correction.
*   **Swanson Alignment:** The script requires the latest `iblatlas` mapping dictionary to ensure the "Beryl" acronyms (which are a coarser grouping of Allen CCF regions) are correctly rendered on the specific Swanson flatmap template provided in the IBL toolbox.