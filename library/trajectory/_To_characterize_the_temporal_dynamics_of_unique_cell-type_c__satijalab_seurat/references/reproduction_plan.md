# Reproduction Plan for _To_characterize_the_temporal_dynamics_of_unique_cell-type_c

To characterize the temporal dynamics and diversity of cell-type clusters in the mouse visual cortex, follow this standardized reproduction plan. This plan assumes the use of a Seurat-based R environment and the provided repository structure.

## Prerequisites
*   **Data:** Raw scRNA-seq UMI count matrices organized by developmental time-points (P4, P14, P28, P56).
*   **Environment:** R environment with `Seurat` (v4/v5) and `Rcpp` headers for the sampling functions.
*   **Dependencies:** `dplyr` for data manipulation, `ggplot2` for visualization, and `vegan` (or similar) for calculating Shannon entropy.

---

## Step-by-Step Procedure

| Step | Action | Paper Reference | Code Reference | Input | Output | Parameters | Validation |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **1** | **Quality Control** | Methods: "Cellular taxonomy" | `R/preprocessing.R` | Raw objects | Filtered Seurat objects | `nFeature`, `nCount` thresholds | Check barcode inflection points |
| **2** | **Rarefaction** | Methods: "Diversity metric" | `R/RcppExports.R` (`RunUMISampling`) | Counts matrix | Downsampled matrix | Target UMI count per cell | Verify evenness of total counts across ages |
| **3** | **Iterative Clustering** | Results: "Trajectory of composition" | `R/clustering.R` (`FindSubCluster`) | Downsampled Seurat objects | Cluster/Subcluster IDs | Resolution parameter (e.g., 0.5 - 1.2) | Ensure constant resolution across ages |
| **4** | **Temporal Integration** | Results: "Anchoring states" | `R/integration.R` (`FindIntegrationAnchors`) | Clustered objects | Integrated mapping | `k.anchor = 5` | Alignment of major cell classes (e.g., GABAergic) |
| **5** | **Diversity Metrics** | Discussion: "Maturation kinetics" | Custom R script | Cluster ID vector | Shannon Entropy values | None | Plot Shannon H vs. Age |

### Implementation Details:
1.  **Rarefaction:** Use `RunUMISampling` to ensure every developmental stage is sampled at the same depth. This prevents "increasing diversity" from being a technical artifact of higher sequencing depth at older ages.
2.  **Iterative Clustering:** Run standard `FindClusters` to identify main cell types, then map `FindSubCluster` to capture the fine-grained diversification specific to each time-point.
3.  **Entropy Calculation:** Use the cluster frequency $p_i$ per age: $H = -\sum p_i \ln(p_i)$. A trend of increasing $H$ indicates genuine diversification; constant $H$ indicates stability.

---

## Expected Output
*   **Taxonomy Table:** A count table indicating the number of unique clusters and subclusters per developmental time-point.
*   **Diversity Plot:** A line graph showing Shannon Entropy vs. Postnatal Days; look for a plateau or continuous rise.
*   **UMAP Visualizations:** An integrated UMAP showing temporal trajectories, with clusters colored by their developmental age of "emergence."

---

## Troubleshooting
*   **Artifactual Diversity:** If the number of clusters increases significantly at one age, check the total cell count. If cell numbers are disproportionately high, increase the `RunUMISampling` stringency (lower the target UMI count).
*   **Integration Mismatch:** If `FindIntegrationAnchors` fails, ensure the same highly variable features (HVGs) were used for each time-point. Use `SelectIntegrationFeatures` to standardize the input.
*   **Resolution Drift:** If "subclusters" seem to be merging, check that the `FindSubCluster` resolution parameter is consistent. Ideally, use a normalized resolution (e.g., adjusting based on the log of cell count) to keep clustering sensitivity comparable across ages.
*   **Batch Effect:** If the "age" appears as a strong batch effect that masks biological trajectories, use `FindIntegrationAnchors` to specifically mitigate the "age-as-batch" effect, effectively aligning the latent space.