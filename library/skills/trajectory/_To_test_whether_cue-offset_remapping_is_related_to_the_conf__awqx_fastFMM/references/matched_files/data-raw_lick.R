# Source: data-raw/lick.R
# Summary: See repo_context.md

# Description ##################################################################

# Data is available in DANDI
# Jeong, Huijeong; Taylor, Annie; Floeder, Joseph R ; Lohmann, Martin; Mihalas,
# Stefan; Wu, Brenda; Zhou, Mingkang; Burke, Dennis A; K Namboodiri, Vijay Mohan
# (2022) Jeong et al (2022) Mesolimbic dopamine release conveys causal
# associations (Version draft) [Data set]. DANDI archive.
# https://dandiarchive.org/dandiset/000351/draft

# Use the DANDI Python CLI
# dandi download DANDI:000351/draft

# The relevant files are in the folders "subj-HJ-FP-(F|M)[[:digit:]]"
# The following code assumes that the contents of the folders have been dumped
# into some directory (we'll use "data-raw/lick")
# These files have the form "subj-HJ-FP-(F|M)[[:digit:]]_ses-Day[[:digit:]]"

# Parameters ###################################################################

# Directory of data
raw_dir <- "data-raw/lick/"
if (!require("rhdf5")) renv::install("bioc::rhdf5")
library(dplyr)

# IDs
ids <- c(
  'HJ-FP-M2',
  'HJ-FP-M3',
  'HJ-FP-M4',
  'HJ-FP-F1',
  'HJ-FP-F2',
  'HJ-FP-M6',
  'HJ-FP-M7',
  'HJ-FP-M8'
)

n           <- length(ids) # no. subjects
iri_cutoff  <- 5 # avg. min. length between sucrose deliveries
session_max <- 11
session_min <- 1
Hz          <- 1 / 0.008 # experiment sampling rate
target_Hz   <- 12.5 # target sample rate
label_lick  <- 5 # the label for the lick event
label_rwd   <- 7 # sucrose delivery
label_end   <- 0 # trial stop
min_tm      <- 3 # min. trial length per trial
trial_num   <- 100 # trials per session

# Parameters for trial length w.r.t. reward delivery
pre_reward_length       <- 0.4  # length of pre-reward period
pre_lick_reward_period  <- 0.5
post_lick_reward_period <- 1 # 1 second after
post_reward_length      <- 1.5 # 2 seconds after reward period ends

silent <- F # boolean for suppressing messages

# Functions ####################################################################

# Read MATLAB files
# f_name: chr file name

read_matlab <- function(f_name) {
  dat <- rhdf5::h5read(file = f_name, name = "/acquisition")

  # event time ttls
  ttls <- as.data.frame(
    cbind(
      dat$eventlog$eventtime,
      dat$eventlog$eventindex
    )
  )
  colnames(ttls) <- c("time", "event")

  dat_photo <- rhdf5::h5read(
    file = f_name,
    name = "/processing/photometry/dff"
  )

  dat_photo <- as.data.frame(do.call(cbind, dat_photo))
  dat_photo <- dat_photo[!is.na(dat_photo$data), ]

  ttls <- time_align(
    time_truth = dat_photo$timestamps,
    data = ttls,
    name = "time"
  )

  return(
    list(dat_photo = dat_photo, ttls = ttls)
  )
}

# Align trials to the same ground truth time
# written by Gabriel Loewinger
# time_truth: is a vector of timestamps for the (usually photometry) timepoints
# to align to (ground truth)
# data: dataset w/ timestamps to change to align to the time_truth
# name: column name in "data" variable
# save_time : whether to save original time variable

time_align <- function(
  time_truth,
  data,
  name = "timestamps",
  save_time = FALSE
){
  data_new <- data.table::as.data.table( data[name] )
  # vector of times we want to align with ground truth (photometry times)
  tm <- data.table::data.table(time_temp = as.numeric(time_truth) )
  tm[, time_aligned := time_truth]

  # column name in data file that we want to align to ground truth
  data.table::setkeyv(data_new, name)
  data.table::setkeyv(tm, c('time_temp'))

  data_new <- as.data.frame( tm[data, roll='nearest'] )

  # delete original time variable
  if(!save_time){
    data_new <- subset(data_new, select = -time_temp )
    colnames(data_new)[ colnames(data_new) == "time_aligned" ] <- name
  }

  return(data_new)

}

# Filter trials based on minimum length min_tm
# dat: list output of read_matlab

filter_trials <- function(dat) {
  ttls <- dat$ttls
  dat_photo <- dat$dat_photo

  reward_times <- ttls$time[which(ttls$event == label_rwd)]
  keep_trials <- rep(T, length(reward_times))

  # Remove trials that are shorter than min_tm
  short_trials <- unique(which(diff(reward_times) < min_tm) + 1)
  keep_trials[short_trials] <- F

  # Remove trials that start too early for sufficient photometry data
  pre_min_tm <- pre_reward_length + pre_lick_reward_period
  photo_start <- min(dat_photo$timestamps)
  early_trials <- I(reward_times - photo_start <= pre_min_tm)
  keep_trials[early_trials] <- F

  keep_trials
}

# Downsample indices
# pre_samps: integer number of samples before the trial aligner
# L: integer size of the functional domain
# downsample_by: integer of how many entries to skip (-1)

downsample_indices <- function(pre_samps, L, downsample_by) {
  pre_idx <- sort(-seq(-pre_samps, -1, by = downsample_by))
  post_idx <- seq(
    pre_samps + downsample_by, L, by = downsample_by
  )
  unique(c(pre_idx, post_idx))
}

# Get indices for the included trial timepoints
# dat: list output of read_matlab
# keepers: vector output of filter_trials
# downsample: boolean of whether to downsample

