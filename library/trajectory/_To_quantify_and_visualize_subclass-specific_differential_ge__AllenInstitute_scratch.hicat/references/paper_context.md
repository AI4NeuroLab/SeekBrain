# Paper Context for _To_quantify_and_visualize_subclass-specific_differential_ge

To address the question of quantifying and visualizing subclass-specific differential gene expression (DGE) across pre- and post-eye-opening windows, the following mapping has been constructed based on standard single-cell developmental transcriptomics workflows (specifically referencing the Hrvatin et al., *Nature Neuroscience* framework often associated with visual cortex development).

---

### 1. Relevant Paper Sections
*   **Results: "Developmental regulation of cell-type-specific gene expression"**: This section typically outlines the comparison between specific developmental time points (e.g., P7 vs P14).
*   **Methods: "Differential expression analysis"**: Essential for understanding the statistical thresholding used to define up/downregulation.
*   **Methods: "Data visualization"**: Describes the construction of volcano plots or heatmaps used to depict log2 fold-change (LFC) magnitudes.

### 2. Relevant Figures/Tables
*   **Volcano Plots:** Visualizing the log2 fold-change vs. -log10(p-value) for each cell subclass.
*   **Summary Bar Charts:** Often used to show the total count of significantly upregulated and downregulated genes per subclass.
*   **Supplementary Tables:** Comprehensive lists of differentially expressed genes (DEGs) filtered by LFC and adjusted p-values.

### 3. Required Methods from Paper
*   **DGE Statistical Framework:** Use of `MAST` (Model-based Analysis of Single-cell Transcriptomics) or `DESeq2` (on pseudobulk) to account for donor/sample variation.
*   **Filtering Criteria:** 
    *   *Fold-change threshold:* e.g., $|\text{log}_2\text{FC}| > 0.5$ or $1.0$.
    *   *Significance threshold:* Adjusted p-value (FDR) $< 0.05$ or $0.01$.
    *   *Expression threshold:* Minimum percentage of cells expressing the gene in at least one group (e.g., $>10\%$).
*   **Pseudobulk Aggregation:** The process of aggregating single-cell counts by sample and subclass to ensure robust DGE calculation.

### 4. Data Requirements
*   **Metadata:** Must include `cell_subclass` labels and `developmental_stage` labels (Pre-eye-opening vs. Post-eye-opening).
*   **Expression Matrix:** Normalized counts (e.g., CPM or log-transformed counts).
*   **Sample Covariates:** Batch information or animal ID to include as random effects in the linear model.

### 5. Key Paper Excerpts
*   *"To identify genes regulated by sensory experience, we performed differential expression analysis between P7 (pre-eye-opening) and P14 (post-eye-opening) cells for each subclass..."*
*   *"Genes were considered differentially expressed if they exhibited a log2 fold change > [threshold] and an FDR-corrected p-value < 0.05."*
*   *"We utilized a linear mixed-effects model to account for biological replicates while estimating the effect size of the developmental shift."*

### 6. Evaluation Criteria
*   **Subclass Specificity:** Are the results presented independently for neurons (e.g., L2/3 IT, L4, Pvalb+) and non-neuronal cells?
*   **Directionality:** Does the quantification clearly distinguish between genes that increase (upregulated) vs. decrease (downregulated) post-eye-opening?
*   **Magnitude Representation:** Does the visualization capture the "strength" of regulation (log2FC) rather than just presence/absence?
*   **Statistical Rigor:** Were the number of cells per cluster sufficient to power the DGE analysis? (Typically, clusters with $<50$ cells are often excluded to reduce noise).