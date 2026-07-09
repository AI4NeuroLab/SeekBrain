# Repository File Summaries

## Agenda.txt

This file is a **release notes document** (change log) for a scientific software suite—implied to be **SpikeGLX**—used for high-density neural data acquisition (e.g., Neuropixels probes) and integration with National Instruments (NI) data acquisition systems.

### 1. Purpose
This document serves as the chronological history of software development, feature updates, and bug fixes for the repository. It tracks the evolution of data acquisition capabilities, remote API features, and signal processing workflows from 2016 to 2026.

### 2. Key Functions/Classes
*   **FileViewer**: Primary class for visualizing and exporting acquired neural and auxiliary data files.
*   **ShankViewer/Graphs**: UI components for real-time visualization of probe geometry, spike waveforms, and data traces.
*   **Remote/API**: A suite of functions for controlling hardware and data streams via MATLAB, C++, or remote network protocols.
*   **IMRO Editor**: Interface for editing "Imec Registration" (IMRO) files, which define channel mappings, gain, and filtering on the probe.
*   **OneBox (OBX)**: Support for OneBox hardware integration, including firmware management and analog/digital I/O control.

### 3. Data Flow
*   **Reads**: Raw hardware data streams (IMEC/NI/OBX), custom probe geometry maps, IMRO configuration files, and firmware binaries.
*   **Writes**: Multi-stream binary data files, metadata (HTML/TXT formats), calibration logs, and "missed sample" error reports.
*   **Process**: Data is acquired from hardware, filtered (e.g., bandpass, CAR filters), optionally triggered/gated, and saved to disk while simultaneously being buffered for real-time visualization.

### 4. Dependencies
*   **Frameworks**: Qt (version 6.9.1 noted), C++ (core language), MATLAB (via custom MEX interfaces like `CalinsNetMex.mexw64`).
*   **Hardware Drivers**: NI-DAQmx (implied), FTDI (for OneBox), and firmware drivers for various Neuropixels probe models (NP1.0, NP2.0, NP2020, NP2021).

### 5. Analysis Methods
*   **Signal Processing**: Common Average Referencing (CAR), bandpass filtering, LFP survey calculation, and histogram generation.
*   **Statistical/Error Monitoring**: RMS/Standard Deviation calculation for signal quality, detection of "missed samples" (data loss), and bit-error rate assessment during acquisition.
*   **Calibration**: Automated rate calibration, outlier detection for probe health, and BIST (Built-In Self-Test).
*   **Geometry/Anatomy Mapping**: Parsing of probe geometry maps (`~snsGeomMap`) and anatomical region mapping ("Pinpoint anatomy") for spatial trace coloring.

### 6. Figures/Outputs
*   **Visualizations**: Real-time heatmaps, traces (AP/LF bands), and shank geometry representations.
*   **Metadata**: `Metadata.html` or associated text files capturing run-specific configuration, probe serial numbers, sample rates, and timestamps.
*   **Exports**: Exported heatmaps, survey statistics, and segmented data clips via FileViewer.

### 7. Key Parameters
*   **Acquisition**: `Sync period`, `Sample rate` (NI/IMEC), `Low latency mode`, and `Settle time`.
*   **Configuration**: `Gain` settings, `IMRO` channel subsets, `Filter` coefficients, and `Trigger/Gate` timing offsets.
*   **System Flags**: `Broken shank` assessments, `Firmware versions`, and `Error flags` (e.g., `obErrFlags`, `imErrFlags`).

---

## LICENSE.txt

Based on the provided content of `LICENSE.txt`, here is the structured analysis:

1. **Purpose**: 
This file serves as the legal documentation defining the open-source licensing terms for the software repository. It grants users permission to use, modify, and redistribute the software while establishing disclaimer protections for the Howard Hughes Medical Institute (HHMI).

2. **Key Functions/Classes**: 
N/A (This is a legal document, not a functional code file).

3. **Data Flow**: 
N/A.

4. **Dependencies**: 
N/A.

5. **Analysis Methods**: 
N/A.

6. **Figures/Outputs**: 
N/A.

7. **Key Parameters**: 
The document specifies three core conditions for use:
*   **Attribution**: Preservation of the copyright notice and disclaimer in source/binary distributions.
*   **Non-Endorsement**: Prohibition against using HHMI or contributor names for product promotion without prior written consent.
*   **Liability Disclaimer**: The software is provided "as is," explicitly disclaiming all warranties and liability for damages arising from its use.

---

## Markdown/Audio_Help.md

This file serves as documentation for the audio monitoring features within the SpikeGLX software, which is used for electrophysiological data acquisition.

### 1. Purpose
This document explains how to configure and use the audio monitoring system in SpikeGLX. It provides guidance on real-time signal monitoring, troubleshooting audio artifacts (like crackle), and managing system resources during high-load recordings.

### 2. Key Functions/Classes
*   **Audio Monitor Configuration**: Interface for selecting input streams, mapping channels to stereo output (left/right ears), and applying bandpass filtering.
*   **Audio Resampler**: A background process that bridges the gap between high-frequency electrophysiological sampling rates and Windows-compatible audio driver sample rates.
*   **Automatic Latency Reset**: A built-in controller that detects high-latency states and restarts the audio stream to maintain temporal alignment.

### 3. Data Flow
*   **Input**: Raw or IM-filtered electrophysiological streams (from Imec probes or NI hardware).
*   **Processing**: Signal undergoes optional bandpass filtering and resampling to match Windows audio driver specifications.
*   **Output**: Streamed to the Windows sound driver for output via PC speakers or headphones.

### 4. Dependencies
*   **Hardware**: Windows audio drivers (system-level dependencies).
*   **Internal**: Refers to `IMTab_Help.html` (specifically regarding IM-filtered streams) and the `ShankViewer` utility for channel selection.
*   **External (Hardware)**: Compatible with A-M Systems 3300 Audio Monitor boxes via BNC output.

### 5. Analysis Methods
*   **Filtering**: Provides real-time high-pass and low-pass filtering. A 0.1 Hz high-pass filter is recommended to eliminate DC offset, which helps prevent clipping and audio artifacts.
*   **Resampling**: The system performs on-the-fly resampling to handle the mismatch between neural data acquisition rates and fixed Windows audio device rates.
*   **Latency Monitoring**: Continuous internal monitoring of audio lag, with thresholds typically between 110 ms and 200 ms depending on the source (NI vs. Imec).

### 6. Figures/Outputs
*   **Audio Feedback**: Real-time auditory output allowing researchers to monitor signal quality or unit activity.
*   **Visual Indicators**: Metrics window feedback to monitor system instability caused by high audio load.

### 7. Key Parameters
*   **Bandpass Filters**: High-pass and low-pass settings for signal conditioning.
*   **Stream Source**: Toggles between raw data and IM-filtered streams (which include global demux CAR).
*   **Channel Mapping**: Configurable mapping for left and right audio channels, controllable via Click-and-Play or the ShankViewer.
*   **Volume**: Adjustable gain levels; caution is advised against high volume to prevent clipping and frequency compression artifacts.

---

## Markdown/BIST_Help.md

This file serves as technical documentation for the **Built-in Self Tests (BIST)** system used in a high-density neurophysiological recording system (likely associated with SpikeGLX). It outlines procedures for validating hardware integrity and diagnosing connectivity or probe-specific failures.

### 1. Purpose
This document provides a reference guide for the automated self-test suite used to debug the base station, headstage, and probe subsystems. It defines testing criteria for identifying critical hardware failures versus non-critical, qualitative performance issues.

### 2. Key Tests
The system executes a suite of diagnostic tests, categorized by functional area:
*   **Connectivity Tests**: *Base Station* (PC to FPGA), *Heartbeat* (probe clock/power validation), and *SerDes Link* (high-speed data communication).
*   **Memory & Config Tests**: *I2C/Memmap* (probe settings interface) and *EEPROM* (version/part data storage).
*   **Hardware Integrity**: *Shift Registers* (shank configuration) and *Parallel Serial Bus* (data line verification).
*   **Performance Metrics**: *Signal Path* (signal fidelity check) and *Noise Level* (amplifier noise floor validation).

### 3. Data Flow
*   **Input**: The system writes test patterns/signals to registers (I2C/Memmap) or specific data lanes (PSB).
*   **Processing**: The BSC (Base Station Connect) FPGA or PC software analyzes the returned signals, checking for "Ack" bytes, clock signals (1 Hz), or PRBS data stream integrity.
*   **Output**: Pass/Fail status for each test module; potential diagnostic error messages (e.g., `Error 44 'NO_LINK'`).

### 4. Dependencies
*   **Hardware Interface**: PXIe bus, ZIF connectors, and Omnetics connectors.
*   **Software Ecosystem**: SpikeGLX (version 20250930 or later for broken shank support), ShankViewer for visual diagnostics, and CatGT/Ecephys pipeline for channel masking.

### 5. Analysis Methods
*   **Iterative R/W Verification**: Confirms register settings by writing, reading back, modifying, and restoring values.
*   **Pattern Matching**: Compares recorded data against known pseudo-random binary signal (PRBS) patterns to verify bus reliability.
*   **Statistical Thresholding**:
    *   **Signal Path**: PASS if ≥ 90% of electrodes meet frequency/amplitude tolerances.
    *   **Noise Level**: PASS if < 20% of electrodes exceed AP/LFP noise specs.
*   **Manual/Empirical Assessment**: Uses RMS-offset (`stdv`) calculations and visual inspection in ShankViewer to distinguish between probe noise and environmental electromagnetic interference.

### 6. Figures/Outputs
*   **BIST.png**: A diagram (referenced but not embedded) illustrating the testing architecture.
*   **Diagnostic Logs**: Status reports identifying specific failed subsystems.
*   **ShankViewer Plots**: Visual heatmap of electrode noise and channel connectivity.

### 7. Key Parameters
*   **Tolerance thresholds**: 90% for signal path validity; 20% for noise level failure; ~10 µV for acceptable noise floor (`stdv`).
*   **Test Durations**: The signal/noise tests are noted to require >30 seconds for completion.
*   **Hardware Specs**: 7-9 µV internal noise (model-dependent) for standard operating conditions.

---

## Markdown/CalSRate_Help.md

This file is a help documentation page for a software tool designed to calibrate sample rates of hardware acquisition systems (specifically probes, likely related to neurophysiology given the "imec" reference) using existing binary data files.

### 1. Purpose
This file provides instructional documentation for the `CalSRate` interface, which allows users to analyze sample rate stability in previously recorded binary data containing square wave inputs. It guides users through the process of validating, measuring, and applying corrected sample rate calibrations to metadata.

### 2. Key Functions/Classes
*Note: As this is a help file, it describes features of a UI dialog rather than programmatic classes.*
* **Input Selection**: Allows the user to select specific binary files or entire run-sets for analysis.
* **Analysis Execution (`Go`)**: Triggers the calculation of sample rates based on square wave data.
* **Calibration Application**: Provides the option to update metadata or configure settings for future data acquisition runs based on calculated results.

### 3. Data Flow
* **Read**: Consumes existing binary files and associated probe metadata files.
* **Process**: Analyzes the timing of square wave inputs within the stream to derive the actual sample rate.
* **Write**: Updates probe metadata files with new calibrated rate values if the user selects the "Apply" option.

### 4. Dependencies
* **Metadata files**: Depends on the existing probe metadata architecture of the repository.
* **Metrics/Log modules**: Relies on system-wide logging and metrics tracking (e.g., `Metrics` window) to monitor for dropped samples or imec error flags.

### 5. Analysis Methods
* **Square Wave Analysis**: The core method relies on timing analysis of recorded square wave inputs to calculate clock rates.
* **Statistical Validation**: 
    * Calculates the standard error of the measurements.
    * Compares new measurements against manufacturer defaults (~2 Hz threshold).
    * Compares new measurements against historical calibrations (~0.1 Hz threshold).
* **Temporal Thresholding**: Employs a time-based validation constraint (20-minute minimum required; 40-minute preferred).

### 6. Figures/Outputs
* **Progress Output**: An on-screen display showing analysis progress and comparisons between old and new sample rates.
* **Log/Metrics Windows**: Secondary visual outputs for monitoring errors, warnings, and imec-specific data drops.
* **Updated Metadata**: Persisted data files containing the final calibrated rate values.

### 7. Key Parameters
* **Sample Rate (Hz)**: The primary metric being measured and updated.
* **Standard Error**: The statistical confidence interval for the measurement; used to determine if a calibration is stable.
* **Duration**: The time span of the analyzed sample; used to ensure data quality (>20 minutes recommended).
* **Calibration Thresholds**: The specific variance limits (0.1 Hz for remeasurement, 2 Hz for initial calibration) used to validate data integrity.

---

## Markdown/ColorTTL_Help.md

This document is the help documentation for a utility tool called **ColorTTL**, used within a neurophysiology data acquisition or visualization framework (likely part of a larger system like Open Ephys or a similar electrophysiology platform).

### 1. Purpose
ColorTTL provides a real-time visualization aid that marks specific neural activity events by overlaying color-coded vertical stripes on data graphs. These stripes correspond to the timing of Transistor-Transistor Logic (TTL) input pulses, allowing users to visually correlate external events with neural traces.

### 2. Key Functions/Classes
*Note: As this is a documentation file, it describes functional modules rather than code classes.*
* **Channel Monitor**: Scans auxiliary channels (analog/digital) for voltage transitions.
* **Stripe Renderer**: Applies visual color-coded overlays to online graph panels based on the duration of detected TTL pulses.
* **Thresholding/Debouncing Logic**: Filters incoming signals to distinguish valid pulses from hardware noise.

