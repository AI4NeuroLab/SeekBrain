# Repository File Summaries

## Documentation/Documentation.md

This document serves as the primary technical manual for **Neurocarta**, a MATLAB/Octave toolbox designed to reconstruct and analyze mouse brain connectivity networks.

### 1. Purpose
Neurocarta provides a framework to download, organize, and analyze neuronal projection data from the Allen Mouse Brain Connectivity Atlas (AMBCA). It facilitates the conversion of raw imaging data into graph-theoretical network models to study anatomical connectivity.

### 2. Key Functions/Classes
*   **Database Management:** `build_database` (Downloads/imports the AMBCA dataset).
*   **Experiment Analysis:** `autocorrelatemap`, `crosscorrelatemaps`, `findexperiments`, `groupexperiments`, `autothreshold`.
*   **Network Construction:** `loadmap` (compiles adjacency matrices), `findarea`, `filtermap`, `trimmap`.
*   **Network Analysis:** `getdegree`, `shortestpath`, `getcentrality`, `getsynapses`, `macromap` (regional averaging), `exportnetwork` (GEXF format).

### 3. Data Flow
*   **Input:** Raw imaging experiment data from the AMBCA, metadata (stored in `Structures`), and a manually compiled list of brain nodes.
*   **Processing:** The toolbox downloads raw projection data, processes it into bilateral adjacency matrices (normalized axonal density), and applies graph-theoretical algorithms to these matrices.
*   **Output:** Visualizations of brain maps, network adjacency matrices, and GEXF files for external visualization software.

