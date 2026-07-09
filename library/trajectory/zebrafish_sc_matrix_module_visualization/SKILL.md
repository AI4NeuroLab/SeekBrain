# Zebrafish SC Matrix Module Visualization

## Description
This skill visualizes the modular organization of a zebrafish undirected structural connectivity (SC) matrix. It loads the SC matrix and pre-computed community module labels (4 modules), excludes specified brain regions, squares the matrix element-wise for contrast enhancement, reorders regions by module membership, and renders a heatmap with thick black boxes highlighting each module's block along the diagonal. The output is a clean, publication-ready figure with a horizontal colorbar.

## Tags
- zebrafish
- structural connectivity
- adjacency matrix
- community detection
- module visualization
- heatmap
- co-assignment matrix
- brain connectivity
- block-diagonal
- neuroanatomy

## Input
- **Undirected SC matrix**: `SC_matrix_undirected_terminals_expanded.npy` — a square NumPy array (N×N) of undirected structural connectivity values, located in `ZEBRAFISH_PATH/Files/`.
- **Module labels**: `Figure3_coassignment_matrix_SC_4module_ordered.npy` — a 1D NumPy array of integer labels indicating which of the 4 modules each brain region belongs to, located in `PROCESS_DATA_DIR`.
- **Excluded regions**: `Figure1_excluded_regions.npy` — a 1D NumPy array of integer indices specifying brain regions to exclude from the SC matrix, located in `PROCESS_DATA_DIR`.

## Output
- A PNG image (`figure_refine.png`) saved to `SAVE_DIR` showing:
  - A square heatmap of the squared SC matrix, ordered by module membership.
  - Four thick black rectangular outlines marking each community module block on the diagonal.
  - A horizontal colorbar labeled "SC²".
  - No axis ticks or labels.

## Algorithm / Processing Steps
1. **Load data**: Load the undirected SC matrix, the 4-module label array, and the excluded regions index array from their respective file paths.
2. **Exclude regions**: Create a boolean mask over all brain regions, setting excluded region indices to `False`. Use this mask to filter both rows/columns of the SC matrix and the corresponding module labels.
3. **Square the matrix**: Compute element-wise square of the filtered SC matrix (`SC²`) to enhance contrast of strong connections.
4. **Sort by module**: Sort the region indices according to their module labels using `np.argsort`, then reorder the squared SC matrix accordingly to produce a block-diagonal layout.
5. **Render heatmap**: Display the sorted squared matrix using `imshow` with the `'Purples'` colormap and square aspect ratio.
6. **Draw module boxes**: For each unique module label, compute the block size and position along the diagonal, then draw a `matplotlib.patches.Rectangle` with `linewidth=3` and black edge color.
7. **Add colorbar**: Attach a horizontal colorbar below the plot with the label "SC²".
8. **Clean axes**: Remove all x and y axis ticks and labels.
9. **Save**: Export the figure as a high-resolution (300 DPI) PNG.

## Key Parameters
| Parameter | Value / Default | Description |
|---|---|---|
| `cmap` | `'Purples'` | Colormap for the heatmap |
| `edge_color` | `'black'` | Color of the module-highlighting rectangles |
| `linewidth` | `3` | Thickness of the module box edges |
| `aspect` | `'equal'` | Ensures square pixels in the matrix plot |
| `dpi` | `300` | Output image resolution |
| `figsize` | `(8, 8)` | Figure dimensions in inches |
| Power exponent | `2` | Element-wise exponent applied to the SC matrix for contrast enhancement |

## Usage Example
```python
import os, numpy as np, matplotlib.pyplot as plt

ZEBRAFISH_PATH = os.getenv("ZEBRAFISH_PATH")
PROCESS_DATA_DIR = os.getenv("PROCESS_DATA_DIR")
SAVE_DIR = os.getenv("SAVE_DIR")

# Load data
sc_matrix = np.load(os.path.join(ZEBRAFISH_PATH, "Files", "SC_matrix_undirected_terminals_expanded.npy"))
module_labels = np.load(os.path.join(PROCESS_DATA_DIR, "Figure3_coassignment_matrix_SC_4module_ordered.npy"))
excluded = np.load(os.path.join(PROCESS_DATA_DIR, "Figure1_excluded_regions.npy")).astype(int)

# Exclude regions
mask = np.ones(sc_matrix.shape[0], dtype=bool)
mask[excluded] = False
sc_filtered = sc_matrix[mask][:, mask]
labels_filtered = module_labels[mask]

# Square and visualize
sc_sq = sc_filtered ** 2
fig, ax = plt.subplots(figsize=(8, 8), dpi=300)
im = plot_matrix_communities(sc_sq, labels_filtered, ax=ax, cmap='Purples', edge_color='black')
cbar = plt.colorbar(im, ax=ax, orientation='horizontal', fraction=0.046, pad=0.08)
cbar.set_label('SC^2')
ax.set_xticks([]); ax.set_yticks([])
plt.savefig(os.path.join(SAVE_DIR, "figure_refine.png"), bbox_inches='tight', dpi=300)
plt.close()
```

## Dependencies
- Python 3.x
- NumPy
- Matplotlib

## Limitations
- The skill is designed specifically for 4 modules; adapting to a different number of modules requires only changing the input label array, but the visual layout may need adjustment for very many modules.
- The `plot_matrix_communities` function reorders the matrix by sorting on module labels; the original region ordering is not preserved in the output.
- The element-wise squaring may suppress weak but biologically meaningful connections; the exponent is fixed at 2.
- The excluded regions array must use indices consistent with the full SC matrix dimensionality.
- Module labels must align in length with either the full or already-filtered SC matrix.

## Source
Derived from zebrafish structural connectivity analysis pipeline (Figure 3 related), visualizing community/module structure of the SC co-assignment matrix using undirected SC connectivity data.