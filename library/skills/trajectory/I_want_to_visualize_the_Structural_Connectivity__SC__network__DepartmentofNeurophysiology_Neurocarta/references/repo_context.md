# Repository Context for I_want_to_visualize_the_Structural_Connectivity__SC__network

Based on the analysis of the Neurocarta repository and the research requirements provided, here is the identification of files and logic necessary to fulfill your request for Structural Connectivity (SC) visualization on a zebrafish atlas.

### 1. Relevant Files (Ranked by Relevance)

| File Path | Relevance | Priority |
| :--- | :--- | :--- |
| `Paper figures/Code/[figure_function_files]` | Primary logic for network plotting and centroid mapping. | **HIGH** |
| `loadmap` / `generatemaps` (functions) | Handles bilateral matrix construction and exclusion filtering. | **HIGH** |
| `startup.m` | Necessary to load the required paths and library dependencies. | **MEDIUM** |
| `Documentation/Documentation.md` | Provides technical syntax for `loadmap` and data structures. | **LOW** |

### 2. Code Execution Order
To visualize the SC network as specified, the following logical execution pipeline is required:
1.  **Initialize:** Run `startup.m` to set paths for the `Neurocarta` library.
2.  **Filter:** Load `SC_matrix_undirected_terminals_expanded.npy` and `Figure1_excluded_regions.npy`. Apply exclusion masks to both the regional centroid coordinate array and the adjacency matrix.
3.  **Bilateral Generation:** Call a utility function (modeled after `generatemaps`) to duplicate the unilateral matrix and create a symmetric bilateral connectivity matrix.
4.  **Coordinate Transform:** Implement the coordinate mapping logic: $y_{new} = Y_{max} - y_{old}$ within the figure generation script to align the atlas centroids with the projection images.
5.  **Render:** Utilize `matplotlib` (or MATLAB plot functions) to iterate through the bilateral matrix; draw edges between centroids $i$ and $j$ where $SC_{ij} > threshold$, using the SC value to define line properties (color/opacity).

### 3. Key Code Patterns
*   **Bilateral Expansion:** Use block matrix manipulation where $M_{bilateral} = [M_{uni}, M_{flipped}; M_{flipped}, M_{uni}]$ to ensure hemispheric connectivity is captured.
*   **Vectorized Filtering:** Use logical indexing: `matrix(excluded_indices, :) = []` and `matrix(:, excluded_indices) = []` to prune the network.
*   **Mapping:** Use colormaps (e.g., `jet` or `parula` in MATLAB) to normalize the range of SC weights to [0, 1] for visual line coloring.
*   **Transformation:** Apply the coordinate flip globally to the centroid array before plotting to ensure consistent overlay onto the background images.

### 4. Data Files Referenced
*   **`SC_matrix_undirected_terminals_expanded.npy`**: The base weight input.
*   **`PROCESS_DATA_DIR/Figure1_excluded_regions.npy`**: The filter list.
*   **Atlas Coordinate Data**: `[Atlas_Folder]/regional_centroids.npy` (or equivalent structure containing x,y,z coordinates).
*   **Backgrounds**: Top/side projection TIFF or PNG files.

### 5. Missing Pieces
*   **Zebrafish Atlas Context:** The Neurocarta repository is specialized for the *Allen Mouse Brain Connectivity Atlas*. The codebase assumes mouse-specific structures (e.g., specific metadata hierarchies in the `Structures/` folder). You will need to manually substitute the mouse-based atlas files with the zebrafish atlas files referenced in your requirements.
*   **Orientation Constants:** The specific $Y_{max}$ value required for the coordinate flip is not provided in the current repo; it must be calculated based on the dimensions of the zebrafish projection image used.
*   **Bilateral Mirroring Logic:** Since the code is currently set up for mouse connectivity (which often handles bilateral data differently), the function to flip/mirror the unilateral matrix to generate the bilateral counterpart must be custom-written to ensure the left-right indices match the zebrafish brain atlas order.