I want to extract the low-dimensional structure of high-amplitude coactivation events using dimensionality reduction and density-based clustering, and visualize the results as a sorted correlation matrix. The core experimental data are in PROCESS_DATA_DIR/Figure4_events_high.npy.
Analysis pipeline:
1. Load Data: Load the high-amplitude events array (Figure4_events_high.npy). Transpose the data if necessary to ensure the shape represents (n_events, n_features).
2. Dimensionality Reduction (t-SNE):
  - Apply t-Distributed Stochastic Neighbor Embedding (t-SNE) to the events.
  - Parameters: Use n_components=2, perplexity=30, learning_rate='auto', init='random', and set a fixed random_state=420 for reproducibility.
3. Clustering (HDBSCAN):
  - Apply the HDBSCAN algorithm to the resulting 2D t-SNE embedding to identify dense clusters.
  - Parameters: Set min_cluster_size=10.
4. Noise Reassignment (Centroid Matching):
  - Identify "noise" points (events labeled as -1 by HDBSCAN).
  - Calculate the centroid (mean vector) for every valid cluster found.
  - Iterate through the noise points: calculate the Pearson correlation between the noise event and each cluster centroid.
  - Reassign the noise point to the cluster with which it has the highest correlation, ensuring every event is assigned to a specific cluster.
5. Save the final cluster labels in PROCESS_DATA_DIR/Figure4_events_high_clusters.npy and the t-SNE embedding coordinates in PROCESS_DATA_DIR/Figure4_events_high_embedding.npy.
Visualization Specifications (t-SNE Scatter Plot):
1. Data Loading: Load the saved t-SNE coordinates and the reassigned cluster labels.
2. Scatter Plot: Plot the events in the 2D t-SNE space (X-axis: Dimension 1, Y-axis: Dimension 2).
3. Color Coding: Color the points according to their assigned cluster using the following scheme:
  - Cluster 1: Red
  - Cluster 2: Blue
  - Cluster 3: Black
4. Styling:
  - Axes Labels: Label the X-axis "t-SNE 1" and the Y-axis "t-SNE 2".
  - Spines: Remove the top and right spines of the plot frame for a cleaner look.
  - Legend: Add a legend in the top-right corner identifying "Cluster 1", "Cluster 2", and "Cluster 3" with text corresponding to their colors.
  - Ticks: Ensure the axis ticks are visible and scaled appropriately (e.g., -10 to 10).