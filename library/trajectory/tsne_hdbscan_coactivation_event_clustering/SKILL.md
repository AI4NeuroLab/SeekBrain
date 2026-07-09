# t-SNE and HDBSCAN Coactivation Event Clustering

## Description
This skill extracts low-dimensional structure from high-amplitude neural coactivation events using a two-stage approach: t-SNE for dimensionality reduction and HDBSCAN for density-based clustering. It is designed for zebrafish whole-brain calcium imaging data where coactivation events have been pre-extracted as a matrix of brain region activations. The pipeline includes noise reassignment (reassigning HDBSCAN noise points to their most correlated cluster), cluster label reordering by size, and visualization via a sorted pairwise Pearson correlation matrix that reveals block-diagonal cluster structure.

## Tags
- dimensionality reduction
- t-SNE
- HDBSCAN
- clustering
- coactivation events
- calcium imaging
- zebrafish
- correlation matrix
- noise reassignment
- density-based clustering
- whole-brain imaging

## Input
- **Coactivation events array**: A 2D NumPy array of shape `(n_regions, n_events)` stored as `Figure4_events_high.npy` in `PROCESS_DATA_DIR`. Each column represents one coactivation event and each row represents a brain region's activity during that event.

## Output
- **Cluster labels**: `PROCESS_DATA_DIR/Figure4_events_high_clusters.npy` — 1D integer array of length `n_events` with reordered cluster labels (0 = largest cluster).
- **t-SNE embedding**: `PROCESS_DATA_DIR/Figure4_events_high_embedding.npy` — 2D array of shape `(n_events, 2)` with t-SNE coordinates.
- **Sorted correlation matrix figure**: `SAVE_DIR/figure_refine.png` — Grayscale heatmap of the pairwise Pearson correlation matrix sorted by cluster membership, showing block-diagonal structure.
- **Statistics JSON**: `SAVE_DIR/statistics.json` — Summary statistics including number of events, regions, clusters, cluster size distributions, correlation matrix statistics, and t-SNE embedding ranges.

## Algorithm / Processing Steps
1. **Data Loading**: Load the coactivation events array from `.npy` file. Transpose to `(n_events, n_regions)` for scikit-learn compatibility.
2. **t-SNE Dimensionality Reduction**: Apply t-SNE to the transposed event matrix to produce a 2D embedding. Uses `n_components=2`, `perplexity=30`, `learning_rate='auto'`, `init='random'`, and `random_state=420` for reproducibility.
3. **HDBSCAN Clustering**: Apply HDBSCAN to the 2D t-SNE embedding with `min_cluster_size=10` to identify density-based clusters. Some events may be labeled as noise (`-1`).
4. **Noise Reassignment**: For each noise-labeled event:
   - Compute the centroid (mean activation profile) of each valid cluster.
   - Calculate the Pearson correlation between the noise event's activation profile (in original high-dimensional space) and each cluster centroid.
   - Reassign the noise event to the cluster with the highest Pearson correlation.
5. **Cluster Label Reordering**: Count events per cluster, sort clusters by descending count, and remap labels so that cluster 0 is the largest, cluster 1 the second largest, etc.
6. **Save Results**: Save reordered cluster labels and t-SNE embedding as `.npy` files.
7. **Visualization**:
   - Compute the full pairwise Pearson correlation matrix between all events using `np.corrcoef`.
   - Sort rows and columns by flipped (reversed) cluster label order using `np.argsort(labels, kind='stable')[::-1]`.
   - Plot the sorted correlation matrix with `imshow`, `aspect='equal'`, `cmap='gray'`, `vmin=-0.2`, `vmax=0.5`.
   - Add a vertical colorbar labeled "Correlation" and label the Y-axis "Coactivation events" with event IDs from 1 to n_events.

## Key Parameters
| Parameter | Value | Description |
|---|---|---|
| `n_components` (t-SNE) | 2 | Number of dimensions for the embedding |
| `perplexity` (t-SNE) | 30 | t-SNE perplexity controlling neighborhood size |
| `learning_rate` (t-SNE) | 'auto' | Automatic learning rate selection |
| `init` (t-SNE) | 'random' | Random initialization of the embedding |
| `random_state` (t-SNE) | 420 | Fixed seed for reproducibility |
| `min_cluster_size` (HDBSCAN) | 10 | Minimum number of events to form a cluster |
| `cmap` (visualization) | 'gray' | Grayscale colormap for the correlation matrix |
| `vmin` (visualization) | -0.2 | Minimum value for colormap range |
| `vmax` (visualization) | 0.5 | Maximum value for colormap range |

## Usage Example
```python
import numpy as np
from sklearn.manifold import TSNE
import hdbscan
from scipy.stats import pearsonr

# Load events (n_regions x n_events)
events = np.load("PROCESS_DATA_DIR/Figure4_events_high.npy")
events_T = events.T  # (n_events x n_regions)

# t-SNE
tsne = TSNE(n_components=2, perplexity=30, learning_rate='auto',
            init='random', random_state=420)
embedding = tsne.fit_transform(events_T)

# HDBSCAN
clusterer = hdbscan.HDBSCAN(min_cluster_size=10)
labels = clusterer.fit_predict(embedding)

# Reassign noise points by Pearson correlation to cluster centroids
noise_mask = labels == -1
valid_labels = np.unique(labels[~noise_mask])
centroids = {l: events_T[labels == l].mean(axis=0) for l in valid_labels}
for idx in np.where(noise_mask)[0]:
    corrs = {l: pearsonr(events_T[idx], c)[0] for l, c in centroids.items()}
    labels[idx] = max(corrs, key=corrs.get)

# Reorder labels by cluster size (largest = 0)
unique_labels, counts = np.unique(labels, return_counts=True)
sorted_idx = np.argsort(-counts)
label_map = {old: new for new, old in enumerate(unique_labels[sorted_idx])}
reordered_labels = np.array([label_map[l] for l in labels])

# Save
np.save("PROCESS_DATA_DIR/Figure4_events_high_clusters.npy", reordered_labels)
np.save("PROCESS_DATA_DIR/Figure4_events_high_embedding.npy", embedding)
```

## Dependencies
- `numpy` — Array operations and file I/O
- `matplotlib` — Visualization of the sorted correlation matrix
- `scikit-learn` (`sklearn.manifold.TSNE`) — t-SNE dimensionality reduction
- `hdbscan` — Density-based clustering algorithm
- `scipy.stats` (`pearsonr`) — Pearson correlation for noise reassignment
- `json` — Saving statistics

## Limitations
- **t-SNE stochasticity**: Despite a fixed `random_state`, results may vary slightly across different scikit-learn versions or platforms.
- **Perplexity sensitivity**: The t-SNE `perplexity=30` may not be optimal for all dataset sizes; for very small or very large event counts, this parameter should be tuned.
- **HDBSCAN `min_cluster_size`**: Set to 10; smaller values may over-fragment clusters while larger values may under-segment.
- **Noise reassignment by correlation**: Assigns every noise point to some cluster, which may incorrectly group truly uncorrelated events. No threshold is applied.
- **Scalability**: The pairwise Pearson correlation matrix is `O(n_events²)` in memory, which may be prohibitive for very large event counts (>50,000).
- **Colormap range**: Fixed `vmin=-0.2` and `vmax=0.5` may clip values outside this range.

## Source
Derived from a zebrafish whole-brain calcium imaging analysis pipeline for identifying low-dimensional coactivation event structure, inspired by approaches used in large-scale neural population analysis (e.g., Figure 4 analysis of high-amplitude coactivation events).
