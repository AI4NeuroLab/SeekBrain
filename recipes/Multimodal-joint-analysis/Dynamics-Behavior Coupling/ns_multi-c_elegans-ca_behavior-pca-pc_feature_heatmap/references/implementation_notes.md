# Implementation notes

## Prerequisites

1.  **Software Environment:** Python 3.8+ with `numpy`, `pandas`, `scipy`, `scikit-learn`, `matplotlib`, and `seaborn`.
2.  **Data Files:** 
    *   `2022-04-12-04_neural_data.npy` (Time-series neural matrix $N \times T$).
    *   `2022-04-12-04_CePNEM_fits.pkl` (Contains behavioral tuning weights $W_{beh}$ for forward, dorsal, feeding).
3.  **Dependencies:** Ensure `dPCA.py` is in your working directory (as a reference for tensor handling) and `sklearn.decomposition` is available.

---

## Execution details

| Step | Action | study/Implementation basis | Input | Parameters | Validation |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **1. Load Data** | Load neural matrix $Y$ and CePNEM parameters for animal `2022-04-12-04`. | study Methods (Dataset) | Raw `.npy` file | N/A | Check matrix shape $(N_{neurons}, T_{time})$ |
| **2. Preprocessing** | Z-score the neural activity matrix $Y$ across time ($T$). | Standard Neural Processing | $Y$ | Axis=1 | $\mu=0, \sigma=1$ per neuron |
| **3. PCA** | Perform PCA on Z-scored matrix $Z$ ($N \times T$). | study Methods (Dimensionality) | $Z$ | `n_components=5` | Sum of explained variance ratio |
| **4. Clustering** | Hierarchical clustering on the loading matrix $L$ ($N \times 5$). | study Methods (Clustering) | $L$ (PC loadings) | `method='ward'` | Dendrogram visual structure |
| **5. Behavioral Alignment** | Map neuron indices to CePNEM tuning weights ($W_{beh}$). | study Methods (CePNEM) | $W_{beh}$ | Match by neuron ID | Dimension alignment $(N, 3)$ |
| **6. Visualization** | Plot heatmap: Sorted PC loadings + CePNEM tuning bars. | study Figures | $L$, $W_{beh}$ | Sorting index from Step 4 | Visual coherence of clusters |

---

## Expected artifacts

1.  **Dendrogram:** A visualization showing the grouping of neurons based on PC1–PC5 profile similarity.
2.  **Heatmap:** A multi-panel plot where:
    *   **Panel A (Left):** Heatmap of PC1-PC5 loadings, rows sorted by cluster `order`.
    *   **Panel B (Right):** Bar chart/Heatmap strip of CePNEM tuning weights (Forwardness, Dorsalness, Feedingness) for the corresponding neurons.
    *   **Visual Correlation:** You should see distinct blocks where neurons with similar PC profiles also exhibit similar behavioral tuning.

---

## Troubleshooting

*   **Issue:** PCA results look uniform.
    *   *Fix:* Check if the neural activity was z-scored. Without scaling, PCA is dominated by neurons with the highest absolute firing rate.
*   **Issue:** CePNEM weights do not match the clusters.
    *   *Fix:* Verify that the Neuron IDs are consistent between the PCA matrix and the CePNEM model fit files (use a mapping dictionary if they use different indices).
*   **Issue:** `dPCA` vs `PCA`.
    *   *Fix:* Use standard PCA for this workflow. If clustering does not capture behavioral structure, ensure you are not using `dPCA` output, which isolates task-specific variance rather than the general neural manifold.
