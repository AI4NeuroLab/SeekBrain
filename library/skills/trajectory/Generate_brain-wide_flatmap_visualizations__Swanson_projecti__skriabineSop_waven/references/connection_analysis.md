# Paper-Repo Connection Analysis for Generate_brain-wide_flatmap_visualizations__Swanson_projecti

### 1. Paper-to-Code Mapping
The research requirements described in the IBL (International Brain Laboratory) project context are **entirely distinct** from the provided repository (`Waven`). 

*   **Paper Requirement:** Brain-wide flatmap visualizations (Swanson) using Allen CCFv3, IBL decision-making task data, and four specific metrics (Mann-Whitney, trajectory distance, latency, GLM $R^2$).
*   **Repo Functionality:** The `Waven` repository is focused on **Receptive Field (RF) mapping** and wavelet-based visual stimulus modeling for individual neurons (likely visual cortex focus). 
*   **Overlap:** There is no structural or functional overlap. The paper requires `iblatlas` (a core IBL library), whereas the repository uses `waven`, a specialized library for Gabor-based receptive field analysis.

### 2. Code-to-Paper Mapping
*   **Target Application:** The `Waven` repository code is designed to load spike data via `load_spikes_and_positions` and process them through `run_rf_analysis` and `run_full_model`.
*   **Pipeline Mismatch:** 
    *   The paper requests population-level anatomical visualization across the whole brain. 
    *   The `Waven` repository performs neuron-specific receptive field modeling (e.g., `plot_rf_grid`, `plot_retinotopic_maps`) and generates visual sign maps rather than brain-wide anatomical flatmaps.
    *   The `environment.yml` specifies `waven` as the primary project name, reinforcing its scope as a targeted analysis tool for visual physiology, not the IBL brain-wide project mentioned in the prompt.

### 3. Gap Analysis
The gap between the request and the provided code is total:
*   **Missing Dependencies:** The repo lacks `iblatlas`, which is the absolute requirement for generating Swanson flatmaps. 
*   **Missing Analyses:** The four requested analytical metrics (Mann-Whitney tests on stimulus side, population trajectory distance, modulation latency, and $|ΔR²|$) are absent in the `waven` codebase.
*   **Architectural Mismatch:** The repository is configured for GUI-driven or batch processing of individual receptive field parameters, whereas the research question requires a macro-scale anatomical meta-analysis pipeline.

### 4. Reproduction Strategy
If you intend to implement the requested visualization using the IBL framework:
1.  **Discard the `Waven` repository:** It does not contain the plotting routines or analytical functions required.
2.  **Environment:** Set up the official [IBL `brain-wide-map`](https://github.com/int-brain-lab/brain-wide-map) environment.
3.  **Data Access:** Use `one_api` (Open Neurophys) to query the IBL dataset for 139 mice, ensuring the Beryl mapping is applied to the CCFv3 coordinates.
4.  **Implementation:**
    *   Use `iblatlas.plots.plot_swanson` for the flatmap base.
    *   Create a loop to calculate the four metrics (Mann-Whitney p-vals, trajectory peaks, etc.) per brain region.
    *   Map these values to the `swanson_lookup` table provided in `iblatlas`.
    *   Use `matplotlib` to apply the yellow-green colormap and label the significant/total ratio text annotations in the top right of each panel.

### 5. Key Insights
*   **Repository Divergence:** The provided code belongs to a different scientific domain (receptive field modeling) than the research question (brain-wide decision-making encoding).
*   **Methodological Mismatch:** The code is built for high-granularity visual spatial modeling of specific neurons, whereas the question demands coarse-grained, regional-level anatomical summaries.
*   **Caution:** Do not attempt to repurpose the `Waven` `PipelineConfig` for the Swanson flatmap task, as the data structures for receptive fields are incompatible with the regional aggregate statistics needed for brain-wide flatmapping.