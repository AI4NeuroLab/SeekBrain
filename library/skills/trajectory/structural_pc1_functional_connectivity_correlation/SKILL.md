# Structural PC1 vs Functional Connectivity Correlation Analysis

## Description
This skill investigates whether structural connectivity properties collectively contribute to functional connectivity (FC) in the zebrafish brain. It computes structural predictors from directed and undirected structural connectivity (SC) matrices and inter-regional Euclidean distances, performs PCA to extract the first principal component (PC1) of these predictors, reshapes it into a region×region matrix, and correlates it with the FC matrix using Pearson correlation. The PC1 matrix is sign-aligned to be positively oriented with FC. A composite visualization displays the normalized FC (upper triangle) and normalized structural PC1 (lower triangle) separated by a white diagonal line, enabling direct visual comparison of structural and functional patterns.

## Tags
- zebrafish
- functional connectivity
- structural connectivity
- PCA
- principal component analysis
- Pearson correlation
- composite heatmap
- brain atlas
- inter-regional distance
- connectivity matrix
- structural predictors
- region exclusion

## Input
- **FC matrix**: `PROCESS_DATA_DIR/Figure1_FC_matrix.npy` — Functional connectivity matrix (regions × regions).
- **Directed SC matrix**: `ZEBRAFISH_PATH/Files/SC_matrix_directed_terminals_expanded.npy` — Directed structural connectivity matrix.
- **Undirected SC matrix**: `ZEBRAFISH_PATH/Files/SC_matrix_undirected_terminals_expanded.npy` — Undirected structural connectivity matrix.
- **Excluded regions**: `PROCESS_DATA_DIR/Figure1_excluded_regions.npy` — Integer array of region indices to exclude from all matrices.
- **Brain atlas**: Loaded via `MapzebrainAtlas(ATLAS_PATH)` to compute inter-regional Euclidean distances from region centroids (average of left and right hemisphere centroids).

## Output
- **Saved PC1 matrix**: `PROCESS_DATA_DIR/Figure2_SC_predictor_PC1.npy` — The sign-aligned structural PC1 matrix (regions × regions, diagonal zeroed).
- **Composite heatmap**: `SAVE_DIR/figure_refine.png` — A composite matrix image with normalized FC in the upper triangle and normalized structural PC1 in the lower triangle, separated by a white diagonal line, with an inverted Blues colormap and a "Normalized weight" color bar.
- **Statistics JSON**: `SAVE_DIR/statistics.json` — Contains `pearson_r` (Pearson correlation coefficient) and `pearson_p_value` between the upper-triangular elements of the PC1 and FC matrices.

## Algorithm / Processing Steps
1. **Load data**: Load the FC matrix, directed SC matrix, undirected SC matrix, and excluded regions array from disk.
2. **Compute inter-regional distances**: Load the zebrafish brain atlas via `MapzebrainAtlas`, average left and right hemisphere centroids, and compute pairwise Euclidean distances using `scipy.spatial.distance.pdist` and `squareform`.
3. **Exclude regions**: Remove rows and columns corresponding to excluded region indices from all connectivity and distance matrices. Verify that all matrices share the same dimensions.
4. **Compute structural predictors**: Instantiate the `Predictors` class (from `zebrafish_Ca_utils_predictors_xps`) with the filtered directed SC, undirected SC, and distance matrices. Call `model.compute_predictors(directed=True)` to generate the predictor feature matrix.
5. **PCA dimensionality reduction**: Apply `sklearn.decomposition.PCA` with `n_components=10` to `model.predictors`. Extract the first principal component (PC1).
6. **Reshape PC1**: Reshape the PC1 vector into a square matrix of size (n_regions × n_regions). Set diagonal to zero.
7. **Correlation and sign alignment**: Compute Pearson correlation between the upper-triangular elements (excluding diagonal) of the PC1 matrix and the FC matrix. Multiply the PC1 matrix by the sign of this correlation to ensure positive orientation with FC.
8. **Save PC1 matrix**: Save the sign-aligned PC1 matrix to disk.
9. **Visualization**:
   - Normalize both PC1 and FC matrices to [0, 1] range independently.
   - Build a composite matrix: lower triangle = normalized PC1, upper triangle = normalized FC.
   - Display with `imshow` using `cmap='Blues_r'` and `aspect='equal'`.
   - Draw a thick white line (linewidth=5) along the main diagonal.
   - Add a color bar labeled "Normalized weight" (no ticks).
   - Label y-axis "Brain regions" with ticks at 1 and the last region index.
   - Add text labels: "Functional connectivity" near upper-right, "Structural PC1" near lower-left.
