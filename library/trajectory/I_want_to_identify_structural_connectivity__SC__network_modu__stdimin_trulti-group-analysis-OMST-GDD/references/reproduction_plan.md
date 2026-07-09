# Reproduction Plan for I_want_to_identify_structural_connectivity__SC__network_modu

This reproduction plan details the methodology for generating a consensus-based structural connectivity (SC) module map, derived from zebrafish connectome analysis workflows.

---

### Prerequisites
*   **Environment:** Python 3.8+, `numpy`, `scipy`, `pandas`, `matplotlib`, `seaborn`, `networkx`, `python-louvain` (community).
*   **Data Files:** `SC_matrix_directed_terminals_expanded.npy` in `ZEBRAFISH_PATH` and `Figure1_excluded_regions.npy` in `PROCESS_DATA_DIR`.
*   **Dependencies:** Ensure a consistent `numpy` random seed is set for stochastic Louvain stability.

---

### Step-by-Step Procedure

| Step | Action | Paper Reference | Code Reference | Input/Output | Parameters | Validation |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **1. Masking** | Exclude nodes defined in `Figure1_excluded_regions` from the SC matrix. | Methods: Pre-processing | `data_loader.py` | Input: SC matrix, Exclusion list; Output: `SC_clean` | N/A | `SC_clean.shape` matches `(Total - Excluded)` |
| **2. Iterative Louvain** | Run Louvain algorithm $N$ times to generate community labels. | Methods: SC Analysis | `consensus_clustering.py` | Input: `SC_clean`; Output: Label Matrix ($L$) | $N \geq 100$, $\gamma=1.0$ | Check $Q$ (modularity) value distribution |
| **3. Compute Consensus** | Build the co-assignment matrix $C_{ij} = \text{Freq}(i,j \text{ in same community})$. | Methods: Consensus Clustering | `consensus_clustering.py` | Input: $L$; Output: $N \times N$ matrix $C$ | N/A | $C_{ii} = 1.0$; Symmetry |
| **4. Hierarchical Clustering** | Apply Ward’s linkage on $C$ to derive dendrogram and labels. | Methods: Statistical Analysis | `scipy.cluster.hierarchy` | Input: $C$; Output: Linkage matrix $Z$ | `method='ward'` | Dendrogram visual structure |
| **5. Partitioning** | Cut tree at $k=4$ to generate module color map. | Methods: Partitioning | `fcluster` | Input: $Z, k=4$; Output: Labels 1-4 | `criterion='maxclust'` | 4 unique module labels present |
| **6. Visualization** | Plot matrix with dendrogram and overlay boxes. | Methods: Visualization | `seaborn.clustermap` | Input: $C, Z, \text{labels}$; Output: PDF/PNG plot | `rect` (patches) | Alignment of dendrogram and blocks |

---

### Detailed Implementation Logic
1.  **Masking:** 
    ```python
    excluded = np.load(os.path.join(PROCESS_DATA_DIR, 'Figure1_excluded_regions.npy'))
    all_indices = np.arange(total_nodes)
    remaining = np.setdiff1d(all_indices, excluded)
    SC_clean = SC[np.ix_(remaining, remaining)]
    ```
2.  **Consensus Matrix:** Initialize $C = \text{zeros}(n, n)$. For each iteration, run `community.best_partition(G)`. For every pair $(i, j)$ where $label_i == label_j$, increment $C_{ij}$. Finally, normalize $C$ by $N$.
3.  **Visualization:** Use `seaborn.clustermap(C, row_linkage=Z, col_linkage=Z)`. To add the 4-module boxes:
    ```python
    import matplotlib.patches as patches
    # Loop through module boundaries defined by fcluster results
    ax = g.ax_heatmap
    ax.add_patch(patches.Rectangle((x, y), width, height, fill=False, edgecolor='black', lw=3))
    ```

---

### Expected Output
*   **`co_assignment_matrix.npy`**: The probabilistic connectivity matrix.
*   **`SC_Modules_4.pdf`**: A clustered heatmap featuring:
    *   A dendrogram on the left axis showing hierarchical relationships.
    *   Four distinct, dark, high-probability diagonal blocks representing the identified structural modules.
    *   Color-coded module assignments along the axes.

---

### Troubleshooting
*   **Dendrogram Mismatch:** If the dendrogram does not align with the heatmap, ensure that `row_linkage` and `col_linkage` parameters are explicitly passed to `clustermap` using the output of `scipy.cluster.hierarchy.linkage`.
*   **Resolution Parameter:** If the 4 modules appear unbalanced or degenerate, verify that the `resolution` parameter ($\gamma$) in the Louvain call is consistent with the paper (usually $\gamma=1.0$, but can be adjusted to influence module number).
*   **Matrix Symmetry:** Louvain is for undirected graphs. If `SC_matrix_directed_terminals_expanded.npy` is asymmetric, verify if the code uses `SC = (SC + SC.T) / 2` before clustering to comply with standard modularity definition.
*   **Box Alignment:** Ensure the `Rectangle` coordinates align with the indices returned by the `scipy.cluster.hierarchy.dendrogram` leaf ordering, otherwise the boxes will highlight the wrong regions.