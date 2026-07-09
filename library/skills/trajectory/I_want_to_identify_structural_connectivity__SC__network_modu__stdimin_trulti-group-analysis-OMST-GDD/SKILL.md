---
name: "Hierarchical Consensus Structural Connectivity Network Modularization"
description: "Performs iterative Louvain modularity maximization to generate a co-assignment probability matrix and applies Ward's linkage for hierarchical structural network partitioning."
triggers:
  - "Identify structural connectivity network modules using hierarchical consensus"
  - "How do I generate a co-assignment probability matrix from SC data?"
  - "Apply Ward's linkage to zebrafish structural connectivity matrices"
  - "Visualize structural connectivity modules with dendrogram and thick-edge partition boxes"
  - "Extract 4-module partition from SC co-assignment matrix using consensus clustering"
tags:
  - "Structural Connectivity"
  - "Consensus Clustering"
  - "Louvain Algorithm"
  - "Hierarchical Clustering"
  - "Zebrafish Connectomics"
version: "1.0"
---

# Skill: Identification of Structural Connectivity (SC) Network Modules via Hierarchical Consensus Clustering

## Overview
This skill provides a systematic approach to identifying robust structural connectivity (SC) modules in zebrafish brain networks. The methodology utilizes a consensus clustering framework to overcome the stochastic nature of the Louvain modularity optimization algorithm. By repeatedly clustering the network and calculating the co-assignment probability—the likelihood that two nodes appear in the same module—a stable consensus matrix is generated.

The process leverages hierarchical clustering with Ward's linkage to organize the consensus matrix and identify optimal partitions. This approach ensures that the resulting module labels reflect stable, recurring connectivity motifs across iterative optimizations, which are then visually represented as aligned dendrograms and high-probability blocks.

## Objective
To identify a stable 4-module partition of the structural connectome using a co-assignment probability matrix derived from the iterative Louvain algorithm, and to visualize these findings through an aligned hierarchical heatmap.

## Background (from Paper)
### Scientific Context
Structural modules in the zebrafish brain represent functional hubs of high connectivity. Identifying these modules requires distinguishing robust clusters from stochastic noise in the raw SC data.

### Methods Description
1. **Preprocessing:** Masking non-relevant nodes using `Figure1_excluded_regions.npy` to ensure consistency in node indices.
2. **Consensus Generation:** Iterative execution of the Louvain algorithm ($N \geq 100$) to generate community labels for each node.
3. **Co-assignment Matrix:** Computing $C_{ij}$ as the frequency with which node $i$ and node $j$ are assigned to the same module across all $N$ iterations.
4. **Hierarchical Clustering:** Applying Ward's linkage (`scipy.cluster.hierarchy`) on the distance matrix ($1 - C$) to define cluster hierarchy.
5. **Partitioning:** Cutting the dendrogram at $k=4$ to assign final module labels.

### Expected Results
A 4-module partition visualized as a heatmap showing high co-assignment probabilities along the diagonal, with thick-edge boxes highlighting cluster boundaries and an aligned dendrogram on the left axis.

## Implementation Guidance
### Verified Repository Components
* `scripts/analysis/compute_consensus_clustering.py`: Implementation of the iterative Louvain loop.
* `scripts/analysis/hierarchical_clustering_sc.py`: Logic for Ward’s linkage and dendrogram cutting.
* `scripts/plotting/plot_sc_consensus_heatmap.py`: Visualization with dendrogram and rectangular overlays.
* `utils/data_loader.py`: Preprocessing and node-masking utilities.

### Conceptual Implementation Plan
1. Load `SC_matrix_directed_terminals_expanded.npy` and `Figure1_excluded_regions.npy`.
2. Filter the SC matrix using `numpy.delete` or Boolean indexing based on the excluded region masks.
3. Execute the consensus loop (e.g., $N=1000$ iterations) and normalize the resulting co-assignment matrix.
4. Perform Ward’s linkage and cluster cutting at $k=4$ using `scipy.cluster.hierarchy`.
5. Pass the resulting linkage object to `seaborn.clustermap` to ensure the dendrogram is generated correctly.
6. Use `matplotlib.patches.Rectangle` to draw boxes around the 4 identified modules based on the sorted index of nodes.

### Dependencies
* Python 3.8+
* `numpy`, `scipy`
* `pandas`
* `matplotlib`, `seaborn`
* `networkx`, `community` (python-louvain)

## Structured Prompt
### Input Specification
1. `SC_matrix_directed_terminals_expanded.npy` (Source SC adjacency matrix)
2. `Figure1_excluded_regions.npy` (Mask for node exclusion)

### Processing Steps
1. **Masking:** Load data and slice the SC matrix to remove indices specified in the exclusion file.
2. **Consensus:** Run the iterative Louvain loop to build the $C_{ij}$ matrix. Set a fixed random seed to ensure reproducibility.
3. **Linkage:** Run `scipy.cluster.hierarchy.linkage(1 - C, method='ward')`.
4. **Partition:** Run `scipy.cluster.hierarchy.fcluster` on the linkage output with `criterion='maxclust'` and `k=4`.
5. **Plotting:** Use `seaborn.clustermap` with `row_linkage` and `col_linkage` set to the linkage object; draw boxes using coordinates derived from the label groupings.

### Output Specification
* `co_assignment_matrix.npy`: The generated co-assignment probability matrix.
* `SC_Modules_4.pdf`: Clustered heatmap with 4-module rectangular boundaries and left-oriented dendrogram.

### Validation Criteria
* The co-assignment matrix values must lie in the range $[0, 1]$.
* The diagonal must be $1.0$.
* The final number of unique labels in the partition vector must be 4.

## File Structure

```
I_want_to_identify_structural_connectivity__SC__network_modu__stdimin_trulti-group-analysis-OMST-GDD/
    references/
        matched_files/
        connection_analysis.md
        paper_context.md
        paper_figure_methods.md
        paper_structured_summary.md
        question.md
        repo_context.md
        repo_file_summaries.md
        repo_overview.md
        reproduction_plan.md
    scripts/
        run_analysis.py
        utils.py
```

## Scripts Documentation
* `compute_consensus_clustering.py`: Manages the $N$ iterations and $C_{ij}$ summation.
* `hierarchical_clustering_sc.py`: Performs the statistical conversion of co-assignment to hierarchy.
* `plot_sc_consensus_heatmap.py`: Handles heatmap aesthetics, including patch drawing and dendrogram orientation.

## References Documentation
* `SC_matrix_directed_terminals_expanded.npy`: Raw structural connectome.
* `Figure1_excluded_regions.npy`: Integer indices of regions to be excluded from modularity analysis.

## Usage Example
```bash
python scripts/analysis/compute_consensus_clustering.py --input SC_matrix_directed_terminals_expanded.npy --mask Figure1_excluded_regions.npy
python scripts/analysis/hierarchical_clustering_sc.py --consensus_matrix consensus_out.npy --k 4
python scripts/plotting/plot_sc_consensus_heatmap.py --matrix consensus_out.npy --labels modules_4.npy
```

## Notes & Caveats
* **Dendrogram Orientation:** If the dendrogram defaults to the top, use `dendrogram(..., orientation='left')` in your plotting script to match the required visual specification.
* **Matrix Symmetry:** If the directed matrix causes errors in `community_louvain`, ensure it is converted to a symmetric weight matrix (e.g., `(A + A.T) / 2`).
* **Box Alignment:** The index order for drawing rectangles must be extracted from the linkage leaves to ensure boxes encapsulate the correct clusters.