# Repository File Summaries

## 1-InitialAnalysis/ClassSeparation.ipynb

This file, `ClassSeparation.ipynb`, outlines the primary preprocessing and initial analysis workflow for a mouse visual cortex scRNA-seq dataset. It progresses from raw data integration to quality control, clustering, and cell-type annotation.

### 1. Purpose
The script integrates multiple scRNA-seq datasets across several developmental ages (P8 to P38), performs quality control and doublet detection, and establishes an initial cell-type clustering framework.

### 2. Key Functions/Classes
*   **`sc.read_10x_mtx`**: Loads 10x Genomics formatted single-cell count matrices.
*   **`adata.concatenate`**: Merges separate `AnnData` objects from different replicates and time points into a single master object.
*   **`sc.pp.filter_cells/genes`**: Removes low-quality cells and sparse genes based on thresholds.
*   **`sc.tl.leiden`**: Performs community detection-based clustering on the graph representation.
*   **`sc.tl.pca/umap`**: Reduces dimensionality for visualization and clustering.

### 3. Data Flow
1.  **Read**: Ingests raw 10x `.mtx` files for biological replicates at ages P8, P14, P17, P21, P28, and P38.
2.  **Process**: Concatenates samples, filters based on quality metrics (mito percentage, gene/count counts), normalizes, log-transforms, and scales.
3.  **Write/Read**: Saves and loads intermediate `h5ad` files (`PooledMVC_preHVG.h5ad`, `PooledMVC_clusteredPCA.h5ad`, `PooledMVC_clusteredPCA_dubs.h5ad`) to checkpoint progress.
4.  **Finalize**: Annotates clusters with biological cell-type labels (e.g., 'Excitatory', 'Astrocyte') and exports the final object.

### 4. Dependencies
*   **Core**: `scanpy` (single-cell analysis), `numpy`, `pandas`, `matplotlib`, `scipy`.
*   **Specialized**: `bbknn`, `scanorama` (noted in imports, though standard scanpy workflows are emphasized in the code cells).

### 5. Analysis Methods
*   **Quality Control**: Thresholding based on total counts (<40k), gene counts (<6.5k), and mitochondrial gene fraction (<1%).
*   **Normalization**: CPM normalization (to 1e4) and log(1+x) transformation.
*   **Dimensionality Reduction**: PCA followed by UMAP for visualization.
*   **Clustering**: Leiden algorithm for grouping cells.
*   **Cell Annotation**: Manual curation of clusters based on expression of known marker genes (e.g., *Slc17a7* for Glutamatergic, *Gad1* for GABAergic, *Aqp4* for Astrocytes).
*   **Doublet Analysis**: Aggregates doublet scores/percentages per cluster to filter or characterize ambiguous cell populations.

### 6. Figures/Outputs
*   **QC Plots**: Violin plots and scatter plots of `n_genes`, `n_counts`, and `percent_mito`.
*   **Dotplots**: Visualizes marker gene expression across clusters for neuronal (glut/gaba) and non-neuronal classes.
*   **Doublet Analysis**: Bar plots showing doublet scores and fractions per cluster.
*   **UMAP plots**: Categorical plots showing clusters, ages, and broad classes.

### 7. Key Parameters
*   **Filtering**: `min_genes=700`, `min_cells=8`, `percent_mito < 0.01`.
*   **Normalization/Scaling**: `counts_per_cell_after=1e4`, `max_value=10` (clipping during scaling).
*   **HVG Selection**: `min_mean=0.0125`, `max_mean=3`, `min_disp=0.5`.
*   **Clustering**: `n_neighbors=25`, `n_pcs=40`.

---

## 1-InitialAnalysis/DoubletDetection.ipynb

This analysis covers the `DoubletDetection.ipynb` file from the research repository.

### 1. Purpose
This notebook performs quality control (filtering cells/genes) and doublet detection on single-cell RNA sequencing (scRNA-seq) data across multiple developmental time points in the mouse visual cortex. The processed data is concatenated, saved as an `.h5ad` file, and verified for consistency.

### 2. Key Functions/Classes
*   **`sc.read_10x_mtx`**: Loads 10x Genomics formatted scRNA-seq count matrices.
*   **`scrub.Scrublet`**: Initializes the doublet detection model for a specific count matrix.
*   **`scrub.scrub_doublets`**: Computes doublet scores and predicts doublet status based on gene variability and principal components.
*   **`sc.pp.filter_cells` / `sc.pp.filter_genes`**: Filters out low-quality cells and lowly expressed genes.
*   **`adata.concatenate`**: Merges multiple `AnnData` objects into a single object for downstream analysis.

### 3. Data Flow
*   **Input**: Multiple 10x Genomics `filtered_feature_bc_matrix` directories stored at a specified `stream` path for time points P8, P14, P17, P21, P28, and P38.
*   **Processing**: Each sample undergoes QC (mitochondrial content, n_counts, n_genes filtering) and doublet detection at the individual sample level.
*   **Output**: Results are aggregated into the `adata` object and saved to disk as `PooledMVC_dubs.h5ad`.

### 4. Dependencies
*   **Bioinformatics**: `scrublet` (doublet detection), `scanpy` (single-cell analysis framework).
*   **General**: `scipy.io`, `numpy`, `pandas`, `matplotlib.pyplot`, `os`.

### 5. Analysis Methods
*   **QC Filtering**:
    *   Minimum gene threshold (700 genes/cell).
    *   Minimum cell expression threshold (8 cells/gene).
    *   Mitochondrial filter: `< 1%`.
    *   Complexity filters: `< 6500` genes and `< 40000` total counts per cell.
*   **Doublet Detection**: Uses `scrublet` to simulate doublets based on the provided counts matrix with an assumed doublet rate of 6%.

### 6. Figures/Outputs
*   **Intermediate**: Histogram plots (commented out in the code) for visualization of doublet scores.
*   **Primary Output**: `PooledMVC_dubs.h5ad` containing the annotated `AnnData` object with `Doublet` and `Doublet Score` columns added to the observation metadata.

### 7. Key Parameters
*   **`expected_doublet_rate`**: 0.06 (6%).
*   **`min_gene_variability_pctl`**: 85 (percentile of genes used to calculate doublet scores).
*   **`n_prin_comps`**: 40 (number of PCs used in the Scrublet algorithm).
*   **QC Thresholds**: `percent_mito < 0.01`, `n_genes < 6500`, `n_counts < 40000`.

---

## 2-GlutamatergicAtlas/CollectiveAnalyses.ipynb

This file is a Jupyter Notebook used for the downstream analysis and visualization of glutamatergic neuron datasets across various developmental time points.

### 1. Purpose
The script processes and integrates single-cell RNA sequencing (scRNA-seq) datasets of glutamatergic neurons across different postnatal ages (P8–P38) to perform differential gene expression analysis and generate visualization markers (dotplots) for specific cortical layers and cell types.

### 2. Key Functions/Classes
*   **`DE(adata, obs_id, obs_id_test, ref)`**: Calculates differential gene expression between a target cell type/group and a reference group using the Wilcoxon Rank-Sum test, returning log-fold changes for genes meeting a expression threshold.
*   **`layerize(adata)`**: A helper function that categorizes cells into cortical layers (L2/3, L4, L5, L6) based on their `Type` annotation.

### 3. Data Flow
*   **Input**: Reads multiple `.h5ad` files (Anndata objects) corresponding to different postnatal ages (e.g., `P8_glut_02112021.h5ad`).
*   **Processing**:
    *   Concatenates datasets and performs subsampling to normalize cell counts across ages.
    *   Reorders categorical variables (Age, Type) to ensure consistent plotting order.
    *   Filters datasets by specific layers (L2/3, L4, L5, L6) and writes them to new `.h5ad` files.
*   **Output**: Produces processed `.h5ad` files (e.g., `glut_sub_033121.h5ad`, `L4_030421.h5ad`) and several PDF visualizations.

### 4. Dependencies
*   **Core**: `scanpy`, `numpy`, `pandas`, `scipy`, `matplotlib`, `seaborn`.
*   **Integrative**: `bbknn`, `scanorama`.
*   **Local**: Assumes existence of an external directory path (`path_to_h5ads`) containing the source data.

### 5. Analysis Methods
*   **Differential Expression**: Wilcoxon Rank-Sum test (`sc.tl.rank_genes_groups`) to identify marker genes per cell type.
*   **Data Integration/Subsampling**: Uses concatenation and `sc.pp.subsample` to balance the representation of different developmental stages.
*   **Annotation Mapping**: Complex string parsing of `obs` metadata to create custom `age_type` labels for longitudinal tracking.

### 6. Figures/Outputs
*   **UMAP Visualizations**: Plots cells colored by Type for each age, saved as PDFs.
*   **Dotplots**:
    *   Longitudinal expression of marker genes (e.g., `L23markers_time.pdf`, `L4markers_time.pdf`).
    *   Type-specific marker dotplots (e.g., `L23_type_markersS6.pdf`).
*   **Statistical Summaries**: Prints the top 5 differentially expressed genes for various cell subtypes per layer.

### 7. Key Parameters
*   **`types_order`**: Explicit list defining the hierarchy of neuronal types.
*   **`subsample` fraction**: Set to normalize groups to 3,000 cells per developmental stage.
*   **`pts > 0.2`**: Threshold used in the `DE` function to filter genes expressed in at least 20% of the target population.
*   **`dot_min` / `dot_max`**: Parameters for tuning dotplot sensitivity (0.05 to 0.8).

---

## 2-GlutamatergicAtlas/Harmonized_gluta.ipynb

This file, `Harmonized_gluta.ipynb`, is a data analysis pipeline used for processing, harmonizing, and clustering single-cell RNA sequencing (scRNA-seq) data from glutamatergic neurons across different developmental ages (P8, P14, etc.).

### 1. Purpose
The notebook integrates multiple single-cell datasets, performs batch correction using Harmony, clusters the cells, and optimizes/validates clustering resolutions using the Adjusted Rand Index (ARI). It further characterizes these clusters by mapping markers, identifying differentially expressed genes, and comparing findings across developmental time points.

### 2. Key Functions/Classes
*   **`calculateNCE`**: A custom implementation of Normalized Conditional Entropy used to evaluate clustering performance based on confusion matrices.
*   **`scanpy` functions (`sc.tl.*`, `sc.pp.*`)**: Standard suite for HVG selection, PCA, neighborhood graph construction, Leiden clustering, and UMAP dimensionality reduction.
*   **`harmony.harmonize`**: A third-party integration tool used to correct for batch effects (e.g., `sample` differences) in the PCA space.

### 3. Data Flow
*   **Input**: Reads `.h5ad` files (e.g., `P8_glut08292020.h5ad`, `P14_glut_02112021.h5ad`) containing scRNA-seq objects.
*   **Processing**: Cleans variable metadata, scales data, performs batch-corrected PCA (Harmony), and iteratively re-clusters cells.
*   **Output**: Writes processed data back to `.h5ad` files and exports clustering evaluation metrics to an Excel file (`ARIs.xlsx`).

### 4. Dependencies
*   **Core Scientific**: `scanpy`, `numpy`, `scipy`, `pandas`.
*   **Integration/Correction**: `harmony`, `bbknn` (imported but noted as inactive), `scanorama` (imported but not used).
*   **Clustering/Statistics**: `sklearn.metrics` (for `adjusted_rand_score`, `confusion_matrix`).
*   **Visualization**: `matplotlib`, `seaborn`.

### 5. Analysis Methods
*   **Batch Correction**: Uses `harmony` to integrate data from different samples.
*   **Dimensionality Reduction**: PCA followed by UMAP for visualization.
*   **Clustering**: Leiden community detection with variable resolutions (range: 1.0 to 2.0).
*   **Validation**: Uses Adjusted Rand Index (ARI) to compare clustering stability across resolutions.
*   **Differential Expression**: Uses Wilcoxon rank-sum tests to identify cluster-specific marker genes.
*   **Phylogenetic/Hierarchy Analysis**: Uses `sc.tl.dendrogram` to visualize relationships between cell clusters.

### 6. Figures/Outputs
*   **UMAP Plots**: Visualizes cell types, Leiden clusters, batch samples, and anatomical layer stratification.
*   **Dotplots**: Displays expression levels of bias-specific marker genes (`Inpp4b`, `Ctgf`, `Foxp2`, etc.) across clusters.
*   **ARI Plots**: Line/scatter plots showing the relationship between clustering resolution and ARI per layer.
*   **Point Plots**: Aggregated summary plots via `seaborn` comparing ARI performance across developmental ages (P8–P38).

### 7. Key Parameters
*   **HVG Selection**: `min_mean=0.0125`, `max_mean=3`, `min_disp=0.5`.
*   **Neighbor Graph**: `n_neighbors=25`.
*   **Leiden Resolution**: Iterated from `1.0` to `2.0` in steps of `0.1` to assess stability.
*   **Dendrogram/Marker analysis**: `n_genes=250` for marker discovery; list of specific bias markers (e.g., `Mdga1`, `Rorb`).

---

## 2-GlutamatergicAtlas/Initialization/P14_glut.ipynb

This analysis covers the Jupyter notebook `P14_glut.ipynb`, which is part of a single-cell RNA sequencing (scRNA-seq) analysis pipeline focused on glutamatergic neurons at postnatal day 14 (P14).

### 1. Purpose
This notebook performs the quality control, feature selection, dimensionality reduction, and clustering of P14 glutamatergic neuronal cells. It aims to isolate specific cell populations and visualize their gene expression signatures to facilitate cellular annotation.

### 2. Key Functions/Classes
*   **`scanpy (sc)`**: Utilized for standard single-cell workflows (preprocessing, normalization, clustering, and visualization).
*   **`scanpy.pp.highly_variable_genes`**: Identifies features with high biological variation for downstream analysis.
*   **`scanpy.tl.leiden`**: Performs graph-based community detection to identify clusters of cells.
*   **`scanpy.pl.dotplot`**: Generates dot plots for visualizing expression levels of specific marker genes across clusters.

### 3. Data Flow
*   **Input**: Assumes an existing `adata_gluta` object (likely from a previous processing step in the repository) containing integrated glutamatergic cell data.
*   **Processing**: Extracts the "P14" subset, resets the expression matrix to the raw values, performs feature selection, scaling, PCA, and neighbors graph construction.
*   **Output**: Saves the processed subset as an H5AD file: `P14_glut08292020.h5ad`.

### 4. Dependencies
*   **Core Libraries**: `scanpy`, `numpy`, `pandas`, `matplotlib`, `scipy`.
*   **Specialized Libraries**: `bbknn` (imported but commented out in main flow), `scanorama`.

### 5. Analysis Methods
*   **Normalization/Scaling**: Uses standard `scanpy` scaling with a cap of 10.
*   **Dimensionality Reduction**: Utilizes PCA (arpack solver) followed by UMAP for visualization.
*   **Clustering**: Leiden algorithm for cluster identification, followed by a filtering step to remove identified "bad" clusters (13 and 19).
*   **Hierarchical Clustering**: Employs `sc.tl.dendrogram` on clusters to infer lineage/transcriptomic relationships.

### 6. Figures/Outputs
*   **UMAP Plots**: Dual-panel figure showing cluster distribution and batch/sample distribution.
*   **Dot Plot**: A visualization of specific marker genes (e.g., *Slc17a7, Foxp2, Rorb*) grouped by cluster, annotated with a dendrogram to show cluster hierarchy.

### 7. Key Parameters
*   **HVG Selection**: `min_mean=0.0125`, `max_mean=3`, `min_disp=0.5`.
*   **Neighbors**: `n_neighbors=25`, `n_pcs=40`.
*   **Marker Genes**: A pre-defined list of 12 genes (e.g., *Ctgf, Cux2*) used for characterization of the glutamatergic populations.

---

## 2-GlutamatergicAtlas/Initialization/P17_glut.ipynb

This analysis covers the `P17_glut.ipynb` Jupyter notebook, which is part of a single-cell RNA sequencing (scRNA-seq) analysis pipeline focused on glutamatergic neurons from the P17 developmental stage.

### 1. Purpose
The file performs quality control, batch correction, unsupervised clustering, and cluster annotation for a subset of glutamatergic neurons (batch 'P17'). It assigns biological labels to Leiden clusters based on marker gene expression and computes differential expression to characterize these populations.

### 2. Key Functions/Classes
*   **`scanpy` (`sc`)**: Used for the primary scRNA-seq workflow, including preprocessing (`pp`), trajectory/clustering analysis (`tl`), and visualization (`pl`).
*   **`bbknn`**: Batch-balanced k-nearest neighbors algorithm used to integrate data across different 'P17' sample replicates.
*   **`sc.tl.dendrogram`**: Computes a hierarchical clustering of the cell groups to inform biological relationships.
*   **`sc.tl.rank_genes_groups`**: Performs differential expression analysis (Wilcoxon rank-sum test) to identify markers for each cluster.

### 3. Data Flow
*   **Input**: Assumes an existing `adata_gluta` object (in-memory) or reads a processed h5ad file (`P17_glut.h5ad`) at the end of the execution.
*   **Processing**: Extracts specific batch data, removes existing metadata, selects highly variable genes (HVGs), scales data, performs PCA, executes batch-corrected neighborhood clustering, and relabels Leiden clusters with biological annotations.
*   **Output**: Generates UMAP visualizations, dot plots of gene markers, and top differentially expressed gene lists for specific neuronal subtypes.

### 4. Dependencies
*   **Scientific Stack**: `numpy`, `scipy`, `pandas`, `matplotlib`.
*   **Bioinformatics Tools**: `scanpy` (standard processing), `bbknn` (batch integration), `scanorama` (imported but not explicitly utilized in the primary block).

### 5. Analysis Methods
*   **Batch Correction**: `bbknn` to remove technical variation between P17 sub-samples.
*   **Dimensionality Reduction**: PCA followed by UMAP.
*   **Clustering**: Leiden community detection algorithm.
*   **Statistical Analysis**: Wilcoxon rank-sum test for identifying differentially expressed marker genes.
*   **Annotation**: Manual curation of clusters (e.g., L2/3, L4, L5 IT/PT/NP, L6 CT) based on dendrogram topology and expression of standard cortical layer markers (e.g., *Cux2*, *Rorb*, *Foxp2*).

### 6. Figures/Outputs
*   **UMAP plots**: Displays cluster distribution and batch effects.
*   **Dot plots**: Visualizes expression levels of selected bias markers (cortical layer specific) and top marker genes per cluster.
*   **Dendrogram**: Illustrates the hierarchical relationship between identified clusters.

### 7. Key Parameters
*   **`min_mean=0.0125`, `max_mean=3`, `min_disp=0.5`**: Parameters for highly variable gene selection.
*   **`neighbors_within_batch=6`**: Hyperparameter for `bbknn` to balance batch integration.
*   **`n_neighbors=25`, `n_pcs=40`**: Standard configuration for the neighborhood graph construction.
*   **`method='wilcoxon'`**: Statistical test used for rank gene analysis.

---

## 2-GlutamatergicAtlas/Initialization/P21_glut.ipynb

This file is a Jupyter Notebook used for the bioinformatic processing, clustering, and cell-type annotation of glutamatergic neurons from P21 mouse brain tissue.

### 1. Purpose
The script performs single-cell RNA sequencing (scRNA-seq) analysis on P21 glutamatergic cells, including data normalization, dimensionality reduction, batch correction, cell-type annotation based on gene expression markers, and differential gene expression analysis.

