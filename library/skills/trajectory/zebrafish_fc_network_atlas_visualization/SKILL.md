# Zebrafish Functional Connectivity Network Atlas Visualization

## Description
This skill generates a dual-panel network visualization of group-averaged functional connectivity (FC) in the zebrafish brain. It overlays a centroid-based network graph onto realistic anatomical projection images from the Mapzebrain atlas, providing both dorsal (top/XY) and sagittal (side/XZ) views. The FC matrix is converted into a bilateral representation, excluded regions are removed, and edges are filtered and color-coded by connection strength. The result is a publication-quality figure that communicates the spatial organization of functional connectivity across the zebrafish brain.

## Tags
- zebrafish
- functional connectivity
- brain atlas
- network visualization
- calcium imaging
- Mapzebrain
- graph overlay
- anatomical projection
- neuroscience
- connectomics

## Input
- **FC matrix**: A NumPy `.npy` file containing the group-averaged functional connectivity matrix (regions × regions, one hemisphere). Located at `PROCESS_DATA_DIR/Figure1_FC_matrix.npy`.
- **Excluded regions**: A NumPy `.npy` file containing integer IDs of regions to exclude. Located at `PROCESS_DATA_DIR/Figure1_excluded_regions.npy`.
- **Zebrafish atlas**: A `MapzebrainAtlas` object loaded from `ATLAS_PATH`, providing:
  - Left and right hemisphere centroids (`atlas.centroids['left']`, `atlas.centroids['right']`)
  - XY projection image (`atlas.XYprojection`)
  - XZ projection image (`atlas.XZprojection`)

## Output
- **Figure** (`figure.png`): A dual-panel image (8×6 inches, 300 DPI) with:
  - Left panel (60% width): Top/dorsal view (XY) of the FC network on the atlas.
  - Right panel (40% width): Side/sagittal view (XZ) of the FC network on the atlas.
- **Statistics** (`statistics.json`): JSON file containing:
  - Region counts (original, excluded, filtered)
  - FC matrix dimensions
  - Edge count statistics (total, filtered)
  - Edge weight distribution (min, max, mean, median, percentiles)
  - Spatial extent and centroid statistics (mean, std per axis)
  - Network summary metadata

## Algorithm / Processing Steps

### 1. Data Loading and Preparation
1. Load the FC matrix from `.npy` file.
2. Load excluded region IDs from `.npy` file.
3. Load atlas centroids for left and right hemispheres from `MapzebrainAtlas`.
4. Concatenate left and right hemisphere centroids into a full bilateral array.
5. Adjust Y-coordinates by subtracting from a maximum value (974) to match image orientation.
6. Remove centroids corresponding to excluded regions from both hemispheres (excluded indices are mirrored: left indices and left indices + number_of_regions_per_hemisphere for right).
7. Create a bilateral FC matrix by tiling the per-hemisphere FC matrix into a 2×2 block structure.

### 2. Edge Extraction and Filtering
1. Extract all unique edges from the upper triangle of the bilateral FC matrix (excluding diagonal).
2. Remove zero and NaN weight edges.
3. Compute the 25th percentile of edge weights.
4. Filter out edges below the 25th percentile threshold.
5. Sort remaining edges by weight (ascending) so stronger connections are rendered on top.

### 3. Top View (XY) Rendering
1. Display the atlas XY projection as background using `imshow` with `cmap='binary'`.
2. Create a `LineCollection` from edge segments using X,Y centroid coordinates.
3. Color edges using `cmap='Reds'` with clim `[0.2, 0.9]`, linewidth 0.5, alpha 0.7.
4. Plot nodes as scatter points (white fill, black edge, size 10).
5. Set axis limits: x=[65, 505], y=[850, 50] (inverted).
6. Add "Top" text label at upper-left corner.

