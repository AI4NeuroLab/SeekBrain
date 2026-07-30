import os
import sys
import json
import numpy as np
import matplotlib.pyplot as plt
from matplotlib.colors import LinearSegmentedColormap
from scipy.stats import pearsonr

# Add shared toolkit to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))  # vendored library modules sit beside this script
from zebrafish_Ca_utils import MapzebrainAtlas
from brainspace.gradient.embedding import diffusion_mapping

# Get environment paths
PROCESS_DATA_DIR = os.getenv("PROCESS_DATA_DIR")
SAVE_DIR = os.getenv("SAVE_DIR")
ATLAS_PATH = os.getenv("ATLAS_PATH")
ZEBRAFISH_PATH = os.getenv("ZEBRAFISH_PATH", "<data-root>")

# Ensure save directory exists
os.makedirs(SAVE_DIR, exist_ok=True)

# ===== 1. Load Data =====
# Load FC matrix (65x65, already excluded)
fc_matrix = np.load(os.path.join(PROCESS_DATA_DIR, "Figure1_FC_matrix.npy"))
print(f"Loaded FC matrix: {fc_matrix.shape}")

# Clean FC matrix: replace inf/nan with 0
fc_matrix = np.nan_to_num(fc_matrix, nan=0.0, posinf=0.0, neginf=0.0)
# Ensure diagonal is zero for diffusion mapping
np.fill_diagonal(fc_matrix, 0.0)

# Load SC matrix from the correct path in Files directory
sc_path = os.path.join(ZEBRAFISH_PATH, "Files", "SC_matrix_undirected_terminals_expanded.npy")
if not os.path.exists(sc_path):
    raise FileNotFoundError(f"SC matrix not found at {sc_path}")
sc_matrix = np.load(sc_path)
print(f"Loaded SC matrix: {sc_matrix.shape}")

# Clean SC matrix
sc_matrix = np.nan_to_num(sc_matrix, nan=0.0, posinf=0.0, neginf=0.0)
np.fill_diagonal(sc_matrix, 0.0)

# Load excluded regions
excluded_regions = np.load(os.path.join(PROCESS_DATA_DIR, "Figure1_excluded_regions.npy")).astype(int)
print(f"Excluded regions: {excluded_regions}")

# ===== 2. Calculate Structural Gradients =====
print("Computing SC gradients...")
# Use n_components less than matrix size to avoid k >= N issue
n_components_sc = min(69, sc_matrix.shape[0] - 1)
modes_SC, eigvals_SC = diffusion_mapping(sc_matrix, n_components=n_components_sc, alpha=0.5)
# Remove excluded regions from rows
modes_SC_filtered = np.delete(modes_SC, excluded_regions, axis=0)
# Transpose to get gradients as rows
modes_SC_filtered = modes_SC_filtered.T
print(f"SC gradients shape after filtering: {modes_SC_filtered.shape}")

# Save SC gradients and eigenvalues
np.save(os.path.join(PROCESS_DATA_DIR, "Figure6_SC_gradients.npy"), modes_SC_filtered)
np.save(os.path.join(PROCESS_DATA_DIR, "Figure6_SC_eigenvalues.npy"), eigvals_SC)

# ===== 3. Calculate Functional Gradients =====
print("Computing FC gradients...")
# Use n_components less than matrix size
n_components_fc = min(64, fc_matrix.shape[0] - 1)
modes_FC, eigvals_FC = diffusion_mapping(fc_matrix, n_components=n_components_fc, alpha=0.5)
# Transpose to get gradients as rows
modes_FC = modes_FC.T
print(f"FC gradients shape: {modes_FC.shape}")

# Save FC gradients and eigenvalues
np.save(os.path.join(PROCESS_DATA_DIR, "Figure6_FC_gradients.npy"), modes_FC)
np.save(os.path.join(PROCESS_DATA_DIR, "Figure6_FC_eigenvalues.npy"), eigvals_FC)

# ===== 4. Compute Correlations =====
# Ensure matching dimensions for correlation
min_len = min(modes_SC_filtered.shape[1], modes_FC.shape[1])
corr_grad1, _ = pearsonr(modes_SC_filtered[0, :min_len], modes_FC[0, :min_len])
corr_grad2, _ = pearsonr(modes_SC_filtered[1, :min_len], modes_FC[1, :min_len])
print(f"Correlation Gradient 1: {corr_grad1:.3f}")
print(f"Correlation Gradient 2: {corr_grad2:.3f}")

# ===== 5. Load Atlas Data =====
atlas = MapzebrainAtlas(ATLAS_PATH)

# Get left and right centroids
centroids_left = atlas.centroids['left']
centroids_right = atlas.centroids['right']

# Concatenate to create bilateral centroids
centroids_bilateral = np.concatenate([centroids_left, centroids_right], axis=0)

# Adjust y-coordinate to match image orientation
centroids_bilateral[:, 1] = 974 - centroids_bilateral[:, 1]

# Remove excluded regions (bilateral: excluded indices and excluded+70)
excluded_bilateral = np.concatenate([excluded_regions, excluded_regions + 70])
centroids_filtered = np.delete(centroids_bilateral, excluded_bilateral, axis=0)
print(f"Filtered centroids shape: {centroids_filtered.shape}")