### 3. Data Flow
* **Input**: Reads voltage data from selected analog channels or digital bit-streams (0–15, 16–31, etc.) within a chosen data stream.
* **Processing**: Performs edge detection (crossing a threshold or state change) and applies debouncing logic (Stay high count).
* **Output**: Writes graphical overlays (vertical stripes) onto the existing GUI graph panels.

### 4. Dependencies
* **Data Streams**: Relies on an existing data acquisition system capable of streaming analog or digital signals.
* **GUI Framework**: Requires an integrated graph panel system (the visualization is restricted to panels within the same "Graphs" window).

### 5. Analysis Methods
* **Threshold Detection**: For analog channels, signals must cross a user-defined voltage threshold.
* **Debouncing (Temporal Filtering)**: Uses a "Stay high count" mechanism where a transition is only registered as "high" if it persists for a specified number of consecutive samples, mitigating signal bounce.
* **Temporal Visual Scaling**: Uses a "Minimum width" parameter to ensure short pulses are visually represented as a stripe wide enough to be discernible at the current display time scale.

### 6. Figures/Outputs
* **Visual Overlays**: Vertical, color-coded stripes applied to online voltage/neural traces.
* **Color Scheme**: Predefined set of four colors (Green, Magenta, Cyan, Orange).

### 7. Key Parameters
* **Stay high count**: The number of consecutive samples a signal must remain above threshold to be considered a valid transition (noise rejection).
* **Minimum width (s)**: The minimum graphical duration (in seconds) for a stripe to ensure visibility regardless of the actual physical pulse width.
* **Threshold**: The voltage level used for analog channels to differentiate high/low states.
* **Bit Selection**: Specific digital channel selection (e.g., bits 0–31).

---

## Markdown/DevTab_Help.md

This analysis pertains to `Markdown/DevTab_Help.md`, a documentation file for the "Devices" tab within the **SpikeGLX** software, which is used for managing electrophysiology hardware (specifically Neuropixels probes and National Instruments DAQ devices).

### 1. Purpose
This file provides user instructions for configuring hardware devices, enabling data streams, and verifying system connectivity within the SpikeGLX interface. It serves as a guide for researchers to map physical hardware slots to logical software identifiers before initiating an experimental recording.

### 2. Key Functions/Operations
*   **Configure Slots**: A dialog-driven workflow to register base station modules and OneBox units into the system.
*   **Detect**: A critical system function that verifies hardware connectivity, serial numbers, and signal integrity across all enabled device ports.
*   **Probe Table Management**: Allows users to enable/disable specific data streams via checkboxes and provides shortcut keys (Alt/Ctrl/Shift-click) for batch configuration.
*   **BIST (Built-in Self Test)**: Automatic hardware diagnostic checks for identifying PSB (parallel-serial bus) errors and broken shank shift register chains.

### 3. Data Flow
*   **Inputs**: Manual user configuration of slots, ports, and docks; manual selection of enabled probes/devices; physical signals from hardware (probes/OneBoxes).
*   **Processing**: SpikeGLX maps physical hardware locations to **Logical Index Numbers** (zero-based IDs) used for internal stream tracking.
*   **Outputs**: System status logs (OK/FAIL), configuration metadata (stored in `.meta` files alongside `.bin` recordings), and logical ID assignments for synchronization and API control.

### 4. Dependencies
*   **Hardware Interface**: Neuropixels base stations and OneBox modules.
*   **External Documentation/References**: 
    *   `Slot_Help.html`: Explains slot, port, and dock architecture.
    *   `SpikeGLX_Broken_Shank_Support.html`: Technical details regarding shank maintenance.
*   **Third-Party Drivers**: National Instruments (NI-DAQ) drivers for NI device communication.

### 5. Analysis Methods
*   **Hardware Diagnostics**: Employs shift-register chain testing to detect internal wiring breaks in probe shanks.
*   **Validation Logic**: Implements pre-run sanity checks comparing device configuration against reported model/serial capabilities to ensure data integrity.

### 6. Figures/Outputs
*   **Messages**: Output feedback in the interface’s message box detailing stream connectivity status.
*   **System Files**: Generates `.meta` configuration files that serve as the official record of experiment settings, encompassing all enabled devices and their parameters.

### 7. Key Parameters
*   **Logical ID**: A zero-based index assigned to each probe or OneBox input stream used for file naming and trigger configuration.
*   **Slot/Port/Dock**: The hierarchical physical address of a device.
*   **Run Settings**: Database-stored preferences that include enabled components and calibration data, allowing for "Detect-then-Run" workflows.
*   **BIST Parameters**: Diagnostics for PSB and shank integrity.

---

## Markdown/FileViewer_Help.md

This file, `FileViewer_Help.md`, serves as the official documentation for the **SpikeGLX File Viewer**, a graphical utility used to visualize and export electrophysiological data recorded by SpikeGLX.

### 1. Purpose
The File Viewer provides a GUI interface to open, inspect, link, and export SpikeGLX binary (`.bin`) data streams. It allows users to manage channel subsets, perform time-domain measurements, and prepare specific data segments for spike sorting or downstream analysis.

### 2. Key Functions/Features
*   **Shank Viewer**: Visualizes probe activity and allows editing of IMRO tables based on observed data.
*   **Linking (Time Axes)**: Synchronizes multiple data streams from the same recording run so that navigation, scrolling, and time-selection are consistent across windows.
*   **Export/Data Subset**: Provides tools to extract specific channel ranges and time intervals into new files.
*   **Survey Export**: Splits large, multi-segment probe survey files into individual segments for separate analysis.
*   **Channel Management**: Allows users to toggle channels (u-flags) on/off, particularly useful for removing noisy channels from spatial filters.
*   **Time Scrolling/Offset**: Provides granular control over navigation, including the ability to shift the temporal reference point of a file.

### 3. Data Flow
*   **Inputs**: Reads raw binary (`.bin`) files and associated metadata (`.meta`) from SpikeGLX runs.
*   **Processing**: Applies real-time visual filters and performs spatial averaging (based on ShankMap/GeomMap metadata).
*   **Outputs**: Produces extracted binary subsets or split survey segment files. The viewer itself is read-only; editing operations do not modify the original data.

### 4. Dependencies
*   **Hardware**: Optionally requires NI-DAQmx (or `SpikeGLX-NISIM.exe` for simulated environments).
*   **External Tools**: Integrates with **CatGT** for post-processing and advanced channel exclusion/filtering.
*   **Internal Components**: Interfaces with `ShankView_Help.html` for specific probe visualization.

### 5. Analysis Methods
*   **Spatial Filtering**: Uses ShankMaps/GeomMaps to determine electrode locations and exclude specific channels (u-flags) from spatial averaging.
*   **Time-Locking**: Uses run identifiers (base name: `myRun_gXXX_tYYY`) to associate related files and synchronize temporal display offsets.
*   **Temporal Measurement**: Calculates duration and offsets based on sample rates and elapsed time relative to hardware-defined T=0.

### 6. Figures/Outputs
*   **Visual Displays**: Oscilloscope-style scrolling graphs of channel data.
*   **Export Files**: New binary/text files representing sub-sections or survey segments.
*   **Metadata**: Exported survey files contain a new `svySegStartSecs` tag to allow for cross-stream time alignment in downstream analysis.

### 7. Key Parameters
*   **`u-flags` (Used-flags)**: Determines whether a channel is included in spatial averaging.
*   **`svySegStartSecs`**: Offset value in seconds from the original file start to the start of an exported survey segment.
*   **File Offset**: Configurable start-time reference used to shift temporal navigation.
*   **`~snsShankMap` / `~snsGeomMap`**: Metadata structures defining electrode layout and channel inclusion status.

---

## Markdown/Firmware_Help.md

This file serves as a technical manual for firmware maintenance of Imec PXIe hardware within the SpikeGLX ecosystem.

### 1. Purpose
This documentation provides instructions for users on how to update, maintain, and recover PXIe device firmware (specifically the BS and BSC modules). It outlines safety procedures for system updates to prevent hardware corruption and details manual recovery steps for failed updates.

### 2. Key Functions/Classes
*Note: As this is a documentation file, "functions" refer to the operational processes described:*
* **Update Procedure**: A guided workflow to select slots, identify firmware technology (std, opto, nxt), and apply updates.
* **Firmware Detection**: A verification process triggered via the `Configure Acquisition` dialog to validate installed firmware versions.
* **Recovery (ISP Mode)**: A hardware-level override ("Secret Button") that forces the module to boot from the "golden" firmware image to allow recovery of a corrupted "normal" image.

### 3. Data Flow
* **Inputs**: The user selects firmware files and target PXIe slots through the SpikeGLX interface.
* **Processing**: The software flashes binary firmware images to the PXIe module's internal memory (specifically the "normal" image partition).
* **Outputs**: Status logs in the console window and updated firmware states reported back to the system's `Detect` function.

### 4. Dependencies
* **SpikeGLX**: The primary software environment required to execute the update/detection dialogs.
* **Hardware**: Specific Imec PXIe modules (BS and BSC) and the associated chassis hardware.

### 5. Analysis Methods
* **Verification Protocol**: The document defines an error-checking routine involving status LEDs and specific error codes (e.g., `PCIE_IO_ERROR`) to diagnose firmware integrity.
* **Redundancy/Fail-safe**: Utilizes a dual-boot memory structure (Golden vs. Normal image) to ensure the hardware remains recoverable even if a standard update fails.

### 6. Figures/Outputs
* **Console Logs**: Used for real-time monitoring of the update process and error reporting.
* **Status LED**: The front-panel light serves as a hardware-level output signaling the operational state of the firmware (e.g., Green = Functional, Black/Off = Corrupted).

### 7. Key Parameters
* **Firmware Tech**: Categorized as `std`, `opto`, or `nxt`.
* **Hardware State**: Defined by the partition currently in use (`Golden` vs. `Normal`).
* **Power Cycle Requirements**: Explicitly requires a 30-second shutdown to ensure complete hardware initialization.

---

## Markdown/Force_Help.md

This file acts as a technical support and configuration guide for the SpikeGLX software, specifically addressing the hardware failure of probe EEPROM chips.

### 1. Purpose
This document provides instructions for users to manually override and calibrate neural recording probes when the on-board EEPROM chip—which normally stores serial numbers and calibration data—is physically damaged or inaccessible.

### 2. Key Functions/Classes
*This file is documentation; however, it references specific UI features within SpikeGLX:*
* **`Detect`**: Refreshes device connection, attempts to read the EEPROM, and resets manual override flags.
* **`Force...` (IM Setup tab)**: Accesses the manual override menu to input serial numbers and load calibration files.
* **`11 -> 9`**: A utility button that converts an 11-digit folder identifier into the required 9-digit serial number.
* **`Same As Last Time`**: A persistence feature to retain override settings across sessions.

### 3. Data Flow
* **Input**: User-provided calibration files (`Comparator`, `Gain`, `Offset`, and `Slope` CSVs) placed in the `SpikeGLX/_Calibration` directory.
* **Processing**: The software maps a manually entered 9-digit serial number to the corresponding calibration directory.
* **Output**: Overrides the default EEPROM-based configuration, allowing the software to process neural data using the provided CSV calibration parameters instead of reading them from the chip.

### 4. Dependencies
* **Software**: SpikeGLX (Electrophysiology data acquisition software).
* **Directory Structure**: Requires a specific `_Calibration` subdirectory within the SpikeGLX root folder.
* **File Format**: Expects four specific CSV files for calibration data.

### 5. Analysis Methods
* **Calibration Override**: Replaces automated hardware-level calibration (ADC gain/offset) with static data files.
* **Serial Number Normalization**: Strips 11-digit identifiers (full probe labels) to retrieve the 9-digit serial number (internal ID).

### 6. Figures/Outputs
* **Figures**: Includes an image file `EEPROM.png` to help users identify the location of the chip on the probe.
* **Outputs**: Provides a structured example of the required folder and file naming conventions necessary for manual probe recognition.

### 7. Key Parameters
* **11-digit Probe Label**: Full identification code (1 + 9-digit serial + option number).
* **9-digit Serial Number**: The primary identifier used by the software for internal logging.
* **Option Number**: A digit representing specific probe hardware configurations (broken EEPROMs default to '4').
* **Skip ADC Calibration**: A high-level bypass flag for use when calibration files are unavailable (not recommended).

---

## Markdown/GateTab_Help.md

This file acts as the documentation and user guide for the "Gates" functionality within a scientific data acquisition or experimental control software.

### 1. Purpose
This file provides instructional documentation for configuring and managing "Gate" modes, which control the timing and state of data recording during experimental runs. It explains how users can automate or manually override the gate trigger signals that determine when the system begins and stops recording data.

### 2. Key Functions/Classes
*   **Immediate Start Mode**: Sets the gate to high automatically upon the start of a run.
*   **Remote Controlled Start/Stop**: Allows external API control (`TriggerGT`) or legacy StimGL commands (`SETGATE`) to toggle the gate.
*   **Manual Override**: A user-facing feature that pauses/resumes gate processing to control file writing and data recording independently of the run status.
*   **`SetRecordingEnable()`**: An API/internal method used to programmatically permit the gate to switch to a high state.

