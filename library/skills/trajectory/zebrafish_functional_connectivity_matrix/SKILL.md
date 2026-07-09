# Zebrafish Functional Connectivity Matrix Analysis

## Description
This skill computes functional connectivity (FC) matrices among brain regions for multiple zebrafish larvae from region-averaged ΔF/F₀ calcium imaging time series. It processes each larva by loading its regional time series, truncating to a fixed number of time points, applying temporal Gaussian smoothing, and computing a Pearson correlation matrix across all brain regions. Excluded regions are removed from the matrices, and a group-average FC matrix is computed across all larvae (handling NaN values from unsampled regions). The final visualization shows the lower triangle of the averaged FC matrix as a heatmap with a white-to-red colormap.

## Tags
- zebrafish
- calcium imaging
- functional connectivity
- correlation matrix
- brain regions
- Pearson correlation
- Gaussian smoothing
- heatmap
- group average
- ΔF/F₀
- larvae
- neuroscience

## Input
- **Region time series files**: `region_series_dff.npy` for each fish larva, stored within per-fish subdirectories under `ZEBRAFISH_PATH`. Each file is a 2D NumPy array with shape `(n_regions, n_timepoints)` containing region-averaged ΔF/F₀ signals.
- **Excluded regions file**: `PROCESS_DATA_DIR/Figure1_excluded_regions.npy` — a 1D integer array listing the indices of brain regions to exclude from the FC analysis.
- **Environment variables**:
  - `ZEBRAFISH_PATH`: Root directory containing fish subdirectories.
  - `PROCESS_DATA_DIR`: Directory for intermediate processed data files.
  - `SAVE_DIR`: Directory for output figures and statistics.

## Output
- **Individual FC matrices**: `PROCESS_DATA_DIR/Figure1_FC_matrices.npy` — a 3D NumPy array of shape `(n_larvae, n_regions_kept, n_regions_kept)` containing per-larva Pearson correlation matrices after region exclusion.
- **Group-average FC matrix**: `PROCESS_DATA_DIR/Figure1_FC_matrix.npy` — a 2D NumPy array of shape `(n_regions_kept, n_regions_kept)` with the NaN-tolerant mean across all larvae.
- **Visualization**: `SAVE_DIR/figure_refine.png` — a 6×6 inch heatmap of the lower triangle of the averaged FC matrix using a white-to-red colormap (clim [0.2, 0.9]), with colorbar labeled "FC", y-axis labeled "Brain regions", and title showing the number of larvae.
- **Statistics JSON**: `SAVE_DIR/statistics.json` — summary metrics including number of larvae, original and post-exclusion region counts, excluded region count, overall FC mean, and lower-triangle FC mean.

## Algorithm / Processing Steps
1. **Dataset discovery**: Use `get_datasets()` to enumerate all fish larva folders under the root data directory (filtering by keyword 'fish').
2. **Load excluded regions**: Load the integer array of excluded region IDs from `Figure1_excluded_regions.npy`.
3. **Per-larva processing loop**:
   - Load `region_series_dff.npy` (shape: `n_regions × n_timepoints`).
   - Validate that the array is 2D and has at least 600 time points.
   - **Temporal truncation**: Keep only the first 600 time points.
   - **Gaussian smoothing**: Apply `scipy.ndimage.gaussian_filter1d` with `sigma=2` independently along the time axis for each brain region.
   - **FC computation**: Compute the Pearson correlation matrix across all brain regions using `compute_correlation_matrix(smoothed_series, arctanh=False)`.
   - Append the resulting FC matrix to a collection list.
4. **Stack matrices**: Combine all per-larva FC matrices into a 3D array of shape `(n_larvae, n_regions, n_regions)`.
5. **Region exclusion**: Create a boolean mask to exclude specified region indices from both row and column dimensions of the stacked matrices simultaneously.
6. **Save individual FC matrices** (post-exclusion) to `Figure1_FC_matrices.npy`.
7. **Group averaging**: Compute `np.nanmean` across the larvae axis to produce the group-average FC matrix, accommodating NaN values.
8. **Save group-average FC matrix** to `Figure1_FC_matrix.npy`.
9. **Visualization**:
   - Create a 6×6 figure.
   - Mask the upper triangle and diagonal of the average FC matrix (set to NaN).
   - Display with `imshow` using `cmap='Reds'`, `vmin=0.2`, `vmax=0.9`, `aspect='equal'`, `origin='upper'`, `interpolation='none'`.
   - Add a colorbar labeled "FC" on the right side.
   - Set y-axis ticks at positions 0 and N-1, labeled as 1 and N (1-indexed).
   - Set x-axis ticks similarly.
   - Label y-axis as "Brain regions".
   - Title: "Average functional connectivity" with the larva count.