# Prepare side view coordinates (invert z)
centroids_side = centroids_filtered[:, [2, 1]].copy()
centroids_side[:, 0] = 359 - centroids_side[:, 0]

# ===== 6. Prepare Gradient Values for Bilateral Plotting =====
# Double gradient values for bilateral visualization
def double_vector(vec):
    return np.concatenate([vec, vec])

sc_grad1_bilateral = double_vector(modes_SC_filtered[0])
sc_grad2_bilateral = double_vector(modes_SC_filtered[1])
fc_grad1_bilateral = double_vector(modes_FC[0])
fc_grad2_bilateral = double_vector(modes_FC[1])

# ===== 7. Create Custom Colormap =====
def create_blue_white_cmap():
    color = [72/255, 184/255, 208/255]
    return LinearSegmentedColormap.from_list("blue_white", [[1, 1, 1], color])

cmap_blue_white = create_blue_white_cmap()

# ===== 8. Create Figure =====
fig = plt.figure(figsize=(18, 8))

# Row 1: SC (Matrix, Grad1 Top/Side, Grad2 Top/Side)
# Row 2: FC (Matrix, Grad1 Top/Side, Grad2 Top/Side)

# SC Matrix (unilateral)
ax_sc_mat = plt.subplot2grid((2, 10), (0, 0), colspan=2, rowspan=1)
ax_sc_mat.imshow(sc_matrix, cmap=cmap_blue_white, vmin=0.1, vmax=0.9, aspect='auto')
ax_sc_mat.set_xticks([])
ax_sc_mat.set_yticks([])
ax_sc_mat.set_title("SC Matrix", fontsize=10)

# SC Gradient 1 Top
ax_sc_g1_top = plt.subplot2grid((2, 10), (0, 2), colspan=2, rowspan=1)
ax_sc_g1_top.imshow(atlas.XYprojection, cmap='binary', aspect='auto')
v1_sc = np.percentile(np.abs(sc_grad1_bilateral), 90)
ax_sc_g1_top.scatter(centroids_filtered[:, 0], centroids_filtered[:, 1], 
                      c=sc_grad1_bilateral, cmap='coolwarm', s=35, 
                      vmin=-v1_sc, vmax=v1_sc, edgecolor='black', linewidth=0.5)
ax_sc_g1_top.set_xticks([])
ax_sc_g1_top.set_yticks([])
ax_sc_g1_top.set_title("SC Grad 1 (Top)", fontsize=10)

# SC Gradient 1 Side
ax_sc_g1_side = plt.subplot2grid((2, 10), (0, 4), colspan=1, rowspan=1)
ax_sc_g1_side.imshow(np.rot90(atlas.XZprojection, k=3), cmap='binary', aspect='auto')
ax_sc_g1_side.scatter(centroids_side[:, 0], centroids_side[:, 1], 
                       c=sc_grad1_bilateral, cmap='coolwarm', s=35, 
                       vmin=-v1_sc, vmax=v1_sc, edgecolor='black', linewidth=0.5)
ax_sc_g1_side.set_xticks([])
ax_sc_g1_side.set_yticks([])
ax_sc_g1_side.set_title("SC Grad 1 (Side)", fontsize=10)

# SC Gradient 2 Top
ax_sc_g2_top = plt.subplot2grid((2, 10), (0, 5), colspan=2, rowspan=1)
ax_sc_g2_top.imshow(atlas.XYprojection, cmap='binary', aspect='auto')
v2_sc = np.percentile(np.abs(sc_grad2_bilateral), 90)
ax_sc_g2_top.scatter(centroids_filtered[:, 0], centroids_filtered[:, 1], 
                      c=sc_grad2_bilateral, cmap='coolwarm', s=35, 
                      vmin=-v2_sc, vmax=v2_sc, edgecolor='black', linewidth=0.5)
ax_sc_g2_top.set_xticks([])
ax_sc_g2_top.set_yticks([])
ax_sc_g2_top.set_title("SC Grad 2 (Top)", fontsize=10)

# SC Gradient 2 Side
ax_sc_g2_side = plt.subplot2grid((2, 10), (0, 7), colspan=1, rowspan=1)
ax_sc_g2_side.imshow(np.rot90(atlas.XZprojection, k=3), cmap='binary', aspect='auto')
ax_sc_g2_side.scatter(centroids_side[:, 0], centroids_side[:, 1], 
                       c=sc_grad2_bilateral, cmap='coolwarm', s=35, 
                       vmin=-v2_sc, vmax=v2_sc, edgecolor='black', linewidth=0.5)
ax_sc_g2_side.set_xticks([])
ax_sc_g2_side.set_yticks([])
ax_sc_g2_side.set_title("SC Grad 2 (Side)", fontsize=10)

# FC Matrix
ax_fc_mat = plt.subplot2grid((2, 10), (1, 0), colspan=2, rowspan=1)
ax_fc_mat.imshow(fc_matrix, cmap=cmap_blue_white, vmin=0.1, vmax=0.9, aspect='auto')
ax_fc_mat.set_xticks([])
ax_fc_mat.set_yticks([])
ax_fc_mat.set_title("FC Matrix", fontsize=10)

