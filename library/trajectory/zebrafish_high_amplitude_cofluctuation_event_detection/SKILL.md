# Zebrafish High-Amplitude Co-Fluctuation Event Detection

## Description
This skill identifies high-amplitude co-fluctuation events — moments of synchronized brain-wide activity — in zebrafish larvae calcium imaging data. It quantifies regional coactivation by computing the root mean square (RMS) of pairwise node co-fluctuations at each time point from a state matrix. Statistical significance is established by constructing a null RMS distribution through 100 circular permutations of per-fish regional time series and applying Benjamini–Hochberg FDR correction. Contiguous significant frames are grouped into discrete events, with care taken to split events at fish boundaries. The skill outputs key intermediate and final results as `.npy` files and produces a publication-quality visualization.

## Tags
- zebrafish
- calcium imaging
- co-fluctuation
- RMS
- coactivation
- high-amplitude events
- circular permutation
- null distribution
- FDR correction
- Benjamini-Hochberg
- brain-wide synchrony
- resting state
- event detection
- statistical testing
- raster plot

## Input
- **`Figure4_state_matrix.npy`**: A 2D NumPy array of shape `(n_regions, n_total_timepoints)` representing the concatenated bilateral regional time series across all fish. Located in `PROCESS_DATA_DIR`.
- **`Figure4_rseries.npy`**: A 3D NumPy array of shape `(n_fish, n_regions, n_timepoints_per_fish)` containing bilateral regional time series for each individual fish. Located in `PROCESS_DATA_DIR`.

## Output
### Saved Data Files (in `PROCESS_DATA_DIR`)
- **`Figure4_RMS.npy`**: 1D array `(n_total_timepoints,)` — empirical RMS of pairwise co-fluctuations at each time point.
- **`Figure4_null_RMS_distribution.npy`**: 1D array containing all null RMS values from 100 permutations (length = 100 × n_total_timepoints).
- **`Figure4_RMS_threshold.npy`**: 1D array with a single value — the 95th percentile of the null RMS distribution.
- **`Figure4_events_high.npy`**: 2D array `(n_regions, n_events)` — average regional activity for each detected high-amplitude event.

### Saved Visualization (in `SAVE_DIR`)
- **`figure_refine.png`**: Two-panel figure (21×3 inches) with:
  - Top panel: Log-scale RMS time series (black) with 95th-percentile threshold (red dashed line).
  - Bottom panel: Raster plot of significant frame timestamps with total count annotation.

### Statistics File (in `SAVE_DIR`)
- **`statistics.json`**: JSON with `n_fish`, `n_regions`, `n_events`, `n_significant_frames`, `threshold`, `max_RMS`, and `null_95th`.

## Algorithm / Processing Steps

### Step 1: Data Loading
- Load the state matrix `(n_regions, n_total_timepoints)` and per-fish regional time series `(n_fish, n_regions, n_timepoints_per_fish)`.
- Validate that the state matrix total timepoints equals `n_fish × n_timepoints_per_fish`.

### Step 2: Empirical RMS Computation
- For each time point `t`, extract the activity vector `c` of length `n_regions`.
- Compute the outer product `c ⊗ c` to get all pairwise coactivations.
- Extract upper-triangular elements (excluding diagonal) to get unique pairs.
- Compute `RMS(t) = sqrt(mean(coactivation²))` over these pairs.
- Save result as `Figure4_RMS.npy`.

### Step 3: Null Distribution via Circular Permutations
- Repeat 100 times:
  - For each fish, circularly shift each region's time series by an independent random offset.
  - Concatenate all permuted fish along the time axis to form a null state matrix.
  - Compute RMS for the null state matrix.
- Concatenate all null RMS values into a single distribution.
- Save as `Figure4_null_RMS_distribution.npy`.

### Step 4: Significance Threshold
- Compute the 95th percentile of the null RMS distribution.
- Save as `Figure4_RMS_threshold.npy`.

### Step 5: Statistical Testing with FDR Correction
- For each empirical RMS value, compute an empirical p-value: `p = 1 - (count of null values < empirical value) / N_null`.
- Apply Benjamini–Hochberg FDR correction at α = 0.05 using `statsmodels.stats.multitest.multipletests`.
- Identify frames where the corrected p-value passes the threshold (reject = True).

