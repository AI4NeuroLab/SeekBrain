# Reproduction Plan for Generate_brain-wide_flatmap_visualizations__Swanson_projecti

This reproduction plan provides a roadmap to generate the brain-wide stimulus encoding visualizations using the International Brain Laboratory (IBL) standardized pipeline. 

**Note:** As noted in the Gap Analysis, `Kilosort` is purely for spike detection. The following steps utilize the `ibllib` and `iblatlas` ecosystems, which are the official tools for this specific analysis.

---

### Prerequisites
*   **System Environment:** Python 3.9+ with `ibllib`, `iblatlas`, `numpy`, `scipy`, `pandas`, `one-api`, and `matplotlib`.
*   **Data Access:** An `ONE` API account/local cache (the IBL "Brain-wide map" dataset is ~20TB; focus on the "Brain-wide map" collection).
*   **Expertise:** Proficiency in Python data manipulation (Pandas/Xarray).

---

### Step-by-Step Procedure

| Step | Action | Paper Reference | Code/Tool | Parameters |
| :--- | :--- | :--- | :--- | :--- |
| **1** | **Data Loading** | Methods: "Neural data processing" | `ONE.load_object()` | `collection='alf/recording_site/...'` |
| **2** | **Region Mapping** | "Beryl mapping" | `iblatlas.regions.BrainRegions` | Use `beryl_atlas` |
| **3** | **Inclusion Filter** | ">= 20 neurons/2 sessions" | `pandas.groupby()` | `min_neurons=20, min_sessions=2` |
| **4** | **Stimulus Stats** | "Mann-Whitney test" | `scipy.stats.mannwhitneyu` | Window: 0–100ms; FDR q<0.01 |
| **5** | **Trajectory Calc** | "Trajectory distance" | Custom (Euclidean dist) | Log10-scaled; 0–100ms |
| **6** | **Latency Metric** | "First crossing 70% max" | `numpy.argmax` | Peak > 70% threshold |
| **7** | **Encoding Model** | "GLM |ΔR²|" | `npx-glm-fit` (repo: `ibl-glm`) | Full vs. null kernel |
| **8** | **Visualization** | "Swanson projection" | `iblatlas.plots.plot_swanson` | `orientation='portrait'` |

#### Detailed Execution Steps:
1.  **Retrieve Data:** Use the `ONE` API to pull `spikes`, `clusters`, and `trials` objects for all sessions in the "Brain-wide map" paper.
2.  **Filter/Align:** Map cluster IDs to `Beryl` IDs. Apply the filter: count unique sessions per region and unique neurons per region. 
3.  **Compute Stats:**
    *   **Subplot 1 (Mann-Whitney):** For each region, collect spike counts in the 0–100ms window across trials. Compute `mannwhitneyu` (left vs right stimulus). Apply Benjamini-Hochberg FDR correction ($q < 0.01$).
    *   **Subplot 2 (Trajectory):** Calculate the neural state space vector (population firing rate). Find the Euclidean distance between the mean vectors of the two stimulus conditions across the 0–100ms window.
    *   **Subplot 3 (Latency):** Identify the time bin where the cumulative distance reaches 0.7 $\times$ max distance.
    *   **Subplot 4 (Encoding):** Use the `ibl-glm` repository to compute $\Delta R^2$. Calculate the difference between the full model and the model where the stimulus kernel is dropped.
4.  **Visualize:** Use `iblatlas.plots.plot_swanson_vector`. Pass the dictionary of values for all regions. Set the `cmap='YlGn'` (or consistent green scale).

---

### Expected Output
*   **Four Subplots:** A grid (or column) of Swanson flatmaps showing the right hemisphere in portrait orientation.
*   **Visual Logic:**
    *   **Colors:** Yellow-Green gradient (High value = dark green/saturated; Low = pale yellow).
    *   **Masking:** Regions without data = White; Regions failing FDR $q=0.01$ = Grey.
    *   **Annotation:** A floating text box in the upper right of each subplot displaying the fraction: `(Significant Regions / Total Analyzed Regions)`.

---

### Troubleshooting
*   **Issue: Memory Errors.** The "Brain-wide map" is massive. 
    *   *Solution:* Use `dask` or iterate over sessions rather than loading all raw spike times into RAM. Pre-compute region-wise firing rates.
*   **Issue: Atlas Mismatch.** 
    *   *Solution:* Ensure you are using `iblatlas` version compatible with the Beryl mapping release (check `iblatlas.atlas.AllenAtlas(25)`).
*   **Issue: Missing Regions.**
    *   *Solution:* Verify the "Beryl mapping" is applied; standard CCFv3 includes too many small, noisy sub-regions. The paper specifically uses the Beryl hierarchy for stability.
*   **Issue: Encoding Model Fails.**
    *   *Solution:* The GLM requires binned spiking data. Ensure the `ibl-glm` repo (available on IBL GitHub) is used to perform the kernel regression, as it handles the "causal stimulus kernel" definition specific to IBL tasks.