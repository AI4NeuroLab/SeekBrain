# Repository File Summaries

## .github/workflows/uploadpypy.yml

### Code Analysis: `.github/workflows/uploadpypy.yml`

This file is a GitHub Actions workflow configuration used for automated continuous deployment (CD) of the repository's Python package to the Python Package Index (PyPI).

---

#### 1. Purpose
This workflow automates the process of building a Python package (source distribution and wheel) and uploading it to PyPI whenever a new GitHub release is created. It ensures that published scientific code is consistently packaged and distributed.

#### 2. Key Functions/Classes
*   **`deploy` job**: Orchestrates the environment setup, package building, and deployment process.
*   **`setuptools` / `setup.py`**: Handles the metadata and build configuration for the package distribution.
*   **`twine`**: A utility used to securely upload the built package archives to the PyPI registry.

#### 3. Data Flow
*   **Reads**: Reads source code from the `python/` directory of the repository and credentials from GitHub Secrets (`PYPI_USERNAME`, `PYPI_PASSWORD`).
*   **Processes**: Executes `setup.py` to compile source distributions (`sdist`) and wheels (`bdist_wheel`).
*   **Writes**: Uploads the generated `.tar.gz` and `.whl` files from the `dist/` directory to the PyPI index.

#### 4. Dependencies
*   **Actions**: `actions/checkout@v2` (repo cloning), `actions/setup-python@v2` (Python environment setup).
*   **Python Packages**: `setuptools`, `wheel`, `twine`.
*   **External Service**: PyPI (Python Package Index).

#### 5. Analysis Methods
*   **N/A**: This file is a CI/CD infrastructure configuration; it does not contain scientific or statistical algorithms.

#### 6. Figures/Outputs
*   **Outputs**: Generates binary distribution files (`.whl`) and source archives (`.tar.gz`), which are uploaded to PyPI. 
*   **Logs**: Produces deployment logs visible in the GitHub Actions tab indicating success or failure of the upload process.

#### 7. Key Parameters
*   **`on: release: types: [created]`**: Triggers the workflow specifically upon the creation of a GitHub release tag.
*   **`working-directory: python`**: Specifies that the package build process is scoped to a sub-folder named `python`.
*   **`python-version: '3.x'`**: Configures the environment to use the latest stable version of Python 3.

---

## .travis.yml

This file is a configuration file for **Travis CI**, a continuous integration service used to automate the testing and deployment of the `dPCA` (demixed Principal Component Analysis) Python package.

### 1. Purpose
This file automates the testing of the `dPCA` codebase across multiple Python versions (2.7 and 3.4) and manages the automated deployment of the package to PyPI whenever code is pushed to the repository.

### 2. Key Functions/Classes
*   **None**: As a YAML configuration file, it contains infrastructure instructions rather than code logic, classes, or functions.

### 3. Data Flow
*   **Input**: The repository source code (specifically looking in the `./python` subdirectory).
*   **Output**:
    *   **Build Logs**: Travis CI generates build status reports.
    *   **PyPI Deployment**: Upon successful build/test, the package is uploaded to the Python Package Index (PyPI) under the account `wielandbrendel`.

### 4. Dependencies
*   **Runtime/Build Dependencies**: `pip`, `numpy`, and `cython`.
*   **Environment**: Requires the `dPCA` repository structure (`machenslab/dPCA`) and a secure PyPI authentication token.

### 5. Analysis Methods
*   **None**: While the repository itself implements dPCA (demixed Principal Component Analysis), this specific file does not contain analytical logic. It simply triggers the environment setup and deployment pipeline.

### 6. Figures/Outputs
*   **Deployment**: Produces an updated version of the `dPCA` package on the public PyPI repository.
*   **Standard Output**: The `script: echo foo` command suggests a placeholder for automated unit tests that would normally be executed here to verify the scientific accuracy of the package.

### 7. Key Parameters
*   **`python`**: Defines the target environments (`2.7`, `3.4`).
*   **`deploy.provider`**: Set to `pypi`, defining the destination for the build.
*   **`deploy.user`**: `wielandbrendel` (the maintainer).
*   **`deploy.password`**: An encrypted token used for secure authentication with PyPI.
*   **`on.repo`**: Restricts deployment to the official `machenslab/dPCA` repository to prevent unauthorized package distribution.

