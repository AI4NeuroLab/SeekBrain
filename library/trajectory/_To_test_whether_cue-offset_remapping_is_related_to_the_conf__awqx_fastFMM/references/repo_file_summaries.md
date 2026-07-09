# Repository File Summaries

## .github/workflows/R-CMD-check.yaml

This file is a GitHub Actions workflow configuration used for automated Continuous Integration (CI) of an R package.

### 1. Purpose
This workflow automates the testing and validation of an R package by running `R CMD check` across multiple operating systems (macOS, Windows, Ubuntu) and various R versions. It ensures code quality and package stability whenever changes are pushed to the main branch or submitted via pull request.

### 2. Key Functions/Classes
*   **`setup-pandoc@v2`**: Installs Pandoc, necessary for rendering package documentation and vignettes.
*   **`setup-r@v2`**: Configures the specific R environment based on the matrix configuration.
*   **`setup-r-dependencies@v2`**: Automatically identifies and installs R package dependencies from the `DESCRIPTION` file.
*   **`check-r-package@v2`**: Executes the core `rcmdcheck` process to verify package integrity, documentation, and compliance with CRAN standards.

### 3. Data Flow
*   **Input**: Reads the R package source code, the `DESCRIPTION` file (for dependencies), and GitHub secrets (`GITHUB_TOKEN`).
*   **Process**: Downloads dependencies from the RStudio Package Manager (RSPM) and performs internal consistency checks via `rcmdcheck`.
*   **Output**: Generates build logs, test check results, and (if applicable) visual snapshots or PDF/HTML vignettes.

### 4. Dependencies
*   **`r-lib/actions`**: A suite of standard GitHub Actions for R development.
*   **`rcmdcheck`**: An R package that provides a modern interface for `R CMD check`.
*   **`Pandoc`**: Used for converting documentation formats.
*   **`RSPM`**: Public RStudio Package Manager for efficient binary package installations.

### 5. Analysis Methods
*   **Automated Package Validation**: Uses the standard R ecosystem method `R CMD check`, which tests for:
    *   Package structure and metadata correctness.
    *   Syntactic validity of R code and C/C++/Fortran code.
    *   Execution of examples and documentation rendering.
    *   Consistency of unit tests.

### 6. Figures/Outputs
*   **Workflow Logs**: Real-time console output viewable in GitHub Actions UI indicating success or failure of the build.
*   **Build Artifacts**: The workflow configuration includes `upload-snapshots: true`, which preserves test output snapshots for debugging UI or visual regressions.

### 7. Key Parameters
*   **`strategy/matrix`**: Defines the cross-platform test matrix (e.g., `macos-latest`, `windows-latest`, and multiple Ubuntu configurations including `devel` and `oldrel-1` versions of R).
*   **`fail-fast: false`**: Ensures that even if one OS build fails, the others continue to execute, providing comprehensive cross-platform feedback.
*   **`build_args`**: Contains `"--no-manual"` and `"--compact-vignettes=gs+qpdf"` to optimize the build process by skipping heavy documentation generation and compressing vignettes.

---

## NEWS.md

This analysis is based on the provided `NEWS.md` file for the **fastFMM** R package, a software tool designed for fast functional mixed-effects modeling.

### 1. Purpose
This file serves as the version history and changelog for the `fastFMM` R package. It documents the evolution of the software, tracking feature enhancements, bug fixes, and methodological updates relevant to functional data analysis.

### 2. Key Functions/Classes
*   **`fui()`**: The primary function for Functional Univariate Inference; recently expanded to handle both non-concurrent and concurrent models.
*   **`G_estimate_randint()`**: A helper function responsible for estimating random intercept components.
*   **`plot_fui()`**: A visualization function for generating plots based on `fui()` outputs.
*   **S3 Generics**: The package uses S3 generic architecture to unify handling of concurrent and non-concurrent functional models.

### 3. Data Flow
*   **Inputs**: Supports functional outcomes and functional covariates. Processes datasets such as `lick` and `d2pvt`.
*   **Preprocessing**: Includes routines to remove rows with missing functional outcomes and experimental support for longitudinal Functional Principal Component Analysis (FPCA) imputation.
*   **Outputs**: Generates statistical models, inference results, and visual diagnostic plots.

### 4. Dependencies
*   **Language/Environment**: R (version 4.6.0 noted).
*   **Graphics**: `ggplot2` (notably moving away from deprecated `aes_string()` syntax).
*   **External Integration**: References a Python package/guides for cross-language interoperability.
*   **External Data/Theory**: Relies on cited statistical methodologies (Xin et al., 2025; Jeong et al., 2022; Machen et al., 2025).

### 5. Analysis Methods
*   **Functional Mixed-Effects Models**: Core framework for analyzing functional data.
*   **Method of Moments (MoM)**: Implemented for estimator calculations (defaulting to `MoM=1` for efficiency).
*   **Parallelization**: Multi-core support for PCs and analytic inference steps to reduce computational overhead.
*   **Concurrent Modeling**: Support for models where functional outcomes are predicted by functional covariates.

### 6. Figures/Outputs
*   **Plots**: `plot_fui()` generates visual representations of functional inference results, currently utilizing `geom_segment()` for axis plotting.
*   **Logs**: Terminal messages generated during model estimation steps (using `message()` vs `print()`).

### 7. Key Parameters
*   **`concurrent`**: Boolean flag to toggle between concurrent and standard modeling.
*   **`parallel`**: Boolean flag to enable multi-core computation.
*   **`n_cores`**: User-defined integer required when `parallel = TRUE` to manage resource allocation on HPC clusters.
*   **`MoM`**: Selection parameter for the Method of Moments estimator (affects performance and memory usage).

---

## R/G_estimate.R

This file, `R/G_estimate.R`, is part of a functional data analysis pipeline (likely the FUI method) and provides the logic for estimating the covariance matrix $G$ of random effects within functional mixed-effects models.

### 1. Purpose
The file implements S3 methods for estimating the covariance matrix $G(s_1, s_2)$ for random components in functional models, using Method of Moments estimators. It specifically handles both concurrent and non-concurrent functional model structures and includes post-estimation refinements to ensure non-negativity of variance components.

### 2. Key Functions/Classes
*   **`G_estimate` (Generic)**: S3 dispatch method to route estimation based on the `fmm` object type.
*   **`G_estimate.fastFMM`**: Implements the Method of Moments covariance estimator for non-concurrent models.
*   **`G_estimate.fastFMMconc`**: Implements the Method of Moments covariance estimator for concurrent functional models.
*   **`cov_nnls`**: A utility function that applies non-negative least squares (NNLS) constraints to ensure estimated diagonal variance terms are non-negative.

### 3. Data Flow
*   **Input**: Takes a `fastFMM` object (containing data, design matrices, and argument values) and intermediate results like `betaHat` (fixed effects) and `HHat` (H-matrix).
*   **Processing**: Computes residuals from the massive univariate step, constructs cross-products of these residuals, and applies OLS or NNLS estimators to map these to the $G$ matrix.
*   **Output**: Returns a list containing the estimated `GTilde` covariance matrix and the `data_cov` metadata used during calculation.

### 4. Dependencies
*   **External R Packages**:
    *   `Matrix`: Used for efficient cross-product/transposition operations.
    *   `MASS`: Specifically `ginv` for computing the Moore-Penrose pseudo-inverse.
    *   `lsei`: Used for constrained optimization (NNLS) via `pnnls` and `lsei`.
*   **Internal Repo Dependencies**:
    *   `G_generate`: Expected to exist in the repository to generate the random effects design matrix ($Z$).

### 5. Analysis Methods
*   **Method of Moments (MoM)**: The core statistical approach to estimate random effect covariances by matching sample moments (products of residuals) to theoretical model expectations.
*   **Generalized Least Squares/OLS**: Uses pseudo-inverses to solve for the random effect coefficients.
*   **Constrained Optimization**: Uses non-negative least squares (NNLS) to ensure that the diagonal entries of the $G$ matrix (representing variances) remain positive, which is a common requirement in mixed-effects modeling.

### 6. Figures/Outputs
*   The code does not generate graphical figures. 
*   **Primary Output**: A multi-dimensional array `GTilde` representing the estimated $G$ matrix across the functional domain $(L \times L)$ for each random effect.

