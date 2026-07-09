# Repository File Summaries

## naturalSceneSimu/ITE_package_cmu/CHANGELOG.txt

This file is a historical record of updates, bug fixes, and feature additions for the **ITE (Information Theoretical Estimators) toolbox**, a MATLAB-based repository for calculating information-theoretic quantities.

### 1. Purpose
The `CHANGELOG.txt` documents the iterative development of the ITE package, serving as a version control history for various entropy, divergence, and mutual information estimation methods. It tracks the implementation of new statistical estimators, performance optimizations, and updates to the toolbox's testing and documentation infrastructure.

### 2. Key Functions/Classes
The package follows a consistent naming convention for its modular components:
*   **Initialization Functions (`*_initialization.m`)**: Set up parameters, hyperparameters, and structures for specific estimators.
*   **Estimation Functions (`*_estimation.m`)**: Execute the computation of information-theoretic quantities (e.g., `HShannon`, `IShannon`, `DKL`, `DRenyi`, `DTsallis`).
*   **Test Routines (`quick_test_*.m`)**: Validation scripts used to verify the correctness of estimators against analytical values or known distributions.
*   **Utilities**: Support scripts such as `median_heuristic.m` (for kernel bandwidth), `expF_F.m` (for exponential family log-normalizers), and data generation scripts (e.g., `generate_AOD_dataset.m`).

### 3. Data Flow
*   **Input**: The estimators primarily process sample-based data (vectors/matrices of observations). 
*   **Processing**: Data is fed into initialization scripts which structure the input for the estimation kernels, often utilizing $k$-Nearest Neighbors ($k$NN), Maximum Likelihood Estimation (MLE) within exponential families, or kernel-based density approximations.
*   **Output**: The functions output scalar estimates of the requested information-theoretic measures, often compared against analytical ground truths in the "quick test" files.

### 4. Dependencies
*   **External Libraries**: The package historically relied on external tools like **ARfit** (for autoregressive model fitting) and **FastKICA**. 
*   **MATLAB Built-ins**: Relies heavily on core functions like `eigs` for matrix operations.
*   **Internal Dependencies**: The package is highly modular; estimation functions depend on the consistency of the initialization structures defined in the `utilities` and `shared/embedded` folders.

### 5. Analysis Methods
The toolbox implements a broad range of advanced statistical estimation techniques:
*   **Non-parametric Estimation**: $k$-Nearest Neighbor ($k$NN) based estimators for entropy and divergence.
*   **Kernel Methods**: MMD (Maximum Mean Discrepancy) using U-statistics and V-statistics, with accelerations via Incomplete Cholesky Decomposition.
*   **Parametric Modeling**: MLE-based estimation for Exponential Families (expF), allowing for analytical formula integration.
*   **Expansion Methods**: Von Mises expansion-based estimators for various divergences (Shannon, Renyi, Tsallis, etc.).
*   **Other**: Adaptive partitioning, spacing-based methods, and Szego’s theorem-based estimators for PSD (power spectral density).

### 6. Figures/Outputs
*   **Documentation**: The repo includes extensive PDF documentation (e.g., `ITE-0.57_documentation.pdf`) that visualizes the relationships between different information-theoretic quantities.
*   **Quick Tests**: The main output of the validation phase is a comparative verification, comparing numerical estimates against theoretical/analytical values.
*   **Distribution Regression**: The package supports specific research tasks, such as aerosol optical depth (AOD) prediction based on satellite imagery.

### 7. Key Parameters
*   **`k`**: The number of neighbors in $k$NN estimators.
*   **`co.mult`**: A toggle for "exact" vs. "proportional" estimation.
*   **`par.mean` / `par.cov`**: Parameters used for defining normal variable distributions in testing.
*   **Kernel Bandwidth**: Often determined via the `median_heuristic.m` for RKHS (Reproducing Kernel Hilbert Space) embeddings.

---

## naturalSceneSimu/ITE_package_cmu/LICENSE.txt

This file is the **GNU General Public License (GPL) version 3**, which serves as the legal framework governing the distribution, modification, and usage rights for the `naturalSceneSimu` repository.

### 1. Purpose
This file provides the legal terms and conditions under which the software is licensed. It ensures that the software remains "free" (as in freedom), granting users the right to study, change, and distribute the code, provided they maintain the same freedoms in derivative works.

### 2. Key Functions/Classes
*   **None**: This is a legal document, not a functional code module.

### 3. Data Flow
*   **N/A**: The file does not process, read, or write data within the simulation pipeline.

### 4. Dependencies
*   **N/A**: This is a standalone license document and does not depend on external scientific libraries.

### 5. Analysis Methods
*   **N/A**: No scientific or statistical methods are implemented.

### 6. Figures/Outputs
*   **N/A**: This file does not generate figures, plots, or computational outputs.

### 7. Key Parameters
*   **N/A**: No configurable simulation parameters; the document outlines legal obligations for developers and users.

***

**Analyst Note:** This file defines the repository's commitment to open-source practices. Any scientific research utilizing this codebase must comply with the GPLv3 requirements, specifically regarding the "copyleft" nature of the license: if you distribute a modified version of this research code, you are legally required to make the corresponding source code available under the same license.

---

## naturalSceneSimu/ITE_package_cmu/README.md

This file serves as the documentation and project overview for the **Information Theoretical Estimators (ITE) Toolbox**, a comprehensive software suite designed for information-theoretic research and statistical analysis.

### 1. Purpose
The `README.md` provides an overview of the ITE toolbox, which is a modular Matlab/Octave library designed to estimate a wide range of information-theoretic quantities (entropy, mutual information, divergence, etc.). It acts as a primary entry point for users to understand the toolbox's capabilities, citation requirements, and installation resources.

### 2. Key Functions/Classes
While the file acts as documentation, it categorizes the toolbox's functionality into these primary namespaces/modules:
*   **`entropy (H)`**: Estimators for Shannon, Rényi, Tsallis, and various other generalized entropies.
*   **`mutual information (I)`**: Estimators for independence measures like HSIC, kernel CCA, and various distance-based dependencies.
*   **`divergence (D)`**: Measures of distance between distributions, including KL, Hellinger, Bhattacharyya, and various f-divergences.
*   **`association measures (A)`**: Robust statistical measures including multivariate Spearman's rho and correntropy.
*   **`kernels on distributions (K)`**: Methods to define kernels over probability distributions (e.g., mean map kernels).
*   **`ISA (Independent Subspace Analysis)`**: Solvers for latent variable modeling and nonlinear systems.

### 3. Data Flow
*   **Input**: The toolbox is designed to process numerical datasets (typically matrices in Matlab/Octave) representing samples from probability distributions.
*   **Processing**: The modular design allows for the embedding of custom estimators and the combination of various estimation techniques.
*   **Output**: Numerical scalars or matrices representing the estimated information-theoretic quantity, or optimized parameters for ISA models.

### 4. Dependencies
*   **Environment**: Requires **Matlab** or **GNU Octave**.
*   **Compatibility**: Multi-platform; verified on Windows and Linux systems.
*   **License**: GNU GPLv3.

### 5. Analysis Methods
The toolbox implements an extensive array of statistical and information-theoretic techniques:
*   **Non-parametric statistics**: Kernel-based estimators for entropy and mutual information.
*   **Information Theory**: Extensions of Shannon/Rényi/Tsallis measures.
*   **Optimization**: Solvers for Information Theoretical optimization problems (e.g., Image registration).
*   **Consistency Testing**: Built-in analytical vs. estimated value testing modules.

### 6. Figures/Outputs
*   **Scientific Visualization**: The toolbox includes built-in illustrations for applications like *information-theoretical image registration* and *distribution regression*.
*   **Predictive Models**: Includes specific examples for supervised entropy learning and aerosol prediction based on multispectral satellite imagery.

### 7. Key Parameters
The toolbox is highly modular, suggesting that key parameters are estimator-specific, including:
*   **Kernel Bandwidth**: Critical for kernel-based estimators (HSIC, MMD, etc.).
*   **Distribution Parameters**: Order parameters for Rényi or Tsallis measures (alpha/q).
*   **Model Configuration**: Hyperparameters for ISA models, such as latent subspace dimensions and dynamics constraints.

---

## naturalSceneSimu/ITE_package_cmu/code/shared/downloaded/MISR1/README.txt

This file serves as a **documentation/metadata manifest** for three remote sensing datasets (MISR1, MISR2, and MODIS) used for Multiple Instance Regression (MIR) tasks within the `naturalSceneSimu` repository.

### 1. Purpose
This file provides technical specifications and dataset descriptions for remote sensing data linked to AERONET ground measurements. It defines the structure of data "bags" (instances grouped by geographical proximity) used to train and evaluate machine learning models for Aerosol Optical Depth (AOD) prediction.

### 2. Key Functions/Classes
*N/A: This is a documentation file, not an executable script.*

### 3. Data Flow
*   **Input Data:** The file describes tabular datasets where each row represents an "instance" (pixel data).
*   **Data Structure:**
    *   **MISR1/MISR2:** 18 total columns (1 bag ID, 12 reflectance features, 4 solar angles, 1 label).
    *   **MODIS:** 14 total columns (1 bag ID, 7 reflectance features, 5 angles, 1 label).
*   **Processing Context:** The data is intended for Multiple Instance Learning (MIL) experiments where all instances within a specific bag share the same target label (AOD).

### 4. Dependencies
*   **Data Source:** Relies on AERONET (Aerosol Robotic Network) ground-truth measurements.
*   **Platform:** Associated with MISR (Multi-angle Imaging Spectroradiometer) and MODIS (Moderate Resolution Imaging Spectroradiometer) satellite products.

### 5. Analysis Methods
*   **Multiple Instance Regression (MIR):** The data format is specifically optimized for MIR algorithms, where predictions are made on bags of instances rather than individual points.
*   **Validation Method:** The documentation specifies the use of **5-fold Cross-Validation (5-CV)** performed at the "bag" level to ensure model generalization.

### 6. Figures/Outputs
*   *N/A: The file does not generate figures or outputs, though it describes the structure required for the repository's machine learning pipelines to produce predictive models for AOD.*

### 7. Key Parameters
*   **Bag Constraints:**
    *   **Spatial Extent:** 20km radius around AERONET sites.
    *   **Instance Count:** 100 instances per bag.
*   **Feature Sets:**
    *   **MISR:** 16 features (12 reflectance + 4 solar angles).
    *   **MODIS:** 13 features (7 reflectance + 5 angles + 1 label-related metadata).
*   **Target Variable:** AERONET AOD (Aerosol Optical Depth).

---

## naturalSceneSimu/ITE_package_cmu/code/shared/embedded/CFastICA/LICENSE.txt

This file contains the legal text for the **GNU General Public License (GPL) version 2**.

### 1. Purpose
This file serves as the legal licensing agreement for the `CFastICA` component within the repository. It defines the terms and conditions under which users may copy, distribute, and modify the software, ensuring that the code remains "free software" as defined by the Free Software Foundation.

### 2. Key Functions/Classes
*   **N/A**: This is a plain text legal document and does not contain executable code, classes, or functions.

### 3. Data Flow
*   **N/A**: This file is informational and does not process data.

### 4. Dependencies
*   **N/A**: This is a standalone license document.

### 5. Analysis Methods
*   **N/A**: This file does not implement scientific or statistical methods.

### 6. Figures/Outputs
*   **N/A**: This file does not generate figures or outputs.

### 7. Key Parameters
*   **N/A**: There are no configurable parameters within this document.

***

**Note for Research Context:** 
This license is associated with the `CFastICA` (Fast Independent Component Analysis) implementation in the `naturalSceneSimu` repository. By including this file, the authors have legally committed to the terms of the GPLv2, which mandates that any derivative works or software incorporating this code must also be distributed under the same open-source terms.

---

## naturalSceneSimu/ITE_package_cmu/code/shared/embedded/E4/LICENSE.txt

This file is a standard legal document rather than a functional script. Below is the structured analysis:

### 1. Purpose
This file contains the **GNU General Public License (GPL) version 2**, a widely used free software license. Its purpose is to define the legal terms and conditions under which the associated software components can be copied, modified, and redistributed, ensuring the software remains "free" (as in freedom).

