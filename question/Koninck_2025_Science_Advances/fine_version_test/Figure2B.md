I want to visualize the Structural Connectivity (SC) network on the zebrafish brain atlas, overlaying a regional centroid network representation onto realistic anatomical projection graphs. SC data are stored in SC_matrix_undirected_terminals_expanded.npy. Zebrafish atlas and regional information are in the atlas folder. Before the visualization steps, remove those regions listed in thePROCESS_DATA_DIR/Figure1_excluded_regions.npy.
For visualization:
1. Load and Prepare Data
  1. Load the undirected structural connectivity matrix in SC_matrix_undirected_terminals_expanded.npy.
  2. Load the IDs of excluded regions in PROCESS_DATA_DIR/Figure1_excluded_regions.npy.
  3. Load the atlas centroids for the left and right hemispheres from the MapzebrainAtlas class.
  4. Construct the full set of centroids by concatenating the left and right hemisphere centroids.
  5. Remove centroids corresponding to the excluded regions. Ensure the corresponding indices from both the left and right parts of the array are removed.
  6. Create a bilateral SC matrix by tiling the undirected  SC matrix.
2. Panel Layout
  1. Set figsize=(8, 6).
  2. Create two axes within the overall figure. Top view occupying 60% width, Side view occupying 40% width, matched height. 
3. Top View (Horizontal / XY)
  1. Background: Display the atlas XY projection image, using imshow with cmap = 'binary' and aspect = 'equal'.
  2. Network Graph: Plot the edges and nodes using the prepared regional centroids (X, Y coordinates).
    1. Nodes: Use a scatter plot of the regional centroids, with the white marker face and the black marker edge. Set marker size in 10.
    2. Edges: Draw lines between centroids based on the bilateral SC matrix (without the diagonal). Bottom quartile edges are not displayed. Map edge colors to connection strength using a blue‑to‑white colormap (flipping cmap='Blues') with color limits in [0 1]. Order edges so stronger connections are plotted on top. Set line width to 0.8. 
  3. Set axis Limits: x-axis, [65, 505]; y-axis, [850, 50] (inverted). Hide axis spines and ticks.
4. Side View (Sagittal / XZ)
  1. Coordinate Transformation: Prepare centroids for the side view. Invert the Z-coordinate of regional centroids to match the rotated view. Use these transformed coordinates (inverted z, y) for plotting.
  2. Background: Display the atlas XZ projection image by rotating 90 degrees clockwise. Use imshow with cmap = 'binary' and aspect = 'equal'.
  3. Network Graph: Plot the edges and nodes using the transformed centroids and the bilateral SC matrix. Use the same node and edge visual parameters (color, size, alpha, linewidth) as the Top View.
  4. Set axis Limits: x-axis, [40, 359]; y-axis, [850, 50] (matching the Top View's vertical extent). Hide axis spines and ticks.
5. Annotations:
  1. Top view, add a black text label “Top” at the upper-left corner, and draw a 100 μm scale bar at the lower-right corner of the panel.
  2. Side view, add a black text label “Side” at the upper-right corner.