### 7. Key Parameters
*   **`MoM`**: An integer (1 or 2) that selects the specific Method of Moments estimation approach.
*   **`non_neg`**: A control flag (0, 1, or 2) determining if and how non-negativity constraints are enforced (e.g., direct NNLS vs. constraint matrices).
*   **`silent`**: A boolean toggle to suppress or enable status messages during the multi-step calculation process.

---

## R/G_estimate_randint.R

This analysis covers the `R/G_estimate_randint.R` file, which is part of a functional data analysis (FDA) package, specifically designed for Fast Functional Mixed Models (FastFMM).

### 1. Purpose
This file provides an optimized estimation procedure for the covariance matrix ($G$) of random components in a functional mixed model when the only random effect present is a random intercept. It leverages a Method of Moments (MoM) approach to compute this covariance efficiently.

### 2. Key Functions/Classes
*   **`G_estimate_randint`**: The primary function that calculates the covariance matrix $G(s_1, s_2)$ by subtracting the variance contributed by fixed effects from the total observed covariance of the data.

### 3. Data Flow
*   **Reads**: An `fmm` object (containing functional data, argument values, and indices), a design matrix of linear models, and pre-calculated `betaHat` (fixed effect estimates).
*   **Processes**: Calculates the cross-product of the fixed effects with the design matrix variance, then computes the pairwise covariance of the residuals at each grid point across the domain $L$.
*   **Writes**: Returns a square matrix `GTilde` of dimension $L \times L$, representing the estimated covariance of the random intercept.

### 4. Dependencies
*   **`Matrix`**: Used for efficient matrix operations (`crossprod`).
*   **`stats`**: Used for standard statistical calculations (`cov`, `var`).
*   **`fmm` object**: Relies on the internal structure of the `fastFMM` object passed as an argument.

### 5. Analysis Methods
*   **Method of Moments (MoM)**: The core statistical approach used to estimate the covariance of random components.
*   **Residual-based Covariance Estimation**: The logic follows the formula: $Cov(\text{Random Effect}) = Cov(\text{Observed Data}) - Cov(\text{Fixed Effects})$.
*   **Handling Missingness**: Uses `use = "pairwise.complete.obs"` within the covariance calculation to handle potential missing values in the functional data domain.

### 6. Figures/Outputs
*   **Outputs**: Returns a numeric matrix representing the estimated covariance surface $G(s_1, s_2)$.
*   **Figures**: This file does not generate plots; it is strictly a computational backend.

### 7. Key Parameters
*   **`fmm`**: A `fastFMM` object containing the underlying data structure and grid information.
*   **`designmat`**: The design matrix associated with the linear models.
*   **`betaHat`**: The fixed effects estimates, used to isolate the variance attributable to fixed components.
*   **`silent`**: A logical flag to toggle console messages regarding the progress of the estimation step.

---

## R/G_generate.R

This file, `R/G_generate.R`, is part of the `fastFMM` repository, which facilitates functional mixed-model analysis. Below is the structured analysis of the code:

### 1. Purpose
The file provides methods to construct the design matrix ($Z$) required for estimating the $G$ matrix (representing random-effect covariance structures) within functional mixed models. It handles two distinct modeling scenarios: non-concurrent (functional) models and concurrent (pointwise) models.

### 2. Key Functions/Classes
*   **`G_generate`**: A generic S3 method dispatching the creation of design matrices based on the model type.
*   **`G_generate.fastFMM`**: Implements the logic for non-concurrent models, processing random effect terms to create design matrices for Method of Moments (MoM) estimation.
*   **`G_generate.fastFMMconc`**: Implements the logic for concurrent models, where covariance is estimated at specific time points ($i, j$).
*   **`all_crossterms`**: A helper function that computes the cross-products of columns between two design matrices to identify covariance interactions.

### 3. Data Flow
*   **Input**: Takes a `fastFMM` object, a `mum` (massively univariate model) list containing random effect information (`ztlist`, `varcorr_df`), and an estimation flag (`MoM`).
*   **Processing**: Iterates through random effect terms, calculates products of $Z$ columns (accounting for cross-terms), and generates a concatenated design matrix.
*   **Output**: Returns a list containing the newly constructed design matrix (`Z`), original univariate components (`Z_orig` or `ztlist`), and indexing vectors (`idx_lst`, `idx_vec`) used for mapping estimates back to the functional covariance components.

### 4. Dependencies
*   **`Matrix`**: Used for sparse matrix operations and efficient storage of cross-terms.
*   **`lme4`**: Implicitly depends on `lme4` objects (implied by the use of `getME` and `VarCorr` structure patterns) for the underlying model metadata.

### 5. Analysis Methods
*   **Method of Moments (MoM)**: The code implements specific logic to estimate $G(s_1, s_2)$ using the Method of Moments.
*   **Functional Data Analysis (FDA)**: The design is tailored to map random effects over functional domains, specifically separating the estimation between "concurrent" (pointwise) and "non-concurrent" (smooth/functional) covariance models.

### 6. Figures/Outputs
*   This file does not generate visual plots. Its output is purely mathematical/statistical: a **design matrix ($Z$)** and associated **indexing information** required for the regression-based estimation of the covariance structure of random effects.

### 7. Key Parameters
*   **`MoM`**: An integer indicator determining the estimation approach (e.g., whether to sum rows or use full interaction matrices).
*   **`fmm`**: The primary `fastFMM` model object containing the functional structure.
*   **`i`, `j`**: Integer indices used in the concurrent model to denote specific time-point slices for covariance calculation.

---

## R/d2pvt-data.R

### File Analysis: `R/d2pvt-data.R`

This file serves as a documentation and data-loading wrapper for a specific behavioral and neural recording dataset used in the study by Machen et al. (2025).

---

#### 1. Purpose
The file provides the R documentation and registration for the `d2pvt` dataset, ensuring it is accessible as a package object. It describes an experiment monitoring mouse navigation in a maze with variable reward types (strawberry milkshake vs. water).

#### 2. Key Functions/Classes
*   **`d2pvt`**: The primary object (data frame) containing the experimental dataset.
*   **`ignore_unused_imports`**: A helper function intended to satisfy R package check requirements by referencing dependencies (e.g., `dplyr::mutate`) that might otherwise trigger "unused import" warnings.

#### 3. Data Flow
*   **Input**: The file acts as a container for pre-processed experimental data (1335 rows, 248 columns).
*   **Output**: Upon loading the package, `d2pvt` becomes available to the user as a standard R data frame for downstream statistical analysis and visualization.

#### 4. Dependencies
*   **`dplyr`**: Explicitly referenced to support data manipulation workflows.
*   **`roxygen2`**: Utilized for the metadata documentation (as indicated by the `#'` tags).

#### 5. Analysis Methods
*   **Behavioral/Neuroscientific Mapping**: The data links behavioral events (latency, reward, trial number) with physiological recordings (photometry), allowing for the analysis of neural responses to interoceptive predictions.

#### 6. Figures/Outputs
*   This file does not generate plots; it provides the raw data structured for programmatic plotting or statistical modeling within an R environment.

#### 7. Key Parameters (Data Columns)
*   **`id`**: Identifier for individual subject mice.
*   **`outcome` / `SMS`**: Categorical reward type.
*   **`latency`**: Temporal metric of trial duration.
*   **`photometry`**: The primary continuous signal representing neural activity (likely from D2+ neurons in the paraventricular nucleus of the thalamus).
*   **`rewarded`**: Logical status flag indicating reward delivery relative to the recording time point.

---

## R/fastFMM.R

### Code Analysis Summary: `R/fastFMM.R`

#### 1. Purpose
This file provides constructor functions for creating S3 objects (`fastFMM` and `fastFMMconc`) used to parameterize and store configuration settings for Fast Univariate Inference (FUI) in functional mixed-effect models. It serves as an internal setup layer for the `fui()` function, ensuring data validation and object structure consistency before model fitting.

#### 2. Key Functions/Classes
*   **`new_fastFMM`**: The constructor for the base `fastFMM` class. It performs input validation (formula syntax, variable naming conventions) and identifies the functional domain of the outcome variable.
*   **`new_fastFMMconc`**: The constructor for the `fastFMMconc` class (which inherits from `fastFMM`). It initializes objects specifically for "concurrent" functional models, which include time-varying functional covariates.

