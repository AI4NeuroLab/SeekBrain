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
Visualization Specifications (Sorted Correlation Matrix):
1. Compute Correlations: Calculate the pairwise Pearson correlation matrix between all detected events (resulting in a square matrix).
2. Sort by Cluster: Reorder the rows and columns of the matrix so that events belonging to the same cluster are grouped together.
3. Plotting:
  - Heatmap: Plot the sorted correlation matrix. Use a grayscale colormap (black to white, cmap = 'gray') ranging from -0.2 to 0.5.
  - Cluster Annotation: Add colored bars along the top and left edges of the matrix to indicate the cluster identity of the grouped rows/columns:
    - Forebrain Cluster: Label with a Black bar.
    - Visual Cluster: Label with a Blue bar.
    - Motor Cluster: Label with a Red bar.
  - Text Labels: Label the groups as "Forebrain", "Visual", and "Motor" above the corresponding color bars.
  - Axis Labels: Label the Y-axis "Coactivation events" (indicating total count, e.g., 243).
  - Colorbar: Add a vertical colorbar labeled "Correlation".