# Paper-Repo Connection Analysis for I_want_to_identify_structural_connectivity__SC__network_modu

To analyze the connection between the described structural connectivity (SC) methodology and the repository, we map the requirements to the typical architecture found in systems neuroscience codebases (specifically those analyzing zebrafish connectomes).

### 1. Paper-to-Code Mapping
*   **Iterative Louvain:** The methodology maps to a script (e.g., `consensus_clustering.py` or `compute_louvain_consensus.py`) that uses `community.best_partition` or `networkx.algorithms.community.louvain_communities` within a loop.
*   **Hierarchical Clustering:** This maps to `scipy.cluster.hierarchy` calls (`linkage` with `method='ward'`) performed on the consensus matrix output.
*   **Masking:** The loading of `Figure1_excluded_regions.npy` should occur within the data-loading utility script, typically using `numpy.delete` or Boolean masking on the index array of the `SC_matrix_directed_terminals_expanded.npy`.

### 2. Code-to-Paper Mapping
*   **`consensus_clustering.py`:** Implements the $C_{ij}$ matrix logic. It initializes a $N \times N$ matrix of zeros, runs the Louvain algorithm $k$ times, and increments $C_{ij}$ whenever two nodes share a label.
*   **`visualization.py`:** Contains the plotting logic for the heatmap. It uses `seaborn.clustermap`, which natively integrates the `dendrogram` and allows for custom `rect` drawing (the thick-edge boxes) via `matplotlib.patches`.
*   **Data Loaders:** Scripts using `np.load()` for the directed terminals matrix and the exclusion vector.

### 3. Gap Analysis
*   **Partition Stability:** The code may lack an explicit silhouette score calculation, which the paper uses to justify $k=4$. If the code hard-codes $k=4$, it simplifies the reproduction but obscures the paper's optimization logic.
*   **Resolution Parameter:** The Louvain implementation might default to $\gamma=1.0$ in the code, whereas the paper might have tuned $\gamma$ to achieve a specific number of communities. Check for a configuration file (`config.yaml`) that holds these parameters.
*   **Directed vs. Undirected:** The input file name (`...directed_terminals_expanded.npy`) implies a directed graph. The standard Louvain algorithm is defined for undirected graphs; check if the code converts the SC matrix to symmetric (e.g., `(A + A.T) / 2`) before clustering.

### 4. Reproduction Strategy
1.  **Preprocessing:** Create a master node list: `all_nodes = np.arange(total_nodes)`, then remove indices found in `Figure1_excluded_regions.npy`. Slice the SC matrix: `SC_clean = SC[np.ix_(remaining_indices, remaining_indices)]`.
2.  **Consensus loop:** Run $N=1000$ iterations of Louvain. Save the co-assignment matrix as a `.npy` file to avoid re-computing.
3.  **Clustering:** Perform `Z = linkage(distance_matrix, method='ward')`. Generate labels via `fcluster(Z, 4, criterion='maxclust')`.
4.  **Visualization:** Use `seaborn.clustermap` to plot the matrix. Use the `row_linkage` and `col_linkage` arguments to anchor the dendrogram to the hierarchical tree. Add the 4-module boxes using `ax.add_patch(Rectangle(...))`.

### 5. Key Insights
*   **Deterministic vs. Stochastic:** While Louvain is stochastic, the consensus matrix is deterministic. Ensure you set a global `np.random.seed` before running the iterations to guarantee reproducibility of the co-assignment probabilities.
*   **Node Ordering:** The visual alignment of the dendrogram and the heatmap depends on the return order of the `linkage` function. Ensure the heatmap reorders the matrix using the leaf ordering from the `linkage` output (`dendrogram['leaves']`).
*   **Structural Interpretation:** The "thick-edge boxes" represent the blocks of the matrix where nodes were frequently assigned to the same community across iterations; high values here represent the robust core of the zebrafish brain modules.