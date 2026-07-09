# Repository Context for I_want_to_obtain_the_functional_connectivity__FC__matrix_amo

To perform the functional connectivity (FC) analysis, visualization, and masking according to your specifications, you should use the core matrix processing capabilities found within the `brainconn` library and standard NumPy operations.

### 1. Relevant Files (Ranked by Relevance)
1.  **`brainconn/utils/` (Priority: HIGH):** This directory contains the matrix management tools needed to process and store FC matrices. You will rely on NumPy functions here to compute the Pearson correlation.
2.  **`brainconn/clustering/` or `brainconn/utils/visualization.py` (Priority: MEDIUM):** If visualization is required via the library, these modules contain the utilities for managing network structures, though standard `matplotlib`/`seaborn` plotting is likely expected for the final FC heatmaps.
3.  **`brainconn/__init__.py` (Priority: LOW):** Useful to ensure you are importing the library's internal utilities correctly if using their wrapper functions.

### 2. Code Execution Order
The analysis should follow this procedural pipeline:
1.  **Data Loading:** Load each fish's `region_series_dff.npy` (shape `[Regions, Timepoints]`).
2.  **Temporal Truncation:** Subset the data to `data = data[:, :600]`.
3.  **FC Computation:** Calculate the Pearson correlation matrix for each fish using `np.corrcoef(data)`.
4.  **Masking:** 
    *   Load `excluded_regions = np.load('PROCESS_DATA_DIR/Figure1_excluded_regions.npy')`.
    *   Generate a list of valid indices: `included_indices = [i for i in range(num_regions) if i not in excluded_regions]`.
    *   Apply masking: `FC_filtered = FC[np.ix_(included_indices, included_indices)]`.
5.  **Averaging:** Stack all `FC_filtered` matrices and compute the mean across the stack (axis 0).
6.  **Visualization:** Use `matplotlib.pyplot.imshow` with a diverging colormap (e.g., `RdBu_r`) centered at 0 to visualize the resulting average matrix.

### 3. Key Code Patterns
*   **Pearson Correlation:**
    ```python
    import numpy as np
    # Using np.corrcoef on the transposed dff (Time x Regions)
    # Ensure dff shape is (Time, Regions) for corrcoef to return (Regions, Regions)
    fc_matrix = np.corrcoef(region_series_dff[:, :600].T)
    ```
*   **Masking Pattern:**
    ```python
    excluded = np.load('PROCESS_DATA_DIR/Figure1_excluded_regions.npy')
    all_indices = np.arange(fc_matrix.shape[0])
    valid_indices = np.setdiff1d(all_indices, excluded)
    fc_filtered = fc_matrix[np.ix_(valid_indices, valid_indices)]
    ```

### 4. Data Files Referenced
*   **Input:** `region_series_dff.npy` (Source data for each fish).
*   **Exclusion Mask:** `PROCESS_DATA_DIR/Figure1_excluded_regions.npy` (Indices for pruning).
*   **Output:** `individual_FC_matrices.npy` (Storage of individual correlations) and `group_average_FC.npy` (The final aggregate).

### 5. Missing Pieces
*   **Visualization Utility:** While `brainconn` handles connectivity *analysis*, it lacks a dedicated "heatmapper" for general plotting. You will need to import `matplotlib.pyplot` and `seaborn` to perform the visual representation of the final matrices.
*   **Normalization:** Depending on the specific biological requirements, you may need to apply a Fisher Z-transformation (`np.arctanh`) to the FC matrices before averaging, although the prompt implies a simple arithmetic mean. Check if the paper requires transformation before averaging to normalize the correlation distribution.