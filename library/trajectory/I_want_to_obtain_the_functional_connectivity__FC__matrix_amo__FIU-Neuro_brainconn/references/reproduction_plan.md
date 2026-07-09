# Reproduction Plan for I_want_to_obtain_the_functional_connectivity__FC__matrix_amo

To obtain the Functional Connectivity (FC) matrices and visualize the group-averaged result, follow this standardized reproduction plan.

### Prerequisites
*   **Environment:** Python 3.x with `numpy`, `matplotlib`, `scipy`, and the `brainconn` library installed.
*   **Data Structure:**
    *   `region_series_dff.npy`: A 2D array of shape `(N_regions, Timepoints)` for each fish.
    *   `PROCESS_DATA_DIR/Figure1_excluded_regions.npy`: A 1D array containing indices of regions to be excluded.
*   **Coordinates:** An atlas coordinate file (e.g., `atlas_coords.npy`) if using `brainconn` visualization tools.

---

### Step-by-Step Procedure

| Step | Action | Paper/Code Reference | Input | Output | Validation |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **1** | **Load & Slice** | Methods: Spontaneous period usage | `region_series_dff.npy` | `data_slice` (N x 600) | `data.shape[1] >= 600` |
| **2** | **Compute FC** | Pearson correlation definition | `data_slice` | `raw_fc_matrix` | Symmetric, diagonal = 1.0 |
| **3** | **Mask Regions** | Data Processing: Pruning noise | `excluded_regions.npy`, `raw_fc_matrix` | `filtered_fc` | Matrix shape reduced |
| **4** | **Group Average** | Group-level analysis | List of `filtered_fc` | `avg_fc_matrix` | Shape matches filtered size |
| **5** | **Threshold** | `brainconn` matrix utilities | `avg_fc_matrix` | `thresholded_fc` | Sparse matrix structure |
| **6** | **Visualize** | `brainconn.utils.visualization` | `thresholded_fc`, `coor` | Heatmap plot | Proper color mapping |

#### Detailed Execution Steps:
1.  **Preparation:** Iterate through your fish folders. For each, load the time-series array. Use `data_subset = data[:, :600]` to capture the spontaneous period.
2.  **Calculation:** Calculate the FC: `fc = np.corrcoef(data_subset)`.
3.  **Filtering:** Load the exclusion indices: `excluded = np.load('PROCESS_DATA_DIR/Figure1_excluded_regions.npy')`. 
    Create a mask: `keep_indices = np.delete(np.arange(fc.shape[0]), excluded)`.
    Extract the sub-matrix: `filtered_fc = fc[np.ix_(keep_indices, keep_indices)]`.
4.  **Averaging:** Stack all `filtered_fc` matrices into a 3D tensor and compute the mean: `avg_fc = np.mean(stack, axis=0)`.
5.  **Refinement:** Use `brainconn.utils.matrix.threshold_absolute(avg_fc, thr=0.2)` to remove weak noise, ensuring the diagonal is set to zero to avoid self-connection bias in the plot.
6.  **Visualization:** Use `brainconn.utils.visualization.adjacency_plot_und(thresholded_fc, coor)` to generate the final heatmap.

---

### Expected Output
1.  **Individual Matrices:** A folder containing saved `.npy` files for each larva's FC matrix (filtered).
2.  **Group Average:** `group_average_FC.npy` containing the final aggregated matrix.
3.  **Visual:** A heatmap figure showing the connectivity, with a diverging colormap (typically 'RdBu_r') representing the strength of functional coupling between brain regions.

---

### Troubleshooting
*   **Coordinate Mismatch:** If `adjacency_plot_und` fails, verify that your coordinate array `coor` has been subsetted by the same `keep_indices` used in Step 3.
*   **Dimensionality Error:** If the number of regions in `region_series_dff.npy` varies between fish, ensure all matrices are the same size before stacking; if they differ, perform the masking *before* global concatenation or align them to a common template.
*   **Negative Correlations:** The heatmap should be centered at 0. Ensure the colormap is "diverging" (e.g., `cmap='RdBu_r'`) so that negative correlations (anti-correlations) are visually distinct from positive ones.
*   **Performance:** If you have many larvae, use `np.memmap` to handle the large stack of matrices to avoid memory exhaustion.