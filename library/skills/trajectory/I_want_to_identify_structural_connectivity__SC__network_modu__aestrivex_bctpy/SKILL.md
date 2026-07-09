---
name: "Hierarchical Consensus Structural Connectivity Modularization"
description: "Performs iterative Louvain clustering and hierarchical consensus analysis on structural connectivity matrices to identify and visualize network modules."
triggers:
  - "How do I identify SC network modules using hierarchical consensus?"
  - "Generate a co-assignment probability matrix for structural connectivity"
  - "Perform iterative Louvain modularity on zebrafish SC matrix"
  - "Cluster SC data using Ward's linkage and visualize with dendrogram"
  - "Extract 4 structural network modules from co-assignment probability matrix"
tags:
  - "structural-connectivity"
  - "consensus-clustering"
  - "louvain-algorithm"
  - "network-neuroscience"
  - "zebrafish-connectomics"
version: "1.0"
---

# Skill: Hierarchical Consensus Clustering of Structural Connectivity Networks

## Overview
This skill provides a systematic approach to identifying modular organization within structural connectivity (SC) networks. By leveraging an iterative Louvain community detection algorithm, the approach generates a robust co-assignment probability matrix, which quantifies the likelihood of two regions belonging to the same module across multiple stochastic runs. 

To resolve the hierarchical architecture, this co-assignment matrix is subjected to hierarchical clustering using Ward’s linkage. This multi-scale approach allows for the extraction of a specific partition—typically identifying 4 primary modules—highlighted through visual dendrograms and localized demarcation on the connectivity heatmap, ensuring the structural modules are reproducible and robust.

## Objective
The objective is to compute a 4-module partition of a structural connectivity matrix by combining stochastic community detection with hierarchical clustering and generating a visualized consensus heatmap.

## Background (from Paper)
### Scientific Context
The modular organization of structural brain networks is central to understanding functional segregation and integration. Using a consensus-based approach addresses the stochastic nature of the Louvain algorithm, providing a more stable and reliable identification of community structure compared to single-run partitions.

### Methods Description
1. **Data Pre-processing:** Masking the raw structural matrix to remove irrelevant nodes or known artifact-prone regions defined in `Figure1_excluded_regions.npy`.
2. **Iterative Louvain Optimization:** Performing 1,000 independent runs of the Louvain modularity algorithm to generate a set of partition vectors.
3. **Consensus Matrix Generation:** Calculating an $N \times N$ agreement matrix based on the frequency of co-assignment across iterations.
4. **Hierarchical Clustering:** Applying Ward’s linkage to the distance matrix derived from the consensus matrix to define hierarchical levels.
5. **Partition Extraction:** Using a specific threshold ($t=4$) on the hierarchical dendrogram to segment the network into 4 distinct functional modules.

### Expected Results
The consensus matrix should show clear block-diagonal structures, with dendrograms depicting the hierarchical merging of these regions, and thick-edged boxes delineating the 4-module partition on the diagonal.

## Implementation Guidance
### Verified Repository Components
* `bct/algorithms/modularity.py`: Contains `modularity_louvain_und` (or directed variant) for community detection.
* `bct/algorithms/clustering.py`: Contains `agreement` for computing the consensus matrix.

### Conceptual Implementation Plan
The implementation involves three phases: data sanitization, consensus generation, and hierarchical visualization. Assumptions: The SC matrix is square and symmetric (or directed); the provided paths are accessible as environment variables.

### Dependencies
* `numpy`, `scipy`, `matplotlib`, `seaborn`
* `brain-connectivity-toolbox` (BCTpy)

## Structured Prompt
### Input Specification
1. `SC_matrix_directed_terminals_expanded.npy`: The structural adjacency matrix.
2. `PROCESS_DATA_DIR/Figure1_excluded_regions.npy`: A boolean mask array of regions to ignore.

### Processing Steps
1. **Masking**: Load the SC matrix and set values corresponding to `Figure1_excluded_regions.npy` to 0 (rows and columns).
2. **Consensus**: Initialize an empty array. Iterate 1,000 times: execute `bct.community_louvain`, store the community vector.
3. **Agreement**: Use `bct.agreement()` to convert the $N \times 1000$ partition array into an $N \times N$ co-assignment matrix.
4. **Linkage**: Define the distance matrix as $1 - \text{consensus\_matrix}$. Calculate `Z = scipy.cluster.hierarchy.linkage(..., method='ward')`.
5. **Extraction**: Use `fcluster(Z, t=4, criterion='maxclust')` to obtain module labels.
6. **Visualization**: Generate a `seaborn.clustermap` using `Z` for row/col linkages and draw `matplotlib.patches.Rectangle` borders around the 4 identified blocks.

### Output Specification
1. A heatmap `.png` showing the co-assignment matrix with an attached dendrogram.
2. A label vector (saved as `.npy` or `.csv`) containing module IDs 1–4.

### Validation Criteria
1. The diagonal of the consensus matrix must contain only values of 1.
2. The number of unique values in the label vector must equal 4.
3. The dendrogram must visually correspond to the block-diagonal structure of the heatmap.

## File Structure

```
I_want_to_identify_structural_connectivity__SC__network_modu__aestrivex_bctpy/
    references/
        matched_files/
            bct_algorithms_clustering.py
            bct_algorithms_modularity.py
            bct_utils_miscellaneous_utilities.py
            bct_utils_other.py
            bct_utils_visualization.py
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
* `compute_consensus.py`: Wrapper script that runs the iterative Louvain loops and saves the agreement matrix.
* `visualize_modules.py`: Uses `seaborn` and `matplotlib` to render the heatmap, dendrogram, and partition boxes.

## References Documentation
* `Figure1_excluded_regions.npy`: Contains the mask identifying non-terminal regions or noise indices to be excluded from connectivity analysis.

## Usage Example
```bash
python compute_consensus.py --input $ZEBRAFISH_PATH/SC_matrix_directed_terminals_expanded.npy --mask $PROCESS_DATA_DIR/Figure1_excluded_regions.npy --iters 1000
python visualize_modules.py --consensus consensus_matrix.npy --output module_heatmap.png
```

## Notes & Caveats
* **Computation Time:** 1,000 iterations of Louvain can be time-consuming; parallelize the loop if possible.
* **Stochasticity:** Ensure a consistent random seed is used across runs if strict reproducibility is required.
* **Dendrogram alignment:** The `row_linkage` and `col_linkage` arguments in `clustermap` must receive the exact `Z` object returned by `scipy.cluster.hierarchy.linkage` to ensure the dendrogram matches the module ordering.