# Functional Connectivity Fingerprinting: Intra- vs Inter-Individual Similarity

## Description
This skill assesses whether individual zebrafish larvae can be uniquely identified ("fingerprinted") by their functional connectivity (FC) patterns across two separate imaging sessions conducted 24 hours apart. It computes pairwise FC similarity between all larvae across the two time points, constructs a symmetric similarity matrix, and compares intra-individual similarity (same larva, different days) against inter-individual similarity (different larvae, different days). A Mann-Whitney U test is used to determine statistical significance, and results are visualized with boxplots overlaid on jittered scatter plots.

## Tags
- functional connectivity
- fingerprinting
- zebrafish larvae
- Pearson correlation
- similarity matrix
- intra-individual
- inter-individual
- Mann-Whitney U test
- boxplot
- neuroscience
- calcium imaging
- longitudinal analysis

## Input
- **FC_matrices_fingerprinting_6dpf.npy**: 3D NumPy array of shape `(n_larvae, n_regions, n_regions)` containing functional connectivity matrices for all larvae at the first time point (6 days post-fertilization).
- **FC_matrices_fingerprinting_7dpf.npy**: 3D NumPy array of shape `(n_larvae, n_regions, n_regions)` containing functional connectivity matrices for the same larvae at the second time point (7 days post-fertilization).
- Both arrays must have the same shape (same number of larvae and same brain region parcellation).

## Output
- **Figure1_FC_fingerprinting.npy**: Symmetric FC similarity matrix of shape `(n_larvae, n_larvae)`, where entry (i, j) is the average Pearson correlation between larva i at day 1 vs larva j at day 2 and larva j at day 1 vs larva i at day 2.
- **Figure1_FC_fingerprinting_SameLarva.npy**: 1D array of diagonal values from the symmetric similarity matrix (intra-individual similarity scores).
- **Figure1_FC_fingerprinting_DiffLarva.npy**: 1D array of upper-triangular values (excluding diagonal) from the symmetric similarity matrix (inter-individual similarity scores).
- **figure_refine.png**: Visualization showing boxplots with jittered scatter points comparing intra- vs inter-individual FC similarity, annotated with Mann-Whitney U test p-value.
- **statistics.json**: JSON file containing summary statistics (n, mean, std) for both groups and the Mann-Whitney U test result.

## Algorithm / Processing Steps
1. **Load FC matrices**: Load the two 3D FC matrices (one per time point) from `.npy` files.
2. **Vectorize upper triangles**: For each larva at each time point, extract the upper triangle of its FC matrix (excluding the diagonal) into a 1D vector. This converts each symmetric connectivity matrix into a feature vector.
3. **Compute cross-day similarity matrix**: For every pair of larvae (i, j), compute the Pearson correlation between larva i's FC vector at day 1 and larva j's FC vector at day 2. NaN values are excluded from correlation computation. This produces an asymmetric `(n_larvae, n_larvae)` matrix.
4. **Symmetrize the similarity matrix**: Average the matrix with its transpose: `symmetric = (M + M^T) / 2`. This accounts for both temporal directions.
5. **Extract intra-individual similarity**: Take the diagonal of the symmetric matrix. These values represent how similar each larva's FC is to itself across the two days.
6. **Extract inter-individual similarity**: Take the upper-triangular values (excluding diagonal) of the symmetric matrix. These represent FC similarity between different larvae.
7. **Statistical testing**: Perform a two-sided Mann-Whitney U test comparing intra- and inter-individual similarity distributions.
8. **Visualization**: Create a figure with boxplots (unfilled, whiskers from min to max) overlaid with jittered scatter points for both groups. Annotate with p-value and test name.

## Key Parameters
- **Correlation metric**: Pearson correlation coefficient between vectorized upper-triangle FC values.
- **Symmetrization**: Averaging forward and reverse temporal direction correlations.
- **Statistical test**: Two-sided Mann-Whitney U test (non-parametric).
- **Boxplot whiskers**: `whis=[0, 100]` — whiskers extend from minimum to maximum data points (no outlier markers).
- **Scatter jitter**: Normal distribution with std=0.02 centered on group x-position.
- **Y-axis range**: 0.6 to 0.85 with 0.05 tick spacing.
- **Figure size**: (3, 5) inches.
- **Group positions**: x=0.5 (intra-individual), x=1.0 (inter-individual).
- **Minimum valid observations for correlation**: 3 non-NaN paired values.

## Usage Example
```python
import numpy as np

# Paths to FC matrices for two time points
fc_6dpf_path = "path/to/FC_matrices_fingerprinting_6dpf.npy"
fc_7dpf_path = "path/to/FC_matrices_fingerprinting_7dpf.npy"

# Load data
fc_6dpf = np.load(fc_6dpf_path)  # (n_larvae, n_regions, n_regions)
fc_7dpf = np.load(fc_7dpf_path)  # (n_larvae, n_regions, n_regions)

# Vectorize upper triangles
def vectorize_upper_triangle(matrix):
    return matrix[np.triu_indices(matrix.shape[0], k=1)]

n_larvae = fc_6dpf.shape[0]
fc_6_vecs = np.array([vectorize_upper_triangle(fc_6dpf[i]) for i in range(n_larvae)])
fc_7_vecs = np.array([vectorize_upper_triangle(fc_7dpf[i]) for i in range(n_larvae)])

# Compute similarity matrix
sim_matrix = np.zeros((n_larvae, n_larvae))
for i in range(n_larvae):
    for j in range(n_larvae):
        valid = np.isfinite(fc_6_vecs[i]) & np.isfinite(fc_7_vecs[j])
        sim_matrix[i, j] = np.corrcoef(fc_6_vecs[i][valid], fc_7_vecs[j][valid])[0, 1]

# Symmetrize and extract groups
sym_sim = (sim_matrix + sim_matrix.T) / 2
intra = np.diag(sym_sim)
inter = sym_sim[np.triu_indices(n_larvae, k=1)]
```

## Dependencies
- **numpy**: Array operations, linear algebra, file I/O (.npy)
- **scipy.stats**: `mannwhitneyu` for non-parametric statistical testing
- **matplotlib**: Figure creation, boxplots, scatter plots
- **json**: Saving statistics output
- **os**: File path management

## Limitations
- Assumes the same larvae are present in both time point files and are ordered identically (i.e., index i in both arrays corresponds to the same individual).
- Pearson correlation may not capture non-linear relationships between FC patterns.
- The symmetrization assumes both temporal directions are equally informative.
- NaN handling relies on pairwise deletion, which may lead to slightly different effective sample sizes for different pairs.
- The Mann-Whitney U test does not account for the non-independence of inter-individual similarity values (each larva contributes to multiple pairs).
- Visualization parameters (y-axis range, colors) are hardcoded and may need adjustment for different datasets.
- No multiple comparison correction is applied.

## Source
Derived from a zebrafish larval brain functional connectivity fingerprinting analysis pipeline evaluating individual identifiability across 24-hour intervals using whole-brain calcium imaging data.