# FC Gradient 1 Top
ax_fc_g1_top = plt.subplot2grid((2, 10), (1, 2), colspan=2, rowspan=1)
ax_fc_g1_top.imshow(atlas.XYprojection, cmap='binary', aspect='auto')
v1_fc = np.percentile(np.abs(fc_grad1_bilateral), 90)
ax_fc_g1_top.scatter(centroids_filtered[:, 0], centroids_filtered[:, 1], 
                      c=fc_grad1_bilateral, cmap='coolwarm', s=35, 
                      vmin=-v1_fc, vmax=v1_fc, edgecolor='black', linewidth=0.5)
ax_fc_g1_top.set_xticks([])
ax_fc_g1_top.set_yticks([])
ax_fc_g1_top.set_title(f"FC Grad 1 (Top)\nr={corr_grad1:.3f}", fontsize=10)

# FC Gradient 1 Side
ax_fc_g1_side = plt.subplot2grid((2, 10), (1, 4), colspan=1, rowspan=1)
ax_fc_g1_side.imshow(np.rot90(atlas.XZprojection, k=3), cmap='binary', aspect='auto')
ax_fc_g1_side.scatter(centroids_side[:, 0], centroids_side[:, 1], 
                       c=fc_grad1_bilateral, cmap='coolwarm', s=35, 
                       vmin=-v1_fc, vmax=v1_fc, edgecolor='black', linewidth=0.5)
ax_fc_g1_side.set_xticks([])
ax_fc_g1_side.set_yticks([])
ax_fc_g1_side.set_title("FC Grad 1 (Side)", fontsize=10)

# FC Gradient 2 Top
ax_fc_g2_top = plt.subplot2grid((2, 10), (1, 5), colspan=2, rowspan=1)
ax_fc_g2_top.imshow(atlas.XYprojection, cmap='binary', aspect='auto')
v2_fc = np.percentile(np.abs(fc_grad2_bilateral), 90)
ax_fc_g2_top.scatter(centroids_filtered[:, 0], centroids_filtered[:, 1], 
                      c=fc_grad2_bilateral, cmap='coolwarm', s=35, 
                      vmin=-v2_fc, vmax=v2_fc, edgecolor='black', linewidth=0.5)
ax_fc_g2_top.set_xticks([])
ax_fc_g2_top.set_yticks([])
ax_fc_g2_top.set_title(f"FC Grad 2 (Top)\nr={corr_grad2:.3f}", fontsize=10)

# FC Gradient 2 Side
ax_fc_g2_side = plt.subplot2grid((2, 10), (1, 7), colspan=1, rowspan=1)
ax_fc_g2_side.imshow(np.rot90(atlas.XZprojection, k=3), cmap='binary', aspect='auto')
ax_fc_g2_side.scatter(centroids_side[:, 0], centroids_side[:, 1], 
                       c=fc_grad2_bilateral, cmap='coolwarm', s=35, 
                       vmin=-v2_fc, vmax=v2_fc, edgecolor='black', linewidth=0.5)
ax_fc_g2_side.set_xticks([])
ax_fc_g2_side.set_yticks([])
ax_fc_g2_side.set_title("FC Grad 2 (Side)", fontsize=10)

plt.tight_layout()
plt.savefig(os.path.join(SAVE_DIR, "figure.png"), dpi=300, bbox_inches='tight')
plt.close()

# ===== 9. Save Statistics =====
statistics = {
    "sc_gradient_shape": list(modes_SC_filtered.shape),
    "fc_gradient_shape": list(modes_FC.shape),
    "sc_eigenvalues_mean": float(np.mean(eigvals_SC)),
    "fc_eigenvalues_mean": float(np.mean(eigvals_FC)),
    "correlation_gradient1": float(corr_grad1),
    "correlation_gradient2": float(corr_grad2),
    "sc_gradient1_mean": float(np.mean(modes_SC_filtered[0])),
    "sc_gradient1_std": float(np.std(modes_SC_filtered[0])),
    "sc_gradient2_mean": float(np.mean(modes_SC_filtered[1])),
    "sc_gradient2_std": float(np.std(modes_SC_filtered[1])),
    "fc_gradient1_mean": float(np.mean(modes_FC[0])),
    "fc_gradient1_std": float(np.std(modes_FC[0])),
    "fc_gradient2_mean": float(np.mean(modes_FC[1])),
    "fc_gradient2_std": float(np.std(modes_FC[1])),
    "n_regions_sc": int(sc_matrix.shape[0]),
    "n_regions_fc": int(fc_matrix.shape[0]),
    "n_excluded_regions": int(len(excluded_regions)),
    "n_centroids_filtered": int(centroids_filtered.shape[0])
}

with open(os.path.join(SAVE_DIR, "statistics.json"), 'w') as f:
    json.dump(statistics, f, indent=2)

print(f"Figure saved to {os.path.join(SAVE_DIR, 'figure.png')}")
print(f"Statistics saved to {os.path.join(SAVE_DIR, 'statistics.json')}")