### 2. Key Functions/Classes
*   **None**: As this is a license text file, it contains no executable code, functions, or classes.

### 3. Data Flow
*   **N/A**: This file is a static text document intended for human reference to understand the legal rights and obligations associated with the software repository.

### 4. Dependencies
*   **None**: This is a standalone legal text file.

### 5. Analysis Methods
*   **None**: No scientific or statistical analysis is performed.

### 6. Figures/Outputs
*   **None**: The file produces no visual figures or computational outputs.

### 7. Key Parameters
*   **None**: There are no configurable parameters or variables.

***

**Analyst Note:** This file serves as the legal governing document for the directory `naturalSceneSimu/ITE_package_cmu/code/shared/embedded/E4/`. By including this file, the authors have declared that any software contained within that directory is subject to the conditions of the GPLv2, which mandates that any derivative works must also be open-sourced under the same license.

---

## naturalSceneSimu/ITE_package_cmu/code/shared/embedded/FastICA/LICENSE.txt

This file is a standard legal document text file. Below is the structured analysis:

### 1. Purpose
This file contains the **GNU General Public License (GPL) version 2**, a free software license that grants users the freedom to run, copy, distribute, study, change, and improve the software. It serves as the legal governing document for the usage and distribution of the `FastICA` package within the `naturalSceneSimu` repository.

### 2. Key Functions/Classes
*   **None**: As this is a legal text file and not a source code file, it contains no executable functions or classes.

### 3. Data Flow
*   **Not Applicable**: This file does not process, read, or write data.

### 4. Dependencies
*   **None**: This is a standalone license document.

### 5. Analysis Methods
*   **Not Applicable**: This file does not contain scientific or statistical algorithms.

### 6. Figures/Outputs
*   **None**: This file does not generate visual or numerical outputs.

### 7. Key Parameters
*   **Not Applicable**: This file does not contain configurable software parameters.

---

## naturalSceneSimu/ITE_package_cmu/code/shared/embedded/FastICA/copyright.txt

This is a legal documentation file associated with the **FastICA** package, a widely used algorithm for Independent Component Analysis. Below is the structured analysis:

### 1. Purpose
This file serves as the formal legal notice and license agreement for the FastICA package included within the research repository. It defines the copyright ownership and the terms under which the software may be used, modified, and redistributed.

### 2. Key Functions/Classes
*   **None**: This is a plain-text document and does not contain executable code, functions, or classes.

### 3. Data Flow
*   **N/A**: As a documentation/license file, it does not process, read, or write data.

### 4. Dependencies
*   **GNU General Public License (GPL)**: The software is bound by the terms of the GPL (version 2 or later).

### 5. Analysis Methods
*   **N/A**: This file does not implement scientific or statistical methods; it merely provides the licensing framework for the FastICA algorithm, which performs blind source separation to recover independent sources from mixed signals.

### 6. Figures/Outputs
*   **None**: This file does not generate any graphical or numerical outputs.

### 7. Key Parameters
*   **N/A**: There are no configurable software parameters in this file. It provides only meta-information regarding copyright holders (Hugo Gävert, Jarmo Hurri, Jaakko Särelä, and Aapo Hyvärinen) and the reference URL for the FastICA project.

---

## naturalSceneSimu/ITE_package_cmu/code/shared/embedded/ITL/license.txt

This file serves as the legal documentation defining the software's usage, modification, and distribution rights within the repository.

### 1. Purpose
This file contains the **GNU General Public License (GPL) version 3**, which governs the legal terms under which the associated software code is licensed. It ensures that the software remains free and open-source by requiring that any modified versions be distributed under the same license terms and that source code remains accessible to users.

### 2. Key Functions/Classes
*   **Not applicable**: This is a legal document, not a source code file. It contains no programmatic functions, classes, or executable logic.

### 3. Data Flow
*   **Not applicable**: The file contains no data processing logic.

### 4. Dependencies
*   **Not applicable**: This file has no technical dependencies. It is a standalone license text.

### 5. Analysis Methods
*   **Not applicable**: This document does not implement scientific or statistical methods.

### 6. Figures/Outputs
*   **Not applicable**: This document does not generate figures, plots, or programmatic outputs.

### 7. Key Parameters
*   **Not applicable**: There are no configurable parameters within this file.

***

**Summary Note:** The presence of this file indicates that the code residing in the `naturalSceneSimu/ITE_package_cmu/code/shared/embedded/ITL/` directory is released under the **GPLv3** copyleft license. Users are legally permitted to copy, distribute, and modify the software, provided they adhere to the requirements of the GPLv3, such as maintaining open source availability and attributing original authors.

---

## naturalSceneSimu/ITE_package_cmu/code/shared/embedded/ITL/readme.txt

This file acts as the documentation and directory index for a suite of MATLAB functions focused on **Information Theoretic Learning (ITL)** within the `naturalSceneSimu` repository.

### 1. Purpose
This folder provides optimized MATLAB implementations for various ITL estimators, including correntropy, information potential, and Cauchy-Schwartz divergence. It serves as a library for computing statistical dependencies and information-theoretic metrics, specifically optimized for speed as described in the cited research papers.

### 2. Key Functions/Classes
*   **Correntropy Functions:** `centcorren`, `centcorrenexp`, `corren`, `correncoef` (compute centered, temporal, and standard correntropy).
*   **Information Potential:** `ip`, `cip`, `cipexp` (measure information potential and cross-information potential).
*   **Divergence Metrics:** `qmi_cs`, `qmi_ed` (Cauchy-Schwartz and Euclidean distance-based mutual information).
*   **Distance Metrics:** `d_ed` (Euclidean distance), `d_cs` (Cauchy-Schwartz divergence).
*   **Decomposition Utilities:** `incompleteCholesky` (various versions for dimensionality reduction/approximation).
*   **Demo Scripts:** `demo_centcorrenexp`, `demo_centtempcorren` (demonstration and usage examples).

### 3. Data Flow
*   **Input:** The functions typically accept data arrays (likely vectors or matrices representing signal samples).
*   **Processing:** The scripts perform kernel-based computations (Gaussian or Laplacian) on the input data to estimate statistical moments or information measures.
*   **Output:** The functions return scalar or matrix values representing the calculated ITL metrics.

### 4. Dependencies
*   The code is native MATLAB.
*   It relies on the mathematical definitions established in:
    *   Seth & Principe (IJCNN 2009) regarding speed-up techniques.
    *   Rao et al. (Signal Processing 2011) regarding generalized correlation functions.
*   No external third-party toolboxes are explicitly listed, implying a dependency on base MATLAB.

### 5. Analysis Methods
*   **Information Theoretic Learning (ITL):** Methods based on Rényi’s entropy and related metrics.
*   **Kernel Methods:** Utilizes Gaussian and Laplacian kernels for kernel density estimation and information potential calculation.
*   **Incomplete Cholesky Decomposition:** Used to speed up computation for large datasets by approximating kernel matrices.
*   **Generalized Correlation:** Implements tests of independence based on correlation functions.

### 6. Figures/Outputs
*   While the library functions return numerical statistics, the provided demo scripts (`demo_centcorrenexp`, etc.) are designed to generate visual or console outputs illustrating the behavior of the estimators.

### 7. Key Parameters
*   **Kernel Size (Sigma):** Implicitly required for all kernel-based estimators (often handled via `incompleteCholeskySigma.m`).
*   **Dimensionality:** Handled via specialized functions for multidimensional variables (e.g., `incompleteCholeskyMulti.m`).

---

## naturalSceneSimu/ITE_package_cmu/code/shared/embedded/MI_AP/LICENSE.txt

This file is a standard legal document text file. Below is the structured summary based on your requirements:

1. **Purpose**: This file contains the full legal text of the GNU General Public License (GPL) Version 3. It serves as the licensing agreement for the associated software components within the repository, establishing the terms for copying, distributing, and modifying the code.

2. **Key Functions/Classes**: Not applicable. This is a plain text document containing legal definitions, permissions, and conditions, not source code.

3. **Data Flow**: Not applicable.

4. **Dependencies**: Not applicable.

5. **Analysis Methods**: Not applicable.

6. **Figures/Outputs**: Not applicable.

7. **Key Parameters**: Not applicable.

***

**Analyst Note:** This file is a standard boilerplate license. Its presence indicates that the associated code is released as "Free Software" under a copyleft license, meaning any derivative works must also be distributed under the same terms.

---

## naturalSceneSimu/ITE_package_cmu/code/shared/embedded/NCut/LICENSE.txt

This file contains the **GNU General Public License, version 3 (GPLv3)**. It is a standard legal document included in software repositories to define the terms under which the associated source code can be used, modified, and distributed.

### 1. Purpose
This file establishes the legal licensing terms for the software within the `NCut` directory. It mandates that any derivative works or distributions of this code must remain free and open-source under the same GPLv3 terms.

### 2. Key Functions/Classes
*   **Not Applicable**: As a legal license text file, it contains no executable code, functions, or classes.

### 3. Data Flow
*   **Not Applicable**: This file does not process, read, or write data.

### 4. Dependencies
*   **Not Applicable**: This is a standalone legal document.

### 5. Analysis Methods
*   **Not Applicable**: This file does not implement scientific or statistical methods.

### 6. Figures/Outputs
*   **Not Applicable**: This file does not generate figures or software outputs.

### 7. Key Parameters
*   **Not Applicable**: This file contains no configurable parameters.

***

**Analyst Note:** The presence of this file indicates that the code in the `naturalSceneSimu/ITE_package_cmu/code/shared/embedded/NCut/` directory is released under a "copyleft" license. Users of this repository must comply with the requirements of the GPLv3, including making source code available and attributing changes if they distribute modified versions of the software.

---

## naturalSceneSimu/ITE_package_cmu/code/shared/embedded/NCut/README.txt

This file serves as the documentation and installation guide for the **Normalized Cut (NCut) Segmentation Code**, a research-grade toolkit for graph-based image and data clustering.

### 1. Purpose
This package provides a MATLAB implementation of the Normalized Cuts algorithm for image segmentation and point cloud clustering. It enables users to partition data by computing eigenvalues and eigenvectors of similarity graphs.

### 2. Key Functions/Classes
*   **`demoNcutImage`**: Executes a demonstration of image segmentation.
*   **`demoNcutClustering`**: Executes a demonstration of point cloud clustering.
*   **`NcutImage`**: The primary wrapper function to segment an input image `I` into a specified number of segments.
*   **`ICgraph`**: Computes the pixel similarity matrix `W` based on the Intervening Contour model.
*   **`ncutW`**: Performs the core clustering operation on a pre-computed similarity graph `W`.
*   **`compileDir_simple`**: A utility script used once to compile the C++ MEX files required for high-performance computation.

### 3. Data Flow
*   **Input**: The code takes images (as matrices) or raw data points as input.
*   **Processing**: It constructs a similarity graph (typically via `ICgraph`), computes the spectral decomposition of the graph Laplacian, and applies discretization to retrieve labels.
*   **Output**: Returns segmentation labels (`SegLabel`), eigenvectors/eigenvalues, and the similarity matrix (`W`).

### 4. Dependencies
*   **MATLAB**: Tested specifically on R2009b.
*   **MEX Compiler**: Requires a C++ compiler to build the optimization-heavy components of the package from source files.

### 5. Analysis Methods
*   **Normalized Cuts (NCut)**: A spectral clustering method that minimizes the "cut" between partitions of a graph while maximizing the "association" within the groups.
*   **Intervening Contour (IC)**: A method for calculating pixel affinity based on edge intensity between points, which helps ensure that boundaries align with actual image gradients.
*   **Eigen-decomposition**: Solves the generalized eigenvalue problem $Wv = \lambda Dv$ (where $D$ is the degree matrix) to find optimal partitions.

### 6. Figures/Outputs
*   **Segmented Images**: Visual representations of the image partitioned into $k$ distinct regions.
*   **Clustered Point Clouds**: Visualization of geometric data grouped into distinct clusters.
*   **Mathematical Metrics**: Numerical outputs including the `NcutDiscrete` labels, `NcutEigenvectors`, and `NcutEigenvalues`.

### 7. Key Parameters
*   **`nbSegments`**: The primary parameter defining the desired number of clusters or segments into which the data should be partitioned.
*   **Similarity Matrix (`W`)**: The structure defining the relationships/edges between nodes in the graph; it is the most critical internal data structure influencing the final output.

