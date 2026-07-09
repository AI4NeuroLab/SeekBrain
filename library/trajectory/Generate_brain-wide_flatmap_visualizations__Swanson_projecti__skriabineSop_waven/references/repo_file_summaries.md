# Repository File Summaries

## .readthedocs.yaml

This file is a configuration file for **Read the Docs**, a platform that automates the building, versioning, and hosting of documentation for open-source projects.

### 1. Purpose
This file instructs the Read the Docs server on how to build the project's documentation. It defines the build environment, identifies the location of the Sphinx configuration, and specifies the dependency installation process to ensure reproducible documentation builds.

### 2. Key Functions/Classes
*   **`build`**: Defines the virtual environment (OS and Python version).
*   **`sphinx`**: Points the builder to the Sphinx source directory where the `conf.py` file resides.
*   **`python`**: Defines the package installation strategy for the documentation environment.

### 3. Data Flow
*   **Reads**: The file reads the project's source code and the `docs/requirements.txt` file.
*   **Processes**: It executes Sphinx (a documentation generator) to transform reStructuredText or Markdown files into HTML/PDF documentation.
*   **Writes**: It outputs generated documentation files (typically HTML) to the Read the Docs hosting server.

### 4. Dependencies
*   **External**: Requires the `sphinx` tool and the Python packages listed in `docs/requirements.txt`.
*   **Internal**: Depends on the existence of `docs/source/conf.py` and the root package installation (indicated by `path: .`).

### 5. Analysis Methods
*   **N/A**: This is an infrastructure/configuration file. It does not contain scientific or statistical algorithms.

### 6. Figures/Outputs
*   **Outputs**: It produces the rendered project documentation website.

### 7. Key Parameters
*   **`version: 2`**: Specifies the configuration file schema version.
*   **`os: ubuntu-22.04`**: The target operating system for the build environment.
*   **`python: "3.8"`**: The Python version used to execute the documentation build.
*   **`docs/requirements.txt`**: The manifest of Python packages required for the build (e.g., extensions like `sphinx-rtd-theme`).

---

## README.md

This file is the `README.md` for the **Waven** repository, a Python framework for analyzing neuronal responses in the visual cortex by correlating neural activity with visual stimuli feature representations.

### 1. Purpose
Waven provides a pipeline to analyze how neurons in the visual cortex respond to visual stimuli by decomposing stimuli into Gabor-filtered features. It facilitates the extraction of tuning curves for visual characteristics such as orientation, spatial frequency, and azimuth/elevation.

### 2. Key Functions/Classes
*   `waven.PipelineConfig`: Manages the configuration for the analysis and Gabor library generation.
*   `waven.gui.run`: Launches a graphical interface for parameter tuning and analysis visualization.
*   `create_gabor_library`: Generates a bank of Gabor filters based on defined visual parameters.
*   `prepare_stimulus_wavelets`: Performs wavelet decomposition of the input stimulus.
*   `load_spikes_and_positions`: Handles the ingestion of neural spike data and spatial coordinates.
*   `run_rf_analysis`: Executes quick receptive field correlation analysis.
*   `run_full_model`: Computes the full neural response model based on the processed stimuli and spiking data.

### 3. Data Flow
1.  **Input**: Raw visual stimulus (e.g., `.mp4`) and neural spike data (e.g., `spks.npy`).
2.  **Processing**: The stimulus is converted into a Gabor filter bank (stored as `.npy` or `.zarr`); wavelet decomposition is applied.
3.  **Modeling**: Neural activity is aligned with the wavelet-decomposed stimulus.
4.  **Output**: Tuning curves for visual features, receptive field maps, and full model neural activity predictions.

