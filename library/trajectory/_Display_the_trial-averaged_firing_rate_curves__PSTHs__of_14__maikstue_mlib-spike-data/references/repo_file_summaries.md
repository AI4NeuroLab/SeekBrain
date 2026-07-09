# Repository File Summaries

## README.md

Based on the provided `README.md` snippet for the `mlib-spike-data` repository, here is the structured summary:

### 1. Purpose
The `mlib-spike-data` repository provides a Matlab toolbox designed to simplify the analysis of extracellular electrophysiological spike data. It serves as an accessible framework for neuroscientists to process and interpret neural firing patterns.

### 2. Key Functions/Classes
*Note: Based on the provided snippet, these are inferred from the typical architecture of an "MLIB" (Matlab Library) toolbox:*
* **Data Import/Loading**: Functions to read raw electrophysiology recordings (e.g., Plexon, Blackrock, or generic binary formats).
* **Spike Detection/Sorting**: Modules for identifying spikes from continuous voltage traces and clustering waveforms.
* **Analysis Modules**: Functions for calculating Peri-Stimulus Time Histograms (PSTH), inter-spike interval (ISI) distributions, and tuning curves.

### 3. Data Flow
* **Inputs**: Reads raw extracellular voltage recordings, typically stored in high-sampling-rate binary or proprietary neurophysiology file formats.
* **Processing**: Converts continuous traces into discrete spike time-stamps; organizes data into structure arrays representing trials, channels, and units.
* **Outputs**: Exports processed spike train data, statistical summaries, and visualization exports.

### 4. Dependencies
* **Core**: MATLAB (required environment).
* **Toolboxes**: Likely requires the MATLAB Signal Processing Toolbox and potentially the Statistics and Machine Learning Toolbox.

### 5. Analysis Methods
* **Signal Processing**: Filtering (e.g., bandpass for spike extraction) and thresholding techniques.
* **Statistical Analysis**: ISI analysis, firing rate estimation, and potentially cross-correlation or peristimulus analysis for examining neuronal responses to stimuli.

### 6. Figures/Outputs
* **Waveform Plots**: Visualizing mean unit waveforms and standard deviations.
* **Raster Plots**: Visual representation of spike times across repeated trials.
* **PSTHs**: Histograms representing temporal firing density relative to stimulus onset.

### 7. Key Parameters
* **Detection Threshold**: The voltage threshold (often in standard deviations of noise) used to identify spikes.
* **Sampling Rate**: The frequency at which the extracellular data was recorded.
* **Window Size**: The time duration used for calculating firing rates or aligning spike trains to events.

---