### 4. Side View (XZ) Rendering
1. Transform centroids: use inverted Z-coordinate (max_Z - Z) and Y-coordinate.
2. Rotate the XZ projection image 90° clockwise (`np.rot90(img, k=3)`).
3. Create a `LineCollection` with the same edge data using transformed coordinates.
4. Apply identical visual parameters as the top view.
5. Set axis limits: x=[40, 359], y=[850, 50].
6. Add "Side" text label at upper-right corner.

### 5. Statistics Computation
1. Compute edge weight distribution statistics.
2. Compute centroid spatial statistics per axis.
3. Record region counts, matrix dimensions, and visualization parameters.

## Key Parameters
| Parameter | Value | Description |
|---|---|---|
| `figsize` | (8, 6) | Overall figure dimensions in inches |
| Top view width | 60% | Fraction of figure width for top view |
| Side view width | 40% | Fraction of figure width for side view |
| Edge colormap | `'Reds'` | Colormap for edge connection strength |
| Edge clim | [0.2, 0.9] | Color normalization limits for edge weights |
| Edge linewidth | 0.5 | Width of edge lines |
| Edge alpha | 0.7 | Transparency of edge lines |
| Edge filter | 25th percentile | Minimum threshold for displaying edges |
| Node face color | white | Color of node markers |
| Node edge color | black | Color of node marker outlines |
| Node size | 10 | Scatter marker size |
| Top view xlim | [65, 505] | X-axis range for top view |
| Top view ylim | [850, 50] | Y-axis range for top view (inverted) |
| Side view xlim | [40, 359] | X-axis range for side view |
| Side view ylim | [850, 50] | Y-axis range for side view (inverted) |
| Y-coordinate max | 974 | Value used for Y-coordinate inversion |
| Z-coordinate max | 359 | Value used for Z-coordinate inversion |
| Background cmap | `'binary'` | Colormap for anatomical background |
| DPI | 300 | Output figure resolution |

## Usage Example
```python
import os
import numpy as np
from zebrafish_Ca_utils import MapzebrainAtlas

# Set paths
PROCESS_DATA_DIR = "/path/to/processed/data"
ATLAS_PATH = "/path/to/atlas"
SAVE_DIR = "/path/to/output"

# Load data
fc_matrix = np.load(os.path.join(PROCESS_DATA_DIR, "Figure1_FC_matrix.npy"))
excluded_regions = np.load(os.path.join(PROCESS_DATA_DIR, "Figure1_excluded_regions.npy")).astype(int)
atlas = MapzebrainAtlas(ATLAS_PATH)

# ... (follow the processing steps above to generate the figure)
```

## Dependencies
- **Python 3.x**
- **NumPy**: Array operations, data loading
- **Matplotlib**: Figure creation, `imshow`, `scatter`, `LineCollection`
- **zebrafish_Ca_utils** (custom library): `MapzebrainAtlas` class for atlas data access (centroids, projection images)
- **json**: Statistics output serialization

## Limitations
- The skill assumes a specific atlas structure via `MapzebrainAtlas` with `centroids['left']`, `centroids['right']`, `XYprojection`, and `XZprojection` attributes.
- Excluded region indices must correspond to per-hemisphere region IDs (0-indexed within each hemisphere).
- The FC matrix must already be region-averaged (one value per region pair) and correspond to post-exclusion region counts.
- Y and Z coordinate inversion constants (974 and 359) are hard-coded for the specific zebrafish atlas resolution and may need adjustment for different atlas versions.
- The bilateral FC matrix is created by simple tiling, assuming identical inter- and intra-hemispheric connectivity patterns.
- Edge filtering uses a fixed 25th percentile threshold; highly dense or sparse networks may require parameter tuning.
- The visualization is 2D (two orthogonal projections); it does not provide interactive 3D rotation.

## Source
Pipeline for visualizing zebrafish whole-brain functional connectivity networks on the Mapzebrain atlas, producing publication-quality anatomical overlay figures with dorsal and sagittal views.