# Source: NEWS.md
# Summary: See repo_context.md

# fastFMM (development version)

# fastFMM 1.0.1

* `fui()` now only calls `get_functional_covariates()` for `concurrent = TRUE`, preventing issues with finding columns with shared prefixes (#8)
* Rebuilt under R 4.6.0
* Step 3.1 in `G_estimate_randint()` now calls `message()` instead of `print()` to be consistent with other messages
* References to Xin et al. (2025) reflect publication of the reviewed preprint on eLife
* Additional comments and spacing changes in `fui.R`

# fastFMM 1.0.0

* Added concurrent models to `fui()`, allowing for fitting data with both functional outcomes and functional covariates. 
* Rewrote all standard functions to S3 generics to allow for the same functions to handle both non-concurrent and concurrent functionality. This may need to be refined into S4 and R6 to prevent strange function exports. 
* Added documentation for various helpers, which are exported somewhat messily to allow for the main calculation of `fui()`.
* Added datasets `lick` and `d2pvt` to demonstrate `fui()` in the vignettes `fastFMM` and `d2pvt`, respectively. These datasets replace the previously used synthetic data. 
* Updated references to the concurrent model (Xin et al. (2025)) and the data (Jeong et al. (2022), Machen et al. (2025)).
* Minor bug fix in `plot_fui()`'s. Adding `geom_segment()` axes no longer rely on the deprecated `ggplot2::aes_string()` method.
* Setting `parallel = TRUE` now requires `n_cores` to be manually specified. This avoids problems with asking for too many simultaneous processes on high-performance clusters if the user does not strictly specify the number of available threads. 

# fastFMM 0.4.0

* Provided pointers to a Python package to call fastFMM from Python.
* Provided pointers to user guides written in Python.
* Updated reference/citations on documentation.

# fastFMM 0.3.0

* Fixed bugs.
* Added (optional) parallelization of step 3.2 in analytic inference fui(), leading to substantial speed ups of fui().
* Added in parallelization functionality for PCs.
* Added in code to remove rows with missing functional outcome values and added in option to impute with longitudinal FPCA (experimental feature).
* Changed default method of moments estimator to MoM=1 (appears to perform comparably to MoM=2 but is much faster and less memory intensive).
* Removed some fui() arguments that were not in use.
  
# fastFMM 0.2.0

* Fixed several bugs.

# fastFMM 0.1.0

* Initial CRAN submission.
