# Source: R/lick-data.R
# Summary: See repo_context.md

#' Jeong et al. (2022) licking behavior data
#'
#' Photometry recordings from head-fixed mice administered sucrose at random
#' intervals. Observations are identified by subject ID, session, and trial
#' number. Columns are downsampled for convenience.
#'
#' @name lick
#' @docType data
#' @format A data frame with 2120 rows and 94 columns:
#' \describe{
#'  \item{id}{Unique mouse ID}
#'  \item{session}{Session}
#'  \item{trial}{Trial}
#'  \item{lick_rate_050, lick_rate_100, lick_rate_150, lick_rate_200}{The average licking rate 0.5, 1.0, 1.5, and 2.0 seconds after sucrose administration}
#'  \item{iri}{The inter-reward interval relative to the previous lick}
#'  \item{photometry}{Photometry recordings over the trial}
#'  \item{lick}{Whether a mouse was licking at a time point}
#' }
#' @source \url{https://dandiarchive.org/dandiset/000351/draft} Jeong H, Taylor
#'   A, Floeder JR, Lohmann M, Mihalas S, Wu B, Zhou M, Burke DA, Namboodiri
#'   VMK. Mesolimbic dopamine release conveys causal associations. Science. 2022
#'  Dec 23;378(6626):eabq6740. doi: 10.1126/science.abq6740.
#'
#' @references Jeong H, Taylor A, Floeder JR, Lohmann M, Mihalas S, Wu B, Zhou
#' M, Burke DA, Namboodiri VMK. Mesolimbic dopamine release conveys causal
#' associations. Science. 2022 Dec 23;378(6626):eabq6740. doi:
#' 10.1126/science.abq6740. Epub 2022 Dec 23.

"lick"
