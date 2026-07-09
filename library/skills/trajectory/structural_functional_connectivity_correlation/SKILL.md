# Structural-Functional Connectivity Correlation Analysis

## Description
This skill quantifies and visualizes the relationship between structural connectivity (SC) and functional connectivity (FC) in brain networks. It computes the Pearson correlation coefficient between the upper-triangle elements of the SC and FC matrices to assess how well physical wiring predicts correlated neural activity. A composite matrix visualization is produced where the lower triangle displays normalized SC and the upper triangle displays normalized FC, enabling direct visual comparison of structural and functional connection patterns across all brain region pairs.

## Tags
- connectivity
- structural connectivity
- functional connectivity
- Pearson correlation
- brain network
- composite matrix
- adjacency matrix
- heatmap
- neuroscience
- connectomics
- structure-function relationship
- nematoda
- C. elegans

## Input
- **SC matrix** (`SC_matrix_undirected_terminals_expanded.npy`): An undirected structural connectivity matrix (N×N numpy array) representing physical connections between brain regions.
- **FC matrix** (`Figure1_FC_matrix.npy`): A functional connectivity matrix (M×M numpy array, where M ≤ N) representing correlated activity between brain regions.
- **Excluded regions** (`Figure1_excluded_regions.npy`): A 1D numpy array of integer indices specifying brain regions to exclude from the SC matrix so that its dimensions match the FC matrix.

## Output
- **Composite matrix figure** (`figure_refine.png`): A high-resolution (600 DPI) heatmap showing normalized SC in the lower triangle and normalized FC in the upper triangle, with a white diagonal line, reversed Blues colormap, colorbar labeled "Normalized weight", and text annotations identifying each triangle.
- **Statistics file** (`statistics.json`): JSON file containing:
  - `pearson_r`: Pearson correlation coefficient between SC and FC upper-triangle elements
  - `pearson_p`: Associated p-value
  - `sc_l2_norm`: L2 norm used to normalize the SC matrix
  - `fc_l2_norm`: L2 norm used to normalize the FC matrix

## Algorithm / Processing Steps
1. **Load data**: Load the undirected SC matrix, FC matrix, and excluded regions list from `.npy` files.
2. **Region exclusion**: Remove rows and columns corresponding to excluded region indices from the SC matrix so its dimensions match the FC matrix.
3. **Symmetrization**: If the SC matrix is not perfectly symmetric, symmetrize it by averaging with its transpose: `SC = 0.5 * (SC + SC.T)`.
4. **Zero diagonals**: Set the diagonal elements of both SC and FC matrices to zero (no self-connections).
5. **Pearson correlation**: Extract upper-triangle elements (k=1, excluding diagonal) from both matrices. Compute the Pearson correlation coefficient and p-value between these vectors using `scipy.stats.pearsonr`.
6. **L2 normalization**: Normalize each matrix by dividing by its Euclidean (L2) norm: `SC_norm = SC / ||SC||₂`, `FC_norm = FC / ||FC||₂`.
7. **Composite matrix construction**: Create a composite matrix where the lower triangle contains normalized SC values and the upper triangle contains normalized FC values.
8. **Visualization**: Render the composite matrix using `imshow` with `cmap='Blues_r'` (blue=low, white=high), add a white diagonal line (linewidth=2), a colorbar labeled "Normalized weight" (no ticks), y-axis ticks at first and last region only labeled "Brain regions", and text annotations "Functional connectivity" (upper-right) and "Structural connectivity" (lower-left).

## Key Parameters
| Parameter | Value | Description |
|-----------|-------|-------------|
| Colormap | `Blues_r` | Reversed Blues: dark blue for low values, white for high values |
| Diagonal line | white, linewidth=2 | Visual separator between SC and FC triangles |
| Normalization | L2 norm (Euclidean) | Each matrix divided by its Frobenius/L2 norm before compositing |
| Triangle extraction | `k=1` (exclude diagonal) | Upper-triangle indices for correlation computation |
| Figure DPI | 600 | High-resolution output |
| Aspect ratio | `equal` | Square pixels in the matrix display |
| Symmetrization | `0.5 * (SC + SC.T)` | Applied only if SC is not already symmetric |

## Usage Example
```python
import os
os.environ["PROCESS_DATA_DIR"] = "/path/to/processed/data"
os.environ["SAVE_DIR"] = "/path/to/output"

# Ensure the following files exist:
# - SC_matrix_undirected_terminals_expanded.npy (in library or process data dir)
# - PROCESS_DATA_DIR/Figure1_FC_matrix.npy
# - PROCESS_DATA_DIR/Figure1_excluded_regions.npy

# Run the script to produce:
# - figure_refine.png (composite SC/FC visualization)
# - statistics.json (Pearson r, p-value, normalization factors)
```

## Dependencies
- `numpy` — matrix operations, file I/O
- `matplotlib` — visualization (imshow, colorbar, annotations)
- `scipy.stats` — `pearsonr` for Pearson correlation computation
- `json` — saving statistical results
- `os`, `sys` — path management

## Limitations
- Assumes that after removing excluded regions, the SC and FC matrices have identical dimensions and region ordering. No explicit region label matching is performed.
- The SC matrix must be at least as large as the FC matrix; if smaller after exclusion, an error is raised.
- Only the Pearson correlation is computed; nonlinear or partial correlation methods are not included.
- L2 normalization preserves relative magnitudes within each matrix but does not account for differences in value distributions (e.g., SC may be sparse while FC is dense).
- The reversed Blues colormap may make it difficult to distinguish very low values from zero in dense regions.
- No statistical correction for multiple comparisons is applied to the single Pearson test.
- Region identity labels are not displayed; only numeric indices (1 to N) are shown.

## Source
Pipeline for analyzing structure-function connectivity relationships in brain networks (e.g., C. elegans connectome studies), inspired by composite matrix visualizations commonly used in connectomics literature.