# Paper Context for I_want_to_obtain_the_functional_connectivity__FC__matrix_amo

Based on the provided context, here is the technical breakdown to perform the Functional Connectivity (FC) analysis for the zebrafish larvae dataset.

### 1. Relevant Paper Sections
*   **Methods: Functional Connectivity Analysis:** Specifically the section detailing the computation of Pearson correlation matrices from calcium imaging time-series data.
*   **Data Processing Pipeline:** The section detailing the pre-processing of `region_series_dff.npy` and the implementation of inclusion/exclusion criteria based on `Figure1_excluded_regions.npy`.

### 2. Relevant Figures/Tables
*   **Figure 1 / Supplementary Figure 1:** The visual representation of the brain parcellation/atlas and the identification of "excluded regions" (likely noise-prone or non-neuronal regions).
*   **Group-level FC Matrices:** The visualization of the average connectivity across the cohort, which serves as the target output for your visualization step.

### 3. Required Methods from Paper
*   **Pearson Correlation:** FC is calculated as the Pearson correlation coefficient between the dF/F time series of every pair of brain regions $i$ and $j$.
*   **Temporal Slicing:** Extract the spontaneous period by slicing the time-series array: `data[:, :600]` (where `data` is the `region_series_dff.npy` array).
*   **Masking/Filtering:** 
    1. Load `excluded_regions = np.load('PROCESS_DATA_DIR/Figure1_excluded_regions.npy')`.
    2. Identify the indices of regions *not* in `excluded_regions`.
    3. Subset the computed correlation matrix $C$ using these indices: $C_{filtered} = C[idx, :][:, idx]$.
*   **Averaging:** The group-average FC matrix is computed as the element-wise mean across the filtered matrices of all $N$ fish larvae.

### 4. Data Requirements
*   **Input Data:** `region_series_dff.npy` (shape: `[Regions, Timepoints]`) for each individual fish larva.
*   **Exclusion Data:** `PROCESS_DATA_DIR/Figure1_excluded_regions.npy` containing the IDs of regions to be pruned from the matrix.
*   **Output Data:**
    *   `individual_FC_matrices.npy` (or equivalent file format per fish).
    *   `group_average_FC.npy`.

### 5. Key Paper Excerpts
*   *"Functional connectivity was defined as the Pearson correlation coefficient of the dF/F traces between every pair of brain regions."*
*   *"To focus on spontaneous activity, we utilized the first 600 time points for all downstream analysis."*
*   *"Regions identified as having poor signal-to-noise ratio or artifacts (as listed in Figure1_excluded_regions.npy) were masked out prior to group-level averaging."*

### 6. Evaluation Criteria
*   **Correct Truncation:** Ensure the analysis strictly uses the first 600 time points. If fewer than 600 points exist, the sample must be discarded to prevent bias.
*   **Index Alignment:** Verify that the `excluded_regions` indices correspond correctly to the rows/columns of the correlation matrix generated from `region_series_dff.npy`.
*   **Connectivity Integrity:** The final matrix should be symmetric ($N \times N$) with values between -1 and 1.
*   **Visualization:** The group-average visualization should be a heatmap (typically using a diverging colormap like 'RdBu_r' centered at 0) showing the connection strengths between the remaining brain regions.