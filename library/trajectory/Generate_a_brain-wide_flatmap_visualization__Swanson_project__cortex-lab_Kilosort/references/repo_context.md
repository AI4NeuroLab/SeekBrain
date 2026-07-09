# Repository Context for Generate_a_brain-wide_flatmap_visualization__Swanson_project

Based on the provided repository information, it is important to clarify that the current repository contains only the **Kilosort** spike-sorting pipeline. **It does not contain the code for the IBL decision-making task analysis, the `iblatlas` package for Swanson flatmap generation, or the specific statistical testing scripts requested.**

To perform the requested analysis, you would need to access the International Brain Laboratory (IBL) public codebase (e.g., `ibl-pipeline` or `brainwide` repositories) rather than the Kilosort repository.

Below is the assessment based on the provided material:

### 1. Relevant Files (RANKED)
*   **None (Priority: N/A):** None of the files in the provided Kilosort repository contain the brain-wide analysis logic, Swanson projection mappings, or statistical testing suites (Mann-Whitney U, FDR correction) required for this question.
*   **`readme.md` (Priority: LOW):** Useful only as a reference for how the neural data was likely generated/preprocessed (spike sorting) before being passed to an analysis pipeline.

### 2. Code Execution Order
Since the requested functionality is missing from this repository, no code execution order can be provided. A functional pipeline would require:
1.  **IBL Data Retrieval:** Fetching pre-sorted spike data (curated from Kilosort output).
2.  **Statistical Analysis:** A custom Python/MATLAB script implementing the Mann-Whitney U test on the 0–100 ms post-stimulus window.
3.  **FDR Correction:** Applying `statsmodels.stats.multitest.multipletests` (Python) with `method='fdr_bh'`.
4.  **Flatmap Generation:** Calling `iblatlas.plots.plot_swanson_vector` (which is external to this repository).

### 3. Key Code Patterns
The Kilosort repository focuses on:
*   **GPU Offloading:** Using CUDA/MEX for high-performance template matching (`mexGPUall.m`).
*   **Data Structure:** The `rez` struct which stores spike times and template assignments.
*   **Manual Curation Bridge:** Exporting to NPY formats (`npy-matlab`) for use in external tools like **Phy**.

### 4. Data Files Referenced
*   **Raw Binary Data (`.dat`):** The input for the spike-sorting process.
*   **`params.py`:** Configuration file connecting raw data to the sorting pipeline.
*   **`rez` Struct:** The primary output of the sorting process, containing spike templates.

### 5. Missing Pieces
To complete your requested task, you are missing the entire **Downstream Analysis Pipeline**, specifically:
*   **`iblatlas` integration:** The Kilosort repository lacks the brain-wide anatomical mapping tools required to produce a Swanson flatmap.
*   **Statistical Suite:** No implementation of Mann-Whitney U tests or FDR correction scripts is present.
*   **IBL Task Metadata:** The Kilosort repository does not contain the task-specific behavioral timestamps (e.g., stimulus onset times) required to define the 0–100 ms analysis window.
*   **Brain Regions Mapping:** The Beryl mapping lookup tables and the logic to enforce the $N \ge 20$ neurons / $N \ge 2$ sessions filter are absent.

**Recommendation:** Search for the **`brainwide`** or **`ibl-pipeline`** repositories on the International Brain Laboratory's GitHub organization. These contain the `iblatlas` dependencies and the specific Jupyter notebooks used for IBL regional sensory-modulation analyses.