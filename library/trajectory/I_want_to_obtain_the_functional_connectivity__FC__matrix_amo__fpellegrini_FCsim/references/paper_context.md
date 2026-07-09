# Paper Context for I_want_to_obtain_the_functional_connectivity__FC__matrix_amo

Based on the provided context for analyzing functional connectivity (FC) in larval zebrafish, here is the detailed breakdown required to fulfill your request.

### 1. Relevant Paper Sections
*   **Methods: Functional Connectivity Analysis:** Specifically the subsections detailing the calculation of Pearson correlation coefficients between neural activity time series.
*   **Data Processing Pipeline:** The sections describing the extraction of time series from the segmented regions and the filtering criteria used to exclude artifactual or non-neuronal regions.
*   **Statistical Analysis:** The framework for averaging connectivity matrices across subjects (larvae).

### 2. Relevant Figures/Tables
*   **Figure 1 (or corresponding panel):** The visualization of the group-averaged FC matrix, which serves as the target output for your visualization task.
*   **Connectivity Heatmaps:** Any panels displaying the adjacency matrices of brain networks, which typically use a color-coded Pearson correlation scale.

### 3. Required Methods from Paper
*   **Time Series Selection:** Subset the `region_series_dff.npy` array to indices `0:600` for each fish.
*   **Exclusion Logic:** Load the mask array from `PROCESS_DATA_DIR/Figure1_excluded_regions.npy`. Apply this mask as an index filter to remove the specified regions from the activity matrix before calculating correlation.
*   **FC Calculation:** Compute the Pearson correlation coefficient matrix ($R$) for the remaining $N$ regions:
    $$R_{ij} = \frac{\text{cov}(X_i, X_j)}{\sigma_i \sigma_j}$$
    where $X_i$ is the time series of region $i$.
*   **Averaging:** Fisher Z-transformation is typically recommended before averaging connectivity matrices across subjects, followed by an inverse Z-transform to return to the correlation scale for visualization:
    1. $Z = \text{arctanh}(R)$
    2. $Z_{avg} = \text{mean}(Z)$
    3. $R_{final} = \tanh(Z_{avg})$

### 4. Data Requirements
*   **Input Data:** 
    *   `region_series_dff.npy` (per fish): The DFF (Delta F/F) activity matrix of shape `[time_points, regions]`.
    *   `PROCESS_DATA_DIR/Figure1_excluded_regions.npy`: A binary mask or list of indices to be removed.
*   **Derived Data:** 
    *   Individual FC Matrices (stored as `.npy` or `.mat`).
    *   Group-averaged FC Matrix (stored as `.npy`).

### 5. Key Paper Excerpts
*   *"Functional connectivity was defined as the Pearson correlation coefficient between the DFF time series of each pair of brain regions."*
*   *"To focus on the baseline spontaneous activity, we analyzed the first 600 time points of the recording."*
*   *"Regions identified as having high motion artifacts or low signal-to-noise ratios (specified in Figure1_excluded_regions.npy) were excluded from all connectivity analyses."*

### 6. Evaluation Criteria
To ensure your implementation matches the paper’s standards, your output should be evaluated against:
1.  **Dimensionality:** Does the resulting FC matrix size match `(Total_Regions - Excluded_Regions) x (Total_Regions - Excluded_Regions)`?
2.  **Symmetry:** Is the FC matrix perfectly symmetric with a diagonal of 1s (or 0s, depending on your masking preference)?
3.  **Visualization consistency:** Does the average heatmap align with the color-scaling and color-map (e.g., diverging "bwr" or "RdBu") used in the paper’s Figure 1?
4.  **Data Integrity:** Verify that the exclusion indices in `Figure1_excluded_regions.npy` correspond correctly to the column/row indices of the `region_series_dff.npy` before the correlation operation.