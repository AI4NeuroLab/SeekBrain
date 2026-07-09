# Structural Predictor Variance Analysis for Zebrafish Brain Connectivity

## Description
This skill evaluates how various graph-theoretical structural predictors (derived from structural connectivity matrices) explain the variance in functional connectivity (FC) relative to a baseline structural connectivity (SC) correlation. It uses directed and undirected SC matrices along with a zebrafish brain atlas to compute inter-regional distances and a suite of topological network predictors. Each predictor is correlated with the FC matrix, and the resulting explained variance (R²) is compared against a baseline R² obtained from the direct undirected SC–FC Pearson correlation. The final output is a bar chart showing the relative change in explained variance (ΔR²) for each structural predictor, revealing which graph metrics are stronger or weaker predictors of functional connectivity than the raw structural weights.

## Tags
- zebrafish
- structural connectivity
- functional connectivity
- graph theory
- explained variance
- Pearson correlation
- brain atlas
- network predictors
- matching index
- communicability
- shortest path
- degree
- strength
- calcium imaging
- connectomics
- bar chart

## Input
- **FC matrix**: `PROCESS_DATA_DIR/Figure1_FC_matrix.npy` — Symmetric functional connectivity matrix (regions × regions).
- **Directed SC matrix**: `SC_matrix_directed_terminals_expanded.npy` — Directed structural connectivity matrix from the data root directory.
- **Undirected SC matrix**: `SC_matrix_undirected_terminals_expanded.npy` — Undirected (symmetric) structural connectivity matrix from the data root directory.
- **Excluded regions**: `PROCESS_DATA_DIR/Figure1_excluded_regions.npy` — Integer index array of brain regions to exclude from analysis.
- **Zebrafish brain atlas**: Atlas folder containing region centroids (left and right hemispheres) loaded via `MapzebrainAtlas`.

## Output
- **Predictor names**: `PROCESS_DATA_DIR/Figure2_SC_predictor_names.npy` — Array of structural predictor name strings.
- **Predictor matrices**: `PROCESS_DATA_DIR/Figure2_SC_predictors.npy` — Array of predictor matrices (one per metric).
- **Single predictor R² values**: `PROCESS_DATA_DIR/Figure2_SC_predictor_rsquared_single.npy` — R² for each predictor's correlation with FC.
- **Baseline R²**: `PROCESS_DATA_DIR/Figure2_SC_predictor_rsquared_baseline.npy` — Scalar R² from undirected SC–FC correlation.
- **Bar chart**: `SAVE_DIR/figure_refine.png` — Publication-quality bar chart of ΔR² per predictor.
- **Statistics JSON**: `SAVE_DIR/statistics.json` — JSON file containing baseline R² and per-predictor relative R² values.

## Algorithm / Processing Steps
1. **Load data**: Load FC matrix, directed SC matrix, undirected SC matrix, excluded regions index array, and the zebrafish brain atlas.
2. **Compute inter-regional distances**: Average left and right hemisphere centroids from the atlas, then compute pairwise Euclidean distance matrix using `scipy.spatial.distance.pdist` and `squareform`.
3. **Remove excluded regions**: Create a boolean keep mask over all atlas regions, setting excluded region indices to False. Apply this mask to filter rows and columns of SC (directed and undirected), distance, and FC matrices. Handle the case where FC may already be pre-filtered.
4. **Zero diagonals**: Set diagonal elements of all filtered matrices to zero.
5. **Instantiate Predictors model**: Use the `Predictors` class (from `zebrafish_Ca_utils_predictors_xps`) with the filtered directed SC, undirected SC, and distance matrices. Pass `excluded=None` since exclusion was done manually. Set `directed=True`.
6. **Compute structural predictors**: Call `compute_predictors(directed=True)` to generate all graph-theoretical predictor matrices (e.g., degree, strength, shortest path, communicability, matching index, search information, mean first passage time, etc.).
7. **Save predictor names and matrices** to `.npy` files.
8. **Correlate each predictor with FC**: Extract upper-triangle elements (k=1) from both the FC matrix and each predictor matrix. Compute Pearson correlation using `scipy.stats.pearsonr`, handling NaN/Inf values. Square the correlation coefficient to get R².
9. **Compute baseline R²**: Correlate upper-triangle elements of the filtered undirected SC matrix with the FC matrix using Pearson correlation. Square to obtain baseline R².
10. **Compute relative explained variance**: Subtract baseline R² from each single-predictor R² to get ΔR².
11. **Visualize**: Plot a bar chart of ΔR² values with black bars (width=0.5), a horizontal reference line at zero, vertical x-axis labels, cleaned spines (no top/right), and y-axis labeled "△Exp. var."

