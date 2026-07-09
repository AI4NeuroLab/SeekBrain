# Reproduction Plan for I_want_to_identify_structural_connectivity__SC__network_modu

This reproduction plan outlines the process of identifying structural connectivity (SC) modules using consensus clustering and hierarchical decomposition, based on the requirements described.

---

### Prerequisites
*   **Environment:** Python 3.8+
*   **Libraries:** `numpy`, `scipy`, `matplotlib`, `seaborn`, `brain-connectivity-toolbox` (BCTpy).
*   **Data Files:** 
    *   `ZEBRAFISH_PATH/SC_matrix_directed_terminals_expanded.npy`
    *   `PROCESS_DATA_DIR/Figure1_excluded_regions.npy`
*   **Hardware:** Iterative Louvain is computationally intensive; a multi-core machine is recommended.

---

### Step-by-Step Procedure

| Step | Action | Paper Reference | Code Reference | Input | Output | Parameters/Validation |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **1** | **Pre-process SC Matrix** | Data Pre-processing | `numpy` indexing | `SC_matrix.npy`, `mask.npy` | Cleaned SC Matrix | Mask index regions = 0. Verify matrix size matches node count. |
| **2** | **Iterative Louvain** | Iterative Modularization | `bct.community_louvain` | Cleaned SC Matrix | $N \times 1000$ partition matrix | 1,000 iterations. Ensure modularity `Q` is returned. |
| **3** | **Co-assignment Matrix** | Consensus Clustering | `bct.agreement` | Partition matrix | $N \times N$ matrix | Matrix elements $\in [0, 1]$. Diagonal should be 1. |
| **4** | **Hierarchical Clustering** | Multi-scale Org. | `scipy.cluster.hierarchy` | Co-assignment matrix | Linkage `Z` | `method='ward'`. Metric = `1 - consensus_matrix`. |
| **5** | **4-Module Partition** | Partitioning | `fcluster` | Linkage `Z` | Label array | `criterion='maxclust'`, `t=4`. Verify labels match dimension $N$. |
| **6** | **Visualization** | Figure 1 | `sns.clustermap`, `patches.Rectangle` | Consensus matrix, `Z` | Heatmap plot | Ensure dendrogram reflects Ward linkage; `Rectangle` borders added. |

---

### Detailed Implementation Steps

#### 1. Data Cleaning
Load the SC matrix and the exclusion array. Use the boolean array to zero out the rows and columns corresponding to excluded regions to ensure they do not influence modularity optimization.

#### 2. Iterative Consensus
*   Loop 1,000 times: Run `bct.community_louvain(SC_matrix, gamma=1.0)`.
*   Stack these results into a matrix `P` of shape `(N_nodes, 1000)`.
*   Compute the agreement matrix `A = bct.agreement(P)`.

#### 3. Hierarchical Decomposition
*   Convert the agreement matrix into a distance matrix: `D = 1 - A`.
*   Perform hierarchical linkage: `Z = scipy.cluster.hierarchy.linkage(D, method='ward')`.
*   Generate the 4-module labels: `labels = scipy.cluster.hierarchy.fcluster(Z, t=4, criterion='maxclust')`.

#### 4. Visualization (Seaborn/Matplotlib)
*   Use `sns.clustermap(A, row_linkage=Z, col_linkage=Z)`.
*   Iterate through the `labels` to determine the start and end coordinates of each of the 4 modules.
*   Use `ax.add_patch(matplotlib.patches.Rectangle(...))` with `linewidth=3` to draw the boxes on the heatmap diagonal.

---

### Expected Output
1.  **Consensus Matrix:** An $N \times N$ heatmap where high values (approaching 1) indicate nodes that frequently appear in the same community across iterations.
2.  **Dendrogram:** A tree structure along the top and left of the heatmap visualizing the hierarchical merging of nodes.
3.  **Partitioned Map:** 4 distinct, thick-edged squares along the main diagonal representing the structural modules.
4.  **Label File:** A CSV or `.npy` file containing the node IDs and their respective module assignment (1–4).

---

### Troubleshooting
*   **Empty Clusters:** If `fcluster` results in fewer than 4 modules, adjust the linkage method or verify that the SC matrix is not overly sparse.
*   **Visualization Overlap:** Ensure the matrix is sorted according to the leaf order of the dendrogram `Z` before adding the `Rectangle` patches.
*   **Convergence Issues:** If modularity scores `Q` vary wildly, check if the input SC matrix is symmetric (if using undirected tools) or requires transformation (e.g., thresholding).
*   **Path Errors:** Use `os.path.join(os.environ['ZEBRAFISH_PATH'], '...')` to ensure the environment variables are correctly resolved.