---

## naturalSceneSimu/ITE_package_cmu/code/shared/embedded/PSD_SzegoT/LICENSE.txt

This file represents the **GNU General Public License, Version 3 (GPLv3)**. It is a legal document defining the terms and conditions under which the associated software components are licensed.

### 1. Purpose
This file establishes the legal framework for the `PSD_SzegoT` component of the repository, ensuring that the software remains "free" by granting users the rights to copy, distribute, and modify the code, provided that these same freedoms are maintained in derivative works.

### 2. Key Functions/Classes
* **N/A**: As this is a license text file and not source code, it contains no executable functions or classes.

### 3. Data Flow
* **N/A**: This file is a static legal notice and does not perform data processing.

### 4. Dependencies
* **N/A**: This file is an independent legal document provided by the Free Software Foundation.

### 5. Analysis Methods
* **N/A**: No scientific or statistical methodologies are contained within this file.

### 6. Figures/Outputs
* **N/A**: No figures, plots, or data outputs are produced by this file.

### 7. Key Parameters
* **N/A**: There are no configurable parameters within this file.

***

**Note for Research Context**: The presence of this file indicates that the code within `naturalSceneSimu/ITE_package_cmu/code/shared/embedded/PSD_SzegoT/` is subject to copyleft requirements. If you intend to modify or redistribute this research code, you must adhere to the obligations specified in this license (e.g., providing access to modified source code and retaining copyright notices).

---

## naturalSceneSimu/ITE_package_cmu/code/shared/embedded/PSD_SzegoT/README.txt

Based on the content provided for the file `naturalSceneSimu/ITE_package_cmu/code/shared/embedded/PSD_SzegoT/README.txt`, here is the structured summary:

### 1. Purpose
This file serves as the documentation/manifest for the `PSD_SzegoT` module, which is part of a larger Information-Theoretic Estimation (ITE) package. It identifies the author and licensing terms for the underlying mathematical implementation.

### 2. Key Functions/Classes
*   **Note:** The provided text is a README file and does not contain source code definitions. However, based on the naming convention (`PSD_SzegoT`), the directory likely contains functions to calculate the **Power Spectral Density (PSD)** using **Szegő’s Limit Theorem** for Toeplitz matrices.

### 3. Data Flow
*   **Input/Output:** Not specified in the README. Generally, such modules would accept time-series data or autocorrelation sequences as input and output estimated spectral density values.

### 4. Dependencies
*   The README does not explicitly list dependencies, but given its location within the `ITE_package_cmu`, it is likely designed to integrate with the broader ITE framework (typically implemented in MATLAB or Python).

### 5. Analysis Methods
*   **Szegő’s Limit Theorem:** The module utilizes this mathematical theorem, which relates the eigenvalues of Toeplitz matrices to the integral of the PSD. This is commonly used in scientific research for efficient estimation of spectral properties in large-scale stationary stochastic processes.

### 6. Figures/Outputs
*   No figures or outputs are generated by the README itself. The module likely returns numerical estimates (arrays/vectors) representing the power spectrum.

### 7. Key Parameters
*   **Not specified:** The README does not detail specific configurable parameters (e.g., window size, number of lags, or sampling frequency), as these would be defined within the `.m` or `.py` files contained in the parent directory.

***

**Analyst's Note:** This file is strictly informational/legal. To identify specific function signatures or parameters, the actual source code files (likely ending in `.m` or `.py`) within the `PSD_SzegoT/` directory must be examined.

---

## naturalSceneSimu/ITE_package_cmu/code/shared/embedded/TCA/license.txt

This file is a standard legal document included within the repository to define the terms of use and distribution for the associated software.

### 1. Purpose
This file provides the official text of the **GNU General Public License, Version 2 (GPLv2)**. Its purpose is to grant users the legal rights to share, modify, and redistribute the software within the `TCA` directory while ensuring the software remains "free" (as in freedom) for all subsequent users.

### 2. Key Functions/Classes
*   **None**: This is a text-based legal document and does not contain executable code, functions, or classes.

### 3. Data Flow
*   **N/A**: This file is informational and is not processed or executed by the repository's code.

### 4. Dependencies
*   **None**: This is a standalone license document.

### 5. Analysis Methods
*   **N/A**: Does not contain scientific or statistical algorithms.

### 6. Figures/Outputs
*   **N/A**: Does not generate figures or data outputs.

### 7. Key Parameters
*   **N/A**: Does not contain configurable software parameters.

***

**Note for Researchers:** The presence of this file indicates that the code modules located in `naturalSceneSimu/ITE_package_cmu/code/shared/embedded/TCA/` are licensed under the GPLv2. If you incorporate this code into your own research projects or derivative works, you are legally obligated to comply with the terms of the GPLv2, which generally requires that any derivative work you distribute must also be made available under the same license terms (often called "copyleft").

---

## naturalSceneSimu/ITE_package_cmu/code/shared/embedded/TCA/readme.txt

This file serves as the documentation and installation guide for the **TCA (Trees and Clusters Analysis)** software package, an implementation of the machine learning methods described in the research paper "Beyond independent components: trees and clusters" by Bach and Jordan (2003).

### 1. Purpose
This file provides instructions for installing and setting up the TCA MATLAB package, which implements algorithms for identifying tree and cluster structures in data beyond standard Independent Component Analysis (ICA).

### 2. Key Functions/Classes
*   **`chol_gauss.c`**: An optional C-based implementation provided to accelerate the computation of Gaussian Cholesky decompositions, critical for the package's performance.

### 3. Data Flow
*   **Input**: MATLAB `.m` files containing the core TCA algorithms.
*   **Process**: The package processes multi-dimensional data to extract underlying tree or cluster structures. If compiled, the MEX interface processes data through the optimized C-based `chol_gauss` routine.
*   **Output**: The package is designed to output analytical structures representing dependencies or clusters found within the input datasets.

### 4. Dependencies
*   **MATLAB**: The package is built for MATLAB (specifically tested on version 6).
*   **Compiler**: A C compiler (e.g., `gcc` or platform-equivalent) is required to build the optional `chol_gauss` MEX file for performance optimization.

### 5. Analysis Methods
*   **Trees and Clusters Analysis**: The package implements hierarchical and structured probabilistic modeling methods designed to move beyond the assumptions of standard Independent Component Analysis (ICA).
*   **Cholesky Decomposition**: Utilized as a fundamental linear algebra operation for the underlying statistical models, with an optimized C implementation provided.

### 6. Figures/Outputs
*   While this file is a readme, the package itself is intended to generate statistical models representing data structure, typically represented as trees or partitions (clusters) rather than traditional plots.

### 7. Key Parameters
*   **Environment**: The installation requires correct configuration of the MATLAB MEX compiler to ensure the `chol_gauss` routine is linked to the platform-specific architecture (Windows/Solaris/Linux).

---

## naturalSceneSimu/ITE_package_cmu/code/shared/embedded/ann_wrapperM/CHANGELOG.txt

This file is a `CHANGELOG.txt` document for an ANN (Approximate Nearest Neighbors) wrapper library. Below is the structured analysis:

### 1. Purpose
This file provides a historical record of updates and bug fixes for a MATLAB wrapper designed to interface with the ANN library. It documents the evolution of the software used for performing nearest neighbor searches within the `naturalSceneSimu` repository.

### 2. Key Functions/Classes
*   **`text_ann_wrapper.m`**: The primary test/interface script mentioned in the changelog, responsible for verifying the functionality of the ANN wrapper, specifically the fixed-radius search (`frsearch`) routine.

### 3. Data Flow
*   **Processes**: The wrapper processes coordinate data or feature vectors to perform spatial searching.
*   **Input**: The code takes geometric point sets (or feature vectors) to populate a search tree and performs queries on these sets.
*   **Output**: Returns indices or distances of neighboring points within a specified radius or count (k-nearest neighbors).

### 4. Dependencies
*   **ANN Library**: The file serves as a MATLAB interface for the underlying C++ ANN (Approximate Nearest Neighbors) library, a common standard for high-performance spatial searching.

### 5. Analysis Methods
*   **Fixed-Radius Search (`frsearch`)**: A spatial indexing method used to locate all points within a specific distance $R$ of a query point.
*   **Nearest Neighbor Search**: General algorithms for finding the closest point(s) in a multidimensional space.

### 6. Figures/Outputs
*   **Outputs**: The wrapper outputs vectors of indices and/or distance metrics derived from the search results. No visual figures are generated directly by the wrapper; it is intended for integration into larger computational pipelines.

### 7. Key Parameters
*   **Radius ($R$)**: A search parameter for `frsearch` that determines the Euclidean distance threshold for including points in the search results.
*   **$k$ (implicit)**: In the context of the ANN library, the number of neighbors to retrieve is usually a primary configurable parameter, though specifically highlighted in the context of the bug fix for radius-based queries.

---

## naturalSceneSimu/ITE_package_cmu/code/shared/embedded/ann_wrapperM/LICENSE.txt

This file is a standard legal document representing the licensing terms for the software component. Below is the structured analysis:

### 1. Purpose
This file contains the full text of the **GNU Lesser General Public License (LGPL) version 3**. It serves as the governing legal agreement for the `ann_wrapperM` directory, defining the permissions and restrictions for using, modifying, and distributing the associated library code.

### 2. Key Functions/Classes
*   **None.** As a legal text file, it contains no executable code, functions, or classes.

### 3. Data Flow
*   **None.** This file does not perform data processing, input, or output operations.

### 4. Dependencies
*   **None.** This file is a standalone license document.

### 5. Analysis Methods
*   **N/A.** The file is a legal text, not a scientific algorithm or statistical method.

### 6. Figures/Outputs
*   **None.**

### 7. Key Parameters
*   **None.**

***

**Analyst's Note:** This file indicates that the code within the `naturalSceneSimu/ITE_package_cmu/code/shared/embedded/ann_wrapperM/` directory is released under the LGPL v3. This implies that researchers using this code can link it to their own software (even proprietary or closed-source applications) provided they adhere to the LGPL's requirements regarding the modification and redistribution of the library itself (e.g., providing source code for changes made to the `ann_wrapperM` library).

---

## naturalSceneSimu/ITE_package_cmu/code/shared/embedded/ann_wrapperM/README.txt

This file is a `README.txt` documentation for a MATLAB wrapper interface to the **ANN (Approximate Nearest Neighbor)** C++ library, developed by Shai Bagon at the Weizmann Institute of Science.

### 1. Purpose
This file provides installation instructions, API documentation, and usage examples for a MATLAB-to-C++ interface that enables high-performance approximate nearest neighbor searches using kd-trees and BBD-trees. It is designed to integrate the C++ ANN library into a MATLAB workflow for scientific computing tasks.

### 2. Key Functions/Classes
*   **`ann(pts)`**: Constructor that initializes the ANN object with a $d \times N$ matrix of points.
*   **`ksearch`**: Performs a $k$-nearest neighbor search for given query points.
*   **`prisearch`**: Executes a priority search to find the nearest neighbors.
*   **`frsearch`**: Performs a fixed-radius search to identify points within a specified distance ($r$).
*   **`close(anno)`**: Essential destructor method to free memory and release resources associated with the C++ object.

### 3. Data Flow
*   **Input**: Takes a $d \times N$ matrix of $d$-dimensional vectors (dataset) and query points (as vectors or matrices).
*   **Processing**: Uses the compiled C++ library (ANN) to build kd-trees or BBD-trees in memory.
*   **Output**: Returns indices of matches and squared distances to the query points.

### 4. Dependencies
*   **ANN Library**: The original C++ source by David M. Mount and Sunil Arya (v1.1.1).
*   **System Requirements**: Requires a C++ compiler (Visual Studio for Windows or GCC for Linux) and MATLAB’s `mex` utility to compile the wrapper.

### 5. Analysis Methods
*   **Algorithm Implementations**: Uses kd-trees and Balanced Box-Decomposition (BBD) trees for spatial indexing.
*   **Mathematical Approach**: Approximate nearest neighbor search, allowing for a user-defined accuracy trade-off (the `eps` parameter) to achieve logarithmic expected time performance.

