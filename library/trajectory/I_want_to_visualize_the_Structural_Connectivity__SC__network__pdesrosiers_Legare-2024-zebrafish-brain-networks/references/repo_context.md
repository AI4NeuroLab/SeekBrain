# Repository Context for I_want_to_visualize_the_Structural_Connectivity__SC__network

Based on your requirements and the structure of typical zebrafish brain connectivity repositories, here is the analysis for visualizing the Structural Connectivity (SC) network.

### 1. Relevant Files (Ranked)
1. **`Figure1-Layout.ipynb` (Priority: HIGH):** This file is almost certainly where the primary structural network visualization is generated. It will contain the plot generation calls, network overlay logic, and the specific calls for the `Figure1_excluded_regions.npy` filtering.
2. **`visualization.py` (Priority: HIGH):** This utility script contains the core functions for plotting centroids, drawing edge lines (often using `matplotlib` or `nilearn`-like projections), and handling coordinate transformations/y-coordinate flipping for ZBB alignment.
3. **`Supp-ComputingSC.ipynb` (Priority: MEDIUM):** This file likely contains the logic for creating the bilateral matrix from the unilateral `SC_matrix_undirected_terminals_expanded.npy`. Look here for the matrix concatenation or block-diagonal expansion code.
4. **`Figure1-Analysis.ipynb` (Priority: MEDIUM):** Contains the data preparation steps, specifically loading the exclusion list and the regional centroids, and performing the initial filtering operations on the connectivity matrix.

### 2. Code Execution Order
1. **Load Data:** Import `SC_matrix_undirected_terminals_expanded.npy` and the regional centroid coordinates from the atlas directory.
2. **Data Pruning:** Load `Figure1_excluded_regions.npy`. Implement logic to identify indices $i$ and $i+N$, remove these rows/columns from the SC matrix, and filter the corresponding centroid coordinate list.
3. **Bilateralization:** Expand the filtered unilateral matrix into a symmetric bilateral matrix (typically $A_{bilateral} = [[A, A_{cross}], [A_{cross}^T, A]]$).
4. **Coordinate Adjustment:** Transform the y-coordinates of the centroid coordinates to match the orientation of the ZBB top and side projection templates.
5. **Visualization:** Call the plotting function in `visualization.py`, passing the bilateral matrix (for edge weights/colors) and the adjusted centroid list.

### 3. Key Code Patterns
*   **Bilateral Expansion:** Look for matrix operations using `np.block` or `np.concatenate`:
    ```python
    # Conceptual pattern for bilateral expansion
    bilateral_sc = np.block([[sc, sc_cross], [sc_cross.T, sc]])
    ```
*   **Exclusion Logic:** Using boolean masking to filter the array:
    ```python
    mask = np.ones(total_regions, dtype=bool)
    mask[excluded_ids] = False
    bilateral_sc = bilateral_sc[mask][:, mask]
    ```
*   **Coordinate Transformation:** A common pattern for adjusting image orientations in zebrafish atlases:
    ```python
    # Likely pattern in visualization.py
    centroids[:, 1] = image_height - centroids[:, 1] # Flipping y-axis
    ```
*   **Overlay Plotting:** Iterating through the adjacency matrix to plot edges:
    ```python
    for i, j in zip(*np.where(matrix > threshold)):
        plt.plot([x[i], x[j]], [y[i], y[j]], color=color_map(matrix[i, j]))
    ```

### 4. Data Files Referenced
*   `SC_matrix_undirected_terminals_expanded.npy`: Input structural connectivity.
*   `Figure1_excluded_regions.npy`: Exclusion list for network cleaning.
*   `atlas/`: Folder containing coordinate files (e.g., `centroids.npy` or `region_lookup.csv`).
*   `projection_top.png` / `projection_side.png`: Background atlas templates for the visualization overlay.

### 5. Missing Pieces
*   **Transformation Parameters:** Ensure the `y-coordinate` adjustment accounts for the specific ZBB resolution (e.g., pixel size) used in the projection images.
*   **Thresholding:** The code will need a specific threshold value or a percentile cutoff to prevent the visualization from becoming cluttered with low-weight structural connections.
*   **Cross-Hemisphere Connectivity:** Verify if `SC_matrix_undirected_terminals_expanded.npy` already contains values for cross-hemisphere connections or if you need to define a default value (or leave as zero) for the off-diagonal blocks during bilateralization.