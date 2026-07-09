import os
import sys
import json
import numpy as np
import matplotlib.pyplot as plt
from scipy.stats import pearsonr
from sklearn.manifold import TSNE
import hdbscan

# Add utilities to path
sys.path.append("/mnt/shared-storage-gpfs2/ai4neuro-share/neuro_scientist/library/code")
from zebrafish_Ca_utils import *
from zebrafish_Ca_stats_patch_xps import *
from zebrafish_Ca_utils_patch_xps import *
from zebrafish_Ca_utils_predictors_xps import *
from zebrafish_Ca_visualization_patch_xps import *

# Get directories
PROCESS_DATA_DIR = os.getenv("PROCESS_DATA_DIR")
SAVE_DIR = os.getenv("SAVE_DIR")

# Ensure directories exist
if not PROCESS_DATA_DIR:
    raise ValueError("PROCESS_DATA_DIR environment variable not set")
if not SAVE_DIR:
    raise ValueError("SAVE_DIR environment variable not set")

# =============================================================================
# 1. Load Data
# =============================================================================
input_file = os.path.join(PROCESS_DATA_DIR, "Figure4_events_high.npy")
if not os.path.exists(input_file):
    raise FileNotFoundError(f"Input file not found: {input_file}")

events_array = np.load(input_file)  # Shape: (n_regions, n_events)
print(f"Loaded events array with shape: {events_array.shape}")

n_regions, n_events = events_array.shape
if n_events < 10:
    raise ValueError(f"Too few events for clustering: {n_events}")

# =============================================================================
# 2. Dimensionality Reduction with t-SNE
# =============================================================================
events_transposed = events_array.T  # Shape: (n_events, n_regions)
print(f"Transposed events shape: {events_transposed.shape}")

tsne = TSNE(
    n_components=2,
    perplexity=30,
    learning_rate='auto',
    init='random',
    random_state=420
)
embedding = tsne.fit_transform(events_transposed)  # Shape: (n_events, 2)
print(f"t-SNE embedding shape: {embedding.shape}")

# =============================================================================
# 3. Clustering with HDBSCAN
# =============================================================================
clusterer = hdbscan.HDBSCAN(min_cluster_size=10)
cluster_labels = clusterer.fit_predict(embedding)
print(f"Initial cluster labels: {np.unique(cluster_labels)}")
print(f"Number of noise points (-1 label): {np.sum(cluster_labels == -1)}")

# =============================================================================
# 4. Noise Reassignment
# =============================================================================
# Identify valid clusters (not noise)
valid_clusters = np.unique(cluster_labels[cluster_labels != -1])
print(f"Valid clusters: {valid_clusters}")

if len(valid_clusters) > 0:
    # Compute centroids for each valid cluster in original space
    cluster_centroids = {}
    for cluster_id in valid_clusters:
        mask = cluster_labels == cluster_id
        cluster_events = events_transposed[mask]
        centroid = np.mean(cluster_events, axis=0)
        cluster_centroids[cluster_id] = centroid

    # Reassign noise points
    noise_mask = cluster_labels == -1
    noise_indices = np.where(noise_mask)[0]
    print(f"Reassigning {len(noise_indices)} noise points...")

    for idx in noise_indices:
        noise_event = events_transposed[idx]
        max_corr = -np.inf
        best_cluster = None
        
        for cluster_id, centroid in cluster_centroids.items():
            # Compute Pearson correlation
            corr, _ = pearsonr(noise_event, centroid)
            if corr > max_corr:
                max_corr = corr
                best_cluster = cluster_id
        
        if best_cluster is not None:
            cluster_labels[idx] = best_cluster

    print(f"After reassignment, cluster labels: {np.unique(cluster_labels)}")
    print(f"Remaining noise points: {np.sum(cluster_labels == -1)}")
else:
    print("No valid clusters found to reassign noise points to.")

# =============================================================================
# 5. Re-order Cluster Labels by Size
# =============================================================================
unique_labels = np.unique(cluster_labels)
# Filter out -1 if it still exists to ensure we only rank valid clusters
valid_unique_labels = unique_labels[unique_labels != -1]

cluster_sizes = [(label, np.sum(cluster_labels == label)) for label in valid_unique_labels]
cluster_sizes.sort(key=lambda x: x[1], reverse=True)  # Sort by size descending

# Create mapping: largest cluster -> 1, second -> 2, etc.
# Keep -1 as -1 if it exists
label_mapping = {old_label: new_label + 1 for new_label, (old_label, _) in enumerate(cluster_sizes)}
if -1 in cluster_labels:
    label_mapping[-1] = -1

