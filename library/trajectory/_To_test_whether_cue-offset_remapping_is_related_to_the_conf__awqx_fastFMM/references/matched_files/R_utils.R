# Source: R/utils.R
# Summary: See repo_context.md

#' Get functional covariate names
#'
#' Checks for consistency between the functional domain implied by the outputs
#' and the functional domain of covariates.
#'
#' @param frm the model formula passed to `fui()`
#' @param df the data frame passed to `fui()`
#' @param silent logical for message printing, inherited from `fui()`
#'
#' @return chr vector of detected valid functional covariates
#'
#' @noRd
#' @keywords internal

get_functional_covariates <- function(frm, df, silent) {
  # helper function that gets functional domain length from name
  get_L <- function(column_name) {
    col_indxs <- grep(paste0("^", column_name), names(df))
    if (length(col_indxs) == 1) {
      L <- ncol(df[, col_indxs])
    } else {
      L <- length(col_indxs)
    }
  }

  # Detect functional covariates by matching length to L
  model_formula <- as.character(frm)
  y_name <- model_formula[2]
  L <- get_L(y_name)

  # Get covariate names
  x_names <- all.vars(frm)[-1]

  # Case 1: functional covariates are encoded in a matrix ======================

  # check if any covariates correspond to a multidimensional class
  x_ismatrix <- sapply(x_names,
    function(x) any(class(df[[x]]) == "matrix" | class(df[[x]]) == "AsIs"))
  x_ismatrix <- x_names[x_ismatrix]

  # check matrix columns are correct
  if (length(x_ismatrix) > 0) {
    if (!silent)
      message("Detected functional covariates in matrix columns: ",
              paste0(x_ismatrix, collapse = ", "))

    x_ismatrix_Ls <- sapply(x_ismatrix, get_L)
    if (sum(x_ismatrix_Ls != L) > 0)
      stop("Width of functional covariates not equal to outcome", "\n",
           "Expected ", L, ", found ", paste0(x_ismatrix_Ls, collapse = ", "))

    x_ismatrix <- x_ismatrix[x_ismatrix_Ls == L]
  }

  # Case 2: functional covariates are multiple columns =========================

  # count number of columns associated with each covariate name
  x_ncols <- sapply(x_names,
    function(x) length(grep(paste0("^", x), names(df))))

  x_ncols <- x_names[x_ncols > 1]

  if (length(x_ncols) > 0) {
    if (!silent) message(
      "Detected functional covariates by shared column names: ",
      paste0(x_ncols, collapse = ", "))

    x_ncols_Ls <- sapply(x_ncols, get_L)
    if (sum(x_ncols_Ls != L) > 0) stop(
      "Width of functional covariates not equal to outcome", "\n",
      "Expected L = ", L, ", found ", paste0(x_ncols_Ls, collapse = ", "))

    x_ncols <- x_ncols[x_ncols_Ls == L]
  }

  # Checking argument consistency ==============================================

  fun_covs <- c(x_ismatrix, x_ncols)
  fun_exists <- length(fun_covs) > 0

  if (fun_exists & !silent)
    message("Functional covariate(s): ", paste0(fun_covs, collapse = ", "))

  # Stops `fui` function execution
  if (!fun_exists) stop("No functional covariates found.")

  fun_covs
}

#' Check arguments related to parallelization
#'
#' Checks for consistency between the number of cores specified and whether the
#' parallelization is called by the user.
#'
#' @param is_parallel the value for `parallel` passed to `fui()`
#' @param num_cores the value for `n_cores` passed to `fui()`
#' @param silent inherited from `fui()`
#'
#' @return list containing the corrected arguments for `parallel` and `n_cores`
#'
#' @importFrom parallel detectCores
#' @noRd
#' @keywords internal

check_parallel <- function(is_parallel, num_cores, silent) {
  correct_parallel <- is_parallel
  correct_cores <- num_cores
  max_cores <- parallel::detectCores()

  if (is_parallel & is.null(num_cores)) {
    warning(
      "`n_cores` not specified for parallel = TRUE.", "\n",
      "Defaulting to no parallelization, i.e., single-core processing.", " ",
      "For parallel processing, consider using 3/4ths of available cores,", " ",
      "i.e., setting `n_cores = 0.75 * parallel::detectCores()`."
    )
    correct_parallel <- FALSE
    correct_cores <- 1
  }

  if (!is.null(num_cores)) {
    if (!is_parallel & num_cores > 1) {
      warning(
        "`n_cores` > 1 but `parallel` is set to FALSE.", "\n",
        "Assuming parallelization is intended."
      )
      correct_parallel <- TRUE
    }

    # ensure the specified number of cores does not exceed available cores
    if (num_cores > max_cores) {
      warning(
        "Value for `n_cores` exceeds `parallel::detectCores()`.", "\n",
        "Setting `n_cores` to one fewer than `detectCores()`."
      )
      correct_cores <- max(max_cores - 1, 1)
    }
  }

  if (!silent & correct_parallel) {
    message("Parallelizing `fui()` over ", correct_cores, " cores.")
  }

  list(
    parallel = correct_parallel,
    n_cores = correct_cores
  )
}