### Step 6: Discrete Event Extraction
- Group contiguous significant frame indices into clusters.
- Split any cluster that spans across a fish boundary (every `n_timepoints_per_fish` frames).
- For each discrete event, compute the mean regional activity across the event's frames from the state matrix.
- Stack results into a `(n_regions, n_events)` array and save as `Figure4_events_high.npy`.

### Step 7: Visualization
- Create a two-panel figure (80%/20% height split):
  - Top: Log-scale RMS time series (black), red dashed threshold line with annotation.
  - Bottom: Raster plot of significant frame locations, with total count printed below.

## Key Parameters
| Parameter | Value | Description |
|---|---|---|
| Number of permutations | 100 | Iterations for building the null RMS distribution |
| Null percentile threshold | 95th | Percentile of null distribution used as the significance cutoff |
| FDR method | Benjamini–Hochberg | Multiple comparison correction method |
| FDR alpha | 0.05 | Family-wise error rate for FDR correction |
| Permutation type | Circular shift | Each region shifted independently by a random offset per fish |
| Random seed | 42 | Seed for reproducibility of permutations |
| Figure size | (21, 3) inches | Output figure dimensions |
| DPI | 300 | Output figure resolution |

## Usage Example
```python
import os
os.environ['PROCESS_DATA_DIR'] = '/path/to/processed_data'
os.environ['SAVE_DIR'] = '/path/to/output'

# Ensure input files exist:
#   PROCESS_DATA_DIR/Figure4_state_matrix.npy  — shape (n_regions, n_total_timepoints)
#   PROCESS_DATA_DIR/Figure4_rseries.npy       — shape (n_fish, n_regions, n_timepoints_per_fish)

# Run the script to:
#   1. Compute and save empirical RMS
#   2. Generate and save null RMS distribution (100 circular permutations)
#   3. Compute and save 95th-percentile threshold
#   4. Detect FDR-corrected significant frames
#   5. Extract discrete events (split at fish boundaries)
#   6. Save event average activities
#   7. Generate two-panel visualization

# Outputs:
#   PROCESS_DATA_DIR/Figure4_RMS.npy
#   PROCESS_DATA_DIR/Figure4_null_RMS_distribution.npy
#   PROCESS_DATA_DIR/Figure4_RMS_threshold.npy
#   PROCESS_DATA_DIR/Figure4_events_high.npy
#   SAVE_DIR/figure_refine.png
#   SAVE_DIR/statistics.json
```

## Dependencies
- `numpy` — Array operations, data loading/saving
- `matplotlib` — Visualization (pyplot, gridspec)
- `scipy.ndimage` — Gaussian filtering (imported but used for broader pipeline compatibility)
- `statsmodels.stats.multitest` — Benjamini–Hochberg FDR correction (`multipletests`)
- Custom zebrafish utilities from shared library (imported for broader pipeline compatibility):
  - `zebrafish_Ca_utils`
  - `zebrafish_Ca_stats_patch_xps`
  - `zebrafish_Ca_utils_patch_xps`
  - `zebrafish_Ca_utils_predictors_xps`
  - `zebrafish_Ca_visualization_patch_xps`

## Limitations
- **Computational Cost**: The RMS computation iterates over every time point and computes a full outer product, making it O(T × R²). For large datasets with many regions and long recordings, this can be slow. Vectorized or upper-triangle-only approaches could improve speed.
- **Fixed Permutation Count**: The null distribution is based on 100 permutations, which may be insufficient for very precise p-value estimation at extreme tails. Increasing permutations improves accuracy but linearly increases computation time.
- **Circular Permutation Assumptions**: Circular shifting preserves within-region autocorrelation structure but destroys inter-regional temporal relationships. This is appropriate for testing synchrony but assumes stationarity within each fish's recording.
- **Equal Fish Duration**: The algorithm assumes all fish have the same number of time points (`n_timepoints_per_fish`), as implied by the 3D rseries array shape.
- **Event Definition Sensitivity**: Events are defined purely by contiguity of significant frames. No minimum duration or gap-merging criteria are applied, so very short (single-frame) events are included.
- **Memory**: Storing 100 full null RMS vectors and the null distribution in memory may be demanding for very long recordings.

## Source
Derived from a zebrafish calcium imaging analysis pipeline for detecting high-amplitude co-fluctuation events in brain-wide activity, following methodology consistent with published approaches for identifying discrete coactivation events using pairwise co-fluctuation RMS with permutation-based statistical testing and FDR correction.
