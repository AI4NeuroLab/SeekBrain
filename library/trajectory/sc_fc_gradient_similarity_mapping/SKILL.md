# SC-FC Gradient Similarity Mapping

## Description
This skill establishes an optimal linear mapping between structural connectivity (SC) and functional connectivity (FC) gradients by computing a pairwise Pearson correlation matrix between the first N modes of each gradient set, then applying the Hungarian algorithm to find the best one-to-one assignment that maximizes absolute similarity. The result is a sorted correlation matrix that reveals the diagonal structure of matched SC-FC gradient pairs, visualized as a heatmap of absolute correlation values.

## Tags
- connectomics
- structural connectivity
- functional connectivity
- gradients
- correlation matrix
- linear assignment
- Hungarian algorithm
- eigenmode matching
- brain connectivity
- heatmap

## Input
- **SC gradients**: NumPy array of shape `(n_modes, n_regions)` stored as `.npy` file, where each row is a structural connectivity gradient/eigenmode.
- **FC gradients**: NumPy array of shape `(n_modes, n_regions)` stored as `.npy` file, where each row is a functional connectivity gradient/eigenmode.
- **n_modes**: Number of leading gradient modes to include in the analysis (default: 50).

## Output
- **Sorted correlation matrix**: NumPy array of shape `(n_modes, n_modes)` saved as `.npy`, where columns have been reordered according to the optimal matching. Rows correspond to SC gradients, columns to reordered FC gradients.
- **Mapping indices**: NumPy array of shape `(n_modes,)` saved as `.npy`, indicating which FC gradient index is matched to each SC gradient index.
- **Heatmap figure**: A square heatmap (PNG) displaying `|r|` values with `Reds` colormap, showing the diagonal structure of matched gradient pairs.
- **Statistics JSON**: Summary statistics including mean correlation, mean absolute correlation, and mean diagonal correlation.

## Algorithm / Processing Steps
1. **Load data**: Load SC and FC gradient arrays from `.npy` files.
2. **Select modes**: Extract the first N modes (rows) from both SC and FC gradient matrices.
3. **Compute pairwise correlation matrix**: For each pair of SC mode `i` and FC mode `j`, compute the Pearson correlation coefficient `r(i,j)`, yielding an `N x N` correlation matrix.
4. **Optimal matching via Hungarian algorithm**: Construct a cost matrix as `1 - |r|` and apply `scipy.optimize.linear_sum_assignment` to find the permutation of FC modes that maximizes the sum of absolute diagonal correlations.
5. **Recompute sorted correlation matrix**: Using the optimal mapping, reorder FC modes (columns) and recompute the full `N x N` Pearson correlation matrix with the new column ordering.
6. **Visualization**: Plot the absolute value of the sorted correlation matrix as a heatmap with axes labeled for SC gradients (x-axis) and FC gradients (y-axis), with a colorbar indicating gradient similarity `|r|`.
7. **Save outputs**: Save the sorted correlation matrix, mapping indices, figure, and summary statistics.

## Key Parameters
| Parameter | Default | Description |
|-----------|---------|-------------|
| `n_modes` | 50 | Number of leading gradient modes to analyze |
| `method` | `'pearson'` | Correlation method (`'pearson'` or `'spearman'`) |
| `cmap` | `'Reds'` | Colormap for the heatmap visualization |
| `figsize` | `(5, 5)` | Figure size in inches |
| `return_mapping` | `True` | Whether to return the optimal mapping indices |

## Usage Example
```python
import numpy as np
from scipy.stats import pearsonr
from scipy.optimize import linear_sum_assignment

# Load gradients
sc_gradients = np.load('Figure6_SC_gradients.npy')  # shape: (n_modes, n_regions)
fc_gradients = np.load('Figure6_FC_gradients.npy')  # shape: (n_modes, n_regions)

# Select first 50 modes
sc_modes = sc_gradients[:50, :]
fc_modes = fc_gradients[:50, :]

# Compute similarity matrix with optimal matching
correlations, mapping = compute_mode_similarity_matrix(
    sc_modes, fc_modes, return_mapping=True, method='pearson'
)

# Visualize absolute correlation matrix
import matplotlib.pyplot as plt
fig, ax = plt.subplots(figsize=(5, 5))
im = ax.imshow(np.abs(correlations).T, cmap='Reds', aspect='equal')
ax.set_xlabel('SC gradients')
ax.set_ylabel('FC gradients')
plt.colorbar(im, label='Gradient similarity |r|')
plt.savefig('sc_fc_gradient_similarity.png', dpi=300, bbox_inches='tight')
```

## Dependencies
- `numpy`
- `scipy` (specifically `scipy.stats.pearsonr`, `scipy.stats.spearmanr`, `scipy.optimize.linear_sum_assignment`)
- `matplotlib`
- `json` (for saving statistics)

## Limitations
- The pairwise correlation computation has `O(N² × R)` complexity where `N` is the number of modes and `R` is the number of regions, which can be slow for large `N`.
- The Hungarian algorithm finds a globally optimal one-to-one mapping, but assumes each SC gradient maps to exactly one FC gradient. It does not capture many-to-one or partial mappings.
- The method uses absolute correlation for matching, so it does not distinguish between positive and negative correlations (sign ambiguity inherent in eigenmodes).
- Pearson correlation assumes linear relationships; nonlinear SC-FC gradient correspondences would not be captured.
- The analysis assumes gradients are pre-computed and stored with modes as rows and regions as columns.

## Source
Derived from a connectomics analysis pipeline comparing structural and functional connectivity gradients using eigenvalue decomposition and optimal linear mapping via the Hungarian algorithm.