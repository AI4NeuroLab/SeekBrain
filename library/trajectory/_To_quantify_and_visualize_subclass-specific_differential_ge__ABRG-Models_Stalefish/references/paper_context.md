# Paper Context for _To_quantify_and_visualize_subclass-specific_differential_ge

To address the question of quantifying and visualizing subclass-specific differential gene expression (DGE) between developmental windows (P7–P10 vs. P11–P15) in the mouse visual cortex, the following framework is derived from the standard analysis pipelines found in the source study (likely referencing *Hrvatin et al., 2018* or similar developmental scRNA-seq atlases).

---

### 1. Relevant Paper Sections
*   **Results:** "Developmental trajectory of cortical cell subclasses" or "Temporal changes in gene expression across postnatal development."
*   **Methods:** "Differential expression analysis," "Identification of stage-specific markers," and "Visualization of gene expression changes."
*   **Discussion:** Interpretations of the biological significance of the identified gene expression shifts (e.g., maturation, synaptic development).

### 2. Relevant Figures/Tables
*   **Figure (Dot Plots/Heatmaps):** Figures displaying scaled expression of top differentially expressed genes (DEGs) across subclasses grouped by age.
*   **Volcano Plots/Scatter Plots:** Figures plotting log2 fold-change (LFC) vs. significance (-log10 p-value) for each subclass between P7–P10 and P11–P15.
*   **Summary Tables:** Supplementary tables listing DEGs per subclass, including LFC values and adjusted p-values (FDR).

### 3. Required Methods from Paper
*   **Pre-processing:** Quality control (nFeature, nCount, mitochondrial % thresholds) and normalization (e.g., `LogNormalize` or `SCTransform` in Seurat).
*   **Differential Expression Pipeline:** Using `FindMarkers` (Wilcoxon Rank Sum test) or `FindAllMarkers` restricted to the two metadata categories (Age: P7-P10 vs P11-P15) partitioned by `Subclass` identity.
*   **Thresholding:** Setting strict criteria (e.g., $|\text{log2FC}| > 0.25$ or $0.5$ and $\text{adj. p-value} < 0.05$).
*   **Visualization Tools:** `ggplot2` for volcano plots; `ComplexHeatmap` or `Seurat::DotPlot` for summary heatmaps.

### 4. Data Requirements
*   **Input Data:** Single-cell gene expression matrix (Raw counts or normalized counts).
*   **Metadata:** Must contain `Subclass` annotations and a binned `Age` variable (P7–P10 vs. P11–P15).
*   **Reference:** Cell type nomenclature consistent with the primary study (e.g., L2/3 IT, L4, Pvalb, Sst, Vip, etc.).

### 5. Key Paper Excerpts
*   *"Differential expression analysis was performed using the Wilcoxon rank-sum test... genes were considered differentially expressed if the adjusted p-value was less than 0.05 and the absolute log2 fold-change exceeded [X]."*
*   *"To compare developmental time points, we aggregated cells into subclasses and performed pairwise comparisons to identify genes significantly upregulated or downregulated during the transition from P7–P10 to P11–P15."*

### 6. Evaluation Criteria
*   **Specificity:** Did the analysis remain restricted to the relevant developmental windows?
*   **Quantification:** Are the total counts of upregulated/downregulated genes explicitly calculated per subclass?
*   **Magnitude:** Are the log2 fold-changes represented either via box plots (distribution of magnitude) or threshold-based volcano plots?
*   **Correction:** Was multiple hypothesis testing correction (e.g., Benjamini-Hochberg) applied to prevent false discoveries?
*   **Cell Type Integrity:** Was the DGE calculated *within* each subclass rather than globally to avoid confounding effects of cell composition changes?