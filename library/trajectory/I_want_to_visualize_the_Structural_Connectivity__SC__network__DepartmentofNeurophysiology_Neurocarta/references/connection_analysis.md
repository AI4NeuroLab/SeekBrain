# Paper-Repo Connection Analysis for I_want_to_visualize_the_Structural_Connectivity__SC__network

Based on the provided research context and repository information, here is the analysis of the connection between the requested task and the available software tools.

---

### 1. Paper-to-Code Mapping
*   **Bilateral Matrix Generation:** The paper requires expanding a unilateral matrix. The repository function `loadmap` explicitly handles the creation of a "bilateral adjacency matrix," fulfilling the requirement to synthesize cross-hemispheric connectivity.
*   **Visualization/Rendering:** The paper mentions overlaying edges on brain projections. The repository contains a specific folder `Paper figures/Interactive figure/`, suggesting that the visualization logic (though perhaps web-based) is coupled with the network generation scripts.
*   **Filtering:** The paper requires filtering based on `Figure1_excluded_regions.npy`. The repository includes a `filtermap` function designed specifically to remove nodes or weak connections from the adjacency matrix.

### 2. Code-to-Paper Mapping
*   **Neurocarta Toolbox:** Functions like `loadmap` and `filtermap` serve as the technical engine for the paper’s connectivity analysis.
*   **`Paper figures/`:** This directory maps directly to the requirement of reproducing figures (e.g., the visual overlay of the SC network).
*   **Workflow:** The repository's `startup.m` and `build_database.m` establish the environment for the connectivity analysis described in the methods section.

### 3. Gap Analysis
*   **Species Mismatch:** The repository `Neurocarta` is explicitly built for the **Allen Mouse Brain Connectivity Atlas**, while your question pertains to a **Zebrafish brain atlas**. The internal file paths (`PROCESS_DATA_DIR`) and atlas-specific centroid coordinate systems are not natively supported by the Neurocarta codebase.
*   **Coordinate Orientation:** The requirement to adjust y-coordinates ($y_{new} = Y_{max} - y_{old}$) is a specific geometric transformation absent in the standard `Neurocarta` pipeline, which assumes Allen Mouse Atlas coordinate standards.
*   **Missing Data Files:** The repository assumes a connection to the AMBCA web API. It lacks the specific local files mentioned in your question: `SC_matrix_undirected_terminals_expanded.npy` and `Figure1_excluded_regions.npy`.

### 4. Reproduction Strategy
1.  **Environment Setup:** Run `startup` in the repository to initialize the path.
2.  **Custom Data Integration:** Replace the AMBCA loading logic in `loadmap` with a custom loader for your `.npy` files.
3.  **Bilateral Transformation:** Write a wrapper function:
    *   Load unilateral matrix.
    *   Mirror it to create a bilateral matrix (concatenating sub-matrices for L-L, L-R, R-L, R-R connections).
4.  **Filtering:** Use the `filtermap` logic as a template to apply the mask from `Figure1_excluded_regions.npy`.
5.  **Coordinate Alignment:** Create a custom script to import centroid CSVs and apply the transformation:
    ```matlab
    centroids(:, 2) = Y_max - centroids(:, 2); % Y-axis flip
    ```
6.  **Rendering:** Use the logic found in the `Interactive figure` folder to render the connections, substituting the mouse background image with the zebrafish projection image.

### 5. Key Insights
*   **Tooling vs. Content:** The `Neurocarta` repository provides the *graph-theoretical framework* (matrix generation, filtering, and node management), but not the *Zebrafish-specific content*.
*   **Extensibility:** Because `Neurocarta` is modular, it is highly suitable for your task. You do not need to rewrite the graph-processing logic; you only need to override the data ingestion and coordinate system mapping functions.
*   **Bilateral Logic:** The `loadmap` documentation confirms that the repository handles "bilateral adjacency matrices" natively, which is the most difficult algorithmic step in your request; reusing this existing function will ensure your bilateral expansion is topologically consistent with standard connectivity analysis.