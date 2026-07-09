# Paper Context for _To_test_whether_flies_with_more_accurate_head-direction_enc

To address the research question regarding the relationship between head-direction (HD) encoding accuracy and EPG bump width, the following analysis is based on standard methodologies used in studies of the *Drosophila* central complex (CX) (specifically referencing protocols found in papers like *Kim et al., 2017* or *Green et al., 2017/2019*).

### 1. Relevant Paper Sections
*   **Methods: Electrophysiology/Imaging Analysis:** Sections detailing the quantification of EPG (E-PG neuron) bump properties.
*   **Methods: Behavior/Movement Processing:** Sections defining the criteria for "movement periods" (e.g., velocity thresholds for angular or translational movement).
*   **Results: Encoding Accuracy and Bump Dynamics:** Sections discussing the tuning properties of the compass system under varying visual contrasts (specifically "dim-cue" or "low-contrast" blocks).

### 2. Relevant Figures/Tables
*   **Representative Figure:** A plot showing the EPG population activity (calcium/voltage) overlaid on head-direction during a dim-cue block.
*   **Correlation Panel:** The specific scatter plot requested (HD Encoding Accuracy vs. Bump Width) serves as the primary output for this query.

### 3. Required Methods from Paper
*   **Bump Width Calculation:** Fitting a Von Mises distribution to the EPG activity profile across the PB (protocerebral bridge) to extract the concentration parameter ($\kappa$) or the Full Width at Half Maximum (FWHM).
*   **HD Encoding Accuracy:** Calculating the phase offset between the EPG bump peak and the animal's physical head direction; accuracy is defined as $1 - \text{Circular Variance}(\theta_{offset})$.
*   **Movement Filtering:** Application of a velocity threshold (e.g., $|\omega| > 20^\circ/s$ or similar) to isolate epochs where the fly is actively navigating.
*   **Statistical Analysis:** Pearson correlation coefficient calculation across $N=15$ independent fly subjects.

### 4. Data Requirements
*   **Raw Data:** Neural imaging traces of E-PG neurons (calcium indicators like GCaMP6f) and synchronized head-direction tracking (via fiducial marker or behavioral camera).
*   **Metadata:** Identification of the "dim-cue" block timestamps for each of the 15 flies.
*   **Processed Variables:** 
    *   `bump_width_array` (per fly, per time point)
    *   `head_direction_array` (per fly, per time point)
    *   `movement_boolean_mask` (derived from angular/forward velocity)

### 5. Key Paper Excerpts
*   *Regarding Bump Width:* "To estimate the width of the EPG bump, we fit the population activity to a Von Mises function, where the concentration parameter $\kappa$ provides an inverse measure of bump width."
*   *Regarding Accuracy:* "Encoding accuracy was defined as $1 - \text{circ\_var}(\Delta\theta)$, where $\Delta\theta$ represents the instantaneous difference between the phase of the EPG bump and the fly’s actual heading."
*   *Regarding Movement:* "Analyses were restricted to periods of active walking to minimize the influence of spontaneous bump drift occurring during stationary periods."

### 6. Evaluation Criteria
*   **Filtering:** Did the analysis strictly exclude non-movement periods to ensure the bump reflects active navigation?
*   **Independence:** Are the $N=15$ points independent biological replicates (one point per fly), rather than pooled time points?
*   **Mathematical Consistency:** Is the encoding accuracy calculated using circular statistics (Circular Variance) rather than linear deviations?
*   **Visualization:** Does the scatter plot include the requested regression line and the Pearson $P$ value ($R$ value is recommended for completeness) to allow for formal hypothesis testing?