### 2. Key Functions/Classes
*   **`bbknn`**: Used for batch-effect correction by performing k-nearest neighbor alignment across samples.
*   **`sc.tl.leiden`**: Performs graph-based community detection to identify clusters of cells.
*   **`sc.tl.rank_genes_groups`**: Performs differential expression analysis (Wilcoxon rank-sum test) to identify cluster-specific marker genes.
*   **`sc.pl.umap` / `sc.pl.dotplot`**: Generates visualizations for gene expression patterns and cell distribution.

### 3. Data Flow
*   **Input**: Loads a pre-existing `adata` object (`adata_gluta`) and subsequently re-reads processed data from `.h5ad` files (`P21_glut.h5ad`, `P21_glut08122020.h5ad`).
*   **Processing**: Subsets the data for the 'P21' batch, identifies highly variable genes, scales expression, performs PCA, and executes batch integration.
*   **Output**: Produces UMAP projections, dot plots of marker genes, and differential expression results.

### 4. Dependencies
*   **Core Libraries**: `scanpy`, `numpy`, `pandas`, `matplotlib`, `scipy`.
*   **Specialized Libraries**: `bbknn` (batch correction), `scanorama` (not explicitly used in the main workflow but imported).

### 5. Analysis Methods
*   **Dimensionality Reduction**: PCA for feature reduction, UMAP for non-linear manifold projection.
*   **Clustering**: Leiden algorithm for community detection.
*   **Batch Integration**: BBKNN (Batch Balanced K-Nearest Neighbors).
*   **Differential Expression**: Wilcoxon rank-sum test to identify genes defining each cluster, followed by ranking based on log-fold changes.
*   **Annotation**: Mapping clusters to known cortical layers (L2/3, L4, L5, L6) based on specific marker genes (e.g., *Snap25, Slc17a7, Foxp2*).

### 6. Figures/Outputs
*   **UMAPs**: Displays clustering results, batch distribution, and quality control metrics (n_counts, n_genes).
*   **Dot Plots**: Visualizes expression levels of selected "bias markers" and top differentially expressed genes per cluster.
*   **Dendrograms**: Implicitly generated to structure cluster hierarchy.
*   **Console Output**: Prints lists of the top 6 marker genes for each annotated cluster.

### 7. Key Parameters
*   **`min_mean=0.0125, max_mean=3, min_disp=0.5`**: Filtering thresholds for selecting highly variable genes.
*   **`n_neighbors=25`**: Parameter for building the neighborhood graph (referenced but commented out in favor of BBKNN).
*   **`neighbors_within_batch=6`**: Hyperparameter for BBKNN integration.
*   **`method='wilcoxon'`**: Statistical test used for identifying cluster marker genes.

---

## 2-GlutamatergicAtlas/Initialization/P28_glut.ipynb

### File Analysis: `P28_glut.ipynb`

#### 1. Purpose
This notebook performs batch correction and integration of P28 glutamatergic neuronal single-cell RNA sequencing data. It processes data using Scanorama to account for batch effects, performs clustering, and annotates specific cortical cell types (e.g., L2/3, L4, L5, L6).

#### 2. Key Functions/Classes
*   **`scanorama.integrate_scanpy`**: Core function used to integrate disparate batch data into a shared manifold.
*   **`sc.pp.highly_variable_genes`**: Identifies features that exhibit high variance for dimensionality reduction.
*   **`sc.tl.leiden`**: Performs graph-based community detection for cell clustering.
*   **`sc.tl.dendrogram`**: Computes a hierarchical tree of cluster relationships based on integrated data.
*   **`sc.pl.dotplot`**: Generates expression dot plots to visualize marker gene signatures across identified clusters.

#### 3. Data Flow
*   **Input**: Reads an initial `AnnData` object containing glutamatergic cell data.
*   **Processing**: Cleans metadata (`obsp`, `varm`, etc.), identifies highly variable genes, performs Scanorama integration, and updates the `obsm["SC"]` slot with the integrated latent space.
*   **Output**: Saves and re-reads processed data in `.h5ad` format (e.g., `P28_glut08312020.h5ad`).

#### 4. Dependencies
*   **Standard Bioinformatics**: `scanpy` (single-cell analysis), `scipy`, `numpy`, `pandas`.
*   **Integration/Batch Tools**: `bbknn` (imported but commented out in favor of `scanorama`), `scanorama`.
*   **Visualization**: `matplotlib.pyplot`.

#### 5. Analysis Methods
*   **Batch Correction**: Uses **Scanorama** for cross-batch integration.
*   **Dimensionality Reduction**: Utilizes the custom integrated space (`SC`) to run PCA-like manifold embedding (UMAP).
*   **Cell Type Annotation**: Mapping Leiden clusters to specific neuronal layers (L2/3, L4, L5, L6) based on markers like *Rorb*, *Cux2*, and *Foxp2*.
*   **Hierarchical Grouping**: Dendrogram construction to show relationships between cell clusters.

#### 6. Figures/Outputs
*   **UMAP Plots**: Visualization of cells colored by cluster identity and batch origin.
*   **Dot Plots**: Expression visualization of specific marker genes (e.g., *Inpp4b, Ctgf, Foxp2*) grouped by cluster.

#### 7. Key Parameters
*   **Scanorama `dimred`**: 50 (latent dimensions used for integration).
*   **Highly Variable Genes**: `min_mean=0.0125`, `max_mean=3`, `min_disp=0.5`.
*   **Neighbors (`sc.pp.neighbors`)**: `n_neighbors=15`, `n_pcs=40` (using the `SC` representation).
*   **Marker Genes**: A predefined list of neuronal/non-neuronal markers (e.g., *Snap25, Gad1, Slc17a7, Cux2*).

---

## 2-GlutamatergicAtlas/Initialization/P38_glut.ipynb

### Structured Summary: `P38_glut.ipynb`

#### 1. Purpose
This notebook performs the initialization, integration, and cluster annotation of a single-cell RNA-sequencing (scRNA-seq) dataset of Glutamatergic neurons from P38 mouse brain tissue. It processes raw count data, performs batch correction using Scanorama, and identifies cell clusters through neighborhood analysis and community detection.

#### 2. Key Functions/Classes
*   **`scanorama.integrate_scanpy`**: Integrates multiple scRNA-seq batches to remove batch effects.
*   **`sc.pp.highly_variable_genes`**: Identifies features with high variance for dimensionality reduction.
*   **`sc.tl.leiden`**: Performs Leiden clustering to identify distinct cell populations.
*   **`sc.tl.umap`**: Generates a non-linear dimensionality reduction for visualization.
*   **`sc.tl.dendrogram`**: Calculates hierarchical clustering relationships between cell clusters.
*   **`sc.pl.dotplot`**: Visualizes gene expression patterns across clusters to aid biological annotation.

#### 3. Data Flow
*   **Inputs**: Reads raw or processed `h5ad` files (e.g., `P38_glut08122020.h5ad`).
*   **Processing**: Cleans metadata (`obsp`, `varm`, etc.), splits data into batches, calculates highly variable genes, computes integration vectors using Scanorama, and updates the `obsm` slot with the integrated representation (`SC`).
*   **Outputs**: Saves/exports final annotated `AnnData` objects and generates visualization plots.

#### 4. Dependencies
*   **Core Data Science**: `numpy`, `pandas`, `scipy`.
*   **Bioinformatics**: `scanpy`, `bbknn` (imported but commented out), `scanorama`.
*   **Visualization**: `matplotlib.pyplot`.

#### 5. Analysis Methods
*   **Batch Correction**: Employs Scanorama to integrate three different experimental batches (`P38_1a`, `P38_2a`, `P38_2b`).
*   **Dimensionality Reduction**: Uses PCA and UMAP (using the Scanorama-integrated representation `SC` as the feature space).
*   **Clustering**: Leiden community detection.
*   **Cell Typing**: Manual hierarchical curation based on marker gene expression (e.g., *Foxp2*, *Cux2*, *Rorb*) compared against a dendrogram of identified clusters.

#### 6. Figures/Outputs
*   **UMAP Plots**: Visualization of clusters and batch distribution.
*   **Dot Plots**: Expression of specific bias/marker genes mapped across Leiden clusters to validate neuronal sub-types (e.g., L2/3, L4, L5 PT/IT/NP, L6 CT/IT/b).
*   **Dendrograms**: Hierarchical representation of cluster relationships based on gene expression.

#### 7. Key Parameters
*   **`min_mean=0.0125, max_mean=3, min_disp=0.5`**: Filtering thresholds for highly variable genes.
*   **`n_neighbors=25, n_pcs=40`**: Parameters for neighborhood graph construction.
*   **`dimred=50`**: Dimensions retained during Scanorama integration.
*   **Marker List**: A specific set of 16 genes (`Slc17a8` through `Batf3`) used for characterizing Glutamatergic neuronal identities.

***Note**: The notebook contains some dead/commented-out code (e.g., BBKNN integration, manual re-indexing) and multiple re-reads of `h5ad` files, suggesting an iterative workflow often found in exploratory data analysis.*

---

## 2-GlutamatergicAtlas/Initialization/P8_glut.ipynb

This file, `P8_glut.ipynb`, is a Jupyter notebook focused on the refinement and re-clustering of glutamatergic neuronal subpopulations in the P8 mouse visual cortex atlas.

### 1. Purpose
The notebook performs data cleaning and re-clustering of scRNA-seq datasets to integrate missing L5 PT (pyramidal tract) cell populations and finalize cluster annotations for the P8 developmental stage.

### 2. Key Functions/Classes
*   **`scanpy (sc)`**: Used extensively for preprocessing (`sc.pp`), clustering (`sc.tl.leiden`), PCA, and visualization (`sc.pl`).
*   **`bbknn`**: Used to integrate datasets by batch-balanced K-nearest neighbors.
*   **`scanorama`**: Imported for potential batch correction (though focus remains on `bbknn`).
*   **`harmony`**: Imported for integration (though focus remains on `bbknn`).

### 3. Data Flow
*   **Read**: Reads several `.h5ad` files representing initial clusters or pooled data (e.g., `PooledMVC_clusteredPCA.h5ad`, `P8_glut08102020_use.h5ad`).
*   **Process**: Concatenates subsets of cells, performs feature selection (HVGs), batch-aware integration, and iterative clustering/filtering (e.g., removing doublets or low-quality clusters).
*   **Write**: Exports the processed data at various checkpoints to `.h5ad` files (e.g., `P8_glut08292020.h5ad`).

### 4. Dependencies
*   **Core Libraries**: `scanpy`, `numpy`, `pandas`, `scipy`, `matplotlib`.
*   **Integration/Clustering**: `bbknn`, `scanorama`, `harmony`, `sklearn` (for clustering metrics).

### 5. Analysis Methods
*   **Batch Integration**: Uses `bbknn` to correct for batch effects between samples.
*   **Clustering**: Utilizes `leiden` algorithm for unsupervised community detection.
*   **Differential Expression**: Uses Wilcoxon rank-sum test to identify marker genes per cluster (`sc.tl.rank_genes_groups`).
*   **Filtering**: Logic-based filtering of cells based on doublet scores, batch labels, and specific cluster identifiers.
*   **Visualization**: Uses Dotplots for gene marker validation across clusters and UMAPs for dimensionality reduction and batch/cluster visualization.

### 6. Figures/Outputs
*   **Dotplots**: Visualize marker gene expression (e.g., `L5PT_markers`, `bias_markers`) across clusters to validate identities.
*   **UMAPs**: 2D projections showing clusters and batch distribution to assess the success of integration.
*   **Dendrograms**: Generated via `sc.tl.dendrogram` to assess hierarchical relationships between clusters.

### 7. Key Parameters
*   **HVGs**: `min_mean=0.0125, max_mean=3, min_disp=0.5`.
*   **Neighbors/Resolution**: `bbknn` with `neighbors_within_batch` (values ranging from 5 to 6); `n_neighbors=25` and `n_pcs=40` for general processing.
*   **Marker Lists**: Explicit lists like `L5PT_markers` (`['Stac', 'Erg', 'Sox5os4', 'Qrfpr', 'Reln', 'Coro6']`) define the criteria for population identification.

---

## 3-GABAergicAtlas/CollectiveAnalyses-gaba.ipynb

This file, `CollectiveAnalyses-gaba.ipynb`, is part of a single-cell RNA sequencing analysis pipeline focusing on GABAergic inhibitory interneurons across multiple postnatal developmental time points.

### 1. Purpose
The notebook performs aggregate analysis on GABAergic interneuron datasets, including differential gene expression (DE) analysis, subclass and type frequency tracking across age groups, and cluster resolution tuning to characterize neuronal cell types.

### 2. Key Functions/Classes
*   **`DE(adata, obs_id, obs_id_test, ref)`**: A custom function wrapping `scanpy.tl.rank_genes_groups` to calculate differential expression using the Wilcoxon test, specifically filtering and returning log-fold changes for genes with sufficient percentage expression (`pts > 0.2`).

### 3. Data Flow
*   **Reads**: Loads multiple `.h5ad` objects (e.g., `_gaba_March.h5ad` files) corresponding to different postnatal ages (P8 to P38) and an `h5ad` file for Meis2 separation.
*   **Processes**: Concatenates age-specific datasets into a unified `gaba_all` object, performs downsampling for visualization, and calculates subclass/type proportions over time.
*   **Writes**: Exports processed/subsampled objects to `gaba_subclasses_subsampled.h5ad`, `gaba_full_051921.h5ad`, and age-specific sliced `.h5ad` files.

### 4. Dependencies
*   **Core Bioinformatics**: `scanpy`, `bbknn`, `scanorama`.
*   **General Python**: `numpy`, `pandas`, `matplotlib`, `seaborn`, `scipy`.
*   **Machine Learning**: `sklearn` (metrics and utility).

### 5. Analysis Methods
*   **Differential Expression**: Wilcoxon rank-sum test for marker identification.
*   **Dimensionality Reduction/Clustering**: Leiden clustering for identifying cell types and UMAP for visualization.
*   **Statistical Validation**: Adjusted Rand Index (ARI) to evaluate consistency of cell type mappings (e.g., DR/DL comparison).
*   **Normalization**: Frequency normalization of cell subtypes within broader subclasses across age groups.

### 6. Figures/Outputs
*   **Dotplots**: Marker gene expression visualization per subclass and type.
*   **Tracksplot**: Visualization of expression across categories (e.g., `GABA_tracksplot.pdf`).
*   **Line/Scatter Plots**: Relative frequency of subclasses/types over time (e.g., `GABA_subclass_freqs.pdf`, `PV_type_freqs.pdf`).
*   **UMAPs**: Visualization of cell type distribution by age.
*   **Barplots**: ARI values for mapping comparison (e.g., `ActivityARIs_gaba.pdf`).

### 7. Key Parameters
*   **`ages`**: `['P8', 'P14', 'P17', 'P21', 'P28', 'P38']` (developmental time points).
*   **`pts`**: 0.2 (minimum percentage expression threshold for DE genes).
*   **`n_neighbors`**: 25 (used in Leiden clustering).
*   **`res` (Resolution)**: Varied from 1.0 to 2.0 with 0.1 increments for cluster tuning.
*   **Subsampling**: 1000 cells (for subclasses with >1000 cells) or 348 cells (for smaller populations).

---

## 3-GABAergicAtlas/HarmonizedGABA_DRDL.ipynb

This file, `HarmonizedGABA_DRDL.ipynb`, is part of a single-cell RNA sequencing (scRNA-seq) analysis pipeline focused on GABAergic neuronal populations in the DR (Dorsal Raphe) and DL (Dorsal Lateral) regions of the mouse brain at two developmental time points (P28 and P38).

### 1. Purpose
The notebook serves as a data cleaning, quality control, and cell-type annotation refinement script for GABAergic interneuron datasets. It iteratively removes low-quality clusters (potential doublets/non-expressing cells), re-runs analysis pipelines, and assigns categorical cell-type identities based on canonical marker gene expression.

### 2. Key Functions/Classes
*   **`DE()`**: A custom helper function that performs differential expression analysis using the Wilcoxon rank-sum test. It processes `scanpy`'s `rank_genes_groups` results to output a list of marker genes ranked by log-fold change.
*   **`gaba_pipeline()`**: A function (imported/defined externally) used throughout the notebook to standardize/normalize data, run clustering, and compute embeddings for specific subsets.

### 3. Data Flow
*   **Input**: Reads `.h5ad` files (`P28_dr_gaba.h5ad`, `P38_dr_gaba.h5ad`, `P28_dl_gaba.h5ad`) and subsequently loads refined versions from a `path_out` directory.
*   **Processing**:
    1. Concatenates datasets into a `DRDL` object and removes redundant metadata variables.
    2. Filters out noise/doublets by manually identifying and excluding specific Leiden clusters.
    3. Re-runs pipelines on filtered subsets.
    4. Categorizes cluster identities (e.g., mapping Leiden integers to labels like `Pvalb_A`, `Sst_B`).
*   **Output**: Produces refined `.h5ad` objects (referenced via `path_out`) and diagnostic visualizations.

### 4. Dependencies
*   **Core Libraries**: `scanpy`, `pandas`, `numpy`, `matplotlib`, `scipy`.
*   **Bioinformatics Tools**: `bbknn` (batch balanced KNN), `scanorama`, `harmony` (for batch effect correction).
*   **Repo-Specific**: Assumes the presence of a `gaba_pipeline` function and pre-computed refined h5ad files in the file system.

### 5. Analysis Methods
*   **Clustering**: Leiden algorithm for community detection.
*   **Batch Correction**: Uses Harmony (`X_harmony`) and potentially BBKNN for multi-sample integration.
*   **Dimensionality Reduction**: UMAP for visualization.
*   **Statistical**: Wilcoxon rank-sum test for differential expression.
*   **Phylogenetic/Relationship**: Dendrogram generation based on expression profiles to assist in cell-type merging/annotation.

### 6. Figures/Outputs
*   **UMAP Plots**: Visualization of gene expression (`Gad1`, `Gad2`, etc.) and cluster/sample distribution.
*   **Dot Plots**: Marker gene expression visualization across cluster types, utilizing `standard_scale='var'` and `dendrogram=True` to characterize cell identities.

### 7. Key Parameters
*   **Leiden resolution**: `resolution=1.1` (used in the P28_DL subset to separate Sst clusters).
*   **Marker Lists**: `bias_markers` (canonical GABAergic interneuron markers like `Pvalb`, `Sst`, `Vip`, `Lamp5`) and `layer_markers` (used for cross-referencing regional identity).
*   **Filtering**: Hard-coded lists of Leiden clusters deemed "noise" or "doublets" for removal across different regional datasets.

---

## 3-GABAergicAtlas/HarmonizedGABA_NR.ipynb

This code repository file focuses on the harmonized analysis, clustering, and cell-type refinement of GABAergic interneurons across multiple postnatal developmental time points (P8 to P38).

### 1. Purpose
The script performs batch-effect correction (Harmony) on integrated single-cell RNA-seq data of GABAergic neurons across six developmental ages. It further refines cell-type classifications by iteratively removing specific populations (e.g., *Meis2*+ cells) and adjusting cluster identities through marker gene expression analysis.

### 2. Key Functions/Classes
*   `gaba_pipeline(adata)`: A standardized workflow function that performs highly variable gene selection, data scaling, PCA, Harmony integration, Leiden clustering, and UMAP embedding.
*   `name_subclass(adata)`: Maps cluster labels to categorical `Subclass` identities based on prefix parsing of cluster names.

