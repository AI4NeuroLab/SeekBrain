# Repository Overview

This repository contains a comprehensive scRNA-seq analysis pipeline for mouse visual cortex development, focusing on the classification, temporal mapping, and layer-specific profiling of Glutamatergic, GABAergic, and Non-neuronal cell populations across multiple postnatal ages (P8 to P38).

### 1. Repository Purpose
The primary objective is to build a high-resolution, developmentally-informed atlas of the mouse visual cortex. The repository integrates cross-age datasets to:
*   Identify and refine distinct neuronal and non-neuronal cell types.
*   Track transcriptional changes and cell-type abundance across postnatal development (P8–P38).
*   Perform supervised classification and activity mapping to relate these cells to established adult reference datasets (e.g., Tasic et al., 2018).

### 2. Data Pipeline
The analysis follows a standardized, modular workflow across all cell classes (Glutamatergic, GABAergic, Non-neuronal):
1.  **Initial Processing**: Loading raw 10x Genomics matrices, QC filtering (mitochondrial %, gene/count counts), and doublet detection.
2.  **Harmonization**: Integration of biological replicates and time points using batch-correction algorithms (`Harmony`, `Scanorama`, or `bbknn`).
3.  **Clustering & Annotation**: Iterative Leiden clustering, refinement of cluster IDs by removing noise/doublets, and manual annotation using canonical marker genes.
4.  **Temporal & Subclass Analysis**: Downstream analysis including differential expression (DE), frequency tracking across ages, and mapping to external references.

### 3. Key Scripts & Their Roles
*   **Initial Analysis (`1-InitialAnalysis/`)**: Standardizes QC, doublet detection, and provides the "master" clustering framework.
*   **Cellular Atlases (`2-GlutamatergicAtlas/`, `3-GABAergicAtlas/`, `4-Non-neuronalAtlas/`)**: These directories contain the core initialization and harmonized notebooks for each major cell lineage.
*   **DRDL Atlas (`5-DRDLAtlas/`)**: Specialized analysis of Dorsal Raphe/Dorsal Lateral regions, focused on regional layer comparison (`Layers_DRDLvsNR.ipynb`).
*   **Supervised Classification (`6-SupervisedClassification/`)**: Contains high-level comparative studies, including mapping to adult Tasic datasets and longitudinal temporal analysis (Sankey diagrams, ARI subclass analysis).
*   **Misc (`7-Misc/`)**: Contains exploratory and visualization scripts for specific paper figures (e.g., Figure 1D, spatiotemporal pseudo-analysis).

### 4. Analysis Methods Implemented
*   **Dimensionality Reduction**: PCA for latent space; UMAP for non-linear manifold visualization.
*   **Integration**: Comparison and implementation of `Scanorama`, `Harmony`, and `bbknn` to overcome batch effects between developmental ages.
*   **Statistical Analysis**: Wilcoxon Rank-Sum test (`sc.tl.rank_genes_groups`) for marker discovery; Adjusted Rand Index (ARI) for clustering stability assessment.
*   **Clustering**: Leiden community detection; dendrogram-based hierarchical clustering for cell-type lineage relationships.

### 5. Outputs & Figures
*   **Data Objects**: Extensive library of intermediate and final `.h5ad` files used for archiving and checkpointing analysis.
*   **Visualizations**: 
    *   **Dotplots**: Marker gene expression across cell types/ages.
    *   **UMAPs**: Cluster/batch distribution maps.
    *   **Temporal Plots**: Sankey diagrams (lineage tracking) and frequency/proportion charts.
    *   **Statistical**: ARI performance comparisons for clustering resolution tuning.

### 6. Dependencies & Environment
*   **Bioinformatics Core**: `scanpy` (workflow), `scrublet` (doublet detection), `scipy`, `pandas`, `numpy`.
*   **Integration**: `harmony`, `scanorama`, `bbknn`.
*   **Visualization**: `matplotlib`, `seaborn`.
*   **Machine Learning**: `sklearn` (metrics and modeling).

### 7. File Dependency Graph
The repository follows a hierarchical dependency structure:
*   **Root Data** (Raw `.mtx` 10x files) $\rightarrow$ **1-InitialAnalysis** (Cleaned `PooledMVC.h5ad`)
*   **Pooled Object** $\rightarrow$ **Branch-specific Initialization** (P8-P38 notebooks for Glut/Gaba/Non-neurons)
*   **Individual Batch Objects** $\rightarrow$ **Harmonized Atlases** (Integration/Harmony notebooks)
*   **Harmonized Atlases** $\rightarrow$ **Supervised/Temporal Mapping** (Cross-age and external reference mapping scripts)
*   **All Atlases** $\rightarrow$ **Misc/Figure Analysis** (Combined plotting and paper-specific synthesis)

