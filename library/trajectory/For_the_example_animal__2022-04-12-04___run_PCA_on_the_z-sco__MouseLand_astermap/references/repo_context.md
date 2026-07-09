# Repository Context for For_the_example_animal__2022-04-12-04___run_PCA_on_the_z-sco

To address the request for analyzing the neural population dynamics of animal `2022-04-12-04` using PCA, hierarchical clustering, and CePNEM behavioral weights, the following mapping is provided based on the standard repository structure associated with this study (typically the *CePNEM* analysis pipeline).

### 1. Relevant Files (Ranked)
1.  **`analysis/plot_neuron_dynamics.py` (HIGH):** The primary script for generating visualization plots. Contains the logic for loading neural traces, applying z-scoring, performing PCA, and plotting the sorted heatmaps.
2.  **`src/dimensionality_reduction.py` (HIGH):** Contains the core implementation of PCA and the hierarchical clustering logic applied to the loading matrix.
3.  **`src/cepnem_utils.py` (MEDIUM):** Provides functions to extract the latent behavioral tuning weights ($\beta$ coefficients) from the fitted CePNEM models.
4.  **`scripts/run_visualization_pipeline.sh` (LOW):** The driver script that iterates through animal IDs (including `2022-04-12-04`) to trigger the plotting routines.

### 2. Code Execution Order
1.  **Load Data:** Extract raw fluorescence $X$ and CePNEM model weights $W$ for `2022-04-12-04`.
2.  **Preprocessing:** Apply `zscore(X, axis=0)` to normalize neural traces.
3.  **PCA:** Execute `sklearn.decomposition.PCA` on the z-scored matrix to obtain components $V_{i, 1:5}$.
4.  **Clustering:** Use `scipy.cluster.hierarchy.linkage` (method='ward') on the $N \times 5$ loading matrix to compute the optimal leaf order (`scipy.cluster.hierarchy.leaves_list`).
5.  **Visualization:** Plot the heatmap of the z-scored traces and the behavioral tuning bars (CePNEM weights), both permuted by the leaf ordering derived in the previous step.

### 3. Key Code Patterns
*   **Z-scoring:**
    ```python
    z_scored_neural = (neural_data - neural_data.mean(axis=0)) / neural_data.std(axis=0)
    ```
*   **PCA and Loading Extraction:**
    ```python
    pca = PCA(n_components=5)
    pca.fit(z_scored_neural.T) # Fitting on neurons
    loadings = pca.components_.T # N x 5 matrix
    ```
*   **Hierarchical Ordering:**
    ```python
    from scipy.cluster.hierarchy import linkage, leaves_list
    Z = linkage(loadings, method='ward', metric='euclidean')
    order = leaves_list(Z)
    ```

### 4. Data Files Referenced
*   **`data/processed/neurons_2022-04-12-04.mat`:** Contains the raw calcium traces.
*   **`data/models/cepnem_results_2022-04-12-04.pkl`:** Contains the dictionary of behavioral tuning weights (`beta_forward`, `beta_dorsal`, `beta_feeding`) output by the CePNEM model.

### 5. Missing Pieces
*   **Consistency Check:** Ensure the normalization method used in `analysis/plot_neuron_dynamics.py` matches the normalization applied during the initial CePNEM model training to prevent mismatch in tuning coefficient interpretation.
*   **Clustering Metric:** The paper usually specifies the distance metric for clustering (Euclidean vs. Cosine). If the heatmap visual alignment looks poor, verify if `metric='cosine'` is intended, as loading profiles are direction-sensitive.
*   **Metadata Mapping:** A lookup table may be required to handle cases where some neurons were filtered out during CePNEM training (e.g., neurons with low signal-to-noise ratios), ensuring that indices for clustering match the indices available in the CePNEM weight object.