#### 3. Data Flow
*   **Input**: Takes raw model parameters (formulas, data frames, IDs, and control flags) primarily passed from the higher-level `fui` function.
*   **Processing**:
    *   Validates the formula against `lme4` requirements.
    *   Ensures covariate names do not contain periods (`.`) to prevent parsing conflicts.
    *   Calculates the dimensionality of the functional domain (`L`) and identifies outcome columns in the data frame.
*   **Output**: Returns a structured list object (assigned an S3 class) containing model metadata, indices for the functional domain, and calculation settings (e.g., analytical vs. bootstrap variance estimation).

#### 4. Dependencies
*   **Internal**: Assumes the existence of a parent environment (specifically the `fui()` function) that provides the necessary data and control arguments.
*   **External**: Relies on `lme4` formula syntax conventions for model specification.

#### 5. Analysis Methods
*   **Functional Univariate Inference (FUI)**: Supports both standard functional models and concurrent models (where functional predictors are matched at the same domain points as the outcome).
*   **Variance Estimation Logic**: Toggles between analytical methods and bootstrap resampling based on user input.
*   **GLM Compatibility**: Supports generalized linear model families for response variables.

#### 6. Figures/Outputs
*   **No graphical output**: This file is restricted to object configuration and data structure management.
*   **Object Output**: Produces formal S3 objects of classes `fastFMM` or `fastFMMconc` to be consumed by downstream model-fitting routines.

#### 7. Key Parameters
*   **`formula`**: `lme4`-style model formula defining the fixed and random effects.
*   **`analytic`**: Boolean; dictates whether variance calculations should be handled analytically (fast) or via bootstrap (computationally intensive).
*   **`fun_covariates`**: A character vector identifying columns in the data frame that represent functional covariates (used only in concurrent models).
*   **`argvals`**: Specifies the points on the functional domain for evaluation (defaults to the full range of the domain index).
*   **`subj_id`**: The column name for grouping subjects/clusters in the mixed model.

---

## R/fui.R

This file, `R/fui.R`, is the core implementation of the **Fast Univariate Inference (FUI)** method for longitudinal functional models, as described by Cui et al. (2022).

### 1. Purpose
The file implements a function-on-scalar regression model for longitudinal functional outcomes. It enables computationally efficient statistical inference (pointwise and joint confidence bands) by decomposing the problem into univariate mixed models at each functional location followed by smoothing.

### 2. Key Functions
*   **`fui()`**: The main user-facing function that orchestrates the three-step FUI process: mass univariate modeling, functional smoothing, and variance estimation/inference.
*   **Helper calls**: Relies on `new_fastFMM` (standard FMM) or `new_fastFMMconc` (concurrent FMM) for model setup, `massmm()` for univariate fitting, and `var_analytic()` or `var_bootstrap()` for final inference.

### 3. Data Flow
*   **Input**: A data frame (long format) and a model formula where the response is a matrix (representing functional domain observations).
*   **Processing**:
    1.  Checks identifiability and handles missing values (optional FPCA-based imputation).
    2.  Fits univariate mixed models for each column of the response matrix.
    3.  Applies penalized spline smoothing (`mgcv`) to the raw estimates.
    4.  Calculates variance (analytic or bootstrap).
*   **Output**: A list containing estimated functional fixed effects (`betaHat`), variance estimates, critical values for confidence bands, and optional diagnostic statistics (AIC/cAIC).

### 4. Dependencies
*   **Base R**: `parallel`, `stats`.
*   **External R Packages**: `lme4` (mixed models), `mgcv` (spline smoothing), `refund` (functional data utilities), `cAIC4` (model selection), `MASS`, `Matrix`, `mvtnorm`, `Rfast`, `progress`, `magrittr`, `lsei`.

### 5. Analysis Methods
*   **Massive Univariate Inference**: Fits standard linear mixed models (LMM) independently across the functional domain grid.
*   **Penalized Splines**: Uses `mgcv::gam` for smoothing coefficient estimates and covariance matrices along the functional domain.
*   **Variance Estimation**: Supports **Analytic** (based on method of moments) or **Bootstrap** approaches (cluster, case, wild, REB, etc.) to construct confidence intervals.
*   **Imputation**: Functional Principal Component Analysis (FPCA) via `refund::fpca.face` for handling missing data.

### 6. Figures/Outputs
*   The function returns a complex object (list) containing numerical arrays and matrices rather than generating graphical plots directly. 
*   **Usage**: Users are expected to pass the output object to a separate `plot_fui()` function for visualization.

### 7. Key Parameters
*   **`formula`**: Defines the model structure (lme4-style).
*   **`analytic`**: Boolean; toggles between analytic inference (faster, Gaussian-only) and bootstrap (slower, distribution-agnostic).
*   **`concurrent`**: Boolean; toggle for fitting a concurrent functional regression model.
*   **`n_boots`**: Number of bootstrap replicates (default 500).
*   **`boot_type`**: Specifies the bootstrap method (e.g., "cluster", "wild").
*   **`n_cores`**: Controls parallel processing for the mass univariate step.
*   **`non_neg`**: Constraint settings for variance estimation (non-negativity).

---

## R/globals.R

This is a standard configuration file often found in R packages to ensure compatibility with R’s package-checking mechanism.

### 1. Purpose
This file registers specific variable names as "global" to the R package environment. Its primary purpose is to suppress `R CMD check` notes (specifically "no visible binding for global variable") that occur when using non-standard evaluation (NSE) in functions like `dplyr` or `ggplot2`.

### 2. Key Functions/Classes
*   **`utils::globalVariables()`**: A utility function from the base R `utils` package that informs the R interpreter that the listed strings are intentionally used as variables within the package, even if they are not explicitly defined in the scope where they appear.

### 3. Data Flow
*   **Reads/Writes**: It does not read or write data. It acts as a static configuration file.
*   **Processes**: It registers the symbols `lower`, `lower.joint`, `upper`, and `upper.joint` into the package's internal namespace metadata.

### 4. Dependencies
*   **External**: `utils` (Base R).
*   **Internal**: None.

### 5. Analysis Methods
*   **N/A**: This file does not implement scientific or statistical methods. It is an infrastructure file used to support the code that *does* perform those methods (e.g., likely functions calculating confidence intervals or joint probability bounds).

### 6. Figures/Outputs
*   **None**: It generates no visual or file-based outputs.

### 7. Key Parameters
The file defines four specific identifiers that appear to be used in the package's data analysis or visualization logic:
*   **`lower` / `upper`**: Likely represent confidence interval bounds or threshold limits.
*   **`lower.joint` / `upper.joint`**: Likely represent bounds related to joint distributions, multivariate analysis, or simultaneous inference.

---

## R/lick-data.R

This file, `R/lick-data.R`, serves as a documentation and data-loading wrapper for a specific behavioral dataset within an R package (likely part of a larger analysis repository for the cited paper).

### 1. Purpose
This file provides the metadata documentation for a dataset containing photometry recordings and licking behavior from mice, originating from Jeong et al. (2022). It allows users of the package to access and understand the structure of the `lick` data frame for subsequent statistical analysis.

### 2. Key Functions/Classes
*   **`lick` (Data Object):** A `data.frame` containing the primary observational data. It is documented using Roxygen2 syntax to provide contextual information about the study and column definitions.

### 3. Data Flow
*   **Input:** The data is sourced from the DANDI archive (Dandiset 000351), representing processed experimental results from a study on mesolimbic dopamine.
*   **Processing:** The data is provided as a pre-processed table where original photometry signals have been downsampled to facilitate easier analysis within the R environment.

### 4. Dependencies
*   **Documentation standard:** Uses **Roxygen2** tags (`@name`, `@format`, `@source`, `@references`) standard in R package development.
*   **External Data:** Relies on the DANDI archive (Open neurophysiology data).

### 5. Analysis Methods
While the file does not contain computational code, it facilitates the following methods implied by the data structure:
*   **Time-series analysis:** Analyzing photometry signals over the duration of a trial.
*   **Behavioral modeling:** Correlating `lick_rate` variables with inter-reward intervals (`iri`) and photometry signals to investigate causal associations in dopamine release.

### 6. Figures/Outputs
*   **Output:** The object `lick` serves as an input for visualization and statistical modeling functions elsewhere in the repository (e.g., creating peristimulus time histograms or regression plots).

