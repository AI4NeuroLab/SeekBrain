# Zebrafish Calcium ΔF/F0 Regional Averaging and Visualization

## Description
This skill implements a complete processing and visualization pipeline for whole-brain zebrafish calcium imaging data. It loads raw fluorescence time series from HDF5 files, corrects a first-frame acquisition artifact, computes the relative fluorescence change (ΔF/F0) for every neuron using a robust baseline estimation method (Gaussian-smoothed minimum filter), averages the ΔF/F0 signals across anatomical brain regions defined by an atlas, and saves the results. It then generates a publication-quality stacked time-series figure showing regional calcium activity for a selected fish, complete with anatomical annotations, stimulus markers, and scale bars.

## Tags
- zebrafish
- calcium imaging
- ΔF/F0
- baseline correction
- regional averaging
- brain atlas
- whole-brain imaging
- time series
- ridge plot
- fluorescence normalization
- neuroscience
- HDF5

## Input
- **Raw data**: `data.hdf5` files per fish, each containing:
  - `timeseries`: 2D array of shape `[neurons, time]` (raw fluorescence values)
  - `region_labels`: 2D boolean array of shape `[neurons, regions]` mapping neurons to atlas regions
  - `timesteps`: 1D array of time points in seconds
- **Atlas information**: `acronyms.txt` in the atlas folder listing region acronyms (one per line)
- **Exclusion list** (optional): `Figure1_excluded_regions.npy` in the processed data directory, containing integer indices of regions to exclude from visualization
- **Environment variables**:
  - `ZEBRAFISH_PATH`: root directory containing fish subdirectories
  - `ATLAS_PATH`: directory containing `acronyms.txt`
  - `PROCESS_DATA_DIR`: output directory for processed `.npy` files
  - `SAVE_DIR`: output directory for figures and statistics

## Output
- **Per-fish pixel-wise ΔF/F0**: `Figure1_dff_fish*.npy` — array of shape `[neurons, time]`
- **Per-fish regional average ΔF/F0**: `Figure1_region_series_dff_fish*.npy` — array of shape `[regions, time]`
- **Stacked regional time-series figure**: `figure_refine.png` — publication-quality ridge plot
- **Statistics JSON**: `statistics.json` — metadata about the processing run

## Algorithm / Processing Steps

### Part 1: Data Processing (per fish)
1. **First-frame artifact correction**: Copy the second frame's values to the first frame for all neurons (`timeseries[:, 0] = timeseries[:, 1]`).
2. **Baseline estimation**:
   - Apply a 1D Gaussian filter with `sigma=3` to pre-smooth each neuron's signal.
   - Apply a 1D minimum filter with `window=300` time steps to extract the running minimum.
   - Apply a 1D Gaussian filter with `sigma=60` to post-smooth the baseline estimate.
3. **ΔF/F0 computation**: `dff = (signal - baseline) / max(baseline, 1e-10)` per neuron.
4. **Regional averaging**: For each region, select neurons where `region_labels[:, r]` is True and compute the mean ΔF/F0 trace.
5. **Save** pixel-wise ΔF/F0 and regional averages as `.npy` files.

### Part 2: Visualization (single fish)
1. **Load** regional traces for the target fish (fish 2) and exclude regions listed in the exclusion file.
2. **Smooth** each regional trace with a 1D Gaussian filter (`sigma=1`).
3. **Normalize** each smoothed trace via min-max scaling to [0, 1].
4. **Stack** traces vertically with an offset of 0.5 per region, ordered anterior (top, e.g., OE) to posterior (bottom, e.g., VSL).
5. **Plot** traces as black lines (`linewidth=0.5`) on a figure with axes turned off.
6. **Annotate**:
   - Region acronyms to the right of each trace.
   - "Anterior <–––> Posterior" label on the far right, rotated 270°.
   - "Regional fluorescence (normalized)" label on the left, rotated 90°.
   - A "2 min" scale bar (120 seconds) at the bottom left.
   - An orange semi-transparent vertical band over the visual stimulation period (~660–840 seconds) labeled "stimuli".

## Key Parameters
| Parameter | Value | Description |
|---|---|---|
| `sigma1` (pre-smooth) | 3 | Gaussian sigma for pre-smoothing before minimum filter |
| `min_filter_window` | 300 | Temporal window (frames) for minimum filter baseline |
| `sigma2` (post-smooth) | 60 | Gaussian sigma for post-smoothing the baseline |
| `plot_smooth_sigma` | 1 | Gaussian sigma for smoothing traces before visualization |
| `vertical_offset` | 0.5 | Vertical spacing between stacked traces |
| `stim_start` | 660 s | Start of visual stimulation period (11th minute) |
| `stim_end` | 840 s | End of visual stimulation period (14th minute) |
| `scale_bar_duration` | 120 s | Duration represented by the scale bar (2 minutes) |
| `figsize` | (5, 6) | Figure dimensions in inches |
| `trace_linewidth` | 0.5 | Line width for calcium traces |
| `baseline_floor` | 1e-10 | Minimum baseline value to avoid division by zero |

## Usage Example
```python
import os
os.environ["ZEBRAFISH_PATH"] = "/path/to/zebrafish/data"
os.environ["ATLAS_PATH"] = "/path/to/atlas"
os.environ["PROCESS_DATA_DIR"] = "/path/to/processed"
os.environ["SAVE_DIR"] = "/path/to/figures"

# Run the full pipeline (processing + visualization)
# The script iterates over all fish folders, processes each,
# then generates a stacked regional trace plot for fish 2.
exec(open("zebrafish_calcium_dff_regional_averaging.py").read())
```

## Dependencies
- `numpy` — array operations and file I/O (.npy)
- `scipy.ndimage` — `gaussian_filter1d`, `minimum_filter1d` for baseline estimation and smoothing
- `h5py` — reading HDF5 data files
- `matplotlib` — figure generation
- `tqdm` — progress bars
- `zebrafish_Ca_utils` — custom utility (`get_datasets`) for discovering fish dataset directories

## Limitations
- The baseline estimation parameters (window=300, sigma1=3, sigma2=60) are tuned for specific acquisition rates; they may need adjustment for different frame rates.
- The first-frame artifact correction assumes the artifact is limited to exactly the first frame.
- Regions with no assigned neurons produce NaN traces in the regional averages.
- The baseline floor of 1e-10 prevents division by zero but may produce artificially large ΔF/F0 values for very dim neurons.
- The visual stimulation period is hardcoded to 660–840 seconds; different experimental protocols require manual adjustment.
- The visualization is configured for fish 2 specifically; adapting to other fish requires code modification.
- Min-max normalization in the visualization step removes amplitude differences between regions.
- The exclusion region list (`Figure1_excluded_regions.npy`) must be pre-computed or manually specified.

## Source
Derived from a zebrafish whole-brain calcium imaging analysis pipeline for processing motion-corrected neuronal signals, computing ΔF/F0 with robust baseline estimation, performing atlas-based regional averaging, and generating publication-quality stacked time-series visualizations with anatomical annotations.