10. **Save statistics**: Export Pearson r and p-value to a JSON file.

## Key Parameters
| Parameter | Value | Description |
|---|---|---|
| `n_components` (PCA) | 10 | Number of principal components extracted from structural predictors |
| `directed` | `True` | Use directed SC information for computing predictors |
| `metric` (distance) | `'euclidean'` | Metric for computing inter-regional distances from centroids |
| `cmap` | `'Blues_r'` | Inverted Blues colormap for composite heatmap |
| `diagonal linewidth` | 5 | Width of the white diagonal separator line |
| `figure dpi` | 300 | Resolution of saved figure |
| `figure size` | (6, 5.5) | Figure dimensions in inches |

## Usage Example
```python
import os
import sys
import numpy as np
from scipy.spatial.distance import pdist, squareform
from sklearn.decomposition import PCA
from scipy.stats import pearsonr

sys.path.append("/path/to/library/code")
from zebrafish_Ca_utils import MapzebrainAtlas
from zebrafish_Ca_utils_predictors_xps import *

# Load matrices
FC_matrix = np.load("FC_matrix.npy").astype(float)
SC_directed = np.load("SC_matrix_directed_terminals_expanded.npy").astype(float)
SC_undirected = np.load("SC_matrix_undirected_terminals_expanded.npy").astype(float)
excluded = np.load("excluded_regions.npy").astype(int)

# Compute distances from atlas
atlas = MapzebrainAtlas("/path/to/atlas")
centroids = 0.5 * (np.asarray(atlas.regionCentroids["left"]) + np.asarray(atlas.regionCentroids["right"]))
dist_matrix = squareform(pdist(centroids, "euclidean"))

# Remove excluded regions from all matrices
# ... (filter rows/columns)

# Compute predictors and PCA
model = Predictors(SC_dir_filtered, SC_und_filtered, dist_filtered)
model.compute_predictors(directed=True)
pca = PCA(n_components=10)
PC1 = pca.fit_transform(model.predictors)[:, 0]
PC1_mat = PC1.reshape(n, n)
np.fill_diagonal(PC1_mat, 0)

# Sign-align with FC
ui = np.triu_indices(n, k=1)
r, p = pearsonr(PC1_mat[ui], FC_matrix[ui])
PC1_mat *= np.sign(r)
```

## Dependencies
- **Python packages**: `numpy`, `scipy` (stats, spatial.distance), `sklearn` (decomposition.PCA), `matplotlib`
- **Custom libraries**: `zebrafish_Ca_utils.MapzebrainAtlas` — for loading the zebrafish brain atlas and region centroids; `zebrafish_Ca_utils_predictors_xps.Predictors` — for computing structural connectivity predictors from SC matrices and distance
- **Data files**: FC matrix, directed and undirected SC matrices, excluded regions array, zebrafish brain atlas

## Limitations
- Assumes all input matrices share the same region ordering consistent with the atlas.
- Only the first principal component (PC1) is used for the final correlation and visualization; higher PCs may capture additional variance.
- The `Predictors` class and its `compute_predictors` method are specific to the zebrafish calcium imaging analysis pipeline and are not standard libraries.
- Normalization to [0, 1] range may obscure the magnitude of differences between FC and PC1 values.
- Pearson correlation on upper-triangular elements treats all region pairs equally regardless of spatial proximity or modular structure.
- NaN handling is minimal; if many NaN values exist, the correlation and visualization may be biased.

## Source
Derived from a zebrafish whole-brain functional and structural connectivity analysis pipeline examining whether structural properties collectively predict functional connectivity via PCA-based dimensionality reduction and Pearson correlation analysis.