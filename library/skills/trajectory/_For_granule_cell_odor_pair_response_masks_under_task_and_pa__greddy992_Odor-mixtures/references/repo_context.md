# Repository Context for _For_granule_cell_odor_pair_response_masks_under_task_and_pa

Based on the provided repository information and the requested analysis of granule cell–odor pair response masks, here is the identification of relevant files and the implementation strategy.

### 1. Relevant Files (Ranked by Relevance)

| File Name | Priority | Role |
| :--- | :--- | :--- |
| **`Quality coding.ipynb`** | **HIGH** | Acts as the primary post-processing and statistical analysis hub for population-level response data. |
| **`Coding model.ipynb`** | **MEDIUM** | Defines the population-level logic for odor pair masking and glomerular response calculations. |
| **`Concentration coding.ipynb`**| **LOW** | Provides the thresholding logic (`norm.ppf` and sparsity calculations) relevant to classifying non-responsive vs. responsive pairs. |

### 2. Code Execution Order
1.  **Data Ingestion**: Import the specified `.npy` files for both task (`ld`, `lc`) and passive (`pd`, `pc`) conditions.
2.  **Preprocessing**: Use `np.load()` to extract the mask arrays. Ensure pooling is performed:
    *   `mask_task_exc = joint_cell_odor_pair_exc_ld + joint_cell_odor_pair_exc_lc` (or `np.logical_or`)
    *   `mask_passive_exc = joint_cell_odor_pair_exc_pd + joint_cell_odor_pair_exc_pc`
    *   ... (repeat for suppressed masks as defined in the request).
3.  **Calculation**: Compute the sum of indices for each condition divided by the total pairs to derive $P_{excited}$, $P_{suppressed}$, and the residual $P_{non\_responsive}$.
4.  **Visualization**: Use `matplotlib.pyplot.pie` to generate side-by-side plots.

### 3. Key Code Patterns
*   **Mask Operations**: The logic relies on binary matrices. Implementation should use:
    ```python
    # Example logic for Task Excited
    exc_task = (np.load('joint_cell_odor_pair_exc_ld.npy') + np.load('joint_cell_odor_pair_exc_lc.npy')) > 0
    exc_percent = (np.sum(exc_task) / total_pairs) * 100
    ```
*   **Normalization**: Calculate `total_pairs` as `shape[0] * shape[1]` of the mask arrays.
*   **Pie Chart generation**:
    ```python
    labels = ['Excited', 'Suppressed', 'Non-responsive']
    sizes = [p_exc, p_sup, p_non]
    plt.pie(sizes, labels=labels, autopct='%1.1f%%')
    ```

### 4. Data Files Referenced
The analysis requires the ingestion of the following `.npy` files (found in the `./Numerics/` directory as implied by the pipeline):
*   **Task Condition**: `joint_cell_odor_pair_exc_ld.npy`, `joint_cell_odor_pair_exc_lc.npy`, `cell_odor_pair_index_pre_ld.npy`, `cell_odor_pair_index_pre_lc.npy`
*   **Passive Condition**: `joint_cell_odor_pair_exc_pd.npy`, `joint_cell_odor_pair_exc_pc.npy`, `joint_cell_odor_pair_sup_pd.npy`, `joint_cell_odor_pair_sup_pc.npy`

### 5. Missing Pieces
*   **Mutual Exclusivity Logic**: The current repository structure focuses on simulating responses; it does *not* explicitly contain a script that cleans overlaps between the "excited" and "suppressed" masks. A custom assertion or cleaning step (e.g., `suppressed[excited == 1] = 0`) must be added to ensure the percentages sum to exactly 100% without double-counting.
*   **Total Pair Definition**: The script needs a constant `N_cells` and `N_odors` value to calculate the "Total Pairs" denominator, which must be verified against the dimensions of the loaded `.npy` arrays.
*   **Plotting Template**: While `Quality coding.ipynb` produces EPS figures, it does not currently have a function dedicated to pie-chart comparison; this visualization will need to be written using standard `matplotlib` routines within a new cell in that notebook.