---

## License.md

### Analysis Report: `License.md`

1. **Purpose**:
   This file serves as the legal documentation defining the open-source licensing terms for the software repository. It establishes the permissions, restrictions, and liability disclaimers under which the research code is made available to the public.

2. **Key Functions/Classes**:
   * **N/A**: This is a text-based legal document, not a functional code module. No programmatic classes or functions are defined.

3. **Data Flow**:
   * **N/A**: Does not process, read, or write computational data.

4. **Dependencies**:
   * **N/A**: Standalone text file; has no software dependencies.

5. **Analysis Methods**:
   * **N/A**: Contains no scientific or statistical methodologies.

6. **Figures/Outputs**:
   * **N/A**: Does not generate visual outputs or data artifacts.

7. **Key Parameters**:
   * **Copyright Holder**: Machens Lab (2016).
   * **License Type**: MIT License (a permissive free software license).

---

## README.md

This `README.md` file serves as the primary documentation for the **dPCA (demixed Principal Component Analysis)** repository, an implementation of a linear dimensionality reduction technique for analyzing neural population activity.

### 1. Purpose
This repository provides Python and MATLAB implementations of dPCA, a technique that decomposes neural population activity into components reflecting specific task parameters (e.g., stimuli, decisions, time). It allows researchers to visualize how populations of neurons respond to different experimental variables independently.

### 2. Key Functions/Classes
*   **`dPCA` (Class)**: The core Python class that follows a scikit-learn-style API.
*   **`fit_transform(X)`**: The primary method that processes input data and calculates the demixed latent components ($Z$).
*   **`dpca_demo.ipynb` / `dpca_demo.m`**: Example scripts that generate surrogate data and demonstrate the analysis pipeline.

### 3. Data Flow
*   **Input**: Takes a multidimensional array ($X$) representing trial-averaged neural data, where dimensions correspond to neurons, time, and experimental task parameters (e.g., stimulus, decision).
*   **Processing**: The data is processed through marginalization of task parameters to isolate individual components.
*   **Output**: Produces latent components ($Z$) that highlight dynamic tuning to the provided task parameters.

### 4. Dependencies
*   **Python**: `numpy`, `cython`, `scipy`, `sklearn`, `itertools`, and `numexpr`.
*   **MATLAB**: Requires standard MATLAB environment.

### 5. Analysis Methods
*   **demixed Principal Component Analysis (dPCA)**: A dimensionality reduction method that disentangles the effects of different experimental variables, which are often mixed in standard PCA.

### 6. Figures/Outputs
*   The software outputs latent component representations ($Z$).
*   The included demo scripts generate plots showing the comparison between standard PCA and dPCA results on synthetic neural data.

### 7. Key Parameters
*   **`X`**: Multidimensional array of trial-averaged data (neurons must be the first dimension).
*   **`labels`**: A string (e.g., `'tsd'`) defining the parameter axes (Time, Stimulus, Decision) for marginalization.
*   **`n_components`**: Either an integer (setting a uniform number of components per marginalization) or a dictionary (setting specific counts for individual marginalizations).
*   **`regularizer`**: Used during initialization to control the stability/smoothness of the decomposition.

---

## python/dPCA/dPCA.py

This file contains the core implementation of **Demixed Principal Component Analysis (dPCA)**, a dimensionality reduction technique designed to decompose complex neural population activity into components associated with specific task parameters (e.g., stimuli, decisions, time).

### 1. Purpose
The `dPCA` class provides a scikit-learn-compatible estimator that marginalizes high-dimensional data along task-relevant axes, allowing researchers to isolate and interpret individual task components within population neural activity while preserving as much variance as possible.

### 2. Key Functions/Classes
*   **`dPCA` (Class)**: The primary estimator; inherits from `sklearn.base.BaseEstimator`.
*   **`fit()` / `fit_transform()`**: Main entry points to train the model on multi-dimensional data and generate latent components.
*   **`_marginalize()`**: Computes the decomposition of the data into components (e.g., 't', 's', 'ts') by subtracting marginal means to isolate specific task parameter interactions.
*   **`_optimize_regularization()`**: Iteratively searches for an optimal regularization parameter (lambda) if set to 'auto'.
*   **`crossval_score()`**: Performs cross-validation to assess reconstruction performance and determine the optimal regularizer.
*   **`_get_parameter_combinations()`**: Generates the structural breakdown of the data based on provided labels (e.g., separating factors for stimulus, time, etc.).

