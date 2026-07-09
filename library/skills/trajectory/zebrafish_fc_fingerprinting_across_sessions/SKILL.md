# Zebrafish FC Fingerprinting Across Sessions

## Description
This skill assesses the feasibility of identifying individual zebrafish larvae across two separate imaging sessions (e.g., 24 hours apart) using functional connectivity (FC) fingerprinting. It computes a symmetric FC similarity matrix by correlating the upper-triangular elements of each larva's FC matrix at one time point with those at another time point, then visualizes the result as a heatmap. If larvae are identifiable, the diagonal elements (same-fish comparisons) should be consistently higher than off-diagonal elements (different-fish comparisons).

## Tags
- zebrafish
- functional connectivity
- fingerprinting
- calcium imaging
- Pearson correlation
- similarity matrix
- individual identification
- test-retest reliability
- heatmap
- larval neuroscience

## Input
- **FC matrices at time point 1**: NumPy array file (`.npy`) with shape `[N_subjects, N_regions, N_regions]` — functional connectivity matrices for the first imaging session (e.g., `FC_matrices_fingerprinting_6dpf.npy`).
- **FC matrices at time point 2**: NumPy array file (`.npy`) with shape `[N_subjects, N_regions, N_regions]` — functional connectivity matrices for the second imaging session (e.g., `FC_matrices_fingerprinting_7dpf.npy`).
- Both files must contain the same number of subjects, and subject order must be consistent across files.

## Output
- **Symmetric FC similarity matrix**: Saved as `Figure1_FC_fingerprinting.npy` in `PROCESS_DATA_DIR`. Shape: `[N_subjects, N_subjects]`. Each element `(i, j)` represents the average FC similarity between larva `i` and larva `j` across the two sessions.
- **Heatmap figure**: A white-to-red (`Reds` colormap) heatmap of the symmetric similarity matrix with:
  - Color axis range `[0.60, 0.85]`
  - White asterisks (`*`) marking the maximum similarity value in each row
  - Fish IDs (1-indexed) on both axes
  - Colorbar labeled "FC similarity"
- **Statistics JSON**: Includes within-fish similarity (diagonal), between-fish similarity (off-diagonal), identification accuracy, and overall matrix statistics.

## Algorithm / Processing Steps
1. **Load FC matrices**: Load the two `.npy` files containing FC matrices for all subjects at the two time points. Validate that both have the same number of subjects and that matrices are square.
2. **Vectorize upper triangle**: For each subject's FC matrix at each time point, extract the upper-triangular elements (excluding the diagonal, `k=1`) into a 1D feature vector using `np.triu_indices`.
3. **Compute cross-session similarity matrix**: For every pair of subjects `(i, j)`, compute the Pearson correlation coefficient between the FC vector of subject `i` at time point 1 and the FC vector of subject `j` at time point 2. This produces an `[N_subjects, N_subjects]` asymmetric similarity matrix.
4. **Symmetrize the matrix**: Average the similarity matrix with its transpose: `symmetric = 0.5 * (S + S^T)`. This accounts for both temporal directions of comparison.
5. **Save the symmetric matrix**: Store the result as a `.npy` file.
6. **Identify row-wise maxima**: For each row, find the column index with the highest similarity value. If it falls on the diagonal, the larva was correctly self-identified.
7. **Compute identification accuracy**: Calculate the fraction of larvae whose maximum cross-session similarity is with themselves.
8. **Visualize**: Plot the heatmap with `imshow`, overlay white asterisks at maximum positions per row, and add appropriate labels, ticks, and colorbar.
9. **Save statistics**: Compute and export within-fish vs. between-fish similarity distributions, identification accuracy, and matrix summary statistics.

## Key Parameters
| Parameter | Value / Description |
|---|---|
| `k` (triu_indices) | `1` — excludes the diagonal when vectorizing FC matrices |
| `cmap` | `'Reds'` — white-to-red colormap |
| `vmin, vmax` | `0.60, 0.85` — color axis range for the heatmap |
| Correlation metric | Pearson correlation (`np.corrcoef`) |
| Symmetrization | Averaging: `0.5 * (S + S^T)` |
| Asterisk style | White (`'*'`), bold, fontsize 14, centered |
| Fish IDs | 1-indexed (1 to N_subjects) |

## Usage Example
```python
import numpy as np
import os

# Set paths
ZEBRAFISH_PATH = os.getenv("ZEBRAFISH_PATH")
PROCESS_DATA_DIR = os.getenv("PROCESS_DATA_DIR")
SAVE_DIR = os.getenv("SAVE_DIR")

# Load FC matrices
fc_6dpf = np.load(os.path.join(ZEBRAFISH_PATH, "Files", "FC_matrices_fingerprinting_6dpf.npy"))
fc_7dpf = np.load(os.path.join(ZEBRAFISH_PATH, "Files", "FC_matrices_fingerprinting_7dpf.npy"))

N_subjects = fc_6dpf.shape[0]

# Vectorize upper triangles
def vectorize_upper_triangle(matrix, k=1):
    iu = np.triu_indices(matrix.shape[0], k=k)
    return matrix[iu].astype(float)

fc_6dpf_vectors = np.array([vectorize_upper_triangle(fc_6dpf[i]) for i in range(N_subjects)])
fc_7dpf_vectors = np.array([vectorize_upper_triangle(fc_7dpf[i]) for i in range(N_subjects)])

# Compute and symmetrize similarity matrix
similarity_matrix = np.zeros((N_subjects, N_subjects))
for i in range(N_subjects):
    for j in range(N_subjects):
        similarity_matrix[i, j] = np.corrcoef(fc_6dpf_vectors[i], fc_7dpf_vectors[j])[0, 1]

symmetric_similarity = 0.5 * (similarity_matrix + similarity_matrix.T)
np.save(os.path.join(PROCESS_DATA_DIR, "Figure1_FC_fingerprinting.npy"), symmetric_similarity)

# Check identification accuracy
max_indices = np.argmax(symmetric_similarity, axis=1)
accuracy = np.mean(max_indices == np.arange(N_subjects))
print(f"Identification accuracy: {accuracy * 100:.1f}%")
```

## Dependencies
- `numpy` — array operations, correlation, file I/O
- `matplotlib` — heatmap visualization
- `json` — statistics export
- Input `.npy` files with FC matrices of shape `[N_subjects, N_regions, N_regions]`

## Limitations
- Assumes subjects are in the same order across both time-point files; no explicit subject matching or alignment is performed.
- Pearson correlation is sensitive to outliers and assumes linear relationships between FC profiles.
- The color axis range `[0.60, 0.85]` is hardcoded and may need adjustment for datasets with different similarity distributions.
- The method requires consistent brain region parcellation across sessions; differences in registration or region definitions could degrade fingerprinting performance.
- NaN handling is minimal; subjects with many NaN values in their FC matrices may produce unreliable correlations.
- The symmetrization approach (averaging both directions) assumes the asymmetry is due to noise rather than meaningful directional differences.
- The approach does not account for group-level FC structure; high baseline similarity among all subjects could inflate off-diagonal values and reduce discriminability.

## Source
Derived from a zebrafish larval calcium imaging FC fingerprinting analysis pipeline comparing 6dpf and 7dpf imaging sessions across a cohort of larvae to evaluate individual identifiability via functional connectivity profiles.
