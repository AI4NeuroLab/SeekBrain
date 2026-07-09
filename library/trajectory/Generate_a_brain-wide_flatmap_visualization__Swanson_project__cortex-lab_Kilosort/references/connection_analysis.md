# Paper-Repo Connection Analysis for Generate_a_brain-wide_flatmap_visualization__Swanson_project

This analysis evaluates the connection between the requested scientific methodology (IBL brain-wide analysis) and the provided repository content.

### 1. Paper-to-Code Mapping
The paper methodology focuses on **downstream analysis** (statistical modulation, FDR, and visualization of atlas-mapped activity), whereas the provided code repository (KiloSort/Phy) is focused exclusively on **upstream spike sorting** (data acquisition, waveform clustering, and manual curation).
*   **Paper Requirement (Atlas/Visualization):** Relies on `iblatlas` for CCFv3 mapping and Swanson projections.
*   **Repository Content:** Contains only `master_file.m` and `eMouse` scripts for processing raw electrode data into sorted spikes. There is **no code** in the provided files that performs Mann-Whitney U tests, FDR corrections, or brain-wide flatmap rendering.

### 2. Code-to-Paper Mapping
*   **KiloSort/Phy:** This repo constitutes the "Electrophysiology" component of the Methods. It provides the toolset to convert the `dat` files mentioned in `params.py` into the spike times and cluster IDs necessary to calculate the firing rates mentioned in the paper’s "Neural activity analysis" section.
*   **Missing Links:** The repository contains no logic for stimulus alignment, behavioral task decoding (decision-making task), or anatomical projection, all of which are essential to the paper’s reported results.

### 3. Gap Analysis
*   **Absence of Analytical Tools:** The provided repository is limited to the *pre-processing* of neural data. The *post-processing* pipeline (IBL's `brainbox` and `iblatlas` libraries) is entirely absent from the provided files.
*   **Data Structure Mismatch:** The code focuses on `params.py` and raw `.dat` file handling, whereas the research question requires access to the **IBL Unified Data Interface (DataJoint/Alf)**, which stores pre-aligned stimulus-onset timestamps and Beryl-mapped anatomy.
*   **Visualization Logic:** The instructions to generate a Swanson flatmap using `iblatlas` cannot be executed with the provided repository; the repo lacks the anatomical lookup tables and the `iblatlas` library dependencies.

### 4. Reproduction Strategy
To generate the visualization requested, you cannot rely on the provided KiloSort repository. You must instead:
1.  **Access the IBL Python Pipeline:** Install `ibl-neuropixels` and `iblatlas` via the IBL organization's GitHub.
2.  **Retrieve Data:** Query the IBL DataJoint database or download the `alf` (Analysis-ready Layer Format) files for the 139 mice specified.
3.  **Implement Statistics:**
    *   Load spikes for each neuron.
    *   Align to stimulus onset (0–100ms).
    *   Perform the Mann-Whitney U test using `scipy.stats.mannwhitneyu`.
    *   Apply Benjamini-Hochberg (FDR) correction using `statsmodels.stats.multitest.multipletests`.
4.  **Visualize:** Use `iblatlas.plots.plot_swanson_vector` to project the region-aggregated fractions onto the template flatmap, setting the hemisphere to `right` and orientation to `portrait`.

### 5. Key Insights
The repository provided is an **infrastructure tool (KiloSort)**, not the **analytical pipeline** described in the paper. While the KiloSort repository is the foundation for obtaining high-quality single-unit data (a prerequisite for the paper), the specific request to map stimulus-modulated neurons onto a Swanson flatmap requires a different set of IBL-specific libraries (`brainbox`, `iblatlas`, `ibl-pipeline`) that are not included in the provided KiloSort/Phy source code. Using only the provided repository, one can produce spike trains, but one cannot perform the brain-wide anatomical assessment or the statistical visualization required.