### 7. Key Parameters
The `lick` data frame contains 94 columns, with the most critical variables being:
*   **Identifiers:** `id`, `session`, `trial`.
*   **Behavioral metrics:** `lick_rate_050` through `lick_rate_200` (time-binned averages) and `lick` (binary time-series indicator).
*   **Experimental condition:** `iri` (inter-reward interval).
*   **Neural metric:** `photometry` (the physiological signal of interest).

---

## R/massmm.R

### 1. Purpose
The `R/massmm.R` file implements the "massively univariate" model fitting stage for functional data analysis within the `fastFMM` framework. It orchestrates the parallelized execution of independent regression models across a functional domain, aggregating results for subsequent smoothing and variance estimation.

### 2. Key Functions/Classes
*   **`massmm()`**: A generic S3 dispatcher that initiates the univariate fitting process.
*   **`massmm.fastFMM()`**: Handles standard "non-concurrent" functional model fits across the functional domain.
*   **`massmm.fastFMMconc()`**: Handles "concurrent" functional model fits, where the outcome and predictors are evaluated at the same time points.
*   **`massmm_apply()`**: An internal helper that manages CPU parallelization (using `mclapply` for Unix-like systems or `parLapply` for Windows).
*   **`massmm_outs()`**: Extracts and aggregates metrics (Beta coefficients, AIC, BIC, variance components) from the list of univariate model outputs.

### 3. Data Flow
*   **Input**: Takes an object of class `fastFMM` or `fastFMMconc` containing the formula, functional data, and grid points (`argvals`).
*   **Processing**: Distributes the fitting task across `argvals`. For each point in the functional domain, it calls a lower-level univariate function (`unimm`).
*   **Output**: Produces a structured list containing coefficient matrices (`betaTilde`), model selection criteria (AIC/BIC), random effect variances, design matrices, and optionally, residuals.

### 4. Dependencies
*   **`lme4`**: Used for mixed-effects model infrastructure (`VarCorr`, `getME`).
*   **`parallel`**: Used for multi-core processing.
*   **`Matrix`**: Used for handling sparse matrix operations.
*   **`stats`**: Provides standard regression utilities (`model.matrix`, `as.formula`).
*   **Internal Context**: Relies on functions like `unimm` and `unimm_lmer` (implied to exist in the repository).

### 5. Analysis Methods
*   **Massively Univariate Modeling**: Fits independent statistical models (e.g., linear mixed models) at every point along a functional grid.
*   **Concurrent Functional Regression**: A specific model type where the response at time $t$ is modeled by predictors at the same time $t$.
*   **Analytical Inference Support**: Prepares specific components (e.g., `ztlist`, variance-covariance matrices) required for the subsequent analytical smoothing/estimation stages of functional mixed models.

### 6. Figures/Outputs
*   The script does not generate plots directly.
*   **Primary Output**: A structured list of fitted univariate model summaries (`betaTilde`, `sigmaesqHat`, `AIC_mat`, etc.) which serves as the input data structure for the functional smoothing module.

### 7. Key Parameters
*   **`fmm`**: The primary data object containing the functional model configuration.
*   **`parallel`**: A boolean flag to toggle parallel execution.
*   **`n_cores`**: An integer defining the number of processing cores to utilize for parallelization.
*   **`fmm$analytic`**: A logical flag that determines whether to include additional data structures (like design matrices and random effect lists) required for analytic variance estimation.

---

## R/plot_fui.R

This file provides a plotting utility for the `fastFMM` package, specifically designed to visualize the results of functional univariate inference (FUI) models.

### 1. Purpose
The file defines the `plot_fui` function, which generates diagnostic plots for fitted `fui` objects. It visualizes estimated functional fixed effects, including both pointwise and joint confidence intervals where available.

### 2. Key Functions
*   **`plot_fui()`**: The primary user-facing function. It extracts coefficient estimates and variance structures from a fitted FUI object and constructs high-quality `ggplot2` visualizations of the functional trajectories.

### 3. Data Flow
*   **Input**: Takes a fitted object (`fuiobj`) produced by `fastFMM::fui()`.
*   **Processing**: Extracts `betaHat` (point estimates) and optional `betaHat_var` (variance/covariance) to calculate confidence bands. It applies axis rescaling and alignment parameters before constructing the plot layer-by-layer.
*   **Output**: Renders a multi-panel `ggplot` grid (arranged via `gridExtra`) and optionally returns a list of data frames containing the processed plotting data and confidence interval values.

### 4. Dependencies
*   **`ggplot2`**: Used for all plotting components (lines, ribbons for CIs, segments).
*   **`gridExtra`**: Used to arrange multiple sub-plots into a single grid.
*   **`fastFMM`**: Inherits the data structure expected from the `fui()` modeling function.

### 5. Analysis Methods
*   **Functional Univariate Inference**: The function assumes an underlying longitudinal functional model framework (as per Cui et al., 2022).
*   **Uncertainty Quantification**: It calculates 95% pointwise and joint confidence intervals using the variance-covariance matrix (`betaHat_var`) and the critical value vector (`qn`) provided by the FUI model.
*   **Visualization**: Utilizes ribbons for CI bands and dashed reference lines for the zero-intercept.

### 6. Figures/Outputs
*   **Multi-panel Plot**: A grid of plots where each panel represents a specific covariate, plotting the functional coefficient $\beta(s)$ over the functional domain.
*   **Data Structure**: When `return = TRUE`, it exports a list of data frames containing `s` (domain), `beta.hat`, and optional confidence interval boundaries (`CI.lower.pointwise`, `CI.upper.pointwise`, `CI.lower.joint`, `CI.upper.joint`).

### 7. Key Parameters
*   **`fuiobj`**: The FUI model output object.
*   **`align_x`**: Shifts the functional domain origin (useful for aligning time-series data).
*   **`x_rescale`**: Adjusts the functional domain scale (e.g., to adjust for sampling rates).
*   **`num_row`**: Controls the layout geometry of the generated plots.
*   **`return`**: Toggles whether the underlying statistical data used for plotting should be exported to the user.

---

## R/unimm.R

### Code Analysis: `R/unimm.R`

#### 1. Purpose
The file provides the core infrastructure for fitting univariate mixed-effects models at individual locations across a functional domain, which serves as the "Step 1" component of the Fast Functional Mixed Model (FUI) approach. It dispatches fitting procedures based on object class and extracts relevant statistical summaries from the resulting model fits.

#### 2. Key Functions/Classes
*   **`unimm()`**: A generic S3 method that dispatches to class-specific fitting functions based on the `fmm` object.
*   **`unimm.fastFMM()`**: Handles standard univariate mixed model fitting at location `l` for `fastFMM` objects.
*   **`unimm.fastFMMconc()`**: Handles model fitting for concurrent models, including the dynamic construction of functional covariate matrices at location `l`.
*   **`unimm_lmer()`**: A helper function that wraps `lme4::lmer` or `lme4::glmer` with standardized optimization parameters.
*   **`unimm_outs()`**: Extracts and formats statistical outputs (fixed effects, random effects, variance components, AIC/BIC/cAIC, residuals) from the fitted objects.

#### 3. Data Flow
*   **Input**: Takes a `fastFMM` object containing the model formula, data structure, and family (e.g., Gaussian, binomial).
*   **Processing**: Extracts specific columns or slices of data corresponding to location `l`, updates the formula to reflect location-specific variables (in concurrent models), and fits the mixed-effects model.
*   **Output**: Returns a structured list containing coefficient estimates (`betaTilde`), variance components, residuals, and model diagnostics.

#### 4. Dependencies
*   **`lme4`**: Used for fitting linear and generalized linear mixed-effects models (`lmer`, `glmer`).
*   **`stats`**: Used for formula manipulation, `model.matrix`, `AIC`, and `BIC` calculations.
*   **`cAIC4`**: Used for calculating the conditional AIC.
*   **`Matrix`**: Used for matrix manipulations (specifically `colSums`).

#### 5. Analysis Methods
*   **Massively Univariate Mixed-Effects Modeling**: The code facilitates the "Fast" approach by decomposing a functional problem into a series of univariate mixed-model fits at discrete points on the functional domain.
*   **Concurrent Functional Regression**: Implements logic to substitute functional covariates with their values at location `l` (e.g., $X(t)_l$) to handle time-varying/location-varying predictors.
*   **Variance Estimation**: Extracts complex variance-covariance structures from `lme4` objects to support analytic variance calculation for downstream FUI steps.

