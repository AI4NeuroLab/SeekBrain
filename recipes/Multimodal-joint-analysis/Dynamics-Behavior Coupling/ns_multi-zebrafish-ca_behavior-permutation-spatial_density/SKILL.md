---
name: "ns_multi-zebrafish-ca_behavior-permutation-spatial_density"
description: "This recipe aggregates neuron centroids from multiple zebrafish larvae into a unified 3D brain atlas coordinate system, grouped by functional response categories: motor-correlated, motor-anticorrelated, dark-responsive, and light-responsive. It performs spatial statistical filtering using a permutation-based p-value test to retain only neurons in spatially consistent locations across individuals. The results are visualized as density-colored scatter plots on atlas projection backgrounds, providing a whole-brain map of functionally defined neuron populations."
triggers:
- "Analyze zebrafish neuron spatial distribution in 3d atlas coordinates"
- "Generate zebrafish neuron spatial distribution in 3d atlas coordinates outputs"
- "Apply the ns_multi-zebrafish-ca_behavior-permutation-spatial_density recipe"
tags:
- "zebrafish"
- "ca"
- "behavior"
- "permutation"
- "spatial"
version: "1.0"
---

# Zebrafish Neuron Spatial Distribution in 3D Atlas Coordinates

This recipe aggregates neuron centroids from multiple zebrafish larvae into a unified 3D brain atlas coordinate system, grouped by functional response categories: motor-correlated, motor-anticorrelated, dark-responsive, and light-responsive. It performs spatial statistical filtering using a permutation-based p-value test to retain only neurons in spatially consistent locations across individuals. The results are visualized as density-colored scatter plots on atlas projection backgrounds, providing a whole-brain map of functionally defined neuron populations.

## When to use this

Use this recipe to pool functionally classified neurons across larvae, test spatial enrichment by permutation, and display significant atlas-space densities for motor- and stimulus-responsive groups. Do not use it when coordinates have not been registered to the same atlas or when only a single-animal trace is required.

## Scientific context

Derived from a zebrafish whole-brain calcium imaging analysis pipeline for generating Figure 5-style spatial distribution maps of functionally categorized neurons across multiple larvae, mapped to a common brain atlas.

## Preconditions

- `numpy`
- `matplotlib`
- `tqdm`
- `mpl_toolkits.axes_grid1` (for `make_axes_locatable`)
- Custom zebrafish toolkit (`zebrafish_Ca_utils`):
  - `MapzebrainAtlas`: Atlas loader with XY/XZ projection images
  - `get_datasets()`: Scans directory for fish folders
  - `load_data()`: Loads per-fish core data (region_labels, centroids_atlas)
  - `identify_files()`: File identification utility
  - `spatial_p_value_test()`: Permutation-based spatial significance test
  - `compute_density_atlas()`: Gaussian kernel density estimation in atlas space

## Inputs and outputs

- **Zebrafish dataset directory** (`ZEBRAFISH_PATH`): Top-level directory containing per-fish subfolders, each with:
  - `correlated_motor.npy`: Boolean mask of motor-correlated neurons (optional per fish)
  - `anticorrelated_motor.npy`: Boolean mask of motor-anticorrelated neurons (optional per fish)
  - `correlated_dark.npy`: Boolean mask of dark-responsive neurons
  - `correlated_light.npy`: Boolean mask of light-responsive neurons
  - Core data loadable via `load_data()` including `region_labels` and `centroids_atlas`
- **Atlas directory** (`ATLAS_PATH`): Zebrafish brain atlas with XY and XZ projection images and regional annotations
- **Process data directory** (`PROCESS_DATA_DIR`): Directory for saving intermediate results
- **Save directory** (`SAVE_DIR`): Directory for saving the output figure

- **Consolidated centroid files** (`.npy`):
  - `Figure5_centroids_motor.npy`: 3D atlas centroids for motor-positive neurons
  - `Figure5_centroids_antimotor.npy`: 3D atlas centroids for motor-negative neurons
  - `Figure5_centroids_dark.npy`: 3D atlas centroids for dark-responsive neurons
  - `Figure5_centroids_light.npy`: 3D atlas centroids for light-responsive neurons
