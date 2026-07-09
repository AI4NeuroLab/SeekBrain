# Zebrafish Neuron Spatial Distribution Atlas Mapping

## Description
This skill maps the somatic locations of individual neurons from multiple zebrafish larvae onto a standard zebrafish brain atlas (MapZebrain). It computes neuronal counts per brain region across all fish, defines exclusion criteria for under-sampled or excluded regions (e.g., retina), provides statistical summaries of neuronal counts per fish (mean ± SD), generates composite regional projection images for top (dorsal) and side (lateral) views, and produces a two-panel visualization of a representative larva's mapped neurons overlaid on the atlas background.

## Tags
- zebrafish
- brain atlas
- MapZebrain
- neuronal mapping
- spatial distribution
- calcium imaging
- region projection
- somatic location
- atlas registration
- neuroscience
- HDF5
- population statistics

## Input
- **Zebrafish data directory** (`ZEBRAFISH_PATH`): Root directory containing multiple fish subfolders, each with a `data.hdf5` file containing:
  - `centroids_atlas`: (N_neurons × 3) array of XYZ coordinates in atlas space
  - `region_labels`: (N_neurons × N_regions) boolean matrix indicating region membership
- **Atlas directory** (`ATLAS_PATH`): Directory containing the MapZebrain atlas files (region masks, projection templates)
- **Process data directory** (`PROCESS_DATA_DIR`): Directory for intermediate/processed data outputs
- **Save directory** (`SAVE_DIR`): Directory for final figure and statistics outputs

## Output
- **`Figure1_N_neurons_per_region.npy`**: Integer matrix of shape (N_regions × N_datasets) with neuron counts per region per fish
- **`Figure1_excluded_regions.npy`**: 1D integer array of excluded region IDs
- **`Figure1_projection_regions_top.npy`**: 2D float array — composite top (dorsal/XY) regional projection image (normalized 0–1)
- **`Figure1_projection_regions_side.npy`**: 2D float array — composite side (lateral/XZ) regional projection image (normalized 0–1)
- **`figure.png`**: Two-panel figure (8×6 inches, 300 DPI) showing top and side atlas projections with color-coded neuronal scatter overlay
- **`statistics.json`**: JSON file with population statistics including mean, SD, min, max, median neurons per fish, excluded region info, and representative fish metadata

## Algorithm / Processing Steps

### Analysis Phase
1. **Atlas Initialization**: Load the MapZebrain atlas via `MapzebrainAtlas(ATLAS_PATH)`.
2. **Dataset Discovery**: Use `get_datasets()` to find all fish folders matching the keyword `'fish'`.
3. **Neuronal Count Matrix**: For each fish, load `data.hdf5`, read the boolean `region_labels` matrix, and sum neurons per region to build a (Regions × Datasets) count matrix.
4. **Exclusion Criteria**:
   - Region 10 (Retina) is always excluded.
   - Any region without at least 25 neurons in at least 50% of datasets is excluded.
5. **Statistical Reporting**: Sum neuron counts over included regions per fish, compute mean ± SD (with ddof=1).
6. **Region Projections**:
   - **Top view**: For each non-retina region, retrieve the 3D mask (`orientation='vertical'`), compute `np.mean(mask, axis=0)`, and accumulate into a composite image. Normalize to [0, 1].
   - **Side view**: Same process but compute `np.mean(mask, axis=2)`. Normalize to [0, 1].

### Visualization Phase
1. **Load Processed Data**: Load projection images and excluded region list from `PROCESS_DATA_DIR`.
2. **Representative Fish**: Select the 2nd dataset (index 1). Load centroids and region labels. Filter out neurons in excluded regions or with no region assignment.
3. **Color Palette**: Generate 11 evenly spaced HSV hues (S=0.65, V=0.90), repeat to cover all region IDs.
4. **Top View Panel** (left, 60% width):
   - `imshow` of top projection with `cmap='binary'`, `aspect='equal'`, `origin='lower'`.
   - Scatter plot of neuron centroids (X, Y) colored by region.
   - Axis limits: x=[65, 505], y=[850, 50].
5. **Side View Panel** (right, 40% width):
   - Rotate side projection 90° clockwise (`np.rot90(k=3)`).
   - `imshow` with same parameters.
   - Invert Z coordinates (`359 - z`) for centroids; scatter (inverted_z, y).
   - Axis limits: x=[40, 359], y=[850, 50].
6. Both axes have frames and ticks turned off.

## Key Parameters
| Parameter | Value | Description |
|---|---|---|
| `N_regions` | 70 | Number of brain regions in MapZebrain atlas |
| Retina region ID | 10 | Always excluded |
| Neuron count threshold | 25 | Minimum neurons per region to be considered sampled |
| Dataset fraction threshold | 0.50 | Minimum fraction of datasets a region must meet the count threshold |
| Representative fish index | 1 | 2nd dataset (0-indexed) used for visualization |
| HSV palette hues | 11 | Number of base colors in the cyclic palette |
| HSV saturation | 0.65 | Color saturation for neuron dots |
| HSV value | 0.90 | Color brightness for neuron dots |
| Scatter point size | 2 | Marker size for neurons |
| Scatter alpha | 0.6 | Transparency for neuron markers |
| Figure size | (8, 6) | Width × height in inches |
| DPI | 300 | Output resolution |
| Top view xlim | [65, 505] | Horizontal crop for dorsal view |
| Top view ylim | [850, 50] | Vertical crop for dorsal view (inverted) |
| Side view xlim | [40, 359] | Horizontal crop for lateral view |
| Side view ylim | [850, 50] | Vertical crop for lateral view (inverted) |

## Usage Example
```python
import os
os.environ['ZEBRAFISH_PATH'] = '/path/to/zebrafish/data'
os.environ['ATLAS_PATH'] = '/path/to/atlas'
os.environ['PROCESS_DATA_DIR'] = '/path/to/processed'
os.environ['SAVE_DIR'] = '/path/to/output'

# Then run the skill script
# Outputs:
#   processed/Figure1_N_neurons_per_region.npy
#   processed/Figure1_excluded_regions.npy
#   processed/Figure1_projection_regions_top.npy
#   processed/Figure1_projection_regions_side.npy
#   output/figure.png
#   output/statistics.json
```

## Dependencies
- `numpy` — array operations and file I/O
- `matplotlib` — figure generation
- `h5py` — reading HDF5 data files
- `colorsys` — HSV to RGB color conversion
- `zebrafish_Ca_utils` — custom toolkit providing `MapzebrainAtlas` and `get_datasets` (from shared library path)
- Python standard library: `os`, `sys`, `json`, `pathlib`

## Limitations
- Assumes exactly 70 brain regions in the atlas; if the atlas changes, `N_regions` must be updated.
- Region assignment uses `argmax` on boolean labels, so neurons labeled in multiple regions are assigned to the lowest-indexed region.
- The representative fish is hardcoded as the 2nd dataset (index 1); requires at least 2 datasets.
- The color palette cycles every 11 regions, so non-adjacent regions may share colors.
- Z-coordinate inversion for side view uses a fixed value of 359; this depends on atlas dimensions.
- The exclusion threshold (25 neurons, 50% of datasets) is fixed and not parameterized at runtime.
- Projection normalization divides by max, which can be sensitive to outlier regions.

## Source
Derived from a zebrafish whole-brain calcium imaging analysis pipeline for mapping neuronal somatic locations across 22 larval zebrafish onto the MapZebrain standard atlas, with region-based exclusion criteria and dual-projection visualization.
