import os
import sys
import json
import numpy as np
import matplotlib.pyplot as plt
from scipy.stats import pearsonr
from scipy.spatial.distance import pdist, squareform

# Add library path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))  # vendored library modules sit beside this script
from zebrafish_Ca_utils import MapzebrainAtlas
from zebrafish_Ca_utils_predictors_xps import Predictors

# Get environment paths
PROCESS_DATA_DIR = os.getenv("PROCESS_DATA_DIR")
SAVE_DIR = os.getenv("SAVE_DIR")
ROOT_DIR = os.getenv("ZEBRAFISH_PATH", "<data-root>")
ATLAS_PATH = os.getenv("ATLAS_PATH", os.path.join(ROOT_DIR, "Atlas"))

# Initialize statistics dictionary
stats = {}

# ============================================================================
# 1. Load data and preprocessing
# ============================================================================
print("Loading connectivity matrices...")

# Load FC matrix
fc_matrix = np.load(os.path.join(PROCESS_DATA_DIR, "Figure1_FC_matrix.npy"))
stats['fc_matrix_shape_original'] = fc_matrix.shape

# Load SC matrices
sc_directed = np.load(os.path.join(ROOT_DIR, "Files", "SC_matrix_directed_terminals_expanded.npy"))
sc_undirected = np.load(os.path.join(ROOT_DIR, "Files", "SC_matrix_undirected_terminals_expanded.npy"))
stats['sc_directed_shape_original'] = sc_directed.shape
stats['sc_undirected_shape_original'] = sc_undirected.shape

# Load excluded regions (indices in original FC matrix space)
excluded_regions = np.load(os.path.join(PROCESS_DATA_DIR, "Figure1_excluded_regions.npy")).astype(int)
stats['excluded_regions'] = excluded_regions.tolist()
stats['n_excluded_regions'] = len(excluded_regions)

print(f"Loaded FC matrix: {fc_matrix.shape}")
print(f"Loaded SC directed: {sc_directed.shape}")
print(f"Loaded SC undirected: {sc_undirected.shape}")
print(f"Excluded regions: {excluded_regions}")

# Load atlas and compute inter-regional distances
print("Loading atlas and computing inter-regional distances...")
atlas = MapzebrainAtlas(ATLAS_PATH)
left_centroids = np.asarray(atlas.regionCentroids["left"], dtype=float)
right_centroids = np.asarray(atlas.regionCentroids["right"], dtype=float)
centroids_full = 0.5 * (left_centroids + right_centroids)
distance_matrix_full = squareform(pdist(centroids_full, metric="euclidean"))
np.fill_diagonal(distance_matrix_full, 0.0)
stats['distance_matrix_shape_original'] = distance_matrix_full.shape

# Check if FC matrix already has excluded regions removed
# If FC matrix size matches SC - excluded regions, then FC is already filtered
# Otherwise, we need to remove excluded regions from all matrices
n_regions_atlas = distance_matrix_full.shape[0]
n_regions_fc = fc_matrix.shape[0]
n_regions_sc = sc_directed.shape[0]

print(f"Atlas regions: {n_regions_atlas}, FC regions: {n_regions_fc}, SC regions: {n_regions_sc}")

# Determine if FC is already filtered
fc_already_filtered = (n_regions_fc < n_regions_atlas)

if fc_already_filtered:
    print("FC matrix appears already filtered. Removing excluded regions from SC and distance matrices...")
    # FC is already filtered, so we need to filter SC and distance to match
    # Create mask for the original atlas space
    keep_mask = np.ones(n_regions_atlas, dtype=bool)
    keep_mask[excluded_regions] = False
    
    # Filter SC matrices and distance matrix
    sc_directed_filtered = sc_directed[keep_mask][:, keep_mask]
    sc_undirected_filtered = sc_undirected[keep_mask][:, keep_mask]
    distance_matrix_filtered = distance_matrix_full[keep_mask][:, keep_mask]
    
    # FC should already match the filtered size
    fc_matrix_filtered = fc_matrix
    
