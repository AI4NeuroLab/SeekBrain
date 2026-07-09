# Paper Context for I_want_to_visualize_the_Structural_Connectivity__SC__network

Based on your request to visualize the Structural Connectivity (SC) network for the zebrafish brain, here is the structured analysis based on the provided requirements:

### 1. Relevant Paper Sections
*   **Methods: Structural Connectivity Mapping:** Focus on the section detailing the generation of the connectivity matrix and the integration with the Zebrafish Brain Browser (ZBB) atlas.
*   **Data Processing Pipeline:** The sections describing the construction of the bilateral network from the unilateral template.
*   **Visualization Methodology:** Descriptions related to graph theory-based network plotting and projecting 3D regional centroids onto 2D brain projections (top and side views).

### 2. Relevant Figures/Tables
*   **Figure 1 (or equivalent Network Overview):** The figure showing the whole-brain SC network overlaid on the ZBB brain projection.
*   **Supplementary Data Tables:** Tables listing the regional IDs and their associated anatomical labels used in the SC matrix.

### 3. Required Methods from Paper
*   **Bilateralization:** The method for mirroring the unilateral `SC_matrix_undirected_terminals_expanded.npy` to create a symmetric, bilateral connectivity matrix.
*   **Coordinate Transformation:** The method for loading the regional centroids (x, y, z) and the specific transformation function used to flip/adjust the y-coordinates to align with the standard ZBB image orientation.
*   **Graph Overlay:** The plotting function that takes the adjacency matrix (edges) and centroid coordinates (nodes) to draw lines between nodes, weighted/colored by SC strength.
*   **Data Cleaning:** The filtering logic to exclude regions specified in `Figure1_excluded_regions.npy`, ensuring that for every excluded region ID $i$, both $i$ and $i+N$ (where $N$ is the half-brain offset) are removed from the matrix and centroid list.

### 4. Data Requirements
*   **`SC_matrix_undirected_terminals_expanded.npy`**: The core structural connectivity input.
*   **`Figure1_excluded_regions.npy`**: The list of regions to be pruned from the network.
*   **Atlas Folder:** Contains regional centroid coordinates (typically stored as a CSV or NPY file mapped to ZBB IDs).
*   **Background Images:** ZBB top-view and side-view projection templates to serve as the background for the network visualization.

### 5. Key Paper Excerpts
*   *"The structural connectivity matrix was constructed based on terminal points identified in the zebrafish brain..."*
*   *"To visualize the network, we projected the regional centroids... centroids were defined by the center of mass of the anatomical regions provided in the atlas..."*
*   *"For the purpose of visualization, the unilateral SC matrix was expanded to a bilateral matrix by..."* (Check implementation: usually involves setting the block-diagonal and off-diagonal cross-hemisphere connections).

### 6. Evaluation Criteria
*   **Symmetry Check:** The final SC matrix must be square (Total_Regions x Total_Regions) and symmetric.
*   **Coordinate Alignment:** The visual overlay must show centroids correctly registered to the ZBB template, verified by checking if the midline is preserved and if left-hemisphere nodes mirror right-hemisphere nodes.
*   **Exclusion Accuracy:** Confirm that no nodes or edges associated with the IDs in `Figure1_excluded_regions.npy` appear in the final plot.
*   **Visual Logic:** Edge colors must scale monotonically with the SC values provided in the `.npy` file (e.g., using a logarithmic scale if the connectivity density is high).