### 3. Data Flow
*   **Input**: Reads multiple `.h5ad` files (`P8_gaba0828.h5ad` through `P38_gaba0828.h5ad`).
*   **Processing**: Concatenates samples, removes batch-specific metadata, applies Harmony integration, and splits the integrated object into time-specific subsets for independent refinement.
*   **Output**: Writes intermediate objects (e.g., `gaba_all_for_Meis2_separation.h5ad`) and saves refined age-specific data for downstream analysis.

### 4. Dependencies
*   **Scanpy (`sc`)**: Core framework for scRNA-seq analysis.
*   **Harmony**: Used for batch effect correction (`harmony.harmonize`).
*   **Other**: `numpy`, `pandas`, `scipy`, `matplotlib`, `sklearn`, `bbknn`, `scanorama`.

### 5. Analysis Methods
*   **Batch Integration**: Uses Harmony to align transcriptomic data across different postnatal ages.
*   **Dimensionality Reduction**: PCA for feature extraction followed by UMAP for visualization.
*   **Clustering**: Leiden community detection with manual merging/splitting based on biological markers and dendrogram analysis.
*   **Refinement**: Iterative removal of low-confidence clusters or populations that do not show temporal continuity across time points.

### 6. Figures/Outputs
*   **UMAP Plots**: Visualization of clusters, age distributions, and marker gene expression (*Pvalb, Sst, Vip, Lamp5, Meis2, Pax6*).
*   **Dot Plots**: Expression of marker genes across refined Leiden clusters/cell types.
*   **Dendrograms**: Hierarchical representation of cluster relationships within each age.
*   **Summary Statistics**: Bar plots showing the number of clusters and cells per developmental stage.

### 7. Key Parameters
*   `min_mean=0.0125, max_mean=3, min_disp=0.5`: Parameters for high-variable gene detection.
*   `n_neighbors=25`: Used in neighbor graph construction for Leiden clustering.
*   `max_value=10`: Clipping threshold for data scaling.
*   `resolution`: Varies by age (e.g., 1.20 for P21) to achieve desired cluster granularity.

---

## 3-GABAergicAtlas/Initialization/P14_gaba.ipynb

### 1. Purpose
This Jupyter notebook processes and annotates P14 GABAergic neuronal single-cell RNA sequencing data. It includes quality control (gene filtering), clustering, manual cluster labeling based on marker genes, and final statistical validation using differential expression analysis.

### 2. Key Functions/Classes
*   **`scanpy` (sc)**: Primary library used for the entire scRNA-seq pipeline (`sc.pp`, `sc.tl`, `sc.pl`).
*   **`sc.tl.leiden`**: Used for community-based cluster detection.
*   **`sc.tl.rank_genes_groups`**: Used for identifying marker genes via the Wilcoxon rank-sum test.
*   **`sc.pl.dotplot`**: Generates visual representations of gene expression across clustered populations.

### 3. Data Flow
*   **Input**: Reads `P14gaba_raw.h5ad`.
*   **Processing**: Applies normalization, scaling, PCA, and neighborhood graph construction. Iteratively filters clusters (removes outliers/low-quality clusters) and re-maps annotations.
*   **Output**: Saves the refined, annotated dataset to `P14_gaba0828.h5ad`.

### 4. Dependencies
*   **Core Libraries**: `scanpy`, `numpy`, `pandas`, `scipy`, `matplotlib`.
*   **Integration/Utils**: `bbknn`, `scanorama`.
*   **Local Data**: Relies on a raw H5AD file (`P14gaba_raw.h5ad`) present in the working directory.

### 5. Analysis Methods
*   **Dimensionality Reduction**: Principal Component Analysis (PCA) followed by UMAP for 2D visualization.
*   **Clustering**: Leiden algorithm for graph-based clustering.
*   **Differential Expression**: Wilcoxon rank-sum test (`method='wilcoxon'`) to identify cluster-specific genes, sorted by log-fold change.
*   **Dendrograms**: Hierarchical clustering for visualization of relationships between identified clusters.

### 6. Figures/Outputs
*   **UMAP Plots**: Visualization of clusters and batch effects.
*   **Dot Plots**: Expression profiles of specific bias markers (e.g., `Meis2`, `Lamp5`, `Pvalb`) and layer-specific markers (e.g., `Cux2`, `Rorb`, `Foxp2`) across the finalized `cluster_name` groups.
*   **Ranked Marker Genes**: Generates ordered lists and visual plots of the top 20 genes per cluster based on log-fold change.

### 7. Key Parameters
*   **HVG Selection**: `min_mean=0.0125`, `max_mean=3`, `min_disp=0.5`.
*   **Neighbors/PCA**: `n_neighbors=20`, `n_pcs=40`.
*   **Marker Analysis**: `n_genes=50` (number of genes ranked per cluster for marker identification).
*   **Visualization**: Custom color palette (`umap_colors`) defined for consistency across cluster plots.

---

## 3-GABAergicAtlas/Initialization/P17_gaba.ipynb

This analysis covers the `P17_gaba.ipynb` notebook, which is part of a single-cell RNA sequencing (scRNA-seq) analysis pipeline for GABAergic neurons at the P17 developmental stage.

### 1. Purpose
The notebook performs quality control, batch integration, clustering, and cell-type annotation for P17 GABAergic neuronal data. It processes raw AnnData objects to generate a refined atlas of GABAergic cell types.

### 2. Key Functions/Classes
*   **`scanorama.integrate_scanpy`**: Used for cross-batch integration to correct for technical variations between samples.
*   **`sc.pp` (scanpy preprocessing)**: Functions like `highly_variable_genes`, `scale`, and `neighbors` for data normalization and graph construction.
*   **`sc.tl` (scanpy tools)**: Implements `pca`, `leiden` (clustering), `umap` (dimensionality reduction), and `rank_genes_groups` (differential expression).
*   **`sc.pl` (scanpy plotting)**: Generates visual outputs including `umap`, `dotplot`, and `dendrogram`.

### 3. Data Flow
*   **Input**: Reads a raw H5AD file (`P17gaba_raw.h5ad`).
*   **Processing**:
    *   Identifies highly variable genes and scales the data.
    *   Integrates batches ('P17_1a', 'P17_1b', 'P17_2a', 'P17_2b') using Scanorama.
    *   Filters out low-quality or irrelevant clusters (Leiden clusters 14 and 17).
    *   Assigns biological labels to clusters using a mapping dictionary.
*   **Output**: Exports the processed, annotated data to an H5AD file (`P17_gaba0828.h5ad`).

### 4. Dependencies
*   **Standard Bioinfo/Data Stack**: `scanpy`, `numpy`, `pandas`, `scipy`, `matplotlib`.
*   **Integration Tools**: `scanorama`, `bbknn` (imported but commented out).

### 5. Analysis Methods
*   **Batch Effect Correction**: Uses Scanorama to align cells across different experimental batches.
*   **Clustering**: Utilizes the Leiden community detection algorithm on the neighborhood graph.
*   **Differential Expression**: Uses the Wilcoxon rank-sum test (`rank_genes_groups`) to identify marker genes for each cluster.
*   **Annotation**: Manual curation based on marker gene expression (e.g., *Pvalb*, *Sst*, *Vip*, *Lamp5*).

### 6. Figures/Outputs
*   **UMAP Projections**: Visualizations of the final cell clusters and batch distributions.
*   **Dot Plots**: Marker gene expression patterns across cell types, including both known GABAergic markers and layer-specific markers.
*   **Parameter Optimization Plot**: A manual bar plot tracking the relationship between the number of neighbors and the number of clusters generated.

### 7. Key Parameters
*   **HVGs**: `min_mean=0.0125`, `max_mean=3`, `min_disp=0.5`.
*   **Integration**: `dimred=50` (Scanorama components).
*   **Graph Construction**: `n_neighbors=25`, `n_pcs=40`.
*   **DE Analysis**: `n_genes=50` (number of top genes returned per cluster).

---

## 3-GABAergicAtlas/Initialization/P21_gaba.ipynb

This analysis covers the Jupyter Notebook `P21_gaba.ipynb` from the `3-GABAergicAtlas/Initialization/` directory.

### 1. Purpose
This file performs the computational processing and cell-type annotation of P21 (Postnatal day 21) GABAergic neuron single-cell RNA-seq data. It transforms raw data into a refined atlas by filtering cells, clustering, and assigning specific cell-type identities.

### 2. Key Functions/Classes
*   **`scanpy` (sc)**: Primary library used for the entire scRNA-seq pipeline (PCA, Leiden clustering, UMAP, differential expression).
*   **`sc.tl.rank_genes_groups`**: Used for marker gene identification (Wilcoxon rank-sum test).
*   **Custom Annotation Logic**: Iterative loops to re-label cluster IDs (e.g., `Lamp5_1`, `Sst_4`) into high-level cell types (e.g., `Lamp5_A`, `Sst_D`) based on external list references (`Lamp5_2_P21`, `Sst_D_P21`, etc.).

### 3. Data Flow
*   **Read**: `P21gaba_raw.h5ad` (Raw expression matrix).
*   **Process**: Performs QC, gene selection, scaling, dimensionality reduction, and filtering of "remove" designated clusters.
*   **Write**: `P21_gaba0828.h5ad` (Refined, annotated dataset).

### 4. Dependencies
*   **Core Libraries**: `scanpy`, `pandas`, `numpy`, `scipy`, `matplotlib`.
*   **Specialized**: `bbknn` and `scanorama` (imported, though primarily standard `scanpy` workflow is used here).
*   **External References**: The notebook expects pre-defined lists of cell barcodes (e.g., `Lamp5_2_P21`, `Sst_D_P21`) which are not defined within the file and must be loaded in the environment.

### 5. Analysis Methods
*   **Standard scRNA-seq Pipeline**: Highly Variable Gene (HVG) selection, PCA, Leiden community detection for clustering, and UMAP projection.
*   **Differential Expression**: Wilcoxon rank-sum tests to identify top genes characterizing each cluster.
*   **Annotation**: Hierarchical rule-based renaming of clusters based on marker gene expression and predefined cell-barcode lists.

### 6. Figures/Outputs
*   **UMAP Plots**: Visualization of clusters and batch origins.
*   **Dotplots**: Visual representation of marker gene expression levels (`bias_markers` and `layer_markers`) to validate cell identities.
*   **Parameter Sensitivity Plot**: A bar chart demonstrating the relationship between the number of neighbors and the resulting number of clusters.

### 7. Key Parameters
*   **HVG Selection**: `min_mean=0.0125`, `max_mean=3`, `min_disp=0.5`.
*   **Dimensionality Reduction**: `n_neighbors=25`, `n_pcs=40` for neighborhood graph construction.
*   **Scaling**: `max_value=10` (clipping gene expression).
*   **Marker Identification**: `n_genes=50` for `rank_genes_groups`.

---

## 3-GABAergicAtlas/Initialization/P28_gaba.ipynb

This file, `P28_gaba.ipynb`, is a data processing and analysis notebook focused on preparing and annotating single-cell RNA sequencing (scRNA-seq) data specifically for GABAergic neurons from a P28 developmental stage.

### 1. Purpose
The notebook processes a raw scRNA-seq object for P28 GABAergic cells by performing dimensionality reduction, clustering, and cell-type annotation, ultimately producing a curated dataset for further study.

### 2. Key Functions/Classes
*   **`scanpy` (sc)**: Primary library used for single-cell analysis workflows.
*   **`sc.pp`**: Preprocessing functions (`highly_variable_genes`, `scale`).
*   **`sc.tl`**: Analysis tools (`pca`, `leiden` for clustering, `umap` for visualization).
*   **`sc.pl`**: Plotting functions (`umap`, `dotplot`).

### 3. Data Flow
*   **Input**: Reads `P28gaba_raw.h5ad`.
*   **Processing**:
    *   Identifies highly variable genes and scales expression data.
    *   Extracts sample information from cell barcodes.
    *   Performs PCA, neighborhood graph construction, and Leiden clustering.
    *   Maps clusters to biological labels via a dictionary/series.
    *   Filters out cells labeled "remove".
*   **Output**: Writes the final processed object to `P28_gaba0828.h5ad`.

### 4. Dependencies
*   **Standard Bioinformatics**: `scanpy`, `pandas`, `numpy`, `scipy`.
*   **Integration Tools** (Imported but not explicitly used in the main workflow snippet): `bbknn`, `scanorama`.
*   **Visualization**: `matplotlib.pyplot`.

### 5. Analysis Methods
*   **Dimensionality Reduction**: Principal Component Analysis (PCA) and Uniform Manifold Approximation and Projection (UMAP).
*   **Clustering**: Leiden community detection algorithm.
*   **Annotation**: Assigning cell-type identities based on marker gene expression (e.g., *Pvalb*, *Lamp5*, *Vip*, *Sst*).
*   **Differential Expression Visualization**: Dotplots used to visualize marker gene expression across identified clusters.

### 6. Figures/Outputs
*   **UMAP Plots**: Visualization of the cells colored by cluster identity and sample/batch.
*   **Dotplots**: Visual display of marker gene expression levels across the categorized clusters, organized by dendrograms.

### 7. Key Parameters
*   **Highly Variable Genes**: `min_mean=0.0125`, `max_mean=3`, `min_disp=0.5`.
*   **PCA/Clustering**: `n_neighbors=25`, `n_pcs=40`.
*   **Scaling**: `max_value=10` (clipping values to 10 standard deviations).
*   **Visualization**: Custom color palette (`umap_colors`) and specific marker gene lists for GABAergic and cortical layer identification.

---

## 3-GABAergicAtlas/Initialization/P38_gaba.ipynb

### Analysis of `P38_gaba.ipynb`

#### 1. Purpose
This notebook performs secondary analysis and curation of a GABAergic neuronal dataset (P38). It focuses on batch-effect correction, clustering, cell type annotation refinement, and quality control filtering.

#### 2. Key Functions/Classes
*   **`scanpy` (sc)**: Core framework for single-cell analysis (filtering, normalization, scaling, PCA, UMAP, Leiden clustering).
*   **`bbknn.bbknn`**: Batch-balanced k-nearest neighbors algorithm for data integration.
*   **`scanorama`**: (Imported, though not explicitly utilized in the workflow) Library for cross-dataset integration.
*   **`sc.pl.dotplot` / `sc.pl.umap`**: Visualization tools for gene expression markers and manifold projections.

#### 3. Data Flow
*   **Reads**: `P38gaba_raw.h5ad` (raw GABAergic single-cell data).
*   **Processes**: 
    *   Normalization and scaling.
    *   Batch identification (derived from cell barcode substrings).
    *   Integration using BBKNN and Leiden-based clustering.
    *   Filtering/subsetting of specific clusters (e.g., removing cluster '15' and 'remove' types).
    *   Mapping numeric clusters to biological cell-type labels via a dictionary (`cluster_dict`).
*   **Writes**: `P38_gaba0828.h5ad` (final processed object).

#### 4. Dependencies
*   **Scientific Libraries**: `scanpy`, `scipy`, `numpy`, `pandas`, `matplotlib`.
*   **Bioinformatics Integration Tools**: `bbknn`, `scanorama`.

#### 5. Analysis Methods
*   **Dimensionality Reduction**: Principal Component Analysis (PCA) with arpack solver.
*   **Integration**: Batch-effect correction via `bbknn` using the 'sample' batch key.
*   **Clustering**: Leiden algorithm for community detection.
*   **Validation**: Dotplot visualization of marker genes (`bias_markers`, `layer_markers`) to verify cluster identity against known neuronal/cortical layer markers.

#### 6. Figures/Outputs
*   **UMAP Plots**: Displays cell distribution colored by cluster identity and by experimental batch.
*   **Dotplots**: Visualizes expression levels of GABAergic marker genes (e.g., *Pvalb, Sst, Vip, Lamp5*) and cortical layer-specific markers across refined clusters.

#### 7. Key Parameters
*   **`highly_variable_genes`**: `min_mean=0.0125`, `max_mean=3`, `min_disp=0.5`.
*   **`bbknn`**: `neighbors_within_batch=8`.
*   **Filtering**: Cluster 15 removal; removal of categories explicitly labeled 'remove'.
*   **Annotation**: Explicit dictionary mapping (`cluster_dict`) of Leiden indices to GABAergic subtypes (e.g., *Vip_1, Pvalb_3, Sst_2*).

---

## 3-GABAergicAtlas/Initialization/P8_gaba.ipynb

This file, `P8_gaba.ipynb`, is a Jupyter Notebook used for the bioinformatic analysis and clustering of P8 (postnatal day 8) GABAergic neuronal cells from single-cell RNA sequencing data.

### 1. Purpose
The notebook processes raw scRNA-seq data to perform dimensionality reduction, clustering, and cell-type annotation of GABAergic neurons. It further refines these clusters by identifying marker genes and benchmarking cluster stability across different parameter settings.

### 2. Key Functions/Classes
*   **`scanpy` (`sc`)**: Used for the entire pipeline, including normalization, PCA, neighbor graph construction, Leiden clustering, and UMAP projection.
*   **`rank_genes_groups`**: Performs differential expression analysis (Wilcoxon rank-sum test) to identify markers for specific clusters.
*   **`dotplot`**: Visualizes gene expression patterns across clusters to validate identity.

### 3. Data Flow
*   **Reads**: `P8gaba_raw.h5ad` (raw data) and `P8_gaba0828.h5ad` (processed checkpoint file).
*   **Processes**: Scales data, calculates highly variable genes (HVGs), performs dimensionality reduction (PCA), and clusters cells using the Leiden algorithm.
*   **Writes**: Exports the refined dataset back to `P8_gaba0828.h5ad`.

### 4. Dependencies
*   **Core Libraries**: `scanpy`, `pandas`, `numpy`, `matplotlib`, `scipy`.
*   **Bioinformatics Extensions**: `bbknn` and `scanorama` are imported (though not heavily utilized in this specific notebook segment), implying integration with a broader multi-sample batch-correction pipeline.

### 5. Analysis Methods
*   **Dimensionality Reduction**: Principal Component Analysis (PCA) followed by UMAP for 2D visualization.
*   **Clustering**: Leiden algorithm for community detection in the neighbor graph.
*   **Differential Expression**: Wilcoxon rank-sum test used to rank genes per cluster and generate marker lists.
*   **Dendrogram Analysis**: Uses `sc.tl.dendrogram` to hierarchically organize cell types based on expression similarity.

### 6. Figures/Outputs
*   **Clustering Visualization**: UMAP plots colored by Leiden cluster, sample, and expression levels of specific marker genes (e.g., *Gad1*, *Gad2*, *Meis2*, *Pax6*).
*   **Marker Gene Heatmaps/Dotplots**: Visualization of cluster-specific genes to support manual curation of cell types.
*   **Benchmarking Plots**: Bar charts comparing the number of clusters generated across different neighbor parameters (`k=10, 15, 20, 25, 30`) to determine optimal clustering resolution across different developmental time points (P8 through P38).

### 7. Key Parameters
*   **HVG Filtering**: `min_mean=0.0125`, `max_mean=3`, `min_disp=0.5`.
*   **Neighbor Graph**: `n_neighbors=10`, `n_pcs=40`.
*   **Differential Expression**: `n_genes=50` (top genes extracted for marker analysis).

---

## 4-Non-neuronalAtlas/CollectiveAnalysis_non-neurons.ipynb

This file, `CollectiveAnalysis_non-neurons.ipynb`, is a data analysis script from a single-cell RNA sequencing (scRNA-seq) study focusing on the characterization and developmental tracking of non-neuronal cell populations across multiple postnatal ages (P8 to P38).

