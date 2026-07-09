# Repository File Summaries

## README.md

Based on the provided `README.md` file, here is the structured analysis of the **FCsim** repository:

### 1. Purpose
This repository provides a simulation framework to evaluate and compare different pipelines for estimating source-level inter-regional functional connectivity from EEG sensor data. It serves as the computational implementation for the methodology described in the authors' 2023 *NeuroImage* publication.

### 2. Key Functions/Classes
*   **`fp_eval_mim_struct_sim.m`**: The main entry point for running the core simulation to evaluate functional connectivity estimation.
*   **`fp_eval_lagsim.m`**: A specialized simulation script focused on evaluating the impact of interaction delays on connectivity estimation.

### 3. Data Flow
*   **Input**: The scripts generate artificial EEG sensor time series internally based on simulation parameters.
*   **Process**: The system applies various signal processing and source localization pipelines to the simulated data to estimate connectivity.
*   **Output**: The repository produces quantitative comparisons and performance metrics regarding the accuracy of the tested connectivity estimation pipelines.

### 4. Dependencies
*   **Matlab**: Core programming environment.
*   **MVGC Toolbox**: Required for Granger Causality computations (Barnett & Seth).
*   **Dugh-NeurIPS-2021**: Required specifically for the implementation of the "Champagne" source localization method.
*   **EEGlab (ROIconn plugin)**: The recommended production implementation of these methods is provided through this external EEGlab plugin.

### 5. Analysis Methods
*   **Source Localization**: Includes advanced techniques such as Champagne source localization.
*   **Functional Connectivity**: Evaluates linear inter-regional functional connectivity estimation.
*   **Simulation-based Benchmarking**: Compares the effectiveness of varying pipelines against artificial "ground truth" EEG sensor signals.

### 6. Figures/Outputs
*   The code outputs results comparing different connectivity pipelines and interaction delays. While the README does not explicitly list output filenames, the primary output is the comparative performance analysis of signal processing pipelines for EEG data.

### 7. Key Parameters
*   **Interaction Delays**: Configurable variables within `fp_eval_lagsim.m` to test sensitivity to timing differences in functional connectivity.
*   **Pipeline Configuration**: The simulation allows for the testing and comparison of multiple connectivity estimation pipelines, which serves as the primary experimental variable.

---

