# Repository Overview

This repository serves as the official documentation and supporting infrastructure for **SpikeGLX**, a high-performance software suite developed by HHMI for the acquisition and management of electrophysiological data, specifically designed for high-density silicon probes (Neuropixels) and National Instruments (NI) data acquisition systems.

---

### 1. Repository Purpose
The repository provides the technical foundation, user guidance, and configuration documentation for the SpikeGLX software. Its primary goal is to ensure high-fidelity neural data acquisition, hardware diagnostics (Built-In Self-Tests), and synchronization between complex probe-based input streams and experimental hardware (e.g., OneBox, PXIe).

### 2. Data Pipeline
*   **Acquisition**: Hardware (Probes/NI devices) streams raw binary data.
*   **Gating & Triggering**: Incoming signals are filtered via user-defined triggers (TTL/Spike/Timed) and gate modes to determine which data is written to disk.
*   **Calibration & Setup**: Before and during acquisition, signals are processed via IMRO tables (gain/reference/bank mapping) and hardware-level calibration files.
*   **Storage**: Data is saved as multi-stream raw binary files (`.bin`) paired with standardized metadata files (`.meta`) for downstream analysis.
*   **Real-Time Visualization**: Data is buffered in parallel to storage, enabling real-time monitoring via the Graphs/ShankView windows with optional spatial filtering (CAR) and spectral processing.

### 3. Key Scripts & Their Roles
*   **`FileViewer`**: The primary utility for inspecting, navigating, and exporting subsets of large binary recordings.
*   **`BIST` (Built-In Self-Test)**: Critical suite for diagnostic validation of hardware connectivity, noise floors, and broken probe shanks.
*   **`IMRO Editor`**: Interface for configuring probe-specific channel readout banks, reference site selection, and signal conditioning.
*   **`CalSRate`**: Tool for post-acquisition sample rate verification using square-wave calibration signals.
*   **`ColorTTL`**: Visualization utility that overlays event markers on neural traces based on auxiliary TTL inputs.

### 4. Analysis Methods Implemented
*   **Spatial Filtering**: Implements Common Average Referencing (CAR) and neighborhood-based subtraction using geometry maps (`~snsGeomMap`).
*   **Signal Processing**: Online high-pass/low-pass filtering, DC offset removal, and bin-max downsampling for high-sample-rate displays.
*   **Temporal Validation**: Statistical analysis of sample rate stability, standard error calculation, and drift detection.
*   **Hardware Diagnostics**: Statistical thresholding of amplifier noise floors (<10 µV target) and signal path integrity verification (≥90% connectivity).

### 5. Outputs & Figures
*   **Binary/Metadata Pairs**: The primary output (e.g., `runName_gX_tY.bin` + `runName_gX_tY.meta`).
*   **Diagnostic Logs**: Status reports identifying hardware failures (e.g., `Error 44`).
*   **Visualizations**: Real-time heatmaps of probe shank activity, voltage-vs-time traces, and spike-band histograms.
*   **Surveys**: Exported subsets of probe data representing specific anatomical or bank-based segmentations.

### 6. Dependencies & Environment
*   **Software Framework**: Built on **Qt (6.9.1)** and **C++**. 
*   **Interoperability**: Extensive use of MEX interfaces for MATLAB integration and custom C++ APIs for hardware control.
*   **Hardware Drivers**: Requires NI-DAQmx (National Instruments), FTDI drivers (OneBox), and specific probe firmware versions.
*   **Platform**: Designed primarily for Windows-based high-performance acquisition workstations.

### 7. File Dependency Graph
*(Conceptual hierarchy of documentation references)*

*   **Core System:** `README.md` $\rightarrow$ `UserManual.md` $\rightarrow$ `Agenda.txt` (Change Logs).
*   **Hardware Setup:** `DevTab_Help.md` $\rightarrow$ [`BIST_Help.md`, `HST_Help.md`, `Firmware_Help.md`, `Slot_Help.md`].
*   **Probe Configuration:** `IMTab_Help.md` $\rightarrow$ [`IMRO_T0_Help.md`, `Force_Help.md`].
*   **Visualization/Analysis:** `Graphs_Help.md` $\rightarrow$ [`ShankView_Help.md`, `FileViewer_Help.md`, `ColorTTL_Help.md`, `Audio_Help.md`].
*   **Metadata/Sync:** `Metadata_Help.md` $\leftarrow$ [`SaveTab_Help.md`, `GateTab_Help.md`, `CalSRate_Help.md`].

*(Note: The repository relies on `Metadata.html` and various `.md` help files to bridge the gap between UI configuration and binary data interpretation.)*

Repository Structure:
  Agenda.txt (23411 chars)
  LICENSE.txt (1513 chars)
  Markdown/Audio_Help.md (4838 chars)
  Markdown/BIST_Help.md (11375 chars)
  Markdown/CalSRate_Help.md (1851 chars)
  Markdown/ColorTTL_Help.md (1844 chars)
  Markdown/DevTab_Help.md (7504 chars)
  Markdown/FileViewer_Help.md (12284 chars)
  Markdown/Firmware_Help.md (3309 chars)
  Markdown/Force_Help.md (2560 chars)
  Markdown/GateTab_Help.md (1921 chars)
  Markdown/Graphs_Help.md (7383 chars)
  Markdown/HST_Help.md (2750 chars)
  Markdown/IMRO_T0_Help.md (3571 chars)
  Markdown/IMTab_Help.md (9638 chars)
  Markdown/Metadata_Help.md (87726 chars)
  Markdown/Metrics_Help.md (8815 chars)
  Markdown/NIClock_Help.md (4005 chars)
  Markdown/NITab_Help.md (18666 chars)
  Markdown/OBXTab_Help.md (5883 chars)
  Markdown/SaveTab_Help.md (1454 chars)
  Markdown/ShankView_Help.md (8581 chars)
  Markdown/SimProbes_Help.md (2459 chars)
  Markdown/Slot_Help.md (5176 chars)
  Markdown/SpikeGLX_Broken_Shank_Support.md (10355 chars)
  Markdown/SpikeGLX_FAQ.md (13304 chars)
  Markdown/SpikeGLX_OneBox_Quickstart.md (18918 chars)
  Markdown/SpikeGLX_PXIe_Quickstart.md (21063 chars)
  Markdown/SpikeGLX_Quadbase_Quickstart.md (13291 chars)
  Markdown/SpikeView_Help.md (1208 chars)
  Markdown/SyncTab_Help.md (6244 chars)
  Markdown/SystemRequirements_PXI.md (30311 chars)
  Markdown/SystemRequirements_Xilinx.md (1961 chars)
  Markdown/TrigTab_Help.md (2493 chars)
  Markdown/UserManual.md (55235 chars)
  Markdown/WavePlan_Help.md (7306 chars)
  Markdown/pandoc-commandline.txt (376 chars)
  Markdown/tutorial_toc.md (780 chars)
  NI/Readme.txt (377 chars)
  QLed-LGPLv2-LICENSE.txt (25296 chars)
  README.md (4841 chars)