#### 6. Figures/Outputs
*   This file does not generate visual plots.
*   **Outputs**: Returns list objects containing model parameters, specifically `betaTilde` (fixed effects), `se_mat` (standard errors), `var_random` (variance components), and fit statistics (AIC/BIC/cAIC).

#### 7. Key Parameters
*   **`l`**: The specific location/index along the functional domain where the model is being evaluated.
*   **`family`**: The GLM family (e.g., "gaussian"), which determines whether `lmer` or `glmer` is called.
*   **`fmm$analytic`**: A logical flag that triggers the extraction of additional data (e.g., Z-matrices, design matrices) required for analytic variance estimation.
*   **Optimization Control**: The internal functions hard-code the `bobyqa` optimizer with a `maxfun` of 5000 to ensure numerical stability during the repeated fitting process.

---

## R/utils.R

### 1. Purpose
This file provides utility functions for the `fui()` (Functional Underspecified Inference) framework. Its primary goal is to validate input data structures—specifically identifying functional covariates—and to manage computational resource settings for parallel execution.

### 2. Key Functions
*   **`get_functional_covariates(frm, df, silent)`**: Scans the input data frame and model formula to identify columns representing functional data. It ensures that the "width" (number of observations/time points) of these covariates matches the outcome variable.
*   **`check_parallel(is_parallel, num_cores, silent)`**: Validates user-provided parallelization settings. It adjusts `n_cores` to be within hardware limits and provides warnings if contradictory parameters (e.g., `parallel=FALSE` but `n_cores > 1`) are provided.

### 3. Data Flow
*   **Input**: Takes a formula object (`frm`), a data frame (`df`), and execution settings (`silent`, `parallel`, `num_cores`).
*   **Processing**: Uses regex pattern matching (`grep`) to identify groups of columns or matrix-class columns that represent functional trajectories. It computes the "domain length" ($L$) to ensure dimensional consistency.
*   **Output**: Returns a character vector of identified functional covariate names or a list object containing verified parallelization parameters.

### 4. Dependencies
*   **External**: `parallel` (specifically `parallel::detectCores()`).
*   **Internal**: Designed as an internal utility suite (`@noRd`) for the `fui()` package; assumes interaction with the main `fui` modeling environment.

### 5. Analysis Methods
*   **Functional Data Analysis (FDA) Preprocessing**: The code implements a consistency check for functional data inputs. By comparing the dimensionality of the outcome variable to the covariates, it enforces the standard FDA requirement that functional domain lengths must be aligned across variables.
*   **Robust Configuration Validation**: Implements defensive programming to prevent runtime errors in high-performance computing (HPC) environments by dynamically scaling `n_cores` if the user requests more than the hardware allows.

### 6. Figures/Outputs
*   **Console Messages/Warnings**: No visual plots are generated. The code produces diagnostic messages (if `silent = FALSE`) and formal R warnings or errors to alert users to data structure mismatches or configuration conflicts.

### 7. Key Parameters
*   **`frm`**: A standard R formula representing the statistical model.
*   **`df`**: The repository-specific input data frame where functional variables are expected to be stored as either matrices or wide-format columns.
*   **`parallel`**: A boolean flag toggling multi-core processing.
*   **`n_cores`**: Numeric parameter defining the number of CPU cores to utilize; includes logic to cap usage at `detectCores() - 1`.

---

## R/var_analytic.R

This file, `var_analytic.R`, is a core internal component of the `fui` (Functional Univariate Inference) package, designed to perform analytic variance estimation for Gaussian models in functional data analysis.

### 1. Purpose
This script calculates analytic variances and covariances for functional model coefficients. It provides the statistical inference framework—including confidence interval construction—for Massively Univariate models within the `fui` framework.

### 2. Key Functions/Classes
*   **`var_analytic`**: The primary wrapper function that orchestrates the preparation, estimation of random effect covariance structures ($G(s_1, s_2)$), and the final calculation of the variance of the smoothed coefficient surfaces ($\beta(s)$).
*   **`select_knots`**: A utility for determining knot locations for B-splines (adapted from the `refund` package).
*   **`bdiag_m`**: A helper to generate large block-diagonal matrices efficiently.
*   **`cov_organize_start`**: A utility function to map and organize variance-covariance interaction terms from model output into structures ready for calculation.

### 3. Data Flow
*   **Inputs**: Consumes model objects (`fmm`, `mum`) and smoothed outputs (`smoothed`), which contain raw effect estimates, design matrices, and residual information.
*   **Processing**:
    1.  Computes Method of Moments (MoM) estimators for random effect covariance functions.
    2.  Smooths covariance estimates using bivariate penalized splines (`fbps_cov`).
    3.  Parallelizes the calculation of coefficient variances across the functional grid (`argvals`).
    4.  Estimates simultaneous confidence bands using extreme value theory (quantile of row maxima from multivariate normal simulations).
*   **Outputs**: Returns a comprehensive list containing the smoothed coefficients (`betaHat`), their corresponding variance arrays (`betaHat_var`), critical values for joint inference (`qn`), and updated model metadata.

### 4. Dependencies
*   **R Packages**: `Matrix`, `stats`, `Rfast`, `parallel`, `methods`, `mvtnorm`.
*   **Repository Files**: Relies on external helper functions (e.g., `G_estimate`, `G_estimate_randint`, `fbps_cov`, `var_parallel`, `eigenval_trim`), which are assumed to exist elsewhere in the package.

### 5. Analysis Methods
*   **Method of Moments (MoM)**: Used for estimating the covariance structures of random effects.
*   **Functional Data Smoothing**: Employs B-spline smoothing for covariance surfaces.
*   **Eigenvalue Trimming**: Used to ensure the resulting variance-covariance matrices are positive semi-definite (PSD).
*   **Extreme Value Inference**: Simulates multivariate normal distributions to construct simultaneous confidence intervals (joint CI) using the 95th percentile of the maximum absolute value.

### 6. Figures/Outputs
*   While it does not generate visual plots directly, it produces numerical outputs (matrices and arrays) required to visualize confidence bands for functional coefficients.

### 7. Key Parameters
*   **`MoM`**: Integer specifying the type of Method of Moments estimator to apply.
*   **`non_neg`**: Controls the strategy for non-negativity constraints on variance terms.
*   **`nknots_cov`**: Controls the complexity of the B-spline smoothing for covariance surfaces.
*   **`parallel` / `n_cores`**: Controls multi-core processing to manage the computational load of the variance calculations.
*   **`seed`**: Ensures reproducibility for the Monte Carlo simulation of confidence intervals.

---

## R/var_bootstrap.R

This file is a core component of a functional data analysis pipeline, specifically designed to compute bootstrapped variance estimates and joint confidence intervals for functional regression models.

### 1. Purpose
The `var_bootstrap.R` file implements a bootstrapping procedure to estimate the variance of coefficients in a Fast Functional Mixed Model (fFMM). It provides a mechanism to quantify uncertainty by generating bootstrap replications and computing joint confidence intervals for the functional regression parameters.

### 2. Key Functions
*   **`var_bootstrap(...)`**: The main function that orchestrates the resampling, model fitting, and variance estimation logic. It handles different bootstrapping protocols (cluster, wild, residual, etc.) depending on the model structure and family.

### 3. Data Flow
*   **Input**: Takes a fitted FMM object (`fmm`), a mass-univariate model object (`mum`), and various control parameters for estimation, resampling, and parallelization.
*   **Processing**:
    *   Generates bootstrap resamples of the input data based on the specified `boot_type`.
    *   Iteratively re-fits the functional models to these bootstrap samples.
    *   Performs smoothing of the bootstrap coefficient estimates.
    *   Calculates the bootstrap variance and derives joint confidence intervals using functional principal component analysis (FPCA).
*   **Output**: Returns a comprehensive list containing the original coefficients, bootstrap variance matrices, critical values (`qn`) for joint CIs, and original model metadata.

### 4. Dependencies
*   **Base/Stats**: `stats`, `methods`.
*   **External Packages**:
    *   `Matrix`, `Rfast`, `mvtnorm`, `stringr`: Data manipulation and linear algebra.
    *   `parallel`: For multi-core processing (`mclapply`).
    *   `lme4`, `lmeresampler`, `refund`: Used for mixed-model fitting, bootstrapping, and functional PCA.
    *   `mgcv` (implied): Used via `gam` for smoothing bootstrap estimates.

