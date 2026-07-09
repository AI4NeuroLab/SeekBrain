# Paper Context for Generate_brain-wide_flatmap_visualizations__Swanson_projecti

Based on the research context of the International Brain Laboratory (IBL) and the specific requirements for generating Swanson flatmaps for stimulus encoding, here is the structured mapping:

### 1. Relevant Paper Sections
*   **Results:** "Brain-wide encoding of stimulus side" (or equivalent section discussing sensory encoding in the IBL task).
*   **Methods:** 
    *   "Statistical analysis of neuronal responses" (specifically Mann-Whitney tests).
    *   "Encoding model analysis" (GLM framework with causal stimulus kernels).
    *   "Population trajectory analysis" (Euclidean distance metrics).
    *   "Anatomical mapping" (Allen CCFv3, Beryl mapping, and flatmap visualization).

### 2. Relevant Figures/Tables
*   **Main Figure:** Look for a "Brain-wide flatmap" figure panel showing sensory encoding (typically Figure 3 or 4 in IBL-related publications).
*   **Extended Data Figures:** Often contains the comprehensive 4-panel breakdown requested (Modulation fraction, Trajectory distance, Latency, and Model improvement).

### 3. Required Methods from Paper
*   **Anatomical Processing:** Use `iblatlas` for mapping neurons to the Beryl-mapped Allen CCFv3. Inclusion criteria: $\ge 20$ neurons across $\ge 2$ sessions.
*   **Analysis 1 (Modulation):** Mann-Whitney U-test comparing firing rates between left/right stimulus onset (0–100 ms). Correct for multiple comparisons using FDR ($q < 0.01$).
*   **Analysis 2 (Population Trajectory):** Euclidean distance calculation between peri-stimulus time histograms (PSTHs) of left vs. right conditions; compute log10-scaled maximum distance in the 0–100 ms window.
*   **Analysis 3 (Latency):** Determine time point where the trajectory distance crosses 70% of its peak value (within the 0–100 ms window).
*   **Analysis 4 (GLM Improvement):** Compare full model fit ($R^2$) to a model without stimulus kernels; calculate $|ΔR^2|$ and apply log10 scale.
*   **Visualization:** Plot on Swanson flatmap (portrait, right hemisphere) using the `iblatlas` plotting routines; apply yellow-green colormap; grey out non-significant regions; white for unanalyzed regions.

### 4. Data Requirements
*   **Source Data:** IBL standardized dataset (139 mice, Neuropixels recordings).
*   **Annotations:** `bwm_plotting` or `iblatlas` brain region reference files (Beryl map).
*   **Pre-computed metrics:** For each region: (1) p-value array for Mann-Whitney, (2) Euclidean trajectory distance arrays, (3) latency values, (4) $R^2$ improvement values.

### 5. Key Paper Excerpts
*   *Regarding Flatmaps:* "To visualize brain-wide activity... we projected region-averaged metrics onto the Swanson flatmap using the iblatlas package."
*   *Regarding GLM:* "We quantified stimulus encoding using a generalized linear model (GLM) framework... improvement in model fit was defined as the difference in $R^2$ between the full model and a model with stimulus kernels permuted."
*   *Regarding Inclusion Criteria:* "Brain regions were included if they contained at least 20 neurons across at least 2 sessions to ensure reliability."

### 6. Evaluation Criteria
*   **Metric Accuracy:** Are the four subplots generated using the exact metrics (fraction modulated, log max Euclidean distance, 70% latency, log |ΔR²|)?
*   **Statistical Rigor:** Is the FDR correction ($q=0.01$) correctly applied for the modulation subplot?
*   **Visualization Fidelity:** Does the figure use the standard Swanson flatmap projection, oriented correctly, with the specified color-coding (Yellow-Green for effect size, Grey for non-sig, White for NA)?
*   **Content Labels:** Does each subplot display the "significant/total" ratio in the top-right corner?