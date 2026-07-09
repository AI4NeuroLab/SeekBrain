# Source: data-raw/d2pvt.R
# Summary: See repo_context.md

# Description ##################################################################

# Data were sourced from Machen et al. (2025), which is currently available as a
# preprint but has been accepted for publication. Only data from trials where
# hungry mice chose from strawberry milk shake or water were included here.
#
# Briana Machen, Sierra N. Miller, Al Xin, Carine Lampert, Lauren Assaf, Julia
# Tucker, Sarah Herrell, Francisco Pereira, Gabriel Loewinger, Sofia Beas. [The
# encoding of interoceptive-based predictions by the paraventricular nucleus of
# the thalamus D2+ neurons](https://doi.org/10.1101/2025.03.10.642469). bioRxiv
# (2025).
#
# Currently, the data are not available online.

# Libraries ####################################################################

library(dplyr)

# Processing data ##############################################################

# Reading the original data
raw <- read.csv("data-raw/d2pvt/D2PVT_FLMM_input_HSMSvsHH2O.csv")

  # Cleaning predictors ========================================================

# Trial_no is over all mice and session and is not informative
d2pvt <- select(raw, -Trial_no)

# In the original recordings, photometry readings are labeled as "X[time]"
# These will be placed in a matrix in d2pvt$photometry.

# The time stamps in the column name will be relevant later for aligning the
# trial length with the measures.

photo_cols <- grep("^X", colnames(d2pvt))
photometry <- d2pvt[, photo_cols]
colnames(photometry) <- paste0("photometry_", 1:length(photo_cols))
d2pvt <- d2pvt[, -photo_cols]
# This renaming is just for clarity
colnames(d2pvt) <- c("id", "session", "outcome", "latency", "trial")

# add back photometry data
d2pvt$photometry <- as.matrix(photometry)

# Convert session from character to numeric
d2pvt$session <- as.numeric(gsub("^S", "", d2pvt$session))

# Clean up ID by removing the date and L#. There should only be 5 unique mice.
d2pvt$id <- gsub("^[[:digit:]]{8}\\_", "", d2pvt$id)
d2pvt$id <- gsub("\\_L[[:digit:]]+$", "", d2pvt$id)

# Make outcome a factor and also a binary indicator column for clarity
d2pvt <- d2pvt %>%
  mutate(outcome = as.factor(outcome)) %>%
  mutate(outcome = relevel(outcome, ref = "H-H2O")) %>%
  mutate(SMS = as.numeric(outcome) - 1) %>%
  relocate(SMS, .after = outcome)

  # Aligning measurements to time ==============================================

# Remove "X." from the column names
times <- as.numeric(gsub("^X(\\.)*", "", colnames(raw)[7:ncol(raw)]))
# Convert times before zero seconds to negative
times[1:24] <- -times[1:24]

# Create indicators of whether the mouse has been reward by a given time
latencies <- raw$Approach_Latency
rewarded <- do.call(rbind,
  lapply(latencies, function(x) as.numeric(times >= x))
)
colnames(rewarded) <- paste0("rewarded_", 1:length(times))
# Join columns
d2pvt$rewarded <- rewarded

# Saving data ##################################################################

usethis::use_data(d2pvt, overwrite = T)