### 5. Analysis Methods
*   **Bootstrapping Protocols**: Implements Cluster, Residual, Wild, REB (Residual Error Bootstrap), Case, and Parametric bootstrap methods.
*   **Smoothing**: Employs `gam` (Generalized Additive Models) with splines to smooth bootstrap estimates across the functional domain.
*   **Uncertainty Quantification**: Uses `refund::fpca.face` to perform Functional Principal Component Analysis on the bootstrap results.
*   **Joint Inference**: Constructs simultaneous confidence intervals by calculating critical values (`qn`) via Monte Carlo simulation of random functions derived from the FPCA of the bootstrap replicates.

### 6. Figures/Outputs
*   The function does not generate visual plots directly.
*   It outputs a numeric structure containing `betaHat_var` (3D array of variance estimates) and `qn` (quantiles for simultaneous inference), which are used by downstream plotting functions to render uncertainty bands.

### 7. Key Parameters
*   **`boot_type`**: Determines the resampling protocol (e.g., "cluster", "wild", "residual").
*   **`n_boots`**: The number of bootstrap replications to perform.
*   **`nknots_fpca`**: Knots for the FPCA process used in joint confidence interval construction.
*   **`parallel` / `n_cores`**: Configuration for accelerating the computationally intensive bootstrap loop.
*   **`smooth_method`**: Method used for smoothing the bootstrap-derived coefficient functions (e.g., REML, GCV).

---

## R/var_parallel.R

This file defines the variance calculation logic for Functional Mixed-Effects Models (FMM) within the repository, specifically handling the analytical calculation of coefficient variances.

### 1. Purpose
The file provides S3 methods for calculating the variance of coefficients at specific locations ($s$) in a functional domain. It facilitates the estimation of covariance structures for both concurrent and non-concurrent functional mixed-effects models.

### 2. Key Functions/Classes
*   `var_parallel`: A generic S3 wrapper function used for dispatching variance calculations to specific model types.
*   `var_parallel.fastFMM`: Implements variance calculation for non-concurrent FMM models.
*   `var_parallel.fastFMMconc`: Implements variance calculation for concurrent FMM models (where the relationship between covariates and outcomes varies by location $s$).

### 3. Data Flow
*   **Inputs**: It consumes a `fastFMM` object, smoothed coefficient estimates (`RHat`, `HHat`), and subject-specific indices/design matrices.
*   **Processing**: For each subject, it constructs a subject-specific variance matrix ($V_{subj}$), performs matrix inversion (using `Rfast::spdinv`), and aggregates the results ($X^T V^{-1} X$).
*   **Outputs**: Returns a list containing the $X^T V^{-1} Z$ components and the theoretical variance of the coefficients ($\beta$-tilde).

### 4. Dependencies
*   **R Packages**:
    *   `Rfast`: Utilized for high-performance matrix inversion (`spdinv`).
    *   `Matrix`: Utilized for efficient matrix products (`tcrossprod`).
*   **Internal**: Depends on `eigenval_trim` (assumed helper function for numerical stability) and the structure of `fmm` objects produced by the `mum` (massively univariate) step.

### 5. Analysis Methods
*   **Matrix Algebra**: The implementation uses generalized least squares (GLS) framework logic to calculate theoretical variances by inverting block-diagonal covariance matrices.
*   **Variance Estimation**: Implements the analytical variance formula for coefficients in a mixed-effects context, accounting for random intercepts vs. functional random effects.
*   **Numerical Stability**: Employs eigenvalue trimming (`eigenval_trim`) to ensure covariance matrices are positive definite and invertible.

### 6. Figures/Outputs
*   This file does not generate plots.
*   It outputs a list object containing:
    *   `XTVinv`: A list of matrices representing the weighted design components per subject.
    *   `betaTilde_theo_var`: The theoretical variance-covariance matrix for the estimated coefficients at location $s$.

### 7. Key Parameters
*   `s`: The specific location index on the functional domain.
*   `randintercept`: A logical flag indicating whether the model includes a random intercept, which simplifies the structure of the variance-covariance matrix.
*   `id_list` / `obs_ind`: Lists used to partition data by subject to allow for the block-wise construction of the variance matrix.

---

## README.md

This analysis provides a structured summary of the `README.md` file for the `fastFMM` R package repository.

### 1. Purpose
This file serves as the primary documentation for the `fastFMM` R package, which implements Fast Univariate Inference (FUI) for functional mixed models. It provides users with installation instructions, usage guidance, and references to the theoretical frameworks and datasets underpinning the software.

### 2. Key Functions/Classes
*   `fui()`: The core model-fitting function for concurrent and non-concurrent functional mixed models.
*   `plot_fui()`: A dedicated plotting function for visualizing the results of the `fui` model fits.

### 3. Data Flow
*   **Input**: The package processes longitudinal functional data, as demonstrated in the provided `lick` and `d2pvt` datasets.
*   **Processing**: Uses R functions located in the `R/` directory to analyze functional mixed models.
*   **Output**: Produces statistical model summaries and plots for interpreting neural signal-behavior relationships.

### 4. Dependencies
*   **Environment**: R.
*   **Tools**: `devtools` (for development version installation).
*   **Package Structure**: Relies on internal components found in `R/`, `vignettes/`, `data/`, and `data-raw/`.

### 5. Analysis Methods
*   **Fast Univariate Inference (FUI)**: A computationally efficient approach to longitudinal functional modeling.
*   **Concurrent Functional Mixed Models**: A statistical framework designed for analyzing trial-level temporal dynamics, specifically applied to fiber photometry and other behavioral neuroscience data.

### 6. Figures/Outputs
*   **Vignettes**: Two primary instructional documents are provided:
    *   `fastFMM.Rmd`: General introduction to `fui` model fitting.
    *   `d2pvt.Rmd`: Specific use cases for modeling experiments with variable trial lengths.
*   **Visualizations**: Outputs include functional coefficient plots generated via `plot_fui`.

### 7. Key Parameters
While specific parameters are defined within the `fui` function documentation (accessed via the package), the repository emphasizes the flexibility of `fui` to handle:
*   **Concurrent vs. Non-concurrent modeling**: Methods to define the timing of functional associations.
*   **Variable Trial Lengths**: Specialized modeling capabilities for experiments where temporal windows differ across observations.

---

## cran-comments.md

This file is a standard administrative document used in the R package development lifecycle, specifically for submissions to CRAN (The Comprehensive R Archive Network).

### 1. Purpose
The `cran-comments.md` file serves as a communication log addressed to CRAN maintainers during the package submission process. It documents the results of automated quality assurance checks and reverse dependency testing to demonstrate that the package meets CRAN's standards for stability and compatibility.

### 2. Key Functions/Classes
*   **None**: This is a plain-text markdown file and contains no executable code, functions, or classes.

### 3. Data Flow
*   **Reads**: It consumes data from the local R environment’s `R CMD check` execution logs and the `revdepcheck` (reverse dependency check) output.
*   **Writes**: It provides a human-readable summary of these check results to be read by CRAN maintainers during the manual review process.

### 4. Dependencies
*   **`devtools` / `rcmdcheck`**: The content is generated by running R's check tools.
*   **`revdepcheck`**: Used to verify that changes to the package do not break other packages that depend on it.

### 5. Analysis Methods
*   **Automated Software Testing**: The file reports on the results of standard software verification methods (unit tests, documentation checks, and dependency consistency checks) performed by the R build system.

### 6. Figures/Outputs
*   **Textual Summary**: The file produces a status report containing:
    *   Counts of errors, warnings, and notes from the R build checks.
    *   Results of reverse dependency checks.
    *   No graphical outputs or data files are produced.

### 7. Key Parameters
*   **N/A**: This file is a static summary report; it does not contain tunable parameters, though it records the outcomes of configuration-dependent checks (such as CRAN check environments vs. local development versions).

---

## data-raw/d2pvt.R

This analysis provides a structured summary of the `data-raw/d2pvt.R` file, which is a data-wrangling script used to prepare experimental neuroscience data for research analysis.

### 1. Purpose
This script processes raw photometry data from a study on D2+ neurons in the paraventricular nucleus of the thalamus (PVT) in mice. It cleans, structures, and saves the data into an R package-ready format for subsequent statistical modeling.