### 3. Data Flow
*   **Input**: Multidimensional arrays (e.g., `[n_samples, n_features_1, n_features_2, ...]`) representing population activity.
*   **Processing**: Data is centered, marginalized via axis-averaging, and regularized using Singular Value Decomposition (SVD).
*   **Output**: A dictionary of latent components mapped to each marginalization key, and explained variance ratios for each component.

### 4. Dependencies
*   **NumPy**: Array manipulation and numerical operations.
*   **SciPy**: Linear algebra utilities (`svds`, `pinv`).
*   **Scikit-Learn**: Base classes and randomized SVD implementations.
*   **NumExpr**: High-performance numerical evaluation for marginalization steps.
*   **Internal**: `utils.py` (shuffle, classification, and denoise functions).

### 5. Analysis Methods
*   **Marginalization**: Statistical decomposition of variance by partitioning data based on experimental conditions.
*   **Dimensionality Reduction**: Utilizes SVD/Randomized SVD to extract components that capture the highest variance for specific task features.
*   **Regularization**: Ridge-style regularization implemented to improve model robustness, with automated tuning via cross-validation.

### 6. Figures/Outputs
*   The code itself does not generate plots; it returns structured dictionary objects containing the transformed latent representations and the `explained_variance_ratio_` for each decomposed parameter.

### 7. Key Parameters
*   **`labels`**: Defines the experimental design (e.g., "ts" for time and stimulus).
*   **`join`**: A dictionary to group parameter marginalizations (e.g., combining stimulus-related components).
*   **`regularizer`**: Scalar weight or 'auto' to control the penalty on the SVD decomposition.
*   **`n_components`**: Specifies the number of latent dimensions to extract per marginalization.

---

## python/dPCA/utils.py

### Analysis of `python/dPCA/utils.py`

This file is a utility module for the `dPCA` (demixed Principal Component Analysis) repository. It provides high-performance, JIT-compiled helper functions to support data preprocessing, statistical validation, and signal denoising.

---

#### 1. Purpose
The file provides optimized numerical utility functions designed to perform efficient data shuffling, classification accuracy assessment, and temporal signal masking for neuroscientific or multivariate datasets.

#### 2. Key Functions/Classes
*   **`shuffle2D(X)`**: Performs an in-place Fisher-Yates shuffle on the rows of a 2D array, specifically skipping `NaN` values.
*   **`classification(class_means, test)`**: Calculates the classification accuracy by assigning test points to the nearest class mean across multiple time points.
*   **`denoise_mask(mask, n_consecutive)`**: A temporal filter that removes "noise" segments in a binary mask by zeroing out any continuous sequence of ones that is shorter than a specified length.

#### 3. Data Flow
*   **Input**: Takes NumPy arrays (typically representing experimental trials, class averages, or time-series masks).
*   **Processing**: Uses `numba` to accelerate loops that would otherwise be computationally expensive in pure Python.
*   **Output**: Modifies arrays in-place (`shuffle2D`, `denoise_mask`) or returns statistical performance vectors (`classification`).

#### 4. Dependencies
*   **`numpy`**: Core library for array manipulation.
*   **`numba`**: Used for Just-In-Time (JIT) compilation to convert Python functions into optimized machine code for performance-critical loops.

#### 5. Analysis Methods
*   **Fisher-Yates Shuffling**: Used for randomized permutation of data while handling missing values (`NaN`).
*   **Nearest-Centroid Classification**: A basic supervised learning method used to determine how well data points can be grouped based on the proximity to known class means.
*   **Signal Processing/Thresholding**: The `denoise_mask` function acts as a binary morphological filter (similar to an opening operation) to remove isolated noise spikes from time-series data.

#### 6. Figures/Outputs
*   No visual figures or plots are generated by this file. It outputs raw statistical data (e.g., performance rates) and modified data structures intended for use by other modules in the `dPCA` pipeline.

#### 7. Key Parameters
*   **`n_consecutive`** (in `denoise_mask`): The threshold length; segments shorter than this value are discarded.
*   **`class_means` / `test`** (in `classification`): Expects dimensions $Q \times T$ (number of classes $\times$ time points), defining the structure of the data expected by the classifier.

