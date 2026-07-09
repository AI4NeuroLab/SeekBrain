# Structural Connectivity PCA Explained Variance Analysis

## Description
This skill quantifies how structural connectivity (SC) properties collectively contribute to functional connectivity by performing Principal Component Analysis (PCA) on SC-derived predictor matrices. It loads directed and undirected structural connectivity matrices from a zebrafish brain dataset, filters out excluded brain regions, computes inter-regional Euclidean distances from atlas centroids, instantiates a structural predictor model, extracts the first 10 principal components, and produces a scree/cumulative variance plot. The visualization reveals how many structural dimensions are needed to explain the majority of variance, indicating the effective dimensionality of the structural network.

## Tags
- zebrafish
- structural connectivity
- PCA
- explained variance
- scree plot
- brain atlas
- functional connectivity prediction
- dimensionality reduction
- neuroscience
- connectomics

## Input
- **SC_matrix_directed_terminals_expanded.npy**: Directed structural connectivity matrix (N×N) representing anatomical projections between brain regions.
- **SC_matrix_undirected_terminals_expanded.npy**: Undirected structural connectivity matrix (N×N) representing symmetric anatomical connections.
- **Zebrafish brain atlas** (via `MapzebrainAtlas`): Provides regional centroid coordinates for computing inter-regional distances.
- **Figure1_excluded_regions.npy** (from `PROCESS_DATA_DIR`): Integer index array specifying brain regions to exclude from analysis.

### Environment Variables
- `ZEBRAFISH_PATH`: Root path to zebrafish data files (SC matrices in `Files/` subdirectory).
- `ATLAS_PATH`: Path to the zebrafish brain atlas data.
- `PROCESS_DATA_DIR`: Path for intermediate/processed data (excluded regions input, explained variance output).
- `SAVE_DIR`: Path for saving the output figure.

## Output
- **Figure2_SC_predictor_PCA_expvar.npy**: NumPy array of shape (10,) containing the explained variance ratios for the first 10 principal components.
- **figure_refine.png**: A 5×4 inch plot showing:
  - Medium violet-red line with markers: per-component explained variance ratio.
  - Black line with markers: cumulative explained variance.
  - Text annotation of PC1's exact explained variance value.
  - Curve labels ("Ratio" and "Cumulative") placed near the respective lines.

## Algorithm / Processing Steps
1. **Load Data**: Load directed and undirected SC matrices and the excluded regions index array.
2. **Compute Distances**: Load the zebrafish brain atlas, average left and right hemisphere centroids, and compute pairwise Euclidean distance matrix using `scipy.spatial.distance.pdist`.
3. **Remove Excluded Regions**: Create a boolean mask from the excluded region indices and remove corresponding rows and columns from the directed SC, undirected SC, and distance matrices.
4. **Instantiate Predictor Model**: Create a `Predictors` object (from `zebrafish_Ca_utils_predictors_xps`) with the filtered directed SC, undirected SC, and distance matrices.
5. **Compute Structural Predictors**: Call `model.compute_predictors(directed=True)` to derive structural predictor features from the directed connectivity.
6. **PCA Decomposition**: Fit `sklearn.decomposition.PCA` with `n_components=10` on `model.predictors` to extract the first 10 principal components.
7. **Save Results**: Save the explained variance ratios to disk.
8. **Visualize**: Plot per-component and cumulative explained variance with annotations, labels, and clean styling (no top/right spines).

## Key Parameters
| Parameter | Value | Description |
|---|---|---|
| `n_components` | 10 | Number of principal components to extract |
| `directed` | True | Use directed SC information for predictor computation |
| `figsize` | (5, 4) | Figure dimensions in inches |
| `y-axis range` | [-0.05, 1.05] | Y-axis limits for the explained variance plot |
| `marker` | 'o' | Circular point markers on both curves |
| `Ratio line color` | mediumvioletred | Color for the per-component variance curve |
| `Cumulative line color` | black | Color for the cumulative variance curve |

## Usage Example
```python
import os, sys
import numpy as np
from sklearn.decomposition import PCA
from scipy.spatial.distance import pdist, squareform

sys.path.append("/path/to/library/code")
from zebrafish_Ca_utils import MapzebrainAtlas
from zebrafish_Ca_utils_predictors_xps import *

# Load matrices
sc_directed = np.load("SC_matrix_directed_terminals_expanded.npy", allow_pickle=True).astype(float)
sc_undirected = np.load("SC_matrix_undirected_terminals_expanded.npy", allow_pickle=True).astype(float)
excluded = np.load("Figure1_excluded_regions.npy").astype(int)

# Compute distances from atlas
atlas = MapzebrainAtlas("/path/to/atlas")
centroids = 0.5 * (np.asarray(atlas.regionCentroids["left"], dtype=float) +
                    np.asarray(atlas.regionCentroids["right"], dtype=float))
dist_mat = squareform(pdist(centroids, metric="euclidean"))

# Remove excluded regions
mask = np.ones(sc_directed.shape[0], dtype=bool)
mask[excluded] = False
sc_d = sc_directed[mask][:, mask]
sc_u = sc_undirected[mask][:, mask]
dist_f = dist_mat[mask][:, mask]

# Compute predictors and PCA
model = Predictors(sc_d, sc_u, dist_f)
model.compute_predictors(directed=True)
pca = PCA(n_components=10).fit(model.predictors)
print("Explained variance ratios:", pca.explained_variance_ratio_)
print("Cumulative:", np.cumsum(pca.explained_variance_ratio_))
```

## Dependencies
- **Python packages**: `numpy`, `matplotlib`, `scikit-learn`, `scipy`
- **Custom libraries**: `zebrafish_Ca_utils` (for `MapzebrainAtlas`), `zebrafish_Ca_utils_predictors_xps` (for `Predictors` class)
- **Data files**: Directed and undirected SC matrices, zebrafish brain atlas, excluded regions array

## Limitations
- The number of principal components is fixed at 10; users analyzing datasets with different effective dimensionality may need to adjust this.
- Relies on pre-computed excluded regions from a prior pipeline step (Figure 1).
- Distance computation assumes bilateral symmetry by averaging left and right hemisphere centroids.
- The `Predictors` class and its `compute_predictors` method are specific to the zebrafish calcium imaging analysis toolkit and may not generalize to other species or modalities without modification.
- The analysis examines variance in the structural predictor space, not directly in functional connectivity; interpretation as contribution to FC requires additional regression or modeling steps.

## Source
Pipeline analyzing accumulative explained variance of zebrafish structural connectivity predictors via PCA, using directed/undirected SC matrices with excluded region filtering and the MapzebrainAtlas framework.