### 6. Figures/Outputs
*   The package does not generate visual figures directly; it outputs numerical data:
    *   `idx`: Indices of the found nearest neighbors.
    *   `dst`: Squared distances to those neighbors.
    *   `inr`: Count of points found within a fixed radius (for `frsearch`).

### 7. Key Parameters
*   **`k`**: The number of nearest neighbors to retrieve.
*   **`eps`**: An accuracy multiplicative factor (error bound); as `eps` increases, search speed increases but precision decreases.
*   **`asm`**: A boolean flag (allow self-match) that dictates whether to include the query point itself if it exists in the dataset.
*   **`r`**: The search radius for fixed-radius queries.

---

## naturalSceneSimu/ITE_package_cmu/code/shared/embedded/ann_wrapperM/VERSION.txt

### File Analysis: `naturalSceneSimu/ITE_package_cmu/code/shared/embedded/ann_wrapperM/VERSION.txt`

The provided file is a simple metadata text file used for version control within the `ann_wrapperM` directory.

---

**1. Purpose**
This file serves as a version identifier for the `ann_wrapperM` module, indicating the last update or release timestamp to ensure compatibility within the repository.

**2. Key Functions/Classes**
*   **None.** This is a static text file, not a script or executable code.

**3. Data Flow**
*   **Reads/Writes:** None. It acts as a static documentation file for repository tracking.

**4. Dependencies**
*   **None.** It is an independent metadata file.

**5. Analysis Methods**
*   **None.** No scientific or statistical methods are implemented within this file.

**6. Figures/Outputs**
*   **Outputs:** The content of the file displays the string "Version Mar2012," which provides developers or automated systems with the version date.

**7. Key Parameters**
*   **Version Date:** "Mar2012" serves as the primary parameter to identify the state of the `ann_wrapperM` (Approximate Nearest Neighbor wrapper) code.

---

## naturalSceneSimu/ITE_package_cmu/code/shared/embedded/clinep/license.txt

Based on the provided file, here is the structured summary:

1. **Purpose**:
This file serves as the legal documentation for the `clinep` component within the repository, establishing the terms and conditions under which the software may be used, modified, and distributed. It is a standard "New BSD" (or "Modified BSD") license file.

2. **Key Functions/Classes**:
*   **None**: This is a text-based legal document and does not contain executable code, classes, or functions.

3. **Data Flow**:
*   **N/A**: This file does not process, read, or write any data.

4. **Dependencies**:
*   **None**: This file is self-contained and does not have software dependencies.

5. **Analysis Methods**:
*   **N/A**: This file does not implement any scientific or statistical methods.

6. **Figures/Outputs**:
*   **N/A**: This file generates no outputs or figures.

7. **Key Parameters**:
*   **N/A**: There are no configurable parameters within this file.

---

## naturalSceneSimu/ITE_package_cmu/code/shared/embedded/combn/license.txt

This file is a standard legal document defining the distribution terms for a specific component within the repository. Here is the structured summary:

1. **Purpose**: 
This file serves as the legal license for the `combn` utility package. It outlines the "Simplified BSD License" (or "FreeBSD License") terms under which the software is provided to the user.

2. **Key Functions/Classes**: 
None. This is a text file containing legal boilerplate text, not executable code.

3. **Data Flow**: 
None. The file does not process, read, or write data.

4. **Dependencies**: 
None.

5. **Analysis Methods**: 
None.

6. **Figures/Outputs**: 
None.

7. **Key Parameters**: 
None.

***

**Additional Analyst Note:** 
The license identifies **Jos van der Geest** (2009) as the copyright holder. In the context of a scientific research repository, this indicates that the `combn` module is a third-party contribution or a utility library external to the primary research codebase, which the researchers have integrated under the permissions granted by this BSD-style license.

---

## naturalSceneSimu/ITE_package_cmu/code/shared/embedded/fastKICA/LICENSE.txt

This file is a standard legal document accompanying the source code in the repository. Below is the structured analysis:

1. **Purpose**: 
This file serves as the legal documentation for the **GNU General Public License (GPL) Version 2**. It defines the terms and conditions under which the `fastKICA` software may be used, modified, and redistributed.

2. **Key Functions/Classes**: 
None. This is a text-based legal license document and contains no executable code.

3. **Data Flow**: 
N/A (Non-executable documentation).

4. **Dependencies**: 
N/A.

5. **Analysis Methods**: 
N/A.

6. **Figures/Outputs**: 
None.

7. **Key Parameters**: 
None.

***

**Summary Note:** 
As this is a `LICENSE.txt` file, it does not contribute to the scientific computation or data processing logic of the `fastKICA` package. Its presence is mandatory in open-source repositories to clarify intellectual property rights, stating that the software is provided "as is" without warranty and under the copyleft provisions of the GPLv2.

---

## naturalSceneSimu/ITE_package_cmu/code/shared/embedded/fastKICA/README.txt

This file, `README.txt`, serves as the documentation for the **Fast Kernel Independent Component Analysis (FastKICA)** Matlab package. It provides instructions on compilation, usage, and performance optimization for the algorithm.

### 1. Purpose
The package implements the Fast Kernel ICA algorithm, which uses an approximate Newton method to minimize the Hilbert-Schmidt Independence Criterion (HSIC) for blind source separation. It allows users to recover original source signals from mixed signal inputs.

### 2. Key Functions/Classes
*   **`fastkica.m`**: The primary routine that performs the optimization to find the demixing matrix.
*   **`hsicChol.m`**: Computes the Hilbert-Schmidt norm of the covariance operator using incomplete Cholesky decomposition.
*   **`hessChol.m`**: Computes the Hessian matrix required for the Newton optimization.
*   **`demo.m`**: A demonstration script that loads sample audio data and performs the demixing process.
*   **`amariD.m`**: Calculates the Amari divergence, a metric for evaluating ICA performance.

### 3. Data Flow
*   **Input**: Takes a matrix of mixed signals (`n` samples × `m` sources), an initial guess for the demixing matrix, and tuning parameters (sigma, threshold, max iterations).
*   **Processing**: Uses mex-compiled C code for kernel computations and gradient estimations; iteratively updates the demixing matrix via Newton's method.
*   **Output**: Returns the estimated demixing matrix, the sequence of matrices through iterations, and the evolution of the HSIC values.

### 4. Dependencies
*   **Matlab**: Requires the Matlab environment and a C/C++ compiler (e.g., Lcc, MSVC, or GCC) to compile the `.c` files into `.mex` executables.
*   **BLAS/LAPACK**: Dependent on the `libmwlapack` library for linear algebra operations.
*   **External References**: Incorporates code snippets for incomplete Cholesky decomposition provided by Francis Bach.

### 5. Analysis Methods
*   **Fast Kernel ICA**: An approach to ICA based on kernel-based measures of statistical independence (HSIC).
*   **Incomplete Cholesky Decomposition**: Used to approximate the kernel matrix efficiently, managing memory and computational complexity for large datasets.
*   **Approximate Newton Method**: Used for non-convex optimization to minimize the dependence between estimated sources.

### 6. Figures/Outputs
*   While the code does not generate plots directly, it returns the `hsics` variable, which can be plotted to visualize convergence (the document specifically references plotting convergence as described in the accompanying research paper [1]).

### 7. Key Parameters
*   **`sigma`**: The width of the Gaussian kernel (influences the precision of the independence measure).
*   **`maxiter`**: The maximum number of iterations allowed for the optimizer.
*   **`thresh`**: The convergence threshold based on the change in HSIC values.
*   **`maxdim`**: Maximum number of columns used in the incomplete Cholesky approximation (defined in `fastkica.m`).
*   **`etas`**: The precision threshold for the Cholesky approximation (defined in `fastkica.m`).

---

## naturalSceneSimu/ITE_package_cmu/code/shared/embedded/if-estimators/LICENSE.txt

This file contains the legal text for the **GNU General Public License (GPL) version 3**, which governs the usage, modification, and distribution of the software in the `naturalSceneSimu/ITE_package_cmu` repository.

### 1. Purpose
This file provides the official legal licensing agreement for the associated software package. It ensures that the software remains free and open-source by requiring that any modified versions be released under the same license and that source code remains accessible to recipients.

### 2. Key Functions/Classes
*   **None**: This is a plain-text legal document. It contains no executable code, classes, or functions.

### 3. Data Flow
*   **None**: As a license document, this file does not process, read, or write data.

### 4. Dependencies
*   **None**: This document is independent and does not require external software libraries.

### 5. Analysis Methods
*   **N/A**: This file does not implement scientific or statistical methods.

### 6. Figures/Outputs
*   **None**: This file does not generate visual outputs, plots, or figures.

### 7. Key Parameters
*   **None**: There are no configurable parameters within this document. 

***

**Note**: This file is a standard boilerplate text (GPL v3) included in many open-source repositories to define the legal framework for the project. For the actual scientific algorithms or implementations, you should refer to the `.py`, `.m`, or other code files located within the `naturalSceneSimu/ITE_package_cmu/code/shared/embedded/if-estimators/` directory.

---

## naturalSceneSimu/ITE_package_cmu/code/shared/embedded/if-estimators/README.md

This file serves as the documentation/README for a MATLAB-based toolbox used for nonparametric information-theoretic estimation via Influence Functions.

### 1. Purpose
This package provides a suite of MATLAB functions to perform nonparametric estimation of information-theoretic functionals, including various entropies, mutual informations, and divergences. The implementation is based on the research paper "Influence Functions for Machine Learning" (Kandasamy et al.), which provides a framework for estimating these functionals with associated asymptotic confidence intervals.

### 2. Key Functions/Classes
*   **`ifSetup.m`**: Installation script to configure the MATLAB environment by adding subdirectories to the path.
*   **`demos.m` / `demo1-4.m`**: Example scripts demonstrating the implementation of different functionals across various settings.
*   **`parseCommonParams.m`**: Utility function to configure hyperparameter settings for the estimators.
*   **Estimator Implementations**: Includes functions for:
    *   **Entropies**: Shannon, Conditional Shannon.
    *   **Mutual Informations**: Shannon, Conditional Shannon.
    *   **Divergences**: Chi-squared, Hellinger, KL, Tsallis, Renyi, Conditional KL, Conditional Tsallis.

### 3. Data Flow
*   **Inputs**: The estimators typically take multivariate data (samples) as input.
*   **Processes**: The code applies nonparametric estimation techniques to these samples based on influence functions.
*   **Outputs**: Returns the estimated scalar value of the functional and calculates asymptotic confidence intervals.

### 4. Dependencies
*   **Environment**: Requires MATLAB.
*   **Internal**: Depends on local subdirectories containing the core estimator logic; users are required to execute `ifSetup.m` to ensure these files are on the MATLAB path.

### 5. Analysis Methods
*   **Nonparametric Statistics**: Uses Influence Function-based estimation for statistical functionals.
*   **Asymptotic Inference**: Provides methods to calculate asymptotic confidence intervals to measure the reliability of the point estimates.
*   **Dimensionality Constraints**: Designed for low-to-moderate dimensional data (effective in 4–6 dimensions or fewer, depending on the complexity of the problem).

### 6. Figures/Outputs
*   **Numerical Outputs**: The primary outputs are point estimates of the requested information-theoretic functionals and their corresponding confidence intervals.
*   **Demonstration Outputs**: The included demo scripts are designed to verify the functionality and output results to the MATLAB workspace/console.

### 7. Key Parameters
*   **Hyperparameters**: Managed via `parseCommonParams`. The authors note that the default settings are robust and should be used unless the user has specific requirements or expertise based on the underlying research paper.

---

## naturalSceneSimu/ITE_package_cmu/code/shared/embedded/knn/license.txt

This file serves as the legal documentation for the K-Nearest Neighbors (k-NN) module within the specified research repository.

### 1. Purpose
This file provides the legal licensing terms for the k-NN source code distributed within the `naturalSceneSimu` repository. It establishes the "New BSD" (3-Clause BSD) licensing agreement under which the code is provided to researchers.

### 2. Key Functions/Classes
*   **None**: This is a documentation/legal file, not source code. It contains no executable functions or classes.

### 3. Data Flow
*   **None**: This file does not process, read, or write any experimental data.

### 4. Dependencies
*   **None**: This is a standalone license document.

