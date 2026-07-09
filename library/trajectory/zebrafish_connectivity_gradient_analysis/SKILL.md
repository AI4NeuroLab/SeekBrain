# Zebrafish Connectivity Gradient Analysis

## Description
This skill applies the diffusion map algorithm to both structural connectivity (SC) and functional connectivity (FC) matrices of the zebrafish brain to extract connectivity gradients. These gradients represent the principal axes of variance in connectivity patterns and can reveal the sensorimotor or hierarchical organization of the brain. The skill computes Pearson correlations between SC and FC gradients to quantify their similarity, and visualizes gradient values as color-coded regional centroids projected onto dorsal (top) and lateral (side) views of the zebrafish brain atlas.

## Tags
- zebrafish
- connectivity gradients
- diffusion mapping
- structural connectivity
- functional connectivity
- brain atlas
- sensorimotor organization
- dimensionality reduction
- spectral embedding
- neuroscience

## Input
- **SC matrix**: `SC_matrix_undirected_terminals_expanded.npy` — A 2D NumPy array (70×70) representing undirected structural connectivity between brain regions.
- **FC matrix**: `PROCESS_DATA_DIR/Figure1_FC_matrix.npy` — A 2D NumPy array (65×65) representing functional connectivity, already with excluded regions removed.
- **Excluded regions**: `PROCESS_DATA_DIR/Figure1_excluded_regions.npy` — A 1D array of region IDs (half-brain) to exclude from visualization and gradient analysis.
- **Atlas data**: Loaded via `MapzebrainAtlas` class, providing XY/XZ projection images and left/right regional centroids.

## Output
- **Figure** (`figure.png`): A two-row multi-panel figure:
  - Row 1 (SC): Connectivity matrix, Gradient 1 top/side views, Gradient 2 top/side views.
  - Row 2 (FC): Connectivity matrix, Gradient 1 top/side views, Gradient 2 top/side views.
  - Correlation coefficients annotated on FC gradient panels.
- **Saved gradients**:
  - `Figure6_SC_gradients.npy` — SC gradient matrix (transposed eigenvectors, excluded regions removed).
  - `Figure6_SC_eigenvalues.npy` — SC eigenvalues from diffusion mapping.
  - `Figure6_FC_gradients.npy` — FC gradient matrix (transposed eigenvectors).
  - `Figure6_FC_eigenvalues.npy` — FC eigenvalues from diffusion mapping.
- **Statistics** (`statistics.json`): Gradient shapes, eigenvalue means, correlation coefficients, gradient means/stds, region counts.

## Algorithm / Processing Steps
1. **Data Loading**: Load SC (70×70), FC (65×65), and excluded region arrays. Clean matrices by replacing NaN/inf with 0 and setting diagonals to 0.
2. **SC Gradient Computation**: Apply `diffusion_mapping` to the full SC matrix with `n_components=69` (min of 69 and N-1) and `alpha=0.5`. Remove rows corresponding to excluded regions from the resulting eigenvector matrix. Transpose to obtain gradients as rows.
3. **FC Gradient Computation**: Apply `diffusion_mapping` to the FC matrix with `n_components=64` and `alpha=0.5`. Transpose to obtain gradients as rows.
4. **Correlation Analysis**: Compute Pearson correlation between SC Gradient 1 and FC Gradient 1, and between SC Gradient 2 and FC Gradient 2.
5. **Centroid Preparation**: Load left and right centroids from atlas, concatenate bilaterally. Adjust y-coordinates (`y = 974 - y`) to match image orientation. Remove centroids at excluded indices (both left half indices and right half indices = excluded + 70). For side view, invert z-coordinates (`z = 359 - z`) and use (inverted_z, y) coordinates.
6. **Bilateral Gradient Values**: Double each gradient vector (concatenate with itself) for bilateral centroid visualization.
7. **Visualization**: Plot connectivity matrices with custom blue-white colormap (vmin=0.1, vmax=0.9). Overlay centroids on atlas projections colored by gradient values using 'coolwarm' colormap with color limits set to the 90th percentile of absolute gradient values. Marker size=35 with black edges.

## Key Parameters
| Parameter | Value | Description |
|---|---|---|
| `n_components` (SC) | 69 (min of 69, N-1) | Number of diffusion map components for SC |
| `n_components` (FC) | 64 (min of 64, N-1) | Number of diffusion map components for FC |
| `alpha` | 0.5 | Diffusion map alpha parameter controlling normalization |
| `vmin/vmax` (matrix) | 0.1 / 0.9 | Color limits for connectivity matrix display |
| `marker_size` | 35 | Size of centroid scatter markers |
| Color limit (gradients) | 90th percentile of abs values | Symmetric coolwarm color limits |
| Blue color | [72/255, 184/255, 208/255] | Custom blue for blue-white colormap |
| Y-coordinate adjustment | 974 - y | Flips y to match image orientation |
| Z-coordinate inversion | 359 - z | Inverts z for side view |

## Usage Example
```python
import os
import numpy as np
from brainspace.gradient.embedding import diffusion_mapping
from zebrafish_Ca_utils import MapzebrainAtlas

# Load matrices
sc_matrix = np.load("SC_matrix_undirected_terminals_expanded.npy")
fc_matrix = np.load("Figure1_FC_matrix.npy")
excluded = np.load("Figure1_excluded_regions.npy").astype(int)

# Clean matrices
np.fill_diagonal(sc_matrix, 0.0)
np.fill_diagonal(fc_matrix, 0.0)

# Compute gradients
modes_SC, eigvals_SC = diffusion_mapping(sc_matrix, n_components=69, alpha=0.5)
modes_SC_filtered = np.delete(modes_SC, excluded, axis=0).T

modes_FC, eigvals_FC = diffusion_mapping(fc_matrix, n_components=64, alpha=0.5)
modes_FC = modes_FC.T

# Correlations
from scipy.stats import pearsonr
corr1, _ = pearsonr(modes_SC_filtered[0], modes_FC[0])
corr2, _ = pearsonr(modes_SC_filtered[1], modes_FC[1])
print(f"Gradient 1 correlation: {corr1:.3f}")
print(f"Gradient 2 correlation: {corr2:.3f}")
```

## Dependencies
- `numpy`
- `matplotlib`
- `scipy` (for `pearsonr`)
- `brainspace` (for `diffusion_mapping` from `brainspace.gradient.embedding`)
- `zebrafish_Ca_utils` (custom toolkit providing `MapzebrainAtlas` class with atlas projections and centroids)

## Limitations
- The SC matrix includes all 70 regions; excluded regions are removed only after gradient computation, which means the gradient embedding is influenced by those regions before removal.
- The FC matrix is pre-filtered to 65 regions, so SC and FC gradient computations start from different region sets.
- The `n_components` parameter is capped at N-1 to avoid numerical issues with sparse eigensolvers.
- Bilateral visualization doubles unilateral gradient values, assuming symmetry between left and right hemispheres.
- The y-coordinate and z-coordinate adjustments (974, 359) are specific to the Mapzebrain atlas resolution and orientation.
- The 90th percentile color limit may clip extreme gradient values in visualization.

## Source
Pipeline for investigating sensorimotor organization of the zebrafish brain through SC-FC connectivity gradient comparison, using diffusion map embedding and Mapzebrain atlas projections.