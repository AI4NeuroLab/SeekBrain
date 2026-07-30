---
name: ns_ana-zebrafish-swc-nblast-morphological_metric
description: Classifies cerebellar efferent neurons from registered SWC morphologies using NBLAST similarity and hierarchical clustering.
triggers:
- How to reproduce For_121_cerebellar_efferent_neurons__91_eurydendroid_cells_a
- Generate For_121_cerebellar_efferent_neurons__91_eurydendroid_cells_a from zebrafish data
- Analyze data for For_121_cerebellar_efferent_neurons__91_eurydendroid_cells_a
- Reproduce figure For_121_cerebellar_efferent_neurons__91_eurydendroid_cells_a
- Run analysis for For_121_cerebellar_efferent_neurons__91_eurydendroid_cells_a
tags:
- analysis
- zebrafish
- neuroscience
- reproduction
version: '1.0'
---

# Morphological Classification and Hierarchical Clustering of Cerebellar Efferent Neurons

This recipe outlines the process of classifying cerebellar efferent neurons (91 eurydendroid cells and 30 Purkinje cells) through computational morphological analysis. The approach utilizes an upstream pipeline for standardizing 3D brain imagery into a common reference space, followed by an analytical suite to perform pairwise morphological similarity scoring and unsupervised hierarchical clustering.

The workflow first registers all reconstructions to a common brain template, then computes NBLAST similarities and applies Ward hierarchical clustering to classify 121 neurons into eight morphological groups.

## When to use this

Use this recipe to classify registered cerebellar efferent-neuron SWC reconstructions with NBLAST and Ward clustering. Do not compare unregistered neurons or interpret the eight clusters before checking dendrogram stability and silhouette scores.

## Scientific context

Cerebellar output in the larval zebrafish is mediated by two primary cell populations: Purkinje cells and eurydendroid cells. Understanding the morphological diversity within these populations is critical to mapping cerebellar circuit organization. Unsupervised clustering allows for the objective definition of cell types that correlate with distinct physiological or connectivity patterns.

## Preconditions

* **CMTK (Computational Morphometry Toolkit):** Required for image registration binaries.
* **R (with `nat` and `nat.nblast` packages):** Required for downstream morphological manipulation and NBLAST calculation.
* **HPC/Grid Engine:** (e.g., `qsub`) Required for managing the iterative registration jobs.

## Inputs and outputs

1. 121 individual neuron reconstructions in `.swc` format.
2. A set of raw `.nrrd` brain volumes (for template generation).
3. A reference brain model (e.g., the standard Z-Brain or the output of the provided repo).

* **Dendrogram Plot:** A high-resolution figure showing the eight labeled clusters.
* **Classification Table:** A CSV mapping `Neuron_ID` to `Cluster_ID` (1-8).
* **Summary Stats:** Silhouette scores for each of the eight clusters.

## Procedure

1. **Neuron Reconstruction:** Tracing 3D morphology of neurons (e.g., using Simple Neurite Tracer) to generate SWC files.
2. **Standardization:** Mapping neuron point-clouds into a common reference space via non-rigid registration.
3. **Similarity Scoring:** Computing an all-by-all similarity matrix using the NBLAST algorithm.
4. **Clustering:** Applying Ward’s minimum variance method to the NBLAST distance matrix.
5. **Validation:** Determining cluster count (k=8) using statistical metrics like silhouette analysis.

### Code Architecture
the implementation utilizes an iterative registration pipeline designed to align volumetric `.nrrd` brain data to an average template. It employs a master shell wrapper to handle batch processing of images via CMTK, which provides the necessary reference framework for subsequent neuron mapping.

### Key Functions and Modules
* `makeAverageBrain-sync.sh`: Master orchestrator for the registration iteration cycle.
* `warpcmdIteration.sh`: Executes CMTK-based affine and non-rigid warping to register volumes.
* `MakeSymmetricStandardBrain.R`: Handles the final centring and sagittal symmetrization of the resulting average template.

1. **Template Creation:** Execute `makeAverageBrain-sync.sh` to generate the reference brain space.
2. **Registration:** Map all 121 neuron SWC files to the generated reference brain using `nat::xform`.
3. **All-by-All Scoring:** Use `nat.nblast::nblast_allbyall(neurons, smat=...)` to generate the $121 \times 121$ similarity matrix.
4. **Distance Conversion:** Calculate the distance matrix: $D = 1 - S$ (where $S$ is the NBLAST matrix).
5. **Ward Clustering:** Execute `hclust(as.dist(D), method="ward.D2")`.
6. **Cluster Extraction:** Use `cutree(hclust_obj, k=8)` to assign each neuron to a cluster.

## Expected results

A dendrogram displaying 121 leaves, clearly bifurcating between Purkinje and eurydendroid lineages at the primary branch, with eight distinct, color-coded morphological clusters identified across the output population.

1. **Primary Split:** Does the dendrogram distinguish Purkinje vs. Eurydendroid cells?
2. **Consistency:** Do neurons within a cluster show visually similar arborization patterns when overlaid in 3D?

## Pitfalls

* **Upstream Necessity:** The NBLAST scores are only valid if all neurons are registered to the same template brain generated by the provided scripts.
* **Memory Limits:** NBLAST of 121 neurons requires significant RAM; perform on a dedicated workstation or HPC node.
* **Morphological Rooting:** Ensure all SWC files are rooted correctly at the soma; mis-rooted neurons will result in inaccurate similarity scores.

## Bundled files

- `scripts/run_analysis.py`: Run the analysis workflow.
- `scripts/utils.py`: Shared analysis utilities.
- `references/matched_files/`: Template-registration commands required by the workflow.

## Usage

```bash
# 1. Run the registration pipeline
./makeAverageBrain-sync.sh /path/to/raw/nrrd/images

# 2. Perform clustering in R (Example logic)
library(nat)
library(nat.nblast)
nblast_matrix <- nblast_allbyall(registered_neurons)
dist_matrix <- as.dist(1 - nblast_matrix)
clusters <- hclust(dist_matrix, method="ward.D2")
plot(clusters)
```