### 5. Analysis Methods
*   **None**: No scientific or statistical methods are implemented within this file.

### 6. Figures/Outputs
*   **None**: This file does not generate any figures or data outputs.

### 7. Key Parameters
*   **None**: No configurable parameters are defined in this file.

---

## naturalSceneSimu/ITE_package_cmu/code/shared/embedded/pmtk3/license.txt

### Code Analysis Summary

**1. Purpose**
This file serves as the legal documentation for the **PMTK3 (Probabilistic Modeling Toolkit for Matlab)** library included within the `naturalSceneSimu` repository. It explicitly defines the terms under which the software may be used, modified, and distributed by researchers.

**2. Key Functions/Classes**
*   **None**: This is a standalone license text file and contains no executable code, functions, or classes.

**3. Data Flow**
*   **Reads/Writes**: None. 
*   **Processes**: None.

**4. Dependencies**
*   **None**: This file is a legal dependency requirement for the PMTK3 package but does not rely on external code.

**5. Analysis Methods**
*   **N/A**: This file is a legal document and does not contain scientific or statistical implementations.

**6. Figures/Outputs**
*   **N/A**: This file does not produce any graphical or data outputs.

**7. Key Parameters**
*   **N/A**: There are no configurable parameters within this file.

***

**Analyst Note:** This file indicates that the code found in the `pmtk3` directory is governed by the **MIT License**. Users of this research repository should ensure that any derivative works or redistribution of the included PMTK3 source code maintain the original copyright notice and permission statement provided in this file.

---

## naturalSceneSimu/ITE_package_cmu/code/shared/embedded/spectral_clustering/Readme.txt

This document serves as the documentation/README file for a suite of MATLAB routines dedicated to spectral clustering.

### 1. Purpose
This file provides instructional documentation for a collection of MATLAB scripts designed to generate sample data, construct similarity graphs, and execute fast spectral clustering algorithms. It is intended to support the implementation of graph-based clustering techniques for scientific data analysis.

### 2. Key Functions/Classes
While the file does not list specific function names, it identifies the functional components provided by the package:
*   **Data Generation Utilities**: Scripts to create sample datasets.
*   **Similarity Graph Constructors**: Tools to transform data into different types of similarity graphs (e.g., epsilon-neighborhood or k-Nearest neighbors).
*   **Clustering Solvers**: Implementations of spectral clustering algorithms (specifically citing the Shi and Malik method).

### 3. Data Flow
*   **Input**: Takes adjacency matrices (preferably in sparse format) representing the similarity structure of the data.
*   **Processing**: The package processes these matrices to perform spectral decomposition and clustering.
*   **Output**: Produces cluster assignments based on the processed graph structure.

### 4. Dependencies
*   **Base Requirement**: MATLAB environment.
*   **Theoretical Basis**: The package is explicitly built upon the methodology outlined in Ulrike von Luxburg’s *“A Tutorial on Spectral Clustering” (2007)*.

### 5. Analysis Methods
*   **Spectral Clustering**: Implements clustering algorithms based on the Laplacian of similarity graphs.
*   **Graph Construction**: Supports Epsilon-neighborhood and Mutual k-Nearest Neighbors (k-NN) graphs.
*   **Algorithm Specification**: Specifically mentions the spectral clustering approach developed by Shi and Malik (2000).
*   **Memory Optimization**: Heavily relies on sparse matrix data structures for efficiency.

### 6. Figures/Outputs
*   The file does not explicitly detail output files, but the scripts are designed to return processed cluster classifications and associated graph structures.

### 7. Key Parameters
*   **Sparsity**: A critical constraint for the package is the use of sparse matrices to manage memory usage.
*   **Neighborhood Type**: Users are recommended to configure the similarity graph using either *epsilon* thresholds or *mutual k-nearest neighbor* logic to ensure efficient processing.

---

## naturalSceneSimu/ITE_package_cmu/code/shared/embedded/spectral_clustering/license.txt

This file is a standard legal document defining the distribution terms for the software module located in the `spectral_clustering` directory of the repository.

### 1. Purpose
This file serves as the legal licensing agreement for the spectral clustering module, specifying the "Simplified BSD" (or "FreeBSD") license terms under which the code is shared. It grants users permission to redistribute and modify the source code provided that the copyright notices and disclaimer are maintained.

### 2. Key Functions/Classes
*   **None**: As a `.txt` license file, it contains no executable code, functions, or classes.

### 3. Data Flow
*   **None**: The file is static documentation and does not perform data processing, input, or output operations.

### 4. Dependencies
*   **None**: This file does not import or depend on any software libraries.

### 5. Analysis Methods
*   **None**: This file does not implement any scientific or statistical algorithms.

### 6. Figures/Outputs
*   **None**: No figures or computational outputs are produced.

### 7. Key Parameters
*   **None**: No configurable scientific or code parameters are defined.

---

## naturalSceneSimu/ITE_package_cmu/code/shared/embedded/sqdistance/license.txt

Based on the provided content, here is the structured summary for the file `license.txt`:

1.  **Purpose**: This file serves as the legal documentation defining the terms of use, distribution, and liability disclaimer for the associated source code. It establishes that the software is provided under a standard BSD-style open-source license.

2.  **Key Functions/Classes**: N/A (This is a legal document, not a source code file).

3.  **Data Flow**: N/A.

4.  **Dependencies**: N/A.

5.  **Analysis Methods**: N/A.

6.  **Figures/Outputs**: N/A.

7.  **Key Parameters**: N/A.

***

**Analyst Note:** This file is a boilerplate legal text indicating that the code in the `sqdistance` directory was authored by Michael Chen in 2009. It provides permission for redistribution and modification, provided the original copyright notice is maintained, while explicitly disclaiming all warranties and liability for damages resulting from the use of the code.

---

## naturalSceneSimu/ITE_package_cmu/code/shared/embedded/weightedkNN/license.txt

This file is a standard legal document provided as part of the repository to define the terms of use for the software.

### 1. Purpose
This file contains the full text of the **GNU General Public License (GPL) version 3**. It serves as the legal framework governing the copying, distribution, and modification of the software within the `weightedkNN` directory, ensuring it remains free and open-source.

### 2. Key Functions/Classes
*   **None**: This is a text-based legal document, not source code. It contains no programmatic functions, classes, or executable logic.

### 3. Data Flow
*   **None**: As a licensing text file, it is intended for human reading and legal compliance verification rather than computational data processing.

### 4. Dependencies
*   **None**: This is an independent license file.

### 5. Analysis Methods
*   **Not Applicable**: This file does not implement scientific or statistical methods.

### 6. Figures/Outputs
*   **None**: This file generates no data, plots, or visual outputs.

### 7. Key Parameters
*   **Not Applicable**: There are no configurable parameters, variables, or constants defined in this file.

---

## naturalSceneSimu/ITE_package_cmu/doc/ITE_documentation.txt

Based on the file provided, here is the structured summary for `ITE_documentation.txt`:

### 1. Purpose
This file serves as a documentation pointer for the **ITE (Information Theoretical Estimators) toolbox**. It directs users to the online repository to access official release-specific PDF documentation.

### 2. Key Functions/Classes
*   **None:** This is a plain text informational file; it contains no executable code, classes, or function definitions.

### 3. Data Flow
*   **Reads/Writes:** None.
*   **Processes:** None. The file simply provides a URL reference for external resource retrieval.

### 4. Dependencies
*   **External:** Requires a web browser to access the Bitbucket repository (`https://bitbucket.org/szzoli/ite/downloads`) for the full documentation PDF.

### 5. Analysis Methods
*   **None:** This file is for administrative/documentation reference only and does not implement scientific or statistical methods. (Note: The *toolbox itself* typically implements entropy and mutual information estimators, but this specific file does not contain them).

### 6. Figures/Outputs
*   **None:** No figures or data outputs are generated by this file.

### 7. Key Parameters
*   **None:** There are no configurable parameters or variables defined in this text file.

---

## naturalSceneSimu/KerneIMI/license.txt

This file is a standard open-source software license. Below is the structured analysis:

1. **Purpose**: 
This file serves as the legal documentation for the `naturalSceneSimu/KerneIMI` repository, specifying the terms and conditions for redistribution and use of the software. It declares the code as being under a standard **Simplified BSD License**.

2. **Key Functions/Classes**: 
None. This is a text-based legal document and contains no executable code.

3. **Data Flow**: 
None.

4. **Dependencies**: 
None.

5. **Analysis Methods**: 
None.

6. **Figures/Outputs**: 
None.

7. **Key Parameters**: 
None.

***

**Summary Note**: As this file is a `license.txt`, it does not contain scientific or technical logic. It identifies **Mikhail Shugay** as the copyright holder (dated 2011) and grants users permission to use the repository's code provided that the copyright notice is retained and the software is used without warranty.

---

## naturalSceneSimu/TLS/ReadMe.txt

This file serves as the documentation/manifest for a Matlab toolbox focused on **Total Least Squares (TLS)** estimation and data fitting, developed by researchers at the Technical University of Kosice.

### 1. Purpose
The toolbox provides a suite of Matlab functions for performing Total Least Squares estimation, 2D/3D data fitting, and model identification. It is designed to assist with statistical regression tasks where errors exist in both independent and dependent variables.

### 2. Key Functions/Classes
*   **`fit_2D_data` / `fit_2D_data_SVD`**: Core functions for performing TLS fitting on 2D datasets, with the latter specifically leveraging Singular Value Decomposition.
*   **`orm`**: Likely related to "Orthogonal Regression Modeling" or general order-based modeling.
*   **`statindexes`**: Calculates statistical error indexes (residual analysis).
*   **`numerFminS` / `numerFminD`**: Numerical optimization routines for parameter estimation within specified bounds.
*   **`corrindex`**: Evaluates correlation or goodness-of-fit indexes.
*   **`fit_3D_data`**: A legacy/external function for performing TLS fitting in three dimensions.

### 3. Data Flow
*   **Inputs**: Reads raw data files (e.g., `dataLRM.txt`, `dataNRM.txt`, `dataERM.txt`, `dataHeater.txt`) and `.giu` files. 
*   **Processing**: Functions accept raw coordinate vectors (`XData`, `YData`) and apply regression or numerical minimization algorithms.
*   **Outputs**: Returns parameter estimates (`P`, `min_param`), error metrics (`Err`), and residuals.

### 4. Dependencies
*   **Software**: Matlab (with the **Statistics Toolbox**).
*   **External Dependencies**: Relies on specific Matlab Central File Exchange (FEX) packages for 3D fitting (`#12395`) and bounded optimization (`#8277`), handled via `requireFEXpackage` (`#31069`).

### 5. Analysis Methods
*   **Total Least Squares (TLS)**: An errors-in-variables regression approach.
*   **Singular Value Decomposition (SVD)**: Used for robust matrix factorization in 2D fitting.
*   **Numerical Optimization**: Constrained minimization via `fminsearchbnd` and custom numerical wrappers.
*   **Statistical Validation**: Residual analysis and correlation indexing to assess model quality.

### 6. Figures/Outputs
*   **Visualizations**: Several functions include a `visualization` flag to trigger plots of the data points against the fitted models.
*   **Demos**: The package includes dedicated scripts (`demo3Dplane`, `demoIdent`, `demoLRM`, `demoNRM`) that generate plots and console outputs to demonstrate the capability of the algorithms.

### 7. Key Parameters
*   **`order`**: Used in `orm` to define the complexity of the model.
*   **`LBa`, `UBa`**: Lower and Upper Bounds for numerical optimization parameters.
*   **`geometry`**: Used in 3D fitting to define the structure of the target shape (e.g., plane, line).
*   **`FTime`, `Tvz`**: Time-related parameters used for dynamic system identification in `numerFminD`.

---

## naturalSceneSimu/TLS/dataERM.txt

Based on the provided content, here is the structured analysis of the file.

### 1. Purpose
This file acts as a **data storage repository** for empirical or simulation-derived values, likely representing independent and dependent variables in a study of natural scenes (as suggested by the directory name `naturalSceneSimu/TLS/`). It stores paired numeric observations organized in a two-row matrix structure.

### 2. Key Functions/Classes
*   **None.** This is a plain text data file (ASCII format) containing raw numerical values. It does not contain executable code, functions, or class definitions.