### 1. Purpose
The file performs integrative analysis on non-neuronal cells (astrocytes, oligodendrocytes, OPCs, endothelial cells, microglia, and VLMCs) across various developmental stages. It refines cell-type classifications, computes differential gene expression, and visualizes longitudinal trends in cell frequency and gene expression markers.

### 2. Key Functions/Classes
*   **`DE(adata, obs_id, obs_id_test, ref)`**: A wrapper for `scanpy.tl.rank_genes_groups` using the Wilcoxon rank-sum test to identify differentially expressed genes for specific cell types against a reference group, returning a sorted series of log-fold changes.

### 3. Data Flow
*   **Reads**: Loads several `.h5ad` files representing different developmental time points (e.g., `P8_non_analyzed.h5ad` through `P38`).
*   **Processes**: 
    *   Iteratively updates `adata.obs` with refined 'Type' and 'Subclass' categorical labels based on Leiden clustering results.
    *   Concatenates data across all ages for longitudinal comparison.
    *   Subsamples cells to normalize counts across subclasses for visual consistency.
*   **Writes**: Exports updated `h5ad` objects and various PDF visualizations.

### 4. Dependencies
*   **Standard Scipy Stack**: `numpy`, `scipy`, `pandas`, `matplotlib`, `seaborn`.
*   **Bioinformatics**: `scanpy` (core), `bbknn`, `scanorama`.
*   **Machine Learning**: `sklearn` (metrics and utilities).

### 5. Analysis Methods
*   **Cell Classification**: Mapping Leiden clusters to biologically defined cell types and subclasses.
*   **Differential Expression (DE)**: Wilcoxon rank-sum test to identify cluster-specific markers.
*   **Longitudinal Tracking**: Calculating population frequency changes over time (P8–P38) and generating concatenated object comparisons.
*   **Normalization/Sampling**: Uniform subsampling of classes (1983 cells) to enable balanced comparative plots.

### 6. Figures/Outputs
*   **UMAP Plots**: Individual UMAP projections for each age point, colored by cell type.
*   **Dotplots**: Visualizing top differentially expressed genes per subclass.
*   **Tracksplots**: Expression of marker genes (e.g., *Aldh1l1, Pecam1, Cx3cr1*) grouped by subclass.
*   **Frequency Plots**: Line/scatter plots showing the developmental trajectory of cell type and subclass proportions over time.
*   **PDF Exports**: Multiple plots saved in the working directory (e.g., `non-neurons_tracksplot.pdf`, `ast-od-opc_type_freqs.pdf`).

### 7. Key Parameters
*   **Thresholds**: `l231_genes[obs_id_test]>0.2` used for filtering significant DE genes.
*   **Visualization Settings**: `dpi=100` (interactive), `dpi_save=200` (high-res exports), and custom color palettes (`pastel` and `Set2` seaborn palettes).
*   **Subsampling**: `n_obs=1983` cells per subclass for tracksplot generation.

---

## 4-Non-neuronalAtlas/Non-neurons_NR_init.ipynb

This file, `Non-neurons_NR_init.ipynb`, is part of a single-cell RNA sequencing (scRNA-seq) analysis pipeline designed to process, cluster, and annotate non-neuronal glial cells across multiple developmental time points.

### 1. Purpose
The notebook performs quality control, batch integration, and cluster annotation for non-neuronal cells (glia) extracted from a larger single-cell dataset. It systematically filters out low-quality cells and doublets, then categorizes the cells into broad classes (Microglia, Astrocytes, Oligodendrocytes, OPCs, Endothelial, and VLMCs) using marker-based Leiden clustering.

### 2. Key Functions/Classes
*   **`scanpy` (sc)**: Utilized for the entire single-cell workflow (loading, normalization, log-transformation, PCA, clustering, and visualization).
*   **`harmonize`**: Used (via an external function call not explicitly defined in the snippet, likely Harmony) to integrate data across different biological samples and mitigate batch effects.
*   **`sc.tl.rank_genes_groups`**: Performs differential expression analysis using the Wilcoxon rank-sum test to identify cluster-specific marker genes.

### 3. Data Flow
*   **Input**: Reads an Excel file (`GlialCellList.xlsx`) containing a list of cell barcodes and an H5AD file (`PooledMVC_dubs_unfiltered.h5ad`) containing the full dataset. It later reads individual age-specific files (e.g., `P8_non_analyzed.h5ad`) for refined analysis.
*   **Processing**: Subseting of data by barcodes $\rightarrow$ Filtering (doublets, mitochondrial counts, gene counts) $\rightarrow$ Normalization/Scaling $\rightarrow$ Dimension Reduction (PCA/UMAP) $\rightarrow$ Clustering (Leiden) $\rightarrow$ Manual curation/annotation of clusters.
*   **Output**: Generates UMAP plots, dot plots for marker expression, and potentially refined H5AD objects (implied by the reading/writing structure).

### 4. Dependencies
*   **Data Handling**: `pandas`, `numpy`, `scipy`.
*   **Single-Cell Analysis**: `scanpy`, `bbknn` (imported but unused), `scanorama` (imported but unused).
*   **Visualization**: `matplotlib`, `seaborn`.
*   **Internal**: `harmonize` (assumed helper function), local path variables (`out_path`).

### 5. Analysis Methods
*   **Quality Control**: Thresholding based on `n_counts` (< 15,000) and `min_cells` per gene.
*   **Normalization**: CPM normalization followed by log-transformation.
*   **Batch Correction**: Employs `harmony` (via `X_harmony` representation) to remove batch effects during the age-specific analysis.
*   **Clustering**: Leiden algorithm for unsupervised graph-based community detection.
*   **Marker Identification**: Wilcoxon rank-sum test to generate log-fold change rankings for cluster identification.

### 6. Figures/Outputs
*   **Scatter Plots**: Quality control metrics (n_counts vs. mito %, n_genes).
*   **UMAP Visualizations**: Show clustering by Leiden, batch identity, and broad glial classes.
*   **Dot Plots**: Visualize marker gene expression across clusters to validate identities.
*   **Dendrograms**: Hierarchical grouping of clusters based on gene expression profiles.

### 7. Key Parameters
*   **Clustering**: `n_neighbors=25` (neighbor graph construction).
*   **Normalization**: `counts_per_cell_after=1e4`.
*   **Highly Variable Genes (HVGs)**: `min_mean=0.0125`, `max_mean=3`, `min_disp=0.5`.
*   **Differential Expression**: `n_genes=250` for marker discovery.

---

## 4-Non-neuronalAtlas/Non-neurons_astro.ipynb

### Structured Summary: `Non-neurons_astro.ipynb`

#### 1. Purpose
This notebook performs secondary cluster analysis on astrocyte populations across multiple developmental time points (P8, P14, P17, P21, P28). It aims to refine astrocyte sub-clustering and identify differentially expressed (DE) markers to confirm the presence of two primary astrocyte states (`Astro_C1` and `Astro_C2`) across the lifespan.

#### 2. Key Functions/Classes
While the file relies primarily on the `scanpy` and `harmony` APIs, the workflow utilizes:
*   **`scanpy.pp.highly_variable_genes`**: Identifies feature genes for downstream analysis.
*   **`harmonize`**: Batch-effect correction function (likely imported from a custom `harmony` wrapper).
*   **`scanpy.tl.leiden`**: Performs community detection to cluster cells.
*   **`scanpy.tl.rank_genes_groups`**: Used with the `wilcoxon` method to find cluster-specific marker genes.
*   **`scanpy.pl.dotplot`**: Generates visualizations of marker gene expression levels across clusters.

#### 3. Data Flow
*   **Inputs**: Loads pre-existing Scanpy objects (`P8`, `P14`, `P17`, `P21`, `P28`) from preceding analysis steps (e.g., `Non-neurons_NR_init.ipynb`).
*   **Processing**: Extracts specific leiden-clustered subsets, performs subset-specific feature selection (HVGs), data scaling, PCA, Harmony integration, and re-clustering.
*   **Outputs**: Produces cleaned `AnnData` objects for astrocytes and generates plots identifying marker genes for final identified sub-clusters.

#### 4. Dependencies
*   **Scientific Stacks**: `scanpy`, `numpy`, `scipy`, `pandas`, `matplotlib`, `seaborn`.
*   **Bioinformatics Libraries**: `bbknn` (imported but noted as inactive), `scanorama`, and `harmony` (via local `harmonize` function).
*   **Internal**: Depends on objects generated in previous notebooks and CSV files containing cell identifiers (e.g., `P8_C3_to_P14_C0.csv`).

#### 5. Analysis Methods
*   **Batch Correction**: Uses Harmony integration to account for sample-specific variability within astrocyte subpopulations.
*   **Dimensionality Reduction**: Principal Component Analysis (PCA) followed by UMAP for visualization.
*   **Statistical Analysis**: Wilcoxon rank-sum test for differential gene expression analysis between clusters.
*   **Clustering**: Leiden community detection with varying resolutions (e.g., 0.4–0.5).
*   **Hierarchy**: Dendrogram construction based on hierarchical clustering of leiden-defined groups in Harmony-corrected space.

#### 6. Figures/Outputs
*   **UMAP Plots**: Visualization of clusters, sample batches, and `Astro_Num` annotations.
*   **Dotplots**: Summary of the top 20 DE marker genes for identified clusters per time point, ordered by log-fold change.

#### 7. Key Parameters
*   **HVG Selection**: `min_mean=0.0125`, `max_mean=3`, `min_disp=0.5`.
*   **Clustering Resolution**: Leiden resolutions ranging from `0.4` to `0.5`.
*   **Neighbor Search**: `n_neighbors=25` (using Harmony-corrected components).
*   **Marker Ranking**: Wilcoxon test used to rank the top 250 genes, filtered and visualized for the top 20 genes.

---

## 5-DRDLAtlas/DRDL_UMAPs.ipynb

This file, `DRDL_UMAPs.ipynb`, is a data analysis notebook used to integrate, process, and visualize single-cell RNA sequencing (scRNA-seq) data from different experimental conditions (developmental stages P28/P38 and regional conditions DR/DL/NR).

### 1. Purpose
The notebook integrates GABAergic, Glutamatergic, and Non-neuronal cell populations from multiple datasets, performs dimension reduction and clustering, and generates UMAP visualizations to analyze cell types and subclasses within specific experimental groups.

### 2. Key Functions/Classes
*   **`scanpy` (sc)**: Used extensively for data loading (`read_h5ad`), preprocessing (`highly_variable_genes`, `scale`), dimension reduction (`pca`, `umap`), and plotting (`pl.umap`).
*   **`harmony` (`harmonize`)**: Used to perform batch effect correction on PCA embeddings to align cells across samples.
*   **`anndata.concatenate`**: Merges multiple AnnData objects into a single master object.

### 3. Data Flow
*   **Inputs**: Loads various `.h5ad` files representing GABAergic, Glutamatergic, and non-neuronal cell types from specific development ages (P28, P38) and regions (DR, DL, NR).
*   **Processing**:
    1.  Concatenates sub-group datasets into three main categories.
    2.  Merges these into a master `adata` object.
    3.  Performs global analysis (HVG selection, PCA, UMAP).
    4.  Subsets the data into specific conditions (e.g., `P28dr_all`) to perform condition-specific integration using Harmony.
*   **Outputs**: Saves PDF figures of UMAP visualizations to disk.

### 4. Dependencies
*   **Core Bioinformatics**: `scanpy`, `anndata`, `bbknn`, `scanorama`, `harmony`.
*   **Data/Math**: `numpy`, `pandas`, `scipy`.
*   **Visualization**: `matplotlib`, `seaborn`.
*   **Machine Learning**: `sklearn` (PCA, metrics, KMeans).

### 5. Analysis Methods
*   **Batch Correction**: Uses `harmony` to integrate datasets across distinct sample batches.
*   **Dimensionality Reduction**: Implements PCA (via ARPACK solver) and UMAP for manifold visualization.
*   **Preprocessing**: Normalization and scaling followed by Highly Variable Gene (HVG) identification.
*   **Clustering/Classification**: Uses metadata annotations (Class, Subclass, Type) to map cell identity across dimensions.

### 6. Figures/Outputs
*   **UMAP Visualizations**: Generates UMAP plots colored by `Class`, `Condition`, `Subclass`, `Type`, and `sample`.
*   **PDF Exports**: Saves high-resolution (1000 DPI) PDFs of cell-type distributions for `P28 DR`, `P38 DR`, and `P28 DL` conditions.

### 7. Key Parameters
*   **HVG Selection**: `min_mean=0.0125`, `max_mean=3`, `min_disp=0.5`.
*   **Neighbors**: `n_neighbors=15` (global), `n_neighbors=25` (condition-specific).
*   **Scaling**: `max_value=10` (clipped scaling).
*   **Batch Categories**: P28DR, P38DR, P28DL, P28NR, P38NR.

---

## 5-DRDLAtlas/Initialization/Non-neurons_DRDL_init.ipynb

This file performs secondary analysis and refinement of non-neuronal single-cell RNA sequencing (scRNA-seq) data from the Dorsal Root (DR) at two developmental time points (P28 and P38).

### 1. Purpose
The script cleans, processes, and classifies non-neuronal cells (glia, endothelial, VLMCs) from pooled DR samples. It performs iterative clustering and sub-clustering of astrocytes to distinguish between specific subpopulations across P28 and P38 developmental stages.

### 2. Key Functions/Classes
*   **`scanpy` (sc)**: Used for the primary scRNA-seq workflow, including normalization (`normalize_per_cell`), scaling (`scale`), dimensionality reduction (`pca`, `umap`), clustering (`leiden`), and visualization (`dotplot`, `scatter`).
*   **`harmonize`**: A batch-effect correction function (likely imported from a custom module not explicitly shown in the import block, but utilized in Cells 25, 50, and 59).
*   **`scanpy.tl.rank_genes_groups`**: Used to identify differentially expressed marker genes for astrocyte subpopulations.

### 3. Data Flow
*   **Input**: Reads an initial `h5ad` file (`Pooled_DR_dubs_unfiltered.h5ad`) containing unfiltered doublet information.
*   **Processing**:
    1. Removes doublets and problematic clusters identified via Leiden.
    2. Performs QC filtering (mito percentage, gene count).
    3. Splits data by age (P28, P38) for independent processing.
    4. Subsets data specifically for astrocytes to perform deeper sub-clustering.
*   **Output**: Writes processed objects to disk (e.g., `_non_analyzed_DR.h5ad` files) and generates PDF visualizations.

### 4. Dependencies
*   **Core Libraries**: `scanpy`, `numpy`, `pandas`, `matplotlib`, `seaborn`, `scipy`.
*   **Bioinformatics Tools**: `bbknn` (imported but commented out in favor of `harmony`), `scanorama`.

### 5. Analysis Methods
*   **QC Filtering**: Removal of cells with high doublet scores and high count/mitochondrial content.
*   **Batch Correction**: Uses Harmony integration (`X_harmony`) to correct for batch effects within P28 and P38 samples.
*   **Differential Expression**: Wilcoxon rank-sum test to identify marker genes between Leiden-derived clusters, with custom logic to sort and extract top genes based on log-fold changes.
*   **Clustering**: Leiden community detection used at both the broad non-neuron level and the granular astrocyte level.

### 6. Figures/Outputs
*   **Scatter Plots**: QC metrics (`n_counts` vs `percent_mito`/`n_genes`).
*   **UMAP Projections**: Visualizing cluster structure, batch effects, and cell classifications.
*   **Dot Plots**: Visualizing expression of canonical non-neuronal markers (e.g., `Aldh1l1`, `Gja1`, `Sox10`).
*   **PDF Exports**: Saved UMAP plots (`umap_DR_glia_indiv.pdf`).

### 7. Key Parameters
*   **QC Thresholds**: `n_counts < 18000`.
*   **Highly Variable Genes (HVGs)**: `min_mean=0.0125`, `max_mean=3`, `min_disp=0.5`.
*   **Clustering/Neighbors**: `n_neighbors=25`.
*   **Normalization**: `counts_per_cell_after=1e4`.

---

## 5-DRDLAtlas/Initialization/P28DL_init.ipynb

This file, `P28DL_init.ipynb`, is a data processing and quality control pipeline for single-cell RNA sequencing data of the mouse visual cortex (P28 age group).

### 1. Purpose
The script performs end-to-end processing of scRNA-seq datasets, including loading 10x Genomics matrices, quality control filtering (mitochondrial content and doublet detection), clustering, and sub-population isolation. It concludes by segmenting the dataset into GABAergic, Glutamatergic, and Non-neuronal populations and exporting these subsets as `.h5ad` files.

### 2. Key Functions/Classes
*   **`scanpy` (sc)**: Primary library for single-cell data manipulation (loading, filtering, scaling, PCA, UMAP, Leiden clustering).
*   **`scrublet.Scrublet`**: Used to identify and score potential doublets in the raw datasets.
*   **`sc.read_10x_mtx`**: Reads input files formatted as 10x Genomics feature-barcode matrices.
*   **`concatenate`**: Merges multiple datasets into a single AnnData object.
*   **`write_h5ad`**: Saves processed AnnData objects to disk.

### 3. Data Flow
*   **Input**: Reads four 10x Genomics datasets from a specified local directory (`P28_dl_1_a` through `P28_dl_2_b`).
*   **Process**: Performs joint filtering $\rightarrow$ iterates over individual samples for doublet detection $\rightarrow$ performs normalization, log-transformation, and PCA $\rightarrow$ clusters via Leiden $\rightarrow$ removes identified artifactual/doublet clusters $\rightarrow$ subsets into three biological categories.
*   **Output**: Exports three `.h5ad` files (`P28_dl_gaba.h5ad`, `P28_dl_glut.h5ad`, `P28_dl_non.h5ad`).

### 4. Dependencies
*   **Data Science**: `numpy`, `pandas`, `scipy`, `matplotlib`.
*   **Bioinformatics**: `scanpy`, `scrublet`, `bbknn` (imported but usage is currently commented out), `scanorama` (imported).

### 5. Analysis Methods
*   **Quality Control**: Mitochondrial percentage thresholds (<1%), gene count filtering, and UMI count filtering.
*   **Doublet Detection**: Uses `Scrublet` with an expected doublet rate of 6%.
*   **Dimension Reduction/Clustering**: PCA followed by neighborhood graph construction (`n_neighbors=25`, `n_pcs=40`) and Leiden clustering.
*   **Visualization**: Dot plots for marker gene expression, UMAP projections for cluster/batch visualization, and histograms for doublet scores.

### 6. Figures/Outputs
*   **QC Plots**: Violin plots and scatter plots of cell counts vs. genes/mitochondrial content.
*   **Cluster Metrics**: Bar plots showing doublet fractions per cluster and total cell counts per cluster.
*   **Marker Validation**: Dot plots verifying known cell-type markers (e.g., `Gad1`, `Slc17a7`, `Sox10`).

### 7. Key Parameters
*   **Filtering**: `min_genes=700`, `min_cells=8`.
*   **Normalization**: `counts_per_cell_after=1e4` (CPM normalization).
*   **Clustering**: `n_neighbors=25`, `n_pcs=40`, `min_disp=0.5` for highly variable genes.
*   **Scrublet**: `expected_doublet_rate=0.06`.

---

## 5-DRDLAtlas/Initialization/P28DR_init.ipynb

This code file performs a complete single-cell RNA sequencing (scRNA-seq) preprocessing and clustering pipeline for a specific sample ("P28_dr").

