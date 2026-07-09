# Repository Context for I_want_to_obtain_the_functional_connectivity__FC__matrix_amo

Based on the analysis of the provided request and the repository information, there is a **fundamental mismatch** between the scientific objectives of your research question and the content of the `FCsim` repository.

The research question pertains to **larval zebrafish calcium imaging analysis** (DFF signal processing, region-based connectivity), while the **FCsim** repository is a **MATLAB-based EEG signal processing and benchmarking simulation framework**.

---

### 1. Relevant Files (Ranked by Relevance)
| File | Relevance | Priority | Reason |
| :--- | :--- | :--- | :--- |
| `fp_eval_mim_struct_sim.m` | Low | LOW | Contains core connectivity estimation logic, but for *EEG simulated data*, not calcium imaging time series. |
| `fp_eval_lagsim.m` | Low | LOW | Focuses on lag-dependent connectivity for EEG, not applicable to standard Pearson-based FC in zebrafish. |
| `README.md` | Low | LOW | Confirms the repository focuses on EEG sensor benchmarks and does not contain the larval zebrafish pipeline. |

### 2. Code Execution Order
**Not Applicable.** The repository does not contain a pipeline to process `region_series_dff.npy` files, nor does it contain the specific functionality to apply exclusion masks or calculate Pearson correlations in the manner requested for zebrafish. The existing code is structured for:
1. `Generate Simulated EEG` -> 2. `Champagne Source Localization` -> 3. `Estimate Connectivity (MVGC/Linear)` -> 4. `Benchmark against Ground Truth`.

### 3. Key Code Patterns
The repository relies on these patterns, which differ from your needs:
*   **Source Localization Wrappers:** `FCsim` emphasizes transforming sensor-level data to source-level, whereas your request assumes source-level extraction (`region_series_dff.npy`) is already complete.
*   **Benchmarking Loops:** The code is designed to iterate through simulation parameters (SNR, delay, number of sources) rather than iterating through fish larva datasets.

### 4. Data Files Referenced
*   **Repository inputs:** None from your request. It generates its own synthetic data.
*   **Required inputs (from your request):** `region_series_dff.npy` and `PROCESS_DATA_DIR/Figure1_excluded_regions.npy` **do not exist** in the `FCsim` repository.

### 5. Missing Pieces
To achieve your goal, you would need to implement a Python-based pipeline (as the input is `.npy`), which is outside the scope of this MATLAB repository. You are missing:
1.  **Loader Utility:** A script to iterate through the fish data directory and load the specific arrays.
2.  **Exclusion Logic:** A function to apply `Figure1_excluded_regions.npy` to the array columns before `np.corrcoef()`.
3.  **Fisher Z-Transform Implementation:** The repository does not contain the Fisher-Z/inverse-Z transformation logic required for group averaging of connectivity matrices.
4.  **Visualization Script:** A standard plotting utility (e.g., using `matplotlib` or `seaborn`) to generate the heatmaps requested.

**Recommendation:** You should not attempt to use `FCsim` for this task. Instead, write a standalone Python script using `numpy` and `scipy` to perform the correlation and masking as outlined in your **Required Methods from Paper** section.