### 2. Key Functions/Classes
*   **`read.csv()`**: Imports the raw photometry and behavioral trial data.
*   **`dplyr::select` / `mutate`**: Used for column subsetting and recoding variables (e.g., converting session strings to numeric).
*   **`gsub()`**: Performs regex-based cleaning of character strings (e.g., stripping session prefixes and date suffixes from IDs).
*   **`as.matrix()`**: Used to organize photometry readings into a nested matrix structure within the dataframe.
*   **`usethis::use_data()`**: Exports the final object to the R package's internal data directory.

### 3. Data Flow
*   **Input**: Reads `data-raw/d2pvt/D2PVT_FLMM_input_HSMSvsHH2O.csv`.
*   **Processing**:
    *   Removes non-informative trial indices.
    *   Extracts photometry readings into a matrix and renames them.
    *   Parses and cleans metadata (IDs, sessions, trial outcomes).
    *   Aligns temporal data by calculating negative timestamps relative to event onset.
    *   Creates a binary "rewarded" status matrix based on approach latency.
*   **Output**: Writes a processed `d2pvt` dataset to the package structure.

### 4. Dependencies
*   **`dplyr`**: Used for data manipulation and variable transformations.
*   **`usethis`**: Used for saving the final processed object into the project structure.

### 5. Analysis Methods
*   **Data Reshaping**: Transforms wide-format time-series readings into a matrix associated with each trial.
*   **Temporal Alignment**: Adjusts time indices to reflect pre-reward and post-reward periods, establishing a consistent reference point for the photometry readings.
*   **Categorical Encoding**: Recodes experimental outcomes ("strawberry milk shake" vs "water") into binary indicators (`SMS`) for model readiness.

### 6. Figures/Outputs
*   **Output Object**: A single processed R data object (`d2pvt`) containing:
    *   `id`: Cleaned mouse identifiers (5 unique mice).
    *   `session`: Numeric session identifiers.
    *   `outcome`: Factor variable for trial type.
    *   `SMS`: Binary indicator for milk shake trial.
    *   `latency`: Behavioral approach latency.
    *   `photometry`: A numeric matrix of signals.
    *   `rewarded`: A binary matrix representing reward delivery status over time.

### 7. Key Parameters
*   **Time indices (`times`)**: The script assumes a specific column layout in the source file, parsing columns 7 through the end as temporal photometry data.
*   **Baseline Correction**: The index `1:24` in the `times` vector is hard-coded as negative, implying a specific fixed sampling window relative to the stimulus or outcome event.

---

## data-raw/lick.R

This file, `data-raw/lick.R`, is a data processing script designed to prepare raw neurophysiological photometry and behavioral data for subsequent analysis.

### 1. Purpose
This script processes raw NWB (Neurodata Without Borders) files containing fiber photometry and behavioral event data (licks and sucrose delivery) from a mesolimbic dopamine study. It aligns, filters, and downsamples these data into a structured format suitable for functional data analysis or statistical modeling.

### 2. Key Functions
*   **`read_matlab`**: Loads HDF5-based NWB data, extracts photometry signals and event logs (TTL pulses), and synchronizes them using `time_align`.
*   **`time_align`**: Uses `data.table` to perform "nearest neighbor" temporal alignment between different data streams (e.g., event timestamps and photometry sampling).
*   **`filter_trials`**: Excludes trials that are too short (based on `min_tm`) or lack sufficient pre-reward photometry baseline.
*   **`index_trials`**: Calculates trial-specific indices for photometry data, facilitating the extraction of windows around reward events.
*   **`get_lick_fun`**: Converts discrete lick timestamps into a downsampled, binned binary time-series covariate representing lick activity per trial.

### 3. Data Flow
1.  **Read**: Pulls raw `.nwb` files from a specified local directory (`data-raw/lick/`).
2.  **Process**: Validates session quality (based on Inter-Reward Intervals), synchronizes photometry/TTL time-series, segments trials, and computes lick rates.
3.  **Structure**: Flattens the trial data into a wide-format dataframe where photometry and lick signals are stored as nested matrices.
4.  **Write**: Saves the processed object as a binary R data file (`data/lick.rda`) using `usethis::use_data`.

### 4. Dependencies
*   **R Packages**: `rhdf5` (for NWB/HDF5 handling), `dplyr` (data manipulation), `data.table` (efficient time-alignment), `usethis` (data saving).
*   **External Data**: Requires data downloaded from the DANDI archive (DANDI:000351).

### 5. Analysis Methods
*   **Temporal Binning/Downsampling**: Reduces the original sampling rate (approx. 125 Hz) to a target rate (12.5 Hz).
*   **Trial Segmentation**: Extracts fixed windows (pre- and post-reward) for functional modeling.
*   **Feature Engineering**: Generates specific behavioral metrics, including Inter-Reward Intervals (IRI) and lick rates calculated over varying windows (0.5s to 2.0s).

### 6. Figures/Outputs
*   **Output**: A single data object named `lick` containing metadata (subject IDs, session, trial number), behavioral metrics (lick rates, IRIs), and two matrices (`photometry` and `lick`) representing signal time-series per trial.

### 7. Key Parameters
*   **Sampling**: `Hz` (125 Hz) and `target_Hz` (12.5 Hz).
*   **Trial Windows**: `pre_reward_length` (0.4s) and `post_reward_length` (1.5s).
*   **Quality Control**: `iri_cutoff` (5s minimum average between rewards) and `min_tm` (3s minimum trial length).
*   **Trial Limit**: Limits the final dataset to the first 50 trials per session.

---

## renv/activate.R

### Analysis of `renv/activate.R`

#### 1. Purpose
`activate.R` is the bootstrap loader for the `renv` package. Its primary purpose is to automatically detect, download, and install the specific version of `renv` required by a project during the R startup process, ensuring project-specific package consistency.

#### 2. Key Functions/Classes
*   **`bootstrap()`**: The primary orchestration function; coordinates directory creation, dependency checking, and the download/installation of the `renv` package.
*   **`renv_bootstrap_download()`**: A high-level selector that attempts multiple methods (CRAN, GitHub, or local archives) to retrieve the correct `renv` tarball/binary.
*   **`renv_ansify_...()` family**: Functions that provide stylized console output (ANSI escape codes) for helpful command links when running in compatible terminals.
*   **`renv_bootstrap_repos()`**: Dynamically resolves the CRAN/repository URLs by checking environment variables, `renv.lock` files, or R global options.
*   **`catf()`**: A helper for formatted console logging that respects suppression flags (silent startup).

#### 3. Data Flow
*   **Reads**: Environment variables (e.g., `RENV_PROJECT`, `RENV_CONFIG_...`), project `renv.lock` files, and global R `options()`.
*   **Processes**: Determines the target version of `renv` from the hardcoded `version` variable; verifies library path availability.
*   **Writes**: Downloads the package into a temporary directory; installs the package into the local project library; modifies R search paths and options.

#### 4. Dependencies
*   **R Base Utilities**: Heavily relies on `utils` (e.g., `available.packages`, `download.file`, `untar`, `install.packages`).
*   **Environment**: Interacts with standard system calls via `Sys.getenv`, `Sys.info`, and `Sys.time`.
*   **Internal logic**: Self-contained (bootstrapping script is designed to be monolithic to avoid needing external dependencies before the package itself is loaded).

#### 5. Analysis Methods
*   **Version Pinning/MD5 Validation**: The script uses a hardcoded version string and MD5 hash to ensure the exact environment is recreated consistently.
*   **Fallback Logic**: Implements a cascading logic pattern (e.g., trying binary downloads first, then source, then archive mirrors) to maximize success rates in diverse scientific computing environments (Linux/macOS/Windows).

#### 6. Figures/Outputs
*   **Console Output**: Generates progress messages during the bootstrap process (e.g., "Bootstrapping renv 1.2.3").
*   **Diagnostics**: If `RENV_STARTUP_DIAGNOSTICS` is enabled, it outputs an `Rprof` file containing execution time profiling and functional summaries of the startup process.

#### 7. Key Parameters
*   **`version`**: The exact version string of `renv` required for the project.
*   **`RENV_PROJECT`**: The root directory of the project, used to define the library path.
*   **`RENV_CONFIG_AUTOLOADER_ENABLED`**: A boolean switch to toggle the entire activation process.
*   **`renv.bootstrap.repos`**: Allows users to specify custom repository URLs (e.g., internal CRAN mirrors) for package installation.
*   **`RENV_CONFIG_STARTUP_QUIET`**: Suppresses startup console logs for cleaner automation in CI/CD or production pipelines.

