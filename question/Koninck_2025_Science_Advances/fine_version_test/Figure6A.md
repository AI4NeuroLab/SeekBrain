I aim to investigate whether connectivity gradients of SC and FC could reflect the sensorimotor organization of the zebrafish brain. To this end, calculate connectivity gradients using the diffusion map algorithm on both FC and SC matrices first.
Analysis Pipeline
1. Dataset Identification & Loading:
  - Initialize the MapzebrainAtlas class with the atlas path to load region masks, centroids, and projection images (XY_H2BGCaMP6s.tif, XZ_H2BGCaMP6s.tif).
  - Load the list of excluded brain regions from PROCESS_DATA_DIR/Figure1_excluded_regions.npy.
  - Load the functional connectivity (FC) matrix from PROCESS_DATA_DIR/Figure1_FC_matrix.npy.
  - Load the structural connectivity (SC) matrix from SC_matrix_undirected_terminals_expanded.npy.
  - Preprocess region centroids: concatenate left and right hemisphere centroids, adjust coordinates, and remove centroids corresponding to the excluded regions.
2. Connectivity Gradients Calculation:
  - Functional Gradients: Apply the diffusion_mapping algorithm to the FC matrix. Extract the eigenvectors (gradients) and eigenvalues.
  - Structural Gradients: Apply the diffusion_mapping algorithm to the SC matrix (n_components=70, alpha=0.5). Remove rows corresponding to excluded regions  listed in theFigure1_excluded_regions.npy, then transpose the matrix to extract gradients and eigenvalues.
3. Output Generation:
  - Save the functional gradients and eigenvalues to PROCESS_DATA_DIR/Figure6_FC_gradients.npy and PROCESS_DATA_DIR/Figure6_FC_eigenvalues.npy.
  - Save the structural gradients and eigenvalues to PROCESS_DATA_DIR/Figure6_SC_gradients.npy and PROCESS_DATA_DIR/Figure6_SC_eigenvalues.npy.
Visualization Specifications
1. Figure Layout:
  - Create a figure (size 7x9 inches) containing two main sections: Structural Connectivity (SC) on the top row and Functional Connectivity (FC) on the bottom row.
  - For each section (SC and FC), arrange the following panels:
    - Left: A matrix plot showing the connectivity map.
    - Middle: Visualization of Gradient 1 (Top view and Side view).
    - Right: Visualization of Gradient 2 (Top view and Side view).
2. SC Visualization:
  - Matrix: Display the SC matrix using a custom blue-white colormap (vmin=0.1, vmax=0.9). Remove axis ticks.
  - Gradient 1 (Top/Side): Overlay region centroids on the atlas background (XY projection for Top, XZ projection for Side). Color centroids based on the 1st structural gradient values (cmap='coolwarm'). Set color limits (vmin, vmax) based on the 90th percentile of the gradient's absolute values.
  - Gradient 2 (Top/Side): Repeat the overlay process using the 2nd structural gradient values.
3. FC Visualization:
  - Matrix: Display the FC matrix using the same custom colormap (vmin=0.1, vmax=0.9). Remove axis ticks.
  - Gradient 1 (Top/Side): Overlay region centroids on the atlas background. Color centroids based on the 1st functional gradient values (cmap='coolwarm').
  - Gradient 2 (Top/Side): Repeat the overlay process using the 2nd functional gradient values.