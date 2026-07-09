# Structural PC1 vs Functional Connectivity Correlation Analysis

## Description
This skill investigates whether structural properties collectively contribute to functional connectivity (FC) by performing a correlation analysis between the first principal component (PC1) of structural predictors and the FC matrix. It loads pre-computed connectivity matrices, removes excluded brain regions, extracts upper-triangle edge values, computes Pearson correlation, fits a linear regression, and produces a publication-quality scatter plot with the best-fit line and correlation statistic annotated.

## Tags
- neuroscience
- functional connectivity
- structural connectivity
- PCA
- Pearson correlation
- linear regression
- scatter plot
- brain connectivity
- structure-function relationship
- connectivity matrix

## Input
- **FC matrix** (`Figure1_FC_matrix.npy`): A square symmetric NumPy array representing the functional connectivity matrix between brain regions.
- **Structural PC1 matrix** (`Figure2_SC_predictor_PC1.npy`): A square symmetric NumPy array representing the first principal component of structural predictors between brain regions.
- **Excluded regions** (`Figure1_excluded_regions.npy`): A 1-D NumPy integer array containing indices of brain regions to be excluded from analysis (e.g., regions with insufficient data).

All matrices must be of compatible dimensions (same number of regions before exclusion).

## Output
- **Scatter plot** (`figure_refine.png`): A scatter plot with Structural PC1 on the x-axis and FC on the y-axis. Each point represents a pairwise brain connection (edge). Includes a medium violet-red best-fit regression line and the Pearson r value annotated in the upper-left corner. Top and right spines are removed for clean aesthetics.
- **Statistics JSON** (`statistics.json`): Contains sample sizes (original and filtered region counts, number of edges), Pearson correlation (r, p-value, r²), and linear regression parameters (slope, intercept, equation).

## Algorithm / Processing Steps
1. **Load data**: Read the FC matrix, structural PC1 matrix, and excluded regions index array from `.npy` files.
2. **Validate inputs**: Assert that FC and PC1 matrices have the same shape. Filter excluded region indices to valid bounds.
3. **Remove excluded regions**: Create a boolean keep-mask over regions, then index both matrices to remove rows and columns corresponding to excluded regions.
4. **Extract upper triangles**: Use `np.triu_indices(n, k=1)` to extract upper-triangle values (excluding diagonal) from both filtered matrices. This avoids double-counting symmetric edges and self-connections.
5. **Filter invalid values**: Remove any NaN or Inf entries from both vectors.
6. **Pearson correlation**: Compute the Pearson correlation coefficient (r) and p-value between the PC1 and FC edge vectors using `scipy.stats.pearsonr`.
7. **Linear regression**: Fit a first-order polynomial (`np.polyfit` with `deg=1`) to obtain slope and intercept for the best-fit line.
8. **Visualization**: Create a scatter plot with transparent black points, overlay the regression line in medium violet-red, annotate Pearson r in medium violet-red in the upper-left corner, label axes as "Structural PC1" and "FC", and remove top/right spines.
9. **Save outputs**: Save the figure as a high-resolution PNG and the statistics as a JSON file.

## Key Parameters
| Parameter | Value/Description |
|---|---|
| Upper triangle extraction | `k=1` (excludes diagonal) |
| Scatter point size | `s=5` |
| Scatter alpha (transparency) | `0.3` |
| Scatter color | Black |
| Best-fit line color | Medium violet-red (`mediumvioletred`) |
| Best-fit line width | `2` |
| Polynomial degree | `1` (linear) |
| Figure size | `(5, 4)` inches |
| Figure DPI | `300` |
| Correlation text position | Upper-left corner (`(0.05, 0.95)` in axes coordinates) |

## Usage Example
```python
import os
import numpy as np
from scipy.stats import pearsonr
import matplotlib.pyplot as plt

# Set data paths
PROCESS_DATA_DIR = "/path/to/processed_data"
SAVE_DIR = "/path/to/output"

# Load data
fc_matrix = np.load(os.path.join(PROCESS_DATA_DIR, "Figure1_FC_matrix.npy")).astype(float)
pc1_matrix = np.load(os.path.join(PROCESS_DATA_DIR, "Figure2_SC_predictor_PC1.npy")).astype(float)
excluded_regions = np.load(os.path.join(PROCESS_DATA_DIR, "Figure1_excluded_regions.npy")).astype(int)

# Remove excluded regions
keep_mask = np.ones(fc_matrix.shape[0], dtype=bool)
keep_mask[excluded_regions] = False
fc_filtered = fc_matrix[keep_mask][:, keep_mask]
pc1_filtered = pc1_matrix[keep_mask][:, keep_mask]

# Extract upper triangle
upper_idx = np.triu_indices(fc_filtered.shape[0], k=1)
fc_values = fc_filtered[upper_idx]
pc1_values = pc1_filtered[upper_idx]

# Correlation and regression
r, p = pearsonr(pc1_values, fc_values)
slope, intercept = np.polyfit(pc1_values, fc_values, 1)

# Plot
fig, ax = plt.subplots(figsize=(5, 4))
ax.scatter(pc1_values, fc_values, s=5, alpha=0.3, color='black', edgecolors='none')
x_line = np.linspace(pc1_values.min(), pc1_values.max(), 200)
ax.plot(x_line, slope * x_line + intercept, color='mediumvioletred', linewidth=2)
ax.set_xlabel('Structural PC1')
ax.set_ylabel('FC')
ax.spines['top'].set_visible(False)
ax.spines['right'].set_visible(False)
ax.text(0.05, 0.95, f'r = {r:.3f}', transform=ax.transAxes, color='mediumvioletred', va='top')
plt.savefig(os.path.join(SAVE_DIR, "figure_refine.png"), dpi=300, bbox_inches='tight')
```

## Dependencies
- **Python** (>=3.7)
- **NumPy**: Matrix operations, data loading, upper-triangle extraction, polynomial fitting
- **SciPy** (`scipy.stats.pearsonr`): Pearson correlation computation
- **Matplotlib**: Scatter plot visualization and figure export

## Limitations
- Assumes input matrices are square, symmetric, and of the same dimensionality before region exclusion.
- Only computes linear (first-order) relationships; nonlinear structure-function mappings are not captured.
- Does not correct for spatial autocorrelation or multiple comparisons, which may inflate the reported correlation.
- The Pearson correlation treats all pairwise edges as independent observations, which is a simplification given the network structure of brain connectivity.
- Does not perform significance testing beyond the standard Pearson p-value (e.g., permutation testing or spin tests for spatial data).
- Excluded regions must be provided as integer indices; the skill does not perform region exclusion based on data quality criteria automatically.

## Source
Derived from a neuroscience analysis pipeline investigating structure-function relationships in brain connectivity, specifically correlating the first principal component of structural predictors with functional connectivity matrices. Typical of analyses found in studies examining how anatomical/structural features predict functional brain organization.