### 4. Dependencies
*   **Core Libraries**: `torch`, `numpy`, `scipy`, `pandas`, `scikit-learn`, `scikit-image`, `matplotlib`, `opencv-python`.
*   **Data/Storage**: `zarr`, `tifffile`.
*   **External Repo**: Relies on [zebra_noise](https://github.com/mwshinn/zebra_noise) for stimulus generation.

### 5. Analysis Methods
*   **Gabor Transform**: Used to create a basis of visual features (orientation, frequency, phase).
*   **Wavelet Decomposition**: Used to represent the visual stimulus in the frequency/feature domain.
*   **Receptive Field (RF) Correlation**: Statistical mapping of neural response to specific visual stimuli parameters.

### 6. Figures/Outputs
*   **Visualizations**: Receptive field maps and tuning curves generated via the integrated GUI.
*   **Data Products**: Gabor library files, wavelet-decomposed stimulus files (suggested as `.zarr` for efficiency).

### 7. Key Parameters
*   **Gabor Library**: `N_thetas` (orientations), `Sigmas` (filter radius), `Frequencies` (spatial frequency), `Phases`.
*   **Alignment/Environment**: `Experiment Info` (mouse/date/trial), `Number of Planes`, `Hz` (frame rate), `Resolution` (um/pixel).
*   **Visual/Analysis Coverage**: Spatial bounds (`Visual Coverage`, `Analysis Coverage`) defining the field of view in degrees.
*   **Paths**: `Movie Path`, `Library Path`, `Full Model Wavelet Path` (caching directory).

---

## docs/conf.py

This file is the configuration script for the **Sphinx** documentation generator, used to build and style the technical documentation for the *Waven* project.

### 1. Purpose
This file configures the Sphinx documentation build system to transform source documentation (such as docstrings and notebooks) into a formatted website. It defines project metadata, documentation extensions, and aesthetic settings (theme and logos) for the *Waven* project.

### 2. Key Functions/Classes
*   **Sphinx Configuration Variables:** The script sets standard global variables (e.g., `project`, `author`, `extensions`) that Sphinx consumes to initialize the documentation environment.

### 3. Data Flow
*   **Reads:** 
    *   Docstrings from the project source code (via `autodoc`).
    *   Static assets located in `_static/` (e.g., logos).
    *   Jupyter notebooks (implicitly, via `nbsphinx`).
*   **Writes:** Generates HTML-based documentation pages and associated navigation structures.

### 4. Dependencies
*   **Sphinx Extensions:**
    *   `sphinx.ext.autodoc`: Extracts documentation from docstrings.
    *   `sphinx.ext.napoleon`: Supports Google/NumPy-style docstrings.
    *   `sphinx.ext.viewcode`: Adds links to the source code.
    *   `sphinx.ext.intersphinx`: Links to other project documentations.
    *   `sphinx.ext.autosummary`: Generates function/class summary tables.
*   **External Packages:**
    *   `nbsphinx`: Integration for Jupyter Notebooks.
    *   `furo`: The selected HTML documentation theme.

### 5. Analysis Methods
*   This file does not implement scientific methods itself; it is a **meta-configuration file** used to organize and present the findings/methods implemented elsewhere in the repository.

### 6. Figures/Outputs
*   **Primary Output:** A rendered HTML website (`Waven`).
*   **Static Assets:** Utilizes `image1630.png` as both the site favicon and the logo (light/dark modes).
*   **Visual Elements:** Includes a custom SVG icon for a GitHub footer link.

### 7. Key Parameters
*   **`autosummary_generate`**: Set to `True` to automatically generate documentation pages for all APIs.
*   **`nbsphinx_execute`**: Set to `"never"` to prevent the documentation build process from re-running potentially time-consuming Jupyter notebook cells.
*   **`html_theme`**: Set to `"furo"`, which dictates the responsive, modern layout of the final site.
*   **`html_theme_options`**: Contains specific branding parameters, including repository URLs and custom logo paths.

---

## docs/html/_sources/faq.rst.txt

This file is a documentation source file written in reStructuredText (RST) format, serving as a Frequently Asked Questions (FAQ) section for a scientific research software package.

### 1. Purpose
This file provides user guidance and best practices for running the software, specifically addressing concerns regarding data storage, performance expectations, and hardware requirements. It aims to optimize the user experience by mitigating common bottlenecks in data processing.

### 2. Key Functions/Classes
*   **Not applicable**: As a documentation file, it contains no executable code, functions, or classes.

### 3. Data Flow
*   **Reads/Writes**: The document advises that all video files, Gabor filter libraries, and processed pre-analysis data files should be stored locally on the user's machine rather than on a network/remote server to ensure efficient I/O operations.
*   **Persistence**: It notes that wavelet preprocessing creates cached files that are saved and reused in subsequent analysis runs to improve speed.

### 4. Dependencies
*   **Documentation System**: This file is intended for use with a documentation generator, likely **Sphinx** (indicated by the `.. admonition::` directives and `.rst.txt` file structure).

### 5. Analysis Methods
*   **Wavelet Preprocessing**: Mentioned as a compute-intensive stage of the pipeline.
*   **Gabor Filtering**: Indicated as a core scientific analysis component requiring a large-scale filter library.

### 6. Figures/Outputs
*   **None**: The file is purely informational and does not generate scientific figures or data outputs.

### 7. Key Parameters (Hardware/System Requirements)
*   **Disk Space**: A minimum of 100 GB of free space is required.
*   **RAM**: A minimum of 64 GB of RAM is required for smooth operation.

---

## docs/html/_sources/index.rst.txt

This file is a source document for a documentation build system (Sphinx). Below is the structured analysis:

### 1. Purpose
This file serves as the root index and master navigation file for the **Waven** project documentation. It acts as the landing page for the documentation website, organizing the project structure and linking to various sub-guides.

### 2. Key Functions/Classes
*   **`toctree`**: A Sphinx directive used to generate a hierarchical table of contents, linking the project’s modular documentation files (e.g., `quickstart`, `installation`, `faq`).
*   **`genindex` / `modindex`**: Automated Sphinx directives that generate indices for all documented objects and Python modules.

### 3. Data Flow
*   **Reads**: It references external `.rst` (reStructuredText) files located in the same directory (`quickstart.rst`, `installation.rst`, `faq.rst`).
*   **Writes**: During the documentation build process, it instructs Sphinx to compile these source files into formatted HTML outputs.

### 4. Dependencies
*   **Sphinx**: The Python-based documentation generator is the sole dependency required to process this file.
*   **Internal Files**: Depends on the existence of `quickstart`, `installation`, and `faq` source files within the `docs/html/_sources/` directory.

### 5. Analysis Methods
*   **N/A**: This is a configuration/markup file for documentation and does not contain scientific or statistical implementation logic.

### 6. Figures/Outputs
*   **Outputs**: Generates the primary navigation interface (the "Welcome" page and sidebar/menu) for the Waven software documentation website.

### 7. Key Parameters
*   **`:maxdepth: 2`**: A configuration parameter that restricts the table of contents to show only two levels of nesting, keeping the documentation navigation clean.
*   **`:caption: Contents:`**: Defines the display label for the navigation section in the generated documentation.

***

**Note on Repository Context:**
The file header mentions "ZebrAnalysis," which suggests the repository may have been renamed or refactored from "ZebrAnalysis" to "Waven." Users should ensure that documentation paths are consistent with the current project name.

---

## docs/html/_sources/installation.rst.txt

This file is a documentation source file written in reStructuredText format. Below is the structured analysis:

### 1. Purpose
This file provides instructional documentation for users to set up the software environment and install the `zebrAnalysis` package. It serves as the "Installation" page for the project's documentation.

### 2. Key Functions/Classes
*   **None**: This is a documentation file, not an implementation file. It contains no executable code, classes, or functions.

### 3. Data Flow
*   **Input**: It directs users to an `environment.yml` configuration file located within the repository.
*   **Output**: It provides a pip-based installation command to pull the `zebrAnalysis` package from the Test PyPI repository.

### 4. Dependencies
*   **Conda**: Required for managing the virtual environment via the `environment.yml` file.
*   **pip**: Required for installing the package from the specified PyPI index.
*   **Test PyPI**: The remote repository (`https://test.pypi.org/`) where the package is hosted.

### 5. Analysis Methods
*   **N/A**: This file does not implement scientific or statistical methods.

### 6. Figures/Outputs
*   **None**: This file does not generate figures or plots.

### 7. Key Parameters
*   **`environment.yml`**: A configuration file containing the necessary software dependencies for the project.
*   **`zebrAnalysis9.54`**: The specific version of the package identified for installation.

---

## docs/html/_sources/quickstart.rst.txt

This file serves as a **Quick Start Guide** for the `zebrAnalysis3` repository, documenting the workflow for extracting visual feature preferences from 2-photon neural data.

### 1. Purpose
This file provides a tutorial and code snippets for setting up parameters, generating Gabor filter libraries, processing visual stimulus videos, and performing correlation-based receptive field analysis on neural spike data.

### 2. Key Functions/Classes
*   **`wg.makeFilterLibrary`**: Generates a library of Gabor filters based on specified spatial parameters.
*   **`wg.downsample_video_binary`**: Downsamples raw visual stimuli videos to match experimental parameters.
*   **`wg.waveletDecomposition`**: Performs wavelet-based decomposition of video data using the Gabor library.
*   **`lpn.correctNeuronPos`**: Normalizes neuron positions into microns using microscope resolution.
*   **`au.PearsonCorrelationPinkNoise`**: Calculates the Pearson correlation between stimulus wavelets and neural spike activity.
*   **`au.Plot_RF` / `au.PlotTuningCurve`**: Visualization utilities for displaying receptive fields and stimulus tuning curves.

### 3. Data Flow
1.  **Initialization**: User defines `gabor_param` and `param_defaults` dictionaries.
2.  **Processing**: Stimulus video (`.mp4`) is downsampled and processed via wavelet decomposition to create feature representations.
3.  **Registration**: Neural spike data (`spks.npy`) and neuron positions (`pos.npy`) are loaded and time-registered.
4.  **Analysis**: Correlation between the wavelet-transformed stimuli and spikes is calculated to extract neural feature preferences.
5.  **Visualization**: Plots are generated for receptive fields and tuning curves.

### 4. Dependencies
*   **Libraries**: `numpy`, `os`, `gc`.
*   **Repo Modules**: `zebrAnalysis3.WaveletGenerator` (`wg`), `zebrAnalysis3.Analysis_Utils` (`au`), `zebrAnalysis3.LoadPinkNoise` (`lpn`), and `zebrAnalysis3.zebraGUI` (`ui`).

### 5. Analysis Methods
*   **Wavelet Decomposition**: Uses Gabor filters to decompose stimuli into spatial frequency, orientation, and phase components.
*   **Pearson Correlation**: Quantifies the relationship between visual stimulus wavelets and neural responses.
*   **Repetability/Tuning Curves**: Statistical methods to assess the reliability and preference of neuronal responses to visual stimuli.

### 6. Figures/Outputs
*   **Files**: `gabors_library.npy` (Gabor library), `_downsampled.npy` (processed stimuli).
*   **Plots**: 2D Receptive Field maps (`Plot_RF`) and stimulus tuning curves (`PlotTuningCurve`).

### 7. Key Parameters
*   **Stimulus Spatial**: `NX`, `NY` (dimensions), `Sigmas`, `Frequencies`, `N_thetas`.
*   **Experimental**: `Resolution` (μm/pixel), `Visual Coverage` vs `Analysis Coverage` (defining spatial boundaries of the stimulus).
*   **Pathing**: `Movie Path`, `Library Path`, `Spks Path`.
*   **Acquisition**: `Number of Frames`, `Number of Planes`, `Experiment Info`.

---

## docs/html/_static/scripts/furo.js.LICENSE.txt

This file is a license and attribution notice for a third-party dependency included in the repository's documentation build system.

### 1. Purpose
This file serves as the legal notice and attribution for the `gumshoejs` library, a scrollspy utility used within the project’s documentation interface (Furo theme). It confirms the licensing terms and authorship of the integrated script.

### 2. Key Functions/Classes
*   **None**: This file is a text-based license file, not executable source code. The actual library code (referenced here) provides functions to monitor scroll positions and update navigation states.

### 3. Data Flow
*   **Reads/Writes/Processes**: None. The file is static documentation metadata.

### 4. Dependencies
*   **External**: `gumshoejs` (v5.1.2), a scrollspy script authored by Chris Ferdinandi.
*   **Repo Context**: This file is associated with the `furo` documentation theme, which is used to render the repository's HTML documentation.

### 5. Analysis Methods
*   **None**: This file does not implement any scientific or statistical methods.

### 6. Figures/Outputs
*   **None**: This file does not generate figures, plots, or processed data outputs.

### 7. Key Parameters
*   **None**: As a license file, it contains no configurable parameters or runtime variables.

---

## docs/requirement.txt

This file is a standard Python requirements manifest used in research software development. Below is the structured analysis:

### 1. Purpose
This file specifies the software dependencies required to build and render the project's technical documentation. It ensures that all contributors and continuous integration systems use compatible versions of documentation-generation tools.

### 2. Key Functions/Classes
*   **None**: This is a configuration/manifest file, not an executable script. It contains no functions or classes.

### 3. Data Flow
*   **Reads**: N/A (Accessed by package managers like `pip`).
*   **Writes**: N/A.
*   **Processes**: Acts as an instruction set for the `pip install -r requirements.txt` command to download and configure the build environment for documentation.

### 4. Dependencies
The file specifies dependencies for the **Sphinx** documentation ecosystem:
*   **[Sphinx](https://www.sphinx-doc.org/)**: The core documentation generator.
*   **[sphinx-rtd-theme](https://github.com/readthedocs/sphinx_rtd-theme)**: A specific visual theme for documentation.
*   **[sphinx-autodoc-typehints](https://github.com/tox-dev/sphinx-autodoc-typehints)**: A plugin to extract type hints from Python source code for better API documentation.
*   **[furo](https://github.com/pradyunsg/furo)**: A modern, responsive theme often used as an alternative or supplement to RTD.

### 5. Analysis Methods
*   **N/A**: This file does not implement scientific or statistical methods. It facilitates the *presentation* of scientific methods described in the repository's source code.

### 6. Figures/Outputs
*   **Outputs**: While the file itself does not generate output, running it enables the generation of HTML or PDF documentation files (usually located in a `docs/_build/` directory) that contain the project's technical documentation, API references, and manuals.

### 7. Key Parameters
The file defines minimum version constraints for the documentation environment:
*   `sphinx>=4.0.0`: Ensures support for newer Sphinx features and configuration standards.
*   `furo>=2024.0.0`: Pins the documentation theme to a recent release to maintain a modern UI.
*   `sphinx-autodoc-typehints>=1.12.0`: Ensures the auto-generation of documentation correctly parses modern Python type-hinting syntax.

---

## docs/requirements.txt

This file is a standard Python requirements manifest used for managing the software environment of a scientific research project.

### 1. Purpose
This file specifies the exact versions of external Python libraries required to build the project's documentation and execute its core computational workflows. It ensures reproducibility across different development and deployment environments.

### 2. Key Functions/Classes
*   **N/A**: As a requirements file, this document contains no executable code, functions, or classes. It serves as a configuration manifest for package managers like `pip`.

### 3. Data Flow
*   **Reads**: Used by the environment manager (e.g., `pip`) to pull packages from the Python Package Index (PyPI).
*   **Processes**: It facilitates the processing of scientific imagery (`opencv`, `scikit-image`, `tifffile`) and numerical datasets (`numpy`, `pandas`).

### 4. Dependencies
The project relies on a stack primarily focused on computer vision, machine learning, and documentation:
*   **Documentation**: `sphinx`, `sphinx-rtd-theme`, `sphinx-autodoc-typehints`, `furo`.
*   **Numerical/Scientific Computing**: `numpy`, `scipy`, `pandas`.
*   **Data Visualization**: `matplotlib`, `seaborn`.
*   **Machine Learning/Computer Vision**: `torch`, `opencv_python_headless`, `scikit-learn`, `scikit-image`, `tifffile`.

### 5. Analysis Methods
While the file itself does not implement methods, the included libraries indicate the use of:
*   **Statistical Analysis**: Likely performed via `scipy`, `pandas`, and `scikit-learn`.
*   **Deep Learning**: Indicated by the inclusion of `torch` (PyTorch).
*   **Image Processing**: Indicated by `tifffile`, `opencv`, and `scikit-image`, suggesting analysis of microscopy or high-dimensional raster data.

### 6. Figures/Outputs
The project is configured to generate documentation (via `sphinx`) and data visualizations (likely plots and graphs created using `matplotlib` and `seaborn`).

### 7. Key Parameters
The file defines strict pinning for most dependencies, which acts as a "key parameter" for the software's stability:
*   **Strict Versions**: Most packages are pinned (e.g., `matplotlib==3.7.1`, `torch==2.0.1`) to avoid breaking changes in dependencies.
*   **Minimum Versions**: Some packages use floor constraints (e.g., `sphinx>=4.0.0`) to allow for security updates while maintaining API compatibility.

---

## docs/source/conf.py

This analysis pertains to the `docs/source/conf.py` file, which serves as the configuration script for the Sphinx documentation build process for the "Waven" project.

### 1. Purpose
This file configures the Sphinx documentation generator for the Waven repository. It defines project metadata, documentation themes, enabled extensions, and specific settings for processing code and notebook files.

### 2. Key Functions/Classes
This is a configuration script rather than a functional module; it does not contain user-defined classes or processing functions. It relies on the Sphinx framework to execute build-time tasks.

### 3. Data Flow
*   **Reads**: It accesses project metadata (e.g., `author`, `project`, `version`) and static assets (logos and favicons) located in `_static/`.
*   **Processes**: It scans the source code to generate API documentation (`autodoc`, `autosummary`) and incorporates existing Jupyter notebooks.
*   **Writes**: It outputs HTML documentation files for the project website.

### 4. Dependencies
*   **Sphinx Extensions**: `sphinx.ext.autodoc`, `napoleon` (for NumPy/Google docstring support), `viewcode`, `intersphinx`, and `autosummary`.
*   **External Theme**: `furo` (the selected HTML theme).
*   **External Plugin**: `nbsphinx` (for processing Jupyter notebooks).

### 5. Analysis Methods
This file does not implement scientific or statistical methods; it is strictly limited to documentation infrastructure.

### 6. Figures/Outputs
*   **Output**: Generates a static HTML documentation site.
*   **Assets**: Uses `image1630.png` as the site logo and favicon.
*   **Integration**: Includes a SVG-based GitHub link in the footer for the `zebranalysis` repository.

### 7. Key Parameters
*   **`nbsphinx_execute`**: Set to `"never"`; prevents the documentation build from executing Jupyter notebooks, likely to avoid long build times or dependency errors during documentation deployment.
*   **`autosummary_generate`**: Set to `True`, enabling the automatic generation of summary tables for API documentation.
*   **`html_theme`**: Set to `"furo"`, a popular, modern documentation theme for scientific projects.
*   **`project` / `release`**: Defines the project identity ("Waven") and version ("1").

---

## environment.yml

This file is a configuration file for the `conda` package manager, used to define a reproducible software environment for the `waven` research project.

### 1. Purpose
This file manages the environment setup for a neuroscience or computational biology project, ensuring consistent versions of scientific Python libraries are installed. It specifically curates a stack compatible with neuroimaging and array-based analysis tools.

### 2. Key Functions/Classes
*N/A: This is a configuration file, not a source code file containing logic.*

### 3. Data Flow
*N/A: This file does not process data, but it prepares the environment to handle:*
* **Reads/Writes**: Likely high-dimensional microscopy/neuroimaging data (suggested by `tifffile`, `zarr`, and `suite2p`).
* **Processing**: Supports the transformation of raw array data into statistical features and machine learning models.

### 4. Dependencies
The environment relies on the following key external packages:
* **Core Scientific**: `numpy` (pinned to 1.26), `scipy`, `pandas`, `scikit-image`, `scikit-learn`.
* **Deep Learning**: `pytorch=2.0.1`, `tensorly`.
* **Domain-Specific**: `suite2p` (via `pip` for calcium imaging analysis), `pywavelets`.
* **Storage/I/O**: `zarr`, `tifffile`, `imageio`, `opencv`.

### 5. Analysis Methods
While the file is a configuration, the installed libraries imply the following research methods:
* **Neuroimaging Analysis**: Calcium imaging processing via `suite2p`.
* **Signal/Image Processing**: Wavelet transforms (`pywavelets`), image filtering/segmentation (`scikit-image`, `opencv`).
* **Statistical Modeling**: Regression/GLMs (`statsmodels`, `scikit-learn`).
* **Machine Learning**: Neural networks (`pytorch`) and tensor-based decomposition (`tensorly`).

### 6. Figures/Outputs
*N/A: This file does not generate output, but it provides the libraries (`matplotlib`, `seaborn`) required for researchers to generate scientific plots and figures.*

### 7. Key Parameters
* **`numpy=1.26`**: Critically pinned to avoid incompatibility with older neuroscience tools that are not yet compatible with NumPy 2.0.
* **`python=3.10`**: Establishes the core language version for the runtime.
* **`pytorch=2.0.1`**: Pins the deep learning framework to a stable, version-specific release.

---

## examples/example.py

This file, `examples/example.py`, serves as the central command-line interface and entry point for the **Waven analysis pipeline**, a toolkit likely used for processing receptive-field (RF) data in neuroscience.

### 1. Purpose
This script acts as a dual-mode controller that either launches a Tkinter-based GUI for interactive configuration or executes a batch-processing pipeline for automated neuronal data analysis. It manages user configuration inputs and delegates the execution to the core `Waven` library components.

### 2. Key Functions/Classes
*   **`parse_args`**: Uses `argparse` to handle user-specified flags for batch execution (e.g., `--run`, `--model`) or UI launch.
*   **`load_config`**: Handles the retrieval of analysis parameters from either a user-provided JSON file or hard-coded defaults.
*   **`run_gui`**: Initializes and launches the `zebraGUI` module to allow parameter tuning through a visual interface.
*   **`main`**: The primary logic branch; it determines whether to start the GUI or trigger the `run_pipeline` function based on command-line inputs.

### 3. Data Flow
*   **Inputs**: Reads optional JSON configuration files for analysis/gabor settings and raw data inputs (processed within the `Waven` backend).
*   **Process**: Modifies system environment variables (`WAVEN_NO_PLOTS`, `MPLBACKEND`) to control performance and plotting behavior.
*   **Outputs**: Passes configuration objects and execution flags to `Waven.pipeline` to trigger computation (e.g., wavelet decomposition, RF modeling).

### 4. Dependencies
*   **Standard Library**: `argparse`, `pathlib`, `os`, `sys`.
*   **External**: `matplotlib` (used for plotting).
*   **Repository Internal**: 
    *   `Waven.config` (configuration management).
    *   `Waven.pipeline` (the core computational engine).
    *   `Waven.zebraGUI` (the interactive user interface).

### 5. Analysis Methods
While the file is a controller, it facilitates the following scientific methods:
*   **Gabor Library Creation**: Preparing visual filters for receptive field estimation.
*   **Wavelet Decomposition**: Transforming movie data/inputs into the wavelet domain.
*   **Receptive-Field (RF) Modeling**: Nonlinear modeling of neural responses (Fast vs. Full granularity).

### 6. Figures/Outputs
*   **Visuals**: Produces diagnostic plots of neuronal receptive fields (unless `--no-plots` is specified).
*   **Pipeline artifacts**: Through the `run_pipeline` delegate, it generates processed model results and analysis outputs based on the provided configuration.

### 7. Key Parameters
*   **`--config`**: Path to a JSON configuration file.
*   **`--neuron-id`**: Integer identifier for selecting specific neurons for visualization (default: `2441`).
*   **Execution Flags**: `--run` (batch mode), `--create-gabor` (preprocessing), `--wavelets` (downsampling/decomposition), `--model`/`--full-model` (nonlinear modeling).

---

## examples/run_waven_parts.py

This file, `examples/run_waven_parts.py`, serves as an execution script for running segments of the `waven` neural analysis pipeline, specifically focusing on Receptive Field (RF) analysis and model training.

### 1. Purpose
The script orchestrates a partial execution of the `waven` analysis pipeline for neural data. It processes spike and stimulus data, performs RF correlation analysis, trains a full model, and generates diagnostic visualizations for specific neurons.

### 2. Key Functions/Classes
*   **`load_spikes_and_positions`**: Imports raw neural spike data and spatial positions.
*   **`run_rf_analysis`**: Calculates the correlation between neural responses and Gabor filter stimuli.
*   **`run_full_model`**: Executes the primary nonlinear model fitting for the neural data.
*   **`PlotTuningCurve`**: Computes and renders tuning curves for a specified neuron ID.
*   **`waven.gui.run`**: Launches the interactive `waven` graphical user interface after processing.

### 3. Data Flow
*   **Reads**: Loads a `pipeline_config.json` file for settings and path definitions, and raw spike/position data via `load_spikes_and_positions`.
*   **Processes**: Transforms stimuli into wavelet representations, performs RF estimation, and runs a nonlinear modeling layer.
*   **Writes**: Saves diagnostic plots (retinotopic maps, tuning curves, RF grids) to the directory specified in `config.analysis.full_model_save_path`.

### 4. Dependencies
*   **Scientific Stack**: `numpy`, `matplotlib` (configured to `TkAgg`).
*   **Internal Module**: `waven` (the core research package for wavelet-based neural analysis).
*   **External Config**: Expects a JSON configuration file defining file paths and analysis parameters.

### 5. Analysis Methods
*   **RF Correlation Analysis**: Maps neural activity against a library of Gabor filters to determine spatial selectivity.
*   **Nonlinear Modeling**: Uses `run_full_model` to fit neural response functions.
*   **Retinotopic Mapping**: Visualizes the spatial arrangement of neuron receptive fields across the visual field.
*   **Tuning Curves**: Measures neural response magnitude relative to stimulus parameters (e.g., orientation, spatial frequency).

### 6. Figures/Outputs
*   **`selected_neuron_rf`**: A grid plot showing RF correlation for a specific `neuron_id`.
*   **`retinotopic_maps`**: Global map of neuron positions and spatial preference.
*   **`selected_neuron_tuning`**: Plots showing specific tuning properties of a neuron.
*   **`visual_sign_map`**: A plot identifying the visual sign (on/off) of the responsive regions.

### 7. Key Parameters
*   **`neuron_id`**: Set to `2441`; dictates which specific neuron is detailed in the plots.
*   **`tt = [0, 36000]`**: Time interval used for the `run_full_model` fitting process.
*   **`config.analysis`**: Contains metadata such as `sigmas_deg` (spatial smoothing), `screen_ratio`, and file paths for library and model storage.
*   **`create_library` / `prepare_wavelets`**: Booleans toggling whether to regenerate filter libraries or pre-process movie stimuli.

---

## pipeline_correlation_plots.py

### Code Analysis: `pipeline_correlation_plots.py`

#### 1. Purpose
This script serves as an execution pipeline to perform Receptive Field (RF) correlation analysis on neuronal spike data and generate visualizations for retinotopic mapping and tuning curves. It bridges configuration-based analysis with specialized plotting routines from the `waven` package.

#### 2. Key Functions/Classes
*   **`parse_args`**: Handles CLI input for configuration paths, target neuron selection, and display settings.
*   **`configure_backend`**: Manages Matplotlib backend settings (e.g., switching to non-interactive 'Agg' when saving files).
*   **`main`**: Orchestrates the analysis flow: loading data, executing RF computations, generating visual diagnostic figures, and managing file output.

#### 3. Data Flow
1.  **Input**: Reads configuration data from a JSON file and spike/position data via `load_spikes_and_positions`.
2.  **Processing**: Computes RF correlation statistics and tuning curve data using `run_rf_analysis` and legacy utilities (`Analysis_Utils`).
3.  **Output**: Exports diagnostic plots as PNG files to a specified directory and/or renders interactive plot windows.

#### 4. Dependencies
*   **Internal (`waven` package)**: `PipelineConfig`, `load_spikes_and_positions`, `run_rf_analysis`, and visualization helpers (`plot_rf_grid`, `plot_retinotopic_maps`, `plot_sign_map`, `save_figures`).
*   **External**: `matplotlib`, `argparse`, `pathlib`.
*   **Legacy**: `Waven.Analysis_Utils` (aliased as `au`) for specialized tuning curve plotting.

#### 5. Analysis Methods
*   **RF Correlation Analysis**: Computes spatial correlations between spike activity and visual stimuli.
*   **Retinotopic Mapping**: Maps neuronal activity to spatial positions on the visual field.
*   **Visual Sign Mapping**: Computes polarity/sign maps of visual responses.
*   **Tuning Curve Analysis**: Extracts and plots neuronal tuning properties using `PlotTuningCurve`.

#### 6. Figures/Outputs
*   **`selected_neuron_rf`**: A spatial grid plot for a specific neuron's RF correlation.
*   **`retinotopic_maps`**: Visual representation of the RFs across the recorded neural population.
*   **`selected_neuron_tuning`**: Tuning curve diagnostic plots (varies by index).
*   **`visual_sign_map`**: A map illustrating the visual sign (e.g., center-surround polarity) of the neurons.

#### 7. Key Parameters
*   **`--config`**: Path to the JSON file defining experimental settings.
*   **`--neuron-id`**: The specific index of the neuron to visualize in detail.
*   **`--save-dir`**: Output directory for saving generated PNG figures.
*   **`--no-show`**: Boolean flag to bypass interactive plot rendering (enables batch/headless processing).
*   **`--skip-sign-map`**: Boolean flag to disable the computation of the visual sign map.

---

## pyproject.toml

This file is the configuration file for the **Waven** Python package. Below is the structured analysis:

### 1. Purpose
This `pyproject.toml` file serves as the build system and dependency management configuration for the **Waven** library. It defines the environment, metadata, and packaging structure required to install and distribute the tool for wavelet-based analysis of neural spikes.

### 2. Key Functions/Classes
*Note: As this is a configuration file, it does not contain implementation code, but defines the structure for the package located in the `src/` directory:*
* **Package Structure**: Organized under the `src` directory, intended to expose the `waven` module.

### 3. Data Flow
Based on the dependencies, the package is designed to process:
* **Input**: Likely high-dimensional neural spike data (multi-channel recordings).
* **Processing**: The pipeline appears to ingest neural data, process it using wavelet transforms, perform dimensionality reduction/tensor decomposition, and execute machine learning tasks.
* **Output**: Statistical visualizations, segmented spike data, and potentially processed tensor outputs.

### 4. Dependencies
The package relies on a robust scientific stack:
* **Core Computing**: `numpy`, `scipy`.
* **Neural/Tensor Processing**: `torch` (PyTorch) and `tensorly` (tensor learning).
* **Imaging/File I/O**: `opencv_python`, `scikit_image`, `tifffile`, `zarr` (likely for handling large-scale neural recording arrays).
* **Analysis/Visualization**: `pandas`, `scikit_learn`, `matplotlib`, `seaborn`.

### 5. Analysis Methods
While the implementation details reside in the `src/` directory, the dependency profile implies the following scientific methods:
* **Wavelet Analysis**: Indicated by the library name, used for time-frequency localization of spikes.
* **Tensor Decomposition**: Suggested by the inclusion of `tensorly`.
* **Machine Learning**: Likely used for spike classification or feature extraction via `scikit_learn` and `torch`.
* **Statistical Visualization**: Facilitated by `seaborn` and `matplotlib` for interpreting neural patterns.

### 6. Figures/Outputs
Based on the inclusion of plotting libraries (`matplotlib`, `seaborn`), the package likely generates:
* Time-frequency scalograms (from wavelet transforms).
* Spike-raster plots or peri-stimulus time histograms (PSTH).
* Dimensionality reduction plots (e.g., PCA/t-SNE clusters of spike waveforms).

### 7. Key Parameters
* **Version**: `0.0.4` (indicating a research-focused, early-stage library).
* **Compatibility**: Requires `python >= 3.8`.
* **Packaging**: Configured to include sub-packages matching `Waven*` or `waven*` within the `src` source tree.

---

## requirements.txt

This file, `requirements.txt`, serves as the dependency configuration manifest for the research repository. Below is the structured analysis:

### 1. Purpose
This file specifies the exact versions of external Python libraries required to create a reproducible software environment for the research project. It ensures that all computational tasks, including data processing and modeling, are executed with consistent library dependencies.

### 2. Key Functions/Classes
*N/A: This is a configuration file, not an executable script.*

### 3. Data Flow
*   **Input:** Implicitly supports the processing of multidimensional image data (via `tifffile` and `opencv`), tabular data (via `pandas`), and numerical arrays (via `numpy`).
*   **Output:** Implicitly facilitates the generation of visualizations (`matplotlib`, `seaborn`) and model artifacts (`torch`, `scikit-learn`).

### 4. Dependencies
The project relies on a comprehensive suite of Python packages:
*   **Core Scientific Computing:** `numpy`, `scipy`, `pandas`
*   **Computer Vision/Image Processing:** `opencv_python_headless`, `scikit_image`, `tifffile`
*   **Machine Learning/Deep Learning:** `torch`, `scikit_learn`, `tensorly`
*   **Visualization:** `matplotlib`, `seaborn`

*Note: There is a version conflict in the file regarding `tifffile` (specified as both `2023.7.10` and `2021.7.2`), which may cause installation errors or ambiguity in a production environment.*

### 5. Analysis Methods
While the file is a manifest, the included libraries suggest the following research methodologies:
*   **Tensor Decomposition:** Indicated by the inclusion of `tensorly`.
*   **Machine Learning:** Supervised/unsupervised learning via `scikit-learn` and deep learning via `torch`.
*   **Image Analysis:** Signal processing and image segmentation via `scikit-image` and `opencv`.

### 6. Figures/Outputs
The inclusion of `matplotlib` and `seaborn` suggests the repository generates:
*   Statistical plots (scatter, bar, heatmaps).
*   Visualizations of processed image data or model performance metrics.

### 7. Key Parameters
*N/A: This file contains library version requirements rather than project-specific runtime parameters.*

---

## source/conf.py

### Analysis of `source/conf.py`

This file serves as the primary configuration script for the **Sphinx documentation generator** for the "Waven" project. It manages the build process, theme settings, and extensions required to transform source code (and likely notebooks) into a cohesive documentation website.

---

#### 1. Purpose
This file configures the Sphinx documentation environment for the **Waven** project. It specifies which extensions to use, defines project metadata, selects the documentation theme, and sets rules for how auxiliary files like Jupyter notebooks should be handled during the build process.

#### 2. Key Functions/Classes
*   **Sphinx Configuration:** As a standard Sphinx `conf.py` file, it defines a set of global variables (`project`, `extensions`, `html_theme`) that the Sphinx build engine parses to construct the documentation structure.

#### 3. Data Flow
*   **Inputs:** Reads metadata (author, version, copyright) and documentation source files (likely located in `source/`). It also references static assets in `_static/`.
*   **Processes:** Executes documentation generation, parses docstrings from source code, and processes internal links.
*   **Outputs:** Generates HTML-based documentation and static assets for web rendering.

#### 4. Dependencies
*   **Sphinx Extensions:**
    *   `sphinx.ext.autodoc`: Extracts documentation from docstrings.
    *   `sphinx.ext.napoleon`: Supports NumPy and Google-style docstrings.
    *   `sphinx.ext.viewcode`: Provides links to source code.
    *   `sphinx.ext.intersphinx`: Links to other project documentations.
    *   `sphinx.ext.autosummary`: Generates automatic function/class summary tables.
*   **Theme:** `furo` (a popular, responsive Sphinx theme).
*   **Notebook Handling:** `nbsphinx` (inferred from `nbsphinx_` settings).

#### 5. Analysis Methods
*   *Note: This is a configuration file and does not implement scientific/statistical methods itself.* However, it is set up to document a project that likely employs these methods, supported by the integration of Jupyter notebooks (via `nbsphinx`).

#### 6. Figures/Outputs
*   **Documentation Site:** Generates the final documentation web pages.
*   **Static Assets:** Includes an image (`image1630.png`) used as both the light/dark logo and the browser favicon.
*   **Source Code Links:** Provides direct links to the GitHub repository.

#### 7. Key Parameters
*   **`autosummary_generate`**: Enabled (`True`), meaning the build will automatically create summary pages for API members.
*   **`nbsphinx_execute`**: Set to `"never"`, ensuring that Jupyter notebooks are *not* re-executed during the documentation build to save time and prevent environmental errors.
*   **`nbsphinx_allow_errors`**: Set to `True`, allowing the build to proceed even if notebook cells contain errors.
*   **`html_theme_options`**: Contains custom UI elements, specifically the GitHub link configuration and logo paths.

---

## src/Waven/Analysis_Utils.py

This file, `src/Waven/Analysis_Utils.py`, serves as a utility library for analyzing neural response data, specifically focusing on receptive field mapping, stimulus correlation, and trial repeatability in the context of visual neuroscience experiments.

### 1. Purpose
The module provides a suite of statistical and visualization tools to correlate neural activity (spike/response data) with visual stimuli (wavelet/Gabor decompositions). It is designed to characterize neuronal receptive fields and assess the reliability of neural responses across experimental trials.

### 2. Key Functions/Classes
*   **`PearsonCorrelation` / `PearsonCorrelationPinkNoise`**: Core analysis functions that compute the correlation between stimulus features and neural responses to determine receptive field properties (azimuth, elevation, orientation, size).
*   **`repetability_trial3`**: Quantifies the consistency of neural responses across multiple experimental trials by splitting trials into sets and computing correlations.
*   **`convolve_Stim`**: Simulates neural response filters by convolving stimulus inputs with a temporal decay function (`Decay`).
*   **`orientation_correction_for_stretches`**: Adjusts orientation calculations to account for spatial distortion in visual screen coverage.
*   **`match_cumulative_cdf`**: A utility for histogram matching between two datasets.

### 3. Data Flow
*   **Input**: Receives multi-dimensional arrays representing neural responses (time x neurons), stimulus representations, and spatial metadata (neuron positions, screen coverage coordinates).
*   **Processing**: Uses GPU-accelerated operations (via `torch`) to calculate large-scale correlation matrices, followed by peak-finding algorithms to estimate receptive field parameters.
*   **Output**: Returns receptive field matrices, optimized parameters (xmax, ymax, omax, smax), and diagnostic plots visualizing these parameters mapped onto neuron positions.

### 4. Dependencies
*   **Scientific Stack**: `numpy`, `scipy` (stats, signal, interpolate, sparse), `pandas`.
*   **Machine Learning/Compute**: `torch` (for GPU-accelerated correlations), `scikit-learn` (clustering, decomposition).
*   **Imaging/Visualization**: `matplotlib`, `seaborn`, `skimage`, `cv2`, `tifffile`, `zarr`.

### 5. Analysis Methods
*   **Receptive Field Mapping**: Uses Pearson correlation between feature-space stimulus representations and neural temporal response vectors.
*   **Temporal Filtering**: Implements an exponential decay model for stimulus-response convolution.
*   **Coordinate Transformation**: Includes functions for Cartesian-to-Polar transformations (`cart2pol`) and orientation correction.
*   **Reliability Analysis**: Uses Pearson correlation of trial-averaged responses to assess signal-to-noise and consistency.

### 6. Figures/Outputs
*   **Spatial Heatmaps**: Scatter plots mapping receptive field parameters (azimuth, elevation, orientation, size) onto physical neural coordinates (using `jet`, `hsv`, and `coolwarm` colormaps).
*   **Diagnostic Plots**: Screen coverage visualizations and repeatability reliability plots.
*   **Variability Plots**: Line plots showing median responses with standard deviation shaded regions (`fill_between`).

### 7. Key Parameters
*   **`tau`**: Time constant for the exponential decay convolution.
*   **`nx`, `ny`**: Grid dimensions for azimuth and elevation mapping.
*   **`visual_coverage`**: Defined screen bounds in degrees for normalizing spatial coordinates.
*   **`sigmas`**: Standard deviations for Gabor filter approximations.
*   **`WAVEN_NO_PLOTS`**: Environment variable used to toggle plotting backends (Agg vs. TkAgg) for headless/server-side execution.

---

## src/Waven/LoadPinkNoise.py

This file, `src/Waven/LoadPinkNoise.py`, is a utility module for processing neural recording data and visual stimulus wavelets in the context of a neuroscience experiment pipeline.

### 1. Purpose
The file provides functions to load and transform wavelet coefficients for visual stimuli (pink noise) and synchronizes neuronal activity (calcium imaging data) with external experimental timelines (e.g., photo-diode signals, rotary encoder data).

### 2. Key Functions
*   **`load_wavelets`**: Processes raw wavelet coefficients, normalizing them and calculating phase differences to represent directional features.
*   **`load_stimulus`**: Loads and reformats precomputed wavelet data (`.npy`) into arrays suitable for downstream analysis or neural modeling.
*   **`load_stimulus_simple_cell` family**: Specialized loaders for loading different resolutions or slices of wavelet data (real/imaginary components) with optional downsampling.
*   **`loadExperiment`**: Orchestrates the alignment of neural calcium imaging data (Suite2p output) with experiment timelines, performs spike inference, and computes event-related responses.
*   **`align_rotary_encoder` / `align_datas`**: Utility functions to sync behavioral data (rotary encoder) and stimulus timing signals using threshold-based event detection on timeline files.

### 3. Data Flow
*   **Inputs**: Reads `.npy` files containing wavelet coefficients, Suite2p output directories (`stat.npy`, `F.npy`, `Fneu.npy`), and experiment timeline files (`.mat` or similar via `timelinepy`).
*   **Processing**: Applies signal processing techniques (Z-scoring, interpolation, resizing, phase-difference calculation) to harmonize disparate data streams (behavior, stimulus, and neural).
*   **Outputs**: Returns numpy arrays of processed neural response features, spike rates, or stimulus wavelet representations.

### 4. Dependencies
*   **Scientific Stack**: `numpy`, `matplotlib`, `skimage` (scikit-image), `torch`.
*   **Suite2p/Lab Utilities**: Imports internal modules (`cortex_lab_utils`, `timelinepy`, `utils`) suggesting integration with a specific lab's data handling infrastructure.
*   **Memory Management**: Uses `gc` (garbage collection) to manage high-memory overhead when loading large wavelet arrays.

### 5. Analysis Methods
*   **Wavelet Signal Processing**: Calculates phase differences between real/imaginary wavelet components to extract directional flow.
*   **Signal Normalization**: Employs Z-scoring and min-subtraction to standardize neural firing responses.
*   **Event-Related Interpolation**: Uses `utils.interp_event_responses` to map continuous neural activity to discrete experimental trial events.
*   **Spike Inference**: Performs crude spike deconvolution by subtracting neuropil signals (`F - 0.7 * Fneu`).

### 6. Figures/Outputs
*   Generates diagnostic plots using `matplotlib`:
    *   Visualizations of wavelet time-series after loading.
    *   Plots of `photoDiode` timeline data vs. frame timestamps to verify synchronization.
    *   Scatter plots comparing trial timing with neuronal response amplitudes.

### 7. Key Parameters
*   `n_frames`, `n_repeat`: Defines the temporal structure of the experimental trials.
*   `syncEcho_thresh`: The voltage threshold used to detect event triggers from the timeline's photodiode signal.
*   `downsampling`: A boolean flag used in various load functions to toggle resizing of wavelet arrays for memory efficiency.
*   `block_end`: A temporal offset used to exclude the initial segment of neural recordings.

---

## src/Waven/WaveletGenerator.py

This file, `src/Waven/WaveletGenerator.py`, provides a computational framework for generating Gabor filter libraries and applying wavelet decompositions to video stimuli, likely for use in neuroscience or computer vision research regarding visual receptive fields.

### 1. Purpose
This module generates multi-scale Gabor filter banks and performs wavelet transforms on downsampled video data. It is designed to extract visual features from stimulus movies to model or analyze spatial and temporal neuronal responses.

### 2. Key Functions/Classes
*   **`makeGaborFilter` / `makeGaborFilter3D`**: Generates individual 2D or 3D Gabor kernels based on spatial, frequency, orientation, and phase parameters.
*   **`makeFilterLibrary` / `makeFilterLibrary3D`**: Assembles collections of Gabor filters into structured multi-dimensional arrays (libraries) for efficient processing.
*   **`waveletTransform` / `waveletTransform3D`**: Executes the mathematical projection of a frame (or frame sequence) onto the Gabor filter library using PyTorch for hardware acceleration.
*   **`downsample_video_binary` / `downsample_video_uint`**: Pre-processing tools to convert raw video files into standardized downsampled arrays suitable for wavelet analysis.
*   **`waveletDecomposition`**: High-level wrapper to perform the full decomposition process across different filter scales and save the results.

### 3. Data Flow
*   **Input**: Raw video files (typically `.mp4`) and configuration lists for spatial/temporal parameters.
*   **Processing**:
    1.  Downsampling and resizing frames to a uniform grid (e.g., $54 \times 135$).
    2.  Converting video data to PyTorch tensors for GPU-based matrix multiplication against pre-computed filter libraries.
*   **Output**: Saved `.npy` files containing the filter libraries and the resulting Wavelet Transform (WT) coefficients.

### 4. Dependencies
*   **Core**: `numpy`, `scipy` (ndimage, io), `skimage` (transform, filters).
*   **Deep Learning**: `torch` (for GPU-accelerated tensor operations).
*   **Vision**: `cv2` (OpenCV) for video decoding.
*   **Visualization**: `matplotlib` for plotting kernels and results.

### 5. Analysis Methods
*   **Gabor Filtering**: Uses `skimage.filters.gabor_kernel` to create Gabor patches, serving as spatial filters to simulate receptive fields.
*   **Wavelet Decomposition**: Projects image data onto a library of Gabor basis functions to obtain coefficients representing spatial orientation and frequency content at specific points in the video.
*   **Dimensionality Reduction/Downsampling**: Uses `block_reduce` and `skimage.transform.resize` to normalize stimulus size.

### 6. Figures/Outputs
*   **Visualization**: The `makeGaborFilter` and `getTrueRF` functions include `matplotlib` logic to visualize the spatial layout of Gabor kernels and receptive field projections.
*   **Files**: Generates `.npy` binary arrays representing downsampled video, Gabor libraries, and the computed wavelet decomposition tensors.

### 7. Key Parameters
*   **`sigma`**: Standard deviation of the Gabor Gaussian envelope (defines filter size).
*   **`thetas`**: Orientations of the filter.
*   **`f` / `frequencies`**: Spatial frequencies of the filters.
*   **`tp_w`**: Number of temporal phases/steps (in 3D functions).
*   **`lx`, `ly`**: Spatial dimensions for downsampling and canvas generation.
*   **`phase`**: Phase offset for the Gabor kernel.

---

## src/Waven/__init__.py

Based on the content provided for `src/Waven/__init__.py`, here is the structured analysis:

### 1. Purpose
This file serves as the package initialization script for the `Waven` module. Its primary purpose is to mark the `Waven` directory as a Python package, allowing its submodules and functions to be imported by other parts of the repository.

### 2. Key Functions/Classes
*   **None**: The current file is empty (containing only comments/docstrings), meaning it does not define any classes or functions directly.

### 3. Data Flow
*   **None**: As an initialization file, it does not perform any data processing, reading, or writing.

### 4. Dependencies
*   **None**: It does not import any external libraries or internal repository files.

### 5. Analysis Methods
*   **N/A**: No scientific or statistical methods are implemented within this file.

### 6. Figures/Outputs
*   **None**: This file does not generate any plots, figures, or external outputs.

### 7. Key Parameters
*   **None**: There are no configurable parameters defined in this file.

***

**Note for the User:** If you intended for this file to expose specific API endpoints or class hierarchies from the `Waven` submodules (a common practice in scientific Python packages), you may need to add import statements to this file (e.g., `from .module_name import ClassName`). As it stands, this is a "blank" package initiator.

---

## src/Waven/config.py

This file, `src/Waven/config.py`, provides a robust configuration management system for the Waven analysis pipeline, bridging the gap between GUI-based string inputs and typed Python objects.

### 1. Purpose
The module acts as a validation and serialization layer, transforming loosely-typed string inputs (typically from a GUI text field) into strongly-typed dataclasses for use in research scripts and testing. It ensures that file paths are normalized and numeric parameters are correctly parsed into tuples, integers, or floats.

### 2. Key Functions/Classes
*   **`GaborConfig`**: A frozen dataclass storing parameters for the Gabor filter library (e.g., frequencies, phases, spatial dimensions).
*   **`AnalysisConfig`**: A comprehensive dataclass managing experimental parameters (e.g., screen resolution, frame rates, visual/analysis coverage, and path pointers).
*   **`PipelineConfig`**: The top-level container that orchestrates the merging of default parameters with user-provided mappings (or JSON files) to initialize the full experiment setup.
*   **Parsing Utilities (`parse_literal`, `_as_float_tuple`, etc.)**: Internal helpers that utilize `ast.literal_eval` to safely interpret string-based inputs as native Python data types.

### 3. Data Flow
*   **Reads**: Accepts raw mappings (dictionaries) where all values are strings, or JSON files.
*   **Processes**: Sanitizes strings, expands environment/user paths (e.g., `~`), validates types, and converts them into structured objects (`Path`, `Tuple`, `int`, `float`).
*   **Writes**: Provides a `to_gui_mapping()` method to convert the internal typed objects back into string-based dictionaries suitable for UI population.

### 4. Dependencies
*   **Standard Library**: `ast`, `json`, `os`, `pathlib`, `dataclasses`, `typing`.
*   **Third-party**: `numpy` (used for handling parameter arrays and mathematical properties of the configuration).

### 5. Analysis Methods
While primarily a configuration file, it embeds logic for experimental setup:
*   **Path Resolution**: Computes file system paths for experimental data (`experiment_dir`, `suite2p_dir`).
*   **Spatial Calculations**: Calculates properties like `screen_ratio`, `sigmas_deg` (degrees per pixel conversion), and `coverage_ratios` (comparing analysis windows to visual stimuli windows).
*   **Stimulus Timing**: Computes `frames_per_minute` based on frequency (Hz) input.

### 6. Figures/Outputs
*   This module does not generate visual plots or figures directly. Its output is the **validated configuration state** that drives downstream image processing or analysis modules.

### 7. Key Parameters
*   **Gabor Settings**: `N_thetas`, `Sigmas`, `Frequencies`, `Phases`, `NX`/`NY`.
*   **Analysis/Experiment Settings**: `Experiment Info` (Mouse ID, Date, Number), `Visual/Analysis Coverage` (coordinate bounding boxes), `Hz`, `Number of Frames`, and various file system paths (`Movie Path`, `Library Path`, `Spks Path`).

---

## src/Waven/pipeline.py

### Analysis of `src/Waven/pipeline.py`

#### 1. Purpose
This file provides a high-level orchestration layer for the Waven analysis pipeline, abstracting complex numerical workflows into modular, reusable steps. It manages the end-to-end processing of neuronal spike data and stimulus wavelets to facilitate receptive field (RF) mapping and nonlinear modeling.

#### 2. Key Functions/Classes
*   **Data Classes (`SpikeData`, `WaveletData`, `RFAnalysisResult`, etc.)**: Structured containers for passing results between pipeline stages.
*   **`run_pipeline`**: The primary entry point that coordinates the execution of various analysis steps (Gabor library generation, wavelet decomposition, RF analysis, and modeling).
*   **`create_gabor_library`**: Generates and saves the Gabor filter bank parameters.
*   **`prepare_stimulus_wavelets`**: Processes video stimuli by downsampling and computing wavelet decompositions.
*   **`load_spikes_and_positions`**: Imports spike trains and neuron spatial coordinates from `suite2p` output or `.npy` files.
*   **`run_rf_analysis`**: Calculates repeatability and receptive field correlations.
*   **`run_simple_model` / `run_full_model`**: Executes fast and high-granularity nonlinear models to predict neuronal firing.

#### 3. Data Flow
*   **Reads**: Raw stimulus movies (video), `suite2p` directory outputs (spike data), and configuration objects (`AnalysisConfig`, `GaborConfig`).
*   **Processes**: 
    1.  Downsamples stimulus video and decomposes it into wavelet phases.
    2.  Loads and validates spike data and neuron spatial coordinates.
    3.  Performs spatial smoothing of neuron position parameters.
    4.  Runs statistical models linking stimulus wavelets to neuronal responses.
*   **Writes**: Saves `.npy` files for the Gabor filter library, downsampled video, and model results (parameters, metrics, predictions).

#### 4. Dependencies
*   **Internal**: Imports from local modules `WaveletGenerator`, `LoadPinkNoise`, `Analysis_Utils`, and `config`.
*   **External**: `numpy` (core numerical operations), `scipy.spatial.cKDTree` (spatial smoothing), and `pathlib` (filesystem operations).

#### 5. Analysis Methods
*   **Wavelet Decomposition**: Used for stimulus feature extraction.
*   **Receptive Field (RF) Estimation**: Employs Pearson correlation between stimulus wavelets and spike responses.
*   **Spatial Smoothing**: Applies a K-Nearest Neighbor median filter to neuron position parameters within a specified radius (default 30µm).
*   **Nonlinear Modeling**: Uses `Analysis_Utils` to derive best-fit parameters for stimulus-response models, involving interpolation and metric calculation.

#### 6. Figures/Outputs
*   **Figures**: Generates RF plots and tuning curves using `Analysis_Utils.Plot_RF` and `PlotTuningCurve` when `plotting=True`.
*   **PipelineOutputs**: A final object containing paths, spike data, RF analysis results, and model-specific metrics/predictions.

#### 7. Key Parameters
*   **`threshold`**: Spike detection threshold for `suite2p` data.
*   **`radius_um`**: Distance used for smoothing preferred neuron positions.
*   **`frames_per_minute`**: Scaling factor derived from frame rate for model temporal calculations.
*   **`chunk_size`**: Memory management parameter for processing large stimulus video files.
*   **Model flags (`run_gabor`, `run_wavelets`, `run_model`, `run_full`)**: Boolean flags to toggle specific stages of the pipeline.

---

## src/Waven/suite2p/__init__.py

Based on the provided content of `src/Waven/suite2p/__init__.py`, here is the structured summary:

### 1. Purpose
This file serves as the package initialization file for the `suite2p` module within the `Waven` repository. Its primary purpose is to define the namespace for the package, allowing internal modules to be imported more conveniently.

### 2. Key Functions/Classes
*   **None**: The file currently contains no code, function definitions, or class declarations.

### 3. Data Flow
*   **None**: As an empty initialization file, it does not currently handle, read, or write data.

### 4. Dependencies
*   **None**: There are no external library imports or internal package references visible in this file.

### 5. Analysis Methods
*   **N/A**: No scientific or statistical methods are implemented in this file.

### 6. Figures/Outputs
*   **None**: This file does not generate any figures, plots, or data outputs.

### 7. Key Parameters
*   **None**: There are no configurable parameters defined within this file.

***

**Analyst Note:** This file is currently a "blank" package initiator. In Python development, this is often used simply to mark the `suite2p` directory as a package for the Python interpreter. If the intent is to expose specific functionality from the underlying `suite2p` implementation (which appears to be a wrapper or integration layer for the well-known *suite2p* calcium imaging analysis pipeline), this file would typically contain `from .module import *` statements.

---

## src/Waven/suite2p/utils/cortex_lab_utils.py

This analysis provides a structured summary of `src/Waven/suite2p/utils/cortex_lab_utils.py`, a utility script designed for file management and experiment parsing in the context of Cortex Lab neurophysiology data.

### 1. Purpose
This file provides a suite of helper functions to locate experiment data files within standardized directory structures and parse experiment log files. It acts as a middleware for retrieving paths to multi-modal neurophysiological data (e.g., Timeline, Protocol, suite2p, and Facemap files) based on subject and experiment identifiers.

### 2. Key Functions/Classes
*   **`expt_dirs()`**: Returns a list of predefined root paths where experimental data is stored on network drives or local systems.
*   **`get_subject_log(subject)`**: Locates and reads the raw text log file associated with a specific animal subject.
*   **`parse_log(log, subject)`**: Parses the raw text log into a structured list of dictionaries, extracting experiment metadata like start/end times, duration, and parameter files used.
*   **`find_expt_file(expt_info, file, dirs, verbose)`**: Iterates through defined directories to find the absolute path of a specific file type (e.g., `Timeline.mat`, `suite2p` folder) for a given experiment.
*   **`get_expt_tuple_from_df(exps_df, overall_id)`**: Extracts a specific experiment’s metadata tuple (subject, date, exp_num) from a pandas DataFrame of experiments.

### 3. Data Flow
*   **Input**: Takes subject IDs, experiment dates, and experiment numbers as inputs.
*   **Process**: Performs string manipulation to generate file path templates; performs file system lookups across defined mount points; parses unstructured `.txt` log files into structured dictionaries.
*   **Output**: Returns absolute system file paths or structured experiment metadata (in list/tuple/dictionary format).

### 4. Dependencies
*   **Standard Python Libraries**: `os` (specifically `join`, `exists`), `datetime`.
*   **Implicit Dependencies**: Assumes the existence of specific directory structures (e.g., `Subject/Date/Number/`) and expects data files generated by standard Cortex Lab acquisition pipelines (e.g., `Timeline.mat`, `Block.mat`).

### 5. Analysis Methods
*   **Log Parsing**: Implements basic text pattern matching to identify experiment lifecycle markers such as "Starting Series," "Loaded parameter file," "Completed," and "Interrupted." 
*   **Temporal Logic**: Calculates experiment duration by converting time strings to `datetime` objects and finding the difference in seconds.

### 6. Figures/Outputs
*   **Outputs**: The script does not generate plots or visualization figures. It outputs file system paths (as strings) and structured Python objects (lists/dictionaries of experiment metadata).

### 7. Key Parameters
*   **`dirs`**: A hardcoded global list of string paths defining where experiment data resides.
*   **`file_names` (Dictionary)**: A lookup table within `find_expt_file` mapping shorthand keys (e.g., 'eye_video', 'suite2p') to the specific naming conventions used for the lab's raw data files.

---

## src/Waven/suite2p/utils/mpeppy.py

### Code Analysis: `src/Waven/suite2p/utils/mpeppy.py`

#### 1. Purpose
This module provides utility functions for parsing and loading experimental metadata from `mpep` (Matlab-based stimulus presentation) `.mat` files. It bridges stimulus protocol parameters with time-series data (Timeline) to align experimental events with neural recordings.

#### 2. Key Functions
*   **`load_protocol(expt_info_or_filepath, dirs)`**: Loads and parses a `Protocol.mat` file, returning a structured numpy array representation of the experiment’s stimulus parameters.
*   **`get_stim_times(...)`**: Synchronizes stimulus onset/offset events by aligning UDP message timestamps from the experimental software with photodiode (PD) flip signals stored in `Timeline` data.
*   **`get_sequence(...)`**: Decodes the presentation order of specific stimulus parameters (e.g., orientation, contrast) by reordering the protocol data based on sequence numbers.

#### 3. Data Flow
*   **Input**: Takes experimental identifying tuples (subject, date, experiment number) or file paths.
*   **Processing**:
    *   Loads Matlab structures (`.mat`) using `scipy.io`.
    *   Reads `Timeline` data to extract UDP events and physical PD flip signals.
    *   Aligns stimulus timing logic (UDP events) to the precise timing of PD flips.
    *   Reconstructs the stimulus parameter sequence by mapping MATLAB-indexed sequence arrays to the trial sequence.
*   **Output**: Returns synchronized timestamps (N x 2 arrays) and ordered stimulus parameter matrices.

#### 4. Dependencies
*   **External**: `scipy.io`, `numpy`, `matplotlib.pyplot`.
*   **Internal**: 
    *   `.timelinepy`: For loading Timeline data and aligning events to PD flips.
    *   `.cortex_lab_utils`: For resolving file paths based on experimental metadata.

#### 5. Analysis Methods
*   **Temporal Alignment**: Uses custom alignment logic (`tl.align_to_pd`) to map "soft" software-based UDP timestamps to "hard" physical hardware events (photodiode flips), minimizing drift and latency errors common in stimulus delivery.
*   **Indexing Conversion**: Handles MATLAB-to-Python index conversion (1-based to 0-based), which is critical for correctly parsing the stimulus sequence arrays exported from the original `mpep` environment.

#### 6. Figures/Outputs
*   **Plots**: Contains commented-out `matplotlib` code intended for debugging stimulus alignment (e.g., plotting raw photodiode signals against calculated stimulus onset times). 
*   **Data Outputs**: Returns formatted `numpy.ndarray` structures representing experimental time segments and stimulus parameter sequences.

#### 7. Key Parameters
*   **`medfilt`**: Integer used for median filtering during photodiode alignment to reduce noise.
*   **`type`**: Specifies the type of experimental events to extract, supporting either `'stim'` (stimulus) or `'block'` (block-level markers).
*   **`all_flips`**: A boolean flag to determine whether the function should return only onset/offset times or all intermediate flip events within the stimulus duration.

---

## src/Waven/suite2p/utils/timelinepy.py

### Analysis of `src/Waven/suite2p/utils/timelinepy.py`

This file provides a collection of utility functions designed to parse and process experimental "Timeline" data files generated in MATLAB, typically used in neuroscience experiments involving stimulus presentation and hardware logging.

#### 1. Purpose
The module acts as an interface to extract, format, and align raw experimental data from `.mat` Timeline files. It provides utilities to synchronize hardware-recorded event times (such as photodiode flashes) with stimulus-related computer timestamps.

#### 2. Key Functions
*   **`load_timeline(expt_info_or_filepath)`**: Loads a MATLAB `.mat` file and returns the structure as a NumPy-friendly array.
*   **`sample_times(timeline)`**: Extracts the raw data acquisition timestamps.
*   **`get_input_names(timeline)` / `get_samples(...)`**: Retrieves specific hardware input signal names and their corresponding trace values.
*   **`align_to_pd(computer_times, edge, timeline, ...)`**: Synchronizes external "computer times" (like stimulus starts) to the precise photodiode flip times recorded by the hardware.
*   **`get_udp(timeline)` / `get_ball(tl)`**: Extracts specific communication data (UDP events) and spherical treadmill ("ball") movement data from the timeline structure.

#### 3. Data Flow
*   **Input**: Takes experimental info (metadata) or file paths to MATLAB `.mat` files containing DAQ data, stimulus event timestamps, and hardware inputs.
*   **Processing**: Applies noise filtering (median filter) and clustering (K-Means) to interpret hardware signals, then maps timestamps to events based on defined temporal logic (before/after).
*   **Output**: Returns structured NumPy arrays containing aligned event times, hardware traces, or parsed treadmill kinematics.

#### 4. Dependencies
*   **External**: `scipy.io` (MATLAB file loading), `scipy.signal` (median filtering), `sklearn.cluster` (KMeans for signal thresholding), and `numpy`.
*   **Internal**: `cortex_lab_utils` (used via `.clu` for finding specific experiment files within a directory tree).

#### 5. Analysis Methods
*   **Median Filtering**: Used to smooth raw photodiode signals to minimize high-frequency noise before thresholding.
*   **K-Means Clustering**: Employed as an automated method to determine the "up" and "down" states of the photodiode, allowing the algorithm to dynamically calculate a signal flip threshold rather than relying on a hardcoded value.
*   **Temporal Alignment**: Uses boolean search and nearest-neighbor logic (`np.amin`/`np.amax`) to align event times to physical signal flips.

#### 6. Figures/Outputs
*   The script does not explicitly generate graphical plots. Its output consists primarily of numerical data structures (NumPy arrays) representing cleaned, synchronized time-series data for downstream scientific analysis (e.g., neural activity correlation).

#### 7. Key Parameters
*   **`medfilt`**: Integer representing the size of the median filter window applied to the photodiode signal.
*   **`edge`**: A tuple defining the temporal relationship ('after' or 'before') between recorded event timestamps and physical hardware transitions.
*   **`all_flips`**: A boolean flag that, when active, returns the full set of physical signal transitions occurring between a pair of event times.

---

## src/Waven/suite2p/utils/twophopy.py

### Analysis of `src/Waven/suite2p/utils/twophopy.py`

#### 1. Purpose
This file provides a collection of utility functions designed to parse, load, and organize two-photon imaging data processed by the **suite2p** pipeline. It bridges the gap between raw suite2p outputs (e.g., `spks.npy`, `Fall.mat`, `ops.npy`) and experiment-specific metadata, facilitating the extraction of neural activity across multiple planes.

#### 2. Key Functions/Classes
*   **`load_suite2p`**: The core data loader; handles reading `.npy` or `.mat` files from suite2p outputs, supporting optional memory mapping.
*   **`load_experiment`**: Aggregates data (spikes, fluorescence, metadata) across multiple imaging planes for a specific experiment, filtering for "cells" based on suite2p classification.
*   **`get_plane_times`**: Calculates the precise acquisition timestamps for each imaging plane using timeline information.
*   **`find_expt_frames`**: Identifies which specific temporal frames in the suite2p output correspond to a particular experimental recording segment.
*   **`update_iscell_mat`**: Synchronizes manual curation results from `iscell.npy` back into `Fall.mat` files.

#### 3. Data Flow
*   **Reads**: Suite2p output files (`iscell.npy`, `spks.npy`, `ops.npy`, `stat.npy`, `Fall.mat`) and timeline data.
*   **Processes**: Performs alignment of frame indices across planes, filtering of ROIs (cells vs. noise), and timestamp extraction based on metadata.
*   **Writes**: Saves updated MATLAB files (`Fall_updated.mat`) containing corrected cell-selection masks.

#### 4. Dependencies
*   **Standard Libs/Scientific**: `os.path`, `numpy`, `scipy.io`.
*   **Repository Internal**: 
    *   `.timelinepy` (likely handles synchronization of experiment timing).
    *   `.cortex_lab_utils` (manages file system paths for experiments).

#### 5. Analysis Methods
*   **Temporal Alignment**: Uses `np.diff` on neural frames to identify acquisition transitions and map frames to specific recording times.
*   **Concatenation/Aggregation**: Flattens multi-plane data structures into unified dictionaries, allowing the user to treat multi-plane recordings as contiguous data objects.
*   **Masking**: Applies boolean masks (`iscell`) to stat and spike arrays to prune non-cell ROIs from downstream analysis.

#### 6. Figures/Outputs
*   **Outputs**: Returns a structured dictionary (`expt_dict`) containing `ops` (metadata), `stat` (ROI spatial info), `spks`/`F` (neural data), `cell_plane` (plane mapping), and `plane_times`.
*   **Plots**: None.

#### 7. Key Parameters
*   **`expt_info`**: A tuple or list containing `(subject name, experiment date, experiment number)`.
*   **`iscell_only`**: A boolean flag determining whether to filter outputs to only include ROIs identified as cells by the suite2p pipeline.
*   **`memmap_on`**: A boolean that enables memory mapping, critical for handling large datasets without loading them entirely into RAM.
*   **`plane`**: Specifies the imaging plane index or defaults to `'combined'`.

---

## src/Waven/suite2p/utils/utils.py

This file provides a collection of utility functions for processing, normalizing, and extracting event-related neural activity data, specifically designed for data originating from MATLAB-based imaging suites (likely associated with the `suite2p` pipeline).

### 1. Purpose
This module serves as a bridge for loading, cleaning, and formatting calcium imaging data from MATLAB files into structured Python formats. It provides tools for stimulus alignment, z-score normalization, and statistical analysis of neural responses to experimental events.

### 2. Key Functions/Classes
*   **`load_data`**: Imports data from a MATLAB HDF5 file, filters out specific planes, performs z-score normalization, and organizes stimulus and cell traces into a dictionary.
*   **`get_stim_response_matrix`**: Aligns neural activity to stimulus onset, creating a response matrix for each trial.
*   **`interp_event_responses` / `extract_event_responses`**: Tools for slicing or interpolating neural activity around arbitrary event timestamps.
*   **`get_response_per_stim`**: Computes mean and individual trial responses across different stimuli and contrast levels.
*   **`zscore` / `zscore_ndim` / `standardize`**: Statistical normalization functions for multidimensional neural arrays.
*   **`angle` / `angle_unsigned`**: Geometry utilities for calculating angular relationships between neural vector populations.

### 3. Data Flow
*   **Input**: Reads HDF5 files containing `expt` structures (standard output from specific MATLAB research pipelines).
*   **Processing**:
    *   Trims raw data to synchronize samples across planes.
    *   Maps raw neural traces to stimulus-aligned windows.
    *   Applies statistical filters and interpolations.
*   **Output**: Returns processed NumPy arrays (activity matrices), dictionaries containing experimental metadata, or scalar metrics (e.g., angles between vectors).

### 4. Dependencies
*   **External**: `numpy` (as `n`), `scipy` (specifically `convolve1d`, `gaussian_filter1d`, `interp1d`), `matplotlib.pyplot`.
*   **Internal**: Depends on local modules `timelinepy`, `cortex_lab_utils`, and `twophopy`.

### 5. Analysis Methods
*   **Normalization**: Z-scoring (global or windowed/moving) and Min-Max scaling.
*   **Temporal Alignment**: Uses linear interpolation (`interp1d`) to estimate neural activity at exact event times when sampling rates are non-synchronous.
*   **Vector Geometry**: Uses dot products and determinants to compute signed/unsigned angles between high-dimensional neural activity vectors.
*   **Machine Learning Prep**: `split_test_train` provides basic data partitioning for predictive modeling.

### 6. Figures/Outputs
*   While the module contains `import matplotlib`, the functions primarily return raw numerical data structures (`ndarray`, `dict`) intended for downstream analysis or visualization in other scripts. No explicit plotting output functions are defined in the provided snippet.

### 7. Key Parameters
*   **`exclude_planes`**: Filters out flyback or noisy imaging planes during load.
*   **`post_stim_wait_ms` / `window_ms`**: Defines the temporal window for stimulus-aligned response extraction.
*   **`interp_kind`**: Determines the interpolation method (e.g., 'linear') for non-aligned neural data.
*   **`n_responses_per_stim`**: Defines the required number of trials for stimulus response averaging.

---

## src/Waven/wavelet_io.py

This analysis provides a structured summary of `src/Waven/wavelet_io.py`, a script designed for high-performance data migration within a scientific pipeline.

### 1. Purpose
This script facilitates the conversion of large-scale video wavelet coefficients stored as memory-mapped NumPy (`.npy`) files into compressed, chunked Zarr (`.zarr`) archives. This process is intended to improve storage efficiency and allow for more flexible, out-of-core data access for downstream analysis.

### 2. Key Functions/Classes
This script is written as a procedural batch job rather than using modular functions. Key objects used include:
*   **`zarr.open`**: Used to initialize high-performance array structures on disk.
*   **`numcodecs.Blosc`**: Configures the compression algorithm (Zstandard with bit-shuffling).
*   **`numpy.load` (with `mmap_mode="r"`)**: Enables memory-efficient reading of large files without loading the entire dataset into RAM.
*   **`tqdm.trange`**: Provides a visual progress bar for the iteration loop.

### 3. Data Flow
1.  **Read**: Opens two large `.npy` files (imaginary and real wavelet components) from a source directory using memory mapping.
2.  **Process**: Iterates through the data in temporal chunks (size defined by `FRAMES_PER_MINUTE`).
3.  **Write**: Persists these chunks into two destination `.zarr` files on disk, applying Zstd compression during the write process.

### 4. Dependencies
*   **`numpy`**: Core array handling and memory mapping.
*   **`zarr`**: Storage format for chunked, compressed, N-dimensional arrays.
*   **`numcodecs`**: Provides the Blosc compression engine.
*   **`tqdm`**: Command-line progress visualization.
*   **`os`**: Path manipulation and file system interaction.

### 5. Analysis Methods
*   **Chunking Strategy**: The script uses a specific 6D chunking strategy `(FRAMES_PER_MINUTE, 1, 1, 8, 5, 4)` optimized for temporal access, suggesting the underlying data is high-dimensional (likely spatio-temporal wavelet coefficient data).
*   **Out-of-Core Processing**: By processing data in `t_chunk` intervals, the script prevents memory overflow, allowing the handling of datasets significantly larger than the available system RAM.

### 6. Figures/Outputs
*   **No visualizations (plots/figures)** are generated.
*   **Primary Output**: Two `.zarr` directories containing compressed binary data, suitable for high-performance scientific computing.
*   **Console Output**: Provides progress tracking, array dimensions, data types, and status updates.

### 7. Key Parameters
*   **`chunks`**: Set to `(1800, 1, 1, 8, 5, 4)` (based on 30Hz * 60s), optimizing for temporal streaming.
*   **`compressor`**: Uses `Blosc(cname="zstd", clevel=3, shuffle=Blosc.BITSHUFFLE)`. This is a high-performance configuration that balances compression ratio and speed, specifically optimized for numeric data via `BITSHUFFLE`.
*   **`HZ`**: Defined as 30, determining the temporal resolution of the chunking.

---

## src/Waven/zarr_compat.py

### Code Analysis: `src/Waven/zarr_compat.py`

#### 1. Purpose
This utility module provides a robust interface for loading large array datasets from disk by prioritizing the `zarr` format when available, falling back to `numpy` memory-mapped loading when necessary. It serves as an abstraction layer to ensure high-performance I/O for scientific data processing.

#### 2. Key Functions/Classes
*   **`load_array(path, ...)`**: The primary public API. It intelligently selects the loader (Zarr vs. Numpy) based on file existence, availability of the Zarr library, and user preferences.
*   **`_is_zarr_dir(path)`**: A helper function that validates if a directory is a valid Zarr store by checking for the presence of metadata files (`.zarray` or `.zgroup`).

#### 3. Data Flow
*   **Input**: Takes a file path string (either `.npy` or `.zarr`) and optional configuration parameters.
*   **Processing**:
    1.  Checks if `allow_pickle` is set (skips Zarr if true).
    2.  If `prefer_zarr` is True and `HAS_ZARR` is verified, it attempts to identify a Zarr store at the path or as a sibling to a `.npy` file.
    3.  If Zarr loading fails or is not applicable, it falls back to `np.load` (initially with `mmap_mode`, and then without if the first attempt fails).
*   **Output**: Returns either a `zarr.Array/Group` object or a `numpy.ndarray` (or memmap).

#### 4. Dependencies
*   **Standard Library**: `os`, `logging`, `typing`.
*   **External Libraries**: 
    *   `numpy` (essential for array loading and memory mapping).
    *   `zarr` (optional dependency handled via a `try-except` import block).

#### 5. Analysis Methods
*   This module does **not implement scientific or statistical methods**; it is purely an I/O compatibility and infrastructure utility designed to optimize data access performance in a research computing environment.

#### 6. Figures/Outputs
*   None. The file is strictly for data ingestion.

#### 7. Key Parameters
*   **`path`**: The file system location of the array.
*   **`prefer_zarr`**: A boolean flag to toggle the attempt to load as Zarr (default: `True`).
*   **`mmap_mode`**: Specifies the memory-mapping mode for `numpy.load` (e.g., `'r'`, `'r+'`), which is crucial for handling large datasets that do not fit into RAM.
*   **`allow_pickle`**: Boolean to enable/disable pickled object loading; defaults to `False` for security and to maintain Zarr compatibility.
*   **`zarr_kwargs`**: A dictionary to pass extra arguments directly to `zarr.open`.
*   **`raise_on_error`**: If `True`, exceptions during file loading are propagated; otherwise, the function returns `None`.

---

## src/Waven/zebraGUI.py

This file, `src/Waven/zebraGUI.py`, serves as the graphical user interface (GUI) and controller for analyzing visual neural data, specifically focusing on wavelet-based decomposition of stimulus movies and mapping neuronal responses to visual stimuli.

### 1. Purpose
The script provides a `tkinter`-based interface to manage Gabor filter library generation, process video stimuli via wavelet decomposition, and perform interactive visualization of neuronal tuning properties (receptive fields, orientation, and size tuning).

### 2. Key Functions/Classes
*   `run(param_defaults, gabor_param)`: The primary entry point that initializes the GUI, setting up input fields for analysis and Gabor parameters.
*   `create_gabor()`: Generates and saves a library of Gabor filters based on user-defined frequencies, phases, and spatial dimensions.
*   `run_wavelet()`: Handles the downsampling of stimulus movies and performs the wavelet decomposition to create feature vectors.
*   `plot_data()`: The core analysis engine; it loads spike data, aligns it with stimulus data, calculates receptive fields/tuning curves, and renders interactive `matplotlib` plots within the GUI.
*   `RedirectText` (Nested Class): Redirects standard output (e.g., print statements) to a text widget within the GUI for user feedback.

### 3. Data Flow
*   **Reads**: Raw stimulus video files (`.mp4`), pre-processed neural spike data (`spks.npy`), or Suite2p output folders.
*   **Processes**: Downsamples video frames, performs 2D wavelet decomposition, computes spike-triggered averages or correlations, and calculates neuronal tuning metrics.
*   **Writes**: Generates `.npy` files for Gabor libraries, downsampled video representations, and wavelet decomposition outputs.

### 4. Dependencies
*   **Standard Python**: `tkinter`, `os`, `sys`, `gc`.
*   **Data Science**: `numpy`, `matplotlib`.
*   **Internal Repository**: `WaveletGenerator`, `LoadPinkNoise`, `Analysis_Utils`, and `config`.

### 5. Analysis Methods
*   **Wavelet Decomposition**: Uses Gabor-based wavelet transforms to decompose visual stimuli.
*   **Neural Analysis**: 
    *   Computes spike train repeatability (`repetability_trial3`).
    *   Calculates neuronal skewness for quality control.
    *   Constructs 2D Receptive Fields (RF) and extracts tuning curves for elevation, azimuth, orientation, and stimulus size.

### 6. Figures/Outputs
The GUI generates an interactive dashboard containing:
*   **Scatter Plot**: Shows neuron positions within the brain (um).
*   **Spike Train Plot**: Shows mean activity of selected neurons.
*   **Tuning Panels**: 5-column plot showing the 2D RF, Elevation tuning, Azimuth tuning, Orientation tuning, and Size tuning.

### 7. Key Parameters
*   **Gabor Params**: `N_thetas`, `Sigmas` (filter width), `Frequencies`, `Phases`, `NX`/`NY` (spatial resolution).
*   **Alignment/Analysis**: `Visual/Analysis Coverage` (degrees), `Resolution` (µm/pixel), `Block End`, `Number of Planes`, `Number of Frames`.
*   **File Paths**: `Movie Path`, `Library Path`, `Spks Path`.

---

## src/waven/__init__.py

This file, `src/waven/__init__.py`, serves as the **public-facing API entry point** for the `waven` package, facilitating a clean import structure for end-users while managing lazy loading of submodules.

### 1. Purpose
This file consolidates the core functionality of the `waven` package—primarily used for analyzing neuronal spike data and wavelet-based modeling—into a single namespace. It implements lazy loading for submodules to optimize package startup time and exposes essential configuration and processing utilities.

### 2. Key Functions/Classes
*   **Configurations**: `AnalysisConfig`, `GaborConfig`, `PipelineConfig` (data structures for setting up analysis parameters).
*   **Pipeline Control**: `run_pipeline`, `run_full_model`, `run_simple_model`, `run_rf_analysis` (execution entry points for modeling workflows).
*   **Data Handling**: `load_spikes_and_positions`, `load_coarse_wavelets`, `prepare_stimulus_wavelets` (IO and preprocessing functions).
*   **Utilities**: `create_gabor_library`, `smooth_best_positions`.
*   **Result Structures**: `PipelineOutputs`, `RFAnalysisResult`, `SimpleModelResult`, `SpikeData`, `WaveletData`.

### 3. Data Flow
*   **Input**: Reads spike timing and neuronal position data, stimulus wavelet representations, and configuration objects.
*   **Processing**: Orchestrates the transformation of raw spike data into wavelet-based receptive field (RF) models through defined pipelines.
*   **Output**: Produces structured result objects (`Result` classes) containing model fits, wavelet coefficients, and analysis diagnostics.

### 4. Dependencies
*   **Standard Library**: `importlib` (for lazy loading).
*   **Package Metadata**: `importlib.metadata` (or `importlib_metadata` for older Python versions) to manage the package version.
*   **Internal**: `src/waven/config.py` and `src/waven/pipeline.py`.

### 5. Analysis Methods
*   **Receptive Field (RF) Analysis**: Implements methods for mapping neuronal responses, likely using Gabor-based wavelet decomposition.
*   **Modeling**: Supports both "simple" and "full" model architectures for spike train analysis.
*   **Smoothing/Preprocessing**: Includes routines for refining positional estimates (`smooth_best_positions`).

### 6. Figures/Outputs
*   While this file does not generate plots directly, it exposes the `gui` submodule (lazy-loaded), suggesting that the package provides interactive visualization or inspection tools for the analysis results.

### 7. Key Parameters
*   Defined primarily within `PipelineConfig` and `GaborConfig` (which are imported here), though the specific values are configurable by the user during the instantiation of these objects in their research scripts.

---

## src/waven/analysis_utils.py

### Code Analysis: `src/waven/analysis_utils.py`

This file serves as a structural entry point for the `waven` analysis module, managing package naming conventions and visibility for the research repository.

---

#### 1. Purpose
This file acts as a public-facing interface (or namespace wrapper) that maps the lowercase import `waven.analysis_utils` to the internal, legacy module `Waven.Analysis_Utils`. It enables cleaner syntax for researchers importing analysis tools into their workflows.

#### 2. Key Functions/Classes
*   **Imported Utilities**: By using `from Waven.Analysis_Utils import *`, this file exposes all functions and classes defined in the internal legacy module. 
*   **`PlotTuningCurve`**: Explicitly highlighted in the documentation as a key class, likely responsible for generating neural or behavioral tuning curve visualizations.

#### 3. Data Flow
*   **Reads**: Imports all members from `Waven.Analysis_Utils`.
*   **Processes**: Serves as a pass-through layer; does not contain raw data processing logic itself.
*   **Writes**: Does not perform I/O operations directly, but facilitates the execution of analysis functions that typically output to standard file formats (CSV, PNG, etc.) or Python data structures.

#### 4. Dependencies
*   **Internal**: `Waven.Analysis_Utils` (The source module for the analysis functions).
*   **Language Features**: `__future__.annotations` (Ensures Python 3.7+ compatibility for type hinting).

#### 5. Analysis Methods
*   *Note*: As this file is a wrapper, the specific statistical/scientific methods (e.g., curve fitting, Fourier analysis, or statistical significance testing) are inherited from `Waven.Analysis_Utils`. Refer to the source module for specific implementations.

#### 6. Figures/Outputs
*   While this file does not generate plots directly, it exposes the plotting utilities (e.g., `PlotTuningCurve`) used by researchers to visualize experimental data (likely related to wave-based or neural signal analysis).

#### 7. Key Parameters
*   *Note*: No parameters are defined in this file. Configuration is handled by the underlying functions imported from `Waven.Analysis_Utils`.

---

### Analyst's Note:
This file follows a common pattern in scientific software development where "refactoring without breaking changes" is required. It allows the research team to maintain backward compatibility with legacy scripts that rely on the `Waven` (uppercase) namespace while encouraging the use of more modern, PEP-8 compliant `waven` (lowercase) imports.

---

## src/waven/config.py

This file acts as the **public-facing interface** for the configuration module of the Waven research software, likely used for wave-based signal processing or analytical modeling.

### 1. Purpose
This file serves as a facade, aggregating and re-exporting core configuration structures and helper functions from the internal `Waven.config` module. It simplifies the API for end-users by providing a centralized entry point for managing analysis, Gabor filter, and pipeline configurations.

### 2. Key Functions/Classes
*   **`AnalysisConfig` / `GaborConfig` / `PipelineConfig`**: Data models (likely Pydantic or dataclass-based) that define the structure and constraints for experimental parameters.
*   **`default_pipeline_config()`**: A factory function that initializes a pre-defined configuration instance with standard settings.
*   **`parse_literal` / `parse_path` / `parse_optional_path`**: Utility functions designed to validate and sanitize input configuration values, particularly file system paths and literal settings.

### 3. Data Flow
*   **Reads**: Imports configuration schema and default values from the internal `Waven.config` module.
*   **Processes**: Acts as an exposure layer; it does not perform logic but provides the tools for users to define, validate, and pass configuration objects into the rest of the Waven pipeline.
*   **Writes**: Does not perform direct writes, though the `parse_path` utilities facilitate file-based data ingestion.

### 4. Dependencies
*   **Internal**: `Waven.config` (the primary logic/implementation module).
*   **Language**: Relies on `typing` (via `from __future__ import annotations`) for modern Python type hinting.

### 5. Analysis Methods
*   **Signal Processing**: By exporting `GaborConfig`, the module implicitly supports **Gabor wavelet-based analysis**, a common method for time-frequency signal decomposition in scientific research.

### 6. Figures/Outputs
*   None. This file contains configuration schemas, not execution logic for plotting or report generation.

### 7. Key Parameters
The file exposes two sets of defaults:
*   **`DEFAULT_ANALYSIS_PARAMS`**: Likely covers parameters like sampling rates, frequency bands, or window sizes for analysis.
*   **`DEFAULT_GABOR_PARAMS`**: Specific parameters for Gabor filters, such as center frequency, bandwidth, and orientation, standard in image/signal processing research.

---

## src/waven/gui.py

This file serves as a thin wrapper and public API entry point for the Waven graphical user interface.

### 1. Purpose
This file acts as the primary interface for users to launch the Waven GUI. It abstracts the underlying package structure to provide a clean import path for external users.

### 2. Key Functions/Classes
*   **`run()`**: Imported from `Waven.zebraGUI`; this function triggers the initialization and display of the main graphical interface.

### 3. Data Flow
*   **Input**: N/A (The file itself contains no direct data processing logic).
*   **Processing**: Acts as a pass-through to initialize the GUI event loop.
*   **Output**: Launches the interactive GUI window for user interaction.

### 4. Dependencies
*   **Internal**: `Waven.zebraGUI` (the core module containing the GUI implementation).
*   **System**: `__future__.annotations` (for modern type hinting compatibility).

### 5. Analysis Methods
*   **None**: This file contains no scientific or statistical logic; it is strictly a structural component for application entry.

### 6. Figures/Outputs
*   **Outputs**: Launches an interactive application window (the Waven GUI).

### 7. Key Parameters
*   **None**: No parameters are defined or exposed in this file. Configuration is handled within the `Waven.zebraGUI` module.

---

## src/waven/pipeline.py

### Code Analysis: `src/waven/pipeline.py`

#### 1. Purpose
This file serves as the public-facing API for the `Waven` package, re-exporting core functions and data structures from the internal `Waven.pipeline` module. It provides a granular interface that allows users to execute specific stages of the analytical pipeline (e.g., data loading, RF analysis, model fitting) or the entire workflow.

#### 2. Key Functions/Classes
*   **Data Structures:** 
    *   `SpikeData`, `WaveletData`, `PipelineOutputs`, `RFAnalysisResult`, `SimpleModelResult`: Typed objects for handling input/output data within the pipeline.
*   **Workflow Execution:**
    *   `run_pipeline`: Orchestrates the complete processing sequence.
    *   `run_rf_analysis`: Performs Receptive Field (RF) analysis.
    *   `run_full_model` / `run_simple_model`: Executes complex or simplified computational models.
*   **Preprocessing/Utility:**
    *   `load_spikes_and_positions`: Imports experimental data.
    *   `prepare_stimulus_wavelets`: Prepares wavelet-based stimulus representations.
    *   `create_gabor_library`: Generates Gabor filter banks for modeling.
    *   `smooth_best_positions`: Post-processing for spatial tracking data.
    *   `validate_spike_data`: Ensures data integrity.

#### 3. Data Flow
*   **Inputs:** Reads raw experimental data (spikes and stimulus positions) and wavelet configurations.
*   **Processing:** Transforms raw spike/stimulus data through wavelet decomposition, fits statistical/neural models, and performs spatial smoothing.
*   **Outputs:** Returns structured result objects (`RFAnalysisResult`, `SimpleModelResult`) that contain analyzed receptive field properties and model predictions.

#### 4. Dependencies
*   **Internal:** Acts as a wrapper for `Waven.pipeline` (the underlying implementation module).
*   **Standard:** Leverages `__future__` annotations for compatibility.

#### 5. Analysis Methods
*   **Receptive Field (RF) Mapping:** Methods to characterize neural sensitivity to stimuli.
*   **Wavelet Decomposition:** The core mathematical framework for analyzing stimulus features.
*   **Gabor Filtering:** Uses Gabor libraries to approximate visual stimuli or spatial filters.
*   **Statistical Modeling:** Implements both "simple" and "full" model architectures, likely involving generalized linear models or neural encoding functions.

#### 6. Figures/Outputs
*   While the file does not contain plotting code itself, it outputs `PipelineOutputs` and `RFAnalysisResult` objects, which serve as the containers for downstream visualization and analytical report generation.

#### 7. Key Parameters
*   *Note: As this is an API re-export file, the actual configuration parameters (e.g., wavelet scales, filter orientations, smoothing kernels) are defined in the specific function implementations within `Waven.pipeline`. Users interact with these via the imported functions listed above.*

---

## src/waven/plotting.py

This file, `src/waven/plotting.py`, is a utility module for visualizing receptive field (RF) analysis results in the Waven framework, specifically focused on neural correlation and retinotopic mapping.

### 1. Purpose
This module provides plotting helpers to visualize neural receptive field tensors, retinotopic feature distributions (azimuth, elevation, orientation, size), and visual sign maps. It facilitates the inspection of experimental data by generating structured matplotlib figures and providing a mechanism to save them to disk.

### 2. Key Functions
*   **`finite_abs_max`**: Utility to determine a stable maximum absolute value for color normalization, preventing errors with NaNs or zeros.
*   **`plot_rf_grid`**: Visualizes a single neuron's 4D RF tensor as a grid of orientation-by-size image panels.
*   **`plot_retinotopic_maps`**: Creates scatter plots showing the spatial distribution of preferred visual features (e.g., orientation, size) across neuron positions.
*   **`plot_sign_map`**: Visualizes the visual sign map (usually related to the gradient of the retinotopic map) as both a grid and as projected onto specific neuron coordinates.
*   **`save_figures`**: Batch saves a list of named figures to a specified directory.

### 3. Data Flow
*   **Input**: Receives NumPy arrays representing neural positions and receptive field tensors/results.
*   **Processing**: Maps neural data onto grid-based images or scatter plots; applies normalization using `finite_abs_max` for consistent colormaps.
*   **Output**: Returns `matplotlib.figure.Figure` objects; optionally writes `.png` files to the filesystem.

### 4. Dependencies
*   **Standard/Scientific**: `numpy`, `matplotlib.pyplot`, `pathlib`.
*   **Internal**: `Waven.Analysis_Utils` (aliased as `au`) used for computing the visual sign map.

### 5. Analysis Methods
*   **Grid Visualization**: Reshaping 4D tensors (space $\times$ space $\times$ orientation $\times$ size) into 2D display grids.
*   **Retinotopic Mapping**: Correlating spatial neuron positions with preferred stimulus features (azimuth, elevation, orientation, size).
*   **Sign Mapping**: Calculating the "visual sign" of neural responses, which generally indicates the local inversion of the visual field map (via `au.getSignMap`).

### 6. Figures/Outputs
*   **RF Tensor Grids**: Heatmaps of neural responses across orientation/size space.
*   **Retinotopic Maps**: Scatter plots of neurons in physical space colored by their preferred visual parameters.
*   **Sign Maps**: Heatmaps representing visual field inversion and scatter plots mapping these signs to neuron locations.

### 7. Key Parameters
*   **`vmax`**: Dynamically computed via `finite_abs_max` to ensure consistent color scaling across plots.
*   **`cmap`**: Specific colormaps used to denote visual features (e.g., `coolwarm` for size/sign, `hsv` for orientation, `jet` for coordinates).
*   **`sigmas_deg`**: The size parameters used for RF grid labels.

---

## src/waven0.1.egg-info/SOURCES.txt

This file is a metadata manifest for the `waven` Python package. Below is the structured analysis:

### 1. Purpose
`SOURCES.txt` is an automatically generated file that lists all source files included in the `waven` package distribution. It serves as an index for package installation tools (like `pip`) to ensure all necessary scripts, modules, and documentation are included during build/install processes.

### 2. Key Functions/Classes
*   **None**: This is a text-based metadata manifest, not executable code. It contains no functions or classes.

### 3. Data Flow
*   **Read**: During the `python -m build` or `pip install` process, packaging tools read this file to determine which files to bundle into the `.whl` or `sdist` archive.
*   **Write**: This file is generated by the `egg-info` build step (via `setuptools` or `distutils`).

### 4. Dependencies
*   **Internal**: It references the entire project structure, specifically the `src/Waven/` core modules and the `src/Waven/suite2p/` sub-package.
*   **External**: Dependent on standard Python packaging tools (`setuptools`/`distutils`).

### 5. Analysis Methods
*   **N/A**: As a manifest file, it contains no scientific or statistical methods.

### 6. Figures/Outputs
*   **Outputs**: None. The file itself is the output of the packaging process.

### 7. Key Parameters
*   **N/A**: This file contains only relative file paths and does not store configurable algorithmic parameters.

***

### Summary of Repo Structure (Inferred from manifest):
Based on the file list, the `Waven` repository appears to be a specialized tool for:
*   **Wavelet Analysis**: Indicated by `WaveletGenerator.py`.
*   **Signal Processing**: Indicated by `LoadPinkNoise.py` and `Analysis_Utils.py`.
*   **Neuroscience/Imaging Integration**: The inclusion of a `suite2p` directory suggests this package is designed to interface with the **Suite2p** pipeline, a popular open-source software for processing two-photon calcium imaging data.
*   **GUI Interface**: `zebraGUI.py` suggests the package includes a desktop interface for data visualization or parameter tuning.

---

## src/waven0.1.egg-info/requires.txt

This file is a standard metadata component of a Python package. Based on its content and structure, here is the analysis:

### 1. Purpose
This file functions as the **requirements manifest** for the `waven0.1` Python package. It lists the external dependencies that must be installed in the user's environment to ensure the software functions correctly.

### 2. Key Functions/Classes
*   **None**: This is a plain text configuration file, not executable source code. It contains no functions or classes.

### 3. Data Flow
*   **N/A**: This file does not handle data processing. It is consumed by package managers (like `pip`) during the installation process to resolve dependency trees.

### 4. Dependencies
The file specifies that the `waven` package relies on the following libraries for core functionality:
*   **Data Processing/Math**: `numpy`, `scipy`, `pandas`
*   **Computer Vision/Image Analysis**: `opencv_python`, `scikit_image`, `tifffile`
*   **Machine Learning/Deep Learning**: `torch`, `scikit_learn`
*   **Visualization**: `matplotlib`, `seaborn`

### 5. Analysis Methods
*   **Inferred**: Based on the dependencies, the repository likely implements:
    *   **Deep Learning/Neural Networks**: Indicated by `torch`.
    *   **Image Processing**: Indicated by `scikit_image`, `opencv_python`, and `tifffile` (common for microscopy or scientific imaging).
    *   **Statistical Modeling/Machine Learning**: Indicated by `scikit_learn`.

### 6. Figures/Outputs
*   **N/A**: This file generates no outputs. However, the listed dependencies (`matplotlib`, `seaborn`) suggest the repository is designed to generate scientific plots, heatmaps, or visualizations of model results.

### 7. Key Parameters
*   **N/A**: There are no configurable parameters within this file. It serves as a static list of package names.

---

## src/waven0.1.egg-info/top_level.txt

Based on the provided content, here is the structured analysis of the file:

### 1. Purpose
This file is an auto-generated metadata file used by Python’s `setuptools` (Egg-info) to define the top-level package or module names included in the distribution. It allows the Python installer (e.g., `pip`) to recognize `Waven` and `pydocs` as importable packages or modules within the installed environment.

### 2. Key Functions/Classes
*   **None**: This is a configuration/metadata file, not source code. It contains no executable functions or classes.

### 3. Data Flow
*   **Reads**: N/A (Generated by the build process).
*   **Writes**: N/A.
*   **Processes**: It provides the installer with a mapping of the directory structure to identifiable Python namespaces.

### 4. Dependencies
*   **External**: Relies on `setuptools` or `distribute` for generation.
*   **Repo Files**: It correlates to the `Waven/` source directory and the `pydocs/` directory within the repository.

### 5. Analysis Methods
*   **None**: There are no scientific or statistical methods implemented in this file.

### 6. Figures/Outputs
*   **None**: This file does not produce any graphical or scientific outputs.

### 7. Key Parameters
*   **Top-level names**: The file explicitly registers `Waven` and `pydocs` as the top-level imports for the package, ensuring that `import Waven` and `import pydocs` function correctly after installation.

---

## tests/test_zarr_compat.py

This analysis covers the `tests/test_zarr_compat.py` file, which validates the functionality of the `Waven` library's array loading interface.

### 1. Purpose
This file provides a suite of unit tests for the `load_array` function, ensuring it correctly handles file format preference, memory-mapping fallbacks, and serialization settings. Its primary goal is to verify that the library can intelligently switch between Zarr and NumPy file formats based on file availability and user configuration.

### 2. Key Functions/Classes
*   **`test_load_prefers_zarr`**: Validates the priority logic, ensuring that if both a `.npy` and a `.zarr` file exist for the same identifier, the system defaults to the Zarr implementation.
*   **`test_load_numpy_memmap_fallback`**: Verifies that the system can successfully fall back to standard `numpy.memmap` reading when Zarr is not applicable.
*   **`test_allow_pickle_skips_zarr`**: Checks that when `allow_pickle=True` is passed, the function correctly processes standard NumPy serialized Python objects instead of attempting Zarr-specific operations.

### 3. Data Flow
*   **Inputs**: The tests generate temporary NumPy arrays and serialized objects on the local filesystem (`tmp_path`).
*   **Processing**: The `load_array` utility is called with various path strings and flags (`mmap_mode`, `allow_pickle`).
*   **Outputs**: The function returns array-like objects or Python dictionaries, which are then validated against the ground-truth arrays created during the setup phase.

### 4. Dependencies
*   **Internal**: `Waven.zarr_compat` (the source module being tested).
*   **External**: 
    *   `numpy`: For array generation and file serialization.
    *   `zarr`: For Zarr-format file handling.
    *   `pytest` (implied): Used to provide the `tmp_path` fixture.

### 5. Analysis Methods
*   **Unit Testing**: Uses assertion-based validation of shape and value integrity to verify data consistency between the source array and the loaded array.
*   **Format Negotiation**: Implements integration testing for "smart" path resolution (checking for sibling files with different extensions).

### 6. Figures/Outputs
*   **No graphical outputs** are generated.
*   **Status**: The file produces exit codes indicating pass/fail results for the test suite.

### 7. Key Parameters
*   **`mmap_mode`**: A string parameter (e.g., `'r'`) used to determine if the array should be memory-mapped for large-file efficiency.
*   **`allow_pickle`**: A boolean flag to handle arbitrary Python objects serialized via `np.save`.
*   **`tmp_path`**: A built-in pytest fixture used to ensure a clean, isolated filesystem environment for each test execution.

---

## wavelet_zarr.py

This analysis summarizes the provided `wavelet_zarr.py` script, which is designed for high-performance data conversion in a scientific imaging or video-processing pipeline.

### 1. Purpose
The script performs a memory-efficient conversion of large-scale NumPy (`.npy`) wavelet-transformed video datasets into the Zarr storage format. It utilizes chunking and Blosc compression to enable high-performance read/write operations for large multidimensional arrays that may exceed standard memory capacity.

### 2. Key Functions/Classes
*   **`np.load(mmap_mode="r")`**: Used to open large files as memory-mapped arrays, avoiding the need to load the entire dataset into RAM.
*   **`zarr.open`**: Initializes persistent Zarr arrays on disk with specific chunking and compression configurations.
*   **`Blosc`**: An external compression library used to optimize storage footprint and I/O speed.
*   **`trange`**: Provides a progress bar for the iteration loop, useful for monitoring long-running data conversion tasks.

### 3. Data Flow
1.  **Input**: Reads two source `.npy` files (`dwt_videodata2_i.npy` and `dwt_videodata2_r.npy`) using memory-mapping.
2.  **Processing**: Iterates through the time dimension of the arrays in defined chunks.
3.  **Output**: Writes the processed data to two corresponding `.zarr` directories on disk, preserving the original array structure while applying Zstandard compression.

### 4. Dependencies
*   **`numpy`**: For array handling and memory mapping.
*   **`zarr`**: For the chunked, compressed, N-dimensional array storage format.
*   **`numcodecs` (specifically `Blosc`)**: For high-performance compression algorithms.
*   **`tqdm`**: For progress monitoring.
*   **`os`**: For file path manipulation.

### 5. Analysis Methods
*   **Chunked I/O**: Implements a "time-chunking" strategy, which is standard in scientific datasets where time-series data is processed sequentially to maintain memory efficiency and optimize disk access patterns for multi-dimensional spatial-temporal data.
*   **Bit-shuffling**: Uses `Blosc.BITSHUFFLE` as part of the compression pipeline, a common technique for improving the compression ratio of scientific numerical data by rearranging bytes to group similar bits together.

### 6. Figures/Outputs
*   **Outputs**: Two Zarr-format archives (`.zarr` directories) containing the converted wavelet data.
*   **Console Logs**: Reports the file shape, data type, and a progress bar showing the status of the data conversion.

### 7. Key Parameters
*   **`chunks = (1800, 1, 1, 8, 5, 4)`**: The multidimensional chunk size; critical for performance tuning based on data access patterns (e.g., temporal vs. spatial slicing).
*   **`compressor` (Blosc, zstd, level 3)**: Defines the compression strategy; balancing CPU usage (level 3) and storage size.
*   **`mmap_mode`**: Essential for preventing `MemoryError` when handling datasets that are larger than the available system RAM.

---