else:
    print("FC matrix has original size. Removing excluded regions from all matrices...")
    # FC has same size as atlas, so filter all matrices
    keep_mask = np.ones(n_regions_fc, dtype=bool)
    # Validate excluded regions indices
    valid_excluded = excluded_regions[excluded_regions < n_regions_fc]
    if len(valid_excluded) < len(excluded_regions):
        print(f"Warning: Some excluded region indices exceed FC matrix size. Using {len(valid_excluded)} valid indices.")
        excluded_regions = valid_excluded
    
    keep_mask[excluded_regions] = False
    
    fc_matrix_filtered = fc_matrix[keep_mask][:, keep_mask]
    sc_directed_filtered = sc_directed[keep_mask][:, keep_mask]
    sc_undirected_filtered = sc_undirected[keep_mask][:, keep_mask]
    distance_matrix_filtered = distance_matrix_full[keep_mask][:, keep_mask]

# Set diagonals to zero
np.fill_diagonal(fc_matrix_filtered, 0.0)
np.fill_diagonal(sc_directed_filtered, 0.0)
np.fill_diagonal(sc_undirected_filtered, 0.0)

stats['fc_matrix_shape_after_exclusion'] = fc_matrix_filtered.shape
stats['sc_directed_shape_after_exclusion'] = sc_directed_filtered.shape
stats['sc_undirected_shape_after_exclusion'] = sc_undirected_filtered.shape
stats['distance_matrix_shape_after_exclusion'] = distance_matrix_filtered.shape

# Validation checks
assert fc_matrix_filtered.shape == sc_directed_filtered.shape, \
    f"FC and directed SC shape mismatch: {fc_matrix_filtered.shape} vs {sc_directed_filtered.shape}"
assert fc_matrix_filtered.shape == sc_undirected_filtered.shape, \
    f"FC and undirected SC shape mismatch: {fc_matrix_filtered.shape} vs {sc_undirected_filtered.shape}"
assert fc_matrix_filtered.shape == distance_matrix_filtered.shape, \
    f"FC and distance matrix shape mismatch: {fc_matrix_filtered.shape} vs {distance_matrix_filtered.shape}"
print(f"All matrices aligned: {fc_matrix_filtered.shape}")

# ============================================================================
# 2. Compute structural predictors from SC
# ============================================================================
print("Computing structural predictors...")

# Instantiate predictor model (excluded=None since we already filtered the matrices)
predictor_model = Predictors(
    A_dir=sc_directed_filtered,
    A_und=sc_undirected_filtered,
    ED=distance_matrix_filtered,
    excluded=None,
    directed=True
)

# Compute structural predictors using directed SC information
predictor_model.compute_predictors(directed=True)

# Get predictor names and matrices
predictor_names = predictor_model.predictors_names
predictor_matrices = predictor_model.predictors_list

stats['n_predictors'] = len(predictor_names)
stats['predictor_names'] = predictor_names

# Save SC predictor names
np.save(os.path.join(PROCESS_DATA_DIR, "Figure2_SC_predictor_names.npy"), 
        np.array(predictor_names, dtype=object))

# Save SC predictor matrices
np.save(os.path.join(PROCESS_DATA_DIR, "Figure2_SC_predictors.npy"), 
        np.array(predictor_matrices, dtype=object))

print(f"Computed {len(predictor_names)} structural predictors")

# ============================================================================
# 3. Correlate each predictor with FC and compute explained variance
# ============================================================================
print("Correlating predictors with FC...")

# Get upper triangle indices (excluding diagonal)
upper_indices = np.triu_indices(fc_matrix_filtered.shape[0], k=1)
fc_upper = fc_matrix_filtered[upper_indices]

predictor_rsquared = []
predictor_correlations = []

for i, (name, pred_matrix) in enumerate(zip(predictor_names, predictor_matrices)):
    pred_upper = pred_matrix[upper_indices]
    
    # Remove NaNs and infinities
    valid_mask = np.isfinite(fc_upper) & np.isfinite(pred_upper)
    
    if valid_mask.sum() > 3:
        r, p = pearsonr(fc_upper[valid_mask], pred_upper[valid_mask])
        r2 = r ** 2
    else:
        r = np.nan
        r2 = np.nan
    
    predictor_correlations.append(r)
    predictor_rsquared.append(r2)

