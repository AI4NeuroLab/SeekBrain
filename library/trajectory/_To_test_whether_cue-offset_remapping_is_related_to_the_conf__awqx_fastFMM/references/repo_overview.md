# Repository Overview

This repository contains the `fastFMM` R package, a specialized toolkit for **Fast Functional Mixed-Effects Modeling**. It is designed to provide computationally efficient statistical inference for functional data, specifically by decomposing complex functional models into series of univariate mixed-model fits across a functional domain.

---

### 1. Repository Purpose
The repository provides an implementation of **Functional Univariate Inference (FUI)**. It allows researchers to perform regression analysis on functional outcomes (e.g., neural signals, time-series measurements) while accounting for random effects (e.g., subject-specific variations). It focuses on:
*   Computational speed via parallelized "mass univariate" model fitting.
*   Inference for both standard functional and concurrent functional models.
*   Rigorous uncertainty quantification using either analytic (Method of Moments) or bootstrap resampling methods.

### 2. Data Pipeline
The analysis follows a sequential data pipeline:
1.  **Configuration**: User input is validated via `fui()` and constructor functions (`fastFMM.R`).
2.  **Mass Univariate Step**: The domain is discretized, and linear mixed models are fit independently at each point via `massmm.R` and `unimm.R`.
3.  **Smoothing**: Raw coefficient estimates are smoothed across the functional domain to create continuous functional regression curves.
4.  **Inference**: The framework calculates variance-covariance structures for these curves using either analytic MoM (`var_analytic.R`) or bootstrap resampling (`var_bootstrap.R`).
5.  **Visualization**: Final functional trajectories and confidence bands are visualized via `plot_fui.R`.

### 3. Key Scripts & Their Roles
*   **`R/fui.R`**: The main entry point/orchestrator; manages the workflow from input to inference.
*   **`R/massmm.R` & `R/unimm.R`**: Handle the parallelized "Mass Univariate" fitting of mixed models (`lme4`) at each domain point.
*   **`R/var_analytic.R` & `R/var_bootstrap.R`**: The core statistical engines for quantifying uncertainty and generating joint confidence intervals.
*   **`R/G_estimate.R` / `R/G_generate.R`**: Handle the estimation of random-effect covariance matrices ($G$), crucial for mixed-model accuracy.
*   **`R/plot_fui.R`**: User-facing utility for generating diagnostic/result plots.

### 4. Analysis Methods Implemented
*   **Fast Functional Univariate Inference (FUI)**: Decomposes functional problems into univariate components.
*   **Method of Moments (MoM)**: Used for estimating random-effect covariance structures ($G(s_1, s_2)$).
*   **Concurrent Functional Regression**: A specific model type where functional predictors are matched to the outcome domain.
*   **Penalized Spline Smoothing**: Utilizes `mgcv` for smoothing coefficient estimates.
*   **Joint Confidence Bands**: Utilizes extreme value theory and Monte Carlo simulations (in analytic inference) or bootstrapping to quantify simultaneous uncertainty.
*   **Constrained Optimization**: Employs Non-Negative Least Squares (NNLS) to ensure variance components remain physically valid (non-negative).

### 5. Outputs & Figures
*   **Statistical Objects**: Returns S3 objects containing functional fixed effects (`betaHat`), variance matrices, and fit diagnostics (AIC/cAIC).
*   **Visualizations**: `plot_fui()` produces multi-panel `ggplot2` grids showing:
    *   Functional regression coefficient curves ($\beta(s)$).
    *   Pointwise and joint 95% confidence ribbons.
    *   Zero-reference lines.

### 6. Dependencies & Environment
*   **Core Modeling**: `lme4` (mixed models), `mgcv` (splines), `refund` (FDA utilities).
*   **Performance**: `parallel` (multi-core support), `Matrix` (sparse matrix operations), `Rfast`.
*   **Inference**: `mvtnorm` (multivariate distributions), `lsei` (constrained optimization).
*   **CI/CD**: GitHub Actions (`R-CMD-check.yaml`) ensures cross-platform package stability.

### 7. File Dependency Graph
*(Conceptual Relationship)*

*   **Main Interface**: `fui.R` $\rightarrow$ `fastFMM.R` (setup)
*   **Computation**: `fui.R` $\rightarrow$ `massmm.R` $\rightarrow$ `unimm.R` (the "Massive Univariate" core).
*   **Variance Estimation**: `fui.R` $\rightarrow$ (`var_analytic.R` OR `var_bootstrap.R`).
    *   *Analytic relies on*: `G_estimate.R`, `G_generate.R`.
*   **Utilities**: `utils.R` (input checks) and `globals.R` (namespace management) support all internal functions.
*   **Visualization**: `plot_fui.R` $\rightarrow$ `fui()` output objects.
*   **Data Packages**: `d2pvt-data.R` and `lick-data.R` are self-contained documentation objects for the repository's demonstration datasets.

Repository Structure:
  .github/workflows/R-CMD-check.yaml (1521 chars)
  NEWS.md (2454 chars)
  R/G_estimate.R (11412 chars)
  R/G_estimate_randint.R (1586 chars)
  R/G_generate.R (8533 chars)
  R/d2pvt-data.R (1056 chars)
  R/fastFMM.R (5918 chars)
  R/fui.R (14889 chars)
  R/globals.R (74 chars)
  R/lick-data.R (1366 chars)
  R/massmm.R (9094 chars)
  R/plot_fui.R (9188 chars)
  R/unimm.R (6786 chars)
  R/utils.R (4636 chars)
  R/var_analytic.R (28923 chars)
  R/var_bootstrap.R (10778 chars)
  R/var_parallel.R (6019 chars)
  README.md (3669 chars)
  cran-comments.md (251 chars)
  data-raw/d2pvt.R (2984 chars)
  data-raw/lick.R (9923 chars)
  renv/activate.R (39946 chars)
  revdep/README.md (6468 chars)
  revdep/cran.md (195 chars)
  revdep/failures.md (29 chars)
  revdep/problems.md (29 chars)
  tests/spelling.R (161 chars)