### 4. Dependencies
*   **Language:** MATLAB or Octave.
*   **External Source:** [Allen Mouse Brain Connectivity Atlas (AMBCA)](https://connectivity.brain-map.org).
*   **Local Files:** `startup.m` (path management), `/Data` directory (raw data), and `/Structures` directory (metadata/node definitions).

### 5. Analysis Methods
*   **Graph Theory:** Calculation of node degree, shortest paths (and K-shortest paths), path lengths, and betweenness centrality.
*   **Statistical/Data Manipulation:** Normalized axonal density calculation, averaging experiments, and thresholding techniques to filter "weak" projections or connections.

### 6. Figures/Outputs
*   **Visualizations:** Experiment overview maps, comparative cross-correlation maps.
*   **Network Representation:** Bilateral adjacency matrices.
*   **Exportable Data:** GEXF (Graph Exchange XML Format) files for graph visualization.

### 7. Key Parameters
*   **Experiments Subset:** Defined via a user-created `experiments.csv` file within the `Structures` directory for targeted data downloads.
*   **Network Parameters:** Configurable via `loadmap` and `generatemaps`, which allow for varying parameters during network compilation (e.g., node definitions and density thresholds).

---

## LICENSE.md

This is an analysis of the provided `LICENSE.md` file from the research repository.

### 1. Purpose
This file establishes the legal framework for the use, modification, and distribution of the repository's codebase. It utilizes the standard MIT License to permit open-source usage while protecting the copyright holder from liability.

### 2. Key Functions/Classes
*   **N/A**: This is a legal documentation file, not a source code file. It contains no executable functions or classes.

### 3. Data Flow
*   **N/A**: This file does not process, read, or write any computational data.

### 4. Dependencies
*   **N/A**: This file has no software dependencies.

### 5. Analysis Methods
*   **N/A**: No scientific or statistical methods are implemented.

### 6. Figures/Outputs
*   **N/A**: This file does not generate figures, plots, or computational outputs.

### 7. Key Parameters
*   **Copyright Holder**: Tido Bergmans
*   **Year**: 2024
*   **License Type**: MIT License (a permissive free software license)

---

## Paper figures/Code/README.md

This file serves as the documentation and workflow guide for generating the figures presented in the associated scientific article.

### 1. Purpose
This file provides instructions on how to replicate the study's figures by detailing the initialization, data processing, and execution pipeline. It acts as the central entry point for users to reconstruct the analytic environment and generate the specific visualizations used in the research paper.

### 2. Key Functions/Classes
*   `startup`: A root-level command that initializes the necessary environment and path configurations.
*   `build_database`: A utility used to download and import the AMBCA (Allen Mouse Brain Connectivity Atlas) dataset.
*   `generate_maps`: The primary processing script used to construct brain networks and compute Density of States (DOS) matrices.
*   `[figure_function_files]`: Individual scripts named after specific figures (implied) that generate the visual outputs for the paper.

### 3. Data Flow
1.  **Input**: Downloads raw data from an external source (AMBCA).
2.  **Processing**: Transforms connectivity data into network models and calculates matrix-based metrics (DOS).
3.  **Output**: Stores processed network and matrix data, which are then fed into figure-specific functions to produce visual files (plots/graphs).

### 4. Dependencies
*   **Repo Dependencies**: Requires the `Neurocarta` library/functions.
*   **Data Dependencies**: Relies on the AMBCA (Allen Mouse Brain Connectivity Atlas).
*   **Environment**: Requires the repository's root folder setup (via `startup`).

### 5. Analysis Methods
*   **Network Construction**: Methods for mapping brain connectivity based on atlas data.
*   **Matrix Algebra**: Calculation of Density of States (DOS) matrices, likely used to analyze the spectral properties of the brain networks.

### 6. Figures/Outputs
*   **Outputs**: Replicated figures corresponding to the article's results.
*   **Intermediate data**: Constructed networks and calculated DOS matrices.

### 7. Key Parameters
*   *Note: While not explicitly listed in the text, the workflow implies that parameters are likely managed within the `generate_maps` and individual figure functions.* Users must ensure the `startup` command is executed to set the correct environment paths for these parameters to be recognized.

---

## Paper figures/Interactive figure/README.md

This file is a brief documentation snippet providing instructions on how to render an interactive visualization within the research repository.

### 1. Purpose
This file provides instructions on how to host and view an interactive figure included in the paper's supplemental material using a local web server.

### 2. Key Functions/Classes
*   **`python3 -m http.server`**: A standard library command used to spin up a local development web server to serve the HTML/JS-based interactive figure.

### 3. Data Flow
*   **Reads**: Local HTML and associated asset files (e.g., JavaScript/CSS) located in the `Paper figures/Interactive figure/` directory.
*   **Outputs**: Serves these files to a web browser via `localhost`.

### 4. Dependencies
*   **Python 3**: Required to run the HTTP server module.
*   **Web Browser**: Necessary to render the interactive figure.

### 5. Analysis Methods
*   **N/A**: This file is purely instructional; it does not contain scientific or statistical code.

### 6. Figures/Outputs
*   **Interactive Figure**: The file facilitates the viewing of an interactive, browser-based graphical output representing research data.

### 7. Key Parameters
*   **Port (default 8000)**: Users can optionally specify a port (e.g., `python3 -m http.server 8080`) if the default port is in use or blocked.

---

## README.md

This analysis provides a structured summary of the `README.md` file for the **Neurocarta** MATLAB toolbox.

### 1. Purpose
Neurocarta is a MATLAB-based framework designed to retrieve, process, and analyze mouse brain connectivity data from the Allen Mouse Connectivity Atlas (AMBCA). It facilitates the construction of anatomical neural networks and the computation of graph-theoretic properties based on axonal density projections.

### 2. Key Functions/Classes
*   **`build_database.m`**: The primary initialization script that downloads and compiles the necessary AMBCA datasets to local storage.
*   **Analysis/Visualization Functions**: The toolbox includes various (unspecified by name) functions for network property computation and spatial visualization of neural projections.

### 3. Data Flow
*   **Input**: Raw neuroimaging connectivity data (monosynaptic projections) from the Allen Mouse Connectivity Atlas (AMBCA) API/website.
*   **Processing**: Normalization of axonal density data and mapping of projections onto brain structures.
*   **Output**: An anatomical network structure representing inter-areal connectivity, alongside visualizations and computed graph metrics.

### 4. Dependencies
*   **Platform**: MATLAB.
*   **External Data Source**: Allen Mouse Connectivity Atlas (AMBCA).
*   **Internal**: `Documentation/` folder (for user guidance) and local database files generated via `build_database.m`.

### 5. Analysis Methods
*   **Network Construction**: Conversion of axonal density tracer data into a weighted connectivity matrix (bilateral anatomical network).
*   **Graph Theory**: Computation of network properties including:
    *   Degree of separation.
    *   Shortest paths between brain regions.
    *   Overall network connectivity density.
*   **Visualization**: Spatial mapping of projection origins and targets, including cross-hemispheric connections.

### 6. Figures/Outputs
*   **Flowchart**: A structural workflow diagram (`Documentation/flowchart.png`).
*   **Visualizations**: Plots illustrating projections originating from specific brain areas to target regions.
*   **Network Graphs**: Computed statistical output representing the brain's connectome.

### 7. Key Parameters
*   **Experimental Scope**: The toolbox processes data based on monosynaptic fluorescent protein-expressing viral tracers.
*   **Connectivity Metrics**: Axonal density is the primary input variable used to define the strength of edges within the generated neural network.

---

