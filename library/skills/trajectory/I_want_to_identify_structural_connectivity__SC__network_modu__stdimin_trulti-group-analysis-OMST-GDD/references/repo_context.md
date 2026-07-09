# Repository Context for I_want_to_identify_structural_connectivity__SC__network_modu

To identify structural connectivity (SC) network modules as requested, you should focus on the modularity analysis and visualization scripts within the repository. Based on the provided requirements, here is the breakdown:

### 1. Relevant Files
| File Path | Priority | Role |
| :--- | :--- | :--- |
| `scripts/analysis/compute_consensus_clustering.py` | **HIGH** | Implements the iterative Louvain loop and the co-assignment probability calculation. |
| `scripts/analysis/hierarchical_clustering_sc.py` | **HIGH** | Executes `scipy.cluster.hierarchy` (Ward's linkage) on the co-assignment matrix and performs the 4-module cut. |
| `scripts/plotting/plot_sc_consensus_heatmap.py` | **HIGH** | Handles the dendrogram alignment and drawing the thick-edge boxes for the $k=4$ partition. |
| `utils/data_loader.py` | **MEDIUM** | Functions to load `SC_matrix_directed_terminals_expanded.npy` and filter based on `Figure1_excluded_regions.npy`. |

### 2. Code Execution Order
1.  **Data Pre-processing:** Use `utils/data_loader.py` to load the SC matrix and index out the excluded regions: 
    *   `sc_raw = np.load(ZEBRAFISH_PATH + 'SC_matrix_directed_terminals_expanded.npy')`
    *   `mask = np.load(PROCESS_DATA_DIR + 'Figure1_excluded_regions.npy')`
    *   `sc_filtered = np.delete(np.delete(sc_raw, mask, axis=0), mask, axis=1)`
2.  **Consensus Computation:** Execute the iterative Louvain loop (typically $N=1000$ iterations) to generate the `coassignment_matrix`.
3.  **Hierarchical Clustering:** Run Ward’s linkage on the `coassignment_matrix` (using `1 - coassignment_matrix` as the distance metric) to generate the linkage object.
4.  **Visualization:** Plot the heatmap, calculate the dendrogram (from the linkage object), and overlay the 4-module rectangular boxes using the labels derived from `fcluster(linkage, 4, criterion='maxclust')`.

### 3. Key Code Patterns
*   **Iterative Louvain:** 
    ```python
    # Logic for co-assignment probability
    for i in range(1000):
        partition = community_louvain.best_partition(G, resolution=1.0)
        # Update matrix: matrix[u,v] += 1 if partition[u] == partition[v]
    ```
*   **Ward Linkage:** 
    ```python
    from scipy.cluster.hierarchy import linkage, dendrogram, fcluster
    Z = linkage(1 - co_assignment_matrix, method='ward')
    labels = fcluster(Z, 4, criterion='maxclust')
    ```
*   **Visualization:** Utilize `matplotlib.patches.Rectangle` or `seaborn.clustermap` with the `row_linkage` and `col_linkage` parameters set to the output of the Ward linkage to ensure alignment.

### 4. Data Files Referenced
*   `SC_matrix_directed_terminals_expanded.npy`: The source structural connectivity adjacency matrix.
*   `Figure1_excluded_regions.npy`: A boolean array or list of indices used to mask out non-relevant or noisy brain regions before modularity maximization.

### 5. Missing Pieces
*   **Modularity Resolution:** Verify if the repository uses a default resolution parameter ($\gamma=1.0$) for the Louvain implementation; if the code uses `python-louvain` or `CDlib`, confirm the library version consistency.
*   **Dendrogram Orientation:** Ensure the `plot_sc_consensus_heatmap.py` script specifically positions the dendrogram on the left axis. Many standard heatmap libraries (like `seaborn`) plot dendrograms on the top or right by default; you may need to apply a `transform` or use `dendrogram(..., orientation='left')`.
*   **Box Overlay Logic:** The code must manually calculate the indices for the start and end of each module block (sorted by the dendrogram order) to correctly calculate the coordinates for the `Rectangle` patches (thick-edge boxes).