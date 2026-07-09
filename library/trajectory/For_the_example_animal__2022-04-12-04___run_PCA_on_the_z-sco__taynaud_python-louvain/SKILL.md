---
name: "Analyze Neural Manifolds and CePNEM Behavioral Tuning for C. elegans"
description: "Performs PCA on z-scored neural activity, hierarchically clusters neurons by PC loadings, and visualizes functional ensembles alongside CePNEM behavioral tuning scores."
triggers:
  - "run PCA and cluster neurons for animal 2022-04-12-04"
  - "visualize CePNEM behavioral tuning and PC loadings for neural data"
  - "how to link neural dynamics to motor states using CePNEM outputs"
  - "generate neural heatmap sorted by hierarchical clustering of PC loadings"
  - "analyze neural manifold dynamics and behavioral tuning for C. elegans imaging"
tags:
  - "PCA"
  - "CePNEM"
  - "hierarchical-clustering"
  - "calcium-imaging"
  - "neural-manifolds"
  - "behavioral-analysis"
version: "1.0"
---

# Skill: Neural Manifold and Behavioral Tuning Analysis for C. elegans Imaging

## Overview
This skill implements a diagnostic pipeline to map neural activity onto latent behavioral states for a specific *C. elegans* imaging session (`2022-04-12-04`). It bridges the gap between raw calcium fluorescence and CePNEM (C. elegans Probabilistic Neural Embedding Model) latent states by combining PCA-based dimensionality reduction with Ward's hierarchical clustering.

The analysis is performed outside the provided `community` graph-partitioning repository, as the research objective requires feature-space analysis (PC loadings) rather than graph-topology modularity. This workflow utilizes standard scientific computing libraries (`scipy`, `scikit-learn`) to recreate the functional ensemble visualizations reported in the source research.

## Objective
To generate a clustered heatmap for animal `2022-04-12-04` that aligns neuron-specific behavioral tuning scores (Forward, Dorsal, Feeding) with top-5 PC loading signatures to identify functional neural ensembles.

## Background (from Paper)
### Scientific Context
Neural activity in *C. elegans* is often constrained to a low-dimensional manifold. By extracting the top principal components (PCs) from z-scored fluorescence, researchers can describe the dominant dynamic modes of a neural population.

### Methods Description
1.  **Z-scoring:** Standardize raw calcium traces $x_{i,t}$ for each neuron $i$ across all time points $T$ to ensure unit variance and zero mean.
2.  **PCA:** Extract the $N \times 5$ loading matrix $W$ by performing PCA on the z-scored $N \times T$ neural matrix.
3.  **Hierarchical Clustering:** Apply Ward’s linkage method to the $N \times 5$ matrix to identify sub-ensembles based on dynamic similarity.
4.  **Behavioral Integration:** Map CePNEM behavioral tuning weights (the contribution of each neuron to Forward, Dorsal, and Feeding states) onto the ordered indices derived from the hierarchical clustering.

### Expected Results
A multi-panel heatmap where rows are sorted by cluster identity. The layout should show distinct blocks of neurons sharing similar PC loading patterns (left side) and correlated behavioral tuning profiles (right side).

## Implementation Guidance
### Verified Repository Components
No verified repository implementation was available in the provided context. The provided `community` repository is restricted to modularity-based graph partitioning (Louvain algorithm) and does not contain the required PCA or CePNEM behavioral analysis modules.

### Conceptual Implementation Plan
1.  **Preprocessing:** Use `scipy.io.loadmat` to import neural data; calculate z-scores using `numpy`.
2.  **PCA:** Use `sklearn.decomposition.PCA(n_components=5)`.
3.  **Clustering:** Use `scipy.cluster.hierarchy.linkage` with `method='ward'`.
4.  **Integration:** Combine the PCA loading matrix and the CePNEM `behavioral_tuning_scores` into a single $N \times 8$ array, sorted by the linkage output indices.
5.  **Visualization:** Use `seaborn.clustermap` or `matplotlib.pyplot.imshow`.

### Dependencies
*   `numpy`: Numerical array operations.
*   `scipy`: Hierarchical clustering and `.mat` file I/O.
*   `scikit-learn`: Principal Component Analysis.
*   `matplotlib` / `seaborn`: Visualization.

## Structured Prompt
### Input Specification
1.  `2022-04-12-04_neural_data.mat`: Matrix of shape $N \times T$.
2.  `2022-04-12-04_CePNEM_results.mat`: File containing the matrix `behavioral_tuning_scores` ($N \times 3$).

### Processing Steps
1.  **Load Data:** Extract fluorescence matrix $X$ and CePNEM tuning weights $B$.
2.  **Normalize:** Transform $X$ to $Z$ where $Z_{i,:} = (X_{i,:} - \mu_i) / \sigma_i$.
3.  **Reduce:** Fit PCA on $Z^T$ (if $X$ is $N \times T$) or $Z$ to obtain the $N \times 5$ loading matrix $W$.
4.  **Cluster:** Calculate the linkage matrix $L$ using `scipy.cluster.hierarchy.linkage(W, method='ward')`.
5.  **Sort:** Retrieve the neuron permutation indices from the dendrogram or linkage tree.
6.  **Visualize:** Plot a concatenated heatmap $[W | B]$ using the sorted neuron indices.

### Output Specification
*   A single heatmap figure displaying 8 columns total (5 PC loadings + 3 tuning scores) per neuron.

### Validation Criteria
*   Check that the z-score operation resulted in mean 0 and std 1 per neuron row.
*   Verify the row ordering in the heatmap corresponds strictly to the linkage tree created from the PC loadings.

## File Structure

```
For_the_example_animal__2022-04-12-04___run_PCA_on_the_z-sco__taynaud_python-louvain/
    references/
        matched_files/
            community___init__.py
            community_community_louvain.py
            community_community_status.py
            requirements.txt
            setup.py
            test_community.py
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
*   `generate_ensemble_heatmap.py`: (Suggested) Custom script to load `.mat` data, execute PCA, perform Ward clustering, and plot the sorted heatmap.

## References Documentation
*   `2022-04-12-04_neural_data.mat`: Raw neural imaging traces for the target animal.
*   `2022-04-12-04_CePNEM_results.mat`: Model-derived behavioral weights representing neuron participation in behavioral states.

## Usage Example
```bash
python generate_ensemble_heatmap.py --data 2022-04-12-04_neural_data.mat --cepnem 2022-04-12-04_CePNEM_results.mat
```

## Notes & Caveats
*   **Sign Ambiguity:** PCA loadings are not sign-constrained. If a cluster appears inverted compared to expected results, check if the sign of the loading vector needs adjustment.
*   **Clustering Method:** Ensure `method='ward'` is used; using `single` or `complete` linkage may result in suboptimal clusters that do not reflect the functional ensembles described in the paper.
*   **Repo Irrelevance:** Do not attempt to incorporate the `community` folder, as it is designed for graph modularity, which is mathematically invalid for clustering Euclidean feature vectors.