### 1. Purpose
The file processes 10x Genomics scRNA-seq data from four batches, performs quality control (filtering, doublet detection), integrates the batches using BBKNN and Scanorama, clusters the cells, and exports subsets of the data (GABAergic, Glutamatergic, and non-neuronal cells) for downstream analysis.

### 2. Key Functions/Classes
*   **`scanpy` (sc)**: Primary library for single-cell analysis (e.g., `read_10x_mtx`, `pp.filter_cells`, `tl.leiden`, `pl.umap`).
*   **`scrublet.Scrublet`**: Used for identifying potential doublet cells in the individual batches.
*   **`bbknn.bbknn`**: Batch-balanced k-nearest neighbors algorithm for batch effect correction.
*   **`scanorama.integrate_scanpy`**: Alternative batch integration method used for comparison.

### 3. Data Flow
*   **Read**: Loads four 10x Genomics mtx files (`P28_dr_1a/b` and `P28_dr_3a/b`).
*   **Process**: Concatenates, filters (genes/counts/mito), identifies doublets, normalizes, logs, scales, and performs dimensionality reduction.
*   **Write**: Exports processed data subsets (`P28_dr_gaba.h5ad`, `P28_dr_glut.h5ad`, `P28_dr_non.h5ad`) as H5AD files.

### 4. Dependencies
*   **Scientific Stacks**: `scanpy`, `numpy`, `scipy`, `pandas`, `matplotlib`.
*   **Bioinformatics Tools**: `bbknn`, `scanorama`, `scrublet`.

### 5. Analysis Methods
*   **Quality Control**: Mito-fraction thresholds (< 1%), gene count (< 8500), and read count (< 55000) filtering.
*   **Doublet Detection**: Uses *Scrublet* with an expected doublet rate of 0.06.
*   **Batch Correction**: Compares two approaches: **BBKNN** (nearest neighbor batch balancing) and **Scanorama** (manifold alignment).
*   **Clustering**: Uses Leiden community detection.
*   **Marker Analysis**: Identifies cell populations via dot plots of key neuronal/glial markers (e.g., *Snap25*, *Gad1*, *Slc17a7*, *Aldh1l1*).

### 6. Figures/Outputs
*   **QC Plots**: Violin plots and scatter plots of n_genes, n_counts, and mitochondrial fractions.
*   **Clustering/UMAP**: UMAP embeddings colored by Leiden clusters, batch, and doublet scores.
*   **Expression Profiling**: Dot plots showing expression levels of marker genes across clusters.
*   **Statistics**: Bar plots illustrating the fraction of doublets per cluster and cell counts per cluster.

### 7. Key Parameters
*   **QC Thresholds**: `min_genes=700`, `min_cells=8`, `percent_mito < 0.01`.
*   **Scrublet**: `expected_doublet_rate=0.06`, `n_prin_comps=40`.
*   **Clustering/Integration**: `n_neighbors=25`, `neighbors_within_batch=6` (for BBKNN).
*   **Variable Genes**: `min_mean=0.0125`, `max_mean=3`, `min_disp=0.5`.

---

## 5-DRDLAtlas/Initialization/P28_dl_glut.ipynb

This file, `P28_dl_glut.ipynb`, is a data analysis pipeline used for processing single-cell RNA sequencing (scRNA-seq) data, specifically focusing on glutamatergic neurons from the P28 mouse brain (DL region).

### 1. Purpose
The notebook performs quality control, batch correction, cell clustering, and cell-type annotation for P28 glutamatergic neurons. It integrates multiple samples using Harmony and characterizes the resulting cell populations using marker gene analysis and visualization.

### 2. Key Functions/Classes
*   **`scanpy` (sc)**: Used for the entire single-cell processing pipeline (preprocessing, scaling, PCA, neighbors, UMAP, Leiden clustering, and plotting).
*   **`harmony` (harmonize)**: Used to integrate data across different biological/technical batches.
*   **`sc.pl.dotplot`**: Generates dot plots for marker gene expression across identified clusters.

### 3. Data Flow
*   **Input**: Reads initial `h5ad` files (e.g., `P28_dl_glut.h5ad`) and subsequent intermediate versions (`P28_glut_dl_harmony_120120.h5ad`, etc.).
*   **Processing**: Cleans metadata, identifies highly variable genes, scales expression, performs Harmony-based batch correction, executes Leiden clustering, and maps clusters to biological cell types.
*   **Output**: Saves updated annotated objects back to `h5ad` format for downstream usage.

### 4. Dependencies
*   **Scanpy**: Core scRNA-seq analysis.
*   **Harmony**: For batch effect correction.
*   **Matplotlib/Pandas/Numpy**: For data manipulation and plotting.
*   **Scikit-learn**: For metric clustering and SVD solvers.

### 5. Analysis Methods
*   **Batch Correction**: Uses `harmony` to integrate samples based on a `sample` batch key.
*   **Dimension Reduction**: PCA and UMAP.
*   **Clustering**: Leiden algorithm for community detection.
*   **Annotation**: Manual mapping of cluster IDs to biological cell types (e.g., `L4_1`, `L6CT_B`) and subsequent hierarchical simplification into "Subclasses" via string manipulation.
*   **Statistical Visualization**: Dendrogram-based ordering of clusters to visualize hierarchical relationships among cell types.

### 6. Figures/Outputs
*   **UMAP Plots**: Visualization of clusters and sample distribution.
*   **Dot Plots**: Expression levels of predefined marker genes (e.g., `Mdga1`, `Cux2`, `Rorb`) across cell types.
*   **Bar Plots**: Distribution of cell counts per Leiden cluster.

### 7. Key Parameters
*   **HVG Selection**: `min_mean=0.0125`, `max_mean=3`, `min_disp=0.5`.
*   **Neighbors**: `n_neighbors=25` (used for graph construction on Harmony-corrected PCA space).
*   **Scale**: `max_value=10` (clipping during scaling).
*   **Markers**: A specific list of bias markers (e.g., `Mdga1`, `Ccbe1`, etc.) used to validate neuronal identity.

---

## 5-DRDLAtlas/Initialization/P28_dr_glut.ipynb

This analysis covers the Jupyter Notebook `P28_dr_glut.ipynb`, located in the `5-DRDLAtlas/Initialization/` directory.

### 1. Purpose
The file performs the downstream processing, re-clustering, and manual annotation of glutamatergic neurons from a P28 mouse dataset. It integrates Harmony to correct for batch effects and maps clusters to defined cortical cell types.

### 2. Key Functions/Classes
*   **`DE(adata, obs_id, obs_id_test, ref)`**: Two versions defined (Cell 2 and Cell 3). These functions perform Differential Expression (DE) analysis using `sc.tl.rank_genes_groups` (Wilcoxon rank-sum test) and format the log-fold change results for marker gene identification.

### 3. Data Flow
*   **Input**: Reads `P28_dr_glut.h5ad` and later `P28_glut_dr_harmony_120120.h5ad`. It also reads several CSV files from a Google Drive path containing mapping indices (e.g., `P28_DR_C1_to_P28_NR_C13.csv`).
*   **Processing**: Cleans data by removing specific "noisy" clusters, performs PCA, executes batch correction via Harmony, recalculates neighbors and UMAP, and merges/renames clusters based on manual biological curation.
*   **Output**: Saves the processed AnnData object as `P28_glut_dr_harmony_032921.h5ad`.

### 4. Dependencies
*   **Core Scientific**: `scanpy`, `numpy`, `pandas`, `scipy`, `matplotlib`, `seaborn`.
*   **Integration/Clustering**: `harmony` (for batch correction), `bbknn` (imported but unused), `scanorama` (imported but unused), `sklearn` (for clustering metrics and utility).

### 5. Analysis Methods
*   **Batch Correction**: Uses **Harmony** to integrate samples in the PCA space (`X_harmony`).
*   **Dimensionality Reduction**: PCA followed by UMAP.
*   **Clustering**: Leiden algorithm for community detection.
*   **Differential Expression**: Wilcoxon rank-sum test to identify marker genes.
*   **Manual Annotation**: Re-assignment of Leiden clusters to biological cell types (`L2/3`, `L4`, `L5PT`, `L6CT`, etc.) based on marker gene expression (dot plots) and cross-referencing with external mapping files.

### 6. Figures/Outputs
*   **Dotplots**: Visualizes expression of marker genes (`Rorb`, `Cux2`, `Inpp4b`, etc.) across clusters/types.
*   **UMAP Projections**: Maps showing cells colored by cluster, batch (`sample`), and annotated cell `Type` or `Subclass`.
*   **Dendrograms**: Hierarchical clustering trees generated by `sc.tl.dendrogram` to show relationships between cell types.

### 7. Key Parameters
*   **`min_mean=0.0125`, `max_mean=3`, `min_disp=0.5`**: Parameters for highly variable gene (HVG) selection.
*   **`n_neighbors=25`**: Parameter for `sc.pp.neighbors` to define the local neighborhood size.
*   **`max_value=10`**: Truncation threshold for scaling gene expression.
*   **`method='wilcoxon'`**: Statistical test for differential expression.

---

## 5-DRDLAtlas/Initialization/P28dl_gaba_init.ipynb

### Analysis of `P28dl_gaba_init.ipynb`

This file performs an initial clustering and analytical cleaning of a P28 mouse dorsolateral (dl) GABAergic neuron single-cell RNA sequencing dataset to identify and isolate specific neuronal subpopulations.

---

### 1. Purpose
The notebook processes an existing `.h5ad` scRNA-seq object for P28 GABAergic cells by cleaning metadata, performing dimensionality reduction, clustering (Leiden), and filtering out contaminating cell types (e.g., *Slc17a7*-expressing excitatory neurons). It concludes by generating cluster-specific marker gene lists for validation.

### 2. Key Functions/Classes
*   **`scanpy.pp` methods**: Used for preprocessing (`highly_variable_genes`, `scale`, `neighbors`).
*   **`scanpy.tl` methods**: Used for analysis (`pca`, `leiden`, `umap`, `dendrogram`, `rank_genes_groups`).
*   **`scanpy.pl` methods**: Used for visualization (`umap`, `dotplot`).

### 3. Data Flow
*   **Input**: `P28_dl_gaba.h5ad` (Raw/initial processed file).
*   **Processing**: Clears previous metadata (`obsp`, `varm`, etc.), re-identifies highly variable genes, scales expression, and clusters cells. Filters out specific clusters (Leiden 4, 16, 8, 17).
*   **Output**: 
    *   `P28_gaba_dr_Clustered.h5ad` (Intermediate clustered file).
    *   `P28_dl_gaba_analyzed.h5ad` (Final analyzed file).

### 4. Dependencies
*   **Data/Math**: `numpy`, `pandas`, `scipy`.
*   **Single-cell Analysis**: `scanpy`, `bbknn` (imported but commented out), `scanorama` (imported but deleted).
*   **Visualization**: `matplotlib.pyplot`.

### 5. Analysis Methods
*   **Feature Selection**: Selection of highly variable genes based on mean expression and dispersion thresholds.
*   **Dimensionality Reduction**: PCA followed by UMAP projection for visualization.
*   **Clustering**: Leiden community detection algorithm.
*   **Differential Expression**: Wilcoxon rank-sum test (`sc.tl.rank_genes_groups`) to identify top marker genes for each identified cluster.
*   **Data Cleaning**: Subset selection to remove non-GABAergic (or contaminating) clusters based on gene marker expression (*Slc17a7*).

### 6. Figures/Outputs
*   **UMAP Plots**: Visualization of clusters, batch (sample) metadata, and QC metrics (`n_counts`, `percent_mito`, `n_genes`).
*   **Dotplots**: Expression levels of specific bias markers (e.g., *Snap25*, *Gad1*, *Pvalb*) across clusters, and top-ranked marker genes.
*   **Bar Chart**: Distribution of cell counts per identified cluster.

### 7. Key Parameters
*   **HVG Filtering**: `min_mean=0.0125`, `max_mean=3`, `min_disp=0.5`.
*   **Dimensionality Reduction**: `n_neighbors=25`, `n_pcs=40` for neighbor graph construction.
*   **Marker Ranking**: `method='wilcoxon'`, `n_genes=200` for finding cluster-specific genes.
*   **Filtering Clusters**: Hardcoded removal of Leiden clusters `['4', '16', '8', '17']`.

---

## 5-DRDLAtlas/Initialization/P28dr_gaba_init.ipynb

### Analysis of `P28dr_gaba_init.ipynb`

#### 1. Purpose
This notebook performs the initial data cleaning, normalization, clustering, and filtering of a single-cell RNA sequencing (scRNA-seq) dataset (`P28_dr_gaba.h5ad`) to isolate and define GABAergic cell populations at the P28 developmental stage.

#### 2. Key Functions/Classes
*   **`sc.pp.highly_variable_genes`**: Identifies highly variable genes for dimensionality reduction.
*   **`bbknn`**: Batch-balanced k-nearest neighbors; used here to integrate multiple samples while correcting for batch effects.
*   **`sc.tl.leiden`**: Performs community detection to cluster cells.
*   **`sc.tl.umap`**: Projects high-dimensional gene expression data into 2D space for visualization.
*   **`sc.tl.dendrogram`**: Computes hierarchical clustering of categories (Leiden clusters) to visualize relationships.

#### 3. Data Flow
*   **Read**: Loads raw data from `P28_dr_gaba.h5ad`.
*   **Process**: Cleans metadata (`obsp`, `varm`, etc.), resets `X` to raw values, scales the data, performs PCA, integrates batches, clusters the data, and filters out non-GABAergic clusters (e.g., clusters exhibiting *Slc17a7* expression).
*   **Write**: Saves the refined object to `P28_gaba_dr_Clustered.h5ad`.

#### 4. Dependencies
*   **Standard Bio-Data Science Stack**: `numpy`, `pandas`, `matplotlib`, `scipy`.
*   **Single-Cell Libraries**: `scanpy` (core framework), `bbknn` (batch integration), `scanorama` (imported but explicitly deleted).

#### 5. Analysis Methods
*   **Preprocessing**: Normalization and scaling.
*   **Dimensionality Reduction**: Principal Component Analysis (PCA) and Uniform Manifold Approximation and Projection (UMAP).
*   **Batch Correction**: Uses `bbknn` with `neighbors_within_batch=6`.
*   **Marker-based Filtering**: Removal of clusters based on expression of excitatory markers (e.g., *Slc17a7*).
*   **Marker Validation**: Uses a dot plot of bias markers (*Snap25, Slc17a7, Gad1, Gad2, Pvalb, Sst, Lamp5, Vip*) to confirm cell identity.

#### 6. Figures/Outputs
*   **UMAP Visualizations**: Two panels showing the Leiden-clustered data and the batch distribution.
*   **Dot Plot**: Shows the expression levels of selected neuronal markers across the Leiden clusters to identify potential contaminants or distinct sub-populations.

#### 7. Key Parameters
*   **`min_mean=0.0125, max_mean=3, min_disp=0.5`**: Thresholds for selecting highly variable genes.
*   **`n_pcs=40`**: (Implicitly used) Components for PCA.
*   **`neighbors_within_batch=6`**: Sensitivity parameter for the `bbknn` batch correction algorithm.
*   **Filtered Clusters**: Leiden clusters 4, 16, 8, and 17 are excluded as potential non-GABAergic noise.

---

## 5-DRDLAtlas/Initialization/P38DR_init.ipynb

This analysis focuses on the provided Jupyter notebook file, which details the single-cell RNA sequencing (scRNA-seq) processing pipeline for the "P38_dr" dataset.

### 1. Purpose
The file performs end-to-end scRNA-seq data processing for the P38 dataset, including quality control, doublet detection, batch correction (via BBKNN and Scanorama), clustering, and sub-population stratification (GABAergic/Glutamatergic/Non-neuronal).

### 2. Key Functions/Classes
*   **`scanpy` (`sc`)**: Used for data loading, quality filtering, normalization, scaling, PCA, and visualization (UMAP, dotplots).
*   **`scrublet` (`crub.Scrublet`)**: Used for computational identification of potential doublet cells.
*   **`bbknn`**: Implemented for batch-effect correction by integrating neighbors across batches.
*   **`scanorama` (`scr.integrate_scanpy`)**: Used as an alternative integration method to combine datasets across different batches.

### 3. Data Flow
*   **Read**: Loads four 10x Genomics MTX files (`P38_dr_1a/b` and `P38_dr_2a/b`).
*   **Process**: Concatenates samples, performs quality control (filtering by gene count, mitochondrial percentage, and total counts), detects doublets, normalizes, scales, and clusters cells.
*   **Write**: Exports processed sub-datasets (`gaba`, `glut`, `non`) as `.h5ad` files to the designated `export_path`.

### 4. Dependencies
*   **Standard Bioinformatics**: `scanpy`, `scrublet`, `bbknn`, `scanorama`.
*   **Data Handling/Computing**: `numpy`, `pandas`, `scipy`.
*   **Visualization**: `matplotlib.pyplot`.

### 5. Analysis Methods
*   **Quality Control**: Thresholding for mitochondrial content (<1%), gene counts (<8000), and total counts (<45000).
*   **Doublet Detection**: Performed using `scrublet` on individual samples before concatenation, with a 6% expected doublet rate.
*   **Integration/Batch Correction**: Uses `bbknn` (default) and `scanorama` to align cell representations across the four experimental batches.
*   **Clustering**: Utilizes the Leiden algorithm.
*   **Dendrogram Analysis**: Uses `sc.tl.dendrogram` to organize clusters based on marker gene expression.

### 6. Figures/Outputs
*   **Violin/Scatter Plots**: QC metrics (n_genes, n_counts, percent_mito).
*   **Histograms**: Doublet score distributions.
*   **Dotplots**: Marker gene expression per cluster (e.g., *Cx3cr1, Pdgfra, Snap25*).
*   **UMAP Projections**: Visualization of cluster identity and batch distribution.
*   **Bar Charts**: Visualization of cell counts and doublet fractions per cluster.

### 7. Key Parameters
*   **QC Thresholds**: `min_genes=700`, `min_cells=8`.
*   **Doublet Rate**: `expected_doublet_rate=0.06`.
*   **BBKNN**: `neighbors_within_batch=6`.
*   **Scanorama**: `dimred=50`.
*   **HVGs (Highly Variable Genes)**: `min_mean=0.0125`, `max_mean=3`, `min_disp=0.5`.

---

## 5-DRDLAtlas/Initialization/P38_dr_glut.ipynb

This analysis covers the Jupyter notebook `P38_dr_glut.ipynb`, which is part of a single-cell RNA sequencing (scRNA-seq) analysis pipeline focused on glutamatergic neurons from P38 mouse cortical regions.

### 1. Purpose
The file performs the downstream processing, batch integration, and cluster annotation of a glutamatergic cell dataset (`P38_glut`). It focuses on refining cell populations through Harmony integration, removing unwanted clusters, and mapping Leiden-derived clusters to biological cortical layers/subclasses.

### 2. Key Functions/Classes
*   **`scanpy` (sc)**: Used for data loading, quality control (dotplots, UMAPs), normalization, PCA, and neighborhood graph construction.
*   **`harmony` (harmonize)**: Used to integrate data across different biological samples to correct for batch effects.
*   **`sc.tl.leiden`**: Used for community-based clustering of cells.
*   **`sc.tl.dendrogram`**: Used to visualize the hierarchical relationship between clusters based on gene expression.

