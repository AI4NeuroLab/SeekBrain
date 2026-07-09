# Zebrafish SC vs FC Node Degree Atlas Comparison

## Description
This skill computes weighted node degrees from structural connectivity (SC) and functional connectivity (FC) matrices of the zebrafish brain, then visualizes both degree distributions simultaneously on a dorsal brain atlas projection. By placing structural degrees on the left hemisphere and functional degrees on the right hemisphere, the visualization enables direct spatial comparison of connectivity hubs across modalities. This addresses the question of how physical connectivity predicts correlated neural activity by revealing whether structurally well-connected regions are also functionally well-connected.

## Tags
- zebrafish
- structural connectivity
- functional connectivity
- node degree
- brain atlas
- graph theory
- network neuroscience
- connectomics
- calcium imaging
- bilateral comparison
- weighted degree
- z-score normalization

## Input
- **SC matrix**: `SC_matrix_undirected_terminals_expanded.npy` — A 70×70 undirected structural connectivity matrix with terminal-based edge weights.
- **FC matrix**: `PROCESS_DATA_DIR/Figure1_FC_matrix.npy` — A functional connectivity (correlation) matrix, either 70×70 or pre-filtered.
- **Excluded regions**: `PROCESS_DATA_DIR/Figure1_excluded_regions.npy` — Integer array of region indices to exclude from analysis.
- **Zebrafish brain atlas**: Atlas folder containing the `MapzebrainAtlas` class data, including XY projection image and region centroids for left and right hemispheres.

## Output
- **SC degree vector**: `PROCESS_DATA_DIR/Figure2_Node_degree_SC.npy` — Weighted structural degree per node (after exclusion filtering).
- **FC degree vector**: `PROCESS_DATA_DIR/Figure2_Node_degree_FC.npy` — Weighted functional degree per node (after exclusion filtering).
- **Figure**: `SAVE_DIR/figure_refine.png` — Dorsal atlas projection with bilateral scatter overlay showing z-scored SC degrees (left hemisphere) and z-scored FC degrees (right hemisphere).

## Algorithm / Processing Steps

### 1. Data Loading & Preprocessing
1. Load the 70×70 SC matrix, FC matrix, and excluded region indices.
2. Create a boolean keep-mask for the original 70 regions, setting excluded region indices to `False`.
3. Filter rows and columns from both SC and FC matrices using the keep-mask.
4. Robustness check: if the FC matrix appears already filtered (shape matches expected filtered size), skip filtering.
5. Verify that SC and FC matrices have identical shapes after preprocessing.

### 2. Weighted Node Degree Computation
1. **SC Degree**: Sum each row of the filtered SC matrix to get the weighted structural degree per node.
2. **FC Degree**: Zero out the diagonal of the filtered FC matrix (to remove self-correlations), take absolute values, and sum each row for the weighted functional degree per node.
3. Replace any NaN values with zero using `nan_to_num`.
4. Save both degree vectors as `.npy` files.

### 3. Atlas Preparation
1. Initialize the `MapzebrainAtlas` with the atlas path.
2. Extract left and right hemisphere region centroids (each 70 regions).
3. Concatenate into a single 140-element centroid array.
4. Flip Y-coordinates for display orientation (`y = 974 - y`).
5. Create a bilateral exclusion mask (excluding same indices from both left [0–69] and right [70–139] halves).
6. Split filtered centroids back into left and right hemisphere subsets.

### 4. Visualization
1. Display the dorsal (XY) atlas projection as a grayscale background (`cmap='binary'`).
2. Overlay left hemisphere centroids colored by z-scored SC degrees.
3. Overlay right hemisphere centroids colored by z-scored FC degrees.
4. Use inverted Blues colormap (`Blues_r`): dark blue = low degree, white = high degree.
5. Set color limits to `[-3, 2]` for consistent mapping.
6. Add "Structural" and "Functional" labels below respective hemispheres.
7. Add a vertical colorbar on the left side labeled "Weighted degree" with no ticks.

## Key Parameters
| Parameter | Value | Description |
|-----------|-------|-------------|
| `n_original` | 70 | Total number of brain regions in the atlas |
| Marker size | 55 | Scatter plot marker size |
| Marker edge | black, linewidth=1.0 | Black edge around each marker |
| Colormap | `Blues_r` | Inverted Blues (dark blue=low, white=high) |
| Color limits | `vmin=-3, vmax=2` | Z-score range for color mapping |
| Y-flip constant | 974 | Used to flip Y-axis for correct dorsal view orientation |
| Figure DPI | 300 | High-resolution output |
| Figure size | (10, 8) | Figure dimensions in inches |
| Colorbar position | `[0.05, 0.35, 0.02, 0.3]` | `[x, y, width, height]` in figure coordinates |

## Usage Example
```python
import os
import numpy as np
from scipy.stats import zscore
import matplotlib.pyplot as plt

# Set paths
PROCESS_DATA_DIR = os.getenv("PROCESS_DATA_DIR")
ZEBRAFISH_PATH = os.getenv("ZEBRAFISH_PATH")
ATLAS_PATH = os.getenv("ATLAS_PATH")

# Load data
SC = np.load(os.path.join(ZEBRAFISH_PATH, "Files", "SC_matrix_undirected_terminals_expanded.npy"))
FC = np.load(os.path.join(PROCESS_DATA_DIR, "Figure1_FC_matrix.npy"))
excluded = np.load(os.path.join(PROCESS_DATA_DIR, "Figure1_excluded_regions.npy")).astype(int)

# Filter matrices
keep = np.ones(70, dtype=bool)
keep[excluded] = False
SC_f = SC[keep][:, keep]
FC_f = FC[keep][:, keep] if FC.shape[0] == 70 else FC

# Compute degrees
SC_degree = np.sum(SC_f, axis=1)
FC_temp = FC_f.copy(); np.fill_diagonal(FC_temp, 0)
FC_degree = np.sum(np.abs(FC_temp), axis=1)

# Z-score and visualize on atlas
SC_z = zscore(SC_degree)
FC_z = zscore(FC_degree)
# ... (overlay on atlas as shown in full pipeline)
```

## Dependencies
- `numpy` — Matrix operations, file I/O
- `matplotlib` — Plotting and visualization
- `scipy.stats.zscore` — Z-score normalization
- `zebrafish_Ca_utils.MapzebrainAtlas` — Custom zebrafish brain atlas class (provides XY projection image and region centroids)

## Limitations
- Assumes exactly 70 brain regions in the original atlas; hardcoded `n_original = 70` and Y-flip constant `974`.
- The FC degree computation uses absolute values of correlations, which treats anti-correlations equivalently to positive correlations.
- The diagonal of the FC matrix is zeroed before degree computation, but the SC matrix diagonal is not explicitly handled.
- The bilateral visualization is qualitative only; no quantitative correlation between SC and FC degrees is computed.
- The color limit range `[-3, 2]` is asymmetric and may clip extreme values.
- Region centroid coordinates are atlas-specific and may not generalize to other zebrafish atlases.
- The skill does not account for potential differences in matrix sparsity between SC and FC when comparing degrees.

## Source
Pipeline for analyzing structural-functional connectivity relationships in the zebrafish brain, comparing weighted node degrees across modalities using the Mapzebrain atlas framework.