predictor_rsquared = np.array(predictor_rsquared)
predictor_correlations = np.array(predictor_correlations)

stats['predictor_correlations'] = {name: float(r) if np.isfinite(r) else None 
                                   for name, r in zip(predictor_names, predictor_correlations)}
stats['predictor_rsquared'] = {name: float(r2) if np.isfinite(r2) else None 
                               for name, r2 in zip(predictor_names, predictor_rsquared)}

# Save single predictor R² values
np.save(os.path.join(PROCESS_DATA_DIR, "Figure2_SC_predictor_rsquared_single.npy"), 
        predictor_rsquared)

print(f"Single predictor R² range: [{np.nanmin(predictor_rsquared):.4f}, {np.nanmax(predictor_rsquared):.4f}]")

# ============================================================================
# 4. Compute baseline explained variance from SC-FC correlation
# ============================================================================
print("Computing baseline SC-FC correlation...")

# Compute correlation between FC and undirected SC (upper triangle only)
sc_und_upper = sc_undirected_filtered[upper_indices]
valid_mask = np.isfinite(fc_upper) & np.isfinite(sc_und_upper)

assert valid_mask.sum() > 3, "Insufficient valid data points for baseline correlation"

baseline_r, baseline_p = pearsonr(fc_upper[valid_mask], sc_und_upper[valid_mask])
baseline_rsquared = baseline_r ** 2

stats['baseline_correlation'] = float(baseline_r)
stats['baseline_p_value'] = float(baseline_p)
stats['baseline_rsquared'] = float(baseline_rsquared)

# Save baseline R²
np.save(os.path.join(PROCESS_DATA_DIR, "Figure2_SC_predictor_rsquared_baseline.npy"), 
        baseline_rsquared)

print(f"Baseline SC-FC: r={baseline_r:.4f}, R²={baseline_rsquared:.4f}, p={baseline_p:.2e}")

# ============================================================================
# 5. Calculate relative explained variance
# ============================================================================
print("Computing relative explained variance...")

relative_rsquared = predictor_rsquared - baseline_rsquared

stats['relative_rsquared'] = {name: float(delta_r2) if np.isfinite(delta_r2) else None 
                              for name, delta_r2 in zip(predictor_names, relative_rsquared)}
stats['relative_rsquared_mean'] = float(np.nanmean(relative_rsquared))
stats['relative_rsquared_median'] = float(np.nanmedian(relative_rsquared))
stats['relative_rsquared_std'] = float(np.nanstd(relative_rsquared))

# ============================================================================
# 6. Visualization
# ============================================================================
print("Creating visualization...")

fig, ax = plt.subplots(figsize=(12, 5))

# Bar chart
x_positions = np.arange(len(predictor_names))
ax.bar(x_positions, relative_rsquared, width=0.5, color='black')

# Horizontal reference line at zero
ax.axhline(0, color='black', linewidth=0.75, linestyle='-')

# X-axis labels
ax.set_xticks(x_positions)
ax.set_xticklabels(predictor_names, rotation=90, fontsize=7, ha='right')
ax.set_xlim(-0.5, len(predictor_names) - 0.5)

# Y-axis label
ax.set_ylabel("△Exp. var.", fontsize=10)

# Remove top and right spines
ax.spines['top'].set_visible(False)
ax.spines['right'].set_visible(False)

plt.tight_layout()
plt.savefig(os.path.join(SAVE_DIR, "figure.png"), dpi=300, bbox_inches='tight')
plt.close()

print(f"Figure saved to {os.path.join(SAVE_DIR, 'figure.png')}")

# ============================================================================
# 7. Save statistics to JSON
# ============================================================================
with open(os.path.join(SAVE_DIR, "statistics.json"), 'w') as f:
    json.dump(stats, f, indent=2)

print(f"Statistics saved to {os.path.join(SAVE_DIR, 'statistics.json')}")
print("Analysis complete!")
