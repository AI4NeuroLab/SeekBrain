# Repository Context for Generate_a_brain-wide_flatmap_visualization__Swanson_project

Based on the provided repository information, it is important to note that the **Drishti repository is specifically designed for 3D volumetric rendering, segmentation, and mesh processing** (using tools like `pyacvd`, `pyvista`, and U-Net++).

The **Question** requires a **Swanson flatmap projection** of functional neuroscience data (IBL decision-making task). **This specific functionality is NOT implemented in the Drishti repository.**

The Drishti repository contains zero scripts related to:
*   Neuropixels data analysis or spike sorting.
*   Mann-Whitney U-tests or FDR statistical correction.
*   The `iblatlas` Python package or brain-wide flatmapping.

Below is the assessment of the requested task in the context of the provided repository:

### 1. Relevant Files (RANKED by relevance)
*   **None (PRIORITY: NONE)**: There are no files in the provided repository that correspond to the brain-wide flatmap generation, neurological stimulus analysis, or the `iblatlas` package requirements. The `bin/assets/scripts/` directory is dedicated to 3D mesh processing (`smooth`, `simplify`, `curvature`) and ML-based segmentation (`unet++`), which are unrelated to this scientific visualization task.

### 2. Code Execution Order
*   **N/A**: The repository cannot execute the requested task. To perform the requested visualization, you would need to create a new script utilizing the `iblatlas` package (e.g., `iblatlas.plots.plot_swanson_vector`) and the `scipy.stats.mannwhitneyu` function, which are not present in this repository.

### 3. Key Code Patterns
*   **Volumetric Processing (Not Applicable)**: While the repository contains sophisticated volumetric processing (e.g., `drishtiML-Unet++.py`), these tools are designed for tomography and electron-microscopy data, not for mapping CCFv3 brain regions or visualizing functional neurophysiology data.
*   **Visualization Logic**: The repository's visualization engine relies on `pyvista` and OpenGL 3.3+. The requested Swanson flatmap uses Matplotlib-based plotting logic via `iblatlas`, which is incompatible with the Drishti visualization pipeline.

### 4. Data Files Referenced
*   **None**: The repository uses `.pvl`, `.raw`, `.npy`, and `.ply` formats for 3D volumes and meshes. The requested task requires `Allen CCFv3` atlas data, `spike_times`, and `stimulus_side` data from the IBL decision-making task, which are not present or handled here.

### 5. Missing Pieces
To complete the task, the user must **ignore this repository** and instead:
1.  **Install the `iblatlas` Python package** (which is not included in the provided dependencies).
2.  **Access the IBL Data Joint analysis portal** (e.g., `ibl-data` or `alyx` API) to retrieve the 139-mice decision-making dataset.
3.  **Implement a custom analysis script** that:
    *   Filters neurons (20 neurons/2 sessions threshold).
    *   Computes `scipy.stats.mannwhitneyu` on the post-stimulus firing rate window.
    *   Calculates the fraction of modulated neurons per Beryl region ID.
    *   Passes this vector to the `iblatlas.plots.plot_swanson_vector` function.
    *   Applies a Matplotlib `YlGn` colormap, masking non-significant values (FDR > 0.01) as grey.