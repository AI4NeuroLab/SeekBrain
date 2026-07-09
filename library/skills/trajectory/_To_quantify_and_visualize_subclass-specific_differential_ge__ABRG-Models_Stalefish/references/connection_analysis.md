# Paper-Repo Connection Analysis for _To_quantify_and_visualize_subclass-specific_differential_ge

### 1. Paper-to-Code Mapping
The scientific goal described—**quantifying and visualizing subclass-specific differential gene expression (DGE) in mouse visual cortex**—refers to a transcriptomic analysis task, likely utilizing scRNA-seq data (e.g., Seurat/Scanpy workflows). 

The provided code repositories (**Stalefish** notebooks and `allen/retrieve.py`) are **entirely disconnected** from this goal. 
*   **The Stalefish repository** focuses on spatial processing of `h5` files representing image-based data (likely *in situ* hybridization or similar imaging stacks). The "analysis" consists of signal intensity normalization, spatial interpolation, and heatmap generation for brain slices.
*   **The `allen/retrieve.py`** script is a utility for fetching image metadata/coordinates from the Allen Developing Mouse Brain Atlas API. 

### 2. Code-to-Paper Mapping
There is **zero overlap**. The paper context implies a bioinformatics pipeline for single-cell data (Differential Expression, Wilcoxon rank-sum tests, metadata partitioning by age/subclass), whereas the code is a **spatial imaging pipeline** for processing and visualizing pixel/box intensities across histological slices. The repositories do not contain scRNA-seq objects, cell-type metadata, or DGE testing functions (e.g., `FindMarkers`).

### 3. Gap Analysis
*   **Methodological Mismatch:** The research question requires DGE analysis tools (Seurat, DESeq2, or Scanpy). The code uses image processing tools (`skimage`, `PIL`, `cv2`, `scipy.interpolate`).
*   **Data Structure:** The research question requires a gene expression matrix (cells x genes). The code processes coordinate-based HDF5 files containing spatial intensity values (`output_map/twod/expression_resampled`).
*   **Functional Mismatch:** The code is designed to align and interpolate image slices to create "average brain" heatmaps. It lacks the capability to calculate fold-change magnitude between discrete developmental time points (P7–P10 vs. P11–P15).

### 4. Reproduction Strategy
To address the research question, the provided code must be abandoned in favor of a standard scRNA-seq analysis pipeline:
1.  **Framework:** Use the `Seurat` (R) or `Scanpy` (Python) framework.
2.  **Input:** Load the raw count matrix and associate it with metadata (Age: P7–10/P11–15, Subclass).
3.  **Partitioning:** Use `Idents(object) <- "Subclass"` and split the object by `Age`.
4.  **Differential Analysis:** Execute `FindMarkers()` or `rank_genes_groups()` comparing the two age bins for each subclass independently.
5.  **Visualization:** Use `ggplot2` or `seaborn` to generate volcano plots of the resulting `avg_log2FC` and `-log10(p_val_adj)`.

### 5. Key Insights
The user has likely mismatched the provided codebase with the intended research question. The Stalefish code is specialized for **spatially-registered imaging data**, while the question is specific to **single-cell transcriptomic profiling**. No part of the existing code can perform differential gene expression analysis between defined biological time windows as specified.