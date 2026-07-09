# Paper Context for Generate_a_brain-wide_flatmap_visualization__Swanson_project

To generate the requested Swanson flatmap visualization based on the IBL (International Brain Laboratory) decision-making task data, please refer to the following mapping based on the IBL "Brain-wide maps of distribution of activity" study:

### 1. Relevant Paper Sections
*   **Methods: Electrophysiological recordings:** Details on the 139 mice and Neuropixels setup.
*   **Methods: Spike sorting and histology:** Describes the assignment of neurons to the Allen CCFv3 atlas (Beryl mapping).
*   **Methods: Statistical analysis of stimulus response:** Describes the comparison of firing rates between task conditions.
*   **Methods: Flatmap generation:** Details on the use of `iblatlas` and the Swanson projection parameters.

### 2. Relevant Figures/Tables
*   **Figure 1 or Extended Data Figure 1:** The overarching "Brain-wide maps" figures which utilize the Swanson flatmap projection to display regional functional modulation.
*   **Supplementary Data Tables:** Regional list containing the Beryl-mapped structure acronyms used in the atlas.

### 3. Required Methods from Paper
*   **Neuron Selection:** Filter neurons based on the criterion: $\geq 20$ neurons per region AND $\geq 2$ recording sessions.
*   **Statistical Test:** Perform a Mann-Whitney U test comparing firing rates between left and right stimulus conditions (0–100 ms window).
*   **Significance:** Apply Benjamini-Hochberg (FDR) correction at $q < 0.01$ to p-values per region.
*   **Visualization Engine:** Use the `iblatlas` Python package (functionality: `iblatlas.plots.plot_swanson_vector`).
*   **Colormapping:** Map the fraction ($N_{significant} / N_{total}$) to a yellow-green (e.g., `YlGn` Matplotlib) scale.

### 4. Data Requirements
*   **Dataset:** IBL Neuropixels recordings (139 mice).
*   **Atlas:** Allen CCFv3 (Beryl mapping nomenclature).
*   **Variables:**
    *   `spike_times`, `spike_clusters`.
    *   `brain_regions` (assigned via Beryl).
    *   `stimulus_side` (left/right labels).
    *   `trial_onset_times`.

### 5. Key Paper Excerpts
*   *"We assigned neurons to brain regions using the Beryl mapping of the Allen CCFv3."*
*   *"To compare stimulus-driven activity, we computed the firing rate in the 0–100 ms window post-stimulus, comparing left versus right stimuli using a Mann-Whitney U test."*
*   *"Regions with fewer than 20 neurons or present in fewer than 2 sessions were excluded from analysis."*
*   *"Significance was determined using an FDR threshold of q = 0.01."*

### 6. Evaluation Criteria
*   **Visualization:** Must be a Swanson projection in **portrait orientation** focusing on the **right hemisphere**.
*   **Color Logic:** 
    *   Significant regions ($q < 0.01$): Colored via `YlGn` based on the fraction of significantly modulated neurons.
    *   Non-significant regions: Grey.
    *   Excluded/Missing regions: White.
*   **Annotation:** The text "Significant/Total Regions" must be placed in the upper right corner of the figure.
*   **Technical Compliance:** Adherence to the 20-neuron/2-session thresholding filter for regional inclusion.