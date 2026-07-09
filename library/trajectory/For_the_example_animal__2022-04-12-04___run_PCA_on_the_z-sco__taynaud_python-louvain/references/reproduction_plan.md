# Reproduction Plan for For_the_example_animal__2022-04-12-04___run_PCA_on_the_z-sco

To reproduce the analysis for animal `2022-04-12-04`, you must move beyond the generic graph-based code repository provided and implement a custom analytical pipeline using `scikit-learn` and `scipy`.

### Prerequisites
*   **Environment:** Python 3.8+ with `numpy`, `pandas`, `scipy`, `scikit-learn`, `matplotlib`, and `seaborn`.
*   **Data:** 
    1.  `2022-04-12-04_neural_data.mat`: Raw fluorescence ($N \times T$).
    2.  `2022-04-12-04_CePNEM_results.mat`: Pre-computed CePNEM parameters (specifically the behavioral tuning weights).

---

### Step-by-Step Procedure

| Step | Action | Method/Tool | Input/Output | Validation |
| :--- | :--- | :--- | :--- | :--- |
| **1. Data Preprocessing** | Z-score neural traces across time ($T$). | $z = \frac{x - \mu}{\sigma}$ | $I: \text{Raw } N \times T$; $O: N \times T \text{ z-scored}$ | Check $\mu=0, \sigma=1$ per row. |
| **2. PCA Execution** | Perform PCA on z-scored $N \times T$ matrix. | `sklearn.decomposition.PCA` | $I: N \times T$; $O: \text{Loadings } (N \times 5)$ | Explain variance ratio (Top 5). |
| **3. Hierarchical Clustering** | Ward's linkage on PC loadings ($N \times 5$). | `scipy.cluster.hierarchy.linkage` | $I: N \times 5$; $O: \text{Linkage Matrix}$ | Ensure distance metric is `euclidean`. |
| **4. Retrieve CePNEM Tuning** | Load latent tuning scores from model output. | `scipy.io.loadmat` | $I: \text{Mat file}$; $O: N \times 3 \text{ (Fwd, Dorsal, Feed)}$ | Map tuning to same neuron index. |
| **5. Visualization** | Plot concatenated heatmap (Loadings + Tuning). | `seaborn.clustermap` or `imshow` | $I: \text{Ordered } N \times 8$ matrix; $O: \text{Heatmap}$ | Verify row-ordering matches Step 3. |

---

### Implementation Details

1.  **PCA:** Use `PCA(n_components=5)` from `sklearn`. The "loadings" matrix is derived from `pca.components_.T`. If the matrix is $N \times T$, standard PCA works on $T \times N$ usually; ensure you transpose correctly to retrieve $N$ neuron features.
2.  **Clustering:** 
    ```python
    from scipy.cluster.hierarchy import linkage, dendrogram
    Z = linkage(loadings_matrix, method='ward', metric='euclidean')
    # Use order derived from Z to re-index neurons
    ```
3.  **Visualization:** Create a combined array of shape `(N, 8)` where columns `0-4` are PC loadings and `5-7` are behavioral tuning scores. Sort this array based on the indices obtained from the linkage clustering.

---

### Expected Output
*   **A Sorted Heatmap:** A visual representation where rows represent neurons. The left side (columns 1-5) shows the PC loadings, and the right side (columns 6-8) shows the CePNEM tuning scores.
*   **Structural Insight:** You should observe "blocks" of neurons. For example, a cluster of neurons that show high loading on PC1 and high tuning for "Forwardness" will appear as a contiguous block due to the Ward clustering.

---

### Troubleshooting
*   **Data Mismatch:** If the number of neurons in the CePNEM results does not match the neural data, verify that the `2022-04-12-04` file contains the exact same neuron IDs (often `id_map` files are needed).
*   **Sign Ambiguity:** PCA loadings are sign-invariant. If a cluster appears inverted compared to the paper, flip the sign of the PC loadings consistently across the entire neuron set.
*   **Clustering Issues:** If the heatmap shows no structure, ensure you are using **Ward's method**. Using other methods (like `single`) often leads to "chaining," which is inappropriate for functional neural ensembles.
*   **Repository irrelevance:** Do not attempt to use the `community` folder. It is designed for modularity maximization on graphs (networks), which is mathematically inappropriate for clustering feature vectors in Euclidean space.