10. **Save statistics** as a JSON file.

## Key Parameters
| Parameter | Value | Description |
|-----------|-------|-------------|
| `TIME_POINTS` | 600 | Number of time points to use from each time series |
| `SMOOTH_SIGMA` | 2 | Standard deviation (in time steps) for the 1D Gaussian temporal smoothing filter |
| `arctanh` | False | Whether to apply Fisher z-transform to correlation coefficients |
| `cmap` | 'Reds' | Colormap for the FC matrix heatmap (white-to-red) |
| `vmin` | 0.2 | Lower bound of the color axis |
| `vmax` | 0.9 | Upper bound of the color axis |
| `figsize` | (6, 6) | Square figure size in inches |
| `dpi` | 300 | Resolution of saved figure |
| Mask | Upper triangle + diagonal (`k=0`) | Regions of the matrix not displayed |

## Usage Example
```python
import os
os.environ['ZEBRAFISH_PATH'] = '/path/to/zebrafish/data'
os.environ['PROCESS_DATA_DIR'] = '/path/to/processed/output'
os.environ['SAVE_DIR'] = '/path/to/figures'

# Run the pipeline (execute the script)
# Outputs:
#   PROCESS_DATA_DIR/Figure1_FC_matrices.npy  (per-larva FC matrices)
#   PROCESS_DATA_DIR/Figure1_FC_matrix.npy    (group-average FC matrix)
#   SAVE_DIR/figure_refine.png                (lower-triangle heatmap)
#   SAVE_DIR/statistics.json                  (summary statistics)

# Load results
import numpy as np
fc_matrices = np.load(os.path.join(os.environ['PROCESS_DATA_DIR'], 'Figure1_FC_matrices.npy'))
fc_avg = np.load(os.path.join(os.environ['PROCESS_DATA_DIR'], 'Figure1_FC_matrix.npy'))
print(f"FC matrices shape: {fc_matrices.shape}")  # e.g., (19, 253, 253)
print(f"Average FC matrix shape: {fc_avg.shape}")  # e.g., (253, 253)
```

## Dependencies
- **Python Standard Library**: `os`, `sys`, `json`
- **NumPy**: Array operations, file I/O (`np.load`, `np.save`, `np.nanmean`)
- **SciPy**: `scipy.ndimage.gaussian_filter1d` for temporal smoothing
- **Matplotlib**: `matplotlib.pyplot` for heatmap visualization
- **Custom Toolkit**: `zebrafish_Ca_utils` (from shared library path) providing:
  - `get_datasets(root_path, keywords)`: Discovers fish dataset directories
  - `compute_correlation_matrix(data, arctanh)`: Computes Pearson correlation matrix across regions

## Limitations
- Assumes `region_series_dff.npy` files have consistent region counts across all larvae; mismatched region dimensions will cause stacking errors.
- Only the first 600 time points are used; larvae with fewer than 600 time points are silently skipped.
- The Gaussian smoothing sigma is fixed at 2 time steps; no adaptive or frequency-based filtering is applied.
- The `arctanh` (Fisher z-transform) is set to `False`, meaning averaging is performed on raw correlation values rather than z-transformed values, which may introduce bias for high correlations.
- NaN handling via `np.nanmean` means that if a region is entirely NaN across some larvae, the average will be computed from fewer samples without explicit weighting or minimum-count thresholding.
- The excluded regions file must be pre-computed and available before running this pipeline.
- The visualization only shows the lower triangle; the diagonal (self-correlation) is masked and not displayed.
- Region labels are shown as integer indices (1 to N) without anatomical names.

## Source
Pipeline developed for zebrafish larval calcium imaging functional connectivity analysis. Uses region-averaged ΔF/F₀ signals to compute and visualize brain-wide pairwise functional connectivity matrices across a cohort of 19 zebrafish larvae, with 253 brain regions after exclusion filtering.