### 3. Data Flow
*   **Reading:** Expected to be read by a processing script (e.g., Python `numpy.loadtxt` or MATLAB `load`) within the `naturalSceneSimu` framework.
*   **Writing:** Likely the output of a previous simulation run or a data extraction process from an experimental setup.
*   **Processing:** The data is structured in two rows of 12 columns, suggesting a mapping between an independent variable (Row 1) and a dependent response variable (Row 2).

### 4. Dependencies
*   **Internal:** This file depends on the parent simulation environment (`naturalSceneSimu`) to interpret the data.
*   **External:** No external libraries are required; it is a standard space/tab-delimited text file.

### 5. Analysis Methods
*   **Data Representation:** The structure suggests an **Empirical Risk Minimization (ERM)** context (indicated by the filename `dataERM.txt`). The first row appears to represent ordered input parameters or spatial/temporal coordinates, while the second row represents measured values (possibly error rates, signal magnitudes, or weights).
*   **Scaling:** The values in the second row show a significant increase (1.39 to 82.34) relative to the first row (4.23 to 26.99), suggesting a non-linear relationship often found in sensory system modeling or signal processing optimization.

### 6. Figures/Outputs
*   **Outputs:** This file serves as the raw input for downstream statistical analysis or visualization scripts (e.g., generating plots of error vs. intensity or risk minimization curves).

### 7. Key Parameters
*   **Input Range (Row 1):** 4.23 to 26.99 (likely controlled experimental parameters).
*   **Measurement/Response (Row 2):** 1.39 to 82.34 (the resulting "risk" or metric being minimized).
*   **Data Density:** 12 discrete data points per set.

---

## naturalSceneSimu/TLS/dataHeater.txt

Based on the analysis of `dataHeater.txt`, here is the structured summary:

### 1. Purpose
This file serves as a raw data input table, likely containing time-series measurements for a thermal or simulation control process (referred to as a "heater"). It represents a set of paired numeric observations, possibly mapping an independent variable (e.g., time or temperature) to a dependent variable (e.g., current, power, or signal response).

### 2. Key Functions/Classes
*   **None**: This is a pure data file (whitespace-delimited text). It contains no executable code, functions, or class definitions.

### 3. Data Flow
*   **Input/Format**: The file acts as a source for external simulation or analysis scripts. It is structured as a two-column matrix:
    *   **Column 1**: Appears to be an increasing independent variable (ranging from ~0.25 to ~0.57).
    *   **Column 2**: Appears to be a small-magnitude dependent variable or adjustment factor (ranging from -0.0005 to 0.0039).
*   **Processing**: The data shows a transition from high-precision, monotonic positive values to a high-frequency, noisy state (repeated values) at the end of the file, suggesting a stabilization or saturation phase in a physical simulation.

### 4. Dependencies
*   **None**: This is a standalone data file. It is likely read by Python (using `numpy.loadtxt` or `pandas.read_csv`) or MATLAB scripts within the `naturalSceneSimu` repository.

### 5. Analysis Methods
*   **Time-Series Sampling**: The distribution of values suggests a sampling process. The increasing density of repeated values towards the end (specifically at `0.5713`) indicates either a breakdown in sensor resolution, a control loop feedback jitter, or a numerical convergence process.

### 6. Figures/Outputs
*   **Outputs**: This file functions as an input artifact. No visual plots or logs are generated by the file itself.

### 7. Key Parameters
*   **Domain Range**: The independent variable spans approximately `[0.25, 0.57]`.
*   **Signal Magnitude**: The dependent variable is constrained to a very narrow, low-magnitude range `[-0.0005, 0.0039]`, which is characteristic of drift-correction or perturbation data in physical modeling.
*   **Discontinuity Points**: There are noticeable "steps" or "stuttering" in the data (e.g., repeated `0.5713` entries), which serve as critical edge cases for any numerical integration or interpolation logic using this data.

---

## naturalSceneSimu/TLS/dataLRM.txt

### Analysis Summary: `naturalSceneSimu/TLS/dataLRM.txt`

The provided file is a structured data file containing numerical values, likely serving as input parameters or empirical results for a simulation involving natural scene statistics or a Total Least Squares (TLS) regression model.

---

#### 1. Purpose
This file functions as a data storage container, providing numerical input arrays for a simulation or statistical model related to "natural scene" analysis. It likely stores paired observations (e.g., predictors and responses) used to validate or calibrate a Linear Regression Model (LRM).

#### 2. Key Functions/Classes
*   **None**: As a `.txt` file, this contains no executable code, classes, or functions. It is a passive data resource.

#### 3. Data Flow
*   **Input**: The file acts as a source for a parsing script (e.g., a Python or MATLAB script within the `naturalSceneSimu/TLS/` directory).
*   **Processing**: The data is likely loaded into a matrix or two vectors, where the first row acts as the independent variable ($x$) and the second row as the dependent variable ($y$).
*   **Output**: The data is used to compute regression coefficients, residuals, or fit statistics within the broader simulation pipeline.

#### 4. Dependencies
*   **External**: None (raw text).
*   **Internal**: Depends on a script located within the parent directory `naturalSceneSimu/TLS/` (e.g., a `main.py` or `analyze_data.m` script) that is programmed to read whitespace-delimited numerical values.

#### 5. Analysis Methods
*   **Statistical Fitting**: Given the file name "dataLRM" (likely Linear Regression Model), the data is designed for regression analysis.
*   **TLS (Total Least Squares)**: The directory name suggests that the data is prepared for an errors-in-variables model, where both $x$ and $y$ values are subject to measurement noise.

#### 6. Figures/Outputs
*   **Outputs**: This file does not generate outputs itself; it is the input. Resulting outputs from the pipeline likely include regression slope/intercept values, plots showing data points vs. the regression line, and residual analysis charts.

#### 7. Key Parameters
*   **Data Dimension**: $2 \times 10$ matrix.
*   **Range**: The first row (likely predictors) ranges from $\sim 0.98$ to $10.99$. The second row (likely responses/residuals) contains values ranging from $\sim -2.67$ to $1.63$, suggesting this may represent residual error or normalized feature deviations.

---

## naturalSceneSimu/TLS/dataNRM.txt

Based on the provided content from the file `naturalSceneSimu/TLS/dataNRM.txt`, here is the structured analysis:

### 1. Purpose
This file serves as a **raw data repository** containing numerical observations (likely empirical measurements or simulation outputs) used for calibrating or validating a Total Least Squares (TLS) model within the `naturalSceneSimu` framework. It provides the structured input values required for statistical analysis or curve fitting in scientific simulations.

### 2. Key Functions/Classes
*   **None**: This is a static data file containing unstructured numerical entries. It does not contain code, functions, or class definitions.

### 3. Data Flow
*   **Reads**: This file is intended to be read by external scripts (likely Python or MATLAB routines) located in the `naturalSceneSimu/TLS/` directory.
*   **Processes**: The data represents two distinct rows of floating-point values, which are typically processed as paired coordinates $(x, y)$ or as two distinct data series for regression analysis.

### 4. Dependencies
*   **Repo Context**: This file is dependent on scripts within the `naturalSceneSimu` repository that perform mathematical operations, specifically those involving TLS estimation (e.g., `fit_model.py` or similar scripts expected in the same directory).

### 5. Analysis Methods
*   **Total Least Squares (TLS)**: Given the file path, this data is prepared for TLS regression, a method used to account for errors in both the independent and dependent variables, typical in physical measurements of natural scenes.
*   **Descriptive Statistics**: The data structure suggests potential use in calculating mean values, variances, or trend lines across the two provided datasets.

### 6. Figures/Outputs
*   **Generated Outputs**: While the file itself does not generate graphics, it serves as the input source for plotting functions that visualize the relationship between the two datasets (e.g., scatter plots or regression curves).

### 7. Key Parameters
*   **Data Dimensions**: The file consists of 2 rows and 20 columns of numeric data (40 values total).
*   **Precision**: Data points are formatted to 4 decimal places, indicating a high-precision measurement source (likely simulation results or sensor data).
*   **Variables**:
    *   **Row 1**: Represents the independent variable set (likely temporal or spatial coordinate data).
    *   **Row 2**: Represents the dependent variable set (likely intensity, luminance, or signal values associated with the first row).

---

## naturalSceneSimu/TLS/license.txt

This file is a standard legal document defining the terms of use for the software contained within the `naturalSceneSimu/TLS/` directory.

### 1. Purpose
This file serves as the **BSD 2-Clause License** for the source code, establishing the legal permissions, restrictions, and disclaimers governing the redistribution and use of the software developed by Ivo Petras and Igor Podlubny.

### 2. Key Functions/Classes
*   **None**: As this is a text-based license file, it contains no executable code, classes, or functions.

### 3. Data Flow
*   **None**: The file does not process, read, or write any computational data.

### 4. Dependencies
*   **None**: This is a standalone legal document.

### 5. Analysis Methods
*   **None**: No scientific, mathematical, or statistical methods are implemented.

### 6. Figures/Outputs
*   **None**: The file produces no visual or numerical outputs.

### 7. Key Parameters
*   **None**: There are no configurable parameters within this file.

***

**Summary Note:** This file indicates that the code in the `TLS` directory is distributed under a permissive open-source license, allowing modification and redistribution provided that the copyright notice and disclaimer are preserved.

---

## naturalSceneSimu/figure_paper/color/DrosteEffect-BrewerMap-c64a384/LICENSE.TXT

This file provides the legal documentation for the software components contained within its directory. Below is the structured analysis:

### 1. Purpose
This file contains the **Apache License 2.0**, which serves as the legal framework governing the use, reproduction, and distribution of the code found in the `DrosteEffect-BrewerMap` directory. It ensures that the software remains open-source while protecting the original contributors from liability and warranty claims.

### 2. Key Functions/Classes
*   **None**: This is a plain-text legal document. It defines no programmatic functions, classes, or code logic.

### 3. Data Flow
*   **None**: This file does not process, read, or write any computational data.

### 4. Dependencies
*   **None**: This is a standalone license file.

### 5. Analysis Methods
*   **N/A**: This is a legal document, not a scientific or analytical script.

### 6. Figures/Outputs
*   **None**: This file produces no graphical outputs or scientific figures.

### 7. Key Parameters
*   **N/A**: This file contains no configurable parameters.

***

**Summary Note:** This file acts strictly as a compliance document. If you are integrating the `DrosteEffect-BrewerMap` library into a research project, ensure that any derivatives created from these files maintain the attribution notices as required by Sections 4(b) and 4(c) of this license.

---

## naturalSceneSimu/figure_paper/color/DrosteEffect-BrewerMap-c64a384/README.md

This file is the `README.md` documentation for the **BrewerMap** tool, a MATLAB-based implementation of the ColorBrewer color palettes.

### 1. Purpose
The purpose of this file is to document the `brewermap` function, which provides a comprehensive collection of Cynthia Brewer’s ColorBrewer colormaps for MATLAB. It enables users to easily apply, interpolate, and reverse high-quality, scientifically designed color schemes in various plotting contexts.

### 2. Key Functions/Classes
*   **`brewermap(N, scheme)`**: The primary function that returns an $N \times 3$ RGB array representing the selected ColorBrewer colorscheme. It supports direct calling, pre-selection, and automatic interpolation within the Lab colorspace.

### 3. Data Flow
*   **Input**: Takes a colormap length ($N$) and a string identifier (the scheme name). 
*   **Processing**: Performs downsampling or interpolation of color nodes (performed within the **Lab colorspace** to ensure perceptual linearity).
*   **Output**: Returns a standard MATLAB numeric RGB array; alternatively, it can trigger visual displays of the colormaps via the `'demo'` argument.

### 4. Dependencies
*   **None**: The function is designed to be standalone. It consists of a single M-file and does not rely on external `.mat` files or third-party dependencies, maintaining a clutter-free integration.

### 5. Analysis Methods
*   **Perceptual Interpolation**: The tool explicitly performs interpolation between color nodes within the **Lab colorspace** rather than RGB, which is a best practice for maintaining perceptual consistency during color transitions.

