# Zebrafish Structural Connectivity Network Atlas Overlay

## Description
This skill produces a dual-panel figure visualizing the zebrafish brain structural connectivity (SC) network spatially mapped onto anatomical atlas projection images. It loads an undirected SC matrix, excludes specified brain regions, constructs a bilateral SC matrix by tiling, and renders both a dorsal (Top/XY) and lateral (Side/XZ) view. Regional centroids serve as network nodes plotted atop grayscale atlas backgrounds, with edges color-coded by connection strength using a blue-to-white colormap. The bottom quartile of edges is suppressed to reduce visual clutter, and stronger connections are drawn on top for emphasis.

## Tags
- zebrafish
- structural connectivity
- brain atlas
- network visualization
- connectome
- MapzebrainAtlas
- centroid overlay
- dorsal view
- sagittal view
- graph network
- neuroscience

## Input
- **SC matrix**: `SC_matrix_undirected_terminals_expanded.npy` — a square NumPy array representing undirected structural connectivity weights between brain regions (one hemisphere).
- **Excluded regions**: `Figure1_excluded_regions.npy` — a 1D NumPy integer array listing region indices to remove before visualization.
- **Zebrafish atlas**: `MapzebrainAtlas` class loaded from the Atlas folder, providing:
  - Left and right hemisphere regional centroids (`atlas.centroids['left']`, `atlas.centroids['right']`).
  - Atlas projection images: `XY_H2BGCaMP6s.tif` (dorsal) and `XZ_H2BGCaMP6s.tif` (sagittal).

## Output
- **Figure** (`figure.png`): A two-panel image (8×6 inches, 300 DPI) with:
  - **Left panel (Top View)**: Dorsal XY projection with SC network overlay, "Top" label, and 100 μm scale bar.
  - **Right panel (Side View)**: Sagittal XZ projection (rotated 90° clockwise) with SC network overlay and "Side" label.
- **Statistics** (`statistics.json`): JSON file containing region counts, edge counts, edge weight statistics (min, max, mean, median, 25th percentile), and centroid coordinate ranges.

## Algorithm / Processing Steps
1. **Load Data**: Read the undirected SC matrix, excluded region indices, and atlas centroids for left and right hemispheres.
2. **Construct Bilateral Centroids**: Concatenate left and right hemisphere centroids into a single array.
3. **Construct Bilateral SC Matrix**: Tile the single-hemisphere SC matrix into a 2×2 block matrix representing full bilateral connectivity.
4. **Remove Excluded Regions**: Build a bilateral exclusion index list (original indices + shifted indices for the second hemisphere) and remove corresponding rows/columns from both the SC matrix and centroid array.
5. **Coordinate Preparation**:
   - For Top View (XY): Flip the Y-coordinate (`Y_max - Y`) to match image orientation.
   - For Side View (XZ): Invert Z-coordinate (`Z_max - Z`) for the horizontal axis, retain transformed Y for the vertical axis.
6. **Edge Extraction**: Extract all non-zero, non-diagonal upper-triangle edges from the bilateral SC matrix.
7. **Edge Filtering**: Compute the 25th percentile of edge weights; discard edges below this threshold.
8. **Edge Sorting**: Sort remaining edges by weight (ascending) so stronger connections render on top.
9. **Top View Rendering**:
   - Display XY atlas image with `cmap='binary'`.
   - Draw edges using `LineCollection` with `cmap='Blues_r'`, `linewidth=0.8`, color limits `[0, 1]`.
   - Scatter plot nodes: white face, black edge, size 10.
   - Set axis limits: x=[65, 505], y=[850, 50] (inverted). Hide axes.
   - Add "Top" text label and 100 μm scale bar.
10. **Side View Rendering**:
   - Rotate XZ atlas image 90° clockwise using `scipy.ndimage.rotate`.
   - Draw edges and nodes with same parameters as Top View using transformed coordinates.
   - Set axis limits: x=[40, 359], y=[850, 50]. Hide axes.
   - Add "Side" text label.
11. **Save**: Export figure and statistics JSON.

## Key Parameters
| Parameter | Value | Description |
|---|---|---|
| Figure size | (8, 6) | Overall figure dimensions in inches |
| Top view width | 60% | Fraction of figure width for dorsal panel |
| Side view width | 40% | Fraction of figure width for sagittal panel |
| Node size | 10 | Scatter marker size |
| Node face color | white | Marker fill color |
| Node edge color | black | Marker border color |
| Edge colormap | `Blues_r` | Blue-to-white reversed colormap |
| Edge color limits | [0, 1] | Normalized weight range for colormap |
| Edge line width | 0.8 | Line thickness for edges |
| Edge threshold | 25th percentile | Bottom quartile suppression |
| Top view x-limits | [65, 505] | Horizontal axis bounds |
| Top view y-limits | [850, 50] | Vertical axis bounds (inverted) |
| Side view x-limits | [40, 359] | Horizontal axis bounds |
| Side view y-limits | [850, 50] | Vertical axis bounds (inverted) |
| Scale bar | 100 μm | Physical reference bar length |
| Pixel-to-μm conversion | 1 px ≈ 0.8 μm | Assumed spatial scale factor |
| Y-coordinate max (flip) | 974 | Used to invert Y for top view |
| Z-coordinate max (flip) | 359 | Used to invert Z for side view |

## Usage Example
```python
import os
os.environ["PROCESS_DATA_DIR"] = "/path/to/processed_data"
os.environ["SAVE_DIR"] = "/path/to/output"
os.environ["ZEBRAFISH_PATH"] = "/path/to/dataverse_files"

# Run the script to generate:
# - figure.png: Dual-panel SC network on atlas
# - statistics.json: Network and region statistics
exec(open("zebrafish_sc_network_atlas_overlay.py").read())
```

## Dependencies
- **Python packages**: `numpy`, `matplotlib`, `scipy` (ndimage), `Pillow` (PIL), `json`, `sys`, `os`
- **Custom library**: `zebrafish_Ca_utils.MapzebrainAtlas` — atlas loader providing hemisphere centroids and projection images
- **Data files**:
  - `SC_matrix_undirected_terminals_expanded.npy`
  - `Figure1_excluded_regions.npy`
  - Atlas folder with `XY_H2BGCaMP6s.tif`, `XZ_H2BGCaMP6s.tif`

## Limitations
- The pixel-to-μm conversion factor (1 px ≈ 0.8 μm) is assumed and may not be exact for all atlas versions; verify against atlas metadata.
- The bilateral SC matrix is constructed by simple 2×2 tiling, which assumes identical connectivity in both hemispheres and symmetric inter-hemisphere connections equal to intra-hemisphere weights.
- The 25th percentile edge threshold is hardcoded; different datasets may benefit from different thresholds.
- Only the upper triangle of the symmetric SC matrix is used for edge extraction, appropriate for undirected connectivity but not for directed analyses.
- Coordinate transformations (Y-flip constant 974, Z-flip constant 359) are specific to the MapzebrainAtlas resolution and may need adjustment for different atlas versions.
- The scale bar assumes a fixed pixel spacing and is positioned at hardcoded coordinates that may need adjustment if axis limits change.

## Source
Derived from a zebrafish structural connectivity visualization pipeline for overlaying SC network graphs on MapzebrainAtlas anatomical projections, following the layout and style conventions of published zebrafish connectome figures.