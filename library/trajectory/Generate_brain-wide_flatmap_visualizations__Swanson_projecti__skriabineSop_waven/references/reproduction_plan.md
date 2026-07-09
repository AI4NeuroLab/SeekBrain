# Reproduction Plan for Generate_brain-wide_flatmap_visualizations__Swanson_projecti

To reproduce the brain-wide flatmap visualizations described, you must move away from the provided `Waven` repository, which focuses on visual receptive field modeling, and instead adopt the official IBL **Brain-Wide Map (BWM)** analysis pipeline.

### Prerequisites
*   **Environment:** A Python environment with the `ibllib`, `iblatlas`, `brainbox`, and `one-api` libraries installed.
*   **Data Access:** An IBL `ONE` instance linked to the IBL public database (Public/Release: "2023_Q4_IBL_et_al_BWM").
*   **Computational Hardware:** High-RAM machine (min 32GB) for processing large-scale spike-sorting data across 139 mice.

---

### Step-by-Step Procedure

| Step | Action | Paper/Method Reference | Code/Lib Reference | Input | Output |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **1** | **Data Loading** | IBL "Data availability" section | `one.load_object` | Session IDs (139 mice) | Spike times, clusters, trial info |
| **2** | **Region Mapping** | "Anatomical mapping" | `iblatlas.regions.BerylMap` | CCFv3 coordinates | Beryl-mapped region IDs |
| **3** | **Metric Computation** | "Statistical analysis of neuronal responses" | `scipy.stats.mannwhitneyu`, `brainbox.metrics` | Trial-aligned spikes | P-values, ΔR² (GLM), Trajectory dist |
| **4** | **Regional Aggregation** | "Inclusion criteria" | `pandas` groupby | Per-neuron metrics | Mean metric per region |
| **5** | **Flatmap Visualization** | "Visualization" | `iblatlas.plots.plot_swanson` | Regional CSV/Dictionary | Swanson SVG/PDF plots |

#### Detailed Execution:
1.  **Metric Computation:** 
    *   **Mann-Whitney:** Calculate per neuron comparing 0–100ms firing rates (Stimulus Left vs. Right). Perform FDR correction (Benjamini-Hochberg) at $q < 0.01$.
    *   **Trajectory:** Extract trial-averaged PSTHs (left/right). Compute Euclidean distance at each time point. Identify peak distance within 0–100ms; find $t$ where distance $> 0.7 \times \text{max}$.
    *   **GLM:** Use `brainbox.modeling.glm`. Compare $R^2$ of full model vs. stimulus-kernel-shuffled model.
2.  **Visualization (`iblatlas`):**
    *   Define a mapping dictionary `{region_id: value}`.
    *   Initialize `plot_swanson(orientation='portrait', hemisphere='right')`.
    *   Apply the `yellow-green` (or `viridis` variant) colormap. Set `vmin`, `vmax` based on population distributions.
    *   For the significant/total ratio, use `plt.text(x, y, f'{n_sig}/{n_total}')` on the axes.

---

### Expected Output
*   **Four Panels:** 
    1.  Proportion of significant neurons ($p_{fdr} < 0.01$).
    2.  Max Euclidean distance between trial-averaged trajectories (log10).
    3.  Latency of stimulus encoding (ms).
    4.  Model improvement $|ΔR^2|$ (log10).
*   **Aesthetics:** High-resolution Swanson projection. White background for unanalyzed regions, neutral grey for non-significant regions, and yellow-green gradients for effect sizes.

---

### Troubleshooting
*   **Inclusion Criteria:** If a region is excluded, verify the `Beryl` mapping. Ensure `len(neurons) >= 20` and `n_sessions >= 2` *after* applying the Beryl hierarchy consolidation.
*   **Visualization Errors:** If the flatmap shows "holes," check that your `region_id` mapping aligns strictly with the `Allen CCFv3` IDs used by `iblatlas.regions.BrainRegions`.
*   **Data Discrepancy:** If values appear off, ensure the stimulus interval (0-100ms) accounts for the pre-stimulus baseline subtraction to avoid artifacts from spontaneous activity.

### Implementation Note
Do **not** use the `Waven` repository. The `Waven` code is optimized for Gabor-filter receptive field fits. The IBL project's Swanson flatmaps are typically generated using the `brain-wide-map` repository's plotting scripts found in the `ibllib` ecosystem. You should specifically consult the `ibl-brain-wide-map` GitHub repository (the companion repo to the IBL BWM paper) for the exact plotting scripts that implement the `iblatlas` visualizations requested.