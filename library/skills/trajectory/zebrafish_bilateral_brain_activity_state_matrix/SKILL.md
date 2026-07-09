# Zebrafish Bilateral Brain Activity State Matrix

## Description
This skill processes bilateral regional calcium imaging time series from multiple zebrafish larvae and produces a concatenated 2D state matrix heatmap for visualizing large-amplitude activity patterns across brain regions. The pipeline loads `region_series_dff_bilateral.npy` arrays (shape [140, time], representing 70 Left + 70 Right regions) for each fish, applies Gaussian smoothing, excludes problematic regions symmetrically (retina and zero-signal regions), detrends and normalizes using minimum-filter-based ΔF/F and z-scoring, then concatenates all fish data along the time axis to create a single state matrix. The resulting heatmap reveals synchronized, large-amplitude neural events as bright vertical bands spanning multiple brain regions.

## Tags
- zebrafish
- calcium imaging
- bilateral brain regions
- state matrix
- heatmap
- ΔF/F
- z-score normalization
- multi-fish comparison
- neural activity patterns
- region exclusion
- Gaussian smoothing
- detrending

## Input
- **Per-fish bilateral regional time series**: `region_series_dff_bilateral.npy` files located in each fish folder (shape: [140, n_timepoints], where 140 = 70 left + 70 right regions)
- **Fish dataset folders**: Discovered via `get_datasets()` with keyword `fish`, sorted by fish ID
- **Environment variables**:
  - `ZEBRAFISH_PATH`: Root path to fish data folders
  - `ATLAS_PATH`: Path to atlas data
  - `PROCESS_DATA_DIR`: Directory for saving intermediate processed data
  - `SAVE_DIR`: Directory for saving figures and statistics

## Output
- **`Figure4_excluded_regions_bilateral.npy`**: Array of bilateral region indices excluded from analysis (saved in `PROCESS_DATA_DIR`)
- **`Figure4_rseries.npy`**: 3D array of processed time series (n_fish, n_regions, n_timepoints) sorted by fish ID (saved in `PROCESS_DATA_DIR`)
- **`Figure4_state_matrix.npy`**: 2D concatenated state matrix (n_kept_regions, total_concatenated_time) (saved in `PROCESS_DATA_DIR`)
- **`figure_refine.png`**: Heatmap visualization of the state matrix (saved in `SAVE_DIR`)
- **`statistics.json`**: Summary statistics including fish count, region counts, excluded regions, time lengths, and activity statistics (saved in `SAVE_DIR`)

## Algorithm / Processing Steps

### 1. Data Discovery & Loading
- Use `get_datasets()` to find all fish folders under `ZEBRAFISH_PATH`
- Sort folders and load `region_series_dff_bilateral.npy` for each fish

### 2. Gaussian Smoothing
- Apply 1D Gaussian filter with sigma=2 to each region's time series independently

### 3. Region Exclusion (Symmetric)
- **Retina exclusion**: Always exclude unilateral index 10 and its bilateral counterpart (index 80)
- **Zero-signal exclusion**: Identify any region that has a zero value at any timepoint in any larva
- **Symmetric enforcement**: If unilateral region `i` (0–69) is excluded, also exclude `i + 70` (and vice versa)
- Save the sorted list of excluded bilateral indices to `Figure4_excluded_regions_bilateral.npy`

### 4. Detrending & Normalization
- Remove excluded regions from the smoothed bilateral time series
- Apply `compute_dff_using_minfilter(data, window=30, sigma1=3, sigma2=30)` for baseline correction and ΔF/F computation
- Z-score each region's trace along the time axis
- Replace any NaN values with 0.0

### 5. Dataset Assembly
- Sort processed data by fish ID; assert sequential IDs (1, 2, 3, ...)
- Stack into 3D array (n_fish, n_regions, n_timepoints) and save as `Figure4_rseries.npy`
- If time lengths differ across fish, truncate to minimum length for the 3D array

