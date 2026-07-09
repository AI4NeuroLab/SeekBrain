# Paper Context for _To_test_whether_flies_with_more_accurate_head-direction_enc

Based on the provided research question and the standard structure of the paper (likely pertaining to *Drosophila* neural navigation and EPG bump dynamics), here is the detailed breakdown to execute this analysis.

---

### 1. Relevant Paper Sections
*   **Results:** Sections describing "Head-Direction Encoding Accuracy" and "EPG Bump Width Dynamics."
*   **Methods:**
    *   *Imaging/Electrophysiology Processing:* Methods for extracting EPG calcium activity and defining the EPG bump phase/width.
    *   *Behavioral Analysis:* Methods for defining "movement periods" (e.g., velocity thresholds).
    *   *Statistical Analysis:* Methods for circular statistics and Pearson correlation.

### 2. Relevant Figures/Tables
*   **Primary Figure:** Look for panels showing EPG bump characteristics in low-contrast (dim) visual conditions.
*   **Target Output:** A new scatter plot (per instructions) correlating `(1 - circular_variance)` of the bump phase offset vs. `mean_bump_width`.

### 3. Required Methods from Paper
*   **Bump Phase Extraction:** Use a Gaussian fit or population vector method to extract the phase ($\phi$) of the EPG bump from the calcium signal ($R_{EPG}$).
*   **Movement Filtering:** Apply a threshold to fly rotational/translational velocity (e.g., $v > v_{thresh}$) to isolate "movement periods."
*   **HD Encoding Accuracy Calculation:** 
    *   Calculate the offset $\Delta \theta = \phi_{EPG} - \theta_{HD}$.
    *   Accuracy $= 1 - \text{CircularVariance}(\Delta \theta)$.
*   **Bump Width Calculation:** Defined as the standard deviation ($\sigma$) or full-width at half-maximum (FWHM) of the EPG bump fit.
*   **Statistical Correlation:** Perform a Pearson correlation ($r$) and generate a p-value for the across-fly population ($N=15$).

### 4. Data Requirements
*   **Input Data:** 
    *   Raw calcium imaging time series of EPG neurons (e.g., *R58G05-GAL4*).
    *   Synchronized behavioral tracking data (fly heading $\theta_{HD}$).
*   **Metadata:** 
    *   Identify the specific "dim-cue" block (first instance).
    *   Flagging for "movement periods" for all 15 flies.
*   **Outputs:** 
    *   CSV/Dataframe containing: `fly_ID`, `encoding_accuracy`, `mean_bump_width`.
    *   Regression summary (slope, intercept, $R^2$, $P$).

### 5. Key Paper Excerpts
*(Based on typical language in this domain)*
*   *"To quantify the precision of the HD representation, we calculated the circular variance of the difference between the EPG bump phase and the fly's head direction during movement..."*
*   *"Bump width was determined by fitting a von Mises distribution to the activity of EPG neurons at each time point..."*
*   *"We restricted our analysis to epochs where the fly was actively walking to minimize noise from spontaneous activity..."*

### 6. Evaluation Criteria
*   **Metric 1 (Accuracy):** Correct implementation of the circular variance calculation ($1 - \text{circ\_var}$).
*   **Metric 2 (Data Integrity):** Ensure only "movement periods" are included (check velocity threshold adherence).
*   **Metric 3 (Statistical Rigor):** Pearson correlation must use the $N=15$ fly-averaged points, not time-point data points.
*   **Metric 4 (Visualization):** The generated plot must include the regression line and the annotated $P$-value as requested.