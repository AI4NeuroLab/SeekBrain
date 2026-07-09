# Paper-Repo Connection Analysis for Using_brain-wide_Neuropixels_recordings_from_mice_performing

### 1. Paper-to-Code Mapping
The provided repository code focuses exclusively on **KiloSort** (spike sorting) and **Phy** (manual curation). 
*   **Spike Sorting:** The `Docs/` files and `eMouse/` scripts describe the signal processing pipeline to convert raw Neuropixels data into `spikes.times` and `spikes.clusters` (the required inputs for your analysis).
*   **Gap in Scope:** There is **zero overlap** between the provided repository code and the analytical requirements for the BWM meta-analysis. The repository contains no Python code for the IBL data-loading pipeline (`one-api`), the `iblatlas` processing, the Mann-Whitney U statistical testing, or the creation of Swanson flatmaps.

### 2. Code-to-Paper Mapping
*   **KiloSort/Phy:** These tools are the foundation for the "spike-sorted data" mentioned in the paper's methods section. They are used to generate the data that serves as the entry point for your research question.
*   **eMouse:** Represents the "unit-testing" phase of the BWM project, ensuring that the spike sorting pipeline (which the BWM project relies on) is accurate before large-scale population analysis begins.

### 3. Gap Analysis
The provided code is "upstream" of your research question. It helps generate the inputs, but does not perform the science:
*   **Statistical Analysis:** The code lacks the implementation of the Mann-Whitney U test stratified by trial blocks and choices.
*   **Data Access:** The repository does not include `ibl-neuropixel` or `one-api` routines necessary to fetch the `bwm_sessions.csv` or the `_ibl_trials.table.pqt` files.
*   **Visualization:** The repository lacks any modules for the `iblatlas` package or the logic to render Swanson flatmaps.
*   **Workflow:** The repository is essentially a standalone signal-processing toolkit; the BWM meta-analysis logic resides in different IBL repositories (e.g., `ibl-neuropixel`, `paper-brain-wide-map`).

### 4. Reproduction Strategy
To answer the research question, you must bypass the provided KiloSort/Phy repository and utilize the IBL’s primary analysis ecosystem:
1.  **Data Retrieval:** Use the `ONE` (Open Neuroscience Environment) Python library to authenticate and download the consensus BWM dataset.
    *   *Example:* `one.load_object(eid, 'trials', 'ibl')`
2.  **Environment:** Install `iblatlas` and `brainbox` (the IBL's feature extraction library).
3.  **Analysis Loop:**
    *   Iterate through `bwm_sessions.csv`.
    *   For each neuron, extract spike times during the 0–100ms window relative to `stimOn_times`.
    *   Perform the stratified Mann-Whitney U test using `scipy.stats.mannwhitneyu`.
    *   Implement the 3000-shuffle permutation test: within each block episode, shuffle the stimulus labels to build a null distribution of the U-statistic.
4.  **Correction & Plotting:** Apply `statsmodels.stats.multitest.multipletests` for FDR correction at $q=0.01$. Use `iblatlas.plots.plot_swanson` to render the fractional modulation map.

### 5. Key Insights
*   **The Repository is Not the Analysis:** The provided files are purely for **spike sorting and curation**. They satisfy the "Data Source" requirement of your query (i.e., how the raw data became spikes), but they are not the "Analysis" codebase.
*   **Complexity:** The research question requires an integrative pipeline that merges behavioral tables (`trials.pqt`) with electrophysiological results. This requires familiarity with the **IBL Data Architecture** rather than the KiloSort algorithm itself.
*   **Critical Path:** Your success depends on `iblatlas` and `brainbox`, which are not present here. You should look for the `ibl-neuropixel` GitHub organization for the specific scripts used to generate the paper figures.