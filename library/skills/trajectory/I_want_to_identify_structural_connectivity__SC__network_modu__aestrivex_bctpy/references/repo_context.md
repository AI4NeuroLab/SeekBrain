# Repository Context for I_want_to_identify_structural_connectivity__SC__network_modu

Based on the requirements for identifying Structural Connectivity (SC) network modules using a hierarchical consensus approach, here is the analysis:

### 1. Relevant Files (RANKED by relevance)

| File | Priority | Role |
| :--- | :--- | :--- |
| `bct/algorithms/clustering.py` | **HIGH** | Contains `consensus_und` and `agreement` methods necessary for generating the co-assignment probability matrix. |
| `bct/algorithms/modularity.py` | **HIGH** | Contains the Louvain implementations (`modularity_louvain_und`) required for the iterative community detection process. |
| `bct/utils/` | **MEDIUM** | Contains the matrix handling utilities to ensure `SC_matrix_directed_terminals_expanded.npy` is correctly loaded/masked. |

### 2. Code Execution Order

1.  **Load & Preprocess**: Load `SC_matrix_directed_terminals_expanded.npy` and apply the mask defined in `PROCESS_DATA_DIR/Figure1_excluded_regions.npy` to nullify the specified regions.
2.  **Iterative Louvain**: Run `bct.algorithms.modularity.modularity_louvain_und` (or directed variant) for $N=1000$ iterations with random restarts to generate a series of partition vectors.
3.  **Generate Co-assignment Matrix**: Use `bct.algorithms.clustering.agreement` on the collection of partition vectors to create the co-assignment probability matrix ($N \times N$).
4.  **Hierarchical Clustering**: Using `scipy.cluster.hierarchy.linkage(..., method='ward')` on the consensus matrix (often transformed via `1 - matrix` to represent distance).
5.  **Extract Partitions**: Use `scipy.cluster.hierarchy.fcluster(..., t=4, criterion='maxclust')` to obtain the labels for the 4 modules.
6.  **Visualization**: Use `seaborn.clustermap` or `matplotlib` to plot the matrix with the dendrogram (left side) and draw rectangular patches (using `matplotlib.patches.Rectangle`) to delineate the 4 modules.

### 3. Key Code Patterns

*   **Iterative Consensus**:
    ```python
    partitions = []
    for _ in range(1000):
        # random seed logic for Louvain
        ci, _ = bct.modularity_louvain_und(sc_matrix)
        partitions.append(ci)
    # Generate agreement
    co_assignment_mat = bct.agreement(np.array(partitions).T)
    ```
*   **Dendrogram and Partitioning**:
    ```python
    import scipy.cluster.hierarchy as sch
    dist = 1 - co_assignment_mat
    linkage = sch.linkage(dist, method='ward')
    # Generate dendrogram on left, matrix in center
    g = sns.clustermap(co_assignment_mat, row_linkage=linkage, col_linkage=linkage)
    ```

### 4. Data Files Referenced

*   **Input**: `SC_matrix_directed_terminals_expanded.npy` (The primary structural adjacency matrix).
*   **Masking**: `PROCESS_DATA_DIR/Figure1_excluded_regions.npy` (Used to zero out indices in the SC matrix before Louvain iteration).

### 5. Missing Pieces

*   **Visualization Logic**: The current `bctpy` repository provides the math but lacks the high-level plotting functions to create the dendrogram-aligned matrix or the "thick-edge boxes." You must rely on `seaborn` or `matplotlib` for the visual output.
*   **Masking Implementation**: While BCT provides matrix tools, it does not have a specific function to apply the `Figure1_excluded_regions.npy` mask; this must be handled manually via standard NumPy indexing:
    ```python
    mask = np.load('PROCESS_DATA_DIR/Figure1_excluded_regions.npy')
    sc_matrix[mask, :] = 0
    sc_matrix[:, mask] = 0
    ```
*   **Execution Wrapper**: You will need to write a wrapper script to loop the Louvain algorithm 1,000 times, as `bctpy` functions typically run single iterations.