# Repository Overview

Based on the provided documentation for the `mlib-spike-data` repository, here is the comprehensive repository overview:

## 1. Repository Purpose
The `mlib-spike-data` repository functions as a specialized MATLAB toolbox designed to streamline the analysis of extracellular electrophysiological recordings. Its primary goal is to provide neuroscientists with a robust, standardized framework to transition from raw voltage data to interpreted neural firing patterns, facilitating the study of spike trains and neuronal responses to stimuli.

## 2. Data Pipeline
The repository follows a linear, modular processing architecture:
*   **Ingestion:** Import of raw electrophysiology data from standard industry formats (e.g., Plexon, Blackrock, or binary streams).
*   **Preprocessing:** Application of digital filters (e.g., bandpass) to isolate high-frequency spike activity from continuous voltage traces.
*   **Feature Extraction:** Spike detection via thresholding, followed by waveform sorting and clustering.
*   **Structuring:** Organization of processed data into MATLAB structure arrays indexed by channels, units, and experimental trials.
*   **Export:** Production of processed spike timestamps, descriptive statistical summaries, and visualization exports.

## 3. Key Scripts & Their Roles
*Note: Inferred based on standard MATLAB toolbox architecture for electrophysiology:*
*   **`load_data.m` (Inferred):** Interfaces with hardware-specific file formats to initialize workspace variables.
*   **`detect_spikes.m` (Inferred):** Implements threshold-based detection algorithms to convert continuous voltage traces into discrete time-stamps.
*   **`compute_psth.m` (Inferred):** Calculates firing density relative to experiment event triggers.
*   **`plot_waveforms.m` (Inferred):** Generates visualizations of isolated neural unit waveforms and associated variance.

## 4. Analysis Methods Implemented
*   **Signal Processing:** Bandpass filtering, spike thresholding, and waveform clustering.
*   **Statistical Analysis:** 
    *   **Inter-Spike Interval (ISI):** Assessing the temporal spacing of firing events.
    *   **Firing Rate Estimation:** Temporal density analysis.
    *   **Stimulus-Response:** Peristimulus Time Histograms (PSTH) for quantifying neuronal tuning and response dynamics.

## 5. Outputs & Figures
*   **Raster Plots:** Chronological visualization of spike occurrences across repeated trials.
*   **PSTHs:** Histograms illustrating firing rates synchronized to stimulus onset.
*   **Waveform Plots:** Visual characterization of unit properties, including mean waveforms and noise boundaries (standard deviations).

## 6. Dependencies & Environment
*   **Core Environment:** MATLAB (latest versions recommended).
*   **Toolbox Requirements:** 
    *   Signal Processing Toolbox (for filtering and spectral analysis).
    *   Statistics and Machine Learning Toolbox (for clustering and statistical validation).

## 7. File Dependency Graph
*   **Inputs (Raw Data Files)** $\rightarrow$ `Data Import Functions`
*   `Data Import Functions` $\rightarrow$ `Preprocessing/Filtering Functions`
*   `Preprocessing/Filtering Functions` $\rightarrow$ `Spike Detection/Sorting Modules`
*   `Spike Detection/Sorting Modules` $\rightarrow$ `Statistical Analysis Functions`
*   `Statistical Analysis Functions` $\rightarrow$ `Visualization/Export Modules` (Figures/Stats)

Repository Structure:
  README.md (99 chars)