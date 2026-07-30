import os
import sys
import json
import numpy as np
import matplotlib.pyplot as plt
from sklearn.manifold import TSNE
import hdbscan
from scipy.stats import pearsonr

# Import shared utilities
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))  # vendored library modules sit beside this script
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
# 1. Load Data
# =============================================================================
events_file = os.path.join(PROCESS_DATA_DIR, "Figure4_events_high.npy")
events = np.load(events_file)  # Shape: (n_regions, n_events)
print(f"Loaded events array with shape: {events.shape}")

n_regions, n_events = events.shape

# Transpose for sklearn compatibility: (n_events, n_regions)
events_T = events.T
print(f"Transposed events shape: {events_T.shape}")

# =============================================================================
# 2. Dimensionality Reduction: t-SNE
# =============================================================================
print("Performing t-SNE dimensionality reduction...")
tsne = TSNE(
    n_components=2,
    perplexity=30,
    learning_rate='auto',
    init='random',
    random_state=420
)
embedding = tsne.fit_transform(events_T)  # Shape: (n_events, 2)
print(f"t-SNE embedding shape: {embedding.shape}")

# =============================================================================
# 3. Clustering: HDBSCAN
# =============================================================================
print("Applying HDBSCAN clustering...")
clusterer = hdbscan.HDBSCAN(min_cluster_size=10)
labels = clusterer.fit_predict(embedding)
print(f"Initial cluster labels: {np.unique(labels, return_counts=True)}")

# =============================================================================
# 4. Noise Reassignment
# =============================================================================
print("Reassigning noise points...")
noise_mask = labels == -1
noise_indices = np.where(noise_mask)[0]
valid_labels = np.unique(labels[~noise_mask])

if len(noise_indices) > 0 and len(valid_labels) > 0:
    # Calculate centroids for each valid cluster in original space
    centroids = {}
    for label in valid_labels:
        cluster_mask = labels == label
        centroids[label] = events_T[cluster_mask].mean(axis=0)
    
    # Reassign each noise point to the cluster with highest correlation
    for idx in noise_indices:
        event_vec = events_T[idx]
        best_label = None
        best_corr = -np.inf
        
        for label, centroid in centroids.items():
            # Compute Pearson correlation
            corr, _ = pearsonr(event_vec, centroid)
            if corr > best_corr:
                best_corr = corr
                best_label = label
        
        labels[idx] = best_label

print(f"After noise reassignment: {np.unique(labels, return_counts=True)}")

# =============================================================================
# 5. Re-order Cluster Labels by Size
# =============================================================================
print("Re-ordering cluster labels by size...")
unique_labels, counts = np.unique(labels, return_counts=True)
sorted_indices = np.argsort(-counts)  # Descending order
label_mapping = {old_label: new_label for new_label, old_label in enumerate(unique_labels[sorted_indices])}

# Apply mapping
reordered_labels = np.array([label_mapping[l] for l in labels])
print(f"Reordered cluster labels: {np.unique(reordered_labels, return_counts=True)}")

# =============================================================================
# 6. Save Result Files
# =============================================================================
print("Saving result files...")
np.save(os.path.join(PROCESS_DATA_DIR, "Figure4_events_high_clusters.npy"), reordered_labels)
np.save(os.path.join(PROCESS_DATA_DIR, "Figure4_events_high_embedding.npy"), embedding)
print("Saved cluster labels and t-SNE embedding.")

# =============================================================================
# 7. Calculate Pairwise Correlation Matrix
# =============================================================================
print("Computing pairwise Pearson correlation matrix...")
corr_matrix = np.corrcoef(events_T)  # Shape: (n_events, n_events)
np.fill_diagonal(corr_matrix, 0)
print(f"Correlation matrix shape: {corr_matrix.shape}")

# =============================================================================
# 8. Sort Correlation Matrix by Cluster Labels (Flipped)
# =============================================================================
print("Sorting correlation matrix by cluster labels...")
# Create sorting index based on flipped cluster labels
sort_idx = np.argsort(reordered_labels)[::-1]  # Flip the order
corr_matrix_sorted = corr_matrix[sort_idx, :][:, sort_idx]

# =============================================================================
# 9. Visualization
# =============================================================================
print("Creating visualization...")
fig, ax = plt.subplots(figsize=(8, 8), dpi=300)

# Plot sorted correlation matrix
im = ax.imshow(
    corr_matrix_sorted,
    aspect='equal',
    cmap='gray',
    vmin=-0.2,
    vmax=0.5,
    interpolation='nearest'
)

# Add colorbar
cbar = plt.colorbar(im, ax=ax, fraction=0.046, pad=0.04)
cbar.set_label("Correlation", rotation=270, labelpad=20)

# Label Y-axis with event IDs
ax.set_ylabel("Coactivation events")
ax.set_yticks([0, n_events - 1])
ax.set_yticklabels([1, n_events])

# Remove X-axis ticks
ax.set_xticks([])

# Save figure
figure_path = os.path.join(SAVE_DIR, "figure.png")
plt.savefig(figure_path, bbox_inches='tight', dpi=300)
plt.close()
print(f"Figure saved to {figure_path}")

# =============================================================================
# 10. Save Statistics to JSON
# =============================================================================
print("Saving statistics...")

# Compute summary statistics
unique_clusters, cluster_counts = np.unique(reordered_labels, return_counts=True)
cluster_stats = {
    f"cluster_{i}": {
        "count": int(count),
        "fraction": float(count / n_events)
    }
    for i, count in zip(unique_clusters, cluster_counts)
}

# Correlation matrix statistics
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
print(f"Statistics saved to {statistics_path}")

print("Analysis complete!")
