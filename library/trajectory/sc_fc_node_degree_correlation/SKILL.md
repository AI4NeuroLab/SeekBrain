# Structural-Functional Connectivity Node Degree Correlation Analysis

## Description
This skill quantifies how physical (structural) connectivity predicts correlated neural activity (functional connectivity) in the zebrafish brain. It computes the weighted node degree for each brain region from both a structural connectivity (SC) matrix and a functional connectivity (FC) matrix, then assesses their spatial correlation using Pearson's correlation coefficient and linear regression. The result is a scatter plot visualizing each brain region's structural vs. functional degree, annotated with the correlation statistic and a best-fit regression line.

## Tags
- zebrafish
- structural connectivity
- functional connectivity
- node degree
- Pearson correlation
- structure-function coupling
- graph theory
- connectomics
- scatter plot
- linear regression
- brain atlas
- network neuroscience

## Input
- **SC matrix**: `SC_matrix_undirected_terminals_expanded.npy` — A square symmetric NumPy array representing undirected structural connectivity weights between brain regions (from the zebrafish connectome data).
- **FC matrix**: `PROCESS_DATA_DIR/Figure1_FC_matrix.npy` — A square symmetric NumPy array representing functional connectivity (e.g., correlation-based) between brain regions.
- **Excluded regions**: `PROCESS_DATA_DIR/Figure1_excluded_regions.npy` — A 1D NumPy array of integer indices specifying brain regions to exclude from analysis (e.g., regions with insufficient data or coverage).

## Output
- **SC degree vector**: `PROCESS_DATA_DIR/Figure2_Node_degree_SC.npy` — 1D array of weighted structural degree for each retained brain region.
- **FC degree vector**: `PROCESS_DATA_DIR/Figure2_Node_degree_FC.npy` — 1D array of weighted functional degree for each retained brain region.
- **Scatter plot**: `SAVE_DIR/figure_refine.png` — Scatter plot of structural degree (x-axis) vs. functional degree (y-axis) with a medium violet-red best-fit line and Pearson r annotation.
- **Statistics JSON**: `SAVE_DIR/statistics.json` — Contains number of regions, number of excluded regions, Pearson r, p-value, regression slope, intercept, and R-squared.

## Algorithm / Processing Steps
1. **Data Loading**: Load the SC matrix, FC matrix, and excluded region indices from their respective file paths.
2. **Region Exclusion**: Create a boolean mask from the excluded region indices. Remove the corresponding rows and columns from both the SC and FC matrices so that only valid, shared brain regions remain.
3. **Diagonal Zeroing**: Set the diagonal elements of both filtered matrices to zero to exclude self-connections.
4. **SC Weighted Degree Computation**: Sum each row of the filtered SC matrix to obtain the weighted structural degree for each node. Save as `Figure2_Node_degree_SC.npy`.
5. **FC Weighted Degree Computation**: Replace NaN/Inf values with zero, threshold negative values to zero (retain only positive functional connections), then sum each row to obtain weighted functional degree. Save as `Figure2_Node_degree_FC.npy`.
6. **Pearson Correlation**: Compute Pearson's r and associated p-value between the SC and FC degree vectors.
7. **Linear Regression**: Fit a first-order polynomial (via `scipy.stats.linregress`) to model FC degree as a function of SC degree.
8. **Visualization**: Generate a scatter plot with black data points (one per brain region), a medium violet-red regression line, axis labels ("Structural degree" and "Functional degree"), simplified spines (top and right removed), and the Pearson r value annotated in the upper-left corner.
9. **Statistics Export**: Save all computed statistics (correlation, regression parameters, region counts) to a JSON file.

