# Structural Directionality vs Functional Connectivity Analysis

## Description
This skill investigates the relationship between structural connectivity (SC) directionality and functional connectivity (FC) strength in zebrafish whole-brain networks. It categorizes all region pairs into three structural groups—unconnected, unidirectional, and bidirectional—based on a directed SC matrix, then compares the distributions of FC values across these categories using statistical testing and visualization. The analysis demonstrates that bidirectional structural connections are associated with significantly stronger functional connectivity.

## Tags
- zebrafish
- structural connectivity
- functional connectivity
- directionality analysis
- connectivity matrix
- ANOVA
- density distribution
- brain network
- calcium imaging
- connectomics

## Input
- **Directed SC matrix**: `SC_matrix_directed_terminals_expanded.npy` — A square NumPy array (N×N) representing directed structural connectivity weights between brain regions.
- **Excluded regions**: `Figure1_excluded_regions.npy` — A 1D NumPy array of integer indices for regions to be removed from analysis.
- **FC matrices**: `Figure1_FC_matrices.npy` — A 3D NumPy array (n_fish × N × N) of functional connectivity matrices from multiple subjects.
- **Zebrafish atlas information**: Regional metadata from the atlas folder (used for region indexing).

## Output
- **Connection category matrix**: `Figure2_number_of_connections.npy` — Square matrix with values 0 (unconnected), 1 (unidirectional), 2 (bidirectional).
- **FC values per category**:
  - `Figure2_Directionality_Corr_Bidirection.npy` — FC values for bidirectionally connected pairs.
  - `Figure2_Directionality_Corr_Unidirection.npy` — FC values for unidirectionally connected pairs.
  - `Figure2_Directionality_Corr_Unconnect.npy` — FC values for unconnected pairs.
- **Figure** (`figure_refine.png`): Two-panel visualization with structural matrix (top) and FC density distributions (bottom).
- **Statistics** (`statistics.json`): Sample sizes, means, standard deviations, and ANOVA results (F-statistic, p-value, significance marker).

## Algorithm / Processing Steps

### 1. Data Loading and Preprocessing
1. Load the directed SC matrix from file.
2. Load the list of excluded region indices.
3. Create a boolean mask to remove excluded regions from both rows and columns of the SC matrix.
4. Load FC matrices and apply the same exclusion mask if dimensions indicate the FC matrices have not yet been filtered.

### 2. Structural Connection Categorization
1. Binarize the directed SC matrix: values > 0 become 1, others become 0.
2. Compute the connection category matrix: `category = SC_binary + SC_binary.T`.
   - 0 = no structural connection in either direction (unconnected).
   - 1 = structural connection in only one direction (unidirectional).
   - 2 = structural connections in both directions (bidirectional).
3. Save the connection category matrix.

### 3. FC Value Extraction by Category
1. Define upper triangle indices (excluding diagonal) to avoid double-counting symmetric pairs.
2. For each subject's FC matrix, extract upper-triangle FC values.
3. Group FC values by their corresponding structural category (0, 1, or 2).
4. Accumulate across all subjects.
5. Remove zero and NaN values from each group.
6. Save the three FC value arrays separately.

### 4. Statistical Testing
1. Perform a one-way ANOVA (scipy.stats.f_oneway) across the three FC value groups.
2. Report F-statistic and p-value.
3. Assign significance markers: * (p<0.05), ** (p<0.01), *** (p<0.001), **** (p<0.0001).

### 5. Visualization
1. **Top Panel (Structural Matrix)**: Display the lower triangle of the connection category matrix using `imshow` with `cmap='gray'` (0=black, 1=gray, 2=white). Upper triangle is masked with NaN. A legend in the upper-right area labels the three categories.
2. **Bottom Panel (FC Density Curves)**: Compute smoothed density estimates by histogramming FC values (200 bins, density-normalized), interpolating onto a 512-point grid, and applying Gaussian smoothing (sigma=20). Plot three curves colored black (unconnected), gray (unidirectional), and white with black outline (bidirectional). Add significance bars with asterisks between curve peaks.

## Key Parameters
| Parameter | Value | Description |
|-----------|-------|-------------|
| Binarization threshold | > 0 | Threshold for converting SC weights to binary |
| Histogram bins | 200 | Number of bins for density estimation |
| Interpolation grid size | 512 | Number of points for smooth density curve |
| Gaussian sigma | 20 | Smoothing parameter for Gaussian filter on histogram |
| Triangle selection | k=1 | Upper triangle excluding diagonal for pair extraction |
| ANOVA significance levels | 0.05, 0.01, 0.001, 0.0001 | Thresholds for *, **, ***, **** |

## Usage Example
```python
import os
import numpy as np
from scipy.stats import f_oneway
from scipy.ndimage import gaussian_filter1d

# Load directed SC matrix and remove excluded regions
SC_directed = np.load('SC_matrix_directed_terminals_expanded.npy').astype(float)
excluded = np.load('Figure1_excluded_regions.npy').astype(int)
mask = np.ones(SC_directed.shape[0], dtype=bool)
mask[excluded] = False
SC_directed = SC_directed[mask][:, mask]

# Categorize connections
SC_binary = (SC_directed > 0).astype(int)
connection_category = SC_binary + SC_binary.T

# Load FC and extract values per category
FC_matrices = np.load('Figure1_FC_matrices.npy').astype(float)
FC_matrices = FC_matrices[:, mask][:, :, mask]
upper_idx = np.triu_indices(SC_directed.shape[0], k=1)

fc_bi, fc_uni, fc_un = [], [], []
for fc in FC_matrices:
    cat = connection_category[upper_idx]
    vals = fc[upper_idx]
    fc_bi.extend(vals[cat == 2])
    fc_uni.extend(vals[cat == 1])
    fc_un.extend(vals[cat == 0])

# ANOVA
F, p = f_oneway(fc_un, fc_uni, fc_bi)
print(f"F={F:.4f}, P={p:.4e}")
```

## Dependencies
- `numpy` — Array operations, file I/O
- `scipy.stats` — One-way ANOVA (f_oneway)
- `scipy.ndimage` — Gaussian smoothing (gaussian_filter1d)
- `matplotlib` — Visualization (pyplot, patheffects)
- `json` — Statistics output
- Custom: `zebrafish_Ca_utils` (optional, for atlas utilities)

## Limitations
- The binarization threshold (>0) does not account for SC weight magnitude; weak and strong connections are treated equally.
- The smoothed histogram approach (Gaussian filter on interpolated histogram) is an approximation of kernel density estimation and may produce artifacts at distribution tails.
- Zero-value FC pairs are removed, which could bias the density distributions if zeros carry biological meaning.
- The ANOVA assumes independence of observations, but FC values from the same subject are correlated.
- The significance bars only compare overall group differences (omnibus ANOVA) without post-hoc pairwise tests between specific category pairs.
- The analysis is specific to the zebrafish atlas region indexing scheme and file naming conventions.

## Source
Derived from a zebrafish whole-brain calcium imaging and structural connectomics analysis pipeline investigating the relationship between structural connectivity directionality and functional connectivity strength.