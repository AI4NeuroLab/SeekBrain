# Repository Context for Using_brain-wide_Neuropixels_recordings_from_mice_performing

To address the research question regarding brain-wide stimulus-side modulation using Neuropixels data, you must integrate the **International Brain Laboratory (IBL)** ecosystem tools (`iblatlas`, `one.alyx`), as the provided repository is specifically a **spike-sorting package (Kilosort)** and does not contain the BWM analysis logic.

### 1. Relevant Files (RANKED)
*   **[External/Not in Repo] `iblatlas` (Library):** **PRIORITY: HIGH.** Necessary for the `swanson` flatmap plotting and Beryl-level hierarchy mapping.
*   **[External/Not in Repo] `one-api` (Library):** **PRIORITY: HIGH.** Required to fetch `bwm_sessions.csv`, `spikes.times.npy`, and `_ibl_trials.table.pqt`.
*   **[External/Not in Repo] `analysis_scripts.py` (Custom Implementation):** **PRIORITY: HIGH.** This script is required to perform the Mann-Whitney U tests stratified by `block` and `choice`, and to handle the permutation shuffling (3000 shuffles).
*   **[Repo] `readme.md`:** **PRIORITY: LOW.** Only relevant if you need to re-spike-sort raw data using Kilosort, though BWM project data is typically provided pre-sorted.

### 2. Code Execution Order
1.  **Environment Setup:** Use `ONE` (`one-api`) to authenticate and query the `bwm_sessions.csv`.
2.  **Data Loading:** For each session:
    *   Load `spikes` and `clusters` via `one.load_object`.
    *   Load trial tables `_ibl_trials.table.pqt`.
    *   Load registration data: `channels.brainLocationIds_ccf_2017.npy`.
3.  **Preprocessing:** Map CCF IDs to Beryl acronyms using `iblatlas.regions`. Filter units using `clusters.metrics.pqt` (label >= 1).
4.  **Statistical Analysis:** 
    *   Isolate the 0–100 ms post-stimulus window.
    *   Loop through brain regions: If `n_units >= 5` and `n_sessions >= 2`:
        *   Execute **Mann-Whitney U test** across the four stratified conditions.
        *   Execute **permutation shuffling** (3000 shuffles) per block episode.
        *   Apply **FDR correction** ($q=0.01$).
5.  **Visualization:** Use `iblatlas.swanson` to render the fractional modulation map.

### 3. Key Code Patterns
*   **Permutation Control:**
    ```python
    # Logic pattern for within-episode shuffling
    for episode in block_episodes:
        shuffled_data = np.random.permutation(data_in_episode)
    ```
*   **Beryl Hierarchy Mapping:**
    ```python
    from iblatlas.regions import BrainRegions
    br = BrainRegions()
    beryl_ids = br.id[br.remap(ccf_ids, 'beryl')]
    ```
*   **Statistical Stratification:**
    ```python
    # Mann-Whitney U test across 4 conditions
    # Stratify by: (probabilityLeft == 0.2/0.8) & (choice == left/right)
    ```

### 4. Data Files Referenced
*   **`bwm_sessions.csv`**: Master session list.
*   **`spikes.times.npy` / `spikes.clusters.npy`**: Spike timing and identity.
*   **`_ibl_trials.table.pqt`**: Experimental conditions (stimulus side, choice, block).
*   **`clusters.metrics.pqt`**: Quality control metrics for unit inclusion.
*   **`channels.brainLocationIds_ccf_2017.npy`**: Spatial registration to CCF.

### 5. Missing Pieces
*   **BWM Analysis Pipeline:** The provided repository is **Kilosort (a spike sorter)**. It lacks the actual analysis logic for BWM stimulus-side modulation, the `iblatlas` integration, and the statistical permutation scripts.
*   **Access to IBL Data Infrastructure:** You must have the IBL `one-api` installed and configured to download the BWM datasets; the repository provided contains only the signal processing backend, not the high-level analysis library required for Swanson-style flatmaps.