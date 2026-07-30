import os
import sys
import numpy as np
import matplotlib.pyplot as plt
from sklearn.decomposition import PCA
from scipy.spatial.distance import pdist, squareform

# Add shared toolkit to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))  # vendored library modules sit beside this script
from zebrafish_Ca_utils import MapzebrainAtlas
# Force using * import as requested
from zebrafish_Ca_utils_predictors_xps import *

# Get environment paths
PROCESS_DATA_DIR = os.getenv("PROCESS_DATA_DIR")
SAVE_DIR = os.getenv("SAVE_DIR")
ZEBRAFISH_PATH = os.getenv("ZEBRAFISH_PATH")
ATLAS_PATH = os.getenv("ATLAS_PATH")

# Data paths
files_dir = os.path.join(ZEBRAFISH_PATH, "Files")
sc_directed_path = os.path.join(files_dir, "SC_matrix_directed_terminals_expanded.npy")
sc_undirected_path = os.path.join(files_dir, "SC_matrix_undirected_terminals_expanded.npy")
excluded_regions_path = os.path.join(PROCESS_DATA_DIR, "Figure1_excluded_regions.npy")

# Load data
print("Loading structural connectivity matrices...")
sc_directed = np.load(sc_directed_path, allow_pickle=True).astype(float)
sc_undirected = np.load(sc_undirected_path, allow_pickle=True).astype(float)

# Load excluded regions
if os.path.exists(excluded_regions_path):
    excluded_regions = np.load(excluded_regions_path).astype(int)
    print(f"Loaded {len(excluded_regions)} excluded regions")
else:
    excluded_regions = np.array([], dtype=int)
    print("No excluded regions file found.")

# Load atlas and compute distances
print("Loading atlas and computing distances...")
atlas = MapzebrainAtlas(ATLAS_PATH)

# Compute average centroids between hemispheres
left_centroids = np.asarray(atlas.regionCentroids["left"], dtype=float)
right_centroids = np.asarray(atlas.regionCentroids["right"], dtype=float)
centroids = 0.5 * (left_centroids + right_centroids)

# Compute pairwise Euclidean distances
distance_matrix = squareform(pdist(centroids, metric="euclidean"))
np.fill_diagonal(distance_matrix, 0.0)

# Remove excluded regions from all matrices
def remove_excluded_regions(matrix, excluded_indices):
    """Remove rows and columns corresponding to excluded regions."""
    if len(excluded_indices) == 0:
        return matrix
    mask = np.ones(matrix.shape[0], dtype=bool)
    mask[excluded_indices] = False
    return matrix[mask][:, mask]

print("Removing excluded regions from matrices...")
sc_directed_filtered = remove_excluded_regions(sc_directed, excluded_regions)
sc_undirected_filtered = remove_excluded_regions(sc_undirected, excluded_regions)
distance_filtered = remove_excluded_regions(distance_matrix, excluded_regions)

# Validate matrix shapes
assert sc_directed_filtered.shape == sc_undirected_filtered.shape, "SC matrices must have same shape"
assert sc_directed_filtered.shape == distance_filtered.shape, "Distance matrix must match SC shape"

# Instantiate predictor model
print("Instantiating predictor model...")
model = Predictors(
    sc_directed_filtered,
    sc_undirected_filtered,
    distance_filtered
)

# Compute structural predictors using directed SC information
print("Computing structural predictors (directed=True)...")
model.compute_predictors(directed=True)

# Extract first 10 principal components
print("Performing PCA on predictor matrix...")
n_components = 10
pca = PCA(n_components=n_components)
pca.fit(model.predictors)

explained_variance_ratio = pca.explained_variance_ratio_
cumulative_variance = np.cumsum(explained_variance_ratio)

# Save explained variance ratios
output_path = os.path.join(PROCESS_DATA_DIR, "Figure2_SC_predictor_PCA_expvar.npy")
np.save(output_path, explained_variance_ratio)
print(f"Saved explained variance to {output_path}")

# Visualization
print("Creating visualization...")
fig, ax = plt.subplots(figsize=(5, 4))
pc_indices = np.arange(1, n_components + 1)

# Plot Cumulative first (black) so it is behind the Ratio line
ax.plot(
    pc_indices,
    cumulative_variance,
    marker='o',
    color='black',
    linewidth=2,
    markersize=6,
    label='Cumulative'
)

# Plot Ratio second (mediumvioletred) so markers appear on top
ax.plot(
    pc_indices,
    explained_variance_ratio,
    marker='o',
    color='mediumvioletred',
    linewidth=2,
    markersize=6,
    label='Ratio'
)

# Annotate PC1 explained variance
pc1_var = explained_variance_ratio[0]
ax.text(
    1, pc1_var + 0.03,
    f"{pc1_var:.3f}",
    fontsize=10,
    ha='center',
    va='bottom',
    color='mediumvioletred'
)

# Add "Ratio" label near upper-right of curve (around PC 8-9)
ax.text(
    8.5, explained_variance_ratio[7] + 0.03,
    "Ratio",
    fontsize=10,
    ha='center',
    color='mediumvioletred'
)

# Add "Cumulative" label near lower-right of curve
ax.text(
    8.5, cumulative_variance[7] - 0.06,
    "Cumulative",
    fontsize=10,
    ha='center',
    color='black'
)

# Configure axes
ax.set_xlabel("Principal component #", fontsize=12)
ax.set_ylabel("Explained variance", fontsize=12)
ax.set_xlim(0.5, n_components + 0.5)
ax.set_ylim(-0.05, 1.05)
ax.set_xticks(pc_indices)

# Remove top and right spines
ax.spines['top'].set_visible(False)
ax.spines['right'].set_visible(False)

plt.tight_layout()
figure_path = os.path.join(SAVE_DIR, "figure_refine.png")
plt.savefig(figure_path, dpi=300, bbox_inches='tight')
print(f"Saved figure to {figure_path}")
plt.close()
