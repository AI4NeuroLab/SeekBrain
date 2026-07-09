# Reproduction Plan for I_aim_to_depict_the_spatial_distribution_of_individual_neuro

This reproduction plan outlines the workflow to aggregate functional neuronal data into a common zebrafish atlas and apply statistical spatial thresholding to identify conserved neural populations.

---

## Prerequisites
*   **Environment:** Python 3.8+ with `numpy`, `scipy`, `scikit-learn`, `nibabel` (for atlas volumes), and `matplotlib`/`mayavi` (for visualization).
*   **Data Structure:** Ensure the root directory contains a folder for each fish (e.g., `fish_01`, `fish_02`) and a global `/atlas` directory containing `template.nrrd` (or equivalent) and registration transformation files.
*   **Registration Matrices:** Pre-calculated affine/deformable transformation matrices for each fish (e.g., `warp.npy` or `transform.mat`) must exist to map local functional coordinates to the global atlas.

---

## Step-by-Step Procedure

| Step | Action | Paper Reference | Code Reference | Input | Output |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **1. Aggregation** | Iterate through folders; load `.npy` files conditionally. | "Functional Classification" | `glob.glob()`, `os.path.exists()` | File paths per fish | Aggregated list of point clouds |
| **2. Transformation** | Map local `(x, y, z)` coordinates to atlas coordinates. | "3D Atlas Registration" | Matrix multiplication function | Raw coordinates + `warp` matrix | Atlas-registered coordinates |
| **3. Density KDE** | Compute 3D Kernel Density Estimation (KDE) over the atlas volume. | "Spatial Density Estimation" | `scipy.stats.gaussian_kde` | Registered points | Voxel-wise density map |
| **4. Permutation** | Shuffle neuronal labels across the atlas to generate null distribution. | "Statistical Thresholding" | `numpy.random.permutation()` | Randomly shuffled coordinates | Null density map |
| **5. Filtering** | Apply $P < 0.025$ mask: $Density_{obs} > Percentile_{null}(97.5)$. | "Significance test" | Boolean indexing | Density map + Null map | Thresholded spatial map |

### Step Details
*   **Step 1 (Aggregation):** Initialize an empty dictionary for each category (e.g., `{'motor': [], 'dark': [], 'light': []}`). Use `os.path.exists` to check for `correlated_motor.npy`. If missing, skip for that fish.
*   **Step 2 (Transformation):** For each neuron point $P_i$, perform $P_{atlas} = M_{affine} \times P_{local}$. Ensure coordinates are clipped to the dimensions of the atlas volume.
*   **Step 3 (KDE):** Set the bandwidth parameter ($h$) proportional to the expected spread of anatomical clusters (e.g., 5-10 microns).
*   **Step 4 (Permutation):** Repeat the density calculation 1,000–5,000 times by shuffling the "fish ID" label to break spatial correlation while maintaining the global distribution.
*   **Step 5 (Filtering):** Generate a binary mask where voxels exceed the 97.5th percentile of the null distribution. Apply this mask to the observed density map.

---

## Expected Output
1.  **Consolidated NPY files:** Aggregated, transformed coordinates for each functional category in atlas space.
2.  **Density Maps:** 3D volumes (e.g., `.nrrd` or `.nii` files) representing the significant spatial density of each neuron category.
3.  **Visualization:** Heatmaps of the atlas showing significant neuronal clusters, overlaid on the reference anatomy.

---

## Troubleshooting

*   **Disproportionate Clusters:** If one fish dominates the density map, apply **per-fish normalization**: Divide the number of neurons in each fish by its total detected count before aggregating.
*   **Registration Mismatch:** If clusters appear smeared or shifted across the midline, verify the `atlas` coordinate system (e.g., ensure the origin `[0,0,0]` is consistent between the atlas mask and the registration matrix).
*   **High Memory Consumption:** Processing all points simultaneously may cause crashes. Process one functional category at a time or use a sparse grid representation for the KDE.
*   **Low Significance:** If the $P < 0.025$ filter removes everything, your KDE bandwidth is likely too small, causing the null model's density to be too sparse. Increase the bandwidth (smoothing factor).

---

## Validation
*   **Consistency Check:** Compare the count of raw neurons processed versus the count of neurons successfully mapped to the atlas. Loss should be $< 5\%$ due to boundary cropping.
*   **Null-Model sanity:** The distribution of the null density should be uniform across the brain mask. If it shows bias, the permutation is not correctly shuffling spatial indices.