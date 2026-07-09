# Reproduction Plan for I_aim_to_depict_the_spatial_distribution_of_individual_neuro

To depict the spatial distribution of functional neurons across zebrafish larvae, you must implement a custom spatial analysis pipeline. As established, the provided `snat` repository focuses on morphological clustering and network graph theory, which lacks the necessary spatial statistical functions for this task.

### Prerequisites
1.  **Environment:** Python 3.8+ with `numpy`, `scipy`, `numba` (for optimized kernel estimation), and `nibabel` (for loading atlas NIfTI files).
2.  **Data Structure:** Ensure every fish folder contains the required `.npy` files. If a folder is missing `correlated_motor.npy`, the script must handle the exception gracefully.
3.  **Atlas Data:** You need the `atlas/` folder containing the reference brain mask (usually a binary NIfTI file) to define the anatomical boundaries.

---

### Step-by-Step Procedure

| Step | Action | Paper Ref | Code Ref | Input | Output | Parameters | Validation |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **1** | **Aggregate Coordinates** | Spatial Registration | None | All `*.npy` files | Combined $(X, Y, Z)$ arrays | Root path | Check for `NaN` values in coordinates. |
| **2** | **Define Atlas Mask** | Spatial Atlas Reg. | None | `atlas/mask.nii` | Boolean 3D array | Resampling voxel size | Ensure atlas bounds match data coordinate system. |
| **3** | **Compute KDE** | Spatial Density Analysis | `scipy.stats.gaussian_kde` | Neuron $(X, Y, Z)$ | Probability Density Volume | Bandwidth ($h$) | Check if probability sums to 1. |
| **4** | **Null Model Gen** | Stat. Mapping | `numpy.random` | Brain mask coordinates | Null Density Distribution | 1000+ permutations | Ensure null volume matches anatomical mask. |
| **5** | **Apply Threshold** | Statistical Thresholding | Comparison operators | Observed KDE & Null | Thresholded Mask | $P < 0.025$ | Verify significant voxels form continuous clusters. |

---

### Detailed Implementation Workflow

#### Step 1 & 2: Data Aggregation and Normalization
Iterate through all directories. Use `numpy.load()` to read files. If a directory lacks `correlated_motor.npy`, skip it using a `try-except` block. Normalize coordinates to the pixel-space dimensions of your Z-Brain atlas volume.

#### Step 3: Kernel Density Estimation (KDE)
Use a 3D Gaussian kernel.
*   **Action:** Apply `scipy.stats.gaussian_kde` to the concatenated list of coordinates for each category (e.g., all `correlated_light` neurons).
*   **Constraint:** You must evaluate the density over the grid defined by your atlas dimensions.

#### Step 4: Permutation Testing
To calculate the $P < 0.025$ threshold:
1.  **Shuffle:** Randomly redistribute the total number of observed neurons for a category within the brain mask volume.
2.  **Density Calculation:** Compute the KDE for the shuffled set.
3.  **Distribution:** Repeat this $N$ times (e.g., $N=1000$) to create a distribution of null densities for every voxel.
4.  **Threshold:** The $P < 0.025$ threshold is the 97.5th percentile of this null distribution.

#### Step 5: Masking
Perform a voxel-wise comparison: `Significant_Voxels = Observed_KDE > Null_97.5th_Percentile`.

---

### Expected Output
*   **Density Maps:** A 3D NIfTI or `.npy` file for each category (Motor, Anticorrelated-Motor, Dark, Light) representing the significant spatial probability density.
*   **Visualizations:** 2D projections (Maximum Intensity Projections) of these maps overlayed on the reference atlas template to visualize functional hotspots.

---

### Troubleshooting
*   **Disjointed Clusters:** If your thresholded maps appear as single, isolated pixels, your KDE bandwidth is too small. Increase the `bw_method` parameter in `gaussian_kde`.
*   **Memory Issues:** If you have tens of thousands of neurons, calculating the KDE over a high-resolution grid (e.g., $512^3$) will crash your RAM. Downsample the atlas resolution (e.g., binning into $5\mu m$ voxels) before KDE estimation.
*   **Empty Results:** If the $P < 0.025$ threshold clears the entire map, it suggests the spatial distribution of your neurons is uniform (randomly distributed) rather than clustered. Re-check the coordinate registration process.
*   **Handling Files:** Ensure the naming convention is consistent. If specific folders use different keys, implement a mapping dictionary: `category_map = {"motor": "correlated_motor.npy", ...}`.