### 3. Data Flow
*   **Input**: Reads `P38_dr_glut.h5ad` (or versioned variants like `P38_glut_dr_harmony_120120.h5ad`).
*   **Process**:
    1. Filters cells by Leiden cluster ID to remove artifacts.
    2. Performs batch-corrected PCA and integration via Harmony.
    3. Annotates clusters by assigning names (e.g., L2/3, L5IT, L6CT) to the `obs['Type']` metadata field.
    4. Derived `Subclass` labels are created through string manipulation of `Type` labels.
*   **Output**: Writes a final processed `h5ad` file (`P38_glut_dr_harmony_041221.h5ad`).

### 4. Dependencies
*   **Analysis**: `scanpy`, `harmony`, `sklearn`, `scipy`, `pandas`, `numpy`.
*   **Visualization**: `matplotlib`, `seaborn`.

### 5. Analysis Methods
*   **Batch Correction**: Uses the Harmony algorithm on PCA space to integrate data across multiple `sample` batches.
*   **Dimensionality Reduction**: Utilizes PCA for feature reduction and UMAP for non-linear visualization.
*   **Clustering & Marker Analysis**: Leiden clustering followed by dotplot analysis of layer-specific markers (e.g., `Cux2`, `Rorb`, `Foxp2`) to validate biological identity.
*   **Fractional Quantification**: Generates bar plots showing the proportional contribution of each `sample` to every identified cluster.

### 6. Figures/Outputs
*   **UMAP Plots**: Visualizations colored by cluster, batch (`sample`), and inferred `Type`/`Subclass`.
*   **Dotplots**: Visualizes expression of marker genes across clusters, organized by a dendrogram.
*   **Fractional Bar Plots**: A 6x3 grid of plots representing the composition of each cluster across different samples.
*   **File Exports**: Saves a finalized `.h5ad` object.

### 7. Key Parameters
*   **Highly Variable Genes (HVG)**: `min_mean=0.0125`, `max_mean=3`, `min_disp=0.5`.
*   **Neighbor Search**: `n_neighbors=25` (using Harmony-corrected space).
*   **Scaling**: `max_value=10` (for gene expression scaling).
*   **Markers**: A specific list of bias markers including `Bcl6`, `Deptor`, `Nxph1`, `Cdh9`, etc., used for cluster validation.

---

## 5-DRDLAtlas/Initialization/P38dr_gaba_init.ipynb

### Code Analysis Summary: `P38dr_gaba_init.ipynb`

#### 1. Purpose
This notebook performs the initialization, preprocessing, and clustering of single-cell RNA sequencing (scRNA-seq) data for the P38 GABAergic dataset. It cleans the raw data, integrates batches using BBKNN, and visualizes the resulting cell clusters to isolate GABAergic cell populations.

#### 2. Key Functions/Classes
*   **`scanpy` (sc)**: Used for the primary scRNA-seq workflow, including data loading, normalization, feature selection, dimensionality reduction (PCA, UMAP), and clustering (Leiden).
*   **`bbknn`**: A batch-effect correction tool used to integrate different samples within the dataset.
*   **`matplotlib.pyplot`**: Used for generating diagnostic plots, including UMAP projections and cluster distribution bar charts.

#### 3. Data Flow
*   **Input**: Reads an AnnData object (`P38_dr_gaba.h5ad`) containing raw gene expression data.
*   **Processing**:
    *   Cleans metadata/attributes (removes `obsp`, `varm`, `obsm`, `uns`, and old `var` features).
    *   Resets expression data to raw values and applies filtering for Highly Variable Genes (HVGs).
    *   Performs batch correction and Leiden clustering.
    *   Filters out specific clusters (leiden '12' and '13') based on marker gene expression (`Slc17a7`).
*   **Output**: Saves the processed and clustered data to a new H5AD file: `P38_gaba_dr_Clustered.h5ad`.

#### 4. Dependencies
*   **Scientific Python Stack**: `numpy`, `scipy`, `pandas`, `matplotlib`.
*   **Single-Cell Analysis**: `scanpy`, `bbknn`, `scanorama` (imported but explicitly deleted in cell 5).

#### 5. Analysis Methods
*   **Batch Correction**: Uses `bbknn` to integrate data across multiple samples.
*   **Clustering**: Implements the Leiden algorithm for community detection.
*   **Dimensionality Reduction**: Principal Component Analysis (PCA) for initial reduction followed by UMAP for visualization.
*   **Quality Control**: Dendrogram construction and DotPlot analysis to visualize expression of specific marker genes (e.g., `Gad1`, `Gad2`, `Pvalb`, `Sst`) to distinguish neuronal/non-neuronal populations.

#### 6. Figures/Outputs
*   **UMAP Visualizations**: Plots showing Leiden clusters and batch labels to assess integration quality.
*   **DotPlot**: A gene expression matrix across identified clusters using `bias_markers`.
*   **Bar Chart**: Displays the number/fraction of cells per Leiden cluster.

#### 7. Key Parameters
*   **HVG Selection**: `min_mean=0.0125`, `max_mean=3`, `min_disp=0.5`.
*   **BBKNN**: `neighbors_within_batch=6`.
*   **Filtering**: Clusters '12' and '13' are discarded, likely due to unintended *Slc17a7* (glutamatergic) contamination in the GABAergic sample.
*   **Scaling**: `max_value=10` applied to gene expression values.

---

## 5-DRDLAtlas/Layers_DRDLvsNR.ipynb

### Analysis of `Layers_DRDLvsNR.ipynb`

#### 1. Purpose
This notebook performs comparative transcriptomic analysis of neuronal cell layers (specifically L2/3 and L4) across different developmental or environmental conditions (NR: Normal Rearing, DR: Dark Rearing, DL: Dark Led). It processes single-cell data to identify marker genes, visualize expression patterns, and cluster genes based on expression gradients across condition-specific cell types.

#### 2. Key Functions/Classes
*   **`DE(adata, ...)`**: Performs differential expression analysis using the Wilcoxon rank-sum test to identify marker genes with log-fold changes for specific cell types.
*   **`compute_egt(adata, ...)`**: Calculates normalized "Expression Gradient" values (`Egt_cond`) across specified conditions, representing the product of the fraction of cells expressing a gene and the mean expression in those cells.
*   **`scatter(adata, ...)`**: Visualizes expression gradients for specific genes as line plots across different conditions.
*   **`clust_genes(X)`**: Implements the Elbow Method to determine the optimal number of clusters for gene expression profiles using K-Means.
*   **`kmeans_and_plot_and_mod(adata, n_clusts)`**: Performs K-Means clustering on gene expression gradients and generates heatmaps/bar charts to visualize module-specific expression.

#### 3. Data Flow
*   **Input**: Loads `.h5ad` files (Anndata format) from specific directory paths (`NR_path`, `DR_path`) corresponding to different experimental conditions (P28/P38).
*   **Processing**: Concatenates subsets of single-cell data based on layer-specific types (e.g., L4, L2/3). It merges multiple objects into single `AnnData` objects for comparative analysis.
*   **Output**: Generates statistical tables of marker genes, calculated variance matrices (`varm['Egt_cond']`), and PDF figures.

#### 4. Dependencies
*   **Core Scientific**: `scanpy`, `pandas`, `numpy`, `scipy`, `matplotlib`, `seaborn`, `sklearn`.
*   **Integration**: `bbknn`, `scanorama`, `harmony` (used for data integration/batch correction).

#### 5. Analysis Methods
*   **Differential Expression**: Wilcoxon rank-sum test (`scanpy.tl.rank_genes_groups`).
*   **Data Integration**: Uses batch-corrected objects (via `harmony`) to compare samples across age and condition.
*   **Clustering**: K-Means clustering used to group genes by their expression trajectory across conditions.
*   **Normalization**: Expression values are normalized by calculating the product of detection frequency and mean expression (Egt), then standardized using z-scores.

#### 6. Figures/Outputs
*   **Dot Plots**: Visualizes expression levels of selected marker genes (e.g., `Tshz2`, `Nell1`, `Robo1`) across defined conditions (`sc.pl.dotplot`).
*   **Gradient Plots**: Line plots showing expression level changes across experimental conditions.
*   **Heatmaps/Bar Charts**: Visualizing results of K-Means clustering for identified gene modules.
*   **PDFs**: Saved figures such as `L4markers_activity.pdf` and `Figure7_L23_withDL.pdf`.

#### 7. Key Parameters
*   **`pts_thresh`**: Threshold for the proportion of expressing cells used in DE filtering.
*   **`n_clusts`**: Number of clusters for K-Means gene grouping.
*   **`method='wilcoxon'`**: Statistical method for rank gene comparison.
*   **`obs_id` / `obs_id_test`**: Identifiers for grouping cells and selecting specific types for comparison.

---

## 6-SupervisedClassification/ActivityMapping/GABA_DR_DL.ipynb

This file, `GABA_DR_DL.ipynb`, provides a structured machine learning pipeline designed to perform supervised cell-type classification for single-cell transcriptomics data (specifically mapping cell clusters from a training dataset to a testing dataset).

### 1. Purpose
The script defines a `TimeMapping` class that uses the XGBoost gradient boosting framework to perform feature selection (identifying top genes) and supervised classification of cells across different datasets. It is designed to map cell types or subclasses between independent single-cell datasets, allowing for the classification of test samples based on a reference training set.

### 2. Key Functions/Classes
*   **`TimeMapping` class**: The core container for the classification workflow.
*   **`xgbclassifier(...)`**: Handles the heavy lifting: training/validation splitting, XGBoost model training on two distinct datasets, identification of common top features (genes), and final prediction of test cell labels.
*   **`plotConfusionMatrix(...)`**: Visualizes the classification performance by generating a dot-plot representation of a confusion matrix, comparing predicted versus true cell labels.

### 3. Data Flow
*   **Input**: Takes two `AnnData` objects (training and test data) and corresponding dictionaries (`train_dict`, `test_dict`) that map text-based cluster identifiers to numerical indices.
*   **Processing**:
    1.  Subsamples data to balance cluster sizes (max 700 cells/ident, minimum 100 cells).
    2.  Trains models on both datasets to identify high-importance features.
    3.  Filters for genes common to the top 500 features of both models.
    4.  Performs a 70/30 train/validation split on the training data.
    5.  Performs final prediction of the test dataset labels based on the full training set model.
*   **Output**: Returns arrays of true and predicted labels for both validation and testing sets.

### 4. Dependencies
*   **Environment**: Google Colab (mounts Google Drive, installs `scanpy`).
*   **Core Libraries**: `scanpy`, `xgboost`, `scikit-learn`, `numpy`, `pandas`, `scipy`, `matplotlib`, `seaborn`, `plotly`.

### 5. Analysis Methods
*   **XGBoost (Extreme Gradient Boosting)**: Used with `multi:softprob` objective to handle multi-class classification.
*   **Feature Selection**: Ranking genes by "gain" importance via XGBoost and selecting the intersection of the top 500 features from both models.
*   **Classification Confidence**: Uses a thresholding approach for predictions (`np.max > 1.1 * (1/number_of_classes)`); cells failing this threshold are classified as "Unassigned."
*   **Bootstrapping**: Implements a simple upsampling/bootstrap for clusters with fewer than 100 cells.

### 6. Figures/Outputs
*   **Confusion Matrix**: A dot-plot heatmap generated via `matplotlib.gridspec`. It sizes dots based on the percentage of matches between true and predicted labels.
*   **Model Performance**: Produces confusion matrices that visualize the mapping accuracy between clusters of the training and testing datasets.

### 7. Key Parameters
*   `max_cells_per_ident` (Default: 700): Limits the number of cells per identity to prevent bias toward large clusters.
*   `train_frac` (Default: 0.7): Determines the split ratio for validation.
*   `nround` (Fixed: 200): Number of boosting iterations for the XGBoost models.
*   `max_depth` (Fixed: 6): Tree depth parameter for the XGBoost classifiers.
*   `eta` (Fixed: 0.2): Learning rate for the models.

---

## 6-SupervisedClassification/ActivityMapping/GLUT_DR_DL.ipynb

This file, `GLUT_DR_DL.ipynb`, is a Python Jupyter notebook designed for supervised classification of single-cell RNA sequencing (scRNA-seq) data using the XGBoost machine learning library.

### 1. Purpose
The notebook facilitates the mapping of cell types between two different scRNA-seq datasets (training and testing) by identifying informative gene features and training a multi-class XGBoost classifier. It includes validation procedures to assess model performance and tools to visualize mapping accuracy via confusion matrices.

### 2. Key Functions/Classes
*   **`TimeMapping` class**: A wrapper class containing the core logic for the analysis.
    *   `xgbclassifier()`: Performs data preprocessing, feature selection (via XGBoost gain importance), model training, internal validation (on 70/30 split), and final prediction on test data.
    *   `plotConfusionMatrix()`: Generates a dot-plot style heatmap representing the accuracy of the cell type mapping (True labels vs. Predicted labels).

### 3. Data Flow
*   **Input**: Takes two `AnnData` objects (`train_anndata`, `test_anndata`) and associated dictionaries (`train_dict`, `test_dict`) that map cluster/subclass names to integer labels.
*   **Processing**: 
    1. Subsamples cells to handle class imbalance.
    2. Performs XGBoost training on both sets separately to extract the "Top 500" most important genes based on `gain`.
    3. Finds the intersection of these features to determine a robust gene set for final classification.
*   **Output**: Returns validation and test performance metrics (ground truth vs. predicted labels) and renders confusion matrix plots.

### 4. Dependencies
*   **Core Data Science**: `numpy`, `pandas`, `scipy`, `seaborn`, `matplotlib`.
*   **Bioinformatics**: `scanpy`.
*   **Machine Learning**: `xgboost`, `sklearn` (confusion matrix, metrics, preprocessing).
*   **Visualization**: `plotly`.

### 5. Analysis Methods
*   **Supervised Classification**: XGBoost (Extreme Gradient Boosting) using `multi:softprob` objective for multi-class classification.
*   **Feature Selection**: Recursive or iterative feature ranking based on XGBoost's `gain` parameter to identify highly predictive marker genes.
*   **Data Balancing**: Bootstrapping/resampling to ensure classes with fewer than 100 cells are appropriately represented.
*   **Unassigned Labeling**: Implements a confidence threshold (`1.1 * (1 / number of classes)`) for classification; cells falling below this threshold are marked as "Unassigned."

### 6. Figures/Outputs
*   **Confusion Matrix**: A specialized dot-plot heatmap where dot size corresponds to the proportion of cells assigned to specific classes, including an "Unassigned" category.

### 7. Key Parameters
*   `max_cells_per_ident`: The cap on the number of cells per identity used for training (default: 700).
*   `train_frac`: The proportion of data reserved for training (default: 0.7).
*   `nround`: Number of boosting rounds for XGBoost (set to 200).
*   `max_depth`: XGBoost tree depth (default: 6).
*   `eta`: Learning rate for XGBoost (default: 0.2).

---

## 6-SupervisedClassification/ActivityMapping/Subclass_NonNeuron_DR_DL.ipynb

This file, `Subclass_NonNeuron_DR_DL.ipynb`, is a Jupyter notebook implementation of a supervised classification pipeline using XGBoost, likely used for mapping single-cell transcriptomic datasets to defined cell-type clusters.

### 1. Purpose
The script performs supervised cell-type annotation by training an XGBoost classifier on a reference single-cell dataset and mapping a query dataset onto these classes. It includes cross-validation, feature selection based on XGBoost gain importance, and visualization of the mapping performance using custom dot-plot confusion matrices.

### 2. Key Functions/Classes
*   **`TimeMapping` class**: A wrapper class that encapsulates the entire classification workflow.
    *   **`xgbclassifier(...)`**: Handles data sampling (splitting training/validation sets), feature selection, XGBoost model training (on both 70% split and full dataset), and prediction of test labels.
    *   **`plotConfusionMatrix(...)`**: Generates a standardized, publication-quality dot-plot confusion matrix to visualize mapping accuracy between true and predicted labels.

### 3. Data Flow
*   **Input**: Takes `AnnData` objects for training and testing, alongside dictionaries (`train_dict`, `test_dict`) mapping categories to integer labels.
*   **Process**: 
    1.  Subsamples cells per cluster to ensure balanced training.
    2.  Trains models to calculate gene importance via "gain."
    3.  Selects the top 500 genes common to both training and test datasets.
    4.  Trains the final model on full training data and predicts query labels.
*   **Output**: Returns validation and test performance labels; generates visualization plots.

### 4. Dependencies
*   **Machine Learning/Scientific**: `xgboost`, `scikit-learn`, `numpy`, `pandas`, `scipy.stats`.
*   **Single-Cell Analysis**: `scanpy`.
*   **Visualization**: `matplotlib` (gridspec), `seaborn`, `plotly`.

### 5. Analysis Methods
*   **XGBoost Classifier**: Multi-class soft-probability classification (`multi:softprob`).
*   **Feature Selection**: Rank-based gene selection using XGBoost "gain" importance, intersection of top 500 genes across both datasets.
*   **Bootstrap/Resampling**: Handles small clusters (fewer than 100 cells) by bootstrapping to ensure training stability.
*   **Prediction Thresholding**: A custom thresholding logic (`1.1 * 1/num_classes`) is used to assign an "Unassigned" label if no class exceeds the probability threshold.

### 6. Figures/Outputs
*   **Dot-plot Confusion Matrix**: A custom-drawn heatmap-style scatter plot showing normalized cell classification percentages, with dot size representing frequency and axes corresponding to predicted vs. true labels.

### 7. Key Parameters
*   `max_cells_per_ident` (Default: 700): Limits the number of cells per identity to prevent bias toward large clusters.
*   `train_frac` (Default: 0.7): Ratio used for the internal train/validation split.
*   `nround` (200): Number of boosting iterations for the XGBoost model.
*   `max_depth` (6): Tree depth hyperparameter for the XGBoost model.
*   `eta` (0.2): Learning rate.

---

## 6-SupervisedClassification/ActivityMapping/Type_GABA_DR_DL.ipynb

This file is a Python Jupyter Notebook providing a framework for supervised classification of single-cell gene expression data using XGBoost.

### 1. Purpose
The file defines a `TimeMapping` class designed to map cell identity labels across different single-cell datasets (e.g., developmental time points). It uses XGBoost to perform feature selection and classification to predict cell type labels from a "test" dataset based on a trained "training" dataset.

### 2. Key Functions/Classes
*   **`TimeMapping` (Class)**: Encapsulates the entire workflow for classification and visualization.
*   **`xgbclassifier`**: Performs the core machine learning pipeline, including data splitting, model training, feature selection (top 500 genes), validation, and prediction on unseen testing data.
*   **`plotConfusionMatrix`**: Generates high-quality, dot-plot style confusion matrices to visualize the performance and mapping accuracy between predicted and true cell identity labels.

### 3. Data Flow
*   **Input**: Takes `scanpy` AnnData objects (`train_anndata`, `test_anndata`) and associated label dictionaries (`train_dict`, `test_dict`).
*   **Processing**: 
    *   Subsamples and balances training data (handles under-represented clusters via bootstrapping).
    *   Trains models on shared high-importance features.
    *   Outputs predicted labels for test cells based on a probability threshold.
*   **Output**: Returns validation and testing labels/predictions and generates visual summary plots.

### 4. Dependencies
*   **Core Scientific**: `numpy`, `pandas`, `scipy`, `matplotlib`, `seaborn`.
*   **Single-Cell Analysis**: `scanpy`.
*   **Machine Learning**: `xgboost`, `sklearn` (metrics, preprocessing).
*   **Visualization**: `plotly`, `matplotlib.gridspec`.