index_trials <- function(dat, keepers, downsample = T) {
  # Setup variables, filtering by keepers
  reward_times <- dat$ttls$time[which(dat$ttls$event == label_rwd)][keepers]

  pre_min_tm <- pre_reward_length + pre_lick_reward_period
  pre_samps <- pre_min_tm * Hz

  post_min_tm <- post_reward_length + post_lick_reward_period
  post_samps <- post_min_tm * Hz

  # Get trial indices
  trial_idx <- sapply(
    reward_times,
    function(x) {
      reward_idx <- which.min(abs(x - dat$dat_photo$timestamps))
      seq(
        reward_idx - pre_samps,
        reward_idx + post_samps
      )
    }
  )

  # Return as-is if no downsampling required
  if (!downsample)
    return(trial_idx)

  downsample_by <- round(Hz / target_Hz)
  downsample_idx <- downsample_indices(
    pre_samps, nrow(trial_idx), downsample_by
  )

  # Return downsampled trials
  trial_idx[downsample_idx, ]
}

# Averaged number of licks in reward period
# dat: list output of read_matlab
# lick_period: seconds after reward delivery to track lick

get_lick_rate <- function(dat, lick_period = 0.5) {
  reward_times <- dat$ttls$time[which(dat$ttls$event == label_rwd)]
  lick_times <- dat$ttls$time[which(dat$ttls$event == label_lick)]

  sapply(
    reward_times,
    function(x) {
      lick_tot <- sum(
        lick_times > x & lick_times <= (x + lick_period)
      )

      # if (downsample) {
      #   lick_tot / round(target_Hz * lick_period)
      # } else {
      #   lick_tot / round(Hz * lick_period)
      # }
      lick_tot / lick_period
    }
  )
}

# Get lick as a functional covariate
# dat: output of read_matlab
# trial_idx: output of index_trials

get_lick_fun <- function(dat, trial_idx, downsample = T) {
  # Get the lick observations
  lick_times <- dat$ttls$time[which(dat$ttls$event == label_lick)]
  lick_idx <- sapply(
    lick_times,
    function(x)
      which.min(abs(x - dat$dat_photo$timestamps))
  )
  # Creating a new vector of the lick observations
  lick_obs <- rep(0, length(dat$dat_photo$timestamps))
  lick_obs[lick_idx] <- 1

  if (!downsample) {
    as.data.frame(
      apply(trial_idx, 1, function(x) lick_obs[x])
    )
  }

  # Return "1" if a lick occurs in the region of the downsample
  downsample_by <- round(Hz / target_Hz)
  apply(
    trial_idx,
    1,
    function(row_idx) {
      sapply(
        row_idx,
        function(x)
          as.numeric(sum(lick_obs[(x - downsample_by + 1):x]) > 0)
      )
    }
  ) %>%
    as.data.frame()
}

# Formatting data ##############################################################

lick_list <- mapply(
  function(id, s) {
    # Create file name
    f_name <- paste0(raw_dir, "sub-", id, "_ses-Day", s, ".nwb")
    # Check for file existence and return early if not found
    if (!file.exists(f_name))
      return()
    # Read and align ttls and photometry data
    dat <- read_matlab(f_name)

    # Stop function if IRI is too low
    iri_length <- mean(
      diff(dat$ttls$time[dat$ttls$event == label_rwd])
    )

    if (!silent) {
      message(id, s, " mean(IRI): ", round(mean(iri_length), 2), "s.")
    }
    # Return early if mean IRI too short
    if (iri_length < iri_cutoff) {
      return()
    }

    # Filter trials
    keepers <- filter_trials(dat)
    if (sum(keepers) < 1)
      return()

    # Align trials and label the photometry data
    trial_idx <- index_trials(dat, keepers, downsample = T)
    photo_df <- apply(trial_idx, 1, function(x) dat$dat_photo$data[x]) %>%
      as.data.frame()
    colnames(photo_df) <- paste0("photometry_", 1:ncol(photo_df))

    # Get the functional covariate of lick
    downsample_by <- round(Hz / target_Hz)
    lick_df <- get_lick_fun(dat, trial_idx, downsample_by)
    colnames(lick_df) <- paste0("lick_", 1:ncol(photo_df))

    # Get IRI
    iri <- c(
      dat$ttls$time[dat$ttls$event == label_rwd][1],
      diff(dat$ttls$time[dat$ttls$event == label_rwd])
    )
    # Get lick times, totals, and probability
    sess_info <- data.frame(
      id = id,
      session = s,
      trial = (1:length(keepers))[keepers],
      lick_rate_050 = get_lick_rate(dat, 0.5)[keepers],
      lick_rate_100 = get_lick_rate(dat, 1.0)[keepers],
      lick_rate_150 = get_lick_rate(dat, 1.5)[keepers],
      lick_rate_200 = get_lick_rate(dat, 2.0)[keepers],
      iri = iri[keepers]
    )

    return(cbind(sess_info, photo_df, lick_df))
  },
  rep(ids, session_max - session_min + 1),
  rep(session_min:session_max, each = length(ids))
)

lick_full <- do.call(rbind, lick_list)
# downsample trials
lick <- filter(lick_full, trial <= 50)
rownames(lick) <- NULL

# store multiple columns as matrix columns
photometry <- lick %>% select(photometry_1:photometry_43) %>% as.matrix()
lick_mat   <- lick %>% select(lick_1:lick_43) %>% as.matrix()

lick <- lick %>% select(-photometry_1:-lick_43)
lick$photometry <- photometry
lick$lick <- lick_mat

usethis::use_data(lick, overwrite = T)
# save(lick, file = "data/lick.rda")
