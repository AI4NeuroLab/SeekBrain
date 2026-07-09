# Source: R/d2pvt-data.R
# Summary: See repo_context.md

#' Machen et al. (2025) variable trial length data
#'
#' Data from an experiment where mice ran through a maze where they received
#' either a strawberry milkshake (SMS) or water (H2O) reward. Mice entered the
#' reward zone at variable times.
#'
#' @format A data frame with 1335 rows and 248 columns:
#' \describe{
#'  \item{id}{Unique mouse ID}
#'  \item{session}{Session}
#'  \item{outcome}{The outcome of the trial, either SMS or H2O}
#'  \item{SMS}{Redundant encoding for binary encoding of SMS reward}
#'  \item{latency}{Time, in seconds, for mouse tor each the reward}
#'  \item{trial}{Trial}
#'  \item{photometry}{Photometry recordings at time point}
#'  \item{rewarded}{Whether the mouse had been rewarded by time point}
#' }
#'
#' @source Machen B, Miller SN, Xin A, Lampert C, Assaf L, Tucker J, Herrell S,
#'   Pereira F, Loewinger G, Beas S. The encoding of interoceptive-based
#'   predictions by the paraventricular nucleus of the thalamus D2+ neurons.
#'   bioRxiv (2025).

"d2pvt"

ignore_unused_imports <- function() {
  dplyr::mutate
}