---

## python/dPCA_demo.ipynb

This notebook provides a demonstration of the **Demixed Principal Component Analysis (dPCA)** method, a dimensionality reduction technique used to decompose neural population activity into components specific to different experimental parameters (e.g., time, stimulus).

### 1. Purpose
The notebook serves as a tutorial on how to use the `dPCA` library to analyze neural data. It demonstrates data generation, model fitting with automatic regularization, and statistical significance testing of demixed components.

### 2. Key Functions/Classes
*   **`dPCA.dPCA`**: The primary class used to instantiate the model and define the decomposition structure (e.g., labels like 'st').
*   **`dpca.fit_transform`**: Executes the core dPCA algorithm, mapping the high-dimensional neural data into demixed latent components.
*   **`dpca.significance_analysis`**: Implements a permutation-based approach to determine if the extracted components are statistically significant.

### 3. Data Flow
*   **Input**: Generates synthetic trial-averaged (`R`) and trial-by-trial (`trialR`) neural population data (N neurons, T time-points, S stimuli).
*   **Processing**:
    *   Centers the data.
    *   Fits the `dPCA` model to the synthetic data.
    *   Computes significance masks via shuffling procedures.
*   **Output**: Produces visualization plots showing the demixed latent factors and their corresponding significance intervals.

### 4. Dependencies
*   **NumPy**: Used for numerical operations, array manipulation, and random data generation.
*   **Matplotlib (pylab)**: Used for plotting and data visualization.
*   **`dPCA`**: The core package from the repository containing the implementation of the demixed PCA algorithm.

### 5. Analysis Methods
*   **Demixed PCA (dPCA)**: A supervised dimensionality reduction technique that isolates variance linked to specific task parameters.
*   **Automatic Regularization**: The model optimizes the regularization parameter during fitting to prevent overfitting.
*   **Significance Analysis**: A permutation test (shuffling) is used to validate the reliability of the extracted components.

### 6. Figures/Outputs
*   **Component Visualization**: A set of three plots (Time, Stimulus, and Mixing components) comparing the latent dynamics across different stimulus conditions.
*   **Significance Masks**: Black bars displayed beneath the component plots indicating time points where the captured signal is statistically significant.

### 7. Key Parameters
*   **`labels='st'`**: Defines the axes of decomposition (Stimulus and Time).
*   **`regularizer='auto'`**: Sets the model to automatically calculate the optimal regularization parameter.
*   **`n_shuffles` / `n_splits`**: Parameters for the significance testing procedure to control the statistical rigor of the analysis.
*   **`dpca.protect=['t']`**: Ensures the time component is protected from the regularization or specific transformations during the fitting process.

---

## python/pyproject.toml

This file is a `pyproject.toml` configuration file for the `dPCA` Python package. Below is the structured analysis:

### 1. Purpose
This file serves as the build configuration and dependency manifest for the `dPCA` Python package. It standardizes the installation process, environment requirements, and metadata for the Demixed Principal Components Analysis (dPCA) library.

### 2. Key Functions/Classes
*Note: As a configuration file, this does not contain source code; however, based on the package definition, it points to:*
*   **dPCA modules**: The package is structured to include a `dPCA` namespace, which typically contains the core `dPCA` class responsible for performing the decomposition of neural population activity.

### 3. Data Flow
*   **Input**: The package processes multi-dimensional neural data arrays (typically time × stimulus × neuron).
*   **Processing**: The library applies dimensionality reduction techniques to separate the neural activity into marginals related to different experimental parameters.
*   **Output**: Returns decomposed components, explained variance ratios, and transformed neural trajectories.

### 4. Dependencies
*   **Core Libraries**: `numpy` (array handling), `scipy` (scientific computing), `scikit-learn` (machine learning utilities).
*   **Performance/Optimization**: `numexpr` (fast numerical expression evaluation) and `numba` (JIT compilation for performance).
*   **Environment**: Requires Python >= 3.7.

### 5. Analysis Methods
*   **Demixed Principal Components Analysis (dPCA)**: A statistical method used in neuroscience to decompose neural population responses into components that are specifically related to different task parameters (e.g., stimulus, decision, time) while maintaining the variance-capture properties of standard PCA.

