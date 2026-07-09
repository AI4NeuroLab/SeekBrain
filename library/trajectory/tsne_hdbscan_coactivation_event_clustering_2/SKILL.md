# t-SNE and HDBSCAN Clustering of High-Amplitude Coactivation Events

## Description
This skill performs unsupervised discovery of low-dimensional structure in high-amplitude neural coactivation events. It combines t-SNE (t-distributed Stochastic Neighbor Embedding) for nonlinear dimensionality reduction with HDBSCAN (Hierarchical Density-Based Spatial Clustering of Applications with Noise) for robust density-based clustering. A post-processing step reassigns noise points (labeled -1 by HDBSCAN) to the most correlated cluster centroid using Pearson correlation, and cluster labels are reordered by descending cluster size. The result is a clean assignment of every event to a cluster, along with a 2D embedding for visualization.

## Tags
- dimensionality_reduction
- t-SNE
- HDBSCAN
- clustering
- coactivation_events
- calcium_imaging
- zebrafish
- unsupervised_learning
- noise_reassignment
- scatter_plot

## Input
- **Event array file**: `PROCESS_DATA_DIR/Figure4_events_high.npy` — a 2D NumPy array of shape `(n_regions, n_events)`, where each column represents a high-amplitude coactivation event across brain regions.

## Output
- **Cluster labels**: `PROCESS_DATA_DIR/Figure4_events_high_clusters.npy` — a 1D NumPy array of integer cluster labels (1-indexed, ordered by descending cluster size) for each event.
- **t-SNE embedding**: `PROCESS_DATA_DIR/Figure4_events_high_embedding.npy` — a 2D NumPy array of shape `(n_events, 2)` containing the 2D t-SNE coordinates.
- **Scatter plot figure**: `SAVE_DIR/figure_refine.png` — a t-SNE scatter plot colored by cluster identity (Cluster 1 = red, Cluster 2 = blue, Cluster 3 = black).
- **Statistics JSON**: `SAVE_DIR/statistics.json` — summary statistics including number of events, regions, clusters, cluster sizes, and embedding coordinate statistics (mean, std, median per cluster).

## Algorithm / Processing Steps
1. **Data Loading**: Load the high-amplitude coactivation event array from `.npy` file. Verify the array has sufficient events (≥10) for clustering.
2. **Transpose**: Transpose the array from `(n_regions, n_events)` to `(n_events, n_regions)` so each row is an event sample.
3. **t-SNE Dimensionality Reduction**: Apply t-SNE to reduce the `n_regions`-dimensional event data to a 2D embedding. Uses fixed random state for reproducibility.
4. **HDBSCAN Clustering**: Apply HDBSCAN to the 2D t-SNE embedding to discover density-based clusters. Events in low-density regions are labeled as noise (-1).
5. **Noise Reassignment**:
   - Compute the centroid (mean event vector in original `n_regions`-dimensional space) for each valid cluster.
   - For each noise-labeled event, compute Pearson correlation with every cluster centroid.
   - Reassign the noise event to the cluster with the highest correlation.
6. **Cluster Label Reordering**: Count events per cluster, sort clusters by descending size, and remap labels so that Cluster 1 is the largest, Cluster 2 is the second largest, etc.
7. **Save Results**: Save cluster labels and t-SNE embedding as `.npy` files.
8. **Visualization**: Generate a 2D scatter plot of the t-SNE embedding, color-coded by cluster assignment, with clean styling (no top/right spines, colored legend text).

## Key Parameters
| Parameter | Value | Description |
|-----------|-------|-------------|
| `n_components` | 2 | Number of t-SNE output dimensions |
| `perplexity` | 30 | t-SNE perplexity (balance between local and global structure) |
| `learning_rate` | 'auto' | Automatically determined t-SNE learning rate |
| `init` | 'random' | Random initialization for t-SNE |
| `random_state` | 420 | Fixed seed for reproducibility |
| `min_cluster_size` | 10 | Minimum number of points to form an HDBSCAN cluster |
| Noise reassignment metric | Pearson correlation | Correlation between noise event and cluster centroids in original space |

## Usage Example
```python
import os
import numpy as np
from sklearn.manifold import TSNE
import hdbscan
from scipy.stats import pearsonr

# Load events array (n_regions x n_events)
events = np.load("PROCESS_DATA_DIR/Figure4_events_high.npy")
events_T = events.T  # (n_events, n_regions)

# t-SNE
tsne = TSNE(n_components=2, perplexity=30, learning_rate='auto',
            init='random', random_state=420)
embedding = tsne.fit_transform(events_T)

# HDBSCAN
clusterer = hdbscan.HDBSCAN(min_cluster_size=10)
labels = clusterer.fit_predict(embedding)

# Noise reassignment via Pearson correlation to cluster centroids
valid_clusters = np.unique(labels[labels != -1])
centroids = {c: events_T[labels == c].mean(axis=0) for c in valid_clusters}
for idx in np.where(labels == -1)[0]:
    corrs = {c: pearsonr(events_T[idx], cent)[0] for c, cent in centroids.items()}
    labels[idx] = max(corrs, key=corrs.get)

# Reorder by size (largest = 1)
sizes = [(l, (labels == l).sum()) for l in np.unique(labels) if l != -1]
sizes.sort(key=lambda x: x[1], reverse=True)
mapping = {old: new + 1 for new, (old, _) in enumerate(sizes)}
final_labels = np.array([mapping[l] for l in labels])

np.save("Figure4_events_high_clusters.npy", final_labels)
np.save("Figure4_events_high_embedding.npy", embedding)
```

## Dependencies
- `numpy` — array operations and file I/O
- `scipy.stats.pearsonr` — Pearson correlation for noise reassignment
- `sklearn.manifold.TSNE` — t-SNE dimensionality reduction
- `hdbscan` — density-based clustering algorithm
- `matplotlib` — scatter plot visualization
- Python 3.7+

## Limitations
- **t-SNE is stochastic**: Results depend on the random seed; changing `random_state` will produce different embeddings and potentially different cluster assignments.
- **Perplexity sensitivity**: The t-SNE perplexity parameter (30) may not be optimal for all dataset sizes. For very small or very large datasets, tuning is recommended.
- **HDBSCAN `min_cluster_size`**: Set to 10; datasets with very few events or very different density profiles may require adjustment.
- **Fixed to 3 clusters in visualization**: The color map and legend are hardcoded for 3 clusters (red, blue, black). Additional clusters are rendered in gray. If fewer than 3 clusters are found, some legend entries will be absent.
- **Noise reassignment assumes meaningful Pearson correlation**: If event vectors are very noisy or near-zero, Pearson correlation may be unreliable for assignment.
- **Clustering is performed on the 2D t-SNE embedding**, not the original high-dimensional space, meaning cluster boundaries are influenced by t-SNE distortions.
- **Memory**: For very large numbers of events or regions, t-SNE computation can be memory-intensive.

## Source
Derived from a zebrafish whole-brain calcium imaging analysis pipeline for identifying distinct neural coactivation patterns from high-amplitude events (Figure 4 analysis).