### 6. Figures/Outputs
*   **Visual Demos**: Running `brewermap('demo')` generates a figure displaying all available ColorBrewer schemes.
*   **Plotting Outputs**: The tool is compatible with standard MATLAB plotting functions (e.g., `surf`, `contour`, `imagesc`, `plot`) and allows for the customization of color sequences in multi-line plots or spatial maps.

### 7. Key Parameters
*   **`N`**: The desired number of color levels (colormap length).
*   **`scheme`**: A string representing the specific ColorBrewer scheme (e.g., `'Blues'`, `'RdYlGn'`, `'Paired'`).
*   **Reversal (`*`)**: Prepending an asterisk to the scheme name (e.g., `'*Blues'`) reverses the color sequence.
*   **Default Length**: If `N` is left empty, the function defaults to the length of the current MATLAB colormap.

---

## naturalSceneSimu/figure_paper/color/DrosteEffect-CubeHelix-e1900ef/LICENSE.TXT

This file is a standard legal document. Here is the structured summary based on your requirements:

### 1. Purpose
This file provides the legal text for the **Apache License, Version 2.0**. It serves to define the terms, conditions, and permissions for the use, reproduction, and distribution of the software or data contained within the associated directory.

### 2. Key Functions/Classes
*   **None**: As this is a legal text file (license agreement), it contains no executable code, functions, or classes.

### 3. Data Flow
*   **None**: The file is static documentation intended for human readability and legal compliance.

### 4. Dependencies
*   **None**: This file has no software dependencies.

### 5. Analysis Methods
*   **N/A**: This file contains legal stipulations, not scientific or statistical methodologies.

### 6. Figures/Outputs
*   **None**: The file generates no graphical or data outputs.

### 7. Key Parameters
*   **N/A**: There are no configurable parameters, as the content is a fixed legal template.

***

**Note for Research Context**: This license is commonly associated with open-source software and data repositories. Its presence in the `DrosteEffect-CubeHelix` directory indicates that any code or visualization tools within that specific folder are permitted to be used, modified, and distributed under the terms of the Apache 2.0 license, provided that the redistribution conditions (e.g., preserving copyright notices) are met.

---

## naturalSceneSimu/figure_paper/color/DrosteEffect-CubeHelix-e1900ef/README.md

This analysis covers the `README.md` file located in the `naturalSceneSimu/figure_paper/color/DrosteEffect-CubeHelix-e1900ef/` directory.

### 1. Purpose
This file provides documentation and usage examples for a MATLAB-based Cubehelix colormap generator. The tool allows researchers to create perceptually uniform, attractive colormaps that retain data interpretability when converted to grayscale for publication.

### 2. Key Functions/Classes
*   **`CUBEHELIX`**: Generates a colormap based on the Cubehelix algorithm, allowing for customization of hue, saturation, and intensity.
*   **`CUBEHELIX_VIEW`**: Launches an interactive GUI for real-time visualization and parameter tuning of Cubehelix colormaps.
*   **`CUBEHELIX_FIND`**: Reverses the process by analyzing an existing colormap to extract the parameters (`vec`, `irg`, `dmn`) that generated it.

### 3. Data Flow
*   **Input**: User-defined numerical parameters (hue, saturation, start/end intensity) or existing colormap arrays.
*   **Processing**: The tool maps these parameters onto a tapered helix in the RGB color cube.
*   **Output**: Returns standard MATLAB colormap matrices (N x 3) or generates interactive figure objects.

### 4. Dependencies
*   **External Standards**: Based on Dave Green’s Cubehelix specification (published in the *Bulletin of the Astronomical Society of India*).
*   **System**: Requires MATLAB.

### 5. Analysis Methods
*   **Perceptual Uniformity**: The algorithm ensures a continuous increase in perceived intensity (brightness) from black to white, satisfying the requirement that colorspace changes match the underlying data distribution.
*   **Grayscale Robustness**: Uses a monotonic intensity gradient to ensure that when color information is stripped (e.g., in print or black-and-white journals), the data's ordinal information is preserved.

### 6. Figures/Outputs
*   **Interactive Figures**: Provides a GUI environment to preview colorschemes.
*   **Visualizations**: Generates standard MATLAB figure outputs (e.g., `imagesc`, `surf`, `image`) using the custom colormap.

### 7. Key Parameters
*   **Start/End Intensity**: Defines the brightness range of the map.
*   **Saturation (`sat`)**: Controls the vividness of the colors (note: explicitly renamed from "hue" in the original specification).
*   **Rotation**: Determines the number of rotations through the color spectrum.
*   **Domain**: Defines the subset of the intensity range used for the colormap.

---

## naturalSceneSimu/figure_paper/color/license.txt

This file is a standard legal document defining the usage rights for the software repository. Below is the structured summary:

1. **Purpose**:
   This file contains the **Simplified BSD License** (also known as the BSD 2-Clause License). It serves as the legal governing document that specifies the permissions, conditions, and disclaimers for using, modifying, and distributing the code within the `naturalSceneSimu` repository.

2. **Key Functions/Classes**:
   None. This is a text-based legal notice and does not contain executable code.

3. **Data Flow**:
   None.

4. **Dependencies**:
   None.

5. **Analysis Methods**:
   None.

6. **Figures/Outputs**:
   None.

7. **Key Parameters**:
   None.

***

**Expert Note**: This file indicates that the code authored by Jonathan C. Lansey (2015) is open-source. The BSD 2-Clause License is a permissive license that allows for broad reuse, provided that the original copyright notice and the disclaimer of warranty are retained in both source and binary redistributions.

---

## naturalSceneSimu/figure_paper/license.txt

Here is the structured analysis of the provided file:

1. **Purpose**:
   This file serves as a legal document specifying the terms and conditions for the distribution, modification, and use of the software contained within the `naturalSceneSimu` repository. It establishes the copyright ownership and grants permissive usage rights under a standard BSD-style license.

2. **Key Functions/Classes**:
   * **N/A**: This is a text-based legal document and does not contain executable code, functions, or classes.

3. **Data Flow**:
   * **N/A**: The file does not process, read, or write any data.

4. **Dependencies**:
   * **N/A**: This file has no software dependencies.

5. **Analysis Methods**:
   * **N/A**: This file contains no scientific or statistical methods.

6. **Figures/Outputs**:
   * **N/A**: This file generates no figures or computational outputs.

7. **Key Parameters**:
   * **N/A**: There are no configurable parameters in this file.

---

## naturalSceneSimu/figure_paper/plot2svg_20120915/readme.txt

This file is a `readme.txt` documentation for `plot2svg`, a utility designed for the Matlab/Octave environment to export high-quality, scalable vector graphics.

### 1. Purpose
`plot2svg` converts 2D and 3D Matlab/Octave figures into the W3C-compliant Scalable Vector Graphics (SVG) format. It provides a means to generate resolution-independent scientific plots suitable for web integration and vector-based editing software like Inkscape.

### 2. Key Functions/Classes
*   **`plot2svg`**: The primary entry point function. It handles the serialization of Matlab figure objects into SVG elements.
    *   `plot2svg()`: Opens a file dialog to process the currently active figure.
    *   `plot2svg('filename.svg', handle, type)`: Programmatically exports a specific figure handle to a file.

### 3. Data Flow
*   **Input**: Takes an active Matlab/Octave figure handle or the current figure.
*   **Processing**: Iterates through figure properties (axes, lines, patches, markers, text, labels, legends, etc.) and translates them into SVG XML tags. It handles coordinate transformations, depth sorting for 3D projections, and interprets LaTeX-style strings.
*   **Output**: Writes a `.svg` file containing the vector representation of the plot. Linked pixel-based images (e.g., raster components) are exported separately as PNG or JPG files.

### 4. Dependencies
*   **Environment**: Requires Matlab or Octave.
*   **External Viewers/Editors**: While not code dependencies, it relies on SVG-compliant software for rendering, such as Firefox, Chrome, Opera, or Inkscape.

### 5. Analysis Methods
*   **Vectorization**: Translates mathematical plot primitives into vector paths (`line`, `patch`, `contour`).
*   **Emulated Rendering**: Since SVG does not natively support some Matlab-specific rendering (e.g., linear interpolation of colors between three patch points), the code uses combinations of patches with alpha gradients to emulate this visual output.
*   **Depth Sorting**: Implements algorithmic sorting of 3D objects projected onto 2D planes to maintain correct visual layering.
*   **Bounding Box Calculation**: Logic for calculating the spatial extent of elements for correct SVG `viewBox` settings and filter effects.

### 6. Figures/Outputs
*   **Primary Output**: An `.svg` file that preserves the scaling and interactivity (via grouping) of the original plot.
*   **Supplementary Output**: Raster files (PNG/JPG) for complex components that cannot be easily vectorized (e.g., controls or specific image data).

### 7. Key Parameters
*   **`pixelfiletype`**: Defines the format for raster components (default is `'png'`, option for `'jpg'`).
*   **`figure handle`**: Specifies which particular figure window to export.
*   **LaTeX interpretation**: Supports specific formatting tags within labels (e.g., `{\it}`, `{\bf}`, `^{}`, `_{}`) and symbols (`\alpha`, `\beta`, etc.).
*   **`InvertHardcopy`**: A figure property (controlled via `set(gcf,...)`) that can be toggled to preserve the original figure background in the output.

---

## naturalSceneSimu/hosvd_tensorlab/license_tensorlab.txt

This file acts as a legal documentation container that bundles the software license agreements for the **Tensorlab** toolbox and its integrated third-party components (**MINPACK** and **GenRTR**).

### 1. Purpose
This file outlines the legal terms, usage restrictions, and warranty disclaimers for using the Tensorlab MATLAB toolbox and its bundled dependencies in an academic research context. It serves to inform users of their responsibilities regarding academic-only use, citation requirements, and the "as-is" nature of the software.

### 2. Key Functions/Classes
*N/A* (This is a legal document, not source code).

### 3. Data Flow
*N/A* (The file does not process data; it governs the usage of software that processes data).

### 4. Dependencies
The file describes the dependencies included within the Tensorlab distribution:
*   **Tensorlab:** The primary software (owned by KU Leuven).
*   **MINPACK:** Optimization library (University of Chicago/Argonne National Laboratory).
*   **GenRTR:** Trust-region method software (Baker, Absil, Gallivan).

### 5. Analysis Methods
While the file is a legal document, it specifies the domain of the software it governs:
*   **Tensor Decompositions:** The software is for tensor-based analysis (e.g., HOSVD).
*   **Optimization:** The software utilizes MINPACK and GenRTR, indicating reliance on numerical optimization algorithms and trust-region methods for solving mathematical problems.

### 6. Figures/Outputs
*N/A* (The file specifies that academic users must cite the provided reference in any manuscript describing data obtained using the software).

### 7. Key Parameters
The file defines several critical administrative constraints:
*   **Academic User Definition:** Limited to non-commercial research use by academic, non-profit, or government institutions.
*   **Expiration Date:** The primary license agreement explicitly states a term ending on **August 1, 2015**.
*   **Citation Requirement:** Mandates that users must acknowledge KU Leuven and cite the specific Tensorlab publication in any research outputs.
*   **No Warranty/Support:** All components are provided "as is" with no guarantee of support, error-free operation, or fitness for specific purposes.

---

## naturalSceneSimu/hpcSetup.txt

This file is a configuration script for a MATLAB-based simulation environment, likely designed to ensure the software paths are correctly set up on a High-Performance Computing (HPC) cluster.

### 1. Purpose
The file serves as a setup script to configure the MATLAB search path for a project, ensuring all subdirectories within the `code` folder are accessible regardless of the current working directory. It also toggles specific environment modes for HPC vs. local workstation execution.

### 2. Key Functions/Classes
*   **`cd ..`**: Navigates one level up from the current directory (presumably to the root project folder).
*   **`genpath('code')`**: Recursively generates a string of all subfolders within the `code` directory.
*   **`addpath(...)`**: Adds the generated path string to the MATLAB search path, making functions within the repository available for use.

### 3. Data Flow
*   **Reads**: None directly.
*   **Writes**: Modifies the current MATLAB session's internal path settings.
*   **Processes**: It processes the file structure of the repository to ensure sub-modules are discoverable by the MATLAB interpreter.

### 4. Dependencies
*   **MATLAB Native Functions**: Relies on `cd`, `addpath`, and `genpath`.
*   **Repository Structure**: Assumes a specific directory layout where a `code` folder exists containing the project source files.

