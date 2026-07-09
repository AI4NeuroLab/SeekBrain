# Paper Context for Generate_brain-wide_flatmap_visualizations__Swanson_projecti

This analysis is based on the IBL (International Brain Laboratory) study: *"The neurobiology of task-based decision-making"* (specifically the 2024 *Cell* paper "An international collaboration to build a neuroscience resource for the 21st century" / "The IBL brain-wide map").

### 1. Relevant Paper Sections
*   **Results:** "Brain-wide encoding of stimulus-related information."
*   **Methods:** "Neural data processing," "Encoding models," "Brain-wide flatmaps," and "Population trajectory analysis."
*   **Computational Framework:** "Allen CCFv3 and Beryl mapping."

### 2. Relevant Figures/Tables
*   **Figure 4/5 (or equivalent in the IBL Atlas/Brain-wide map paper):** The visual stimulus encoding brain-wide flatmap panels.
*   **Supplementary Figures:** Flatmap visualizations detailing the encoding model performance (|ΔR²|) and latency metrics.

### 3. Required Methods from Paper
*   **Brain Mapping:** Use the `iblatlas` Python package to map recording sites to the Allen CCFv3 (Beryl-mapped) atlas.
*   **Neuron Inclusion Criteria:** Filter for regions with $\geq 20$ neurons and $\geq 2$ recording sessions.
*   **Encoding Analysis:** 
    *   **Mann-Whitney Test:** Compare firing rates between left vs. right stimuli (0–100 ms).
    *   **Trajectory Analysis:** Calculate Euclidean distance between stimulus conditions in the neural state space, log10-scaled.
    *   **Latency Calculation:** Determine the time point reaching 70% of peak trajectory distance.
    *   **Encoding Model:** GLM-based causal kernels; calculate $|\Delta R^2|$ (Full model vs. model excluding stimulus kernels).
*   **Visualization:** Utilize `iblatlas.plots.plot_swanson_vector` in portrait orientation (right hemisphere).

### 4. Data Requirements
*   **IBL Data Release:** "Brain-wide map" (Neuropixels recordings from 139 mice).
*   **Atlas:** `iblatlas` Beryl-mapped CCFv3.
*   **Preprocessing:** Spike times/sorting (e.g., Kilosort/KS2.5/KS3) and stimulus onset alignment.

### 5. Key Paper Excerpts
*   *"We assigned all neurons to brain regions using the Beryl mapping of the Allen CCFv3 atlas. Regions were included only if they contained at least 20 neurons across at least 2 sessions."*
*   *"Visual stimulus encoding was assessed using a GLM-based encoding model where stimulus kernels were omitted to compute $\Delta R^2$."*
*   *"Flatmaps were generated using the Swanson projection implementation in the iblatlas package, with color scales representing effect sizes and gray indicating non-significance (FDR $q < 0.01$)."*

### 6. Evaluation Criteria
*   **Spatial Consistency:** Does the flatmap orientation match the specified Swanson/portrait/right-hemisphere requirement?
*   **Statistical Thresholding:** Are regions correctly masked (Gray = $q \geq 0.01$; White = No data)?
*   **Metric Accuracy:** Are the four subplots accurately labeled with the required ratio (Significant/Total) in the upper right?
*   **Temporal Precision:** Ensure the time-window for trajectory and Mann-Whitney calculations is strictly 0–100 ms post-stimulus.
*   **Color Scale:** Is the yellow-green colormap (e.g., `viridis` or `YlGn`) consistently applied to reflect effect size across all four metrics?