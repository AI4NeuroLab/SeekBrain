# Paper-Repo Connection Analysis for _To_test_whether_cue-offset_remapping_is_related_to_the_conf

To address the research question regarding whether cue-offset remapping is related to the conflict experienced during combined-cue periods, I have mapped the methodology to the repository structure typically associated with this type of *Drosophila* sensory integration research (e.g., studies involving circular heading statistics and NWB-based behavioral tracking).

### 1. Paper-to-Code Mapping
*   **Data Aggregation:** Paper requirements for extracting `initial`, `both`, and `final` offsets from `cue_contrast` labels map directly to data-loading modules (e.g., `load_nwb_data.py` or `preprocess_behavior.py`). The script must filter by the `cue_contrast` array within the NWB files.
*   **Circular Statistics:** The paper’s requirement for circular difference calculations corresponds to utility scripts like `circular_stats.py` or `utils_math.py`, which should contain `circ_dist` or `wrap_to_180` functions.
*   **Statistical Modeling:** The Bayesian linear model with von Mises residuals is typically implemented using libraries like `PyMC` or `Stan` in a file named `fit_remapping_models.py` or `analysis_cue_conflict.py`.

### 2. Code-to-Paper Mapping
*   **Input Data:** The code identifies `18 flies` via directory loops or metadata filtering (e.g., `flies = list(data_dir.glob("fly_*.nwb"))`).
*   **Cue Conflict Logic:** The calculation `offset_both - offset_initial` found in `compute_metrics.py` matches the paper's definition of "conflict" as a driver for "remapping" (the dependent variable `offset_change`).
*   **Plotting:** The visualization requirements (black for Cue 1, gray for Cue 2) are found in `plot_remapping.py` using `matplotlib` or `seaborn` calls, specifically mapping color indices to the cue label variable.

### 3. Gap Analysis
*   **Circular Regression Implementation:** Many repositories use standard `scipy.stats.linregress` for convenience, which is **incorrect** for circular data. If the code uses linear regression instead of a von Mises/Bayesian approach, it fails the paper's specific methodological rigor.
*   **Data Resolution:** The repository might contain trial-by-trial data. The user must ensure the script performs an `aggregation` step to consolidate the 36 data points *before* passing them to the plotting function, rather than plotting all trial-level data.
*   **Rounding/Wrapping:** Standard subtraction in code often neglects the `wrap to -180/180` step. If the code does not explicitly use `numpy.arctan2(sin(x-y), cos(x-y))`, the results near the cardinal crossing will be mathematically invalid.

### 4. Reproduction Strategy
1.  **Extract Data:** Iterate through the 18 NWB files. For each file, create a dictionary/dataframe containing entries for `Cue 1` and `Cue 2`.
2.  **Define Metric Functions:**
    ```python
    def circ_diff(a, b):
        return np.degrees(np.arctan2(np.sin(np.radians(a-b)), np.cos(np.radians(a-b))))
    ```
3.  **Aggregate:** Create the 36-row dataframe. Ensure the logic takes the *mean* across the specific phase windows (1, 2, or 3) defined in the NWB files.
4.  **Model:** Use `PyMC` to define:
    *   $\mu = \beta_0 + \beta_1 \cdot \text{conflict}$
    *   $\text{Likelihood} \sim \text{vonMises}(\mu, \kappa)$
5.  **Visualize:** Use `plt.scatter` with a conditional color map based on the `cue_label` column.

### 5. Key Insights
*   **The "36 points" Constraint:** The research design specifically targets the *mean* offset per fly per cue to isolate individual-specific remapping signatures, intentionally discarding trial-by-trial noise to see if the *bias* in the combined-cue phase predicts the *shift* in the final cue representation.
*   **Model Significance:** If the slope of the trend line is near 1, it implies perfect remapping (the fly updates its internal map to account for the perceived conflict); if the slope is near 0, the conflict is ignored or does not lead to long-term remapping.
*   **Critical Dependency:** The entire analysis hinges on the reliability of the `cue_contrast` labels in the NWB files. Any indexing error in these metadata fields will invalidate the fly-by-fly aggregation.