### 3. Data Flow
*   **Inputs**: Trigger signals from external APIs (`TriggerGT`), legacy StimGL commands, or manual user input via the "Enable Recording" button.
*   **Processes**: Evaluates the current gate mode (Immediate vs. Remote) and the status of the Manual Override toggle.
*   **Outputs**: Controls the "Gate" status (High/Low), which dictates whether data is written to files or simply visualized.

### 4. Dependencies
*   **`Graphs` window**: The Gates functionality relies on the UI elements provided by the Graphs module (specifically the `Run Toolbar`).
*   **`SaveTab_Help.html`**: Cross-referenced for information regarding "continuation runs" and file-naming conventions.
*   **External Interfaces**: Requires integration with an external API or the "Gate/Trigger" server for remote commands.

### 5. Analysis Methods
*   **Conditional Logic (Gating)**: Implements state-based control logic to gate data streams based on external triggers or manual authorization, ensuring data is only saved under specific, user-validated conditions.

### 6. Figures/Outputs
*   **UI Components**: The documentation describes an "Enable/Disable Recording" button displayed on the `Run Toolbar` within the `Graphs` window.
*   **File Writing**: The primary "output" of this logic is the permission or suppression of data files being written to storage.

### 7. Key Parameters
*   **Gate Mode**: Selection between "Immediate start" and "Remote controlled."
*   **`Show enable/disable recording button`**: A boolean toggle that enables the manual override feature.
*   **Initial triggering state**: A configuration setting (Enabled/Disabled) that defines the behavior of the gate at the start of a new run.

---

## Markdown/Graphs_Help.md

This file, `Graphs_Help.md`, serves as the technical documentation for the **Graphs Window** interface within the SpikeGLX software, which is used for real-time visualization and monitoring of electrophysiological data streams.

### 1. Purpose
This file provides documentation on how to navigate, control, and configure the graphical interface for monitoring neural data acquisition. It explains how to interact with streaming data, apply real-time visualization filters, and manage recording states during experimental runs.

### 2. Key Interface Modules
*   **Run Toolbar**: Manages acquisition state (Start/Stop), recording triggers, and run notes.
*   **Stream Toolbar**: Controls data presentation parameters (time scaling, magnification, color) and visualization filters.
*   **Page Toolbar**: Manages channel organization, pagination, and custom channel mapping.
*   **Right-Click Menu**: Provides contextual access to audio monitoring, custom channel map editing, and specific hardware-related (Imec) tools.

### 3. Data Flow
*   **Input**: Receives raw stream data from hardware (Imec probes or NIDQ devices).
*   **Processing**: Applies real-time visual-only transformations (e.g., bandpass filtering, spatial averaging, bin-max downsampling) to the raw buffer for display.
*   **Output**: Renders the processed signal to the Graphical User Interface (Graphs Window) for the user. Note that visualization filters **do not** affect the raw data saved to disk.

### 4. Dependencies
*   **Referenced Documentation**: Relies on linked documentation for `GateTab_Help.html`, `SaveTab_Help.html`, `ShankView_Help.html`, and `ChannelMap` configurations.
*   **Hardware Interface**: Dependent on the `imro` table (for Imec probe settings) and hardware-specific stream configurations.

### 5. Analysis Methods
*   **Signal Processing (Visualization only)**:
    *   **Time Averaging**: Subtracts DC components via 5-second interval averages.
    *   **Bin-Max**: Reports extrema in downsample bins to prevent event loss during high-sample-rate visualization.
    *   **Spatial Averaging (Common Reference/CMR)**: Neighborhood-based averaging and subtraction (e.g., local annuli or global probe-wide averaging) to reduce common-mode noise.
    *   **Bandpass Filtering**: Software-level high-pass and low-pass filters applied to AP channels.

### 6. Figures/Outputs
*   **Real-time Trace Plots**: Multi-channel voltage-vs-time plots.
*   **Audio Output**: "Listen" feature for selected neural channels.
*   **Shank View**: Visual representation of probe electrode geometry.
*   **Spike Viewer**: Specialized display for visualizing spike activity in a specific channel.

### 7. Key Parameters
*   **Time Span (`Sec`)**: Range [0.001..30.0] seconds.
*   **Vertical Magnification (`Yscl`)**: Range [0.0..9999.0].
*   **Filter Settings**:
    *   *General*: Neural time averaging, BinMax toggle.
    *   *Imec Specific*: High-pass/Low-pass cutoffs (e.g., 300Hz, 0.5-500Hz) and spatial neighborhood types (`Loc 1,2`, `Loc 2,8`, `Glb All`, `Glb Dmx`).

---

## Markdown/HST_Help.md

This document serves as a technical manual for the **Headstage Tester (HST)** module, a diagnostic tool used to verify the hardware integrity of Neuropixels (NP) 1.0 headstages.

### 1. Purpose
The file provides operational documentation and diagnostic procedures for testing NP 1.0 headstages (used with NP 1.0, NHP, and UHD probes). It outlines the diagnostic routines required to validate hardware connectivity, power delivery, and signal integrity before clinical or experimental use.

### 2. Key Functions/Classes
While this is a Markdown documentation file, it describes the following logical diagnostic routines executed by the HST software module:
*   **Communication Test:** Validates PCLK (serializer clock) and the I2C control bus.
*   **Supply Voltage Test:** Verifies the presence of four critical voltage rails (1.8V/1.2V analog and digital).
*   **Control Signal Test:** Checks the integrity of NRST and REC_NRESET lines.
*   **Master Clock Test:** Confirms the presence of the 93.6 MHz MCLK signal.
*   **PSB Data Bus Test:** Sequentially verifies the connectivity of the PSB_DATA<0:6> and PSB_SYNC signals.
*   **Signal Generator Test:** Checks the functionality of the on-board test signal generator (BIST path).

### 3. Data Flow
*   **Inputs:** The tester utilizes an imec HST dongle connected to the headstage ZIF connector.
*   **Processing:** The HST module performs sequential electrical connectivity checks, monitoring signal locks (PCLK) and voltage levels.
*   **Outputs:** Diagnostic status indicators (pass/fail) for each sub-test, with specific return values for failing signals in the data bus test.

### 4. Dependencies
*   **Hardware:** Requires the imec HST dongle and a compatible base station (BS/BSC).
*   **Software:** References the "HST Diagnostics" dialog interface within the core research software suite.

### 5. Analysis Methods
*   **Continuity/Integrity Testing:** A binary pass/fail verification of electrical paths.
*   **Sequential Logic:** The PSB Data Bus test uses a fail-fast mechanism, stopping at the first detected error.
*   **Signal Verification:** Comparison of measured voltage rails and clock frequencies against expected hardware specifications.

### 6. Figures/Outputs
*   **Summary Table:** Provides a high-level mapping of diagnostic categories (e.g., Communication, Power, Signals) to their respective hardware components.
*   **Status Indicators:** The system provides binary feedback on signal presence (e.g., presence of MCLK) and connectivity.

### 7. Key Parameters
*   **Master Clock:** 93.6 MHz.
*   **Voltage Rails:** 1.8V (analog/digital) and 1.2V (analog/digital).
*   **Bus Width:** PSB_DATA<0:6> (7-bit bus).
*   **Signal Pins:** PCLK, I2C, NRST, REC_NRESET, PSB_SYNC, CAL_SIGNAL, OSC_PDOWN.

***

**Note on Limitations:** The documentation explicitly notes that the current implementation of the HST module cannot detect electrical short-circuits on the serializer input pins.

---

## Markdown/IMRO_T0_Help.md

This document serves as the technical documentation for the **IMRO (Imec Readout) Table (Type-0)** configuration interface within the SpikeGLX software, used for managing electrode settings in Neuropixel probes.

### 1. Purpose
This file provides user instructions for configuring probe channel settings, including electrode bank selection, referencing schemes, gain settings, and filtering options. It explains how to define specific regions of interest on a probe to optimize data acquisition.

### 2. Key Functions/Classes
*   **Big Table:** Interface for channel-by-channel manual configuration.
*   **Set-All Quick Controls:** Global utility for applying uniform settings across all channels.
*   **Center Here Quick Control:** A spatial mapping tool to automatically assign bank numbers, effectively shifting the 384-channel active readout window to a specific depth on the shank.

### 3. Data Flow
*   **Input:** Manual user entry via the GUI or loading of `.imro` files.
*   **Output:** The active configuration is saved to a run-time metadata file (tagged as `~imroTbl`) during data acquisition.
*   **Mapping:** The interface links physical electrode IDs to logical readout channels based on the bank configuration formula: `electrode = (channel+1) + bank*384`.

