# Reproduction Plan for _To_test_whether_cue-offset_remapping_is_related_to_the_conf

This reproduction plan outlines the steps required to validate the relationship between cue-offset remapping and cue conflict, bridging the gap between your provided `fastFMM` infrastructure and the necessary circular statistical methodology.

---

### Prerequisites
1.  **Software Environment:** R (v4.0+), `brms` (for Bayesian von Mises regression), `tidyverse` (data manipulation), `circular` (handling angular data), and `ncdf4`/`rhdf5` (for NWB access).
2.  **Dataset:** A directory containing 18 NWB files labeled by unique fly identifiers.
3.  **Dependencies:** Ensure the `fastFMM` repository is cloned locally to leverage its data-loading utility functions (`utils.R`) for NWB parsing.

---

### Step-by-Step Procedure

| Step | Action | Paper Ref | Code Ref | Input | Output | Validation |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **1. Data Extraction** | Extract `offset` per phase (1:5) for each cue (1, 2) from NWB. | Methods: Data Analysis | `utils.R` (load_nwb) | 18 NWB files | `raw_df` (FlyID, Phase, Cue, Offset) | Check 18 flies × 5 phases × 2 cues exist. |
| **2. Scalar Aggregation** | Subset to `initial`, `both`, and `final` per `cue_contrast`. | Methods: Conflict Metrics | Custom script | `raw_df` | `tidy_df` (36 rows) | Verify 36 total points (18 flies × 2 cues). |
| **3. Metric Calculation** | Calculate `Conflict` and `Change` using circular difference. | Methods: Circular Stats | `circular` pkg | `tidy_df` | `calc_df` (with Conflict, Change) | Values must be in range `[-pi, pi]`. |
| **4. Bayesian Modeling** | Fit `Change ~ Conflict + (1\|FlyID)` with `family = von_mises`. | Statistical Modeling | `brms` pkg | `calc_df` | `fit_object` | Convergence (Rhat < 1.1). |
| **5. Visualization** | Plot `Change` vs `Conflict` (scatter). | Results: Remapping | `plot_fui.R` (theme) | `calc_df` + `fit` | `.png` plot | Cue 1 (Black), Cue 2 (Gray). |

---

### Detailed Steps

#### Step 1 & 2: Data Aggregation
*   **Logic:** For each fly, define `initial` offset as the mean of the first occurrence of `cue_contrast == cue_id`. Define `both` as the mean during `cue_contrast == 3`. Define `final` as the mean of the last occurrence of `cue_contrast == cue_id`.
*   **Code Implementation:**
    ```R
    ang_diff <- function(a, b) atan2(sin(a - b), cos(a - b))
    # Apply to 18 flies, extracting phases per paper definitions
    ```

#### Step 3: Circular Metrics
*   **Definition:**
    *   `Conflict` = `ang_diff(offset_both, offset_initial)`
    *   `Change` = `ang_diff(offset_final, offset_initial)`
*   **Parameters:** Ensure inputs are in radians ($[-\pi, \pi]$) before conversion to degrees if needed for plotting.

#### Step 4: Model Fitting
*   **Tool:** Use `brms::brm`.
*   **Formula:** `Change ~ Conflict + (1|FlyID)`
*   **Distribution:** `family = von_mises(link = "identity")` (Requires pre-processing data to radians).
*   **Why:** Unlike the Gaussian `fui` models, `von_mises` accounts for the periodic support of angular error.

#### Step 5: Visualization
*   **Constraint:** Use the visual styling logic from `plot_fui.R` (specifically `theme_classic` and color palettes) to ensure consistency with existing repository outputs.

---

### Expected Output
1.  **Dataset:** `final_data.csv` containing columns: `FlyID`, `CueType`, `Initial`, `Both`, `Final`, `Conflict`, `Change`.
2.  **Model Object:** `remapping_model.rds` (Brms fit object).
3.  **Visual:** `remapping_plot.pdf` showing the regression slope with a shaded 95% Credible Interval.

---

### Troubleshooting
*   **Insufficient Data:** If a fly lacks a specific phase, flag it; the paper requires 18 flies, so missing data points should be addressed via listwise deletion or imputation if the count drops below 18.
*   **Model Non-convergence:** If `brms` struggles with the `von_mises` link, switch to a `circular` package GLM as a diagnostic baseline to verify the relationship exists.
*   **Wrapping Errors:** If `Conflict` or `Change` values exceed the $\pm 180^\circ$ range, ensure the `atan2` wrapping function is correctly applied *after* the subtraction.