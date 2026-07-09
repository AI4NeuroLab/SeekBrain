# Repository Context for Generate_brain-wide_flatmap_visualizations__Swanson_projecti

To address your requirement for generating brain-wide Swanson flatmap visualizations of visual stimulus encoding, here is the analysis based on the provided repository (Waven) and the research context.

### 1. Relevant Files (RANKED by relevance)

| File Path | Priority | Reason for Inclusion |
| :--- | :--- | :--- |
| `src/Waven/pipeline.py` | **HIGH** | Orchestrates the analysis workflow; contains the entry points for running models and extracting neural metrics. |
| `src/Waven/Analysis_Utils.py` | **HIGH** | Contains core statistical methods (Pearson correlations, responsiveness metrics) likely used to compute the requested stimulus-side encoding. |
| `examples/example.py` | **MEDIUM** | Serves as the blueprint for integrating and calling the analysis modules. |
| `docs/requirements.txt` | **LOW** | Defines the environment dependencies (`scipy`, `pandas`) required for FDR correction and Mann-Whitney tests. |

***Note:** The current repository (`Waven`) is specialized for **visual cortex receptive field analysis**. It does not contain the `iblatlas` package or the Neuropixels-specific IBL Brain Wide Map (BWM) pipeline files. The required Swanson flatmap visualization logic is specific to the `iblatlas` library, which is a dependency of the IBL research ecosystem, not the `Waven` repository.*

### 2. Code Execution Order
To generate the requested visualizations, you would need to implement an execution flow that interacts with the IBL BWM pipeline (not present in `Waven`). The order would be:
1.  **Data Ingestion**: Load the 139-mouse Neuropixels dataset and filter by Beryl-mapped regions ($\ge 20$ neurons).
2.  **Statistical Analysis (`Analysis_Utils.py` pattern)**: 
    *   Compute the **Mann-Whitney U-tests** for stimulus side (0–100ms) and apply FDR ($q < 0.01$).
    *   Calculate **Euclidean Trajectory Distances** using standard PSTH methods.
    *   Compute **Latencies** using the 70% threshold method.
    *   Calculate **$|ΔR²|$** by comparing the full GLM to the reduced stimulus-kernel-free model.
3.  **Visualization (`iblatlas` pattern)**:
    *   Use `iblatlas.plots.plot_swanson_vector` to map these four pre-computed vectors onto the Swanson flatmap (portrait orientation).
    *   Set the `cmap` to "Yellow-Green" (or equivalent sequential map) and set `mask` for non-significant/unanalyzed regions.
    *   Overlay the "Sig/Total" ratio using `matplotlib` text annotation on each subplot.

### 3. Key Code Patterns
*   **Pipeline Orchestration**: Pattern seen in `pipeline.py` where specific modeling stages are triggered via functional flags.
*   **Statistical Utility**: Implementation of vectorized operations for calculating correlations (as seen in `Analysis_Utils.py`), which would be adapted to calculate the requested trajectory distances.
*   **Config Mapping**: Use of JSON/Config objects to pass region inclusion criteria (e.g., `min_neurons=20`) to the pipeline, mirroring `pipeline.py`'s configuration setup.

### 4. Data Files Referenced
*   **Neuropixels Dataset**: The IBL standardized dataset (Brain-wide Map).
*   **Allen CCFv3**: The atlas files used by `iblatlas` for Beryl mapping.
*   **Waven Config**: `pipeline.py` uses JSON-based configuration which you should adopt to define the 0–100ms stimulus interval.

### 5. Missing Pieces
*   **IBL Dependencies**: The `iblatlas` package is required for the Swanson projection; it is not in the `Waven` repository. You must add `iblatlas` and `brainbox` to your environment.
*   **GLM Infrastructure**: While `pipeline.py` performs modeling, the specific GLM causal kernel framework for the IBL decision-making task is outside the scope of the `Waven` repository and must be imported from the `ibl-neuropixels` analysis codebase.
*   **Mapping Utility**: You lack the specific `bwm_plotting` library which handles the "significant/total" ratio text generation on the subplots automatically. You will need to implement this as a custom `matplotlib` hook.