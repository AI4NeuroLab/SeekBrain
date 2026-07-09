# Repository Overview

Based on the repository analysis provided, here is the comprehensive **REPOSITORY OVERVIEW** for the Brain Connectivity Toolbox (BCT) Python implementation.

---

### 1. Repository Purpose
The repository, `bctpy`, is a comprehensive, pure-Python translation of the original MATLAB-based Brain Connectivity Toolbox. Its primary objective is to provide neuroscientists and network researchers with a standardized, open-source framework to perform graph-theoretical analysis on brain connectivity data. It supports the computation of nodal, modular, and global network metrics, along with statistical inference tools (NBS) and null-model generation, ensuring scientific reproducibility via automated CI and documentation.

### 2. Data Pipeline
The repository follows a standardized data pipeline:
*   **Input**: Typically accepts square adjacency matrices (as `numpy.ndarray`). It explicitly requires `numpy.array` and rejects legacy `numpy.matrix` objects to ensure consistency.
*   **Preprocessing**: Employs internal utilities (`bct.utils`) to handle binarization, log/inverse weight transformations, and normalization, converting raw weights into interpretable "distances" or "strengths."
*   **Processing**: Applies algorithmic modules (centrality, modularity, efficiency, etc.) to extract topological and statistical features.
*   **Output**: Produces quantitative results as `numpy` arrays (vectors for nodal metrics or $N \times N$ matrices for pair-wise metrics) or scalar values.

### 3. Key Scripts & Their Roles
*   **`bct/algorithms/`**: The core library.
    *   `centrality.py` / `distance.py` / `efficiency.py`: Essential for quantifying information flow and node importance.
    *   `modularity.py`: Implements Louvain-based community detection.
    *   `clustering.py`: Calculates clustering coefficients and consensus partitions.
    *   `generative.py` / `models.py`: Used for creating null models and synthetic benchmarks.
*   **`bct/nbs.py`**: Implementation of the Network Based Statistic (NBS) for statistical testing of group differences.
*   **`bct/utils/`**: Helper functions for matrix manipulation, error handling, and visualization preparation.
*   **`setup.py` / `requirements.txt`**: Package configuration and dependency management.

### 4. Analysis Methods Implemented
*   **Graph Theory**: Betweenness centrality, clustering coefficients, assortativity, k-core decomposition, and rich-club coefficients.
*   **Network Neuroscience**: Characterization of small-world properties, global/local efficiency, and brain-specific generative modeling.
*   **Community Detection**: Louvain optimization, consensus clustering, and link-community hierarchical clustering.
*   **Statistical Inference**: Nonparametric testing via the Network Based Statistic (NBS) for comparative group analysis.
*   **Null Models**: Stochastic graph randomization and maximum-likelihood ensemble sampling.

### 5. Outputs & Figures
*   **Outputs**: The toolbox generates numerical data only (matrices, vectors, scalars). It does **not** contain functions for direct data visualization (plotting).
*   **Integration**: Outputs are formatted to be immediately compatible with plotting libraries like `matplotlib` or `seaborn` for final neuroimaging visualization.

### 6. Dependencies & Environment
*   **Core**: `numpy` (heavy usage) and `scipy` (linear algebra/stats).
*   **Optional/Specialized**: `networkx` (for limited specific algorithms like NBS), `duecredit` (for automated citation management).
*   **CI/CD**: `tox` (environment/test runner), `GitHub Actions` (cross-version Python testing: 3.7–3.10).

### 7. File Dependency Graph
The structure is modular, following this hierarchy:
*   **Entry Point**: `bct/__init__.py` (exposes sub-modules to the user).
*   **Sub-Module Layer**:
    *   `bct/algorithms/` (Logic) $\rightarrow$ depends on `bct/utils/` (Helpers).
    *   `bct/utils/` $\rightarrow$ provides `binarize`, `error handling`, and `matrix inversion`.
*   **Cross-Dependency**:
    *   `bct/algorithms/clustering.py` $\rightarrow$ depends on `bct/modularity.py` and `bct/distance.py`.
    *   `bct/algorithms/generative.py` $\rightarrow$ integrates `similarity.py`, `clustering.py`, and `centrality.py`.
*   **Provenance**: All algorithm files report back to `bct/due.py` and `bct/citations.py` to manage academic attribution requirements.

Repository Structure:
  .github/workflows/ci.yaml (620 chars)
  CHANGELOG.md (1786 chars)
  README.md (3423 chars)
  bct/__init__.py (392 chars)
  bct/algorithms/__init__.py (306 chars)
  bct/algorithms/centrality.py (29181 chars)
  bct/algorithms/clustering.py (27242 chars)
  bct/algorithms/core.py (24180 chars)
  bct/algorithms/degree.py (4683 chars)
  bct/algorithms/distance.py (32878 chars)
  bct/algorithms/efficiency.py (14517 chars)
  bct/algorithms/generative.py (22936 chars)
  bct/algorithms/models.py (2472 chars)
  bct/algorithms/modularity.py (60865 chars)
  bct/algorithms/motifs.py (30829 chars)
  bct/algorithms/physical_connectivity.py (5962 chars)
  bct/algorithms/reference.py (60498 chars)
  bct/algorithms/similarity.py (11568 chars)
  bct/citations.py (13894 chars)
  bct/due.py (2018 chars)
  bct/nbs.py (9875 chars)
  bct/nbs_parallel.py (5720 chars)
  bct/utils/__init__.py (89 chars)
  bct/utils/miscellaneous_utilities.py (3584 chars)
  bct/utils/other.py (8869 chars)
  bct/utils/visualization.py (26923 chars)
  bct/version.py (87 chars)
  docs/_build/html/_sources/_templates/function.txt (99 chars)
  docs/_build/html/_sources/bct.txt (4583 chars)
  docs/_build/html/_sources/index.txt (414 chars)
  docs/_build/html/_sources/modules.txt (46 chars)
  docs/_build/html/_sources/stupid.txt (384 chars)
  docs/conf.py (8290 chars)
  docs/sphinxext/numpy_ext/docscrape.py (15441 chars)
  docs/sphinxext/numpy_ext/docscrape_sphinx.py (8061 chars)
  docs/sphinxext/numpy_ext/numpydoc.py (6182 chars)
  requirements.txt (44 chars)
  setup.py (1162 chars)
  test/basic_test.py (1610 chars)
  test/centrality_test.py (554 chars)
  test/clustering_test.py (4978 chars)
  test/conftest.py (584 chars)
  test/core_test.py (734 chars)
  test/distance_test.py (2509 chars)
  test/duecredit_test.py (1585 chars)
  test/efficiency_test.py (872 chars)
  test/load_samples.py (2646 chars)
  test/modularity_derived_metrics_test.py (2577 chars)
  test/modularity_test.py (6737 chars)
  test/nbs_test.py (779 chars)
  test/nodals_test.py (1178 chars)
  test/partition_distance_test.py (482 chars)
  test/reference_test.py (804 chars)
  test/simple_script.py (927 chars)
  test/very_long_test.py (243 chars)