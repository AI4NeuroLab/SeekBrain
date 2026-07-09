# FC Eigenvalue Scree Plot

## Description
This skill generates a scree plot of functional connectivity (FC) eigenvalues to visualize how the relative importance of FC gradients decays across components. The plot reveals the characteristic L-shaped curve where the first few gradients capture the majority of variance, enabling researchers to determine how many FC gradients to retain for analyses such as comparing structural connectivity (SC) and functional connectivity (FC) gradient similarity. Additionally, the skill computes comprehensive statistics on eigenvalue decay, cumulative variance explained, and the number of gradients needed to reach specific variance thresholds (50%, 80%, 90%).

## Tags
- functional connectivity
- eigenvalues
- scree plot
- gradient analysis
- dimensionality reduction
- connectome gradients
- variance explained
- neuroscience visualization

## Input
- **FC Eigenvalues File**: A `.npy` file containing a 1D numpy array of FC eigenvalues sorted in descending order (e.g., `Figure6_FC_eigenvalues.npy`). Must contain at least 50 eigenvalues.
- **Environment Variables**:
  - `PROCESS_DATA_DIR`: Directory containing the input `.npy` file.
  - `SAVE_DIR`: Directory where the output figure and statistics JSON will be saved.

## Output
- **Figure** (`figure_refine.png`): A 5×5 inch scree plot showing eigenvalue magnitude vs. gradient index (1 to N), saved at 300 DPI.
- **Statistics** (`statistics.json`): A JSON file containing:
  - Total number of eigenvalues
  - Descriptive statistics of the first 50 eigenvalues (mean, std, median, min, max, percentiles)
  - First and 50th eigenvalue values
  - Decay ratio (eigenvalue 50 / eigenvalue 1)
  - Total variance from first 50 eigenvalues
  - Cumulative variance explained at gradients 10, 20, 30, 50
  - Number of gradients needed for 50%, 80%, 90% cumulative variance

## Algorithm / Processing Steps
1. **Load Data**: Read the FC eigenvalues from the `.npy` file and flatten to 1D if necessary.
2. **Validate**: Assert that the array contains at least 50 eigenvalues.
3. **Create Index Array**: Generate gradient indices from 1 to N (number of eigenvalues).
4. **Plot Scree Plot**:
   - Create a 5×5 figure.
   - Plot eigenvalues as a black line with dot markers (linewidth=1, markersize=1).
   - Set X-axis limits to [-1, 51] with ticks at [1, 50], labeled "Gradient #".
   - Set Y-axis lower limit to -0.05, labeled "Eigenvalue".
   - Remove top and right spines for a clean appearance.
   - Apply tight layout and save at 300 DPI.
5. **Compute Statistics**:
   - Extract the first 50 eigenvalues.
   - Calculate decay ratio (last/first eigenvalue).
   - Compute cumulative sum and cumulative variance explained ratios.
   - Determine how many gradients are needed to reach 50%, 80%, and 90% of total variance.
   - Compile all statistics into a dictionary and save as JSON.

## Key Parameters
| Parameter | Value | Description |
|-----------|-------|-------------|
| Figure size | (5, 5) | Width and height in inches |
| Line color | black | Color of the scree plot line |
| Line width | 1 | Width of the plot line |
| Marker size | 1 | Size of data point markers |
| X-axis limits | [-1, 51] | Display range for gradient index |
| X-axis ticks | [1, 50] | Explicit tick positions |
| Y-axis start | -0.05 | Lower bound of Y-axis |
| DPI | 300 | Resolution of saved figure |
| Variance thresholds | 50%, 80%, 90% | Thresholds for gradient count estimation |

## Usage Example
```python
import os
os.environ["PROCESS_DATA_DIR"] = "/path/to/processed/data"
os.environ["SAVE_DIR"] = "/path/to/output"

# Ensure Figure6_FC_eigenvalues.npy exists in PROCESS_DATA_DIR
# Then run the script to generate:
#   - figure_refine.png (scree plot)
#   - statistics.json (eigenvalue decay statistics)
```

## Dependencies
- `numpy` — for loading `.npy` files and numerical computations
- `matplotlib` — for creating the scree plot (`pyplot`, `ticker.FormatStrFormatter`, `ticker.AutoMinorLocator`)
- `json` — for saving statistics output
- `os`, `sys` — for path management and environment variable access

## Limitations
- Assumes eigenvalues are pre-sorted in descending order; does not re-sort them.
- Requires at least 50 eigenvalues in the input array; will raise an error otherwise.
- The X-axis display is hardcoded to show only the first 50 gradients (xlim [-1, 51]), even if more eigenvalues exist.
- Variance threshold computation uses only the first 50 eigenvalues as the total, not all eigenvalues.
- The input file name (`Figure6_FC_eigenvalues.npy`) is hardcoded.
- Does not perform eigenvalue decomposition itself; requires precomputed eigenvalues.

## Source
Derived from a neuroscience pipeline for characterizing similarities between structural connectivity (SC) and functional connectivity (FC) gradients, specifically for identifying dominant FC gradients whose eigenvalues exhibit rapid decay (scree plot analysis).