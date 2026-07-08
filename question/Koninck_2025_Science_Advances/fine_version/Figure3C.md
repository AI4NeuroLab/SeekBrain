I want to identify structural connectivity (SC) network modules through a hierarchical consensus algorithm based on the iterative Louvain algorithm for maximization of modularity. The core experimental data are SC_matrix_directed_terminals_expanded.npy, zebrafish brain atlas and regional information in the atlas folder, and the Figure1_excluded_regions.npy in the PROCESS_DATA_DIR folder. 
1. Apply a consensus modularity maximization algorithm to generate a co-assignment probability matrix. 
  1. Import the function compute_coassignment_probability.
  2. Load the SC matrix after excluding specific brain regions  listed in Figure1_excluded_regions.npy (both rows and columns corresponding to these regions are removed). 
  3. Generate an ensemble of 10,000 node partitions, varying the resolution parameter γ from 0.7 to 2.2.
  4. Compute the co-assignment (consensus) matrix C, whose entries cij indicate the empirical probability that nodes i and j are assigned to the same module across the 10,000 partitions.
2. Use hierarchical clustering (Ward’s linkage) on the co-assignment matrix of SC. 
  1. Import scipy.cluster.hierarchy.linkage and  scipy.cluster.hierarchy.fcluster.
  2. Convert high coassignment probabilities into small distances  using the transformation, D = 1 − C, and apply Ward’s linkage on the distance matrix D to obtain a hierarchical clustering (linkage matrix Z).
  3. Use fcluster with the maxclust criterion on Z to extract a partition with 4 modules. This yields a module label for each node.
For visualization:
1. Figure layout
  1. Set figsize=(8, 6).
  2. Create two axes within the overall figure:
    - A “top view” axis occupying 60% of the horizontal space and full height.
    - A “side view” axis positioned directly to the right of the top view, occupying the remaining 40% of the horizontal space and full height.
  3. Use the same vertical extent (height) for both.
2. Produce top (horizontal, XY) and side (sagittal, XZ) views of atlas region projections as grayscale anatomical backgrounds (cmap = 'binary'), arranged side-by-side. 
  1. Use the atlas projection images in their native resolution and aspect ratio when plotting (i.e. do not rescale them in a way that distorts their geometry; preserve the original pixel dimensions and proportions). 
  2. For the top view, use imshow with cmap='binary' and aspect='equal' and set limits: x-axis [65, 505], y-axis [850, 50] (inverted to match the panel orientation).
  3. For the side view, rotate the XZ projection by 90 degrees clockwise so that the anterior–posterior axis is oriented vertically, matching the orientation of the top view. Use imshow with cmap='binary' and aspect='equal'.  Set limits: x-axis [40, 359], y-axis [850, 50].
  4. Then align the top and side panels by using identical y-axis limits (e.g., from 850 to 50) so that the brain’s length is displayed over the same vertical range in both views, while cropping the x-axis limits separately in each panel to tightly frame the brain.
  5. In the top view panel, add a text label “Top” to the bottom-left corner.
  6. In the side view panel, add a text label “Side” to the bottom-left corner.
3. Map circular node markers representing brain region centroids into the top and side atlas projections, respectively. 
  1. Nodes correspond to atlas regions, but their total count should be doubled relative to the average connectivity matrix because each region is mirrored across the two hemispheres. Ensure those specific brain regions listed in Figure1_excluded_regions.npy are removed. 
  2. Make sure that the node coordinates for the side view undergo the same axis permutation, rotation, and flipping as the XZ projection image, so that the projected centroids are spatially aligned with the anatomical side-view background.
  3. For the side view, a coordinate transformation to match the rotated view: x coordinate, 359 - z, where z is the centroid’s original z coordinate (mirror across the right edge of the panel); y coordinate, centroid y (unchanged).
  4. Color the node markers based on the above 4 modules with purple (#8A2BE2), cyan (#00CED1), pale yellow (#F0E68C), and red (#FF0000) from anterior to posterior. 
4. Text and Annotation Details
  1. A custom legend is located in the top-right corner of the right panel. It features the text "Modules" in black, followed by a vertical list of numbers "1", "2", "3", and "4". Crucially, the text for each number is colored to match its corresponding module (1 is purple, 2 is cyan, 3 is yellow, 4 is red).
  2. Between the two panels, near the bottom, there is a double-headed arrow labeled "A" (top) and "P" (bottom), indicating the Anterior-Posterior axis.