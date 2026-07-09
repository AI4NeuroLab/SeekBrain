# Repository Context for _To_test_whether_flies_with_more_accurate_head-direction_enc

Based on the analysis of the provided research question and the repository content, here is the identification of relevant files and strategies for execution.

### 1. Relevant Files (RANKED by relevance)

*   **Priority: HIGH**
    *   `naturalSceneSimu/ITE_package_cmu/README.md` and `naturalSceneSimu/ITE_package_cmu/code/shared/embedded/ITL/readme.txt`: Essential for understanding the underlying kernel-based density estimation tools and association measures needed to compute circular variance.
    *   **Custom Script Requirement:** The repository contains general ITE tools but lacks a specific script for the *Drosophila* EPG bump analysis. You will need to create a wrapper script (e.g., `analyze_HD_bump_correlation.m`) using the ITE package's kernel density and estimation modules.
*   **Priority: MEDIUM**
    *   `naturalSceneSimu/ITE_package_cmu/compileDir_simple.m`: **Critical.** This must be run before any analysis to ensure the C++ MEX wrappers (likely needed for fast kernel computations of circular variance and density estimation) are functional.
    *   `naturalSceneSimu/ITE_package_cmu/code/shared/embedded/ITL/`: This directory contains the necessary information-theoretic kernels for computing the concentration/variance of the bump phase.
*   **Priority: LOW**
    *   `naturalSceneSimu/ITE_package_cmu/quick_test_*.m`: These can be used as templates for writing your own validation tests to ensure your implementation of "circular variance" is mathematically correct within the ITE framework.

### 2. Code Execution Order
1.  **Compilation:** Run `compileDir_simple.m` to build the required MEX files.
2.  **Preprocessing:** Filter raw neural data using a movement threshold (e.g., $|\omega| > 20^\circ/s$). Apply this to the `EPG_bump_activity` and `head_direction` arrays.
3.  **Variable Calculation:**
    *   For each fly, calculate `HD_Accuracy = 1 - circ_var(offset)`.
    *   Fit a Von Mises distribution to the EPG bump activity to extract the concentration parameter ($\kappa$) or width.
4.  **Correlation Analysis:** Use the computed per-fly scalars to calculate the Pearson correlation.
5.  **Visualization:** Generate the scatter plot with a linear fit line (using `polyfit` or `fitlm`) and annotate the Pearson $P$-value.

### 3. Key Code Patterns
*   **Circular Statistics:** You must utilize circular mean and variance formulas:
    *   `offset = angle(exp(i*(bump_phase - head_direction)))`
    *   `circ_var = 1 - abs(mean(exp(i*offset)))`
*   **Vectorization:** Since the ITE package emphasizes performance, ensure the calculation of bump widths across frames is vectorized rather than using `for` loops.
*   **MEX Interface:** The repository uses `ann_wrapperM` for spatial searches; if you implement a $k$-Nearest Neighbor approach to bump width (rather than Von Mises fitting), leverage these pre-compiled spatial search tools.

### 4. Data Files Referenced
*   **Metadata:** You will need to define a local data structure for the 15 flies, pointing to the neural imaging traces (G-CaMP) and behavioral logs for "dim-cue" blocks.
*   **Input Matrices:** The code expects matrix-formatted inputs (rows = time points, columns = neural/behavioral features).

### 5. Missing Pieces
*   **Domain-Specific Logic:** The repository is for Information-Theoretic Estimators; it **does not** contain the *Drosophila*-specific logic (e.g., Von Mises fitting to the PB population activity). You must implement the Von Mises fit logic yourself or import a neurobiology-specific library for the EPG compass.
*   **Movement Filtering Logic:** There is no specific script for velocity thresholding in the provided repository. You must derive this from the behavior logs (angular velocity tracking) prior to passing the cleaned data to the ITL package.
*   **Dataset:** The repository contains remote sensing data (MISR/MODIS). You must ensure your *Drosophila* data is formatted as per the structure expected by the ITL package (a standard matrix of samples).