### 4. Dependencies
*   **Shank Viewer:** Used to identify the target region of interest on the probe shank.
*   **Channel Mapping Dialog:** Used to update the display order in the SpikeGLX graphs once the bank/electrode configuration is modified.
*   **External Link:** Accesses [interesting map files](https://billkarsh.github.io/SpikeGLX/#interesting-map-files) for advanced probe configurations.

### 5. Analysis Methods
*   **Spatial Windowing:** Uses bank switching to restrict the 960 physical electrode sites into a 384-channel readout block.
*   **Signal Referencing:** Provides selection for referencing (External vs. On-shank); the documentation explicitly advises against on-shank references (indices 2–4) due to poor noise cancellation performance in saline.

### 6. Figures/Outputs
*   **`Probe.png`:** A visual schematic representing the relationship between readout channels, banks, and physical electrode sites.
*   **Metadata:** Generates the `~imroTbl` string in the recording metadata, which is essential for post-processing and channel registration.

### 7. Key Parameters
*   **Bank:** Defines the physical switch connection (determines the 384-electrode subset).
*   **Refid:** Specifies the reference source (0: External, 1: Tip, 2-4: Specific on-shank sites).
*   **Gain (AP/LF):** Configurable range: `{50, 125, 250, 500, 1000, 1500, 2000, 3000}`.
*   **AP Filter:** High-pass filter toggle (selectable between 0 or 300Hz, up to 10kHz).
*   **LF Band:** Fixed filter at 0.5Hz – 1kHz.

---

## Markdown/IMTab_Help.md

This file is a help documentation markdown for the **IM (Imec Probe) Tab** in the **SpikeGLX** software, a widely used tool for acquiring and managing high-density electrophysiological data (e.g., Neuropixels probes).

### 1. Purpose
This documentation provides instructions for configuring individual Imec probe settings, including calibration, channel mapping, data acquisition modes, and troubleshooting tools within the SpikeGLX interface. It serves as a user manual for researchers to ensure their probe settings are correctly optimized and saved to the local probe database.

### 2. Key Functions/Categories
*   **Probe Configuration**: Management of IMRO tables, bad channel masking, and saving channel subsets.
*   **Survey Mode**: Automated, sequential scanning of probe banks across shanks to survey larger brain regions.
*   **System Diagnostics**: Features to monitor performance (e.g., Low Latency Mode, Metric Window oversight) and fix probe identification strings.
*   **Data Management**: Database synchronization where settings are persisted by probe serial number and timestamp.

### 3. Data Flow
*   **Reads**: Retrieves probe calibration and historical settings from the `_Calibration` folder database upon detection.
*   **Processes**: Users edit channel maps, IMRO tables, and save-channel lists; the software applies these configurations to the probe hardware via the API.
*   **Writes**: Saves recorded binary/metadata files during acquisition; updates the probe database upon clicking `Verify` or `Run`.

### 4. Dependencies
*   **SpikeGLX Infrastructure**: Relies on `Devices` tab initialization and `Save` tab directory specifications.
*   **Hardware API**: Interfaces with the Imec probe API for hardware-level operations (setting channel "stand-by" mode and ADC calibration).
*   **File Viewer/Shank Viewer**: Cross-references recorded data for visual inspection.

### 5. Analysis Methods
*   **Common Average Referencing (CAR)**: Implemented through global `demux` and metadata-defined geometry maps.
*   **Filtered Streams**: Performs on-the-fly digital bandpass filtering of AP-band signals in parallel to raw streaming to optimize downstream viewing.
*   **Sampling Logic**: Automated looping over shanks and banks for high-coverage survey runs.

### 6. Figures/Outputs
*   **Saved Data**: Generates binary (`.bin`) and metadata (`.meta`) file pairs.
*   **Visualizations**: Outputs used by **ShankViewer** for real-time visualization of electrode activity.
*   **Metrics**: Real-time performance indicators (CPU/RAM usage) to monitor system stability.

### 7. Key Parameters
*   **IMRO Table**: Controls Regions of Interest (ROI), referencing (tip vs. external), and gain/filter settings.
*   **Bad Channels**: Specifies non-functional channels or those to be excluded from CAR calculations.
*   **Save Channels**: Defines the subset of electrodes to commit to disk, including options for automated LF (Local Field) complementation.
*   **Low Latency Mode**: A performance-critical toggle that trades CPU/RAM overhead for reduced data fetching latency.
*   **Calibration Policy**: Determines strictness of imec-provided ADC/gain file usage.

---

## Markdown/Metadata_Help.md

### Analysis Summary: `Metadata_Help.md`

#### 1. Purpose
This file serves as a comprehensive technical documentation reference for the metadata file format used by **SpikeGLX**, a high-performance data acquisition system for electrophysiology. It provides a detailed dictionary of metadata tags, explaining their purpose, data types, and roles in describing experimental recording conditions, hardware configurations, and trigger settings.

#### 2. Key Functions/Classes
*Note: This is a documentation file, not executable code; therefore, it contains no classes or functions.*
*   **Documentation Sections**: Organized by subsystem (e.g., Common, Timed Trigger, TTL Trigger, Spike Trigger, Nidq, Imec, Obx).
*   **Tag Definitions**: Explains metadata keys (e.g., `fileSHA1`, `snsShankMap`, `niSampRate`) used to reconstruct binary data from raw recordings.

#### 3. Data Flow
*   **Inputs**: The document defines the structure of external `.meta` files generated by SpikeGLX.
*   **Processes**: It details how to parse binary data (e.g., `fileSizeBytes` / `sampleRate` / `nSavedChans` / 2 = `fileTimeSecs`).
*   **Outputs**: Defines the configuration schemas for downstream analysis software to correctly interpret raw binary files (`.bin`).

#### 4. Dependencies
*   **Contextual Dependency**: Relies on the SpikeGLX acquisition engine environment.
*   **Data Structure Dependency**: Defines schema logic for binary data streams (`nidq`, `imec`, `obx`).

#### 5. Analysis Methods
*   **Verification**: Describes using SHA1 checksums (`fileSHA1`) to ensure data integrity.
*   **Signal Processing Logic**: Specifies conversion methods for analog-to-digital signals: $V = i \times \text{Vmax} / \text{Imax} / \text{gain}$.
*   **Mapping**: Explains how electrode geometry is mapped through `~snsShankMap` and `~snsGeomMap` for spatial analysis.

#### 6. Figures/Outputs
*   **Documentation Outputs**: It does not generate figures, but describes the format of data viewer outputs (e.g., `FileViewer`, `ShankViewer`).
*   **Binary Data**: Describes the format of saved binary files, specifically the packing of 16-bit signed words and the organization of digital bit-lines within these files.

#### 7. Key Parameters
*   **`fileSHA1`**: Hash for data integrity verification.
*   **`nSavedChans`**: Total count of 16-bit channels saved.
*   **`trgMode`**: Defines the logic for data capture (Immediate, Timed, TTL, Spike, TCP).
*   **`niSampRate`**: Sampling frequency for National Instruments devices.
*   **`~snsShankMap` / `~snsGeomMap`**: Crucial geometric parameters for interpreting electrode spatial arrangements (note: `~snsShankMap` is marked as legacy).
*   **Trigger Parameters**: Includes various thresholding (`trgTTLThresh`), re-arming/refractory periods (`trgTTLRefractS`), and windowing settings (`trgTTLMarginS`).

---

## Markdown/Metrics_Help.md

This document, `Metrics_Help.md`, serves as a technical reference guide for monitoring data acquisition performance and identifying potential hardware or software bottlenecks within the **SpikeGLX** software environment, specifically for use with **imec Neuropixels (NP)** probes.

### 1. Purpose
The file provides documentation for interpreting real-time performance metrics in SpikeGLX. It helps researchers troubleshoot data acquisition issues (e.g., dropped samples, buffer overflows) during high-throughput neural recordings.

### 2. Key Metrics Categories
The document categorizes performance into four monitoring areas:
*   **Errors**: Monitors bit-level hardware communication flags (COUNT, SERDES, LOCK, POP, SYNC, MISS) to detect signal loss or buffer overflows.
*   **Acquisition (FIFO Filling)**: Tracks the occupancy of the hardware buffer on the base station (BS) card to prevent data loss.
*   **Acquisition (Worker Thread Activity)**: Measures CPU utilization of background sub-processes responsible for marshaling probe data.
*   **Disk Performance**: Monitors write buffer occupancy, actual vs. required write rates, and "fetch depth" (the latency of the data writing thread relative to the incoming data stream).

### 3. Data Flow
*   **Input**: Stream data originating from hardware probes (imec devices), moving into an internal hardware FIFO buffer, then to a SpikeGLX history stream, and finally to disk.
*   **Processing**: SpikeGLX worker threads fetch data from the FIFO, while a separate "trigger" client pulls data from the history stream for disk writing.
*   **Logging**: If samples are missed, the system generates a `runname.missed_samples.[type].txt` file capturing the exact sample index and count of zero-padding insertions.

### 4. Dependencies
*   **Hardware**: Specifically dependent on imec Neuropixels hardware (NP1.0, NP2.0, NP202X, NP3XXX).
*   **OS/Environment**: Relies on Windows-based task management and system resource allocation.
*   **SpikeGLX**: Internal to the SpikeGLX acquisition engine.

### 5. Analysis Methods
*   **Status Word Bit-Masking**: Uses specific bit indices (0–11) of a status word to diagnose the root cause of communication failures (e.g., bit 3 for SERDES, bit 5 for POP).
*   **Buffer Monitoring**: Uses threshold-based alerts (e.g., "Good" < 4% full, "Bad" > 20% full) to manage real-time constraints.
*   **Latency Analysis**: Uses a "conveyor belt" model (History Stream) to calculate Fetch Depth, which determines if the writing thread is keeping pace with incoming data.

### 6. Figures/Outputs
*   **Console Status Bar**: Displays real-time metrics like `FileQFill%` and write rates.
*   **Error Logs**: Generates `.txt` files in the data directory recording missed samples (format: `(sample, nzeros)`).
*   **Metrics Box**: A UI element in the software that aggregates warnings/errors during a recording run.

### 7. Key Parameters
*   **FIFO Filling**: 95% is the critical threshold that triggers an automatic stop to prevent data loss.
*   **Worker Activity**: Optimal load is <75% for standard probes; higher thresholds are expected for high-channel-count probes (NP202X/NP3XXX).
*   **Low Latency Mode**: A configuration setting that forces workers to run at 100% capacity without yielding, often used to minimize processing delay at the cost of higher CPU load.

---

## Markdown/NIClock_Help.md

This file serves as documentation for the NI (National Instruments) clock source configuration within the **SpikeGLX** software, a platform used for high-density electrophysiology data acquisition.

### 1. Purpose
This document provides technical instructions on calibrating NI clock sources and configuring sampling parameters to ensure accurate data acquisition. It explains how to manage clock drift, distinguish between simultaneous and multiplexed sampling modes, and mitigate signal artifacts.

### 2. Key Functions/Classes
*This is a documentation file; it does not contain executable code, but describes the following configuration processes:*
* **Calibration Protocol**: The procedure for updating the `Measured_rate` in the configuration file to reflect the true hardware sampling rate.
* **Multiplexing Calculation**: The logic for determining the "safe rate" for serial sampling based on device settling times.
* **Clock Pulse Generation**: The mechanism for deriving specific sampling rates from the device's master timebase using integer division.

### 3. Data Flow
*   **Reads**: `_Calibration\calibrated_sample_rates_nidq.ini` (stores calibrated clock names, set rates, and measured rates).
*   **Processes**: User input regarding hardware capabilities (settle time, channel count, clock source type).
*   **Writes**: Updates the `Measured_rate` value within the `.ini` file based on calibration results.

### 4. Dependencies
*   **SpikeGLX Calibration Features**: Requires the internal SpikeGLX module for measuring and updating clock rates.
*   **NI Device Documentation**: Users must consult the specific National Instruments data sheet for their device model (e.g., S-series, M-series, X-series) to identify settling time requirements.

### 5. Analysis Methods
*   **Clock Correction**: Uses empirical measurement to reconcile the difference between the programmed `Set_rate` and the physical `Measured_rate`.
*   **Settle Time Compensation**: Implements a safety margin calculation for multiplexing hardware: `safe rate = [1/(1/R0 + 1.4e-6 * W)]/nchan` where *W* is the manufacturer-specified settle time.
*   **Ghost Signal Mitigation**: Recommends hardware-level electrical termination (50 Ohm resistors) to prevent cross-talk in multiplexing ADCs.

### 6. Figures/Outputs
*   **Output File**: `_Calibration\calibrated_sample_rates_nidq.ini` (key-value store of calibrated hardware metrics).
*   **Logical Constraints**: Enforces a hardware sampling range of `[100, 1M] Hz`.

### 7. Key Parameters
*   **Set_rate**: The nominal frequency programmed into the clock.
*   **Measured_rate**: The empirically validated frequency.
*   **Settle microsecs (W)**: The time required for the ADC to stabilize between multiplexed channels; critical for maintaining voltage accuracy.
*   **Timebase**: The master frequency of the NI device used to derive internal sampling pulses via integer division.

---

## Markdown/NITab_Help.md

This file is a technical documentation/help guide for the **NI (National Instruments) Tab** within the SpikeGLX software, which is used for configuring electrophysiological data acquisition hardware.

### 1. Purpose
This file provides configuration guidance and hardware requirements for interfacing NI data acquisition devices with SpikeGLX. It details how to set up analog and digital channels, manage timing/clocking, and configure multi-device synchronization for high-density neural recording.

### 2. Key Functions/Categories
*   **Hardware Setup**: Guidelines for choosing NI DAQmx-compatible devices (M, S, X, or 653X series), including selection criteria for simultaneous vs. multiplexed sampling.
*   **Device Management**: Logic for configuring "Primary" and optional "Secondary" devices to function as a unified, time-locked recording system.
*   **Signal Configuration**: Defines the syntax and usage for channel strings (`MN`, `MA`, `XA`, `XD`) to categorize neural, auxiliary, and digital inputs.
*   **Timing Control**: Management of clock sources (internal vs. external) and latency optimization for real-time sample fetching.
*   **Mapping**: Tools for defining shank geometry, channel visualization, and data saving subsets.

### 3. Data Flow
*   **Input**: Raw analog/digital signals are ingested from NI hardware via the DAQmx driver. 
*   **Processing**: SpikeGLX maps these signals based on user-defined strings, applies gain adjustments (for display purposes only), and handles synchronization between dual devices.
*   **Output**: Data is streamed to disk (binary files) and visualized in the software's graph windows.

### 4. Dependencies
*   **Hardware**: Requires National Instruments DAQmx-compatible hardware (e.g., PXIe, PCI, or USB devices).
*   **External Systems**: Supports integration with "Whisper" multiplexer systems.
*   **Documentation Links**: References `NIClock_Help.html` for advanced clock source configuration.

### 5. Analysis Methods
*   **Latency Monitoring**: Implements a latency histogram analysis that reports fetch performance (samples per fetch cycle) to monitor system stability.
*   **Calibration**: Recommends measuring true sample rates (via the "Sync" tab) to ensure data alignment across multiple hardware devices.
*   **Signal Processing Logic**: Includes logic for "settling time" corrections in multiplexed devices to avoid crosstalk/charge carryover.

### 6. Figures/Outputs
*   **Latency Histogram**: A text-based console output providing real-time diagnostic performance metrics for sample fetching loops.
*   **Graph Window**: Visualizes incoming neural and auxiliary signals based on specified gain and channel mapping parameters.

### 7. Key Parameters
*   **Channel Strings (`MN`, `MA`, `XA`, `XD`)**: Define which NI physical channels map to neural, auxiliary, or digital inputs.
*   **Gain (`MN`, `MA` Gain)**: Scaling factors applied to visual data for human-readable plotting.
*   **Sample Rate**: Configurable via internal clock or external hardware triggers.
*   **AI Range (V)**: Voltage bounds for analog-to-digital conversion, critical for balancing resolution against signal saturation.
*   **Low Latency Flag**: A performance toggle that prioritizes reduced sample-access time at the cost of higher CPU overhead.

---

## Markdown/OBXTab_Help.md

This file provides documentation for the **OneBox (Obx) Tab** within the SpikeGLX software. SpikeGLX is a high-performance data acquisition system, and this specific module manages the configuration of hardware-interfaced "OneBox" devices.

### 1. Purpose
This file serves as a user manual/help documentation for configuring individual OneBox data acquisition devices, including their analog/digital channels, voltage thresholds, and signal routing. It explains how settings are managed via a persistent database and applied during device acquisition runs.

### 2. Key Functions/Classes
While this is a documentation file, it describes the following configuration categories managed by the software interface:
* **OneBox Database Management:** Handles persistent storage/retrieval of device-specific settings indexed by serial number.
* **Editing Interface:** Provides grid-based configuration for analog (XA/AO) and digital (XD) channels.
* **Sync/Calibration Integration:** Links with the `Sync` tab to fetch measured hardware sample rates.
* **Copy/Default Utilities:** Bulk operations for applying settings across multiple hardware devices.

### 3. Data Flow
* **Input:** User-defined settings via the GUI table, hardware-detected serial numbers, and calibration data from the `Sync` module.
* **Process:** Settings are validated (e.g., checking for conflicts between XA and AO lists) and saved to the `_Calibration` folder.
* **Output:** Parameters are transferred to the acquisition engine upon clicking `Verify` or `Run` to initiate data stream recording.

### 4. Dependencies
* **SpikeGLX Core:** Relies on the broader SpikeGLX infrastructure for hardware communication.
* **Calibration Folder:** Uses a local directory for storing per-device configurations.
* **SDK:** Interface documentation references the SpikeGLX SDK for remote device control and runtime voltage setting.

### 5. Analysis Methods
* **Digital Thresholding:** Implements a fixed-threshold voltage conversion (A2D) where analog signal amplitudes are converted into 12-bit digital lines (TTL) recorded as an `XD` word.
* **Channel Mapping:** Provides non-destructive logical grouping/sorting for visualization in SpikeGLX graph windows.

### 6. Figures/Outputs
* **Binary Data Stream:** The configuration directly dictates the composition of the recording stream (number of XA channels, inclusion of digital words, and saving subsets).
* **GUI Table:** The interactive element used for viewing and managing device parameters.

### 7. Key Parameters
* **XA/AO Channels:** User-defined lists of active analog input and output channels (e.g., `0:3,7`).
* **A2D Thresholds:** A list of 12 voltages (V) defining the digital conversion points.
* **AI Range:** Configurable input scale settings: `+/- 2.5V`, `5V`, or `10V`.
* **XD (Digital Lines):** Boolean flag determining if the 12 analog channels are digitized into a single 16-bit word.
* **Save Channels:** A filter defining which captured channels are written to disk.

---

## Markdown/SaveTab_Help.md

This file is a documentation resource for the **SpikeGLX** software, specifically detailing the functionality of the "Save" tab within the application's user interface.

### 1. Purpose
This file provides instructional documentation for the "Save" tab in the SpikeGLX interface, guiding users on how to manage annotation metadata, define output file paths, and monitor storage availability. It also explains the logic for naming and continuing data acquisition runs.

### 2. Key Functions/Classes
*Note: As this is a documentation file, there are no executable classes or functions.*
*   **Save Tab UI**: A functional component for managing recording output and metadata.
*   **Run Name Logic**: A naming convention handler that manages the identification of recording sessions (bases and decorators).

### 3. Data Flow
*   **Input**: User-defined "Run name" strings (undecorated vs. decorated).
*   **Processing**: The software validates provided names against existing files in designated "Data Directories" to ensure uniqueness and prevent overwriting.
*   **Output**: Metadata files associated with annotations and formatted data output files (based on the gN/tM structure).

### 4. Dependencies
*   **GateTab_Help.html**: The document references this file for instructions on manual recording overrides, indicating a cross-referenced documentation structure within the SpikeGLX repository.

### 5. Analysis Methods
*   **Disk Space Monitoring**: The software performs a system-level check on available disk space to calculate the maximum potential duration for recording, preventing data loss due to capacity limits.

### 6. Figures/Outputs
*   **Metadata Files**: Stores annotation notes.
*   **Data Files**: Outputs structured according to the `run-name_gN_tM` naming convention, where `g` represents a gate/run index and `t` represents a trigger/time index.

### 7. Key Parameters
*   **Run Name**: The primary identifier for a recording session.
*   **Decorated Name (`run-name_gN_tM`)**: Used for appending data to existing runs (e.g., resuming after an interruption).
*   **Undecorated Name**: Used for initializing a new recording session starting at `g0_t0`.
*   **Data Directories**: The target storage locations checked by the system for existing naming collisions.

---

## Markdown/ShankView_Help.md

This file is a documentation guide for the **Shank Viewer**, a software module within a neurophysiology data acquisition system (likely SpikeGLX) designed to visualize neural activity directly on high-density probe geometries (e.g., Neuropixels).

### 1. Purpose
The Shank Viewer provides a graphical interface for configuring probe channel subsets (IMRO tables) and visualizing neural activity (spike rates, AP/LF amplitudes) in real-time or from offline data files to monitor probe site activity.

### 2. Key Functions/Classes
*   **Edit Tab**: Interface for defining Regions of Interest (ROIs) on the probe shank, editing channel settings (Reference, Gains, Filters), and saving configuration files.
*   **View Tab**: Real-time or offline visualization of signal activity on the probe layout, linked with graph-viewing windows.
*   **Box Logic**: Tools for creating, resizing, and clearing ROIs that determine which channels are sampled/saved.
*   **Data Flow Management**: Orchestrates the transfer of signal chunks between raw data streams, graph displays, and the viewer.

### 3. Data Flow
*   **Online**: Raw data is fetched from the main stream, processed (300Hz high-pass or 0.2–300Hz bandpass), and mapped to the visual probe representation.
*   **Offline (File Viewer)**: Processes stored data, applies optional global Common Average Referencing (CAR), computes spike counts and peak-to-peak voltages, and updates the view based on scroll position.

### 4. Dependencies
*   **Integration with Graph Window**: Interacts with the main "Graphs" window for synchronized data fetching.
*   **External Anatomy Tools**: Interfaces with `Pinpoint` and `Trajectory Explorer` for color-coded anatomical region mapping.
*   **Configuration Files**: Reads/writes IMRO (Impedance/Reference/Offset) configuration files.

### 5. Analysis Methods
*   **Spike Detection**: Uses a threshold-based (`T(-uV)`) method combined with a "stay low" sample-count duration filter to identify individual spike events.
*   **Signal Filtering**: 
    *   300Hz high-pass (AP band).
    *   0.2Hz–300Hz bandpass (LF band).
    *   Global CAR (Common Average Reference) filtering to reduce noise common across channels.
*   **Whole-Probe Survey**: A method to average temporal chunks across probe banks to create a unified activity map.

### 6. Figures/Outputs
*   **Probe Activity Map**: Visual representation of the probe shank with color-coded activity levels.
*   **Channel Selection List**: Generates strings for saving specific subsets of data channels.
*   **Interactive Interface**: Resizable editor and viewer windows for cross-referencing probe pads with signal traces.

### 7. Key Parameters
*   **`T(-uV)`**: Spike threshold (negative voltage).
*   **`Stay low`**: Minimum number of samples the signal must remain below threshold to count as a spike.
*   **`Rqd` (Required)**: Channel count constraint for valid probe configuration.
*   **`Gbl dmx` (Global Demux)**: Toggle for applying global CAR filtering.
*   **`Max row`**: Defines the boundary for excluding electrodes outside of tissue.
*   **`Pix/pad`**: Magnification setting for probe visualization.

---

## Markdown/SimProbes_Help.md

### Code Analysis Report: `SimProbes_Help.md`

#### 1. Purpose
This document provides user instructions for the "Simulated Probes" feature in SpikeGLX. It enables researchers to replay existing binary data files through the system's online processing pipeline, simulating real-time hardware acquisition.

#### 2. Key Functions/Classes
As this is a help/documentation file, it does not contain executable code, but describes the following system interface components:
*   **Simulated Probes Dialog**: Used to enable specific binary files for simulation.
*   **Probe Table**: The central configuration UI where simulated data streams are mapped to hardware addresses.
*   **Devices Tab**: The interface for hardware detection and status monitoring.
*   **File Viewer / Shank Viewer**: External utility tools used to extract and edit IMRO tables from binary files.

#### 3. Data Flow
*   **Input**: Reads `imecNNN.ap.bin` (binary data) and corresponding `.meta` files. If present, it also reads `.lf` (LFP) files.
*   **Processing**: The system replaces standard hardware-level voltage fetching with data streams sourced from the specified files.
*   **Output**: Writes new `.meta` files during the run that incorporate the hardware version/part number data derived from the source files.

#### 4. Dependencies
*   **Meta Files**: Requires paired `.meta` files in the same directory as the binary data to understand file organization.
*   **Hardware Mapping**: Relies on defined slot, port, and dock addresses assigned within the SpikeGLX software.

#### 5. Analysis Methods
*   **Data Replay/Substitution**: The system performs a high-fidelity replay of recorded neural data, ensuring the data flow through the processing pipeline mirrors real-time hardware acquisition.
*   **IMRO Configuration**: By default, IMRO (Impedance/Reference/Offset) tables are sourced from the *target* physical probe configuration rather than the source file, allowing for flexible "mix and match" simulation.

#### 6. Figures/Outputs
*   **Meta Data**: Generates updated meta-data files associated with the simulation run.
*   **System Logs/UI Status**: Displays simulation status and device identification information within the SpikeGLX `Devices tab`.

#### 7. Key Parameters
*   **(Slot, Port, Dock)**: A triple-integer address used to assign simulated data streams to specific hardware slots.
*   **Enable/Disable**: A toggle state that allows users to maintain a catalog of simulation files without requiring all of them to be active simultaneously.
*   **IMRO Table**: The configuration defining probe-specific channel mapping, which can be manually overridden via the `Shank Viewer`.

---

## Markdown/Slot_Help.md

This file is documentation for a scientific software interface used to manage hardware configurations for Neuropixels probe data acquisition.

### 1. Purpose
This document serves as the user manual for the "Configure Slots" dialog, explaining how to logically map physical neurophysiology hardware (PXI modules, OneBoxes, and simulated devices) to the software's probe table. It ensures users correctly identify and enable probe addresses defined by the triplet: `(slot, port, dock)`.

### 2. Key Functions/Interfaces
*   **Configure Slots Dialog**: The primary UI for registering hardware devices, assigning slot indices, and managing dock visibility.
*   **Probe Table**: A centralized UI component where users enable specific probe addresses for a data acquisition run.
*   **Detection Mechanism**: A scanning function that queries USB/PXI buses to auto-populate the slot table with active hardware.

### 3. Data Flow
*   **Input**: User input via the dialog (slot assignments, dock configuration) and hardware detection signals from the system bus.
*   **Storage**: Configuration data is persisted in internal initialization files:
    *   `_Configs/improbetable.ini`: Stores active probe assignments.
    *   `_Configs/imslottable.ini`: Stores OneBox device history.
*   **Output**: The system updates the acquisition state, which dictates which hardware ports are polled during recording, leading to the generation of binary data files and meta-information files (e.g., `.obx.bin/meta`).

### 4. Dependencies
*   **Hardware Interface**: Relies on PXI chassis controllers and USB-based "OneBox" base stations.
*   **File Dependencies**: References `_Configs/improbetable.ini` and `_Configs/imslottable.ini` for persistent device definitions.

### 5. Analysis Methods
*   **System Identification**: Implements a logical address mapping system that allows the software to treat different hardware form factors (PXI vs. USB) uniformly as "slots."
*   **Simulation**: Supports "SIM" slots, allowing for offline analysis or testing by assigning recorded `.bin/meta` files to logical slots.

### 6. Figures/Outputs
*   **Data Outputs**: Generates standard binary data streams (`.bin`) and metadata files (`.meta`).
*   **OneBox Streams**: Specifically generates `Obx` data streams for non-neural analog/digital channels, organized into distinct file sets.

### 7. Key Parameters
*   **Slot Index Ranges**: Defined per device type (PXI: 2–18; OneBox: 20–31; SIM: 40–41).
*   **Port Configuration**: Defines the capacity for connections (4 ports for PXI/SIM, 2 ports for OneBox).
*   **Dock Toggle**: Configurable per-port setting (`1 Dock` vs `2 Docks`) to accommodate the physical ZIF connector differences between NP 1.0 (single dock) and NP 2.0 (dual dock) headstages.
*   **Enable State**: Boolean toggle for each (slot, port, dock) address, determining whether the system will attempt to initialize and record from that specific hardware path.

---

## Markdown/SpikeGLX_Broken_Shank_Support.md

This document outlines the technical policy and implementation details for handling **Neuropixels probes with broken shanks** within the SpikeGLX software (version 20250930 and later).

### 1. Purpose
This file provides documentation and procedural guidelines for users and developers on how SpikeGLX manages "Shift Register (SR) chain errors" in probes. It defines a new, more permissive runtime policy that allows data acquisition from multi-shank probes even if specific shanks are non-functional, provided that certain safety and configuration protocols are followed.

### 2. Key Functions/Classes
While this is a markdown documentation file rather than source code, it describes the behavior of several internal software modules:
*   **`Init()`**: Handles probe communication and initial parameter setup; now bypasses SR-chain checks if a previous error was flagged.
*   **`writeConfiguration()`**: Downloads electrode and reference settings; toggles between "Full Error Checking" and "Disabled" modes based on detected shank health.
*   **IMRO Editor**: The UI tool for channel/shank selection, now updated with visual cues (red 'X') for broken shanks.
*   **Survey Mode**: An acquisition mode that enables sampling across all functional shanks, updated to handle non-zero start-indices.

### 3. Data Flow
*   **Input**: Shift Register test results (BIST-SR) are collected at the `Detect` phase.
*   **Metadata**: SR status is recorded in the `.meta` files associated with every run.
*   **Processing**: Configuration logic dictates whether to proceed with standard checking or skip error verification based on the `Detect` report.
*   **Output**: Produces binary data files (acquisition) and logs settings into IMRO configuration files.

### 4. Dependencies
*   **Neuropixels Hardware Interface**: The policies are dependent on the specific probe architecture (NP1.0 vs. 2.0 vs. Quad-Base).
*   **SpikeGLX Runtime**: Relies on the `Detect` routine to populate metadata for the `Verify`/`Run` validation logic.

### 5. Analysis Methods
*   **Shift Register Chain Validation**: The software performs a two-pass push/collection of values to verify data integrity in the probe’s circuitry.
*   **BIST-SR (Built-In Self-Test)**: A mandatory diagnostic test run at `Detect` to identify hardware-level communication failures in the electrode/reference selection chain.

### 6. Figures/Outputs
*   **IMRO Editor Visuals**: Red "X" overlays indicating non-functional hardware.
*   **Meta files**: Updates to internal metadata schemas, including `~svySBTT` (survey bank-transition table) to account for varying start points in surveys.
*   **Error Reports**: System-level notifications in the Acquisition/Run configuration dialog.

### 7. Key Parameters
*   **`Include probe checks`**: Toggles whether a PSB BIST test is performed (the SR test itself is now mandatory).
*   **`Nrows` / `New boxes`**: Used in IMRO configuration to isolate functional channels during file saving, particularly for Quad-Base probes.
*   **`Full shank`**: A configuration option used when isolating data from functional shanks.

---

## Markdown/SpikeGLX_FAQ.md

This file is a technical FAQ for **SpikeGLX**, a high-performance software application designed for the acquisition and visualization of neural data (specifically from Imec Neuropixels probes and National Instruments DAQ hardware).

### 1. Purpose
The `SpikeGLX_FAQ.md` file serves as a troubleshooting and best-practices guide for users operating the SpikeGLX data acquisition system. It provides documentation on system requirements, data integrity, remote operation, and common graphics or configuration issues.

### 2. Key Functions/Modules (Conceptual)
While this is a documentation file, it refers to several core functional components:
*   **File Viewer**: A built-in module for time-locked review of synchronized neural and auxiliary data streams.
*   **Command Server**: An interface allowing external control (MATLAB, Python, C#/C++) of acquisition parameters and runtime events.
*   **Data Acquisition Engine**: The primary module responsible for managing hardware interfaces (NI-DAQ/Imec probes) and ensuring consistent, high-throughput file writing.
*   **Metrics Monitor**: A utility (accessed via `Ctrl+M`) that tracks system health (buffer status, throughput) to prevent data loss.

### 3. Data Flow
*   **Input**: Raw neural signals from Imec probes and auxiliary inputs from NI-DAQ devices.
*   **Processing**: Data is aggregated into a central stream for real-time visualization and synchronized storage.
*   **Output**: High-bandwidth storage of binary (`.bin`) data files and associated metadata (`.meta`) files containing timestamps, sampling rates, and configuration checksums.

### 4. Dependencies
*   **Hardware Drivers**: Requires specific OpenGL-compatible graphics drivers and appropriate vendor drivers for National Instruments (NI-DAQ) hardware.
*   **External Interfaces**: Supports integration via MATLAB, Python, and C/C++.
*   **OS/Environment**: Primarily Windows-based; relies on local folder structures rather than registry entries for configuration.

### 5. Analysis Methods
*   **Data Integrity Recovery**: The file provides manual instructions for correcting file headers/metadata (e.g., `fileSizeBytes`, `fileTimeSecs`) and truncating corrupted data segments using command-line tools (e.g., `head`) in the event of a system crash.
*   **System Health Monitoring**: Implements a real-time bottleneck detection system where the software monitors FIFO (First-In-First-Out) queue fill percentages and hardware pull rates, triggering graceful shutdowns if thresholds (>5%) are exceeded.

### 6. Figures/Outputs
*   **Log Files**: `runname.errors.txt` for post-crash diagnostics.
*   **Visualizations**: Real-time graph panels and shank views generated through OpenGL.
*   **Console Output**: Live display of system metrics (e.g., `imec%`, `nidq%` fill levels, write rates in MB/s).

### 7. Key Parameters
*   **`nSavedChans`**: Total number of recorded channels used to calculate file size and byte-alignment.
*   **`xxSampleRate`**: The acquisition sampling rate (e.g., `niSampleRate`, `imSampleRate`), essential for reconstructing data after a crash.
*   **`fileSHA1`**: A checksum parameter in the meta file required for the File Viewer to validate data integrity.
*   **Command Server Port**: A user-defined network port allowing multiple instances of SpikeGLX to be controlled simultaneously from a single host.

---

## Markdown/SpikeGLX_OneBox_Quickstart.md

This file, `SpikeGLX_OneBox_Quickstart.md`, serves as the primary technical documentation and installation guide for the "OneBox" hardware interface within the SpikeGLX electrophysiology software ecosystem.

### 1. Purpose
The document provides setup, configuration, and troubleshooting instructions for integrating the OneBox—a compact, USB-based neural data acquisition unit—into SpikeGLX. It ensures users can properly connect hardware, install specific drivers, and configure data streams alongside existing PXI-based basestations.

### 2. Key Functions/Sections
*   **Driver Management**: Guides users through the installation of the FTDI D3XX (v1.3.0.10) driver and provides a recovery procedure for incompatible newer versions (1.4.0.x).
*   **Device Configuration**: Details the "Configure Slots" workflow, which maps physical OneBox units (via serial numbers) to logical (slot, port) identifiers to unify them with legacy PXI configurations.
*   **Sync Logic**: Explains the synchronization protocol using 0-5V TTL signals via the SMA 1 back-panel port, including master-slave device relationships.
*   **I/O Management**: Describes the configuration of the 12 configurable ADC/DAC channels through the breakout board or front-panel SMA connectors.

### 3. Data Flow
*   **Input**: Receives neural data from imec headstages (via front panel ports) and analog signals (via ADC channels).
*   **Sync**: Processes a 1 Hz square wave for cross-stream alignment using the TPrime tool.
*   **Output**: Produces `.bin` (raw binary data) and `.meta` (metadata) files formatted similarly to standard SpikeGLX PXI outputs (e.g., `_obx0.bin` files for OneBox-specific streams).

### 4. Dependencies
*   **Hardware**: OneBox USB 3.0 device; FTDI FT601 chip.
*   **Software**: SpikeGLX (requires specific versions for automatic driver checking); optional NI-DAQmx (for `SpikeGLX.exe` vs `SpikeGLX_NISIM.exe`).
*   **Drivers**: FTDI D3XX driver v1.3.0.10.

### 5. Analysis Methods
*   **Time-Alignment**: Uses a common 1 Hz sync pulse recorded in bit #6 of each stream's SY channel to allow for sub-millisecond event time mapping across different recording hardware.
*   **Multiplexing**: The system handles multiplexed ADC inputs and specifies the need for proper termination (e.g., 50-ohm) to avoid crosstalk on unused channels.

### 6. Figures/Outputs
*   **Hardware Figures**: Includes labels for the back panel (Power, USB, Sync) and front panel (Status LEDs, Neural ports, DAC/ADC/SDR connectors).
*   **Configuration Outputs**: Generates `.meta` files containing hardware configuration parameters and `.bin` files containing 16-bit word-stream data (neural data + SY channel bits).
*   **UI Screenshots**: Provides visual guides for the "Configure Slots" dialog and Device Manager driver status.

### 7. Key Parameters
*   **Slot IDs**: User-assigned identifiers in the range [20, 31].
*   **ADC Input Range**: Configurable via the `Obx` tab in SpikeGLX (±2.5V, ±5V, or ±10V).
*   **DAC Output Range**: Fixed at ±5V.
*   **USB Settings**: Disabling "USB selective suspend" is mandatory for system stability.
*   **Sync Source**: User-selectable in the configuration dialog; dictates whether the device is an input or output for the common sync signal.

---

## Markdown/SpikeGLX_PXIe_Quickstart.md

This file serves as a comprehensive technical manual for setting up and configuring the SpikeGLX software environment for PXIe-based hardware used in electrophysiology research.

### 1. Purpose
This document provides a step-by-step guide for integrating imec Neuropixels PXIe modules, National Instruments (NI) I/O modules, and host computer systems within the SpikeGLX ecosystem. It details hardware installation, driver management, synchronization (Sync) strategies, and software configuration.

### 2. Key Functions/Classes
While the document is a guide rather than source code, it describes the operation of several system-level components within the SpikeGLX suite:
* **SpikeGLX.exe**: The main application for acquiring data from imec probes, OneBoxes, and NI hardware.
* **SpikeGLX_NISIM.exe**: A version of the acquisition software that excludes NI hardware dependencies.
* **Firmware Update Tool**: A system utility (Tools::Update Imec PXIe Firmware) for ensuring compatibility between the hardware API and the imec PXIe module firmware.
* **Slot Configuration**: An interface to map physical PXIe slots to the software's probe display table.

### 3. Data Flow
* **Input**: Digitized neural data from imec probes; TTL signals (0-5V) via the Sync SMA port; optional analog/digital input from NI modules.
* **Processing**: The system uses the chassis backplane to share synchronization signals across multiple modules; data is recorded with metadata including a shared 1 Hz sync square wave in bit #6 of the SY channel.
* **Output**: Neural data streams and synchronization signals saved to disk, formatted for downstream analysis (e.g., TPrime for event time mapping).

### 4. Dependencies
* **NI-DAQmx**: Required for interfacing with NI multifunction I/O hardware.
* **NI Platform Services / NI-VISA**: Necessary for chassis communication and bus management.
* **Enclustra Drivers**: Required for imec module communication.
* **Hardware Drivers**: Specific vendor drivers for the PXIe chassis and controller (e.g., Keysight, ADLink).

### 5. Analysis Methods
* **Synchronization**: Uses a common 1 Hz square wave recorded across all data streams. Rising edges are matched across streams, and offset calculations are used to align event times (referenced via the TPrime tool).
* **Signal Integrity**: Includes manual methods for suppressing crosstalk on unused channels using 50-ohm terminators and managing signal impedance via pull-up/pull-down resistors.

### 6. Figures/Outputs
* **PXIKit.png**: A visual reference for hardware slots (controller vs. imec modules vs. I/O modules) within an NI 1071 chassis.
* **Status Indicators**: Definitions for imec module LED states (Main: Power/Connection/Acquisition; Ports: Configuration status).

### 7. Key Parameters
* **Sync Configuration**: Selection of a master device for the synchronization square wave (either imec module, NI device, or OneBox).
* **Slot Mapping**: Configuration of active vs. hidden PXIe slots and assignment of port counts (1 or 2 docks/ports per slot).
* **Sync TTL Levels**: 0-5V logic levels for the SMA 'TRIG' ports.
* **Bus Segmenting**: Settings related to managing multi-segment PXIe backplanes (relevant for systems using >5 imec cards).

---

## Markdown/SpikeGLX_Quadbase_Quickstart.md

This document is a technical quickstart guide for using **Quad-base (QB) probes** within the **SpikeGLX** software environment.

### 1. Purpose
This file provides configuration requirements, hardware setup procedures, and performance troubleshooting strategies for researchers using high-channel-count (1536-channel) Quad-base probes in electrophysiological experiments.

### 2. Key Components
* **Probe Configuration (IMRO Table)**: Defines how channels are mapped across four shanks and how references (ext, gnd, tip) are assigned.
* **Worker Thread Management**: Handles the critical low-latency acquisition process that merges data from four shanks into a single synchronous stream.
* **Metrics Monitoring (Ctrl+M)**: A diagnostic interface used to track buffer backpressure, POP errors, and sample synchronization.
* **CatGT Utility**: Used for post-processing data, specifically for splitting merged shank data into individual files.

### 3. Data Flow
* **Input**: Data is acquired from four consecutive ports on a PXIe module (effectively treating the four shanks as one 1536-channel unit).
* **Processing**: SpikeGLX merges these streams into a single acquisition thread. Optional "Filtered IM stream" buffers perform band-pass filtering and common average referencing (CAR).
* **Output**: Writes 1536 neural channels plus 4 SY (sync/error) channels per timepoint to data files. Logs are generated in the data directory upon detection of missed samples.

### 4. Dependencies
* **API4**: Requires SpikeGLX version 20250525-API4 or later.
* **Hardware**: Requires bespoke QB probes, QB headstages, and specific PXIe/OneBox module compatibility (QB probes are restricted to "STD" module tech).
* **OS/System**: Relies on Windows Task Scheduler settings (to disable performance-taxing tasks like Microsoft Compatibility Appraiser) and CPU power management drivers.

### 5. Analysis Methods
* **Sample Synchronization**: The system monitors for "shank disparity." If the timing difference between shanks exceeds 10 samples, the system triggers a 'Shanks Desynchronized' error to maintain data integrity.
* **Backpressure Handling**: Includes self-protection logic where "Filtered IM streams" are temporarily disabled if the FIFO buffer backlog grows too large.

### 6. Figures/Outputs
* **Metrics Window**: Real-time diagnostic window displaying thread activity, error flags, and sample drops.
* **Log Files**: Automated run-time logs identifying segments of missed samples and the exact time points of synchronization failures.

### 7. Key Parameters
* **CPU Requirements**: Minimum 3.0 GHz clock speed and a PassMark Single-thread score $\ge$ 3000.
* **Channel Count**: 1536 neural channels + 4 SY channels (one per shank).
* **`-sepShanks`**: A CatGT flag used to isolate individual shank data in post-processing.
* **`Filtered IM stream`**: A configurable checkbox that balances signal visualization clarity against CPU load.

---

## Markdown/SpikeView_Help.md

This file serves as the documentation/help manual for the **SpikeViewer** component of a neural data analysis software suite. It outlines the operational logic and interface controls for visualizing electrophysiological spike data.

---

### 1. Purpose
The SpikeViewer tool provides real-time monitoring and visualization of neural spikes across up to 4 independent channels. It enables researchers to track spike waveforms, calculate mean firing rates, and verify spike detection quality during data acquisition.

### 2. Key Functions/Classes
*   **Spike Detection Engine:** Logic that monitors voltage threshold crossings to identify potential action potentials.
*   **FIFO Buffer Management:** Handles the storage and rotation of time-stamped spikes (up to 32 per channel).
*   **Waveform Processor:** Computes the alignment (at minima), mean waveform, and spike frequency.
*   **Control Interface (Spinners):** UI elements for selecting probes, channels, and scaling the vertical voltage axis (`yscl`).

### 3. Data Flow
*   **Input:** Raw voltage data from specified {probe, channel} coordinates.
*   **Processing:**
    *   Applies a negative threshold crossing filter.
    *   Extracts 64-sample segments per detected spike.
    *   Aligns waveforms to their minima.
*   **Output:** Visualization of individual/mean waveforms and a log-scale spike rate metric.

### 4. Dependencies
*   **ShankViewer:** The document implies integration with a "ShankViewer" module for channel selection.
*   **Graph Window:** Interoperates with graph-based visualization modules for trace selection.

### 5. Analysis Methods
*   **Threshold Detection:** Negative-going threshold crossing logic.
*   **Temporal Filtering:** Spikes must stay below the threshold for a minimum of 3 consecutive samples.
*   **Averaging:** Calculates mean spike waveforms (green) and spike rates (blue, log scale).
*   **Time-windowing:** Implements a retention policy where spikes are discarded after 30 seconds to maintain buffer freshness.

### 6. Figures/Outputs
*   **Yellow Trace:** Real-time individual spike waveforms.
*   **Green Trace:** Mean waveform calculated from current buffer.
*   **Blue Bar:** Spike rate indicator (visualized on a log scale).

### 7. Key Parameters
*   **Threshold:** Negative microvolt value for spike detection.
*   **Samples per Spike:** Fixed at 64 samples.
*   **Buffer Size:** 32 spikes (FIFO).
*   **Retention Time:** Max 30 seconds.
*   **`yscl`:** Vertical full-scale voltage control (microvolts).

---

## Markdown/SyncTab_Help.md

This file serves as documentation for the "Sync" tab in the **SpikeGLX** software, a widely used tool for electrophysiology data acquisition.

### 1. Purpose
This document provides user instructions for synchronizing multiple data acquisition streams (Imec probes, OneBox, and NI-DAQ devices) by mapping them to a common time reference using a shared square-wave signal. It outlines how to perform clock calibration to correct for sample rate drift and ensure alignment across different hardware clocks.

### 2. Key Concepts (Functional Modules)
*   **Sync Waveform Configuration:** Managing the selection of a master clock source (Square Wave) to align various data acquisition modules.
*   **Hardware Interface (I/O) Management:** Coordinating SMA connectors on Imec PXI and OneBox hardware for signal propagation across chassis backplanes.
*   **Calibration Routine:** A structured workflow for calculating and applying precise, measured sample rates for each hardware device to minimize drift.
*   **Configuration Storage:** Automatic persistence of calibrated rate settings to local initialization files.

### 3. Data Flow
*   **Input:** User-defined square-wave signal (via external generator, NI-DAQ, or Imec PXI slot) and user-specified calibration duration.
*   **Processing:** SpikeGLX measures the frequency of the input signal against internal device clocks to determine the actual sample rates vs. nominal rates.
*   **Output:** Calibration data is stored in `.ini` files within a `_Calibration` directory and applied to future acquisition runs.

### 4. Dependencies
*   **Hardware:** Requires connection to compatible PXI chassis, Imec BS modules, and National Instruments (NI-DAQ) devices.
*   **External Files:** Reads/Writes `_Calibration\calibrated_sample_rates_imec.ini` and `_Calibration\calibrated_sample_rates_nidq.ini`.

### 5. Analysis Methods
*   **Clock Rate Calibration:** Statistical comparison of measured vs. nominal sample rates.
*   **Error Checking:** Evaluation of Standard Error (should be < 0.01 Hz for a 20-minute run) and delta checks against previous calibration results (should be < 0.1 Hz) to validate measurement integrity.
*   **Drift Mitigation:** Application of "Tprime" or equivalent timing corrections based on the measured sample rate to minimize temporal misalignment during long recordings.

### 6. Figures/Outputs
*   **Calibration Report:** A post-run dialog window showing calculated sample rates for user approval.
*   **Metrics Window:** Provides real-time visibility into Imec error flags and potential sample loss.
*   **Log Files:** Runtime warnings and error messages related to hardware sync.

### 7. Key Parameters
*   **Sync Period:** {1, 2, or 3} seconds (defines frequency of edges for alignment).
*   **Calibration Run Duration:** User-defined time period for baseline measurement (recommended: 30-minute warm-up + 40-minute measurement).
*   **Source Mode:** Choice of internal generation (Imec/NI) or external "high precision pulser."
*   **Duty Cycle:** Fixed at 50%.

---

## Markdown/SystemRequirements_PXI.md

This file serves as a technical documentation and procurement guide for setting up hardware and computing systems for Neuropixels data acquisition.

### 1. Purpose
This document provides hardware specifications, configuration guidelines, and recommendations for assembling experimental rigs (PXI and OneBox systems) and acquisition computers required for high-density neural recording using Neuropixels probes.

### 2. Key Functions/Classes
*Note: This is a documentation file rather than code, but it defines the following architectural components:*
* **OneBox**: An all-in-one, USB-based acquisition system (minimal hardware footprint).
* **PXI System**: A modular, high-bandwidth architecture using a PXI chassis, controller link, and base-station modules.
* **NI Multifunction IO**: Hardware interfaces for non-neural/auxiliary data synchronization (e.g., TTL signals, analog IO).
* **Online/Acquisition Computer**: The primary workstation dedicated to real-time data streaming and hardware control.

### 3. Data Flow
* **Hardware Tier**: Neural signals from probes $\rightarrow$ Headstage $\rightarrow$ Cable $\rightarrow$ Recorder (OneBox or PXI) $\rightarrow$ Acquisition Computer.
* **Synchronization**: Auxiliary data (NI IO) are tightly synchronized with neural data via SpikeGLX and shared timing signals (SMA connectors).
* **Computing Tier**: Online Computer (Real-time Acquisition) $\rightarrow$ Storage/Network $\rightarrow$ Offline Computer (Spike Sorting).

### 4. Dependencies
* **Drivers**: 
    * **NI-DAQmx**: Required for interacting with National Instruments hardware.
    * **Enclustra Drivers**: Essential for PXI-to-PC communication (Windows only).
* **Software**: **SpikeGLX** (the primary application used for recording and device configuration).

### 5. Analysis Methods
* **Simultaneous Sampling**: Utilized by S-series and some X-series NI devices to avoid crosstalk and maintain sampling integrity across channels.
* **Multiplexing Correction**: Defines a formula for non-simultaneous devices to prevent charge carryover/crosstalk: `SampleRate ≤ 1 / (1/R0 + 1E-5)`.

### 6. Figures/Outputs
* **Schematic**: Conceptual diagram of the signal path (animal $\rightarrow$ probe $\rightarrow$ recorder $\rightarrow$ PC).
* **Hardware Kits**: Reference images provided (`ObxKit.png`, `PXIKit.png`).
* **Tables**: Includes simplified shopping lists for PXI components, cost estimates, and NI compatibility guides.

### 7. Key Parameters
* **Bandwidth Requirements**: 2 GB/s for high-count probes (32+ probes); 250 MB/s for smaller setups (≤ 8 probes).
* **Channel Support**: Support for 384-channel and 1536-channel (future/NXT) probe models.
* **CPU/Hardware Constraints**: 
    * **Recommendation**: Intel-based systems are strongly preferred for PXI compatibility.
    * **Exclusion**: Avoid "Core Ultra" (Meteor Lake) CPUs.
    * **Bus Requirements**: PCIe Gen 2/3 lanes for chassis controllers.
* **Digital IO**: Max 32 lines per device (specific to "waveform" lines).

---

## Markdown/SystemRequirements_Xilinx.md

This document is a technical requirements specification for configuring legacy Xilinx-based hardware used in imec probe data acquisition.

### 1. Purpose
This file provides hardware and software configuration guidelines for systems running SpikeGLX to support imec probe data acquisition (Phase3A and Phase3B1) or traditional NI-only acquisition. It ensures the host system meets the necessary performance standards to prevent data bottlenecks during high-bandwidth streaming.

### 2. Key Functions/Classes
*   **N/A**: As this is a documentation file (.md) rather than source code, it contains no executable functions or classes.

### 3. Data Flow
*   **Input**: Raw neural data streams from imec probes or NI-DAQ devices.
*   **Processing**: Real-time data streaming and capture via SpikeGLX.
*   **Output**: High-bandwidth data writing to a dedicated, high-speed storage drive (SSD).

### 4. Dependencies
*   **Software**: NI-DAQmx (Version 9 or later).
*   **Hardware**: 
    *   Dedicated Gigabit Ethernet NIC (Category 6 or better).
    *   Minimum of 4 CPU cores (2.5 GHz+).
    *   High-speed SSD (500 MB/s sustained write speed).

### 5. Analysis Methods
*   **N/A**: This document outlines system architecture requirements, not data analysis or statistical methods.

### 6. Figures/Outputs
*   **N/A**: No figures or graphical outputs are generated by this file.

### 7. Key Parameters
*   **Network Configuration**:
    *   **Phase3A IP**: 10.2.0.123
    *   **Phase3B1 IP**: 10.1.1.1
    *   **Subnet Mask**: 255.0.0.0
*   **Hardware Specifications**:
    *   **RAM**: 4GB (32-bit OS) or 8GB (64-bit OS).
    *   **Disk I/O**: Sustained write speed of ≥ 500 MB/s for SSDs.
*   **System Architecture**: Requirement for two separate Network Interface Cards (NICs) if simultaneous TCP/IP interfacing (e.g., with MATLAB) is required alongside imec data transfer.

---

## Markdown/TrigTab_Help.md

### Structured Summary: `TrigTab_Help.md`

#### 1. Purpose
This file provides documentation for the "Triggers Tab" within a data acquisition software suite. It explains how users can configure various modes to control when data recording (file writing) begins and ends relative to experimental events or signals.

#### 2. Key Functions/Classes
While this is a documentation file, it describes five primary operational trigger modes:
*   **Immediate Start**: Records continuously while the gate is open.
*   **Timed Start and Stop**: Records based on pre-configured time delays and periodic sequences.
*   **TTL Controlled Start and Stop**: Records based on hardware-level signal threshold crossings.
*   **Spike Detection Start and Stop**: Specifically filters and detects neural spikes to trigger file creation.
*   **Remote Controlled Start and Stop**: Allows external API control (`TriggerGT` command) to toggle recording state.

#### 3. Data Flow
*   **Input**: Receives external signals (via TTL/analog channels), API commands (e.g., `SETTRIG`), or time-based intervals.
*   **Processing**: Applies thresholding (unfiltered for TTL, 300Hz high-pass for spikes) and sequence logic.
*   **Output**: Determines the writing state of data files (binary/raw acquisition files).

#### 4. Dependencies
*   **Hardware Dependencies**: Refers to NI (National Instruments) or "OneBox" devices for TTL inputs and the imec SMA connector for synchronization.
*   **Software Dependencies**: References legacy support for "StimGL" and links to other documentation files: `GateTab_Help.html` and `SyncTab_Help.html`.

#### 5. Analysis Methods
*   **Threshold Detection**: Identifies trigger events based on real-world voltage values.
*   **Filtering**: Mentions the application of a 300Hz high-pass filter specifically for the Spike Detection trigger mode to isolate relevant neural activity.
*   **Refractory Periods**: Implemented in Spike Detection to prevent multiple triggers from the same event.

#### 6. Figures/Outputs
*   **Output Files**: The system produces data files corresponding to triggers.
*   **Perievent Margins**: The system supports the inclusion of data windows surrounding trigger events in the resulting files.

#### 7. Key Parameters
*   **Threshold Voltages**: Real-world sensor values (in $\mu V$ or $V$) regardless of internal signal gain.
*   **Timing Intervals**: `L0` (wait delay), `H` (write duration), `L` (idle duration), and `N` (repetition count).
*   **Refractory Period**: A duration setting to ignore subsequent spikes after a primary trigger event.

---

## Markdown/UserManual.md

This document serves as the primary technical manual for the **SpikeGLX** acquisition software, a core component of the Neuropixels data processing ecosystem used for high-density electrophysiology.

### 1. Purpose
This file provides comprehensive setup, configuration, and operational instructions for SpikeGLX, including hardware integration, data management, performance optimization, and API utilization for remote control.

### 2. Key Functions/Modules
*   **Acquisition Engine**: Manages real-time data streams from PXIe, OneBox, and Quadbase probe hardware.
*   **Remote Command Servers**: Provides TCP/IP-based integration for third-party control via MATLAB, C++, and Python SDKs.
*   **Data Manager**: Handles file directory structures, including the "Multidrive" feature for load-balanced distributed recording.
*   **Calibration Utility**: Manages probe-specific gain and ADC calibration files stored in the `_Calibration` subfolder.
*   **Visualization Modules**: Includes an "Offline File Viewer," "Shank Viewers," and "Graphs Window" with support for live anatomical atlas overlays.

### 3. Data Flow
*   **Inputs**: Receives raw voltage/spike data from hardware (Imec/NI probes); requires calibration metadata for signal processing.
*   **Processing**: Applies hardware settings, manages stream synchronization (via calibration), and segments data into binary files.
*   **Outputs**: Generates `.bin` (raw data) and `.meta` (metadata) files; writes logs to the configured data directory.

### 4. Dependencies
*   **Operating System**: Designed for Windows (requires specific power/performance tweaks).
*   **Hardware**: Requires compatible PXIe systems, Neuropixels probes, and specialized headstages.
*   **Ecosystem Tools**: Relies on companion tools such as `CatGt` (filtering/extraction), `TPrime` (synchronization), and `ecephys_spike_sorting`.
*   **External Frameworks**: Built using Qt6.

### 5. Analysis Methods
*   **Sample Rate Calibration**: Provides specific procedures for calibrating sample rates using squarewave generators to ensure inter-stream synchronization.
*   **Channel Mapping**: Supports complex mapping schemes (Imec, OneBox, NIDQ) to structure probe data.
*   **Checksum Tools**: Includes utilities for verifying data integrity post-acquisition.

### 6. Figures/Outputs
*   **Meta Files**: Associated with every data stream to provide context and configuration parameters.
*   **Real-time Visualization**: Displays live electrophysiological signals, including integrated region labels from the Allen CCF (mouse) and Waxholm (rat) atlases.
*   **Metrics**: Displays runtime acquisition performance in the "Run Metrics Window."

### 7. Key Parameters
*   **Data Directory**: The root location for storage; supports `Multidrive` configurations for scaling high-bandwidth recordings.
*   **Calibration Policy**: Configurable in the "IM Setup" tab (e.g., "Skip all calibration" vs. standard).
*   **TCP/IP Port/Timeout**: Configurable settings for the Remote Command server to allow external script control.
*   **Windows Environment Settings**: Crucial parameters include "High Performance" power plans, disabled background tasks (e.g., Windows Task Scheduler), and graphics card optimization settings.

---

## Markdown/WavePlan_Help.md

### Analysis Summary: WavePlan_Help.md

This file serves as the technical documentation for the "Wave Planner" and "WavePlayer" tools within the SpikeGLX ecosystem, which are used for generating and executing stimulus waveforms via hardware devices like OneBox or NI-DAQ systems.

#### 1. Purpose
This document provides instructions on creating, configuring, and triggering stimulus waveforms for electrophysiological experiments. It details the file formats, syntax for custom waveform scripts, and the remote scripting API integration required to control hardware output.

#### 2. Key Functions/Classes
The documentation highlights the following API functions used for waveform control in MATLAB:
*   `OBX_Wave_Load`: Loads a specified wave plan into the hardware device.
*   `OBX_Wave_Arm`: Sets up the trigger configuration (software vs. physical pin) and loop behavior.
*   `OBX_Wave_StartStop`: Initiates or halts the output of the loaded waveform.
*   `NI_DO_Set`: Used to manipulate NI-DAQ digital output lines for external hardware triggering.
*   `PauseGraphs`: A utility to control the visual display refresh rate during stimulus playback.

#### 3. Data Flow
*   **Input**: User-defined waveform parameters (text scripts or binary files) stored in the `_Waves` directory, consisting of a `.meta` (configuration) file and a corresponding data file (`.txt` or `.bin`).
*   **Processing**: SpikeGLX compiles text-based scripts or reads binary samples and scales them according to the `wave_Vpp_dbl` and `device_Vpp_dbl` metadata.
*   **Output**: Analog voltage signals sent to hardware output channels (e.g., OneBox AO-0).

#### 4. Dependencies
*   **SpikeGLX**: Core application required to host the Wave Planner tool.
*   **Hardware**: Requires compatible hardware (NI-DAQ or OneBox) with waveform-capable analog output.
*   **MATLAB**: The scripting examples rely on a MATLAB interface (`SpikeGL`) to communicate with the SpikeGLX server.

#### 5. Analysis Methods
*   **Signal Generation**: The system uses a domain-specific mini-language (`level`, `ramp`, `sin`, `do-loops`) to mathematically construct voltage signals.
*   **Scaling/Normalization**: Input data (float or 16-bit integer) is normalized and scaled using the ratio of wave-to-device peak-to-peak voltage (`Vpp`) to ensure safe and accurate analog output.

#### 6. Figures/Outputs
*   **Hardware Output**: Generates physical analog voltage signals for research stimuli.
*   **Metadata**: Produces `*.meta` configuration files in human-readable `ini` format.

#### 7. Key Parameters
*   `wave_Vpp_dbl`: The peak-to-peak voltage defined for the stimulus wave.
*   `device_Vpp_dbl`: The voltage range capacity of the hardware device, used for constraint checking.
*   `sample_frequency_Hz_dbl`: The temporal resolution of the generated output.
*   `trigger`: Integer code determining the trigger source (e.g., `-2` for software-based, `1` for specific hardware AI lines).
*   `num_samples_i32`: Specifies the sample count for binary files (must be even, max 16,777,214).

---

## Markdown/pandoc-commandline.txt

This file is a technical documentation snippet or "cheat sheet" providing command-line instructions for converting Markdown files into formatted HTML using the Pandoc document converter.

### 1. Purpose
This file provides a quick-reference guide for executing Pandoc conversion commands in a Windows PowerShell environment. It aims to help users generate standalone HTML files from Markdown source files while applying a custom CSS stylesheet.

### 2. Key Functions/Classes
*   **Pandoc CLI**: The core command-line utility used for document conversion. There are no functions or classes defined; the file strictly contains procedural shell instructions.

### 3. Data Flow
*   **Reads**: A Markdown source file (`in-file.md`) and a Cascading Style Sheet (`pandoc.css`).
*   **Processes**: Converts Markdown syntax into HTML structure via the Pandoc engine.
*   **Writes**: An output HTML file (`outfile.html`) that embeds the CSS styles for portability.

### 4. Dependencies
*   **Pandoc**: The primary external software required to run the command.
*   **PowerShell**: The required shell environment for executing the commands.
*   **pandoc.css**: A local CSS file required for styling the output.

### 5. Analysis Methods
*   **None**: This is a documentation/utility file and contains no scientific or statistical analysis logic.

### 6. Figures/Outputs
*   **Outputs**: Generates a self-contained HTML file.
*   **Visuals**: Mentions the use of browser-based tools (Firefox Web Developer Tools) to inspect and debug the resulting CSS application.

### 7. Key Parameters
*   `-s` (or `--standalone`): Ensures the output includes a proper header and footer (head/body tags).
*   `-c <file.css>`: Specifies the stylesheet to be linked to the output.
*   `--self-contained`: Instructs Pandoc to embed the CSS directly into the HTML file, creating a single-file document instead of a file with external dependencies.

---

## Markdown/tutorial_toc.md

This file serves as a structured documentation index for the SpikeGLX software suite, which is primarily used for high-density electrophysiology data acquisition.

### 1. Purpose
This file functions as a Table of Contents (TOC) for the SpikeGLX tutorial documentation. It organizes guides and procedural walkthroughs into a hierarchical structure to help researchers navigate the setup and analysis workflow for neural probes and hardware (OneBox).

### 2. Key Functions/Classes
*N/A (This is a documentation/navigation file, not source code.)*

### 3. Data Flow
The file acts as a portal for conceptual data flow:
* **Acquisition**: Tutorials cover hardware calibration and setting up "IM" (Imec) data streams.
* **Visualization**: Redirects to documentation on online/offline visualization tools (ShankViewer).
* **Data Organization**: Directs users to guidelines on file directory structures and naming conventions for massive electrophysiology datasets.

### 4. Dependencies
* **External**: Links to external documentation hosted at `billkarsh.github.io/SpikeGLX`.
* **Internal**: Links to various local `.html` tutorial files within the documentation directory.

### 5. Analysis Methods
While the file is a TOC, it references several technical analysis domains covered in the tutorials:
* **Hardware Calibration**: Methods for synchronizing probe and OneBox systems.
* **Online/Offline Signal Processing**: Mention of "Graphs Window Spikes," implying threshold-based or template-based spike detection.
* **Anatomy Integration**: Methodologies for mapping neural activity to anatomical coordinates.

### 6. Figures/Outputs
The tutorials listed in this file generate or discuss:
* **Visualization Windows**: Online and Offline ShankViewers for real-time and post-hoc neural signal analysis.
* **Performance Metrics**: Reports or logs assessing the health and quality of the electrophysiology data acquisition.
* **Diagnostic Graphs**: Visualizations of spike activity and trigger events.

### 7. Key Parameters
The tutorials referenced in this file address the following configuration areas:
* **Setup**: Hardware settings (IM Setup tab), triggering logic (Gates and Triggers).
* **Environment**: File path naming conventions and directory structures for high-volume data storage.
* **Monitoring**: Visualization control parameters for spikes and signal graphs.

---

## NI/Readme.txt

This file serves as documentation for the configuration and integration of National Instruments (NI) and VISA drivers within the project environment.

### 1. Purpose
This file acts as a manifest and configuration note detailing the source paths for third-party NI DAQmx and VISA driver components. It provides essential context for developers regarding how these external dependencies are integrated into the build environment (specifically for compatibility with SpikeGLX and Qt/MinGW).

### 2. Key Functions/Classes
*   **None**: This is a documentation/metadata file, not a source code file. It contains no executable functions or classes.

### 3. Data Flow
*   **None**: The file does not process data. It defines the paths for linking static libraries (`.lib` files) during the build/compilation phase to enable hardware communication.

### 4. Dependencies
The file specifies dependencies on the following external software packages:
*   **NI DAQmx v.21.0**: Specifically the C/C++ header and library files from the National Instruments Shared directory.
*   **VISA (Virtual Instrument Software Architecture)**: Specifically the IVI Foundation’s Win64 library implementation.
*   **Qt 5.12.0 MinGW 64-bit**: The build environment used to compile the application (SpikeGLX).

### 5. Analysis Methods
*   **N/A**: No scientific or statistical methods are implemented within this file.

### 6. Figures/Outputs
*   **None**: This file generates no graphical outputs or data products.

### 7. Key Parameters
*   **Build Environment Compatibility**: The note highlights a critical build-system observation: the use of MSVC-formatted static libraries (`msc`) within a Qt/MinGW 64-bit toolchain, confirming that they are cross-compatible for this project's specific linking requirements.
*   **Library Paths**:
    *   `C:/Program Files (x86)/National Instruments/Shared/ExternalCompilerSupport/C/`
    *   `C:\Program Files\IVI Foundation\VISA\Win64\Lib_x64\msc`

---

## QLed-LGPLv2-LICENSE.txt

This file contains the **GNU Library General Public License, Version 2 (LGPLv2)**. It is a legal document defining the terms and conditions for the distribution, modification, and usage of the library associated with the "QLed" software project.

### 1. Purpose
This file provides the legal framework under which the QLed library is distributed. It serves to protect the user's freedom to share and modify the library while ensuring that derivative works remain free and open.

### 2. Key Functions/Classes
*   **Not applicable**: As a legal license text, this file contains no source code, classes, or executable functions.

### 3. Data Flow
*   **Processing**: This document does not process data. It defines the "terms and conditions" governing the handling of source code and object code by licensees.

### 4. Dependencies
*   **Not applicable**: This is a standalone legal document; it does not import or depend on other software libraries.

### 5. Analysis Methods
*   **Not applicable**: No scientific or statistical methods are implemented.

### 6. Figures/Outputs
*   **Not applicable**: The file produces no visual figures, data plots, or computational outputs.

### 7. Key Parameters
*   **Not applicable**: There are no configurable parameters within this file. The content is static legal boilerplate text.

***

**Note**: This file is purely a licensing agreement. In a research repository, its presence indicates that the project is released as **Free Software** under the LGPLv2, allowing others to link the library to both free and proprietary applications, provided they adhere to the copyleft requirements regarding modifications to the library itself.

---

## README.md

This document is the `README.md` file for the **SpikeGLX** repository, which serves as the primary documentation and entry point for a software suite used for high-density extracellular neural recording.

### 1. Purpose
SpikeGLX is a comprehensive data acquisition system designed for synchronous, high-channel-count recording from Neuropixels probes and NI-DAQ devices. The repository acts as a central hub for version-controlled releases that support various hardware generations (Imec phases) of neural probes.

### 2. Key Functions/Capabilities
* **Synchronous Acquisition**: Manages simultaneous data streams from Imec probes (Neuropixels) and NI-DAQ devices.
* **Hardware Management**: Provides interfaces for firmware updates for PXI-based base stations and modules.
* **Data Visualization/Processing**: Includes integrated tools for real-time signal filtering, visualization, and sorting of neural data.
* **Remote Control**: Supports external interaction/automation via APIs in MATLAB, Python, C++, C, and C#.
* **Integration**: Compatible with anatomical tracking tools like *Pinpoint* and *Trajectory Explorer*.

### 3. Data Flow
* **Input**: Receives high-bandwidth digital data from Imec Neuropixels probes and analog/digital signals from NI-DAQ devices.
* **Processing**: Performs real-time filtering and visualization during acquisition.
* **Output**: Writes recorded data to disk for offline analysis and editing; supports programmable triggers to synchronize recording windows.

### 4. Dependencies
* **Framework**: Built with **Qt 6.9** (as of the API4 branch; previous versions utilized Qt 5.12).
* **Hardware-Specific**: Depends on specific firmware versions corresponding to the Imec project phase (API4, Phase 30, etc.) and PXI/Xilinx base station hardware.
* **Licensing**: Incorporates QLed components (GNU LGPL v2.0).

### 5. Analysis Methods
* The system provides integrated tools for **signal filtering** and **spike sorting**, which are essential for processing extracellular neural electrophysiology data.

### 6. Figures/Outputs
* **Real-time Monitoring**: Provides an interactive GUI for live anatomical tracking and visual feedback of neural activity during experiments.
* **Data Files**: Produces standardized binary/data formats for subsequent offline analysis (viewing and spike sorting).

### 7. Key Parameters
* **Project Phases**: Users must configure the software based on the specific hardware development phase (e.g., API4 for NP1/NP2/NP3, Phase20, Phase30).
* **Module Technologies**: Selection of technology types {STD=NP1+NP2, OPTO, NXT=NP3} which dictates the required firmware and base station compatibility.
* **Triggering**: Configurable programmable triggers to initiate and synchronize data capture across multiple hardware devices.

---

