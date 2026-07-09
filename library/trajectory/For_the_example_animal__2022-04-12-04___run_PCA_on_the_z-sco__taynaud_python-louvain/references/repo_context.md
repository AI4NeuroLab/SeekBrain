# Repository Context for For_the_example_animal__2022-04-12-04___run_PCA_on_the_z-sco

To perform the requested analysis for animal `2022-04-12-04`, you will need to combine neural processing (PCA), hierarchical clustering, and behavioral integration. 

**Note:** The provided repository is a specialized package for **network community detection (Louvain algorithm)**. While it contains high-quality implementations for clustering/partitioning graphs, the requested analysis (PCA + heatmap visualization) is a standard multivariate analysis workflow that is **not natively implemented** within this specific library. You will need to write a custom script using `numpy`/`scipy` for the PCA and clustering, potentially leveraging `networkx` or the `community` library if you treat the neurons as nodes in a graph.

### 1. Relevant Files (RANKED by relevance)
*   **`community/community_louvain.py` (MEDIUM Priority):** Contains the core logic for hierarchical partitioning. While the paper requests PCA-based hierarchical clustering, if you choose to optimize the clustering using modularity as a surrogate, this file provides the `best_partition` and `generate_dendrogram` methods.
*   **`test_community.py` (LOW Priority):** Provides examples of how to generate synthetic graphs and run clustering partitions, which can serve as a template for how to interface with `networkx` objects.
*   **`setup.py` / `requirements.txt` (LOW Priority):** Essential for ensuring your local environment has `networkx` and `numpy` installed, which are required for the PCA and clustering operations.

### 2. Code Execution Order
Since the repository is an algorithmic library rather than a workflow script, you must implement the following pipeline in a new Python script:

1.  **Data Loading:** Load `2022-04-12-04_neural_data.mat` using `scipy.io.loadmat`.
2.  **Preprocessing:** Z-score the neural matrix $X \in \mathbb{R}^{N \times T}$ where $z_{i,t} = (x_{i,t} - \mu_i) / \sigma_i$.
3.  **Dimensionality Reduction:** Use `sklearn.decomposition.PCA` to compute the top 5 components on the transpose of the matrix to extract loadings ($N \times 5$).
4.  **Clustering:** Use `scipy.cluster.hierarchy.linkage` (Ward method) on the loading matrix to group neurons. 
    *   *Alternative:* Use `community.best_partition` if you wish to use modularity-based grouping on the correlation of PC loadings.
5.  **Behavioral Integration:** Load `2022-04-12-04_CePNEM_results.mat`. Extract `behavioral_tuning_scores`.
6.  **Visualization:** Use `matplotlib` or `seaborn` to create a `clustermap`.
    *   Left Subplot: Heatmap of PC1–PC5 loadings.
    *   Right Subplot: Heatmap of behavioral tuning (Forward/Dorsal/Feeding).
    *   *Constraint:* Ensure row indices are sorted according to the hierarchical clustering output from Step 4.

### 3. Key Code Patterns
*   **Clustering:** To follow the paper's requirement for hierarchical clustering of the loadings:
    ```python
    from scipy.cluster.hierarchy import linkage, dendrogram
    # Z is the N x 5 PC loadings matrix
    Z = linkage(loadings_matrix, method='ward')
    # Use order from dendrogram to sort neurons in heatmaps
    ```
*   **Modularity (if using this repo):** If you treat neurons as nodes with edge weights based on loading similarity:
    ```python
    import community as community_louvain
    import networkx as nx
    # Convert loadings to similarity graph G
    partition = community_louvain.best_partition(G)
    ```

### 4. Data Files Referenced
*   `2022-04-12-04_neural_data.mat`: Contains the raw fluorescence traces.
*   `2022-04-12-04_CePNEM_results.mat`: Contains the pre-calculated behavioral tuning weights ($N \times 3$ matrix) and latent state time series.

### 5. Missing Pieces
*   **Visualization Scripts:** The repository lacks visualization tools for heatmaps or plotting neural manifold trajectories. You will need standard scientific libraries (`matplotlib`, `seaborn`) to produce the Figure 4/5 heatmaps.
*   **CePNEM Loading logic:** The repository does not include code to handle the `.mat` structure of the CePNEM results. You will need to manually map the `behavioral_tuning_scores` variable to the sorted neuron index created by your clustering step.
*   **Linkage to PCA:** There is no code in the provided repository that bridges `PCA` outputs with `community` clustering. You must create the adjacency matrix (e.g., using `scipy.spatial.distance.pdist` or `sklearn.metrics.pairwise_kernels`) before passing it to the community detection functions.