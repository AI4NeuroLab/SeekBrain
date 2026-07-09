# Paper-Repo Connection Analysis for I_want_to_visualize_the_Structural_Connectivity__SC__network

This analysis details the methodology for visualizing Structural Connectivity (SC) on the zebrafish brain atlas based on the provided research papers and repository code.

### 1. Paper-to-Code Mapping
*   **SC Data Input:** The paper utilizes `SC_matrix_undirected_terminals_expanded.npy`, which is referenced in `Figure2-Layout.ipynb` (Cell 3) as `SC_undirected`.
*   **Bilateralization:** The paper defines bilateral SC by tiling the unilateral matrix. In `Figure1-Layout.ipynb` (Cell 3) and `Figure2-Layout.ipynb` (Cell 6), this is performed via `FC_bilat = np.tile(FC, (2, 2))` or similar logic applied to the SC matrix.
*   **Atlas Coordinates:** The code uses `atlas.regionCentroids['left']` and `['right']` (via `MapzebrainAtlas`). The adjustment of Y-coordinates to match the brain projection (flipping) is explicitly implemented as `region_centroids[:, 1] = 974 - region_centroids[:, 1]` in `Figure1-Layout.ipynb` (Cell 3).
*   **Visualization:** The core visualization function is `draw_graph`, imported from `visualization.py`.

### 2. Code-to-Paper Mapping
*   **`Figure1-Analysis.ipynb`**: Handles data preprocessing, such as identifying `excluded_regions.npy` (Cells 14-19) based on neuron counts and generating background projection masks (`projection_regions_top.npy`).
*   **`Figure2-Layout.ipynb`**: Contains the specific implementation for the requested visualization. It prepares the data by removing excluded regions (`delete_rows_and_columns(SC, excluded)`), concatenating bilateral centroids, and using `draw_graph` to render the edges on the ZBB background projections.

### 3. Gap Analysis
*   **Redundancy in Removal:** The logic requires that when a region $i$ is removed, $i+N$ (where $N$ is the half-brain offset) must also be removed. The code in `Figure1-Layout.ipynb` (Cell 4) correctly handles this using `np.concatenate([excluded, np.array(excluded) + 70])`. 
*   **Coordinate Transformation:** The Y-coordinate flip ($974 - y$) is hardcoded in the scripts. Ensure the constant `974` matches the specific dimensions of the atlas images provided in the user's local `MapzebrainOld` folder.
*   **Edge Coloring:** The provided code colors edges based on the matrix intensity via `draw_graph`, but the request specifically asks to use the `SC_matrix_undirected_terminals_expanded.npy` for this coloring, which must be passed as the adjacency argument in `draw_graph`.

### 4. Reproduction Strategy
To visualize the SC network, follow these steps using the repository:
1.  **Initialize Atlas:** Load the `MapzebrainAtlas` and set the `atlas_path`.
2.  **Load and Bilateralize:** 
    *   Load `SC_matrix_undirected_terminals_expanded.npy`.
    *   Construct the bilateral matrix using `np.block([[SC, SC_cross], [SC_cross.T, SC]])` (or `np.tile` if symmetric).
3.  **Clean Data:** 
    *   Load `excluded_regions.npy`.
    *   Remove regions from both the bilateral matrix and the concatenated centroid list (Left + Right).
4.  **Transform Coordinates:** Ensure the Y-coordinates are inverted using the mapping: $y_{new} = Y_{max} - y_{old}$.
5.  **Plotting:**
    *   Call `ax.imshow(atlas.XYprojection)` for the background.
    *   Use `draw_graph(ax, bilateral_SC_matrix, cleaned_centroids, ...)` to plot the nodes and edges.
    *   Set `alpha` and `linewidth` parameters in `draw_graph` to ensure the visualization matches the paper's aesthetic.

### 5. Key Insights
*   **Graph Logic:** The code relies on the `draw_graph` function, which maps the matrix index $j$ to `region_centroids[j]`. It is critical that the row/column order of the matrix matches the order in the centroid list after the exclusion process.
*   **Bilateral Expansion:** The expansion logic in the code creates a block-matrix. Ensure that the cross-hemisphere connections (off-diagonal blocks) are correctly populated in your matrix before expansion, as the code assumes the expansion effectively mirrors the unilateral structure.
*   **Visual Validation:** The use of `974` as the Y-coordinate origin suggests this is specific to the `MapzebrainOld` atlas image dimensions. If using a different atlas, verify the `projection` array dimensions before applying the `974 - y` transformation.