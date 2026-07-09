# Zebrafish FC Network Similarity Analysis

## Description
This skill evaluates whether functional connectivity (FC) matrices across zebrafish larvae at a similar developmental stage are stereotyped. It computes pairwise Pearson correlations between the vectorized upper triangles of each larva's FC matrix, orders larvae by their mean similarity to all others, and visualizes the ordered similarity matrix as a lower-triangular heatmap. The analysis quantifies inter-individual FC consistency and provides summary statistics including average Pearson's r across all pairwise comparisons.

## Tags
- zebrafish
- functional connectivity
- network similarity
- Pearson correlation
- heatmap
- lower-triangle matrix
- calcium imaging
- stereotypy
- pairwise comparison
- developmental neuroscience

## Input
- **FC matrices file**: A NumPy `.npy` file containing a 3D array of shape `(n_larvae, n_regions, n_regions)` where each slice is a symmetric functional connectivity matrix for one larva (e.g., `Figure1_FC_matrices.npy`).
- **Environment variables**:
  - `PROCESS_DATA_DIR`: Directory containing the input FC matrices and where intermediate results are saved.
  - `SAVE_DIR`: Directory where figures and statistics are saved.

## Output
1. **Ordered larva IDs** (`Figure1_FC_network_similarity_larvaID.npy`): A 1D NumPy array of fish identifiers (e.g., "Fish 1", "Fish 5", ...) sorted by descending mean similarity.
2. **Ordered network similarity matrix** (`Figure1_FC_network_similarity_across_larvae.npy`): A 2D NumPy array of shape `(n_larvae, n_larvae)` containing pairwise Pearson correlations, reordered so that the most globally similar larvae appear first.
3. **Statistics JSON** (`statistics.json`): Summary statistics including average Pearson's r, standard deviation, min, max, median, 25th and 75th percentiles, and number of valid comparisons.
4. **Lower-triangular heatmap figure** (`figure_refine.png`): A publication-quality heatmap of the ordered similarity matrix showing only the lower triangle and diagonal, using a white-to-red (Reds) colormap with color axis range [0.25, 0.80].

## Algorithm / Processing Steps
1. **Load & Preprocess**: Load the 3D FC matrices array from `.npy` file. Replace all NaN values with 0. Create fish identifiers ("Fish 1", "Fish 2", ...).
2. **Vectorize FC matrices**: For each larva, extract the upper triangle (excluding diagonal, k=1) of the FC matrix into a 1D vector using `np.triu_indices`.
3. **Compute initial similarity matrix**: For every pair of larvae (i, j), compute the Pearson correlation coefficient between their vectorized FC representations. Filter out non-finite values before computing correlation. Store results in an `(n_larvae, n_larvae)` matrix.
4. **Order by mean similarity**:
   - Compute the row-wise mean of the initial similarity matrix (mean similarity of each larva to all others).
   - Sort larvae indices in descending order of mean similarity.
   - Reorder the fish ID list accordingly.
   - Save the ordered fish IDs.
5. **Reorder similarity matrix**: Apply the sorted indices to both rows and columns of the initial similarity matrix to produce the ordered similarity matrix. Save to disk.
6. **Compute summary statistics**: Extract all off-diagonal elements from the ordered similarity matrix. Compute mean, standard deviation, min, max, median, and percentiles of the Pearson's r values. Save as JSON.
7. **Visualize**: Create a lower-triangular heatmap by masking the upper triangle (k=1). Use `imshow` with `cmap='Reds'`, `vmin=0.25`, `vmax=0.80`. Add a colorbar labeled "FC similarity". Display ordered fish numbers as tick labels on left and bottom. Set y-axis label to "Larvae". Remove tick marks, hide top and right spines.

## Key Parameters
| Parameter | Value | Description |
|-----------|-------|-------------|
| `k` (triu) | 1 | Excludes diagonal when extracting upper triangle of FC matrices |
| `cmap` | `'Reds'` | White-to-red colormap for the heatmap |
| `vmin` | 0.25 | Minimum value for colormap range |
| `vmax` | 0.80 | Maximum value for colormap range |
| `nan_replacement` | 0.0 | Value used to replace NaN entries in FC matrices |
| `minimum_valid_points` | 3 | Minimum number of finite paired values required to compute Pearson r |
| Sorting order | Descending | Larvae sorted from most to least globally similar |

## Usage Example
```python
import os
import numpy as np
from scipy.stats import pearsonr

# Set paths
PROCESS_DATA_DIR = "/path/to/data"
SAVE_DIR = "/path/to/output"

# Load FC matrices
fc_matrices = np.load(os.path.join(PROCESS_DATA_DIR, "Figure1_FC_matrices.npy"), allow_pickle=True)
fc_matrices = np.nan_to_num(fc_matrices, nan=0.0)
n_larvae = fc_matrices.shape[0]

# Vectorize upper triangles
def vectorize_upper_triangle(matrix, k=1):
    iu = np.triu_indices(matrix.shape[0], k=k)
    return matrix[iu].astype(float)

fc_vectors = np.array([vectorize_upper_triangle(fc_matrices[i]) for i in range(n_larvae)])

# Compute pairwise similarity
sim_matrix = np.zeros((n_larvae, n_larvae))
for i in range(n_larvae):
    for j in range(n_larvae):
        valid = np.isfinite(fc_vectors[i]) & np.isfinite(fc_vectors[j])
        if valid.sum() >= 3:
            sim_matrix[i, j], _ = pearsonr(fc_vectors[i][valid], fc_vectors[j][valid])

# Order by mean similarity
sorted_idx = np.argsort(np.nanmean(sim_matrix, axis=1))[::-1]
ordered_sim = sim_matrix[sorted_idx, :][:, sorted_idx]

# Report
off_diag = ordered_sim[~np.eye(n_larvae, dtype=bool)]
print(f"Average Pearson's r: {np.mean(off_diag):.4f}")
```

## Dependencies
- `numpy` — Array operations, data loading/saving
- `scipy.stats.pearsonr` — Pearson correlation computation
- `matplotlib.pyplot` — Heatmap visualization
- `json` — Statistics output serialization
- Optional: `zebrafish_Ca_utils` (custom utility library from shared toolkit)

## Limitations
- Assumes all FC matrices have identical dimensions (same number of brain regions).
- NaN values are replaced with 0, which may introduce bias if many entries are NaN; an alternative would be pairwise-complete observation handling.
- Pearson correlation assumes linear relationships between FC patterns and may not capture nonlinear similarities.
- The ordering heuristic (by mean similarity) provides one particular view; hierarchical clustering could reveal more nuanced group structure.
- The fixed color range [0.25, 0.80] is tuned for this dataset and may need adjustment for other datasets with different similarity distributions.
- Does not perform statistical significance testing on the pairwise correlations or correct for multiple comparisons.

## Source
Derived from a zebrafish calcium imaging functional connectivity analysis pipeline investigating whether FC networks are stereotyped across larvae at similar developmental stages. The pipeline uses pre-computed FC matrices and produces an ordered inter-individual similarity matrix with associated statistics and visualization.