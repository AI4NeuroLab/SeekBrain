I want to process motion-corrected neuronal calcium signals and compute regional average calcium activities fish by fish, save those processed data in Figure1_dff_fish*.npy and Figure1_region_series_dff_fish*.npy, respectively, and stored in PROCESS_DATA_DIR. The core experimental data are stored in data.hdf5 files. Zebrafish atlas and regional information is in the atlas folder.
For analysis:
1. Preprocessing: Load the raw fluorescence data (data.hdf5). Correct artifacts in the first frame by copying the values from the second frame.
2. Baseline Correction & Normalization: Compute the relative fluorescence change (ΔF/F0) for all neuronal time series. Estimate the baseline using a Gaussian-filtered minimum filter with a temporal window of 300 time steps, sigma1=3, and sigma2=60.
3. Regional Averaging: Calculate the mean activity for each region. For each region, mask the pixel-wise ΔF/F0 data using the corresponding region_labels and compute the average trace.
4. Output: Save the regional average time series to Figure1_region_series_dff_fish*.npy and the pixel-wise data to Figure1_dff_fish*.npyin PROCESS_DATA_DIR.
For visualization of regional time-series traces:
1. Panel Layout:
  1. Set figsize=(5, 6).
  2. Turn off standard axis borders and ticks.
2. Draw regional time-series traces of fish 2:
  - Load regional calcium traces and exclude regions listed in Figure1_excluded_regions.npy.
  - Apply a 1D Gaussian filter (sigma=1) to the regional trace. Then, normalize the smoothed trace (min-max scaling) for each region.
  - Apply a vertical offset (0.5) for stacking.
  - Draw the traces in black with a linewidth of 0.5.
3. Annotations:
  - On the right side, Place the region acronym text (from top to bottom, starting with OE and ending with VSL). Apply a vertical offset (0.5) for stacking. Ensure to exclude regions listed in PROCESS_DATA_DIR/Figure1_excluded_regions.npy.
  - On the far rightside, add the label "Anterior <–––> Posterior" to indicate anatomical orientation along the vertical axis. Avoid covering region acronyms.
  - On the left side, label the axis as "Regional fluorescence (normalized)".
  - Add a scale bar at the bottom left corner labeled "2 min" to indicate the time span corresponding to that bar.
  - Highlight the visual stimulation period (approx. 11th–14th minute) with an orange patch spanning the full vertical extent and label it "stimuli".