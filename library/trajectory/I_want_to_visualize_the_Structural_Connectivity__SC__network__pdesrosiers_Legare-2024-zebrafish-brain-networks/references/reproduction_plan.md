# Reproduction Plan for I_want_to_visualize_the_Structural_Connectivity__SC__network

This reproduction plan guides you through visualizing the Structural Connectivity (SC) network on the zebrafish brain atlas using the methodologies and code patterns identified in the research.

---

### Prerequisites
*   **Environment:** Python 3.x with `numpy`, `matplotlib`, and `scipy`.
*   **Data Files:** 
    *   `SC_matrix_undirected_terminals_expanded.npy`
    *   `Figure1_excluded_regions.npy`
    *   ZBB Atlas files (specifically `regionCentroids` and projection images).
*   **Repository Access:** Ensure access to the `visualization.py` module containing the `draw_graph` function and the notebook logic from `Figure1-Layout.ipynb` and `Figure2-Layout.ipynb`.

---

### Step-by-Step Procedure

| Step | Action | Paper/Code Reference | Input | Output | Parameters/Validation |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **1** | **Load & Bilateralize** | `Figure2-Layout.ipynb` (Cell 6) | `SC_undirected` | Bilateral SC Matrix | Ensure the resulting matrix shape is $2N \times 2N$. |
| **2** | **Load & Clean IDs** | `Figure1-Layout.ipynb` (Cell 4) | `excluded_regions.npy` | `indices_to_remove` | Check that $i+N$ is added to the list for every $i \in$ excluded. |
| **3** | **Prepare Centroids** | `MapzebrainAtlas` API | Centroid coordinates | Cleaned $(X, Y)$ list | Verify centroid array matches remaining row indices in SC matrix. |
| **4** | **Coordinate Flip** | `Figure1-Layout.ipynb` (Cell 3) | Centroids | Adjusted $Y$ | Use $Y_{new} = 974 - Y_{old}$; validate vs. background image. |
| **5** | **Graph Overlay** | `visualization.py` (`draw_graph`) | Cleaned Matrix, Centroids | `matplotlib` Axes | Set `alpha`, `linewidth` for SC strength. |

---

### Detailed Execution

1.  **Bilateralization:** Load `SC_matrix_undirected_terminals_expanded.npy`. Create the bilateral matrix using:
    `SC_bilateral = np.block([[SC, SC_cross], [SC_cross.T, SC]])`
    *   *Validation:* The diagonal blocks should represent intra-hemispheric connectivity; off-diagonals represent inter-hemispheric (commissural) connections.
2.  **Exclusion Logic:** 
    ```python
    excluded = np.load('Figure1_excluded_regions.npy')
    all_excluded = np.concatenate([excluded, np.array(excluded) + 70]) # 70 = half-brain offset
    # Remove rows/columns
    SC_final = np.delete(SC_bilateral, all_excluded, axis=0)
    SC_final = np.delete(SC_final, all_excluded, axis=1)
    ```
3.  **Coordinate Transformation:**
    Load centroid coordinates for left and right hemispheres. Combine them and apply the coordinate flip:
    `region_centroids[:, 1] = 974 - region_centroids[:, 1]`
    *   *Validation:* Ensure the transformed $Y$ values fall within the bounds of the ZBB projection images (typically $0-974$).
4.  **Visualization:** Use `draw_graph` to render the network. The function typically takes `ax` (the projection), `SC_final`, and the filtered `region_centroids`.
    *   *Parameter Tip:* Ensure the `edge_cmap` is set to a high-contrast colormap (e.g., 'viridis' or 'plasma') to differentiate SC intensities.

---

### Expected Output
*   **Visual Plot:** Two `matplotlib` figures (Top View and Side View) displaying the zebrafish brain projection as a grayscale background with colored network nodes and edges.
*   **Color Mapping:** Edges should represent SC values where high values indicate stronger structural connections, and lines are weighted by connectivity density.

---

### Troubleshooting
*   **Index Mismatch:** If `draw_graph` throws an `IndexError`, ensure the number of regions in your cleaned SC matrix exactly matches the length of your filtered centroid array.
*   **Projection Alignment:** If nodes appear "upside down" or shifted, double-check the constant `974`. If you are using a downsampled atlas version, this constant must be scaled accordingly.
*   **Missing Connectivity:** If the plot appears empty, ensure that the `SC_matrix_undirected_terminals_expanded.npy` has not been thresholded too aggressively during the cleaning step. Check the min/max values of the matrix before plotting.