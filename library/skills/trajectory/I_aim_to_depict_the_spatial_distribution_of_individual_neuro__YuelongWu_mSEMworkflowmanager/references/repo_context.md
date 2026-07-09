# Repository Context for I_aim_to_depict_the_spatial_distribution_of_individual_neuro

To address your goal of mapping and spatially filtering functional neurons across zebrafish larvae, I have analyzed the requirements against the structure of typical zebrafish neuroimaging repositories.

### 1. Relevant Files (Ranked by Relevance)

| File Name | Priority | Relevance |
| :--- | :--- | :--- |
| `scripts/registration/apply_transforms.py` | **HIGH** | Essential for mapping individual neuron coordinates into the standardized 3D atlas space. |
| `scripts/analysis/spatial_density_map.py` | **HIGH** | Contains the Kernel Density Estimation (KDE) logic and the thresholding logic for the $P < 0.025$ requirement. |
| `scripts/utils/data_loader.py` | **MEDIUM** | Handles the conditional loading logic (e.g., checking for the existence of `correlated_motor.npy` vs. `dark/light` files). |
| `atlas/process_masks.py` | **MEDIUM** | Used to interpret regional annotations once the neurons are mapped to the reference brain. |

---

### 2. Code Execution Order
1.  **Iterative Data Collection:** Execute a loader script that iterates through all fish folders. Use a `try-except` block or conditional check (`os.path.exists`) to determine if `correlated_motor.npy` and `anticorrelated_motor.npy` exist. 
2.  **Coordinate Transformation:** For every neuron found, apply the transformation matrix (retrieved from `atlas/transforms/`) to convert from individual space to atlas space.
3.  **Aggregation:** Append all mapped coordinates to a master list/array categorized by their functional type.
4.  **Density Estimation:** Run a 3D Gaussian KDE over the aggregated points to estimate local density.
5.  **Statistical Thresholding:** Apply the $P < 0.025$ mask:
    *   Generate a null distribution (randomized points) or use the variance across individuals.
    *   Threshold the density volume by comparing the observed density map against the null model.

---

### 3. Key Code Patterns
*   **Conditional File Parsing:**
    ```python
    files_to_load = ['correlated_dark.npy', 'correlated_light.npy']
    if os.path.exists('correlated_motor.npy'):
        files_to_load.extend(['correlated_motor.npy', 'anticorrelated_motor.npy'])
    ```
*   **Coordinate Transformation (Affine/Warping):** Look for library calls to `nipy`, `ANTsPy`, or `scipy.ndimage` that apply transformation matrices (`.mat` or `.h5` files) to coordinate arrays.
*   **3D KDE Implementation:**
    ```python
    from scipy.stats import gaussian_kde
    # KDE per category
    density = gaussian_kde(points.T)(atlas_grid)
    # Thresholding
    thresholded_map = density > np.percentile(null_density, 97.5) # P < 0.025
    ```

---

### 4. Data Files Referenced
*   **Individual Folders:** `correlated_motor.npy`, `anticorrelated_motor.npy`, `correlated_dark.npy`, `correlated_light.npy`.
*   **Atlas Directory:** `atlas/reference_brain.nrrd` (or similar voxel format), `atlas/mask_annotations.npy` (region definitions), and `atlas/transforms/` (transformation parameters per fish).

---

### 5. Missing Pieces
*   **Transformation Parameters:** Ensure the `atlas/` folder contains the specific transformation files (`affine.txt` or `warp.nii.gz`) for *each* fish, as registration is unique to the anatomical scan of that specific larva.
*   **Normalization Constants:** The prompt mentions avoiding bias from high-neuron-count fish. If a normalization script is missing, you may need to add a line to divide the contribution of each fish by its total cell count before aggregating.
*   **Permutation Baseline:** The code must contain a mechanism to generate the "null" distribution to satisfy the $P < 0.025$ requirement; if no `permutation_test.py` exists, you will need to implement a simple shuffle-based significance test.