## Key Parameters
| Parameter | Description | Default/Value |
|---|---|---|
| `directed` | Whether to use directed SC for predictor computation | `True` |
| `excluded` | Regions to exclude (passed as None if pre-filtered) | `None` (manual filtering) |
| `metric` | Distance metric for inter-regional distances | `'euclidean'` |
| `k` (triu) | Offset for upper triangle extraction (excludes diagonal) | `1` |
| Bar color | Color for the bar chart bars | `'black'` |
| Bar width | Width of bars in the chart | `0.5` |
| Reference line width | Linewidth of the horizontal zero line | `0.75` |
| X-tick rotation | Rotation angle for predictor name labels | `90°` |
| X-tick fontsize | Font size for predictor name labels | `7` |

## Usage Example
```python
import os
import numpy as np
from zebrafish_Ca_utils import MapzebrainAtlas
from zebrafish_Ca_utils_predictors_xps import *
from scipy.spatial.distance import pdist, squareform
from scipy.stats import pearsonr

# Load matrices
fc = np.load("Figure1_FC_matrix.npy")
sc_dir = np.load("SC_matrix_directed_terminals_expanded.npy")
sc_und = np.load("SC_matrix_undirected_terminals_expanded.npy")
excluded = np.load("Figure1_excluded_regions.npy").astype(int)

# Atlas distances
atlas = MapzebrainAtlas("path/to/Atlas")
centroids = 0.5 * (np.array(atlas.regionCentroids["left"]) + np.array(atlas.regionCentroids["right"]))
dist_mat = squareform(pdist(centroids, "euclidean"))

# Filter excluded regions
keep = np.ones(dist_mat.shape[0], dtype=bool)
keep[excluded] = False
sc_dir_f = sc_dir[keep][:, keep]
sc_und_f = sc_und[keep][:, keep]
dist_f = dist_mat[keep][:, keep]
fc_f = fc  # if already filtered

# Compute predictors
model = Predictors(A_dir=sc_dir_f, A_und=sc_und_f, ED=dist_f, excluded=None, directed=True)
model.compute_predictors(directed=True)

# Correlate with FC
ui = np.triu_indices(fc_f.shape[0], k=1)
fc_flat = fc_f[ui]
r2_single = np.array([pearsonr(fc_flat, m[ui])[0]**2 for m in model.predictors_list])
r2_base = pearsonr(fc_flat, sc_und_f[ui])[0]**2
delta_r2 = r2_single - r2_base
```

## Dependencies
- `numpy`
- `scipy` (stats.pearsonr, spatial.distance.pdist, squareform)
- `matplotlib`
- `zebrafish_Ca_utils` (MapzebrainAtlas for brain atlas loading)
- `zebrafish_Ca_utils_predictors_xps` (Predictors class for graph metric computation)

## Limitations
- Relies on the custom `zebrafish_Ca_utils_predictors_xps` module and its `Predictors` class; the specific set of computed graph predictors depends entirely on that library's implementation.
- Inter-regional distances are computed as Euclidean distances between averaged left/right hemisphere centroids, which is an approximation.
- Pearson correlation captures only linear relationships between predictors and FC; nonlinear associations are not assessed.
- The baseline comparison uses undirected SC only; directed SC baseline is not independently evaluated.
- Assumes matrices are aligned to the same atlas region ordering; misalignment would produce erroneous results.
- Predictor matrices must have consistent shapes; NaN handling is minimal (basic finite check).
- The ΔR² metric can be negative, indicating the predictor explains less variance than the raw SC, but this does not account for predictor redundancy or multicollinearity.

## Source
Analysis pipeline for zebrafish whole-brain structural and functional connectivity, comparing graph-theoretical structural predictors against functional connectivity. Based on calcium imaging functional data and structural connectivity from axonal tracing, registered to the Mapzebrain atlas.