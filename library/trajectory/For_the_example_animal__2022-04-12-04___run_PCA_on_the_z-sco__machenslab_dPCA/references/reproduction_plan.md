# Reproduction Plan for For_the_example_animal__2022-04-12-04___run_PCA_on_the_z-sco

To reproduce the analysis for the example animal `2022-04-12-04`, follow this structured reproduction plan. Note that because the provided repository lacks the specific CePNEM model weights and dataset, this plan assumes you have access to the supplementary data files typically associated with this study.

### Prerequisites
1.  **Software Environment:** Python 3.8+ with `numpy`, `pandas`, `scipy`, `scikit-learn`, `matplotlib`, and `seaborn`.
2.  **Data Files:** 
    *   `2022-04-12-04_neural_data.npy` (Time-series neural matrix $N \times T$).
    *   `2022-04-12-04_CePNEM_fits.pkl` (Contains behavioral tuning weights $W_{beh}$ for forward, dorsal, feeding).
3.  **Dependencies:** Ensure `dPCA.py` is in your working directory (as a reference for tensor handling) and `sklearn.decomposition` is available.

---

### Step-by-Step Procedure

| Step | Action | Paper/Code Reference | Input | Parameters | Validation |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **1. Load Data** | Load neural matrix $Y$ and CePNEM parameters for animal `2022-04-12-04`. | Paper Methods (Dataset) | Raw `.npy` file | N/A | Check matrix shape $(N_{neurons}, T_{time})$ |
| **2. Preprocessing** | Z-score the neural activity matrix $Y$ across time ($T$). | Standard Neural Processing | $Y$ | Axis=1 | $\mu=0, \sigma=1$ per neuron |
| **3. PCA** | Perform PCA on Z-scored matrix $Z$ ($N \times T$). | Paper Methods (Dimensionality) | $Z$ | `n_components=5` | Sum of explained variance ratio |
| **4. Clustering** | Hierarchical clustering on the loading matrix $L$ ($N \times 5$). | Paper Methods (Clustering) | $L$ (PC loadings) | `method='ward'` | Dendrogram visual structure |
| **5. Behavioral Alignment** | Map neuron indices to CePNEM tuning weights ($W_{beh}$). | Paper Methods (CePNEM) | $W_{beh}$ | Match by neuron ID | Dimension alignment $(N, 3)$ |
| **6. Visualization** | Plot heatmap: Sorted PC loadings + CePNEM tuning bars. | Paper Figures | $L$, $W_{beh}$ | Sorting index from Step 4 | Visual coherence of clusters |

---

### Step-by-Step Details

#### Step 2: Preprocessing
*   **Action:** $Z = (Y - Y.mean(axis=1)[:, None]) / Y.std(axis=1)[:, None]$
*   **Note:** Z-scoring is critical to ensure that high-firing neurons do not disproportionately drive the PCs.

#### Step 3: PCA
*   **Action:** 
    ```python
    from sklearn.decomposition import PCA
    pca = PCA(n_components=5)
    L = pca.fit_transform(Z.T).T # Resulting in (5, N) matrix of loadings
    ```
*   **Paper Reference:** Methods section on dimensionality reduction.

#### Step 4: Clustering
*   **Action:** Compute the linkage matrix using Ward’s method on the transpose of $L$ ($N$ neurons $\times 5$ features).
    ```python
    from scipy.cluster.hierarchy import linkage, dendrogram, leaves_list
    Z_clust = linkage(L.T, method='ward')
    order = leaves_list(Z_clust)
    ```

#### Step 5: CePNEM Integration
*   **Action:** Retrieve the weight vector $w_{i, behav}$ from your fit file for each neuron $i \in \{1...N\}$. 
*   **Provenance:** Ensure you are accessing the specific regression weight outputs from the CePNEM model (e.g., `model.params['weights']`), not Pearson correlations.

---

### Expected Output
1.  **Dendrogram:** A visualization showing the grouping of neurons based on PC1–PC5 profile similarity.
2.  **Heatmap:** A multi-panel plot where:
    *   **Panel A (Left):** Heatmap of PC1-PC5 loadings, rows sorted by cluster `order`.
    *   **Panel B (Right):** Bar chart/Heatmap strip of CePNEM tuning weights (Forwardness, Dorsalness, Feedingness) for the corresponding neurons.
    *   **Visual Correlation:** You should see distinct blocks where neurons with similar PC profiles also exhibit similar behavioral tuning.

---

### Troubleshooting
*   **Issue:** PCA results look uniform.
    *   *Fix:* Check if the neural activity was z-scored. Without scaling, PCA is dominated by neurons with the highest absolute firing rate.
*   **Issue:** CePNEM weights do not match the clusters.
    *   *Fix:* Verify that the Neuron IDs are consistent between the PCA matrix and the CePNEM model fit files (use a mapping dictionary if they use different indices).
*   **Issue:** `dPCA` vs `PCA`.
    *   *Fix:* The question asks for standard PCA. If the clustering is not capturing behavioral structure, ensure you are not using the `dPCA` output, which isolates *task-specific* variance rather than the general neural manifold.