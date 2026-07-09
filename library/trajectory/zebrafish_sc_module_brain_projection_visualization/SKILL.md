# Zebrafish SC Module Brain Projection Visualization

## Description
This skill visualizes the spatial organization of structural connectivity (SC) modules on zebrafish brain atlas projection images. It maps module assignments from a co-assignment matrix onto brain regional centroids and displays them on both top (dorsal/horizontal, XY plane) and side (sagittal, XZ plane) views of the brain. Each module is color-coded, revealing the anterior-to-posterior topographic organization of structural connectivity modules across the zebrafish brain.

## Tags
- zebrafish
- structural connectivity
- brain atlas
- module visualization
- co-assignment matrix
- brain projection
- spatial mapping
- neuroanatomy
- dorsal view
- sagittal view
- MapzebrainAtlas

## Input
1. **Co-assignment module labels** (`Figure3_coassignment_matrix_SC_4module_ordered.npy`): A 1D NumPy array of integer module labels (1–4) for each brain region, ordered to reflect 4-module partitioning.
2. **Excluded regions** (`Figure1_excluded_regions.npy`): A 1D NumPy array of region IDs (for one hemisphere) to be excluded from visualization.
3. **MapzebrainAtlas**: An atlas object providing:
   - `centroids['left']` and `centroids['right']`: 3D coordinates (X, Y, Z) of regional centroids for each hemisphere.
   - `XYprojection`: Top-view (dorsal) atlas image.
   - `XZprojection` (or `YZprojection`): Side-view atlas image.

## Output
- A high-resolution PNG figure (`figure_refine.png`) with two panels:
  - **Top View**: Dorsal projection with color-coded module nodes.
  - **Side View**: Sagittal projection (rotated 90° clockwise) with the same color-coded nodes.
  - Annotations: panel labels, anterior-posterior arrow, and a color-coded module legend.

## Algorithm / Processing Steps
1. **Load Data**:
   - Load the module labels array from the co-assignment matrix file.
   - Load the list of excluded region IDs.
   - Initialize the `MapzebrainAtlas` and retrieve left/right centroids and projection images.

2. **Prepare Bilateral Centroids**:
   - Concatenate left and right hemisphere centroids into a single bilateral array of shape `(2*N_regions, 3)`.
   - Flip the Y-coordinates (`y = 974 - y`) to match the atlas image orientation.
   - Create an exclusion mask: for each excluded region ID, mark both the left-hemisphere index and the corresponding right-hemisphere index (`id + N_regions_per_hemisphere`) as excluded.
   - Apply the mask to filter out excluded centroids.

3. **Prepare Module Colors**:
   - Double the module labels (concatenate with itself) to create bilateral labels matching the filtered centroids count.
   - Map each module label to its assigned color: Module 1 = Purple (`#8A2BE2`), Module 2 = Cyan (`#00CED1`), Module 3 = Pale Yellow (`#F0E68C`), Module 4 = Red (`#FF0000`).

4. **Top View Rendering**:
   - Display XY projection image with `cmap='binary'` and `aspect='equal'`.
   - Scatter plot centroids using (X, Y) coordinates with module colors, marker size 60, black edges.
   - Set axis limits: x=[65, 505], y=[850, 50] (inverted). Hide axes.

5. **Side View Rendering**:
   - Transform centroids for side view: `X_plot = 359 - Z` (inverted Z), `Y_plot = Y`.
   - Rotate the side projection image 90° clockwise (`np.rot90(image, k=3)`).
   - Display rotated image with `cmap='binary'` and `aspect='equal'`.
   - Scatter plot transformed centroids with same visual parameters.
   - Set axis limits: x=[40, 359], y=[850, 50]. Hide axes.

6. **Annotations**:
   - Add "Top" and "Side" text labels at lower-left corners of respective panels.
   - Add a module legend in the top-right of the side panel with colored numbers 1–4.
   - Draw a double-headed arrow between panels labeled "A" (anterior, top) and "P" (posterior, bottom).

## Key Parameters
| Parameter | Value | Description |
|---|---|---|
| `figsize` | `(8, 6)` | Overall figure dimensions |
| `MODULE_COLORS` | `{1: '#8A2BE2', 2: '#00CED1', 3: '#F0E68C', 4: '#FF0000'}` | Color mapping for 4 modules |
| `marker_size` | `60` | Scatter plot marker size |
| `alpha` | `0.8` | Node transparency |
| `y_flip_constant` | `974` | Value used to invert Y-coordinates |
| `z_inversion_constant` | `359` | Value used to invert Z for side view |
| Top view x-limits | `[65, 505]` | Horizontal crop for top view |
| Top view y-limits | `[850, 50]` | Vertical crop (inverted) for top view |
| Side view x-limits | `[40, 359]` | Horizontal crop for side view |
| Side view y-limits | `[850, 50]` | Vertical crop (inverted) matching top view |
| `rotation_k` | `3` | `np.rot90` parameter for 90° clockwise rotation |

## Usage Example
```python
import os
os.environ["PROCESS_DATA_DIR"] = "/path/to/process_data"
os.environ["SAVE_DIR"] = "/path/to/save"
os.environ["ATLAS_PATH"] = "/path/to/atlas"

# Run the visualization
# Requires: Figure3_coassignment_matrix_SC_4module_ordered.npy
#           Figure1_excluded_regions.npy
# Produces: figure_refine.png in SAVE_DIR
run_visualization()
```

## Dependencies
- `numpy` — array operations, data loading
- `matplotlib` — figure creation, imshow, scatter, annotations
- `matplotlib.patches.FancyArrowPatch` — double-headed anterior-posterior arrow
- `zebrafish_Ca_utils.MapzebrainAtlas` — zebrafish brain atlas (centroids, projection images)

## Limitations
- Hardcoded to exactly 4 modules; would need modification for different module counts.
- Y-flip constant (974) and Z-inversion constant (359) are specific to the Mapzebrain atlas resolution and would need adjustment for different atlas versions.
- Axis limits are empirically tuned for the specific atlas dimensions.
- The side view uses `YZprojection` if available, falling back to `XZprojection`; correctness depends on atlas coordinate conventions.
- Excluded regions are assumed to be indexed identically in both hemispheres (same IDs applied symmetrically).
- Module labels must be pre-ordered (anterior-to-posterior) in the input file for the color scheme to be anatomically meaningful.

## Source
Derived from a zebrafish structural connectivity module analysis pipeline, specifically visualizing the 4-module partition of a co-assignment matrix overlaid on Mapzebrain atlas projections (related to Figure 3 of a connectomics study).