### 6. State Matrix Construction
- Concatenate all fish processed arrays along the time axis (axis=1) to produce a 2D state matrix
- Save as `Figure4_state_matrix.npy`

### 7. Visualization
- Create figure (21 × 3 inches)
- Display heatmap using `imshow` with `cmap='hot'`, `aspect='auto'`, color range [-1, 3]
- Draw horizontal white dashed line at y-axis midpoint separating Left/Right hemispheres
- Draw vertical solid white lines at fish dataset boundaries
- Label fish IDs at the top of each block
- Label y-axis with start/end region IDs (1-based), "Left"/"Right" hemisphere labels, and "Brain Regions" axis label
- Label x-axis with start/end indices (1-based) and "Imaging Volumes" axis label
- Add vertical colorbar labeled "Activity (z-scored)"

## Key Parameters
| Parameter | Value | Description |
|-----------|-------|-------------|
| `SMOOTHING_SIGMA` | 2 | Gaussian filter sigma for temporal smoothing |
| `RETINA_INDEX_UNILATERAL` | 10 | Unilateral index of retina region to exclude |
| `DFF_WINDOW` | 30 | Window size for minimum filter in ΔF/F computation |
| `DFF_SIGMA1` | 3 | First Gaussian sigma in ΔF/F baseline estimation |
| `DFF_SIGMA2` | 30 | Second Gaussian sigma in ΔF/F baseline estimation |
| `vmin, vmax` | -1, 3 | Color range for heatmap |
| `cmap` | 'hot' | Colormap for heatmap |
| `figure size` | (21, 3) | Figure dimensions in inches |
| `n_bilateral_regions` | 140 | Total bilateral regions (70 left + 70 right) |

## Usage Example
```python
import os
os.environ['ZEBRAFISH_PATH'] = '/path/to/zebrafish/data'
os.environ['ATLAS_PATH'] = '/path/to/atlas'
os.environ['PROCESS_DATA_DIR'] = '/path/to/processed/output'
os.environ['SAVE_DIR'] = '/path/to/figures'

# Run the pipeline script
exec(open('bilateral_state_matrix.py').read())

# Load results
import numpy as np
state_matrix = np.load('/path/to/processed/output/Figure4_state_matrix.npy')
rseries = np.load('/path/to/processed/output/Figure4_rseries.npy')
excluded = np.load('/path/to/processed/output/Figure4_excluded_regions_bilateral.npy')
print(f"State matrix shape: {state_matrix.shape}")
print(f"Per-fish array shape: {rseries.shape}")
print(f"Excluded regions: {excluded}")
```

## Dependencies
- `numpy` — array operations and data I/O
- `scipy.ndimage.gaussian_filter1d` — temporal smoothing
- `scipy.stats.zscore` — z-score normalization
- `matplotlib.pyplot` — figure creation and heatmap rendering
- `matplotlib.transforms` — blended transforms for fish ID labeling
- Custom library: `zebrafish_Ca_utils` providing:
  - `get_datasets()` — discover fish dataset folders
  - `MapzebrainAtlas` — atlas utilities
  - `compute_dff_using_minfilter()` — minimum-filter-based ΔF/F computation

## Limitations
- Assumes bilateral data has exactly 140 rows (70 left + 70 right regions)
- Fish folder names must follow the pattern `fishN` where N is an integer
- Fish IDs must be sequential starting from 1; the pipeline asserts this
- If time series lengths differ across fish, the 3D `rseries` array is truncated to the shortest; the state matrix retains full per-fish lengths
- Zero-signal detection is strict (any single zero in any larva triggers exclusion)
- The retina index (10) is hardcoded for a specific atlas parcellation
- NaN values from z-scoring (e.g., constant signals) are replaced with 0.0

## Source
Pipeline derived from multi-fish zebrafish whole-brain calcium imaging analysis for visualizing large-amplitude synchronized activity patterns across bilateral brain regions (Figure 4 state matrix).