## Key Parameters
| Parameter | Description | Default/Value |
|---|---|---|
| SC matrix file | Undirected structural connectivity matrix | `SC_matrix_undirected_terminals_expanded.npy` |
| FC matrix file | Functional connectivity matrix | `Figure1_FC_matrix.npy` |
| Excluded regions file | Indices of regions to remove | `Figure1_excluded_regions.npy` |
| FC thresholding | Negative FC values set to zero before degree computation | `max(value, 0)` |
| NaN handling | NaN/Inf values in FC replaced with 0 | `np.nan_to_num` |
| Scatter point size | Size of scatter plot markers | `s=20` |
| Scatter point color | Color of data points | `'black'` |
| Regression line color | Color of best-fit line | `'mediumvioletred'` |
| Figure DPI | Resolution of saved figure | `300` |
| Figure size | Dimensions of figure | `(5, 4)` inches |

## Usage Example
```python
import os
import numpy as np
from scipy.stats import pearsonr, linregress
import matplotlib.pyplot as plt

# Load data
sc_matrix = np.load("SC_matrix_undirected_terminals_expanded.npy", allow_pickle=True).astype(float)
fc_matrix = np.load("Figure1_FC_matrix.npy", allow_pickle=True).astype(float)
excluded = np.load("Figure1_excluded_regions.npy", allow_pickle=True).astype(int)

# Exclude regions
mask = np.ones(sc_matrix.shape[0], dtype=bool)
mask[excluded[excluded < sc_matrix.shape[0]]] = False
sc_filt = sc_matrix[mask][:, mask]
fc_filt = fc_matrix[mask][:, mask]

# Zero diagonals
np.fill_diagonal(sc_filt, 0.0)
np.fill_diagonal(fc_filt, 0.0)

# Compute degrees
sc_degree = np.sum(sc_filt, axis=1)
fc_clean = np.maximum(np.nan_to_num(fc_filt, nan=0.0), 0.0)
fc_degree = np.sum(fc_clean, axis=1)

# Correlate
r, p = pearsonr(sc_degree, fc_degree)
reg = linregress(sc_degree, fc_degree)

# Plot
fig, ax = plt.subplots(figsize=(5, 4))
ax.scatter(sc_degree, fc_degree, s=20, color='black', edgecolors='none')
x_line = np.linspace(sc_degree.min(), sc_degree.max(), 200)
ax.plot(x_line, reg.intercept + reg.slope * x_line, color='mediumvioletred', linewidth=2.5)
ax.set_xlabel("Structural degree")
ax.set_ylabel("Functional degree")
ax.spines['top'].set_visible(False)
ax.spines['right'].set_visible(False)
ax.text(0.05, 0.95, f'r = {r:.3f}', transform=ax.transAxes, fontsize=12, va='top')
plt.tight_layout()
plt.savefig("sc_fc_degree_correlation.png", dpi=300)
```

## Dependencies
- **Python** >= 3.7
- **NumPy** — matrix operations, file I/O
- **SciPy** (`scipy.stats`) — `pearsonr` for correlation, `linregress` for linear regression
- **Matplotlib** — scatter plot visualization
- **Data files**: SC matrix (.npy), FC matrix (.npy), excluded regions list (.npy) from the zebrafish brain connectome dataset

## Limitations
- Assumes SC and FC matrices share the same region ordering and dimensionality before exclusion filtering.
- FC degree computation uses only positive functional connectivity values (negative correlations are zeroed), which may discard meaningful anti-correlated activity.
- The analysis uses unweighted Pearson correlation without controlling for spatial autocorrelation or other confounds.
- Self-connections (diagonal) are explicitly zeroed; any meaningful diagonal information is discarded.
- The linear regression assumes a linear structure-function relationship, which may not capture nonlinear dependencies.
- The excluded regions list must be precomputed and provided; this skill does not determine which regions to exclude.
- NaN and Inf values in the FC matrix are replaced with zero, which could bias degree estimates if many entries are missing.

## Source
Derived from a zebrafish whole-brain structure-function coupling analysis pipeline. The approach of correlating SC and FC node degrees is a standard method in network neuroscience for assessing how anatomical wiring constrains or predicts functional co-activation patterns (e.g., as applied in zebrafish brain atlas studies).