---

## revdep/README.md

This file is an automated report generated by the R package `revdepcheck` (or a similar reverse dependency checking tool). It documents the environment and dependency state during a reverse dependency check process.

### 1. Purpose
This file serves as an audit log for a reverse dependency check, recording the computing environment (OS, R version, software versions) and the status of project dependencies to ensure code compatibility and reproducibility.

### 2. Key Functions/Classes
*   **None**: This is a static documentation file (Markdown) rather than an executable script.

### 3. Data Flow
*   **Reads**: Aggregates environment metadata from the local system and compares installed package versions against a reference baseline.
*   **Writes**: Generates a summary table of the R environment and a list of project dependencies to aid in debugging build failures.

### 4. Dependencies
*   **Infrastructure**: Relies on R (v4.6.0), RStudio (v2026.04.0), and Pandoc (v3.8.3) for report generation.
*   **Packages**: Lists extensive dependencies spanning statistical modeling (`lme4`, `nlmeU`, `gamm4`), functional data analysis (`fda`, `refund`), and data manipulation/visualization (`dplyr`, `ggplot2`, `tidyr`).

### 5. Analysis Methods
*   **System/Environment Profiling**: Records technical metadata (OS, collation, time zone) used to isolate reproducibility issues.
*   **Dependency Audit**: Performs a version comparison check (indicated by the `old` vs `new` columns), primarily used to identify breaking changes in package updates.

### 6. Figures/Outputs
*   **Environment Table**: Displays system-level configurations.
*   **Dependency Table**: Lists current package versions.
*   **Errors**: Contains a logged error regarding Quarto/Pandoc CLI command failure, identifying a potential breakdown in the documentation rendering pipeline.

### 7. Key Parameters
*   **Environment Settings**: Timezone (`America/Los_Angeles`), Locale (`English_United States.utf8`), and R version (`4.6.0`) are the primary parameters defining the state of the scientific analysis environment.
*   **Note**: The "Revdeps" section is currently empty, suggesting that either no reverse dependencies were triggered or the checking process halted prematurely due to the noted Quarto error.

---

## revdep/cran.md

This file is a standard automated report generated by the `revdepcheck` R package, typically found in repositories for R packages to ensure that updates do not break dependent software on CRAN.

### 1. Purpose
This file provides a summary report of "reverse dependency" checks, which verify whether changes made to the current package cause installation or testing failures in other packages that depend on it. It documents the status of these checks by comparing the development version of the package against the current CRAN version.

### 2. Key Functions/Classes
*   **`revdepcheck` (contextual):** While this is a report file, it is the output of the `revdepcheck` R package functions (e.g., `revdep_check()`). There are no active functions or classes defined within the `.md` file itself.

### 3. Data Flow
*   **Reads:** Consumes results from `R CMD check` processes run on the local machine or CI environment for all identified reverse dependencies.
*   **Writes:** The file is written by the `revdepcheck` package to provide a human-readable summary of the check outcomes.

### 4. Dependencies
*   **R CMD check:** The underlying system-level utility used by R to verify package integrity.
*   **`revdepcheck` R package:** The developer tool used to orchestrate the check process.

### 5. Analysis Methods
*   **Regression Testing:** Employs comparative testing (comparing CRAN vs. dev versions) to identify breaking changes.
*   **Automated Diagnostics:** Uses standardized R package building and testing protocols to detect errors, warnings, or notes in the reverse dependency ecosystem.

### 6. Figures/Outputs
*   **Text Report:** A Markdown-formatted summary containing:
    *   The total number of reverse dependencies checked.
    *   The count of new problems encountered.
    *   The count of packages that failed to check (e.g., due to installation errors).

### 7. Key Parameters
*   **None defined in this file.** (Note: The behavior of the check that *produced* this file is typically controlled by arguments in the `revdep_check()` command, such as `check_dir`, `num_workers`, and `timeout`.)

---

## revdep/failures.md

### Analysis Summary: `revdep/failures.md`

Based on the provided content, here is the structured summary for the file:

1. **Purpose**: This file acts as a status log for "reverse dependency" checks, specifically documenting whether dependent packages successfully pass tests against a new version of the main project. Its sole purpose is to report the current state of these integration tests.

2. **Key Functions/Classes**: None. This is a static documentation/log file.

3. **Data Flow**: 
   * **Reads**: Input is derived from the execution of automated reverse dependency testing tools (likely using an R package development framework like `revdepcheck`).
   * **Writes/Processes**: It writes a human-readable summary of failure statuses to the repository.

4. **Dependencies**: None. It is a product of the repository's CI/CD pipeline or maintenance workflow.

5. **Analysis Methods**: None. The content reflects a pass/fail binary assessment of external package compatibility.

6. **Figures/Outputs**:
   * **Outputs**: A text-based status report. The current state indicates an empty/success result (`*Wow, no problems at all. :)*`).

7. **Key Parameters**: None.

---

## revdep/problems.md

Based on the provided content of `revdep/problems.md`, here is the structured analysis:

### 1. Purpose
This file serves as a status log for "reverse dependency" checks, typically generated by the `revdepcheck` R package. It acts as a report to confirm that the package’s changes have not broken any downstream packages that depend on it.

### 2. Key Functions/Classes
*   **None**: The file contains plain text rather than executable code. It is an output artifact of an automated testing process.

### 3. Data Flow
*   **Reads**: It reads the results of reverse dependency checks performed on packages listed in the repository's dependency tree.
*   **Writes**: The file is written to by the `revdepcheck` framework to document the success or failure of integration tests.

### 4. Dependencies
*   **`revdepcheck`**: An R package designed to check reverse dependencies.
*   **`devtools` / `rcmdcheck`**: Underlying tools used in R package development for automated testing.

### 5. Analysis Methods
*   **Regression Testing**: It employs automated integration testing to ensure backward compatibility across the ecosystem of dependent software packages.

### 6. Figures/Outputs
*   **Summary Report**: The file provides a high-level summary (in this specific case, a confirmation of a "clean" status).

### 7. Key Parameters
*   **N/A**: As the file indicates no problems, there are no specific failing parameters or error logs documented. 

***

**Note for the Researcher:** The file content `*Wow, no problems at all. :)*` indicates that the package's automated integration tests passed successfully. If you encounter issues in the future, this file will be populated with a list of failing packages and links to their respective error logs.

---

## tests/spelling.R

This file is a standard testing utility commonly found in R packages to ensure documentation quality. Here is the structured analysis:

### 1. Purpose
The file serves as an automated quality assurance test to check for spelling errors within the package's documentation, specifically targeting vignettes. It ensures that any typos found in the source code or documentation are identified during the package testing process.

### 2. Key Functions/Classes
*   **`spelling::spell_check_test()`**: A function from the `spelling` package that performs a spell check on the package's manual pages, vignettes, and README files.

### 3. Data Flow
*   **Reads**: It reads the package's documentation files (vignettes, Rd files, etc.) located within the repository structure.
*   **Processes**: It cross-references the text in these files against a dictionary (and potentially a `DESCRIPTION` file's "Language" field or a `inst/WORDLIST` file).
*   **Writes**: It outputs a report to the console or testing logs indicating whether spelling errors were found.

### 4. Dependencies
*   **`spelling` (R package)**: The primary external dependency required to perform the lexical analysis.
*   **R base**: Relies on `requireNamespace` to check for the availability of the testing tool.

### 5. Analysis Methods
*   **Lexical Analysis/Spell Checking**: This is a non-statistical, rule-based text processing method used for maintaining technical documentation standards.

### 6. Figures/Outputs
*   **Console Output**: It generates a textual summary of spelling errors. If `error = FALSE` (as set in this file), it prints the errors to the console without causing the testing pipeline to fail (non-breaking test).

### 7. Key Parameters
*   **`vignettes = TRUE`**: Enables checking of the package’s long-form documentation (vignettes).
*   **`error = FALSE`**: Specifies that the test should not cause an error exit status even if spelling mistakes are found (allowing for a "soft" check).
*   **`skip_on_cran = TRUE`**: Instructs the test to be skipped when running on CRAN (Comprehensive R Archive Network) servers, preventing package submission rejection due to minor spelling discrepancies in localized environments.

---

