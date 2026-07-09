# Repository Overview

This repository contains a suite of computational modeling tools designed to investigate the biophysics and systems-level coding of the olfactory system. It bridges the gap between sub-cellular signaling dynamics (ORN level) and population-level neural coding (glomerular level).

---

### 1. Repository Purpose
The repository serves as a research workbench for modeling **odorant processing**. The primary objectives are:
*   **Biophysical Modeling**: Simulating the biochemical signaling pathways within Olfactory Receptor Neurons (ORNs) to understand adaptation, latency, and masking.
*   **Neural Coding**: Investigating how the olfactory system represents complex odor mixtures through sparsity, correlation-dependent antagonism, and information maximization.
*   **Publication Support**: Generating high-quality vector graphics (EPS) and performing statistical analysis for research reporting.

---

### 2. Data Pipeline
The workflow generally follows a "Model -> Simulate -> Analyze" pipeline:
1.  **Biophysical Simulation**: Uses kinetic modeling and numerical integration (Euler method) to derive response time-series.
2.  **Population/Stochastic Modeling**: Generates synthetic odor landscapes (using log-normal distributions) to simulate large-scale receptor/glomerular responses.
3.  **Data Processing**: Loads saved numerical results (e.g., from the `./Numerics/` directory) for post-processing and statistical verification.
4.  **Visualization**: Produces plots characterized by varying mixture complexities, concentration levels, and neural thresholding parameters.

---

### 3. Key Scripts & Their Roles
*   **`Temporal dynamics of ORN.ipynb`**: Focuses on the sub-cellular kinetics (cAMP/Calcium feedback) and individual receptor pulse responses.
*   **`Masking.ipynb`**: Investigates inhibitory/synergistic interactions between odorants at the receptor level using curve fitting and differential equations.
*   **`Coding model.ipynb`**: Explores population-level sparsity and how glomerular responses scale with mixture complexity.
*   **`Concentration coding.ipynb`**: Analyzes the accuracy of concentration estimation and the effect of neural correlation structures ($\rho$).
*   **`Quality coding.ipynb`**: A post-processing hub that performs ROC analysis and information maximization calculations to assess coding efficiency.

---

### 4. Analysis Methods Implemented
*   **Kinetic Modeling**: Use of systems of Ordinary Differential Equations (ODEs) to solve for molecular signaling states.
*   **Non-linear Optimization**: `scipy.optimize.curve_fit` for fitting experimental dose-response data to theoretical Hill-type models.
*   **Information Theory**: Assessing the system's ability to maximize information representation and perform component separation in mixtures.
*   **ROC/Signal Detection**: Quantifying classification accuracy (hit vs. false-positive rates) in detecting individual odors within complex backgrounds.
*   **Stochastic Simulation**: Generating random odorant sensitivity and affinity distributions to probe robustness across neural populations.

---

### 5. Outputs & Figures
The scripts produce a comprehensive set of EPS figures, including:
*   **Time-series Plots**: Showing adaptation to pulse stimuli and cAMP/Calcium dynamics.
*   **Response Curves**: Hill-function-based dose-response and masking efficacy curves.
*   **Scaling/Performance Plots**: Log-log plots illustrating coding sparsity, information maximization, and odor identification accuracy vs. mixture complexity.
*   **Spatial Visualizations**: Activation patterns (simulated glomerular grids) under varying stimulus conditions.

---

### 6. Dependencies & Environment
*   **Core Stack**: `numpy` (computation), `scipy` (optimization, integration, statistics), `matplotlib` (visualization).
*   **System/Environment**: Notebooks assume a Unix-like file system with support for directory navigation and local file storage (`./Numerics/`).
*   **External Requirements**: `matplotlib` configured for specific font support (e.g., 'Tahoma') and external `.dat` files for population analysis.

---

### 7. File Dependency Graph
The repository follows a modular structure where scripts function as independent modules but rely on a shared set of mathematical principles (e.g., Hill-equation responses).

*   **Logic Hierarchy**:
    *   **Bottom-Up**: `Temporal dynamics of ORN.ipynb` & `Masking.ipynb` define the biological constraints and kinetics.
    *   **Systemic Level**: `Coding model.ipynb` & `Concentration coding.ipynb` use these biological constraints to model population responses.
    *   **Evaluation Level**: `Quality coding.ipynb` ingests the results of the population models to calculate performance metrics (ROC, information).

*   **Data flow**:
    *   `Coding model.ipynb` $\rightarrow$ `./Numerics/` (Data) $\leftarrow$ `Quality coding.ipynb` (Post-processing).

Repository Structure:
  Coding model.ipynb (11090 chars)
  Concentration coding.ipynb (27859 chars)
  Masking.ipynb (14731 chars)
  Quality coding.ipynb (10158 chars)
  Temporal dynamics of ORN.ipynb (22375 chars)