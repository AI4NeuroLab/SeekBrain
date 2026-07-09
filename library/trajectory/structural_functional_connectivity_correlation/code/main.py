import os
import sys
import json
import numpy as np
import matplotlib.pyplot as plt
from scipy.stats import pearsonr

# Setup paths
sys.path.append("/mnt/shared-storage-gpfs2/ai4neuro-share/neuro_scientist/library/code")

PROCESS_DATA_DIR = os.getenv("PROCESS_DATA_DIR")
SAVE_DIR = os.getenv("SAVE_DIR")

# Ensure save directory exists
os.makedirs(SAVE_DIR, exist_ok=True)

# ===== HELPER: FIND FILE =====
def find_file_recursive(root_dir, candidates):
    """Recursively search for first existing file from candidate list."""
    if not os.path.isdir(root_dir):
        return None
    
    # First try direct paths
    for candidate in candidates:
        test_path = os.path.join(root_dir, candidate)
        if os.path.exists(test_path):
            return test_path
    
    # Then walk through subdirectories
    for dirpath, dirnames, filenames in os.walk(root_dir):
        for candidate in candidates:
            if candidate in filenames:
                return os.path.join(dirpath, candidate)
    
    return None

# ===== LOAD DATA =====
library_data_dir = "/mnt/shared-storage-gpfs2/ai4neuro-share/neuro_scientist/library/data"

sc_candidates = [
    "SC_matrix_undirected_terminals_expanded.npy",
    "undirected_terminals_expanded.npy",
    "SC_undirected.npy",
    "SC.npy",
    "structural_connectivity.npy"
]

sc_path = None
for root in [PROCESS_DATA_DIR, library_data_dir, os.path.join(library_data_dir, "nematoda")]:
    if root and os.path.isdir(root):
        sc_path = find_file_recursive(root, sc_candidates)
        if sc_path:
            break

if not sc_path:
    raise FileNotFoundError("Could not find SC matrix.")

SC_full = np.load(sc_path, allow_pickle=True).astype(float)
print(f"✅ Loaded SC matrix from {sc_path}, shape: {SC_full.shape}")

# Load FC matrix
fc_candidates = [
    "Figure1_FC_matrix.npy",
    "FC_matrix.npy",
    "FC.npy"
]

fc_path = None
for root in [PROCESS_DATA_DIR, library_data_dir]:
    if root and os.path.isdir(root):
        fc_path = find_file_recursive(root, fc_candidates)
        if fc_path:
            break

if not fc_path:
    raise FileNotFoundError("Could not find FC matrix.")

FC = np.load(fc_path, allow_pickle=True).astype(float)
print(f"✅ Loaded FC matrix from {fc_path}, shape: {FC.shape}")

# Load excluded regions
excluded_candidates = [
    "Figure1_excluded_regions.npy",
    "excluded_regions.npy"
]

excluded_path = None
for root in [PROCESS_DATA_DIR, library_data_dir]:
    if root and os.path.isdir(root):
        excluded_path = find_file_recursive(root, excluded_candidates)
        if excluded_path:
            break

if excluded_path and os.path.exists(excluded_path):
    excluded_regions = np.load(excluded_path, allow_pickle=True).astype(int)
    print(f"✅ Loaded excluded regions: {len(excluded_regions)}")
else:
    excluded_regions = np.array([], dtype=int)
    print("⚠️ No excluded regions found")

# ===== ANALYSIS =====
# Remove excluded regions from SC
if len(excluded_regions) > 0:
    mask = np.ones(SC_full.shape[0], dtype=bool)
    valid_excluded = excluded_regions[excluded_regions < SC_full.shape[0]]
    mask[valid_excluded] = False
    SC = SC_full[mask][:, mask]
else:
    SC = SC_full

# Match dimensions if needed
if SC.shape[0] > FC.shape[0]:
    SC = SC[:FC.shape[0], :FC.shape[0]]
elif SC.shape[0] < FC.shape[0]:
    raise ValueError(f"SC shape {SC.shape} smaller than FC shape {FC.shape}")

assert SC.shape == FC.shape, f"Shape mismatch: SC {SC.shape} vs FC {FC.shape}"

# Symmetrize SC if needed
if not np.allclose(SC, SC.T, atol=1e-12):
    SC = 0.5 * (SC + SC.T)

# Zero diagonals
np.fill_diagonal(SC, 0.0)
np.fill_diagonal(FC, 0.0)

# Correlation Analysis
n = SC.shape[0]
upper_indices = np.triu_indices(n, k=1)
sc_upper = SC[upper_indices]
fc_upper = FC[upper_indices]

valid_mask = np.isfinite(sc_upper) & np.isfinite(fc_upper)
pearson_r, pearson_p = pearsonr(sc_upper[valid_mask], fc_upper[valid_mask])
print(f"✅ Pearson correlation: r={pearson_r:.4f}")

# ===== VISUALIZATION =====
# Normalize by L2 norm
sc_norm_factor = np.linalg.norm(SC)
fc_norm_factor = np.linalg.norm(FC)

# Avoid division by zero
if sc_norm_factor == 0: sc_norm_factor = 1.0
if fc_norm_factor == 0: fc_norm_factor = 1.0

SC_normalized = SC / sc_norm_factor
FC_normalized = FC / fc_norm_factor

# Composite matrix: Lower=SC, Upper=FC
composite = np.copy(SC_normalized)
composite[upper_indices] = FC_normalized[upper_indices]

# Plot
fig, ax = plt.subplots(figsize=(6, 5.5), dpi=600)

# Use Blues_r (reversed) so 0=Blue, High=White.
im = ax.imshow(composite, cmap='Blues_r', aspect='equal', interpolation='nearest')

# Colorbar
cbar = plt.colorbar(im, ax=ax, fraction=0.046, pad=0.04)
cbar.set_label("Normalized weight", rotation=270, labelpad=15)
cbar.set_ticks([])

# Diagonal line
ax.plot([0, n-1], [0, n-1], color='white', linewidth=2)

# Axis labels
ax.set_xticks([])
ax.set_yticks([0, n-1])
ax.set_yticklabels(['1', str(n)], fontsize=10)
ax.set_ylabel("Brain regions", fontsize=12)

# Annotations - Placed OUTSIDE the matrix to avoid overlap and improve visibility
# "Functional connectivity" aligned to right, above the top axis
ax.text(1.0, 1.01, "Functional connectivity", transform=ax.transAxes, 
        fontsize=10, ha='right', va='bottom', color='black')

# "Structural connectivity" aligned to left, below the bottom axis
ax.text(0.0, -0.01, "Structural connectivity", transform=ax.transAxes, 
        fontsize=10, ha='left', va='top', color='black')

# Save
figure_path = os.path.join(SAVE_DIR, "figure_refine.png")
plt.savefig(figure_path, dpi=600, bbox_inches='tight')
plt.close()
print(f"✅ Figure saved to {figure_path}")

# Stats
statistics = {
    "pearson_r": float(pearson_r),
    "pearson_p": float(pearson_p),
    "sc_l2_norm": float(sc_norm_factor),
    "fc_l2_norm": float(fc_norm_factor)
}
with open(os.path.join(SAVE_DIR, "statistics.json"), "w") as f:
    json.dump(statistics, f, indent=2)
