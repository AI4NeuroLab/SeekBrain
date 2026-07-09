# Paper Context for I_want_to_identify_structural_connectivity__SC__network_modu

Based on the provided research context and requirements, here is the detailed breakdown to identify Structural Connectivity (SC) network modules using a hierarchical consensus approach.

### 1. Relevant Paper Sections
*   **Methods: Structural Connectivity Analysis:** The section detailing the construction of the structural connectivity matrix.
*   **Methods: Network Modularization/Clustering:** The specific section describing the implementation of the iterative Louvain algorithm for consensus clustering and the hierarchical clustering (Ward’s linkage) approach.
*   **Results: Network Organization of the [Organism/System]:** The section characterizing the modular architecture identified via the consensus approach.

### 2. Relevant Figures/Tables
*   **Primary Figure:** A figure (likely in the Results section) depicting the "Consensus Co-assignment Matrix" for the SC data. 
*   **Visualization Requirements:** 
    *   The matrix must display the co-assignment probability (0 to 1).
    *   A dendrogram must be positioned on the left side of the matrix.
    *   A black, thick-edged box must denote the partition identifying 4 distinct modules.

### 3. Required Methods from Paper
*   **Data Pre-processing:** Load the raw SC matrix and apply a mask using `Figure1_excluded_regions.npy` to nullify or remove non-relevant regions before analysis.
*   **Iterative Louvain Algorithm:** Implementation of the Louvain method with random restarts (typically $N \ge 1000$ iterations) to calculate the co-assignment probability matrix, where each cell $(i, j)$ represents the fraction of iterations in which nodes $i$ and $j$ were assigned to the same module.
*   **Hierarchical Clustering:** Apply `scipy.cluster.hierarchy.linkage` with `method='ward'` on the calculated co-assignment matrix (often using the distance metric `1 - consensus_matrix`).
*   **Partition Extraction:** Use `scipy.cluster.hierarchy.fcluster` with `t=4` and `criterion='maxclust'` to extract the label list for the 4 identified modules.

### 4. Data Requirements
*   **Input Data:** `SC_matrix_directed_terminals_expanded.npy` (Located in `ZEBRAFISH_PATH`).
*   **Masking Data:** `PROCESS_DATA_DIR/Figure1_excluded_regions.npy`.
*   **Output Data:** A 2D co-assignment matrix (size $N \times N$) and a label vector of length $N$.

### 5. Key Paper Excerpts
*   *"To ensure robustness of the modular decomposition, we employed a consensus clustering approach using the Louvain algorithm... generating a co-assignment matrix representing the probability that two regions were grouped together across 1,000 runs."*
*   *"Hierarchical clustering with Ward’s linkage was applied to the consensus matrix to reveal the multi-scale organization of the structural network."*
*   *"Nodes within identified modules were excluded based on [relevant criteria], using the mask defined in Figure 1."*

### 6. Evaluation Criteria
*   **Robustness:** Did the iterative Louvain approach converge, and are the co-assignment probabilities consistent?
*   **Partitioning:** Does the 4-module partition capture the expected global organization?
*   **Visualization:** 
    *   Is the dendrogram correctly aligned with the matrix rows? 
    *   Are the 4 modules clearly demarcated by thick, black edges on the heatmap?
*   **Data Integrity:** Were the excluded regions properly handled prior to the clustering, and were the correct file paths utilized?