### 5. Analysis Methods
*   **Gradient Boosting**: Uses `xgboost` (Multi-class softprob) to classify cell types.
*   **Feature Selection**: Performs an initial model run to identify the "top 500" most influential genes based on "gain" importance scores across both datasets.
*   **Bootstrap Resampling**: Implements custom logic to ensure clusters with fewer than 100 cells are upsampled.
*   **Unassigned Labeling**: If the prediction probability for a cell in the testing set is below a threshold ($1.1 \times \text{inverse of class count}$), the cell is labeled as "Unassigned".

### 6. Figures/Outputs
*   **Confusion Matrices**: Generates a grid-based dot plot (via `matplotlib`) representing the percentage of cells mapped correctly/incorrectly, including an "Unassigned" category for the testing set.

### 7. Key Parameters
*   `max_cells_per_ident`: Caps the number of cells per identity at 700 to ensure balanced class representation.
*   `train_frac`: Proportion of data used for training (default 0.7).
*   `num_boost_round`: Number of boosting iterations (set to 200).
*   `eta` (learning rate): Set to 0.2 in the XGBoost configuration.
*   `max_depth`: Depth of trees (set to 6).

---

## 6-SupervisedClassification/ActivityMapping/Type_Glut_DR_DL.ipynb

This file, `Type_Glut_DR_DL.ipynb`, provides a framework for performing supervised classification and mapping of single-cell RNA sequencing (scRNA-seq) data using XGBoost. It is designed to label cells in a test dataset based on cluster assignments from a reference (training) dataset.

### 1. Purpose
The script defines a `TimeMapping` class that automates the feature selection, training, and validation of an XGBoost classifier to map cell types between different experimental conditions or datasets in single-cell transcriptomics.

### 2. Key Functions/Classes
*   **`TimeMapping` class**: A wrapper class containing the workflow for supervised cell type mapping.
    *   **`xgbclassifier`**: Handles data preprocessing (balancing classes, bootstrapping undersampled clusters), feature selection (identifying top genes by importance), model training on 70% of data for validation, and final prediction on the full test set.
    *   **`plotConfusionMatrix`**: Generates a visually formatted dot-plot style confusion matrix to evaluate mapping performance between predicted and actual cell identity labels.

### 3. Data Flow
*   **Input**: Takes `AnnData` objects for training and testing, along with dictionaries mapping cluster IDs to numeric labels.
*   **Processing**: 
    *   Subsamples training and testing data to manage class imbalance.
    *   Calculates gene importance scores via initial XGBoost runs to select the top 500 shared features.
    *   Performs multi-class classification using `multi:softprob`.
*   **Output**: Returns predicted labels for the test dataset and generated matplotlib figures (confusion matrices).

### 4. Dependencies
*   **Scientific stack**: `numpy`, `pandas`, `scipy`, `seaborn`, `matplotlib`.
*   **Machine Learning**: `xgboost`, `sklearn` (metrics, preprocessing).
*   **Single-cell Analysis**: `scanpy`.
*   **Visualization**: `plotly`.

### 5. Analysis Methods
*   **XGBoost Multi-class Classification**: Uses gradient boosted trees to map cellular identities.
*   **Feature Selection**: Performs feature selection based on the "gain" metric derived from preliminary XGBoost runs.
*   **Bootstrapping**: Implements oversampling for classes with fewer than 100 cells to ensure model stability.
*   **Softmax Probability Thresholding**: Uses a probability threshold ($1.1 \times 1/N_{classes}$) to assign cells to an "Unassigned" category if the model is uncertain.

### 6. Figures/Outputs
*   **Confusion Matrices**: Custom-rendered dot-plot matrices displaying mapping accuracy, precision, or recall, formatted via `matplotlib.gridspec` to include legends for dot size.

### 7. Key Parameters
*   **`max_cells_per_ident`**: Limits the number of cells per cluster (default: 700) to balance the input.
*   **`train_frac`**: Fraction of data used for training vs. validation (default: 0.7).
*   **`num_boost_round`**: Number of boosting iterations (set to 200).
*   **`eta` / `max_depth`**: XGBoost hyperparameters (0.2 and 6, respectively).

---

## 6-SupervisedClassification/ActivityMapping/Type_NonNeuron_DR_DL.ipynb

### Analysis Summary: `Type_NonNeuron_DR_DL.ipynb`

#### 1. Purpose
This file provides a structured framework for supervised classification of single-cell RNA-seq data using XGBoost. It maps cell types between different datasets by training a classifier to identify shared genetic features and predict cell identities, including an "unassigned" category for low-confidence classifications.

#### 2. Key Functions/Classes
*   **`TimeMapping` (Class)**: Encapsulates the entire workflow for supervised classification and visualization.
    *   **`xgbclassifier`**: Performs feature selection (via gain-based importance), model training on subsets of data, validation against a hold-out set, and final prediction on test data.
    *   **`plotConfusionMatrix`**: Generates a standardized, high-quality "dot plot" confusion matrix to visualize the accuracy of cell type mapping and identify misclassifications.

#### 3. Data Flow
*   **Input**: Takes two `AnnData` objects (training and testing sets) and two dictionaries mapping cluster labels to numerical indices.
*   **Processing**: 
    *   Downsamples/bootstraps training data for balance.
    *   Identifies the top 500 intersectional genes (features) based on importance scores from preliminary XGBoost models.
    *   Executes a 70/30 train/validation split.
    *   Computes final predictions with a confidence threshold (1.1 * 1/number of classes) to assign labels or mark cells as "Unassigned."
*   **Output**: Returns validation results and test set predictions; generates visualization plots.

#### 4. Dependencies
*   **Machine Learning**: `xgboost`, `sklearn` (confusion matrix, ROC/AUC, metrics).
*   **Data Handling/Analysis**: `numpy`, `pandas`, `scipy.stats`, `scanpy`.
*   **Visualization**: `matplotlib`, `seaborn`, `plotly`.

#### 5. Analysis Methods
*   **Supervised Learning**: Gradient Boosting (XGBoost) with `multi:softprob` objective for multi-class classification.
*   **Feature Engineering**: Gain-based feature selection to prioritize the most informative genes.
*   **Statistical Thresholding**: Implements a custom threshold for prediction confidence to handle potential out-of-distribution or ambiguous cells (labeling them "Unassigned").
*   **Bootstrapping**: Used to ensure a minimum of 100 cells per identity during training.

#### 6. Figures/Outputs
*   **Confusion Matrices**: Custom dot-plot visualizations (using `matplotlib.gridspec`) that show fractional accuracy of assignments, comparing true labels against predicted labels.
*   **Classification Metrics**: The code imports but suggests potential integration for `classification_report`, `f1_score`, and `cohen_kappa_score` to evaluate model performance.

#### 7. Key Parameters
*   **`max_cells_per_ident`**: Limits the number of cells per identity (default 700) to control memory and bias.
*   **`train_frac`**: Fraction of data used for training (default 0.7).
*   **`nround`**: Number of boosting rounds (fixed at 200).
*   **`max_depth`**: Tree depth for the XGBoost model (fixed at 6).
*   **Confidence Multiplier**: Hard-coded as `1.1` relative to the baseline probability ($1/N_{classes}$) to determine "Unassigned" labels.

---

## 6-SupervisedClassification/MappingV1toTasic2018.ipynb

This file, `MappingV1toTasic2018.ipynb`, provides a programmatic pipeline for mapping single-cell transcriptomic datasets to a reference atlas using supervised machine learning.

### 1. Purpose
The file implements a classification framework using XGBoost to map cell identities from a test dataset onto a reference (Tasic 2018) training dataset. It automates feature selection, model training, validation, and performance visualization.

### 2. Key Functions/Classes
*   **`Tasic2018Mapping` Class**: Encapsulates the entire workflow.
    *   **`xgbclassifier`**: Handles data sampling (balancing classes), feature selection (identifying top genes by importance), training the XGBoost model, and predicting cluster labels for the test set.
    *   **`plotConfusionMatrix`**: Generates a dot-plot style visualization of the classification accuracy (confusion matrix) to evaluate how well the test data maps to reference classes.

### 3. Data Flow
*   **Inputs**: Requires two `AnnData` objects (`train_anndata`, `test_anndata`) and associated dictionaries (`train_dict`, `test_dict`) mapping categorical identities to integers.
*   **Processing**: Performs feature selection based on "gain" scores, trains on 70% of the reference data for validation, and performs final training on the full reference dataset to classify the test set.
*   **Outputs**: Writes selected top-contributing genes to a CSV file and saves the trained XGBoost model as a `pickle` file.

### 4. Dependencies
*   **General**: `numpy`, `pandas`, `scipy.stats`, `matplotlib`, `seaborn`.
*   **Bioinformatics**: `scanpy` (for single-cell data structure handling).
*   **Machine Learning**: `xgboost` (the core classifier), `sklearn.metrics` (for model evaluation).

### 5. Analysis Methods
*   **Supervised Learning**: XGBoost (Extreme Gradient Boosting) using `multi:softprob` objective for multi-class classification.
*   **Bootstrap Resampling**: Used to handle small clusters by oversampling if an identity has fewer than 100 cells.
*   **Feature Importance**: Uses XGBoost's `get_score(importance_type="gain")` to select the top 500 features (genes) common between datasets.
*   **Confidence Thresholding**: Assigns cells to an "Unassigned" class if the maximum prediction probability does not exceed a calculated threshold ($1.2 \times 1/N_{classes}$).

### 6. Figures/Outputs
*   **Confusion Matrix Plot**: A custom-formatted dot plot where circle size corresponds to the percentage of cells mapped to specific clusters, including an "Unassigned" category.
*   **Data Files**:
    *   `Tasic2018Mapping_intron_grouped_comtopgenes.csv` (feature list).
    *   `Tasic2018Mapping_intron_grouped_fullmodel.pickle.dat` (trained model).

### 7. Key Parameters
*   `max_cells_per_ident`: Caps the number of cells used per identity (default 700).
*   `train_frac`: Defines the training/validation split ratio (default 0.7).
*   `nround`: Number of boosting iterations (set to 200).
*   `eta` / `max_depth`: XGBoost hyper-parameters controlling learning rate and tree complexity.

---

## 6-SupervisedClassification/TemporalMapping/GABA_ARI_Subclass_Analysis.ipynb

This analysis covers the provided Jupyter Notebook file (`GABA_ARI_Subclass_Analysis.ipynb`).

### 1. Purpose
The file implements a supervised machine learning workflow using **XGBoost** to perform temporal mapping and cross-dataset classification of single-cell RNA sequencing (scRNA-seq) data. It specifically maps cell types between different experimental or temporal conditions and provides visualization tools to assess classification accuracy via confusion matrices.

### 2. Key Functions/Classes
*   **`TimeMapping` (Class):** Encapsulates the entire workflow for scRNA-seq classification.
    *   **`xgbclassifier`:** Performs feature selection (identifying top 500 gene contributors), trains the XGBoost model on a subset (70%) of training data for validation, and applies the final model to map testing data labels.
    *   **`plotConfusionMatrix`:** Visualizes classification performance by creating a "dot plot" style confusion matrix, mapping predicted versus true cell identity labels.

### 3. Data Flow
*   **Input:** Accepts two `AnnData` objects (training and testing sets) and two dictionaries mapping string-based cell type labels to numeric indices.
*   **Processing:** 
    *   Subsamples training and testing data (up to 700 cells per identity).
    *   Bootstrap oversampling for classes with fewer than 100 cells.
    *   Calculates gene importance scores using XGBoost to subset shared features.
*   **Output:** Generates predicted labels for the test set and visual confusion matrix figures.

### 4. Dependencies
*   **Core Libraries:** `numpy`, `pandas`, `scipy`, `matplotlib`, `seaborn`.
*   **ML/Bioinformatics:** `xgboost` (gradient boosting), `scanpy` (scRNA-seq analysis), `sklearn` (metrics: confusion matrix, F1 score, etc.).

### 5. Analysis Methods
*   **Gradient Boosting:** Uses `xgb.train` with `multi:softprob` objective for multi-class classification.
*   **Feature Selection:** Identifies highly informative genes by comparing the top 500 features (ranked by 'gain' importance) common to both training and testing datasets.
*   **Validation:** Uses an F1-score-based evaluation on a hold-out 30% segment of the training data.
*   **Label Mapping:** Implements a probability thresholding system—predictions below a certain confidence score (1.1 * 1/num_classes) are classified as "Unassigned."

### 6. Figures/Outputs
*   **Confusion Matrix Plots:** Custom dot-plot heatmaps visualizing the correspondence between true labels (rows) and predicted labels (columns) using `matplotlib.gridspec`. These plots feature custom legends for circle size representing the percentage of cells classified into a category.

### 7. Key Parameters
*   `max_cells_per_ident`: Caps the number of cells per identity at 700 to ensure balanced training.
*   `train_frac`: The proportion of data used for training (0.7).
*   `nround`: Number of boosting rounds (set to 200).
*   `max_depth`: XGBoost tree depth (set to 6).
*   `eta`: Learning rate for the XGBoost model (set to 0.2).

---

## 6-SupervisedClassification/TemporalMapping/GABA_Sankey.ipynb

This file is a Jupyter Notebook used for supervised classification and temporal mapping of single-cell RNA sequencing (scRNA-seq) data using XGBoost.

### 1. Purpose
This notebook implements an automated pipeline to classify cell types across different temporal or experimental conditions. It uses XGBoost to perform feature selection (identifying top genes) and trains a classification model to map cell identities between datasets.

### 2. Key Functions/Classes
*   **`xgbtrain()`**: A standalone function that performs basic feature selection and validates the model on a single dataset using an 80/20 train/test split.
*   **`TimeMapping` (class)**: A wrapper class designed to handle cross-dataset mapping.
    *   **`xgbclassifier()`**: Performs feature selection on both training and testing datasets, identifies "common top genes," trains the model on the training data, validates it, and prepares for inference on the test dataset.

### 3. Data Flow
*   **Input**: Takes `AnnData` objects (standard scRNA-seq data format) for both training and testing sets, along with dictionaries mapping cell type labels to numeric values.
*   **Processing**: 
    1. Subsamples cells per identity to balance training.
    2. Uses XGBoost to rank gene importance (`gain`).
    3. Intersects the top 500 genes from both datasets to create a common feature set.
    4. Trains an XGBoost classifier on the training set and evaluates it using F1-score on a validation subset.
*   **Output**: Trained XGBoost model components and performance metrics (F1-scores, predicted labels).

### 4. Dependencies
*   **Core Scientific**: `scanpy`, `numpy`, `pandas`, `scipy`, `seaborn`, `matplotlib`.
*   **Machine Learning**: `xgboost`, `scikit-learn` (for metrics like `f1_score`, `confusion_matrix`, `roc_curve`).
*   **Visualization**: `plotly`.
*   **Environment**: Google Colab (mounting Drive, installing `orca` for plot exports).

### 5. Analysis Methods
*   **Feature Selection**: Ranking features by "gain" in an XGBoost model and selecting the top 500 features.
*   **Supervised Learning**: Multiclass gradient boosting (`multi:softprob` objective).
*   **Resampling**: Bootstrapping/oversampling identities with fewer than 100 cells to ensure model stability.
*   **Validation**: 70/30 training/validation split to assess classification performance before full model training.

### 6. Figures/Outputs
*   **Metrics**: Classification reports, Cohen's Kappa, and F1-scores.
*   **Visualization**: The file intends to produce **Sankey diagrams** (inferred from the filename `GABA_Sankey.ipynb`) to visualize the flow/mapping of cell populations between experimental conditions or time points.

### 7. Key Parameters
*   `max_cells_per_ident` (Default: 700): Limits the number of cells per cell type to prevent over-representation of specific clusters.
*   `train_frac` (Default: 0.7): Proportion of data used for training vs. validation.
*   `eta` (0.2): Learning rate for XGBoost.
*   `max_depth` (6): Tree depth for the booster.
*   `nround` (200): Number of boosting rounds.

---

## 6-SupervisedClassification/TemporalMapping/GLUT_ARI_Layer_Analysis.ipynb

This file contains a Python class definition for performing temporal mapping of single-cell RNA sequencing (scRNA-seq) data using XGBoost.

### 1. Purpose
The script defines a machine learning pipeline (`TimeMapping`) designed to train an XGBoost classifier on scRNA-seq datasets to map cell states across different time points or experimental conditions, including feature selection and performance visualization.

### 2. Key Functions/Classes
*   **`TimeMapping` (Class)**: Encapsulates the classification workflow.
*   **`xgbclassifier(...)`**: The core method; performs feature selection (identifying top genes), splits data into training/validation sets, trains the XGBoost model, and predicts cell labels for test datasets.
*   **`plotConfusionMatrix(...)`**: A visualization utility that generates a dot-plot style confusion matrix to assess classification accuracy and mapping performance between experimental clusters.

### 3. Data Flow
*   **Inputs**: Expects two `AnnData` objects (`train_anndata`, `test_anndata`) containing expression matrices and cell type annotations, along with dictionaries (`train_dict`, `test_dict`) to map labels to numerical values.
*   **Processing**:
    1. Downsamples/bootstraps cell types to balance classes.
    2. Trains initial models on both datasets to select the top 500 features (genes) based on "gain" importance.
    3. Retrains a final model on training data and predicts on testing data.
*   **Outputs**: Returns true/predicted labels for validation and testing; saves visualization plots as images.

### 4. Dependencies
*   **Machine Learning/Stats**: `xgboost`, `scikit-learn` (`confusion_matrix`, `f1_score`, etc.), `numpy`, `pandas`, `scipy`.
*   **Single-Cell Analysis**: `scanpy`.
*   **Visualization**: `matplotlib`, `seaborn`, `plotly`.

### 5. Analysis Methods
*   **XGBoost Classification**: Uses Gradient Boosted Trees with the `multi:softprob` objective for multi-class classification.
*   **Feature Selection**: Filters the feature space by selecting the top 500 genes common to both training and testing datasets based on model gain importance.
*   **Probability Thresholding**: Implements a confidence threshold in predictions (`1.1 * (1/num_classes)`); if a cell's maximum prediction probability does not exceed this, it is categorized as "Unassigned."
*   **Class Balancing**: Uses random sampling and bootstrapping to ensure at least 100 cells per identity during training.

### 6. Figures/Outputs
*   **Confusion Matrices**: Generates high-customization dot plots (using `matplotlib.gridspec`) representing prediction accuracy, where dot size corresponds to the fraction of cells correctly mapped.

### 7. Key Parameters
*   **`max_cells_per_ident`**: Maximum number of cells used per identity (default 700).
*   **`train_frac`**: Fraction of data used for training (default 0.7).
*   **`nround`**: Number of boosting iterations (set to 200).
*   **XGBoost Params**: `eta` (0.2), `max_depth` (6), and `subsample` (0.6).

---

## 6-SupervisedClassification/TemporalMapping/GLUT_Sankey.ipynb

This analysis pertains to the `GLUT_Sankey.ipynb` file, which is part of a workflow for supervised temporal mapping of single-cell RNA-seq data using gradient boosting.

### 1. Purpose
The file implements a supervised machine learning pipeline using XGBoost to classify and map cell states between two different temporal or experimental datasets. It focuses on feature selection (identifying common influential genes) to enable cross-dataset cell type prediction.

### 2. Key Functions/Classes
*   `xgbtrain()`: A standalone function designed for model training, feature importance extraction, and validation using an `anndata` object.
*   `TimeMapping` (Class): A comprehensive wrapper class that performs:
    *   `xgbclassifier()`: Handles full workflow logic including feature intersection, training on partitioned data (70/30 split), model validation via F1-scores, and final inference on testing data.

