# Repository Context for Generate_brain-wide_flatmap_visualizations__Swanson_projecti

Based on the analysis of the provided repository and the specific scientific requirement for the **Swanson flatmap visualizations of visual stimulus encoding**, here is the assessment.

### 1. Relevant Files (RANKED by relevance)

*   **`readme.md` (Priority: LOW)**: Provides the background for the Kilosort repository, which is an upstream tool for generating the spike-sorted neural data required for the encoding models mentioned in the question.
*   **`Docs/phy_installation_with_templates.txt` (Priority: LOW)**: Relevant only for the downstream curation of the data used in the analysis.
*   **All other files (e.g., `Docs/readme_mac.txt`, `eMouse/readme_eMouse.txt`, `licence.txt`)**: Not relevant.

**Critical Finding:** The provided repository is an **electrophysiological spike-sorting software package (Kilosort)**. It does **not** contain the IBL `iblatlas` package code, the Swanson flatmap visualization routines, or the encoding model analysis scripts (Mann-Whitney, trajectory distance, GLM ΔR²) described in your research question.

---

### 2. Code Execution Order
Since the requested analysis resides outside this repository, the code execution order for your specific task would typically be:
1.  **Preprocessing (Kilosort)**: Run Kilosort (using `master_file_example`) to generate the `rez` spike-sorting structures.
2.  **Curation (Phy)**: Export `rez` to NPY and use the `phy` GUI (as per `Docs/phy_installation_with_templates.txt`) to refine units.
3.  **Mapping (`iblatlas`)**: *[External to this repo]* Load unit metadata, map to Beryl/CCFv3, and apply the $\geq 20$ neurons / $\geq 2$ sessions filter.
4.  **Encoding Analysis**: *[External to this repo]* Execute the Mann-Whitney tests and GLM model fitting on the cleaned spike data.
5.  **Visualization (`iblatlas`)**: *[External to this repo]* Invoke `iblatlas.plots.plot_swanson_vector` to render the final four subplots.

---

### 3. Key Code Patterns (Required for the task, but NOT in this repo)
*   **Swanson Visualization**: `iblatlas.plots.plot_swanson_vector(data, cmap='YlGn', hemisphere='right')`
*   **FDR Thresholding**: `scipy.stats.false_discovery_control` or similar to mask $q < 0.01$.
*   **Encoding GLM**: A standard GLM approach: $\Delta R^2 = R^2_{full} - R^2_{no\_stimulus}$.
*   **Trajectory Latency**: `np.argmax(dist >= 0.7 * np.max(dist))` applied to the Euclidean distance vector of population states.

---

### 4. Data Files Referenced
*   **Required (IBL):** Neuropixels spike-sorted data (NPY format compatible with the Phy interface exported by Kilosort).
*   **Required (Atlas):** `iblatlas` CCFv3 Beryl mapping files (lookup tables for Allen Brain Atlas regions).

---

### 5. Missing Pieces
The provided repository is entirely missing the logic required to answer your research question. To complete this task, you must source the following from the **International Brain Laboratory (IBL) code ecosystem**:

1.  **`iblatlas` Python Package**: This is the mandatory dependency for the `Swanson` projection mapping and `Beryl` coordinate alignment.
2.  **Encoding Analysis Module**: Scripts for GLM-based encoding (often found in `ibl-neuropixel` or `brainwide` analysis repositories maintained by the IBL).
3.  **Flatmap Plotting Script**: You need the specific wrapper script that implements the "portrait orientation" and "ratio of significant regions" annotation.
4.  **Statistical Thresholding Logic**: Implementation of the Mann-Whitney test and the FDR (False Discovery Rate) correction specific to the IBL's Beryl mapping regions.

**Recommendation:** The requested analysis should be performed using the **`brainwide`** or **`ibl-analysis`** repositories associated with the IBL Brain-wide map paper, rather than the `Kilosort` spike-sorting repository provided.