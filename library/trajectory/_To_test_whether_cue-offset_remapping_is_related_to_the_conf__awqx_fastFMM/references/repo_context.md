# Repository Context for _To_test_whether_cue-offset_remapping_is_related_to_the_conf

To address the research question regarding cue-offset remapping and its relationship to conflict, you need to implement a workflow that extracts phase-specific circular means, computes circular differences, and performs a Bayesian circular regression.

**Note:** The provided repository (`fastFMM`) is a specialized toolkit for **Functional Univariate Inference (FUI)**. While it provides a robust infrastructure for mixed-effects modeling, it **does not** contain the specific circular-statistics logic (e.g., `atan2`-based circular diffs) or the specific Bayesian von Mises regression models required by your prompt. You will need to augment this repository with custom scripts.

---

### 1. Relevant Files (Ranked by Relevance)

| File | Priority | Role |
| :--- | :--- | :--- |
| `R/fui.R` | **HIGH** | The main orchestration engine. Use this as a template for constructing your analysis pipeline and managing parallel processing. |
| `R/fastFMM.R` | **MEDIUM** | Useful for understanding how to define custom S3 objects to hold your processed "fly-by-cue" data and model results. |
| `R/utils.R` | **MEDIUM** | (Implied) You must create a new `utils.R` containing `angle_diff(a, b)` functions to handle the $[-\pi, \pi]$ wrapping. |
| `R/plot_fui.R` | **LOW** | Provides a pattern for `ggplot2` plotting that you can adapt for your scatter plot (e.g., black/gray color mapping). |

---

### 2. Code Execution Order (Proposed Workflow)
1.  **Data Extraction**: Create a script `process_nwb.R` to iterate over 18 NWB files. For each fly, isolate `cue_contrast` phases 1, 2, and 3. Extract circular means of offsets for each phase and calculate `Conflict` and `Change`.
2.  **Structuring**: Store the 36 points (18 flies × 2 cues) in a structured `DataFrame` (columns: `FlyID`, `CueType`, `InitialOffset`, `BothOffset`, `FinalOffset`, `Conflict`, `Change`).
3.  **Modeling**: Implement a custom Bayesian linear model using `brms` (standard for Bayesian von Mises regression in R).
4.  **Plotting**: Use `ggplot2` to overlay the regression line on the scatter plot.
5.  **Integration**: Wrap these steps into a `main_analysis.R` script that imports your processed data and calls the model.

---

### 3. Key Code Patterns
*   **Circular Wrapping**: To calculate the conflict/change, use the standard circular difference pattern:
    ```R
    angle_diff <- function(x, y) {
      atan2(sin(x - y), cos(x - y)) * (180 / pi)
    }
    ```
*   **Bayesian Modeling**: Since the repository uses mixed models, use `brms` with a von Mises distribution:
    ```R
    # Example snippet for model fitting
    fit <- brm(Change ~ Conflict + (1|FlyID), data = df, 
               family = von_mises(), prior = c(prior(normal(0, 1), class = "b")))
    ```
*   **Mapping**: Use `ggplot2` aesthetic mapping:
    ```R
    ggplot(df, aes(x = Conflict, y = Change, color = factor(CueType))) + 
      geom_point() + scale_color_manual(values = c("1" = "black", "2" = "gray"))
    ```

---

### 4. Data Files Referenced
*   **NWB Files**: You must provide a directory path containing the 18 NWB files.
*   **External Dependencies**: You will need to add `brms` and `rstan` (or `cmdstanr`) to your `DESCRIPTION` file to perform the requested Bayesian inference, as the current repository is strictly focused on LMMs via `lme4`.

---

### 5. Missing Pieces
*   **Circular Statistics**: The current `fastFMM` repository lacks a `circular` library dependency. You must install `circular` or `CircStats` to handle the angular data distribution correctly.
*   **Bayesian Engine**: The repository uses Frequentist mixed models (`lme4`). You need to add a Bayesian framework (e.g., `brms`) to satisfy the requirement for von Mises residuals.
*   **NWB Parser**: There is no current NWB reading utility in the repository; you will need to incorporate `nwbwidgets` or `rhdf5` to parse the `cue_contrast` labels.