# Reproduction Plan for I_want_to_obtain_the_functional_connectivity__FC__matrix_amo

To obtain the functional connectivity (FC) matrix for larval zebrafish neural activity, follow this reproduction plan. As established in the gap analysis, the provided `FCsim` repository is unsuitable for this task; therefore, this plan utilizes standard Python libraries (`numpy`, `scipy`, `matplotlib`) to replicate the methodology described in the research paper.

---

### Prerequisites
*   **Environment:** Python 3.8+
*   **Libraries:** `numpy`, `scipy`, `matplotlib`, `seaborn`
*   **Data:** 
    *   `region_series_dff.npy` for each larva (Shape: `[T, N_regions]`).
    *   `PROCESS_DATA_DIR/Figure1_excluded_regions.npy` (Array of indices).

---

### Step-by-Step Procedure

| Step | Action | Paper Ref | Input | Parameters | Output | Validation |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **1** | **Load & Subset** | Methods: Spontaneous period | `region_series_dff.npy` | `[0:600, :]` | Time series array | Check shape `(600, N)` |
| **2** | **Filter Regions** | Methods: Exclusion criteria | Activity matrix, excluded indices | `axis=1` | Filtered matrix | Shape becomes `(600, N-excluded)` |
| **3** | **Compute R** | Methods: Pearson Correlation | Filtered matrix | `rowvar=False` | $R$ Matrix `(N', N')` | Diagonal = 1.0 |
| **4** | **Fisher-Z Trans** | Stats: Averaging | $R$ Matrices | `np.arctanh()` | Z-score matrix | No `inf` values |
| **5** | **Group Average** | Stats: Group-level FC | List of Z-matrices | `axis=0` | Mean Z-matrix | Shape `(N', N')` |
| **6** | **Inverse Z** | Stats: Return to R | Mean Z-matrix | `np.tanh()` | Average $R$ matrix | Values in range `[-1, 1]` |
| **7** | **Visualize** | Fig 1: FC Heatmap | Average $R$ matrix | `cmap='RdBu_r'` | Heatmap plot | Symmetric pattern |

#### Detailed Implementation Logic:
1.  **Filtering:** Use `np.delete(data, excluded_indices, axis=1)` to ensure the excluded regions are removed before the covariance calculation.
2.  **FC Calculation:** Use `np.corrcoef(filtered_data, rowvar=False)`.
3.  **Fisher Z-Transform:** This is critical because Pearson coefficients are not normally distributed; averaging them directly biases the result. Always transform to Z before averaging.
4.  **Saving:** Use `np.save('individual_FC_fish_i.npy', matrix)` for individual matrices and `np.save('group_avg_FC.npy', avg_matrix)`.

---

### Expected Output
1.  **Individual Files:** A series of `.npy` files representing the $N' \times N'$ FC matrix for each larva.
2.  **Group File:** A single `group_avg_FC.npy` containing the Fisher-averaged correlations.
3.  **Visualization:** A heatmap figure showing high correlation along the diagonal (local/functional modules) and specific off-diagonal structures consistent with the brain atlas used in the study.

---

### Troubleshooting
*   **NaN Values:** If `np.corrcoef` returns `NaN`, ensure the input data contains no constant time series (zero variance). Check that excluded regions were not already zeroed out, as this can cause division by zero.
*   **Mismatched Shapes:** If `Figure1_excluded_regions.npy` indices exceed the number of regions in `region_series_dff.npy`, verify that the data files correspond to the same brain atlas version (e.g., Z-Brain or standard template).
*   **Visualization Issues:** If the heatmap is too dark or washed out, check if the diagonal (1.0) is biasing the color scale. Use `vmin=-0.5, vmax=0.5` in `imshow` to improve contrast for the rest of the matrix.

---

### Validation Criteria
*   **Symmetry Check:** Assert `np.allclose(matrix, matrix.T)` is `True` for every matrix generated.
*   **Data Integrity:** Ensure the final matrix dimensions match `(Total_Regions - len(Excluded_Regions))`.
*   **Visual Logic:** The resulting heatmap should show distinct "blocks" corresponding to known functional modules (e.g., optic tectum vs. hindbrain clusters).