### 3. Data Flow
*   **Input**: Takes two `anndata` objects (training and testing sets) along with dictionaries mapping original cluster/type labels to numeric labels.
*   **Processing**:
    1.  Subsamples data per cell type (up to 700 cells) and performs bootstrap resampling for classes with <100 cells.
    2.  Trains initial XGBoost models on each dataset separately to identify the top 500 features (genes) based on "gain" scores.
    3.  Intersects feature sets to find common genes for model transfer.
    4.  Trains a final model on the full training set and predicts labels for the testing set.
*   **Output**: Returns validation metrics (F1 scores) and prediction labels for the testing dataset.

### 4. Dependencies
*   **Data/ML Frameworks**: `scanpy` (for single-cell handling), `xgboost` (the core learner), `sklearn` (for metrics and preprocessing), `numpy`, `pandas`.
*   **Visualization**: `matplotlib`, `seaborn`, `plotly` (suggested by library imports).

### 5. Analysis Methods
*   **Gradient Boosting**: Uses `multi:softprob` as the objective function for multi-class probability prediction.
*   **Feature Selection**: Rank-based selection of top 500 features via XGBoost `gain` importance metrics.
*   **Cross-Validation Strategy**: 70/30 training-validation split to assess model performance before full-data training.
*   **Metrics**: Uses F1-score for evaluation of classification performance per category.

### 6. Figures/Outputs
*   While the code is truncated, the import of `plotly.graph_objects` and the filename (`GLUT_Sankey.ipynb`) imply that the downstream cells generate **Sankey diagrams** to visualize the flow/mapping of cell types from the training dataset to the testing dataset.

### 7. Key Parameters
*   `max_cells_per_ident`: Cap on the number of cells per identity (default 700).
*   `train_frac`: Proportion of data used for training vs. validation (default 0.7).
*   `nround`: Number of boosting rounds (fixed at 200).
*   `max_depth`: Complexity of the decision trees (fixed at 6).
*   `eta`: Learning rate for XGBoost (fixed at 0.2).

---

## 6-SupervisedClassification/TemporalMapping/NonNeuron_ARI_Subclass_Analysis.ipynb

This analysis summarizes the provided Jupyter Notebook file (`NonNeuron_ARI_Subclass_Analysis.ipynb`).

### 1. Purpose
The file provides a reusable framework for mapping cell types across different datasets (e.g., temporal or experimental conditions) using XGBoost classifiers. It facilitates feature selection, model training, validation, and performance visualization for single-cell transcriptomic data.

### 2. Key Functions/Classes
*   **`TimeMapping` (Class)**: Encapsulates the entire workflow for supervised cell type classification.
    *   **`xgbclassifier`**: Handles data preprocessing (subsetting/bootstrapping), feature selection based on XGBoost gain importance, model training, and cell type prediction.
    *   **`plotConfusionMatrix`**: Generates a visually formatted dot-plot style confusion matrix to evaluate classification accuracy between ground truth labels and predicted types.

### 3. Data Flow
*   **Input**: Takes two `AnnData` objects (`train_anndata`, `test_anndata`) and their respective dictionary mappings (`train_dict`, `test_dict`).
*   **Processing**:
    *   Subsamples training and testing data to handle class imbalance (applying bootstrapping for small classes).
    *   Trains preliminary models on training and testing sets independently to identify top 500 common features.
    *   Performs a 70/30 train/test split within the training data for internal validation.
    *   Trains a final model on the full training dataset to predict labels on the external testing dataset.
*   **Output**: Returns validation/prediction vectors and generates matplotlib-based confusion matrix figures.

### 4. Dependencies
*   **Core Libraries**: `numpy`, `pandas`, `xgboost`, `scikit-learn` (for metrics and preprocessing), `scanpy`.
*   **Visualization**: `matplotlib`, `seaborn`, `plotly`.
*   **Scientific**: `scipy`.

### 5. Analysis Methods
*   **Supervised Learning**: Gradient Boosting (XGBoost) using `multi:softprob` objective for multi-class classification.
*   **Feature Selection**: Recursive or ranking-based selection of top features (up to 500) based on "gain" importance across both datasets.
*   **Performance Metrics**: Uses F1-score for validation and creates confusion matrices normalized by row (percent-based) to visualize classification performance.
*   **Bootstrapping**: Implemented to ensure minority classes have sufficient representation (minimum 100 cells) during training.

### 6. Figures/Outputs
*   **Confusion Matrix**: A specialized dot-plot visualization where circle size represents the percentage of correctly classified cells. It includes custom layout settings using `matplotlib.gridspec` to accommodate legend elements and labels.

### 7. Key Parameters
*   `max_cells_per_ident`: Caps the number of cells per identity for training (default: 700) to balance computational load.
*   `train_frac`: Fraction of data used for training vs. validation (default: 0.7).
*   `eta` & `max_depth`: XGBoost hyperparameters (0.2 and 6, respectively).
*   `nround`: Number of boosting iterations (200).
*   **Probability Thresholding**: The prediction logic applies a threshold (1.1 * 1/num_classes) to assign cells to "Unassigned" if the confidence is low.

---

## 6-SupervisedClassification/TemporalMapping/NonNeurons_Sankey.ipynb

This file is a Jupyter Notebook used for the temporal mapping of non-neuronal cell types across various developmental stages using supervised machine learning.

### 1. Purpose
The script performs supervised classification of scRNA-seq data to map cell populations between different developmental time points (P8 to P38). It utilizes XGBoost to train a classifier on specific cell types and predicts the identity of cells in subsequent time points, assessing the "temporal lineage" or stability of cell states.

### 2. Key Functions/Classes
*   **`TimeMapping` class**: A container for the analytical workflow.
    *   **`xgbclassifier`**: Handles the full machine learning pipeline, including feature selection (using XGBoost gain scores), data splitting (training/validation), model training, and cell-type prediction.
    *   **`plotConfusionMatrix`**: Generates dot-plot visualizations of confusion matrices to evaluate the accuracy and "leakage" of classification predictions between time points.

### 3. Data Flow
*   **Inputs**: Reads multiple `.h5ad` (Scanpy Anndata) files: `P8_non_analyzed.h5ad` through `P38_non_analyzed.h5ad`.
*   **Processing**: Extracts raw gene expression counts from `anndata.raw.X`, performs cell subsetting/sampling, identifies top gene features via XGBoost gain metrics, trains classifiers, and performs class prediction.
*   **Outputs**: Generates performance metrics (F1-score) and visualization plots (heatmap-style confusion matrices).

### 4. Dependencies
*   **Core Scientific**: `numpy`, `pandas`, `scipy.stats`, `scanpy`.
*   **Machine Learning**: `xgboost`, `sklearn` (confusion matrix, metrics, preprocessing).
*   **Visualization**: `matplotlib`, `seaborn`, `plotly`.

### 5. Analysis Methods
*   **Supervised Learning**: XGBoost gradient boosting classifier with a `multi:softprob` objective.
*   **Feature Selection**: Ranking genes by "gain" importance; only the top 500 common features identified in both training and testing datasets are used for the final model.
*   **Validation**: Uses a 70/30 split of the training data for internal validation and calculates F1-scores to assess model performance before applying it to the test set.
*   **Handling Unassigned States**: Implements a confidence threshold (1.1 * 1/number_of_classes) to classify cells as "Unassigned" if the model prediction probability is too low.

### 6. Figures/Outputs
*   **Confusion Matrix Heatmaps**: Dot-plot visualizations where dot size represents the fraction of cells classified into a specific identity, facilitating the comparison of ground-truth labels vs. predicted labels.

### 7. Key Parameters
*   **`max_cells_per_ident`**: Limits the number of cells per identity to 700 to prevent class imbalance.
*   **`train_frac`**: Sets the fraction of data used for training (default 0.7).
*   **`nround`**: Number of boosting iterations (set to 200).
*   **`xgb_params`**: Model hyperparameters including `eta` (0.2), `max_depth` (6), and `subsample` (0.6).

---

## 7-Misc/Combining_AnnData.ipynb

This file, `Combining_AnnData.ipynb`, is a data preprocessing notebook designed to merge multiple single-cell RNA sequencing (scRNA-seq) datasets across different developmental stages and cell types into a unified `AnnData` object for downstream analysis.

### 1. Purpose
The notebook serves as a data integration pipeline to consolidate individual GABAergic, glial, and glutamatergic scRNA-seq datasets into a single, cleaned master file, while normalizing metadata (cell types and developmental ages) and removing redundant preprocessing artifacts.

### 2. Key Functions/Classes
*   `addSubclass(adata)`: A helper function that copies the values from the `Class_broad` column in the observation metadata to a new `Subclass` column.

### 3. Data Flow
*   **Reads**: Loads multiple `.h5ad` files representing different developmental time points (P8, P14, P17, P21, P28, P38) for GABAergic, Glial, and Glutamatergic neuronal populations.
*   **Processes**: 
    *   Subsamples glial datasets to a target count.
    *   Concatenates files via `scanpy`'s `.concatenate()` method.
    *   Refines metadata by assigning broad classifications (grouping various non-neuronal cells into "Glia") and extracting "Age" from sample naming conventions.
    *   Cleans `adata.var` and `adata.obs` by deleting residual batch-specific statistics (e.g., highly variable gene flags, mean/dispersion values from previous individual analyses).
*   **Writes**: Exports intermediate objects (`gaba_glia_full.h5ad`) and the final unified master object (`gluta_gaba_glia_combined.h5ad`).

### 4. Dependencies
*   **Core Scientific Libraries**: `scanpy`, `numpy`, `pandas`, `seaborn`, `scipy.stats`, `matplotlib`, `xgboost`, `sklearn` (metrics), and `pickle`.

### 5. Analysis Methods
*   **Data Integration**: Merging heterogeneous datasets using `anndata.concatenate`.
*   **Subsampling**: Random undersampling of glial datasets using `sc.pp.subsample` to manage class imbalance or dataset size.
*   **Categorical Mapping**: Re-assignment of metadata labels (e.g., mapping specific classes to a broader "Glia" category).
*   **Data Cleanup**: Systematic removal of redundant or legacy metadata/statistical variables generated during independent processing stages.

### 6. Figures/Outputs
*   **Primary Output**: `gluta_gaba_glia_combined.h5ad` (a unified single-cell dataset).
*   **Console Output**: Prints length of observation metadata (`len(adata.obs)`) to verify cell counts after merging/subsampling.

### 7. Key Parameters
*   **Target Subsample Size**: Hardcoded logic for glial cells: `3000/len(adata.obs)`.
*   **Path Variables**: Assumes the existence of global paths `path_gaba` and `path_glia` (defined outside the visible snippet).
*   **Deletion Lists**: Large hardcoded lists of variable names (`adata.var`) to be pruned during the cleaning process.

---

## 7-Misc/Figure1D.ipynb

This file, `7-Misc/Figure1D.ipynb`, is a Jupyter Notebook used for the visualization and exploratory analysis of single-cell RNA sequencing (scRNA-seq) data, specifically focusing on generating UMAP embeddings to display cell classes, subclasses, and developmental stages (Age) across various brain cell populations.

### 1. Purpose
The notebook performs quality control, dimensionality reduction, and visualization of scRNA-seq datasets. It aggregates multiple cell types (GABAergic, Glutamatergic, and Glial) to produce figures that illustrate the cell landscape and developmental progression (P8–P38) of the samples.

### 2. Key Functions/Classes
*   **`scanpy` (sc)**: Primary library for single-cell analysis.
    *   `sc.pp.highly_variable_genes`: Selects informative genes.
    *   `sc.tl.pca`: Reduces dimensionality using Principal Component Analysis.
    *   `sc.pp.neighbors`: Computes the neighborhood graph for clustering and manifold learning.
    *   `sc.tl.umap`: Computes UMAP embeddings for visualization.
    *   `sc.pl.umap`: Plots UMAP projections.
*   **`harmony.harmonize`**: Used (in some cells) to integrate datasets and mitigate batch effects between samples.

### 3. Data Flow
*   **Input**: Reads `.h5ad` (AnnData) files (e.g., `gluta_gaba_glia_3000_combined.h5ad` and `gluta_gaba_glia_combined.h5ad`).
*   **Processing**:
    1.  Loads raw count data from `.raw.X`.
    2.  Performs feature selection (HVGs), scaling, PCA, and neighborhood computation.
    3.  Filters out "Ambiguous" or "nan" annotations.
    4.  Relabels categories (grouping astrocyte/endothelial/microglia/OPCs/oligodendrocytes/VLMCs as "Glia").
*   **Output**: Generates visualization plots, some of which are saved as `.pdf` files.

### 4. Dependencies
*   **Core Libraries**: `scanpy`, `anndata`, `pandas`, `numpy`, `matplotlib`, `seaborn`, `scipy`, `scikit-learn`.
*   **Specific Tools**: `harmony` (for batch integration), `bbknn`, `scanorama` (imported but not used in final code blocks).

### 5. Analysis Methods
*   **Dimensionality Reduction**: PCA followed by UMAP.
*   **Batch Correction**: Optional integration via Harmony to reduce variance between age groups or samples.
*   **Data Aggregation**: Categorical re-assignment to simplify cell class labels for visualization.
*   **Filtering**: Filtering by data quality and categorical labels.

### 6. Figures/Outputs
*   **UMAP Plots**: Visualization of cells colored by `Age`, `Subclass`, or grouped `Class` (Glia vs. others).
*   **File Exports**: Saved PDF figures for publication (e.g., `_1Ecenter_class.pdf`, `_1Ecenter_age.pdf`, `_1E_P8.pdf`).

### 7. Key Parameters
*   **HVGs**: `min_mean=0.0125`, `max_mean=3`, `min_disp=0.5`.
*   **PCA Solver**: `arpack`.
*   **Neighbor Search**: `n_neighbors=25`.
*   **Scaling**: `max_value=10`.

---

## 7-Misc/psuedo-SpatiotemporalAnalysis.ipynb

This analysis covers the provided Jupyter notebook, which appears to be part of a single-cell RNA sequencing (scRNA-seq) study focusing on spatiotemporal gradients of gene expression in neuronal populations.

### 1. Purpose
The file performs a spatiotemporal analysis of gene expression gradients across different neuronal sub-types (L2/3) in mouse brain samples. It calculates differential expression and clusters genes into regulatory modules to visualize gene expression patterns across predefined spatial or developmental conditions.

### 2. Key Functions/Classes
*   **`DE`**: Calculates differential expression using Wilcoxon rank-sum tests and filters genes based on a percentage threshold (`pts_thresh`).
*   **`compute_egt`**: Computes an expression gradient score (`Egt`) for genes by multiplying the fraction of non-zero cells by the mean expression level in each condition.
*   **`scatter`**: Generates line plots comparing the normalized expression gradients of selected genes against a background of all other genes.
*   **`clust_genes`**: Uses the Elbow Method with K-Means to determine the optimal number of clusters for gene expression profiles.
*   **`kmeans_and_plot_and_mod`**: Performs K-Means clustering on Z-scored expression gradients, visualizes cluster sizes, generates heatmaps, and returns gene lists grouped by cluster.

### 3. Data Flow
*   **Input**: Reads `.h5ad` files (Anndata objects) containing scRNA-seq data from various conditions (NR: Normal Rearing, DR: Dark Rearing, DL: Dark Light exposure).
*   **Processing**:
    *   Subsets objects based on neuronal type (`L2/3_A`, `B`, `C`, etc.).
    *   Concatenates data from multiple conditions.
    *   Calculates expression gradients (`Egt`) stored in `adata.varm`.
    *   Clusters genes into modules using K-Means.
*   **Output**: Generates heatmaps of Z-scored expression gradients, violin plots for specific gene expression, and stacked violin plots for visual comparison across conditions.

### 4. Dependencies
*   **Core Data/Scientific**: `scanpy`, `numpy`, `scipy`, `pandas`.
*   **Integration/Clustering**: `bbknn`, `scanorama`, `harmony`, `sklearn`.
*   **Visualization**: `matplotlib`, `seaborn`.

### 5. Analysis Methods
*   **Differential Expression**: Wilcoxon rank-sum test via `scanpy`.
*   **Clustering**: K-Means clustering of gene expression profiles across defined conditions.
*   **Normalization**: Z-score transformation for heatmap visualization and comparative expression profiles.
*   **Gradient Computation**: Custom heuristic (`Egt`) combining detection frequency and average expression intensity.

### 6. Figures/Outputs
*   **Heatmaps**: Visualizes grouped gene expression clusters across L2/3 sub-types (e.g., `heatmap_A.pdf`, `heatmap_C.pdf`).
*   **Violin Plots**: Comparison of expression levels across conditions (NR vs. DR).
*   **Stacked Violin Plots**: Summary plot of A, B, and C modules (`ABCandCBA.pdf`).
*   **Elbow Plots**: Used to optimize K-Means clustering.

### 7. Key Parameters
*   **`pts_thresh`**: Percentage threshold for filtering genes in differential expression analysis (e.g., 0.3).
*   **`n_clusters`**: Number of clusters for K-Means (set to 4 in several instances).
*   **`obs_id`**: Identifier for cell sub-types/conditions within the Anndata object.
*   **`method`**: Set to `'wilcoxon'` for differential gene expression.

---

## README.md

This file serves as the documentation/landing page for the research repository associated with the study "Vision-dependent specification of cell types and function in the developing cortex."

### 1. Purpose
This `README.md` file provides essential context, access links to supplementary data, and contact information for a repository containing code used to analyze single-nucleus RNA-seq (snRNA-seq) data from the corresponding Cell publication. It serves as a guide for researchers to locate the study's primary dataset and processing pipelines.

### 2. Key Functions/Classes
*   **Not Applicable:** As this is a `README.md` file, it does not contain executable code, functions, or classes. It acts as a metadata reference document.

### 3. Data Flow
*   **Input:** The repository provides pointers to external data sources, specifically `h5ad` files (Anndata objects) containing normalized, log-transformed expression data, and a directory containing raw count matrices.
*   **Process:** The codebase in this repository is intended to process these snRNA-seq files.
*   **Output:** The repository produces the analyses and visualizations presented in the associated manuscript.

### 4. Dependencies
*   **External/Data-related:** Broad Institute Single Cell Portal (SCP) for visualization and Google Drive for raw/processed data storage. 
*   **Software Dependencies:** Not explicitly listed in the README, but the use of `.h5ad` files strongly implies a dependency on the **Scanpy** ecosystem and **Python/PyData** stack.

### 5. Analysis Methods
*   **Methodology:** The repository implements analysis workflows for **snRNA-seq** (Single-nucleus RNA sequencing).
*   **Scope:** Based on the metadata mentioned (Sample, Age, Class, Subclass, Type), the methods involve single-cell transcriptomic profiling, cell-type annotation, and developmental trajectory analysis.

### 6. Figures/Outputs
*   **Visualization:** The repository links to the Broad Institute's Single Cell Portal (SCP1664) for interactive data exploration.
*   **Datasets:** Finalized `h5ad` objects (processed data) and raw count directories are provided as primary research outputs.

### 7. Key Parameters
*   **Metadata Fields:** The analysis relies on specific metadata identifiers: `Sample`, `Age`, `Class`, `Subclass`, and `Type`.
*   **Data Transformation:** The standard input datasets are explicitly noted as being **normalized** and **log-transformed**.

---