### 5. Analysis Methods
*   **N/A**: This script is an environment configuration tool and does not contain scientific or statistical algorithms.

### 6. Figures/Outputs
*   **None**: The script performs background system configurations and generates no visual or data file outputs.

### 7. Key Parameters
*   **`hpcMode`**: A boolean flag set to `1`, indicating the environment is configured for HPC execution (typically used to disable GUI elements or parallelize processes).
*   **`PCMode`**: A boolean flag set to `0`, indicating the environment is NOT configured for a local/personal computer (likely used to suppress plotting or heavy local computation).

---

## naturalSceneSimu/kde2d/license.txt

This file contains the licensing documentation for the `kde2d` (Kernel Density Estimation in 2D) module within the `naturalSceneSimu` repository.

### 1. Purpose
This file provides the legal terms and conditions (BSD 3-Clause License) under which the `kde2d` source code may be used, modified, and redistributed. It establishes the legal framework for the intellectual property held by Dr. Zdravko Botev.

### 2. Key Functions/Classes
*   **None**: This is a text-based legal document and contains no executable code, functions, or classes.

### 3. Data Flow
*   **None**: The file is a static document and does not process, read, or write any simulation or research data.

### 4. Dependencies
*   **None**: This file is independent and acts as a governing document for the directory it resides in.

### 5. Analysis Methods
*   **None**: As a license file, it does not implement any scientific or statistical methodologies.

### 6. Figures/Outputs
*   **None**: This file does not produce any graphical or numerical outputs.

### 7. Key Parameters
*   **None**: There are no configurable parameters within this file.

---

## naturalSceneSimu/kernelExtractionAndSelection/kernelExtraction_OmerGPU/Release1.1/readme.txt

This file serves as the installation and configuration guide for a GPU-accelerated kernel extraction tool within the `naturalSceneSimu` research repository.

### 1. Purpose
This file provides instructions for setting up the MATLAB environment to interface with GPU-based OpenCL kernels used for natural scene stimulus filtering. It ensures that the required scripts and computational files are correctly registered in the MATLAB path.

### 2. Key Functions/Classes
*   **`getClFilePath.m`**: A utility function (referenced in the readme) that likely resolves the system paths for OpenCL kernel files; it serves as the anchor point for the file directory structure.

### 3. Data Flow
*   **Read**: Reads `.cl` (OpenCL) kernel files (`extract.cl`, `mean.cl`) to perform GPU-accelerated computations.
*   **Process**: The system processes raw visual/natural scene data using GPU kernels to extract filters or kernels.
*   **Write**: While not explicitly stated in the readme, the extraction process typically outputs computed filter matrices or kernel weights to the MATLAB workspace or disk.

### 4. Dependencies
*   **Environment**: MATLAB.
*   **External**: OpenCL drivers (implied by the use of `.cl` files).
*   **Repository Dependencies**: `extract.cl`, `mean.cl`, and `getClFilePath.m` must reside in the same directory to maintain file path integrity.
*   **External Repository**: [ClarkLabCode/GPUFilterExtraction](https://github.com/ClarkLabCode/GPUFilterExtraction) (Source of the underlying GPU implementation).

### 5. Analysis Methods
*   **GPU Acceleration (OpenCL)**: The implementation shifts computationally intensive kernel extraction tasks from the CPU to the GPU.
*   **Statistical/Scientific Approach**: Based on the project naming convention, this likely involves the extraction of receptive field kernels from natural scene statistics, a common technique in computational neuroscience.

### 6. Figures/Outputs
*   The readme does not mention specific figures; however, the primary output of the associated package is typically processed filter kernels or extracted stimulus features.

### 7. Key Parameters
*   **Installation Path**: The specific directory path stored in the MATLAB environment variable (`path`).
*   **Kernel Files**: `extract.cl` (likely for filtering/extraction logic) and `mean.cl` (likely for pre-processing or normalization via mean subtraction/calculation).

---

## naturalSceneSimu/kerns/license.txt

This document is a legal license file for the `naturalSceneSimu/kerns/` directory. Based on its content, here is the structured summary:

### 1. Purpose
This file declares the licensing terms and copyright information for the "Kernel Smoothing Library for Matlab." It establishes that the included toolboxes are open-source software governed by the GNU General Public License (GPL) version 3 or later.

### 2. Key Functions/Classes
The library is composed of four distinct sub-toolboxes, each containing its own collection of functions (though the functions themselves are not listed in this file):
*   **Kernel Regression Toolbox**: Tools for non-parametric regression analysis.
*   **Kernel Density Toolbox**: Tools for univariate density estimation.
*   **Kernel Quality Toolbox**: Tools for assessing the performance or quality of kernel estimates.
*   **Kernel Bivariate Density Toolbox**: Tools for two-dimensional kernel density estimation.

### 3. Data Flow
*   **Input**: Not applicable (this is a text document).
*   **Processing**: N/A.
*   **Output**: N/A.

### 4. Dependencies
*   **Language/Environment**: MATLAB.
*   **External Licenses**: The code is distributed under the [GNU General Public License (GPL)](http://www.gnu.org/).

### 5. Analysis Methods
The library implements non-parametric statistical methods, specifically:
*   **Kernel Smoothing/Regression**: Estimating relationships between variables without assuming a specific functional form.
*   **Kernel Density Estimation (KDE)**: Estimating the probability density function of a random variable (both univariate and bivariate).

### 6. Figures/Outputs
*   While not explicitly defined in the license text, typical outputs for these toolboxes include **statistical estimates**, **density plots**, and **regression curves** visualized within the MATLAB environment.

### 7. Key Parameters
*   The license does not define parameters, but the library itself likely requires standard kernel smoothing parameters, such as the **bandwidth (h)** and the **choice of kernel function** (e.g., Gaussian, Epanechnikov, etc.) to function correctly.

---

## naturalSceneSimu/kmbox-master/LICENSE.txt

This file is a standard software license agreement. Below is the structured analysis based on your requirements:

### 1. Purpose
This file provides the legal terms and conditions under which the `kmbox` software repository is distributed. It serves as a permissive free software license (BSD 3-Clause) that governs the usage, modification, and redistribution of the source code.

### 2. Key Functions/Classes
*   **Not Applicable**: This is a legal document, not an executable script. It contains no programmatic functions or classes.

### 3. Data Flow
*   **Not Applicable**: The file does not perform any data processing, reading, or writing operations.

### 4. Dependencies
*   **Not Applicable**: This file has no software dependencies.

### 5. Analysis Methods
*   **Not Applicable**: This file does not implement any scientific or statistical algorithms.

### 6. Figures/Outputs
*   **Not Applicable**: This file does not generate any figures, plots, or data outputs.

### 7. Key Parameters
*   **Not Applicable**: There are no configurable parameters in this file. 

***

**Summary Note:** The document specifies that the software is provided "as is" without warranty and includes provisions protecting the copyright holder (Steven Van Vaerenbergh) and the "Universidad de Cantabria" from liability and unauthorized endorsement.

---

## naturalSceneSimu/kmbox-master/README.md

### Analysis Summary: `README.md` (Kernel Methods Toolbox)

#### 1. Purpose
The `README.md` serves as the primary documentation for the **Kernel Methods Toolbox (KMBOX)**, a collection of MATLAB algorithms focused on nonlinear signal processing and machine learning. Its goal is to provide pedagogical, readable implementations of various kernel-based algorithms for research and algorithm analysis.

#### 2. Key Functions/Classes
All core functions are prefixed with `km_` to prevent namespace collisions. Notable implementations include:
*   **Regression:** Kernel Ridge Regression (KRR), Kernel Recursive Least-Squares (KRLS) variants (ALD, SW, FB).
*   **Dimension Reduction:** Kernel Principal Component Analysis (KPCA), Kernel Canonical Correlation Analysis (KCCA).
*   **Online Learning:** Naive Online Regularized Risk Minimization Algorithm (NORMA), Quantized Kernel Least Mean Squares (QKLMS).
*   **Signal/System Modeling:** Kernel-based Identification of Hammerstein systems (KIHAM), Kernel Recursive Least-Squares Tracker (KRLS-T).
*   **Utilities:** Incomplete Cholesky Decomposition (ICD), Kernel Density Estimation (KDE).

#### 3. Data Flow
*   **Input Format:** Adheres to a strict convention where data matrices are formatted with **one data point per row**.
*   **Execution:** Users run `install.m` to add the directory to the MATLAB path; scripts in the `demo/` folder (`km_demo_*`) serve as entry points for testing and demonstration without manual parameter configuration.

#### 4. Dependencies
*   **Environment:** Requires MATLAB.
*   **Extensibility:** Encourages the inclusion of external contributions via template files provided in the repository.

#### 5. Analysis Methods
The toolbox implements several advanced statistical and machine learning methodologies, including:
*   **Nonlinear kernel methods** for regression and classification.
*   **Recursive algorithms** for online/adaptive signal processing.
*   **Dimension reduction and feature extraction** (PCA, CCA).
*   **Blind identification and system modeling** for non-linear systems.

#### 6. Figures/Outputs
*   **Demos:** The repository provides `km_demo` scripts that generate internal demonstrations of the algorithms.
*   **Documentation:** Function-specific usage instructions are embedded directly within the source code files.

#### 7. Key Parameters
*   **Function Naming:** All functions use the `km_` prefix.
*   **Data Structure:** The primary constraint is the row-based data input format.
*   **Modularity:** Algorithms are structured for readability and ease of modification, prioritizing clarity over high-performance optimization (speed/memory).

---

## naturalSceneSimu/nhist_BrunoLuong/license.txt

This file is a standard legal document governing the usage and distribution of the associated code. Below is the structured analysis:

1. **Purpose**: 
   This file contains the **Simplified BSD License** (specifically the 2-Clause BSD License) which dictates the legal terms for using, modifying, and redistributing the software authored by Bruno Luong. It provides a legal framework ensuring the original author retains copyright while allowing open-source usage.

2. **Key Functions/Classes**: 
   N/A (This is a legal document, not source code).

3. **Data Flow**: 
   N/A.

4. **Dependencies**: 
   N/A.

5. **Analysis Methods**: 
   N/A.

6. **Figures/Outputs**: 
   N/A.

7. **Key Parameters**: 
   N/A.

***

**Summary Note:** 
This file acts as a metadata artifact within the repository. It confirms that the `nhist_BrunoLuong` module (likely a histogram or density estimation tool) is distributed under an open-source license that permits free use in research, provided the original copyright notice and disclaimer are preserved.

---

## replicate_paper_figures/TODO.txt

This file acts as a **developer task tracker and project roadmap** for reproducing figures used in a scientific paper.

### 1. Purpose
The file serves as a TODO list to guide the completion of data processing scripts and the finalization of visualizations for a scientific publication. It tracks progress on specific figure generation pipelines and data reconciliation.

### 2. Key Functions/Classes
*None (The file is a plain-text log, not executable code).*

### 3. Data Flow
*   **Reads**: HRC (High-Resolution Contrast) data and Contrast Map data.
*   **Processes**: Likely involves iterating over dynamic contrast computation parameters (associated with the date `2018_05_11`).
*   **Writes**: Implicitly generates figure assets once the tasks are completed.

### 4. Dependencies
*   **Internal**: Depends on internal data-set management scripts and directory structures (referenced in item 2).
*   **External**: None explicitly mentioned, though "HRC data" implies dependency on hardware or specific instrument data formats.

### 5. Analysis Methods
*   **Dynamic Contrast Computation**: The notes mention a "sweep" (parameter sweep) to compute contrast metrics, likely involving iterative data processing to optimize or visualize contrast sensitivity.

### 6. Figures/Outputs
*   **Figure 1**: Target output involving Contrast Map and HRC data.
*   **Supplementary Figure 5**: Target output involving a "MED Demo" (likely an algorithm, experimental setup, or Medtronic-related data).

### 7. Key Parameters
*   **Directory paths**: Explicitly identified as a primary configuration hurdle for the HRC data generation.
*   **Data set linking**: A critical operational step to ensure figures correctly map to their source input files.
*   **Computation sweep parameters**: Implied to be associated with the `2018_05_11` experimental run.

---

