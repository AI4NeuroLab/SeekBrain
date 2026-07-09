# Paper-Repo Connection Analysis for Generate_a_brain-wide_flatmap_visualization__Swanson_project

This analysis connects the scientific requirements for generating an IBL-based Swanson flatmap to the existing `int-brain-lab/iblatlas` and `int-brain-lab/analysis_iblatlas` infrastructure.

### 1. Paper-to-Code Mapping
*   **Neuron Selection:** Mapping to `ibllib.atlas.regions.BrainRegions`. The filtering logic (`n_neurons >= 20` and `n_sessions >= 2`) is implemented in custom scripts within the `ibl-brain-wide-map` repository (associated with the IBL Nature 2023 paper).
*   **Statistical Test:** The Mann-Whitney U test is standard in the `scipy.stats` library, utilized by IBL analysis pipelines to compare trial types.
*   **Flatmap Visualization:** The `iblatlas` package provides the core visualization engine. Specifically, `iblatlas.plots.plot_swanson_vector` or `iblatlas.plots.plot_swanson` are the direct implementations used to project 3D volume data onto the 2D Swanson template.
*   **Beryl Mapping:** The `iblatlas` package maintains the `beryl_map` as a primary alias set to condense the full Allen CCFv3 into anatomically relevant regions.

### 2. Code-to-Paper Mapping
*   **`iblatlas/plots.py`:** Contains the logic to translate 3D brain region indices into 2D Swanson coordinates. The paper’s "portrait orientation" requirement is handled by the `orientation='portrait'` argument in the plotting function.
*   **`iblatlas/atlas.py`:** Provides the `AllenAtlas` class, which holds the Beryl hierarchy required to ensure the "139 mice" data aligns with the structure names used in the study.
*   **`analysis_iblatlas` (Repository):** This secondary repo contains the specific plotting scripts that implement the FDR correction and color-mapping (YlGn) logic described in the paper’s methods section.

### 3. Gap Analysis
*   **Thresholding Logic:** While `iblatlas` handles the plotting, the filtering logic (the intersection of neuron count and session count) is not native to the `iblatlas` package; it is typically performed in the upstream data-wrangling pipeline (`ibl-brain-wide-map`).
*   **FDR Implementation:** The `iblatlas` package does not contain a statistical module. The user must compute the Mann-Whitney U tests and the FDR correction (using `statsmodels.stats.multitest.multipletests`) *before* passing the resulting array of regional fractions to the plotting function.
*   **Annotation:** The requirement to display "Significant/Total Regions" in the upper right is a custom implementation requirement (matplotlib text overlay) not present in the base `iblatlas` library.

### 4. Reproduction Strategy
1.  **Data Extraction:** Use the `one-api` (Open Neurophysiological Environment) to pull the firing rates for neurons, filtered by `Beryl` IDs.
2.  **Preprocessing:** 
    *   Iterate through each region; filter based on the 20-neuron/2-session rule.
    *   Perform `scipy.stats.mannwhitneyu(left_stim, right_stim)`.
    *   Apply `statsmodels.stats.multitest.multipletests(pvals, method='fdr_bh')`.
3.  **Visualization Pipeline:**
    *   Initialize the `AllenAtlas` (Beryl).
    *   Map the fraction values to a `YlGn` colormap, ensuring $q > 0.01$ indices return `0.5` (grey) or a masked array.
    *   Call `iblatlas.plots.plot_swanson_vector(..., hemisphere='right', orientation='portrait')`.
    *   Add the text overlay using `plt.text(x, y, f'{n_sig}/{n_total}')`.

### 5. Key Insights
*   **Data Integrity:** The Beryl mapping is crucial. If the user uses the full Allen CCFv3 (without Beryl), the Swanson projection will be too granular and fail to map accurately to the figures in the paper.
*   **Efficiency:** Because the Swanson map is essentially a vector representation of the CCF, the visualization is high-performance, but it relies entirely on the `iblatlas` internal mapping dictionary to match your computed regional statistics to the correct pixels in the 2D SVG/PNG map.
*   **Orientation:** Users often struggle with the "Right Hemisphere" constraint. In the IBL ecosystem, ensure the `hemisphere` argument is explicitly set to `'right'`; otherwise, the `iblatlas` default may plot a bilateral or left-biased view.