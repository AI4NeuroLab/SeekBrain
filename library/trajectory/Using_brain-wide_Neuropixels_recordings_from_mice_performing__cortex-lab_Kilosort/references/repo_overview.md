# Repository Overview

This repository hosts **Kilosort**, a high-performance MATLAB-based software package designed for spike sorting high-density, multi-channel extracellular electrophysiological recordings.

---

### 1. Repository Purpose
The repository provides an integrated pipeline for detecting and clustering neural spikes from large-scale electrode probe data. It is engineered to scale across hundreds of recording channels by leveraging GPU-accelerated template matching and providing a seamless transition to manual curation via the `phy` GUI.

### 2. Data Pipeline
The Kilosort pipeline follows a linear trajectory from raw signal ingestion to finalized cluster output:
1.  **Preparation**: Define electrode geometry (`createChannelMap.m`) and configure processing parameters (`master_file_example`).
2.  **Compilation**: Compile CUDA source code into MATLAB executables (`mexGPUall`).
3.  **Preprocessing**: Apply spatial whitening (`Wrot`) to raw binary data.
4.  **Sorting**: Execute template matching and clustering using GPU-accelerated algorithms.
5.  **Curation**: Export results to Python-readable formats for manual validation and refinement in the **Phy** GUI.

### 3. Key Scripts & Their Roles
*   **`master_file_example`**: The primary user interface for configuring input paths, probe geometry, and algorithm hyperparameters (`ops` struct).
*   **`mexGPUall`**: The orchestration script for compiling CUDA source files into machine-executable binaries required for GPU acceleration.
*   **`master_eMouse`**: A benchmarking and tutorial script that generates synthetic data to validate installations and demonstrate the end-to-end workflow.
*   **`createChannelMap.m`**: Utility for defining the spatial structure of specific electrophysiology probes.

### 4. Analysis Methods Implemented
*   **Template Matching**: Utilizes a generative model of waveforms to detect and classify individual spikes.
*   **Low-Rank Decomposition**: Employs spatial and temporal masks to optimize computational efficiency during high-dimensional signal processing.
*   **Spatial Whitening**: Removes inter-channel correlation to improve the signal-to-noise ratio before template matching.
*   **Sparse Representation**: Projects spikes onto local channel neighborhoods to limit dimensionality.

### 5. Outputs & Figures
*   **`rez` Struct**: The master MATLAB structure containing spike times, templates, cluster assignments, and metadata.
*   **Manual Curation Files**: Data exported to NPY format, which acts as the bridge for visual inspection in the **Phy** GUI.
*   **Performance Metrics**: Within the `eMouse` module, the output includes precision/recall accuracy scores comparing algorithmic results against synthetic ground truth.

### 6. Dependencies & Environment
*   **Software**: MATLAB (R2018a recommended) with the Parallel Computing Toolbox.
*   **Hardware/Drivers**: NVIDIA GPU with compatible CUDA Toolkit (version-dependent on MATLAB release).
*   **Compilers**: Visual Studio (Windows) or Clang/Xcode (macOS) for compiling MEX files.
*   **External Integration**: **Phy** (for GUI-based curation) and **npy-matlab** (for file exchange).
*   **Legacy Note**: Documentation includes historical notes on CUDA 7.5 and older macOS configurations; these should be treated as archival references.

### 7. File Dependency Graph
```text
[Raw Binary .dat] ──► [Kilosort Processing (master_file)] ──► [rez struct]
                                      │                            │
                                      │                      [Export to NPY]
                                      │                            │
[eMouse (Testing)] ───────────────────┘                            ▼
                                                       [Phy GUI / Curation]
                                                               ▲
[CUDA .cu files] ──► [mexGPUall.m] ──► [MEX Binaries] ─────────┘
```

Repository Structure:
  Docs/phy_installation_with_templates.txt (469 chars)
  Docs/readme_mac.txt (2413 chars)
  Docs/readme_win_linux.txt (3400 chars)
  eMouse/readme_eMouse.txt (938 chars)
  licence.txt (18073 chars)
  readme.md (9800 chars)