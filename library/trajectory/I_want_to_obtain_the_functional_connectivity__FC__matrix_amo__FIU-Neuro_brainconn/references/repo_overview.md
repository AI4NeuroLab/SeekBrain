# Repository Overview

Based on the provided file summaries, here is the comprehensive repository overview for the `brainconn` project.

---

### 1. Repository Purpose
`brainconn` is an open-source Python library designed for **graph-theoretical analysis of human brain connectivity**. It acts as a specialized toolkit for neuroscientists to perform topological analysis on structural and functional brain networks (e.g., fMRI connectivity matrices). The repository serves as a Python-based implementation of the seminal MATLAB-based **Brain Connectivity Toolbox (BCT)**, enabling users to calculate network metrics, identify hubs, and perform statistical inference (e.g., Network-Based Statistics) on complex brain graphs.

### 2. Data Pipeline
The data workflow is optimized for neuroimaging researchers:
*   **Input**: The library accepts $N \times N$ adjacency matrices representing connectivity (binary or weighted, directed or undirected). 
*   **Preprocessing**: The package includes utility scripts (`make_example_data.py`) that demonstrate how to go from raw fMRI NIfTI files to functional connectivity matrices using `nilearn`.
*   **Transformation**: Users employ tools in `brainconn.utils` to threshold, binarize, or weight-adjust connectivity matrices before analysis.
*   **Computation**: The core modules process these matrices to derive topological metrics, community partitions, and statistical null models.
*   **Citation**: Integration with `duecredit` ensures that the specific versions of algorithms used in the analysis are automatically captured for academic reporting.

### 3. Key Scripts & Their Roles
*   **`brainconn/`**: The primary package directory.
    *   **`core/` & `centrality/`**: Houses the heavy lifting for node importance (betweenness, eigenvector, rich-club, assortativity).
    *   **`modularity/` & `clustering/`**: Contains community detection (Louvain) and local/global clustering coefficient algorithms.
    *   **`distance/` & `nbs.py`**: Handles path-length calculations and Network-Based Statistics for group comparison.
    *   **`utils/`**: Provides matrix management, visualization helpers, and data processing support.
*   **`docs/auto_examples/`**: Contains Jupyter notebooks and scripts demonstrating the library’s usage for various neuroimaging scenarios.
*   **`setup.py`**: Manages installation, defining requirements and metadata.

### 4. Analysis Methods Implemented
*   **Graph Metrics**: Clustering coefficients, transitivity, betweenness, Eigenvector centrality, and flow coefficients.
*   **Hierarchy/Organization**: Rich-club coefficients, $k$-core decomposition, and assortativity.
*   **Community Structure**: Louvain modularity optimization and consensus clustering.
*   **Statistical Inference**: Network-Based Statistics (NBS) and null-model generation (generative/reference models) to assess the significance of connectivity patterns.
*   **Signal Processing**: Standard fMRI pipeline steps (detrending, standardization, band-pass filtering) via the example data workflow.

### 5. Outputs & Figures
*   **Numerical Data**: The library primarily outputs numerical vectors ($N \times 1$) and matrices ($N \times N$) containing topological scores, which are designed for downstream statistical packages.
*   **Visualization**: The `brainconn/utils/visualization.py` script suggests the library supports plotting network features, though the focus remains on the computational backbone.
*   **Citation Records**: Automated generation of citations for the mathematical methods employed during execution.

### 6. Dependencies & Environment
*   **Scientific Stack**: `numpy`, `scipy` (core matrix operations and linear algebra).
*   **Neuroimaging Stack**: `nilearn`, `nibabel` (for handling NIfTI-based brain data).
*   **Tooling**: `duecredit` (citation tracking), `pytest` (unit testing), `flake8` (linting), and `travis.yml`/`codecov` (CI/CD pipeline).

