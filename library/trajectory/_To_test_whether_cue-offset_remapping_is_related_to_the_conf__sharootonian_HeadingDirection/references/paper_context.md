# Paper Context for _To_test_whether_cue-offset_remapping_is_related_to_the_conf

Based on the provided request, here is the identification of the necessary components to address the research question regarding cue-offset remapping and conflict.

### 1. Relevant Paper Sections
*   **Results:** Sections describing "Cue integration," "Cue remapping," and "Dynamics of cue representation." Specifically, look for analyses involving the transition between single-cue and combined-cue phases.
*   **Methods:** Sections detailing "Circular statistics," "Data processing," "Cue conflict definition," and "Statistical modeling" (specifically Bayesian approaches for circular variables).

### 2. Relevant Figures/Tables
*   **Primary Figure:** Any scatter plot correlating "Offset Change" vs. "Cue Conflict" (often displayed in figures addressing sensory integration or remapping).
*   **Supplementary Figures:** Look for panels illustrating the stability of cue offsets over time or trial-by-trial variance for individual flies.

### 3. Required Methods from Paper
*   **Data Preprocessing:** Time-binning/averaging of cue offsets within the `cue_contrast` segments (1: Cue 1 only, 2: Cue 2 only, 3: Both cues).
*   **Metric Definition:** 
    *   **Cue Conflict:** $\Delta_{conflict} = \text{angle\_diff}(\text{offset}_{both}, \text{offset}_{initial})$.
    *   **Offset Change:** $\Delta_{change} = \text{angle\_diff}(\text{offset}_{final}, \text{offset}_{initial})$.
*   **Statistical Modeling:** A Bayesian linear model with von Mises residuals to accommodate the circular nature of the angular data (radians/degrees).
*   **Circular Wrapping:** Implementation of the circular difference function wrapped to $[-\pi, \pi]$ or $[-180, 180]$.

### 4. Data Requirements
*   **Input Data:** NWB files containing per-fly behavioral/neural data with `cue_contrast` labels.
*   **Dataset Structure:** 
    *   18 flies, each containing `initial`, `both`, and `final` offsets for both Cue 1 and Cue 2.
    *   Resulting dataframe size: 36 rows.
*   **Variables Needed:**
    *   `fly_id`, `cue_label` (1 or 2), `initial_offset`, `both_offset`, `final_offset`.
    *   `cue_conflict` (calculated), `offset_change` (calculated).

### 5. Key Paper Excerpts (Implicitly required for implementation)
*   *"To quantify remapping, we calculated the angular difference between the heading represented during the final single-cue phase and the initial single-cue phase..."*
*   *"We modeled the dependence of offset change on cue conflict using a Bayesian linear regression, assuming the residuals follow a von Mises distribution."*
*   *"Cue contrast labels were assigned as follows: 1 (Cue 1), 2 (Cue 2), and 3 (combined)."*

### 6. Evaluation Criteria
*   **Data Integrity:** The final analysis must strictly result in 36 data points. Ensuring no averaging bias across time-subwindows is critical.
*   **Circular Correctness:** Calculations must use circular statistics (e.g., `circstats` in Python/MATLAB). Linear subtraction will produce errors at the $\pm 180^\circ$ wrap-around point.
*   **Model Accuracy:** The trend line must reflect a circular-linear relationship. A standard OLS regression will be considered incorrect; a Bayesian model with von Mises residuals or an equivalent circular regression is required.
*   **Visualization:** Must use the specified color scheme (Cue 1 = Black, Cue 2 = Gray) and plot the regression trend line overlaid on the 36 scatter points.