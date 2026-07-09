# Reproduction Plan for I_want_to_visualize_the_Structural_Connectivity__SC__network

This reproduction plan outlines the process for visualizing the Structural Connectivity (SC) network in the zebrafish brain by adapting the modular logic of the `Neurocarta` framework (designed for mouse) to your zebrafish-specific data.

### Prerequisites
*   **Environment:** Python 3.x (with `numpy`, `matplotlib`, `scipy`).
*   **Data Files:** 
    *   `SC_matrix_undirected_terminals_expanded.npy` (Unilateral SC)
    *   `Figure1_excluded_regions.npy` (IDs of excluded regions)
    *   `centroids.npy` (List of regional centroids with $x, y, z$ coordinates)
    *   `background_top.png`, `background_side.png` (Zebrafish atlas projection images)

---

### Step-by-Step Procedure

| Step | Action | Paper Ref | Code Ref | Input | Output | Validation |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **1** | **Bilateral Matrix Generation** | Methods: SC Analysis | `loadmap` logic | Unilateral SC | $2N \times 2N$ Bilateral Matrix | Shape is $2N \times 2N$; symmetric across diagonal. |
| **2** | **Region Filtering** | Data Processing | `filtermap` logic | Matrix + `excluded_regions` | Filtered Matrix ($M'$) | Shape is $(2N - 2k) \times (2N - 2k)$. |
| **3** | **Centroid Transformation** | Methods: Visualization | Manual Script | $x, y, z$ coords | Transformed $y$ coords | Verify visually against atlas edges. |
| **4** | **Edge Mapping** | Methods: SC Visualization | `Paper figures` logic | $M'$, Centroids | Visual Overlay | Plot edges on background images. |

#### Step 1: Bilateral Matrix Generation
*   **Action:** Create a symmetric $2N \times 2N$ matrix from the $N \times N$ unilateral matrix.
*   **Implementation:** Let $U$ be the unilateral matrix. The bilateral matrix $B$ is constructed as:
    $B = \begin{bmatrix} U & U \\ U & U \end{bmatrix}$ (assuming symmetric connectivity).
*   **Validation:** Check for block-diagonal symmetry.

#### Step 2: Filter Excluded Regions
*   **Action:** Remove nodes specified in `Figure1_excluded_regions.npy`. Since you are moving to a bilateral space, you must double the exclusion list (e.g., if region $i$ is excluded, exclude index $i$ and index $i+N$).
*   **Code:** Use `numpy` indexing: `matrix = np.delete(matrix, excluded_indices, axis=0); matrix = np.delete(matrix, excluded_indices, axis=1)`.

#### Step 3: Coordinate Alignment
*   **Action:** Adjust $y$-coordinates to match the projection image orientation.
*   **Code:** 
    ```python
    Y_max = np.max(centroids[:, 1])
    centroids[:, 1] = Y_max - centroids[:, 1] 
    ```
*   **Parameter:** `Y_max` must be the image height in pixel units.

#### Step 4: Rendering
*   **Action:** Use `matplotlib` to plot line segments between coordinate pairs $(c_i, c_j)$ where $M'_{ij} > 0$.
*   **Visual Logic:** Map $M'_{ij}$ values to a color gradient (e.g., `viridis` or `plasma`) and line alpha/width.
*   **Reference:** Overlay these segments on the projection image using `plt.imshow()`.

---

### Expected Output
1.  **Connectivity Map:** A visualization featuring the Zebrafish brain outline with structural connections overlaid.
2.  **Color Coding:** Edges displayed as color-coded lines, where the color/intensity represents the normalized weight from the `SC_matrix`.
3.  **Bilateral Symmetry:** Connectivity displayed for both the left and right hemispheres.

---

### Troubleshooting
*   **"Lines are cluttered":** Apply a threshold to the SC matrix before plotting (`matrix[matrix < threshold] = 0`).
*   **"Nodes are outside the brain image":** Check the coordinate system origin. If the atlas coordinates are in millimeters but the image is in pixels, verify the scaling factor (multiply centroids by a scale factor $S$ to match the pixel resolution of the projection image).
*   **"Matrix shape mismatch":** Ensure the number of excluded regions reflects the bilateral expansion (e.g., if you exclude 10 regions, ensure the final matrix is smaller by 20 rows/columns).
*   **Coordinate Flip:** If the brain appears "upside down" compared to the projection, ensure the $Y_{max}$ calculation uses the bounds of the actual image object rather than the metadata of the coordinate file.