reordered_labels = np.array([label_mapping[lbl] for lbl in cluster_labels])

print(f"Reordered cluster labels: {np.unique(reordered_labels)}")
for old_lbl, new_lbl in label_mapping.items():
    if old_lbl != -1:
        size = np.sum(cluster_labels == old_lbl)
        print(f"  Cluster {new_lbl} (was {old_lbl}): {size} events")

# =============================================================================
# 6. Save Results
# =============================================================================
clusters_output = os.path.join(PROCESS_DATA_DIR, "Figure4_events_high_clusters.npy")
embedding_output = os.path.join(PROCESS_DATA_DIR, "Figure4_events_high_embedding.npy")

np.save(clusters_output, reordered_labels)
np.save(embedding_output, embedding)

print(f"Saved cluster labels to: {clusters_output}")
print(f"Saved embedding to: {embedding_output}")

# =============================================================================
# 7. Visualization
# =============================================================================
fig, ax = plt.subplots(figsize=(6, 5))

# Define colors for clusters 1, 2, 3
color_map = {1: 'red', 2: 'blue', 3: 'black'}
cluster_names = {1: 'Cluster 1', 2: 'Cluster 2', 3: 'Cluster 3'}

# Plot each cluster
for cluster_id in [1, 2, 3]:
    mask = reordered_labels == cluster_id
    if np.any(mask):
        ax.scatter(
            embedding[mask, 0],
            embedding[mask, 1],
            c=color_map[cluster_id],
            label=cluster_names[cluster_id],
            s=20,
            alpha=0.7
        )

# Plot any additional clusters (if more than 3) in gray
for cluster_id in np.unique(reordered_labels):
    if cluster_id > 3:
        mask = reordered_labels == cluster_id
        ax.scatter(
            embedding[mask, 0],
            embedding[mask, 1],
            c='gray',
            label=f'Cluster {cluster_id}',
            s=20,
            alpha=0.5
        )

# Styling
ax.set_xlabel("t-SNE 1")
ax.set_ylabel("t-SNE 2")
ax.spines['top'].set_visible(False)
ax.spines['right'].set_visible(False)

# Add legend and color the text
legend = ax.legend(loc='upper right', frameon=False)
color_map_text = {'Cluster 1': 'red', 'Cluster 2': 'blue', 'Cluster 3': 'black'}

for text in legend.get_texts():
    label_text = text.get_text()
    if label_text in color_map_text:
        text.set_color(color_map_text[label_text])

plt.tight_layout()
figure_path = os.path.join(SAVE_DIR, "figure_refine.png")
plt.savefig(figure_path, dpi=300)
plt.close()
print(f"Saved figure to: {figure_path}")

# =============================================================================
# 8. Save Statistics
# =============================================================================
statistics = {
    "n_events": int(n_events),
    "n_regions": int(n_regions),
    "embedding_shape": list(embedding.shape),
    "n_clusters": len(np.unique(reordered_labels[reordered_labels != -1])),
    "cluster_sizes": {},
    "cluster_means": {},
    "cluster_stds": {},
    "cluster_medians": {},
}

for cluster_id in np.unique(reordered_labels):
    if cluster_id == -1:
        continue
    mask = reordered_labels == cluster_id
    size = int(np.sum(mask))
    statistics["cluster_sizes"][f"cluster_{cluster_id}"] = size
    
    # Compute statistics for embedding coordinates
    cluster_embedding = embedding[mask]
    statistics["cluster_means"][f"cluster_{cluster_id}"] = {
        "dim1": float(np.mean(cluster_embedding[:, 0])),
        "dim2": float(np.mean(cluster_embedding[:, 1]))
    }
    statistics["cluster_stds"][f"cluster_{cluster_id}"] = {
        "dim1": float(np.std(cluster_embedding[:, 0])),
        "dim2": float(np.std(cluster_embedding[:, 1]))
    }
    statistics["cluster_medians"][f"cluster_{cluster_id}"] = {
        "dim1": float(np.median(cluster_embedding[:, 0])),
        "dim2": float(np.median(cluster_embedding[:, 1]))
    }

# Save statistics to JSON
stats_path = os.path.join(SAVE_DIR, "statistics.json")
with open(stats_path, 'w') as f:
    json.dump(statistics, f, indent=2)
print(f"Saved statistics to: {stats_path}")

print("\n=== Analysis Complete ===")
print(f"Total events analyzed: {n_events}")
print(f"Number of clusters: {len(np.unique(reordered_labels[reordered_labels != -1]))}")
