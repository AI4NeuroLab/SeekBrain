# Repository Context for _To_test_whether_flies_with_more_accurate_head-direction_enc

Based on the provided research question and the repository content, here is the analysis to execute the requested across-fly correlation analysis.

### 1. Relevant Files (RANKED by relevance)

1.  **`fruit_fly_data_analysis.ipynb` (Priority: HIGH)**: This file contains the primary logic for loading and processing raw Hemibrain/experimental data. It is the best starting point for extracting per-fly EPG data (bump width and phase).
2.  **`connectivity_matrices.py` (Priority: MEDIUM)**: Essential for referencing the anatomical neuron indexing and connectivity grouping to ensure you are selecting the correct EPG neuron populations for your bump extraction.
3.  **`encoding with multiple harmonics.ipynb` (Priority: LOW)**: Useful for understanding the math behind EPG phase decoding, specifically the Gaussian fitting methods required to compute the "bump phase."

---

### 2. Code Execution Order

To perform the analysis, you must modify or extend the existing `fruit_fly_data_analysis.ipynb` workflow:

1.  **Load and Filter Data**: Use the loading logic in `fruit_fly_data_analysis.ipynb` to iterate over the 15 fly datasets.
2.  **Extract Movement Epochs**: Implement a velocity-based threshold ($v > v_{thresh}$) using your behavioral tracking data (synchronized with calcium time series).
3.  **Compute EPG Bump Parameters**: 
    *   For each time point in the "dim-cue" block, fit a von Mises or Gaussian distribution to the population activity.
    *   Extract `bump_phase` ($\phi$) and `bump_width` ($\sigma$).
    *   Retrieve corresponding `head_direction` ($\theta_{HD}$).
4.  **Calculate Per-Fly Metrics**:
    *   Compute $\Delta \theta = \phi - \theta_{HD}$.
    *   Calculate `Accuracy = 1 - CircularVariance(\Delta \theta)`.
    *   Calculate `Mean_Bump_Width = mean(sigma)` across the movement periods.
5.  **Correlate and Plot**: Store these per-fly values in a `pandas.DataFrame`, compute the Pearson correlation using `scipy.stats.pearsonr`, and generate the scatter plot with `matplotlib`.

---

### 3. Key Code Patterns

*   **Circular Statistics**: Use `scipy.stats.circvar` for the accuracy calculation.
    ```python
    import scipy.stats as stats
    # Accuracy calculation
    offset = (epg_phase - head_direction) % (2 * np.pi)
    accuracy = 1 - stats.circvar(offset)
    ```
*   **Data Aggregation**: Store fly-level results in a clean DataFrame:
    ```python
    results_df = pd.DataFrame({'fly_id': fly_ids, 'accuracy': acc_list, 'width': width_list})
    ```
*   **Regression Plotting**:
    ```python
    slope, intercept, r_val, p_val, std_err = stats.linregress(results_df['accuracy'], results_df['width'])
    plt.scatter(results_df['accuracy'], results_df['width'])
    plt.plot(results_df['accuracy'], slope * results_df['accuracy'] + intercept)
    plt.annotate(f'P = {p_val:.3f}', xy=(0.05, 0.95), xycoords='axes fraction')
    ```

---

### 4. Data Files Referenced

*   **`janelia-data/traced-neurons.csv`**: Required to identify specific EPG neuronal instances.
*   **`janelia-data/traced-total-connections.csv`**: Used for mapping connectivity (optional but useful if filtering neurons by type).
*   **Calcium/Behavioral Raw Data**: The repository documentation suggests using `connectivity_matrices.py` for loading structure, but you will need to add custom loaders for your specific `dim-cue` imaging data (likely `.mat` or `.npy` formats as defined in the repository's `connectivity_matrices` subfolder).

---

### 5. Missing Pieces

*   **Imaging Data Path**: The repository currently focuses on connectivity (Hemibrain), not raw calcium imaging time series for the 15 flies. You must ensure your calcium/heading files reside in a local directory matching the structure expected by `fruit_fly_data_analysis.ipynb`.
*   **Velocity Threshold Definition**: The exact threshold $v_{thresh}$ for "movement periods" is not explicitly defined in the notebooks. You will need to define this based on the fly's rotational/translational speed distributions typical for your experimental setup.
*   **Dim-Cue Metadata**: You must manually identify which session/block corresponds to the "first dim-cue (low-contrast) block" within your metadata, as the existing scripts do not auto-parse session experimental conditions.