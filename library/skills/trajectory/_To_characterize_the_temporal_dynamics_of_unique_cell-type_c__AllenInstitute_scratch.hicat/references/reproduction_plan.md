# Reproduction Plan for _To_characterize_the_temporal_dynamics_of_unique_cell-type_c

This reproduction plan is designed to characterize the temporal dynamics of cell-type diversity in the mouse visual cortex, using the standardized workflows associated with developmental transcriptomics (e.g., *Yao et al., 2021*).

---

## Prerequisites
*   **Data:** Raw scRNA-seq/snRNA-seq counts for mouse visual cortex across key postnatal ages (e.g., P4, P14, P28, P56).
*   **Environment:** R (Seurat/Harmony) or Python (Scanpy/scVI-tools).
*   **Dependencies:** `Seurat` (or `Scanpy`), `Harmony` (for batch correction), `clustree` (for resolution stability), `ggplot2`.

---

## Step-by-Step Procedure

| Step | Action | Paper Reference | Code Reference | Input | Output | Parameters | Validation |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **1. Normalization** | Library size normalization | Methods: "Data Processing" | `normalize.R` | Raw counts | Normalized matrix | `scale.factor=10000` | Log-normal distribution |
| **2. Downsampling** | Balance cell numbers per age | Methods: "Batch Effect Correction" | `subsample_cells.R` | Full dataset | Subsampled Object | `n=min(cells_per_age)` | Equal N per time point |
| **3. Integration** | Remove technical age-bias | Methods: "Integration Strategy" | `harmony_int.py` | Normalized Data | Integrated Embeddings | `lambda=1.2` (Harmony) | Overlapping clusters |
| **4. Stability Sweep** | Test clustering at resolutions | Results: "Cluster definition" | `clustree_scan.R` | Integrated PCA | Cluster tree plot | `res=0.1` to `2.0` | Plateau in cluster count |
| **5. Diversity Metric** | Calculate Shannon Entropy | Results: "Diversification Trends" | `entropy_calc.py` | Cluster IDs per Age | Entropy Index | N/A | Compare H(P4) vs H(P56) |
| **6. Marker Validation** | Verify unique markers | Methods: "Marker Identification" | `find_markers.py` | DEG list | P-values/FC | `logfc.threshold=0.25` | High AUROC values |

---

## Expected Output
1.  **Stability Plot:** A `clustree` visualization showing the optimal resolution where cluster count stabilizes regardless of small shifts in input.
2.  **Temporal Diversity Curve:** A line graph showing the "Cumulative number of unique cell types" vs. "Postnatal Age."
3.  **Entropy Analysis:** A quantitative metric showing if the "information content" (diversity) of the visual cortex is increasing or reaching a steady state (plateau).
4.  **Feature Plot/Heatmap:** Highlighting genes that define cell-type identities which emerge specifically in the P28–P56 window (e.g., maturation-specific genes).

---

## Troubleshooting

*   **Issue: "Cluster explosion at higher ages"**
    *   *Cause:* The sample size is larger at later time points, causing the algorithm to over-split subclusters.
    *   *Fix:* Implement **downsampling** to match the lowest cell-count age point before re-clustering.
*   **Issue: "Integration masks developmental signals"**
    *   *Cause:* `Harmony` or `scVI` is over-correcting, merging distinct transient developmental cell types into mature clusters.
    *   *Fix:* Reduce the integration strength parameter (e.g., `lambda` in Harmony or `beta` in scVI) to preserve subtle biological variances.
*   **Issue: "Clusters appear at P56 but not P14"**
    *   *Cause:* Potential technical batch effect or library bias.
    *   *Fix:* Perform **differential expression** between the P56 "unique" cluster and the nearest P14 cluster. If the difference is driven by a small set of genes (e.g., mitochondrial or immediate-early genes), the cluster is likely an artifact.

---

### Key Validation Metric: The "Stability Score"
To distinguish biological diversification from artifact, calculate the **Jaccard similarity index** between clusters identified in independent runs. If the Jaccard index for a specific "newly identified" cluster is $<0.7$ across runs, it should be categorized as an "unstable computational artifact" rather than a unique developmental cell type.