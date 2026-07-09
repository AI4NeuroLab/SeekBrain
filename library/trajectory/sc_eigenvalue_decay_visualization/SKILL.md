# Structural Connectivity Eigenvalue Decay Visualization

## Description
This skill creates a scree plot of structural connectivity (SC) eigenvalues to visualize how quickly the relative importance of SC gradients decays. The eigenvalue spectrum reveals the dimensionality of structural connectivity data: a sharp initial decline (elbow) followed by a flattening tail indicates that only the first few gradients capture most of the variance. This visualization is commonly used as a precursor to comparing SC and FC (functional connectivity) gradient structures.

## Tags
- structural connectivity
- eigenvalue spectrum
- scree plot
- gradient analysis
- connectomics
- dimensionality reduction
- diffusion map embedding
- brain connectivity
- neuroscience visualization

## Input
- **SC eigenvalues file**: A NumPy `.npy` file containing a 1D array of eigenvalues from the structural connectivity gradient decomposition (e.g., `Figure6_SC_eigenvalues.npy`). The array may be complex-valued (real parts are extracted) and may need squeezing from higher-dimensional shapes.
- **Environment variables**:
  - `PROCESS_DATA_DIR`: Directory containing the input `.npy` file.
  - `SAVE_DIR`: Directory for saving output figure and statistics.

## Output
- **Figure** (`figure_refine.png`): A 5×5 inch scree plot showing eigenvalue decay across gradient indices, saved at 300 DPI.
- **Statistics** (`statistics.json`): JSON file containing summary statistics:
  - `n_eigenvalues`: Total number of eigenvalues
  - `first_eigenvalue`: Value of the largest eigenvalue
  - `mean_eigenvalue`: Mean across all eigenvalues
  - `median_eigenvalue`: Median eigenvalue
  - `min_eigenvalue`: Minimum eigenvalue
  - `max_eigenvalue`: Maximum eigenvalue

## Algorithm / Processing Steps
1. **Load data**: Read the eigenvalue array from the `.npy` file using `np.load` with `allow_pickle=True`.
2. **Preprocess**: Extract real parts (in case of complex values), squeeze to 1D, and cast to float.
3. **Validate**: Confirm the resulting array is 1-dimensional.
4. **Create gradient indices**: Generate 1-based indices (1 to N) for the X-axis.
5. **Compute statistics**: Calculate summary statistics (count, first value, mean, median, min, max).
6. **Plot**: Create a line plot with:
   - Black line, linewidth=1, dot markers with markersize=1.
   - X-axis limits [-1, 51], ticks at [1, 50], labeled "Gradient #".
   - Y-axis starting at -0.05, upper limit at 1.05× max eigenvalue, labeled "Eigenvalue".
   - Top and right spines removed.
7. **Save**: Export the figure as PNG (300 DPI) and statistics as JSON.

## Key Parameters
| Parameter | Value | Description |
|-----------|-------|-------------|
| Figure size | (5, 5) | Square figure dimensions in inches |
| Line color | black | Color of the eigenvalue decay line |
| Line width | 1 | Width of the plotted line |
| Marker style | `.` (dot) | Small dot markers at each data point |
| Marker size | 1 | Size of the dot markers |
| X-axis limits | [-1, 51] | Padding around gradient index range |
| X-axis ticks | [1, 50] | Show only first and last gradient numbers |
| Y-axis bottom | -0.05 | Small negative offset for visual clarity |
| Y-axis top margin | 5% above max | Automatically scaled upper limit |
| DPI | 300 | Output figure resolution |

## Usage Example
```python
import os
os.environ["PROCESS_DATA_DIR"] = "/path/to/processed/data"
os.environ["SAVE_DIR"] = "/path/to/output"

# Then run the skill script, which will:
# 1. Load Figure6_SC_eigenvalues.npy
# 2. Generate the scree plot
# 3. Save figure_refine.png and statistics.json to SAVE_DIR
```

## Dependencies
- **Python**: >= 3.7
- **numpy**: For loading `.npy` files and numerical operations
- **matplotlib**: For creating the scree plot visualization
- **json**: For saving summary statistics (standard library)
- **os**: For path handling (standard library)

## Limitations
- Assumes eigenvalues are stored in a single `.npy` file and can be squeezed to a 1D array.
- The X-axis limits and ticks are hardcoded for up to ~50 gradients; datasets with significantly more or fewer eigenvalues may require adjustment.
- Does not perform automatic elbow detection to programmatically determine the optimal number of gradients.
- Complex eigenvalues are reduced to their real parts, which may lose information in certain decomposition methods.
- The Y-axis upper bound scaling (1.05× max) assumes non-negative eigenvalues; negative eigenvalues may cause display issues.

## Source
Derived from a connectomics analysis pipeline for characterizing the similarity between structural connectivity (SC) and functional connectivity (FC) gradients, specifically the eigenvalue decay visualization step (Figure 6 in the associated study).