### 6. Figures/Outputs
*   While the `pyproject.toml` does not generate figures itself, the `dPCA` package typically facilitates the generation of:
    *   Time-resolved component trajectories.
    *   Variance capture plots (scree plots) categorized by task marginals.

### 7. Key Parameters
*   **Version**: 1.0.5.
*   **Package Scope**: Limited to the `dPCA*` directory structure for build inclusion.
*   **Metadata**: Identifies "Machens Lab" as the primary maintainer, ensuring provenance for the scientific implementation.

---

## python/requirements.txt

This file is a configuration file defining the project's environment. Below is the structured analysis:

### 1. Purpose
This file serves as a dependency manifest for the repository, listing the core Python packages required to ensure a reproducible computational environment. It specifies the essential numerical and scientific libraries needed to execute the repository's analysis scripts.

### 2. Key Functions/Classes
*   **N/A**: As a `requirements.txt` file, it contains no executable code, functions, or classes. It is a metadata file used by package managers like `pip`.

### 3. Data Flow
*   **Input**: Used by environment managers (e.g., `pip install -r requirements.txt`) to pull specified versions of software libraries from repositories like PyPI.
*   **Output**: None.

### 4. Dependencies
The file declares the following external dependencies, which form the core of the research stack:
*   **numpy**: Foundation for numerical computing and array manipulation.
*   **scipy**: Used for scientific and technical computing (integration, optimization, etc.).
*   **numexpr**: Used for high-performance evaluation of numerical expressions.
*   **scikit-learn**: Used for machine learning, data mining, and statistical modeling.
*   **numba**: Used for JIT (Just-In-Time) compilation to accelerate Python/NumPy functions.

### 5. Analysis Methods
While the file itself does not implement methods, the listed dependencies imply the project performs:
*   **Vectorized Linear Algebra**: Facilitated by `numpy`.
*   **Advanced Scientific Computing**: Facilitated by `scipy`.
*   **Machine Learning/Statistical Inference**: Facilitated by `scikit-learn`.
*   **Performance Optimization**: Specifically parallel processing or CPU-bound acceleration via `numba` and `numexpr`.

### 6. Figures/Outputs
*   None.

### 7. Key Parameters
*   **Version Constraints**: Currently, the file lists dependencies without version constraints (e.g., `numpy` vs `numpy==1.26.0`). This implies the environment relies on the latest stable versions available at the time of installation, though this may impact strict reproducibility if not pinned.

---

## python/setup.py

This file is the standard Python distribution setup script for the **dPCA** (Demixed Principal Components Analysis) library.

### 1. Purpose
This file serves as the installation and configuration script for the `dPCA` Python package. It facilitates the distribution of the library via tools like `pip` and manages package metadata, versioning, and dependency resolution.

### 2. Key Functions/Classes
*   **`setup()`**: The core function from the `setuptools` library that defines package metadata, versioning, author information, and installation requirements to facilitate proper library installation.

### 3. Data Flow
*   **Reads**: It reads `README.rst` from the local directory to populate the package's long description on platforms like PyPI. It strips the first three lines of the README (likely to remove header artifacts) before processing.
*   **Writes**: Does not perform data processing or generate scientific output; it generates the package structure required for the Python environment.

### 4. Dependencies
The package relies on the following scientific Python ecosystem libraries:
*   `numpy`: Numerical array processing.
*   `scipy`: Scientific computing and linear algebra.
*   `scikit-learn`: Machine learning utilities.
*   `numexpr`: Fast numerical expression evaluation.
*   `numba`: JIT compiler for high-performance Python code.

### 5. Analysis Methods
While the file itself does not contain analysis logic, it registers the package `dPCA`. Based on the description, the underlying library implements **Demixed Principal Components Analysis**, a dimensionality reduction technique that decomposes neural population data into components that are specifically tuned to different task parameters (e.g., stimuli, decisions).

### 6. Figures/Outputs
*   **Outputs**: It produces an installed Python package (`dPCA`) accessible via `import dPCA`. It does not generate scientific plots or figures.

### 7. Key Parameters
*   **`VERSION = '1.0.5'`**: Tracks the current release iteration of the code.
*   **`packages=['dPCA']`**: Identifies the core directory containing the source code to be included in the installation.
*   **`install_requires`**: Lists the strict runtime dependencies necessary for the dPCA algorithm to execute correctly.

---