- **P-value files** (`.npy`):
  - `Figure5_pvalues_motor.npy`, `Figure5_pvalues_antimotor.npy`, `Figure5_pvalues_dark.npy`, `Figure5_pvalues_light.npy`
- **Figure** (`figure_refine.png`): A multi-panel figure with 4 groups (Motor positive, Motor negative, Dark, Light), each showing top view (XY) and side view (XZ) atlas projections with density-colored significant neuron centroids overlaid

## Procedure

### Step 1: Dataset Loading
1. Scan the top-level directory for fish subject folders using `get_datasets()`.
2. For each fish folder:
   - Load core data via `load_data()` (region_labels, centroids_atlas).
   - Exclude region 10 (retina) by setting `region_labels[:, 10] = 0`.
   - Define `in_brain` mask for cells with non-zero summed region labels.
   - Filter `centroids_atlas` using the `in_brain` mask.
   - Load `correlated_motor.npy` and `anticorrelated_motor.npy` if they exist; apply `in_brain` filter.
   - Load `correlated_dark.npy` and `correlated_light.npy`; apply `in_brain` filter.
   - Gracefully handle folders missing motor files by only processing visual response files.

### Step 2: Consolidate Centroids
1. For each category, concatenate all centroids and label masks across fish.
2. Use boolean label masks to select category-specific centroids from the pooled data.
3. Save consolidated centroid arrays to `PROCESS_DATA_DIR/Figure5_centroids_*.npy`.

### Step 3: Spatial Statistics
1. Apply `spatial_p_value_test()` with `N_shuffles=1000` to each category.
   - This function takes lists of per-fish centroids and labels, performing a permutation-based spatial test.
   - It returns p-values indicating whether each neuron's location is spatially consistent across individuals.
2. Concatenate p-values across fish and save to `PROCESS_DATA_DIR/Figure5_pvalues_*.npy`.

### Step 4: Visualization
1. Load atlas XY and XZ projection images from `MapzebrainAtlas`.
2. Rotate XZ projection 90° clockwise for side-view display.
3. For each category:
   - Filter centroids by `p < 0.025`.
   - Compute local density using `compute_density_atlas(sigma=10)`.
   - Sort centroids by density for proper layering.
4. Create a 4-group figure layout (each group has top view at 60% width and side view at 40% width).
5. For each group:
   - **Top View (XY)**: Display atlas XY projection (gray, vmax=200), overlay scatter with inverted x-coordinates, color by density (rainbow cmap, alpha=0.1, s=1).
   - **Side View (XZ)**: Display rotated atlas XZ projection, overlay scatter with inverted z-coordinates, same visual parameters.
   - Add category title, cell count label, and vertical colorbar.

## Key parameters

| Parameter | Value | Description |
|-----------|-------|-------------|
| `N_shuffles` | 1000 | Number of permutations for spatial p-value test |
| `significance` | 0.025 | P-value threshold for spatial filtering |
| `sigma` | 10 | Gaussian kernel width for density estimation |
| `excluded_region` | 10 (retina) | Brain region excluded from analysis |
| `cmap` (density) | `'rainbow'` | Colormap for density-colored scatter plots |
| `cmap` (atlas) | `'gray'` | Colormap for atlas background images |
| `vmax` (atlas) | 200 | Maximum intensity for atlas projection display |
| `alpha` | 0.1 | Transparency of scatter points |
| `s` | 1 | Scatter point size |
| `figsize` | (14, 4) | Overall figure size |
| `width_ratios` | [0.6, 0.4] | Top view vs side view width ratio within each group |

## Pitfalls

- Motor response data may be missing for some fish; those fish are excluded from motor/antimotor analysis but still contribute to dark/light analysis.
- The spatial p-value test with 1000 shuffles is computationally intensive for large datasets.
- The significance threshold (P < 0.025) is fixed and may need adjustment for different dataset sizes or analysis goals.
- Region 10 (retina) is hardcoded as excluded; other exclusion criteria require code modification.
- Scatter plot alpha=0.1 may obscure density patterns in very dense or very sparse regions.
- The boolean mask approach for category labels assumes masks are aligned with the total cell count before in_brain filtering.
- Density computation with fixed sigma=10 may not be optimal for all brain regions or spatial scales.

## Usage

```bash
python scripts/main.py
```
