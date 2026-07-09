# Paper-Repo Connection Analysis for _To_test_whether_cue-offset_remapping_is_related_to_the_conf

This analysis evaluates the alignment between the experimental methodology for testing "cue-offset remapping" and the provided codebase (`fastFMM` package).

---

### 1. Paper-to-Code Mapping
The requirement to test whether **cue-offset remapping** is related to **cue conflict** entails:
*   **Data Aggregation:** The paper requires calculating specific scalar circular metrics (`Conflict`, `Change`) derived from phase-specific circular means in 18 flies.
*   **Modeling:** The paper specifies a **Bayesian linear model with von Mises residuals** to handle circular-linear relationships.
*   **Mapping:** The provided code (`fui.R`) is designed for **Functional Data Analysis (FDA)**—specifically, fitting longitudinal functional outcomes ($Y(s)$) against scalar predictors using Gaussian-distributed errors (LME framework). The repository focuses on *functional* modeling (e.g., neural activity over time), whereas the paper's requested analysis is a *cross-sectional* scalar-to-scalar circular regression.

### 2. Code-to-Paper Mapping
*   **Misalignment:** The `fui()` (Fast Univariate Inference) function in `R/fui.R` is designed for high-dimensional functional responses, not the 36-point scalar dataset described in the research question. 
*   **Infrastructure:** The `R/utils.R` and `R/plot_fui.R` scripts provide robust infrastructure for handling mixed-effects models (`lme4` syntax), managing parallel processing, and generating `ggplot2` visualizations with confidence bands. However, none of this infrastructure currently supports the circular (von Mises) error distribution required for angular "offset" data.

### 3. Gap Analysis
*   **Distributional Mismatch:** The code assumes Gaussian residuals (`family = "gaussian"`). Circular data requires von Mises regression, which is not present in the provided `fastFMM` repository.
*   **Dimensionality Mismatch:** The research question asks for a 36-point scatter plot and linear regression. The `fastFMM` code is designed to output functional trends (curves over time) rather than a single slope parameter for a scalar regression.
*   **Missing Circular Metrics:** There are no utility functions for calculating circular differences ($[-\pi, \pi]$ wrapping) or von Mises likelihood estimation.

### 4. Reproduction Strategy
To bridge the gap between the repository and the paper’s requirements:
1.  **Data Preprocessing:** Write a script to extract `18 flies` NWB data. Calculate circular means for each of the 5 phases per cue.
2.  **Circular Metrics:** Implement a helper function for signed circular differences:
    `ang_diff <- function(a, b) atan2(sin(a - b), cos(a - b))`
3.  **Model Implementation:** Since the `fastFMM` package does not contain von Mises regression, you should integrate the `brms` or `circular` R packages. Use a formula like:
    `Change ~ Conflict + (1|FlyID)` with `family = von_mises`.
4.  **Visualization:** Create the scatter plot using `ggplot2`, utilizing the repository's `theme_classic()` and design patterns from `plot_fui.R` to maintain style consistency.

### 5. Key Insights
*   **Domain Shift:** The provided repository (`fastFMM`) is optimized for **neural dynamics over time** (functional longitudinal data). The research question is an **offline behavioral inference** problem (scalar cross-sectional data).
*   **Conceptual Fit:** While the repository’s structure (parsing formulas, plotting functions, parallel execution) is excellent, the underlying statistical engine (`lme4`/`refund`) is the wrong tool for circular behavioral offsets.
*   **Recommendation:** Use the repository for the **data ingestion and plotting infrastructure**, but replace the `fui()` modeling core with a standard Bayesian circular regression model to fulfill the "von Mises residuals" requirement.