Repository Structure:
  1-InitialAnalysis/ClassSeparation.ipynb (33216 chars)
  1-InitialAnalysis/DoubletDetection.ipynb (13972 chars)
  2-GlutamatergicAtlas/CollectiveAnalyses.ipynb (46264 chars)
  2-GlutamatergicAtlas/Harmonized_gluta.ipynb (61535 chars)
  2-GlutamatergicAtlas/Initialization/P14_glut.ipynb (2350 chars)
  2-GlutamatergicAtlas/Initialization/P17_glut.ipynb (5368 chars)
  2-GlutamatergicAtlas/Initialization/P21_glut.ipynb (5421 chars)
  2-GlutamatergicAtlas/Initialization/P28_glut.ipynb (4342 chars)
  2-GlutamatergicAtlas/Initialization/P38_glut.ipynb (4559 chars)
  2-GlutamatergicAtlas/Initialization/P8_glut.ipynb (12074 chars)
  3-GABAergicAtlas/CollectiveAnalyses-gaba.ipynb (17759 chars)
  3-GABAergicAtlas/HarmonizedGABA_DRDL.ipynb (15377 chars)
  3-GABAergicAtlas/HarmonizedGABA_NR.ipynb (21192 chars)
  3-GABAergicAtlas/Initialization/P14_gaba.ipynb (5545 chars)
  3-GABAergicAtlas/Initialization/P17_gaba.ipynb (6503 chars)
  3-GABAergicAtlas/Initialization/P21_gaba.ipynb (7008 chars)
  3-GABAergicAtlas/Initialization/P28_gaba.ipynb (3737 chars)
  3-GABAergicAtlas/Initialization/P38_gaba.ipynb (3811 chars)
  3-GABAergicAtlas/Initialization/P8_gaba.ipynb (7144 chars)
  4-Non-neuronalAtlas/CollectiveAnalysis_non-neurons.ipynb (29119 chars)
  4-Non-neuronalAtlas/Non-neurons_NR_init.ipynb (22152 chars)
  4-Non-neuronalAtlas/Non-neurons_astro.ipynb (28534 chars)
  5-DRDLAtlas/DRDL_UMAPs.ipynb (8358 chars)
  5-DRDLAtlas/Initialization/Non-neurons_DRDL_init.ipynb (24684 chars)
  5-DRDLAtlas/Initialization/P28DL_init.ipynb (12164 chars)
  5-DRDLAtlas/Initialization/P28DR_init.ipynb (18367 chars)
  5-DRDLAtlas/Initialization/P28_dl_glut.ipynb (6263 chars)
  5-DRDLAtlas/Initialization/P28_dr_glut.ipynb (10383 chars)
  5-DRDLAtlas/Initialization/P28dl_gaba_init.ipynb (5168 chars)
  5-DRDLAtlas/Initialization/P28dr_gaba_init.ipynb (2657 chars)
  5-DRDLAtlas/Initialization/P38DR_init.ipynb (18017 chars)
  5-DRDLAtlas/Initialization/P38_dr_glut.ipynb (7414 chars)
  5-DRDLAtlas/Initialization/P38dr_gaba_init.ipynb (3345 chars)
  5-DRDLAtlas/Layers_DRDLvsNR.ipynb (45808 chars)
  6-SupervisedClassification/ActivityMapping/GABA_DR_DL.ipynb (128049 chars)
  6-SupervisedClassification/ActivityMapping/GLUT_DR_DL.ipynb (130987 chars)
  6-SupervisedClassification/ActivityMapping/Subclass_NonNeuron_DR_DL.ipynb (56202 chars)
  6-SupervisedClassification/ActivityMapping/Type_GABA_DR_DL.ipynb (23268 chars)
  6-SupervisedClassification/ActivityMapping/Type_Glut_DR_DL.ipynb (24137 chars)
  6-SupervisedClassification/ActivityMapping/Type_NonNeuron_DR_DL.ipynb (22950 chars)
  6-SupervisedClassification/MappingV1toTasic2018.ipynb (20364 chars)
  6-SupervisedClassification/TemporalMapping/GABA_ARI_Subclass_Analysis.ipynb (46179 chars)
  6-SupervisedClassification/TemporalMapping/GABA_Sankey.ipynb (46361 chars)
  6-SupervisedClassification/TemporalMapping/GLUT_ARI_Layer_Analysis.ipynb (54758 chars)
  6-SupervisedClassification/TemporalMapping/GLUT_Sankey.ipynb (47292 chars)
  6-SupervisedClassification/TemporalMapping/NonNeuron_ARI_Subclass_Analysis.ipynb (54073 chars)
  6-SupervisedClassification/TemporalMapping/NonNeurons_Sankey.ipynb (41443 chars)
  7-Misc/Combining_AnnData.ipynb (9225 chars)
  7-Misc/Figure1D.ipynb (6544 chars)
  7-Misc/psuedo-SpatiotemporalAnalysis.ipynb (25027 chars)
  README.md (1006 chars)