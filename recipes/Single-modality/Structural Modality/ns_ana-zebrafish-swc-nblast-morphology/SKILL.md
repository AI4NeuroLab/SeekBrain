---
name: ns_ana-zebrafish-swc-nblast-morphology
description: Performs NBLAST-based hierarchical clustering on SWC neuronal data and renders the resulting clusters within a 3D standard brain template using the navis library.
triggers:
- Visualize morphological diversity of 2143 neurons
- Perform NBLAST hierarchical clustering on neuronal data
- How to render SWC neurons in a 3D brain mesh using navis
- Group neuronal skeletons into morphological clusters
- Map neuron clusters to standard brain template space
tags:
- navis
- NBLAST
- neuroinformatics
- morphological-clustering
- 3D-visualization
- SWC-processing
version: '1.0'
---

# Morphological Clustering and 3D Visualization of Neuronal Populations

This recipe provides a framework for analyzing the morphological diversity of neuronal populations using NBLAST similarity scoring and hierarchical clustering. The workflow involves computing structural similarity between neurons represented as SWC skeletons, clustering these similarities into distinct cell types, and rendering these types within a standard anatomical brain template to facilitate visual validation.

It uses the `navis` ecosystem to compare 2,143 neurons, cut the hierarchy into 22 clusters, and render those clusters in a standard 3D brain template.

## When to use this

Use this recipe to cluster large sets of registered SWC neurons by NBLAST morphology and visualize the resulting groups in a 3D template. Do not use it with unregistered skeletons or as a supervised cell-type classifier.

## Scientific context

The morphological diversity of neurons is a key indicator of their functional role. By grouping neurons based on their NBLAST similarity scores—which compare the local geometry and branch connectivity—researchers can define cell types that are consistent with known biological identities, such as oculomotor neurons and retinal ganglion cells (RGCs).

## Preconditions

*   `navis`: For neuronal skeleton manipulation and NBLAST routines.
*   `scipy`: For hierarchical clustering algorithms (`linkage`, `fcluster`).
*   `numpy`/`pandas`: For matrix operations and label management.
*   `matplotlib`: For visualizing the dendrogram.

## Inputs and outputs

1.  **Neuronal Dataset:** A directory containing 2,143 `.swc` files.
2.  **Standard Brain Mesh:** A 3D object file (e.g., `.obj`) representing the standard template brain.
3.  **Registration Data:** Transformation matrices or pre-registered SWC files aligned to the standard brain.

*   **Dendrogram:** A PDF/PNG plot of the hierarchical tree.
*   **Cluster Map:** A CSV file mapping `neuron_id` to `cluster_id`.
*   **Visualization Gallery:** A series of 22 snapshots or interactive scenes of the neurons within the gray brain template.

## Procedure

1.  **Skeletonization:** Neurons are represented as tree-structured skeletons (SWC format).
2.  **NBLAST Computation:** All-by-all similarity scores are computed for the set of 2,143 neurons.
3.  **Hierarchical Clustering:** Similarity matrices are converted into a dendrogram using linkage algorithms, which is then cut to define 22 discrete morphological clusters.
4.  **3D Visualization:** Neuronal morphologies are projected into a standard brain space with the brain template set to high transparency (alpha < 0.5) to enable interior visualization.

The implementation requires a Python environment external to the provided C++ implementation.
1.  **Data Loading:** Ingest 2,143 SWC files as `navis.TreeNeuron` objects.
2.  **Similarity Calculation:** Use `navis.nblast_allbyall()` to generate an N-by-N similarity matrix.
3.  **Clustering:** Use `scipy.cluster.hierarchy` to calculate the linkage and cut the tree at 22 clusters.
4.  **Rendering:** Use `navis.plot3d()` to overlay the clusters onto a registered 3D brain mesh (e.g., in `.obj` format).

1.  **Ingestion:** Load SWC files into a `navis.NeuronList`.
2.  **NBLAST:** Calculate the similarity matrix using `scores = navis.nblast_allbyall(neurons)`.
3.  **Linkage:** Compute the linkage matrix using `Z = scipy.cluster.hierarchy.linkage(scores, method='ward')`.
4.  **Clustering:** Extract clusters using `fcluster(Z, t=22, criterion='maxclust')`.
5.  **Visualization:** Iterate through each cluster index (1–22) and invoke `navis.plot3d(cluster_neurons, template=brain_mesh, alpha=0.3)`.

## Expected results

the study reports 22 distinct morphological clusters, validated by known cell markers. Specifically, Cluster 13 is confirmed as oculomotor neurons and Cluster 14 as RGCs.

*   The dendrogram must clearly show 22 distinct branches.
*   Neurons within known clusters (e.g., Cluster 13) must align anatomically with expected regions in the standard brain.

## Pitfalls

*   **Computational Load:** All-by-all NBLAST on 2,143 neurons is memory-intensive; use a high-memory compute node.
*   **Coordinate Space:** All neurons must be registered to the same template space; attempting to NBLAST unaligned neurons will result in meaningless similarity scores.
*   **C++ implementation Incompatibility:** Do not attempt to use the `*.in` or `*.out` files from the referenced implementation for this morphological task, as they contain physiological PSTH data, not morphological skeletons.

## Bundled files

- `scripts/run_analysis.py`: Run the analysis workflow.
- `scripts/utils.py`: Shared analysis utilities.

## Usage

```bash
python cluster_analysis.py --input_dir ./swc_data --output_dir ./results --num_clusters 22
```
