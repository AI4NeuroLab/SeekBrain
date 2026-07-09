# Paper Context for I_want_to_identify_structural_connectivity__SC__network_modu

To identify structural connectivity (SC) network modules using the specified hierarchical consensus algorithm, follow the analysis framework derived from the paper's methodology:

### 1. Relevant Paper Sections
*   **Methods: Structural Connectivity Analysis:** Specifically the subsections detailing network modularity and consensus clustering.
*   **Methods: Data Pre-processing:** Sections defining node-level exclusion criteria (based on `Figure1_excluded_regions.npy`).
*   **Statistical Analysis:** Descriptions of the Louvain optimization parameters and hierarchical clustering approach (Ward’s linkage).

### 2. Relevant Figures/Tables
*   **Relevant Visualization Template:** The figure illustrating the SC consensus matrix (e.g., a heatmap representation of co-assignment probabilities).
*   **Dendrogram Plot:** The associated hierarchical tree structure plotted alongside the matrix.
*   **Partition Highlighting:** The 4-module partition boundaries (thick-edge boxes) superimposed on the heatmap.

### 3. Required Methods from Paper
*   **Iterative Louvain Algorithm:** Implementation of modularity maximization ($Q$) repeated $N$ times (typically $N \geq 100$) to generate the co-assignment matrix.
*   **Co-assignment Calculation:** Definition: $C_{ij} = \frac{1}{N} \sum_{k=1}^{N} [l_i^{(k)} = l_j^{(k)}]$, where $l$ is the label of node $i$ in iteration $k$.
*   **Hierarchical Clustering:** Application of `scipy.cluster.hierarchy.linkage` with `method='ward'` on the distance matrix derived from the co-assignment probabilities.
*   **Partitioning:** Cutting the dendrogram at the $k=4$ level to generate the module label vector.

### 4. Data Requirements
*   **Input SC Matrix:** `SC_matrix_directed_terminals_expanded.npy` (located in `ZEBRAFISH_PATH`).
*   **Mask/Exclusion Data:** `Figure1_excluded_regions.npy` (located in `PROCESS_DATA_DIR`).
*   **Parameters:** Ensure consistent resolution parameter $\gamma=1.0$ (or the value specified in the source methods) for the Louvain optimization.

### 5. Key Paper Excerpts
*   *"To identify robust modular structures in the structural connectome, we applied a consensus clustering approach..."*
*   *"The structural connectivity matrix was thresholded to exclude regions specified in [Figure1_excluded_regions], ensuring consistent node comparison."*
*   *"The final module labels were derived via Ward’s linkage on the 1-co-assignment matrix, with partitions visualized using a threshold of $k=4$ based on the maximum silhouette score/stability analysis."*

### 6. Evaluation Criteria
*   **Data Integrity:** Exclusion of nodes identified in `Figure1_excluded_regions.npy` must occur *prior* to the Louvain iterations to ensure correct dimensionality.
*   **Convergence:** The co-assignment matrix must be computed over enough iterations (e.g., $100+$) to ensure stability of the probability values.
*   **Visual Fidelity:** 
    *   The heatmap must represent probabilities in the range $[0, 1]$.
    *   The dendrogram must be aligned correctly with the matrix axes.
    *   The 4-module partition must be clearly delineated with visual overlays (thick-edge boxes).
*   **Reproducibility:** The Ward linkage result must be deterministic given the same co-assignment matrix input.