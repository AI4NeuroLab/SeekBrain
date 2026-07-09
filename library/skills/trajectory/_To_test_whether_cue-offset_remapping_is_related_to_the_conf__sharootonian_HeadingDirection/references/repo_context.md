# Repository Context for _To_test_whether_cue-offset_remapping_is_related_to_the_conf

To address the question regarding whether cue-offset remapping is related to conflict during the combined-cue period, the following structure provides the mapping between your requirements and the repository.

### 1. Relevant Files
| File Path | Priority | Role |
| :--- | :--- | :--- |
| `analysis/remap_conflict_analysis.py` | **HIGH** | Core logic: Calculates circular differences, processes NWB files, and aggregates the 36 data points. |
| `stats/bayesian_circular_model.py` | **HIGH** | Implementation of the Bayesian linear model with von Mises residuals. |
| `plotting/plot_remapping_vs_conflict.py` | **HIGH** | Generates the scatter plot with black/gray coloring and overlays the trend line. |
| `data_loader/nwb_processor.py` | **MEDIUM** | Handles the extraction of `cue_contrast` segments and per-fly indexing. |
| `utils/circular_stats.py` | **MEDIUM** | Contains the `angle_diff` and circular wrapping functions. |

---

### 2. Code Execution Order
1.  **`nwb_processor.py`**: Extract raw offset data. Group by `fly_id` and `cue_contrast`. Calculate mean offsets for `initial`, `both`, and `final` phases.
2.  **`remap_conflict_analysis.py`**:
    *   Iterate through the 18 flies.
    *   Perform circular subtractions: `cue_conflict = wrap(both - initial)` and `offset_change = wrap(final - initial)`.
    *   Construct the final DataFrame (36 rows).
3.  **`bayesian_circular_model.py`**: Fit the model to the resulting 36-point dataset using the circular-linear regression.
4.  **`plot_remapping_vs_conflict.py`**: Generate the visualization using the outputs from the steps above.

---

### 3. Key Code Patterns
*   **Circular Logic**: Look for `np.arctan2(np.sin(a - b), np.cos(a - b))` or libraries like `astropy.stats` or `pingouin` for circular distance to ensure the $-180$ to $180$ range is maintained.
*   **Data Aggregation**: The code should follow a `groupby(['fly_id', 'cue_label'])` pattern to transform raw time-series data into exactly 36 points.
*   **Model Specification**: The Bayesian model should define the likelihood function as a von Mises distribution:
    *   $y_i \sim \text{vonMises}(\mu = \beta_0 + \beta_1 x_i, \kappa)$
    *   The code will likely use `PyMC` or `Stan` to sample the posterior of $\beta_1$.

---

### 4. Data Files Referenced
*   `data/nwb/fly_*.nwb`: 18 files corresponding to the experimental flies.
*   `data/processed/fly_cue_offsets.csv`: The intermediate file containing the 36 data points once processed.

---

### 5. Missing Pieces
*   **Validation of `cue_contrast`**: Ensure the code correctly handles flies that may have incomplete phases. If a fly is missing a `final` cue phase, it must be excluded to maintain the requirement of exactly 36 points.
*   **Hyper-parameter initialization**: If the Bayesian model fails to converge (often due to the small sample size of 36), look for explicit priors on $\kappa$ (concentration parameter) in the `bayesian_circular_model.py` file.
*   **Circular Trend Line**: Ensure the plotting script is not simply drawing an OLS line; it should compute the expected value of the posterior distribution from the Bayesian model and plot it across the circular domain.