### 7. File Dependency Graph
```text
[Repository Root]
├── [brainconn/ (Root Package)]
│   ├── [core/ (Algorithms for centrality/rich-club)] --> [brainconn/degree/]
│   ├── [centrality/] --> [brainconn/distance/], [brainconn/core/]
│   ├── [clustering/] --> [brainconn/modularity/], [brainconn/utils/]
│   ├── [modularity/] --> [brainconn/utils/]
│   └── [utils/ (Matrix tools & Vis)]
├── [docs/auto_examples/] --> [brainconn/]
└── [brainconn/data/]
    ├── example_corr.txt (Sample Input)
    └── make_example_data.py --> [nilearn/nibabel]
```
*(Note: The repository is modular, with core algorithms in separate sub-packages that communicate via centralized imports in `__init__.py` files.)*

Repository Structure:
  .codecov.yml (222 chars)
  .github/ISSUE_TEMPLATE/bug_report.md (799 chars)
  .github/ISSUE_TEMPLATE/feature_request.md (560 chars)
  .github/pull_request_template.md (510 chars)
  .travis.yml (698 chars)
  CHANGELOG.md (2051 chars)
  CODE_OF_CONDUCT.md (2808 chars)
  CONTRIBUTING.md (5922 chars)
  README.md (4694 chars)
  brainconn/__init__.py (1324 chars)
  brainconn/centrality/__init__.py (1067 chars)
  brainconn/centrality/centrality.py (26423 chars)
  brainconn/clustering/__init__.py (972 chars)
  brainconn/clustering/clustering.py (22508 chars)
  brainconn/core/__init__.py (616 chars)
  brainconn/core/core.py (19960 chars)
  brainconn/data/example_corr.txt (1777554 chars)
  brainconn/data/make_example_data.py (918 chars)
  brainconn/degree/__init__.py (346 chars)
  brainconn/degree/degree.py (5147 chars)
  brainconn/distance/__init__.py (748 chars)
  brainconn/distance/distance.py (35308 chars)
  brainconn/due.py (1816 chars)
  brainconn/generative/__init__.py (198 chars)
  brainconn/generative/generative.py (19157 chars)
  brainconn/modularity/__init__.py (1080 chars)
  brainconn/modularity/modularity.py (57217 chars)
  brainconn/motifs/__init__.py (590 chars)
  brainconn/motifs/motifs.py (30162 chars)
  brainconn/nbs.py (9756 chars)
  brainconn/physical_connectivity/__init__.py (207 chars)
  brainconn/physical_connectivity/physical_connectivity.py (5379 chars)
  brainconn/reference/__init__.py (1182 chars)
  brainconn/reference/reference.py (54559 chars)
  brainconn/similarity/__init__.py (486 chars)
  brainconn/similarity/similarity.py (11620 chars)
  brainconn/tests/__init__.py (100 chars)
  brainconn/tests/test_base.py (1658 chars)
  brainconn/tests/test_centrality.py (5637 chars)
  brainconn/tests/test_clustering.py (4263 chars)
  brainconn/tests/test_core.py (612 chars)
  brainconn/tests/test_distance.py (1577 chars)
  brainconn/tests/test_modularity.py (5933 chars)
  brainconn/tests/test_nbs.py (888 chars)
  brainconn/tests/test_nodals.py (1209 chars)
  brainconn/tests/test_partition_distance.py (669 chars)
  brainconn/tests/test_very_long.py (320 chars)
  brainconn/tests/utils.py (2723 chars)
  brainconn/utils/__init__.py (925 chars)
  brainconn/utils/matrix.py (8776 chars)
  brainconn/utils/misc.py (3116 chars)
  brainconn/utils/visualization.py (26017 chars)
  brainconn/version.py (2468 chars)
  docs/auto_examples/centrality/plot_centrality.ipynb (2118 chars)
  docs/auto_examples/centrality/plot_centrality.py (2500 chars)
  docs/auto_examples/degree/plot_degree.ipynb (2652 chars)
  docs/auto_examples/degree/plot_degree.py (3124 chars)
  docs/conf.py (7042 chars)
  docs/requirements.txt (75 chars)
  docs/sphinxext/github_link.py (2803 chars)
  examples/README.txt (53 chars)
  examples/centrality/README.txt (39 chars)
  examples/centrality/plot_centrality.py (2500 chars)
  examples/degree/README.txt (43 chars)
  examples/degree/plot_degree.py (3124 chars)
  requirements.txt (62 chars)
  setup.py (1251 chars)