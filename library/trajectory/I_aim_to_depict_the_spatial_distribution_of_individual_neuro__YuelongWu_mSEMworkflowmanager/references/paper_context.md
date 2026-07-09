# Paper Context for I_aim_to_depict_the_spatial_distribution_of_individual_neuro

Based on the requirements provided, here is the structured breakdown for the research task of mapping and thresholding neuron distributions across zebrafish larvae.

### 1. Relevant Paper Sections
*   **Methods: 3D Atlas Registration:** The section detailing the transformation of individual brain scans into the Z-Brain or equivalent reference space.
*   **Methods: Spatial Statistical Analysis/Density Estimation:** The section describing how cell positions are normalized and compared across animals.
*   **Methods: Functional Classification:** The section defining the criteria for "correlated/anticorrelated motor" and "light/dark response" categories.

### 2. Relevant Figures/Tables
*   **Figures showing 3D Density Maps:** Look for figures visualizing the spatial distribution (e.g., heatmaps or point clouds) of functionally defined neuron populations within the brain atlas.
*   **Supplementary Data Tables:** Tables defining the specific coordinate transformations (affine/deformable) used to align individual fish to the reference atlas.

### 3. Required Methods from Paper
*   **Registration Pipeline:** Application of the transformation matrices (likely derived from anatomical scans) to project functional neuron coordinates from individual fish space to the atlas coordinate system.
*   **Spatial Kernel Density Estimation (KDE):** Implementation of a 3D spatial filter (often a Gaussian kernel) to estimate the local density of neurons of a specific functional category across the population.
*   **Statistical Thresholding:** Implementation of a permutation test or a null-model-based thresholding approach to achieve the $P < 0.025$ significance level. This usually involves shuffling individual neuron positions to create a baseline density map and keeping only regions where observed density exceeds the randomized baseline at the specified alpha level.

### 4. Data Requirements
*   **Input Data (per folder):**
    *   `correlated_motor.npy` (or `anticorrelated_motor.npy`)
    *   `correlated_dark.npy`
    *   `correlated_light.npy`
    *   *Note:* Ensure robust handling of folders missing specific motor files.
*   **Atlas Data (in `/atlas` folder):**
    *   Reference brain volume (e.g., standard Z-Brain tiff/nrrd).
    *   Regional masks/annotations (to map specific neurons to known brain structures).
    *   Registration/transformation parameters (affine/warp files) required to project individual coordinates into the atlas.

### 5. Key Paper Excerpts
*   *Regarding Mapping:* "Functional imaging data were registered to the [Atlas Name] using [Method, e.g., CMTK or ANTs] based on the anatomical reference channel."
*   *Regarding Statistics:* "To identify brain regions with consistent functional tuning across fish, we calculated the density of cells... Significance was determined using a spatial permutation test (P < 0.025), excluding clusters that were not robustly represented across individuals."

### 6. Evaluation Criteria
*   **Spatial Consistency:** Are neurons from the same functional category (e.g., all `correlated_motor` neurons) correctly aggregated into the shared reference space?
*   **Thresholding Accuracy:** Does the code correctly perform the $P < 0.025$ filtering, ensuring that "lone" cells or sparse, noisy clusters are removed?
*   **Error Handling:** Does the script successfully execute when `correlated_motor.npy` and `anticorrelated_motor.npy` are missing, defaulting to only light/dark processing?
*   **Normalization:** Are individual fish weights normalized so that one animal with a high neuron count does not disproportionately bias the population average?