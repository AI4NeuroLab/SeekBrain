---
name: ns_ana-zebrafish-connectome-pearson-corrcoef_distance_scatter_plot
description: Quantifies how inter-regional connectivity varies with anatomical distance and visualizes the relationship with a correlation scatter plot.
triggers:
- How to reproduce To_investigate_the_relationship_between_inter-regional_conne
- Generate To_investigate_the_relationship_between_inter-regional_conne from zebrafish data
- Analyze data for To_investigate_the_relationship_between_inter-regional_conne
- Reproduce figure To_investigate_the_relationship_between_inter-regional_conne
- Run analysis for To_investigate_the_relationship_between_inter-regional_conne
tags:
- analysis
- zebrafish
- neuroscience
- reproduction
version: '1.0'
---

# Analyzing Distance-Dependency of Inter-regional Connectivity in the Larval Zebrafish Brain

This recipe investigates the biological principle of "wiring-cost optimization" by quantifying the relationship between physical separation and axonal connectivity in the larval zebrafish brain. It combines geometric spatial analysis of brain region centroids with topological analysis of connectomic datasets.

The workflow combines centroids for 72 regions with a connectivity matrix normalized by neurite length and regional volume, then quantifies and plots the distance–connectivity relationship.

## When to use this

Use this recipe to test whether normalized inter-regional connection strength decreases with Euclidean distance in a larval zebrafish connectome. Do not use it to infer causality or community structure from distance alone.

## Scientific context

The brain exhibits a cost-efficiency trade-off where connections between distant regions are metabolically expensive. By mapping the larval zebrafish brain into 72 regions (36 per hemisphere), we can assess whether connectivity strength decays as a function of Euclidean distance, providing evidence for a spatially constrained topological organization.

## Preconditions

* **MATLAB**
* **GenLouvain** (External dependency for community detection)
* **Statistics and Machine Learning Toolbox** (for `corrcoef` and `scatter`)

## Inputs and outputs

1. A 72x3 coordinate matrix representing the centers of mass of the regions.
2. A list of region volumes corresponding to the 72 regions.
3. Raw neurite length data between all region pairs (72x72).

* **Statistical Result:** A Pearson correlation value and $p$-value.
* **Visualization:** A scatter plot of $D$ vs $A$ with a regression line.
* **Clustering Output:** A hierarchical tree or dendrogram showing the groupings derived from the connectivity matrix.

## Procedure

1. **Parcellation:** Define 36 non-overlapping regions covering ~82% of the brain volume, subdivided into 72 regions (left/right split).
2. **Centroid Calculation:** Calculate the 3D center of mass $(x, y, z)$ for each of the 72 regions.
3. **Connectivity Quantification:** Calculate connection strength $S_{ij}$ between regions $i$ and $j$ using the formula: $S_{ij} = \frac{\sum(\text{Neurite Lengths between } i, j)}{\text{Volume}_i + \text{Volume}_j}$.
4. **Statistical Testing:** Perform a Pearson correlation between the $72 \times 72$ distance matrix and the $72 \times 72$ connection strength matrix.

### Code Architecture
the implementation uses a hierarchical consensus clustering approach. After generating the $72 \times 72$ connection strength matrix (the adjacency matrix $A$), the code performs iterative community detection to extract hierarchical organization levels from the noisy connectivity data.

### Key Functions and Modules
* `hierarchicalConsensus.m`: Performs consensus clustering on a population of partitions to identify stable communities.
* `coclassificationMatrix.m`: Calculates the probability that two regions are grouped in the same cluster across multiple iterations.
* `hierarchicalBenchmark.m`: Validates the stability of identified communities against synthetic null models.

1. **Geometric Processing:** Compute the $72 \times 72$ Euclidean distance matrix $D$ from the 3D centroid coordinates.
2. **Normalization:** Execute the normalization formula $S_{ij} = L_{ij} / (V_i + V_j)$ to create the connection matrix $A$.
3. **Correlation Analysis:** Use `corrcoef(D(:), A(:))` to calculate the Pearson $r$ value.
4. **Community Detection:** Run `[Sc, Tree] = hierarchicalConsensus(A)` to map how these spatially constrained regions form hierarchical clusters.

## Expected results

A strong negative Pearson correlation coefficient ($r < 0$) between Euclidean distance and normalized connection strength, indicating that physical proximity is a significant predictor of connection density.

* The correlation $r$ should be negative and statistically significant ($p < 0.05$).
* The clustering output should demonstrate clear, physically distinct modules that largely correspond to regional brain structures.

## Pitfalls

* **Diagonal Elements:** Ensure the diagonal of the connectivity matrix (self-connections) is set to zero or handled carefully, as these represent intra-regional connections that do not depend on distance in the same way.
* **Symmetry:** The `hierarchicalConsensus` algorithm assumes undirected graphs; ensure your $A$ matrix is symmetrized ($A_{ij} = A_{ji}$) before clustering.
* **Resolution:** Ensure the 72-region parcellation is consistent with the standard *Z-Brain* atlas to maintain comparability with existing literature.

## Bundled files

- `scripts/run_analysis.py`: Run the analysis workflow.
- `scripts/utils.py`: Shared analysis utilities.

## Usage

```bash
# Assuming A is your 72x72 normalized connectivity matrix
# Run the consensus clustering in MATLAB
matlab -batch "A = load('connectivity_matrix.mat'); [Sc, Tree] = hierarchicalConsensus(A.matrix); save('output.mat', 'Sc');"
```
