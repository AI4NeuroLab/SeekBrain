import os
import sys
import json
import numpy as np
import matplotlib.pyplot as plt
from sklearn.manifold import TSNE
import hdbscan
from scipy.stats import pearsonr

# Import shared utilities
sys.path.append("/mnt/shared-storage-gpfs2/ai4neuro-share/neuro_scientist/library/code")
from zebrafish_Ca_utils import *
from zebrafish_Ca_stats_patch_xps import *
from zebrafish_Ca_utils_patch_xps import *
from zebrafish_Ca_utils_predictors_xps import *
from zebrafish_Ca_visualization_patch_xps import *

# Get environment paths
PROCESS_DATA_DIR = os.getenv("PROCESS_DATA_DIR")
SAVE_DIR = os.getenv("SAVE_DIR")

# Ensure directories exist
os.makedirs(PROCESS_DATA_DIR, exist_ok=True)
os.makedirs(SAVE_DIR, exist_ok=True)

# =============================================================================
# 1. Data load
# =============================================================================
events_file = os.path.join(PROCESS_DATA_DIR, "Figure4_events_high.npy")
events = np.load(events_file)  # Shape: (n_regions, n_events)
print(f"Loaded events array with shape: {events.shape}")

n_regions, n_events = events.shape

# Transpose for sklearn compatibility: (n_events, n_regions)
events_T = events.T

# =============================================================================
# 2. Dimensionality Reduction
# =============================================================================
print("Performing t-SNE dimensionality reduction...")
tsne = TSNE(
    n_components=2,
    perplexity=30,
    learning_rate='auto',
    init='random',
    random_state=420
)
embedding = tsne.fit_transform(events_T)

# =============================================================================
# 3. Clustering
# =============================================================================
print("Applying HDBSCAN clustering...")
clusterer = hdbscan.HDBSCAN(min_cluster_size=10)
labels = clusterer.fit_predict(embedding)

# =============================================================================
# 4. Noise reassignment
# =============================================================================
print("Reassigning noise points...")
noise_mask = labels == -1
noise_indices = np.where(noise_mask)[0]
valid_labels = np.unique(labels[~noise_mask])

if len(noise_indices) > 0 and len(valid_labels) > 0:
    centroids = {}
    for label in valid_labels:
        cluster_mask = labels == label
        centroids[label] = events_T[cluster_mask].mean(axis=0)
    
    for idx in noise_indices:
        event_vec = events_T[idx]
        best_label = None
        best_corr = -np.inf
        
        for label, centroid in centroids.items():
            corr, _ = pearsonr(event_vec, centroid)
            if corr > best_corr:
                best_corr = corr
                best_label = label
        
        labels[idx] = best_label

# =============================================================================
# 5. Re-order the cluster label
# =============================================================================
print("Re-ordering cluster labels by size...")
unique_labels, counts = np.unique(labels, return_counts=True)
# Sort by count descending (largest first)
sorted_indices = np.argsort(-counts)
label_mapping = {old_label: new_label for new_label, old_label in enumerate(unique_labels[sorted_indices])}

reordered_labels = np.array([label_mapping[l] for l in labels])

# =============================================================================
# 6. Save result files
# =============================================================================
print("Saving result files...")
np.save(os.path.join(PROCESS_DATA_DIR, "Figure4_events_high_clusters.npy"), reordered_labels)
np.save(os.path.join(PROCESS_DATA_DIR, "Figure4_events_high_embedding.npy"), embedding)

# =============================================================================
# Visualization Specifications
# =============================================================================

# 1. Calculate pairwise Pearson correlation matrix
print("Computing pairwise Pearson correlation matrix...")
corr_matrix = np.corrcoef(events_T)
# Note: Self-correlation is 1. We preserve the diagonal.

# 2. Reorder rows and columns by flipped region ID of final cluster labels
print("Sorting correlation matrix...")
# Sort based on labels. kind='stable' preserves original order within clusters.
# [::-1] flips the order as requested.
sort_idx = np.argsort(reordered_labels, kind='stable')[::-1]
corr_matrix_sorted = corr_matrix[sort_idx, :][:, sort_idx]

# 3. Plot sorted correlation matrix
print("Creating visualization...")
fig, ax = plt.subplots(figsize=(8, 8), dpi=300)

im = ax.imshow(
    corr_matrix_sorted,
    aspect='equal',
    cmap='gray',
    vmin=-0.2,
    vmax=0.5,
    interpolation='nearest'
)

# Vertical colorbar
cbar = plt.colorbar(im, ax=ax, fraction=0.046, pad=0.04)
cbar.set_label("Correlation", rotation=270, labelpad=20)

# 4. Label Y-axis
ax.set_ylabel("Coactivation events")
ax.set_yticks([0, n_events - 1])
ax.set_yticklabels([1, n_events])

# Remove X-axis ticks
ax.set_xticks([])

# Save figure
figure_path = os.path.join(SAVE_DIR, "figure_refine.png")
plt.savefig(figure_path, bbox_inches='tight', dpi=300)
plt.close()
print(f"Figure saved to {figure_path}")

# =============================================================================
# Save Statistics
# =============================================================================
unique_clusters, cluster_counts = np.unique(reordered_labels, return_counts=True)
cluster_stats = {
    f"cluster_{i}": {
        "count": int(count),
        "fraction": float(count / n_events)
    }
    for i, count in zip(unique_clusters, cluster_counts)
}

corr_values = corr_matrix[np.triu_indices(n_events, k=1)]
corr_values_finite = corr_values[np.isfinite(corr_values)]

statistics = {
    "n_events": int(n_events),
    "n_regions": int(n_regions),
    "n_clusters": int(len(unique_clusters)),
    "cluster_sizes": {
        "mean": float(np.mean(cluster_counts)),
        "std": float(np.std(cluster_counts)),
        "min": int(np.min(cluster_counts)),
        "max": int(np.max(cluster_counts)),
        "median": float(np.median(cluster_counts))
    },
    "cluster_distribution": cluster_stats,
    "correlation_matrix": {
        "mean": float(np.mean(corr_values_finite)),
        "std": float(np.std(corr_values_finite)),
        "median": float(np.median(corr_values_finite)),
        "min": float(np.min(corr_values_finite)),
        "max": float(np.max(corr_values_finite)),
        "percentile_25": float(np.percentile(corr_values_finite, 25)),
        "percentile_75": float(np.percentile(corr_values_finite, 75))
    },
    "tsne_embedding": {
        "shape": list(embedding.shape),
        "x_range": [float(embedding[:, 0].min()), float(embedding[:, 0].max())],
        "y_range": [float(embedding[:, 1].min()), float(embedding[:, 1].max())]
    }
}

statistics_path = os.path.join(SAVE_DIR, "statistics.json")
with open(statistics_path, 'w') as f:
    json.dump(statistics, f, indent=2)
print("Analysis complete!")
