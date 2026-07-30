# Scientific context

## Methodological requirements

*   **Neuron Selection:** Filter neurons based on the criterion: $\geq 20$ neurons per region AND $\geq 2$ recording sessions.
*   **Statistical Test:** Perform a Mann-Whitney U test comparing firing rates between left and right stimulus conditions (0–100 ms window).
*   **Significance:** Apply Benjamini-Hochberg (FDR) correction at $q < 0.01$ to p-values per region.
*   **Visualization Engine:** Use the `iblatlas` Python package (functionality: `iblatlas.plots.plot_swanson_vector`).
*   **Colormapping:** Map the fraction ($N_{significant} / N_{total}$) to a yellow-green (e.g., `YlGn` Matplotlib) scale.

## Required data

*   **Dataset:** IBL Neuropixels recordings (139 mice).
*   **Atlas:** Allen CCFv3 (Beryl mapping nomenclature).
*   **Variables:**
    *   `spike_times`, `spike_clusters`.
    *   `brain_regions` (assigned via Beryl).
    *   `stimulus_side` (left/right labels).
    *   `trial_onset_times`.

## Validation criteria

*   **Visualization:** Must be a Swanson projection in **portrait orientation** focusing on the **right hemisphere**.
*   **Color Logic:** 
    *   Significant regions ($q < 0.01$): Colored via `YlGn` based on the fraction of significantly modulated neurons.
    *   Non-significant regions: Grey.
    *   Excluded/Missing regions: White.
*   **Annotation:** The text "Significant/Total Regions" must be placed in the upper right corner of the figure.
*   **Technical Compliance:** Adherence to the 20-neuron/2-session thresholding filter for regional inclusion.
