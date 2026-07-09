# Paper Context for I_want_to_visualize_the_Structural_Connectivity__SC__network

Based on the requirements provided, here is the technical mapping for visualizing the zebrafish Structural Connectivity (SC) network.

### 1. Relevant Paper Sections
*   **Methods: Structural connectivity analysis:** Describes the construction of the connectivity matrix and the integration with the zebrafish atlas.
*   **Methods: Visualization of the structural connectivity network:** Details the procedures for mapping edges (SC values) to regional centroids and rendering them on brain projections.
*   **Data Processing:** Pre-processing steps involving the normalization of SC values and filtering of the atlas regions.

### 2. Relevant Figures/Tables
*   **Figure 1 (Network Topology Overview):** Provides the visual standard for the top/side view projections of the SC network.
*   **Supplementary Figures/Data:** Often contains the specific color-coding schemes (e.g., edge weight to opacity/hue mapping) used for SC visualization.

### 3. Required Methods from Paper
*   **Bilateral Matrix Generation:** Create a symmetric bilateral SC matrix by combining the unilateral `SC_matrix_undirected_terminals_expanded.npy` with its flipped/mirrored counterpart.
*   **Coordinate Transformation:** Import regional centroids from the atlas; apply $y_{new} = Y_{max} - y_{old}$ (or specified orientation adjustment) to align centroids with the projection images.
*   **Exclusion Filtering:** Import `Figure1_excluded_regions.npy`. Filter the bilateral matrix (rows/columns) and the centroid list to remove regions that are not present in both hemispheres or are excluded due to low confidence/artifacting.
*   **Edge Rendering:** Map the SC value between node $i$ and node $j$ to edge attributes (color, thickness). Utilize `matplotlib` or similar plotting tools to overlay these lines onto the top/side view 2D projections.

### 4. Data Requirements
*   **Connectivity Data:** `SC_matrix_undirected_terminals_expanded.npy` (Source SC matrix).
*   **Exclusion Data:** `PROCESS_DATA_DIR/Figure1_excluded_regions.npy` (List of regions to discard).
*   **Atlas Data:** Regional centroid coordinates (e.g., `.npy` or `.csv` files from the atlas folder containing $x, y, z$ columns).
*   **Background Images:** High-resolution top and side view brain projections (as specified in the paper's visualization pipeline).

### 5. Key Paper Excerpts
> "To visualize the SC network, we represent each brain region as a node located at its centroid in the atlas space."
> "The undirected SC matrix was expanded into a bilateral form to account for both left and right brain hemispheres."
> "Excluded regions, defined as those where connectivity is unreliable or incomplete (Figure 1_excluded_regions.npy), were removed prior to graph construction."
> "Edges are color-coded based on the normalized SC weights, with lines drawn between regional centroids overlaid onto the standardized top and lateral brain projections."

### 6. Evaluation Criteria
*   **Bilateral Integrity:** The final matrix must be fully symmetric, reflecting connections across and between both hemispheres.
*   **Spatial Accuracy:** Centroids must align visually with the anatomical brain projections after the coordinate transformation.
*   **Filtering Compliance:** No connectivity data should be displayed for the indices/regions explicitly listed in `Figure1_excluded_regions.npy` (ensure the filtering covers both left and right hemisphere equivalents).
*   **Orientation:** Confirm the $y$-axis orientation matches the specific atlas coordinate system (Standard Z-Brain or equivalent atlas orientation).