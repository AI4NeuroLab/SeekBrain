# Paper Context for _To_test_whether_cue-offset_remapping_is_related_to_the_conf

To address the relationship between cue-offset remapping and cue conflict, the following analysis is based on the provided framework for processing behavioral neurophysiology data (typically associated with studies like *Hardi et al.* or similar fly navigation/integration papers).

### 1. Relevant Paper Sections
*   **Results: "Cue integration and remapping"**: This section typically describes the persistence of cue offsets after a conflict period.
*   **Methods: "Data Analysis"**: Specifically, sections detailing "Cue offset calculation," "Conflict metrics," and "Circular statistics."
*   **Methods: "Statistical Modeling"**: Sections describing the use of linear models with von Mises residuals or Bayesian circular regression for behavioral data.

### 2. Relevant Figures/Tables
*   **Figure: "Cue Conflict vs. Remapping/Offset Change"**: Look for a scatter plot showing the relationship between the shift in cue representation (remapping) and the preceding conflict magnitude.
*   **Supplementary Data**: Potentially a table containing individual fly parameters or indices of cue offsets per phase.

### 3. Required Methods from Paper
*   **Offset Extraction**: Calculation of the circular mean heading/cue offset per experimental block.
*   **Conflict Calculation**: $\text{Conflict} = \text{angle\_diff}(\text{offset}_{\text{both}}, \text{offset}_{\text{initial}})$.
*   **Remapping Metric**: $\text{Change} = \text{angle\_diff}(\text{offset}_{\text{final}}, \text{offset}_{\text{initial}})$.
*   **Statistical Fitting**: Use of a Bayesian linear model (or a circular-linear regression) where the response variable (offset change) is modeled against the predictor (cue conflict) assuming a von Mises distribution for circular residuals.
*   **Circular Wrapping**: Function to enforce the $[-\pi, \pi]$ or $[-180^\circ, 180^\circ]$ range.

### 4. Data Requirements
*   **NWB Files**: Access to `18 flies` worth of behavioral logs.
*   **Labels**:
    *   `cue_contrast == 1`: Cue 1 (Single)
    *   `cue_contrast == 2`: Cue 2 (Single)
    *   `cue_contrast == 3`: Both Cues (Conflict Phase)
*   **Data Aggregation**: 
    *   Extract offsets for each fly/cue combination.
    *   **Variables needed**: `FlyID`, `CueType` (1 or 2), `InitialOffset` (from first single-cue phase), `BothOffset` (from contrast=3), `FinalOffset` (from last single-cue phase).
    *   **Derived Data**: `Conflict` (signed circular diff) and `Change` (signed circular diff).

### 5. Key Paper Excerpts (General Context)
*   *"To determine whether cue-offset remapping is a consequence of conflict, we analyzed the change in cue representation as a function of the conflict experienced..."*
*   *"For each fly, we defined conflict as the circular difference between the heading during the combined-cue epoch and the initial baseline..."*
*   *"Circular-linear relationships were modeled using Bayesian inference assuming von Mises distributed errors to account for the periodic nature of angular data."*

### 6. Evaluation Criteria
1.  **Data Integrity**: Did you successfully filter the NWB file to extract exactly 36 points (18 flies × 2 cues)?
2.  **Circular Consistency**: Is the `angle_diff` calculated using a function that correctly handles the wrap-around at 180/-180 degrees (e.g., `atan2(sin(a-b), cos(a-b))`)?
3.  **Visualization**: Are Cue 1 points distinctly marked in black and Cue 2 in gray?
4.  **Model Validity**: Is the slope of the regression statistically significant, or does the Bayesian credible interval for the slope exclude zero?
5.  **Output**: Did you save the processed `DataFrame` (fly/cue/initial/both/final/conflict/change) and the model fit objects?