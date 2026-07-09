# Repository Context for _To_characterize_the_temporal_dynamics_of_unique_cell-type_c

To provide a precise mapping, I have structured this response based on the **standard analytical framework** used in studies like *Yao et al. (2021)* regarding the Mouse Visual Cortex. 

**Note:** As you did not provide the specific repository files, I have utilized the directory structure and naming conventions typical of these developmental projects (e.g., Allen Institute's `abc_atlas_access`, `seurat-analysis-pipelines`, or similar). **Please paste the file list if you wish for me to map these to your specific repository.**

---

### 1. Relevant Files (Ranked by Relevance)

| Priority | File Name (Pattern) | Purpose |
| :--- | :--- | :--- |
| **HIGH** | `03_clustering_across_ages.R/ipynb` | Contains the primary integration logic (Harmony/Seurat) to ensure cluster comparability across P-stages. |
| **HIGH** | `analysis_temporal_diversity.R` | Calculates the count of unique clusters/subclusters per developmental time point. |
| **MEDIUM** | `config_resolution_params.yaml` | Essential for confirming the clustering resolution is consistent, preventing artifactual cluster inflation. |
| **MEDIUM** | `plot_developmental_trajectories.R` | Generates the line/bar graphs comparing cell-type counts vs. age. |
| **LOW** | `preprocess_metadata.R` | Handles the mapping of `Cell_ID` to `Age` metadata. |

### 2. Code Execution Order
1.  **Normalization & Integration:** `preprocess_metadata.R` → `03_clustering_across_ages.R`. (Must ensure all ages are in the same embedding space).
2.  **Cluster Definition:** Run clustering at a **fixed resolution** across the integrated object.
3.  **Diversity Extraction:** `analysis_temporal_diversity.R` (group by `age`, count `unique(cluster_id)`).
4.  **Visualization:** `plot_developmental_trajectories.R` (creating the final plots showing the trendline of diversity).

### 3. Key Code Patterns
*   **Resolution Standardization:** 
    `FindClusters(object, resolution = 0.8)`—Look for this parameter being kept identical across all subsets or the full object to ensure the comparison is valid.
*   **Grouping Logic:** 
    `table(metadata$cluster, metadata$age)` or `dplyr::summarise(n_distinct(cluster_id))` grouped by `developmental_age`.
*   **Temporal Stability Check:** 
    Code measuring the "Jaccard similarity" or "correlation" of cluster centroids between adjacent time points (e.g., P7 vs P14) to see if identity persists.

### 4. Data Files Referenced
*   **Integrated Object:** `integrated_scRNAseq_visual_cortex.rds` (The master file containing all cells and developmental time points).
*   **Annotation Table:** `cell_metadata_curated.csv` (Must contain columns: `CellID`, `ClusterID`, `SubclusterID`, `Age`).
*   **Marker Lists:** `cluster_markers_per_age.csv` (Used to validate if "new" clusters are biologically distinct types or just maturation stages).

### 5. Missing Pieces
To fully validate the "dynamics" of cell-type counts, check if your repository includes:
1.  **Downsampling Script:** If one time point has significantly more cells than another, the number of clusters will be biased unless you downsample to the smallest age. Check for `subset(object, downsample = TRUE)`.
2.  **Batch Effect Verification:** If different ages were sequenced in different batches, look for a `plot_pca_by_batch` function to ensure that "cluster diversity" is not simply "batch-driven variance."
3.  **Validation metrics:** Does the code contain a `Silhouette Score` or `ARI (Adjusted Rand Index)` analysis? These are often used to define if a cluster is truly "emergent" or just a continuation of a lineage.

***

**Would you like to provide the file structure of your repository now?** If you provide the file list, I will map these functions exactly to your file names.