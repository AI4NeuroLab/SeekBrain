# Repository File Summaries

## .github/workflows/ci.yaml

This file is a GitHub Actions workflow configuration used to automate Continuous Integration (CI) for a Python-based scientific project.

### 1. Purpose
This file defines an automated pipeline that executes the project's test suite across multiple Python versions (3.7 through 3.10) every time code is pushed or a pull request is submitted. It ensures compatibility and code integrity by leveraging `tox` for environment management.

### 2. Key Functions/Classes
*   **Workflow Jobs**: 
    *   `test`: The primary job containing the matrix-based execution steps.
    *   `strategy`: Defines the matrix configuration for parallel testing.
*   **Workflow Steps**:
    *   `actions/setup-python@v2`: Configures the specific Python runtime.
    *   `actions/checkout@v2`: Clones the repository code.
    *   `tox`: The core task runner used to manage virtual environments and execute test commands.

### 3. Data Flow
*   **Input**: Reads source code and configuration files (likely `tox.ini` or `pyproject.toml`) from the repository.
*   **Process**: Installs dependencies and executes unit/integration tests within isolated virtual environments created by `tox`.
*   **Output**: Generates execution logs (via `-vv` verbosity) and status reports (Success/Failure) which are reflected in the GitHub UI.

### 4. Dependencies
*   **GitHub Actions**: `actions/setup-python@v2` and `actions/checkout@v2`.
*   **Python Libraries**: `tox` (Task runner) and `tox-gh` (a plugin to simplify running tox within GitHub Actions).
*   **Repository Files**: Relies on a `tox.ini` file (implied) to define the specific test environments and commands to be executed.

### 5. Analysis Methods
*   **Automated Regression Testing**: Standard unit testing framework integration.
*   **Cross-Version Compatibility Testing**: Ensures the code functions correctly across multiple Python versions (3.7–3.10), essential for reproducible research software.

### 6. Figures/Outputs
*   **Execution Logs**: Verbose logs showing the progress of environment setup and test execution.
*   **CI Status**: Pass/Fail badge/indicator on the GitHub repository page, summarizing the stability of the codebase.

### 7. Key Parameters
*   **`matrix.python_version`**: Defines the target Python environments: `3.10`, `3.9`, `3.8`, and `3.7`.
*   **`fail-fast: false`**: Configured to ensure all Python versions are tested even if one environment fails, allowing for a comprehensive overview of compatibility.
*   **`tox` flags**:
    *   `--notest`: Used to set up environments without running tests immediately.
    *   `--skip-pkg-install`: Optimizes execution by skipping package installation during the final test run.

---

## CHANGELOG.md

This document is the `CHANGELOG.md` file for the `BCT` (Brain Connectivity Toolbox) repository, which tracks the evolution, bug fixes, and feature additions of a Python implementation of network analysis tools.

### 1. Purpose
The `CHANGELOG.md` file serves as a chronological record of development milestones, bug fixes, and feature updates for the `BCT` repository. It tracks the evolution of the codebase from version 0.3 to current in-progress developments.

### 2. Key Functions/Classes
While this is a log file rather than code, it highlights the maintenance of the following core BCT components:
*   **`modularity_louvain_*`**: Modularity-based community detection algorithms (directed/undirected).
*   **`efficiency_bin`**: Computes global efficiency for binary graphs.
*   **`participation_coef_b*`**: Measures of node participation in community structure.
*   **`threshold_proportional` / `binarize`**: Network preprocessing and filtration functions.
*   **`NBS` (Network Based Statistic)**: Statistical method for comparing connectivity matrices.
*   **`latmio_und_connected`**: Graph randomization/null model generation.
*   **`clustering_coef_bu`**: Clustering coefficient calculation for binary undirected networks.

### 3. Data Flow
*   **Input**: Generally processes graph data represented as adjacency matrices (sparse or dense).
*   **Processing**: The repository focuses on converting MATLAB-based BCT algorithms to Python, involving matrix indexing, floating-point optimization, and graph manipulation.
*   **Output**: Returns network metrics, statistical test results, and processed graph structures.

### 4. Dependencies
*   **NumPy**: Heavily used for matrix manipulation (`np.fill_diagonal`, `np.round`).
*   **NetworkX**: Mentioned as a dependency for certain algorithms (e.g., `get_components`), with some modules refactored to remove this dependency.

### 5. Analysis Methods
The repository implements standard graph-theoretical and neuroimaging statistics:
*   **Graph Metrics**: Clustering coefficients, global efficiency, rich-club coefficients.
*   **Community Detection**: Louvain algorithm, consensus clustering.
*   **Null Models**: Statistical generation of randomized networks for significance testing.
*   **Statistical Inference**: Network Based Statistic (NBS) and paired-sample test statistics (`sviter`).

### 6. Figures/Outputs
The log does not list specific figures; however, the primary "outputs" are numerical matrices or scalars representing topological features of brain connectivity networks.

### 7. Key Parameters
*   **`copy`**: A boolean argument (default `True`) introduced to control memory handling and immutability in functions like `threshold_proportional` and `binarize`.
*   **Randomization Seeds**: Mentioned as an "in-progress" feature to ensure reproducibility in stochastic functions.
*   **Floating-point precision**: Mentioned in the context of rounding behavior (`np.round` vs. BCT standard) to ensure consistency with the original MATLAB implementation.

---

## README.md

This analysis covers the `README.md` file for the **Brain Connectivity Toolbox for Python (`bctpy`)**, a scientific repository aimed at translating MATLAB graph theory tools into Python.

### 1. Purpose
`bctpy` serves as a Python port of the original MATLAB Brain Connectivity Toolbox, providing researchers with tools to calculate graph-theoretical measures for brain network analysis. It aims to offer a direct, pure-Python translation of the original MATLAB functions, though it remains in beta status.

### 2. Key Functions/Classes
The package provides a suite of functions for analyzing brain connectivity, including:
*   **Graph/Network Metrics:** Calculations for nodal, modular, and global network properties.
*   **Network-Based Statistic (NBS):** A nonparametric statistical test used for identifying differences in undirected weighted graphs between populations.

### 3. Data Flow
*   **Inputs:** Adjacency matrices, which must be provided as `numpy.array` objects rather than `numpy.matrix`. 
*   **Processing:** The package performs mathematical and statistical operations on these matrices, mimicking the logic of the original MATLAB BCT codebase.

### 4. Dependencies
*   **Core:** `numpy` and `scipy` (the latter is required for specific statistical and linear algebra functions).
*   **Optional/Limited:** `networkx` is used for a small number of functions, specifically the Network-Based Statistic (NBS).
*   **Testing:** `nosetests` is utilized for the current (not yet complete) test suite.

### 5. Analysis Methods
*   **Graph Theory:** Implementation of various metrics used to describe the topological structure of brain networks.
*   **Nonparametric Statistics:** The NBS method is explicitly mentioned for comparative analysis between different populations of graphs.
*   **Numerical Methods:** Linear algebra and statistical routines mapped from the original MATLAB BCT source.

### 6. Figures/Outputs
The documentation does not specify any direct visualization or figure generation functions. The outputs are primarily numerical data structures (matrices/vectors of graph metrics) resulting from the input adjacency matrices.

### 7. Key Parameters
*   **Matrix Structure:** The documentation highlights specific constraints regarding adjacency matrices, specifically regarding handling **self-loops** and **negative weights**, which follow the behavior of the original MATLAB implementation.
*   **Data Types:** The user must ensure inputs are `numpy.array` type; the toolbox does not support `numpy.matrix`.

---

## bct/__init__.py

This file serves as the initialization module for the `bct` (Brain Connectivity Toolbox) Python package. Below is the structured analysis:

### 1. Purpose
This file acts as the package entry point, exposing the toolbox's core functionalities to the user and managing academic citations. It ensures that when a user imports the package, they have access to all algorithms, utilities, and Network Based Statistic (NBS) tools while automatically registering required citations.

### 2. Key Functions/Classes
*   **`bct.algorithms`**: Exposed namespace containing graph theory metrics and network analysis functions.
*   **`bct.utils`**: Exposed namespace containing helper functions for matrix manipulation and graph processing.
*   **`bct.nbs`**: Exposed namespace containing implementations of the Network Based Statistic.
*   **`due.cite`**: A function from the `duecredit` framework used to log citations for the toolbox in research workflows.

### 3. Data Flow
*   **Reads**: Imports from sub-modules (`algorithms`, `utils`, `nbs`, `version`, `citations`).
*   **Processes**: Registers bibliographic metadata with the `duecredit` system to track usage in scientific research.
*   **Writes**: Does not directly output data files; however, it exposes functions that read/write connectivity matrices and graph objects.

### 4. Dependencies
*   **Internal**: `.algorithms`, `.utils`, `.nbs`, `.version`, `.citations`.
*   **External**: `duecredit` (implied by the `due` module usage) for automated citation tracking.

### 5. Analysis Methods
*   While this file does not implement specific statistical methods itself, it acts as a gateway to the library’s scientific methods, which include:
    *   **Graph Theory Metrics**: Clustering coefficients, centrality, path lengths, modularity, etc.
    *   **Statistical Inference**: Network Based Statistic (NBS) for analyzing group differences in connectomes.

### 6. Figures/Outputs
*   **Outputs**: None. This is a package initialization file and does not generate visualizations directly.

### 7. Key Parameters
*   **`__version__` / `__version_info__`**: Metadata parameters identifying the current release of the toolbox.
*   **`BCTPY` / `RUBINOV2010`**: Constant parameters holding the BibTeX citation strings for the toolbox and the foundational Rubinov & Sporns (2010) paper.

---

## bct/algorithms/__init__.py

This file is the `__init__.py` module for the `bct/algorithms/` directory within the Brain Connectivity Toolbox (BCT) research repository.

### 1. Purpose
This file serves as the package interface for the `algorithms` submodule. It exposes all core network analysis functions located in the sub-modules to the top-level package, allowing users to access connectivity metrics through a unified namespace.

### 2. Key Functions/Classes
This file does not contain functional logic itself; instead, it imports and exports the following algorithmic modules:
*   **Centrality**: Node importance metrics (e.g., betweenness, closeness).
*   **Clustering**: Metrics for node and network segregation (e.g., clustering coefficients).
*   **Efficiency**: Measures of network integration and information flow.
*   **Generative**: Models for creating synthetic brain-like networks.
*   **Modularity**: Community detection and partition analysis.
*   **Core**: Fundamental structural metrics (e.g., density, node degree).
*   **Motifs**: Analysis of repeating sub-graph patterns.
*   **Physical Connectivity**: Metrics accounting for distance and spatial embedding.
*   **Reference**: Methods for creating null models (randomized graphs).
*   **Similarity**: Comparing graph structures and topological profiles.

### 3. Data Flow
*   **Inputs**: Receives connectivity matrices (usually adjacency/weight matrices representing brain networks).
*   **Outputs**: Provides access to calculated network metrics and statistical properties of graphs.

### 4. Dependencies
*   **Internal**: Depends on the entire suite of Python files within the `bct/algorithms/` directory.
*   **External**: Indirectly relies on standard scientific computing libraries (typically `numpy` and `scipy`) required by the imported sub-modules for matrix operations and graph theory calculations.

### 5. Analysis Methods
The file consolidates a comprehensive range of graph-theoretic and network neuroscience methods, including:
*   Graph partitioning and spectral clustering.
*   Pathfinding and distance estimation.
*   Null model generation (shuffling algorithms for statistical significance testing).
*   Information flow and efficiency modeling.

### 6. Figures/Outputs
*   **None**: This is an administrative structural file. It does not generate visual outputs or plots directly; those are performed by the specific function calls within the imported sub-modules.

### 7. Key Parameters
*   **None**: As an `__init__.py` file, it does not define parameters. The parameters are defined at the function level within the individual imported modules (e.g., binary/weighted flags, normalization constants, iteration counts for randomization).

---

## bct/algorithms/centrality.py

### Analysis Report: `bct/algorithms/centrality.py`

#### 1. Purpose
This file provides a collection of graph-theoretical algorithms designed to compute various centrality measures and structural properties for complex networks. It supports both binary and weighted, directed and undirected graphs, facilitating the analysis of nodal importance and network topology.

#### 2. Key Functions
*   **`betweenness_bin` / `betweenness_wei`**: Calculates node betweenness centrality for binary and weighted graphs, respectively, representing the fraction of shortest paths passing through a node.
*   **`edge_betweenness_bin` / `edge_betweenness_wei`**: Computes edge betweenness centrality for binary and weighted networks.
*   **`diversity_coef_sign`**: Computes Shannon-entropy-based diversity coefficients for nodes, measuring the distribution of intermodular connections in networks with positive/negative weights.
*   **`eigenvector_centrality_und`**: Calculates eigenvector centrality for undirected networks based on the leading eigenvector of the adjacency matrix.
*   **`erange`**: Identifies "shortcut" edges by evaluating the change in shortest path lengths following the removal of specific edges (based on Watts' treatment).
*   **`flow_coef_bd`**: Computes the flow coefficient (local network flow) for nodes in a binary directed graph.

#### 3. Data Flow
*   **Inputs**: Expects square NumPy arrays (`NxN` matrices) representing connectivity or distance matrices. Some functions also accept community affiliation vectors (`ci`).
*   **Processing**: Functions iteratively traverse graph structures (using BFS or shortest-path accumulators), compute path dependencies, and perform matrix operations (e.g., eigenvalue decomposition).
*   **Outputs**: Returns vectors (`Nx1` for node-specific measures) or matrices (`NxN` for edge/pair-specific measures) containing the calculated centrality values.

#### 4. Dependencies
*   **Internal**: `bct.core` (k-core algorithms), `bct.distance` (reachability/distance), `bct.utils` (inversion/error handling), `bct.due` (citation tracking).
*   **External**: `numpy` (core array operations), `scipy.linalg` (for `eigenvector_centrality_und`).

#### 5. Analysis Methods
*   **Brandes' Algorithm**: Used as the foundational method for efficient computation of betweenness centrality.
*   **Information Theory**: Shannon entropy is employed in `diversity_coef_sign` to quantify connectivity diversity.
*   **Linear Algebra**: Eigenvalue decomposition via SciPy is used for centrality rankings.
*   **Path Analysis**: Implementation of shortest-path accumulation and distance calculations (e.g., Dijkstra-like logic for weighted networks).

#### 6. Figures/Outputs
*   The script does **not** generate plots or visual figures directly. It returns structured numerical data (arrays/floats) intended for further quantitative analysis or visualization in downstream pipelines.

#### 7. Key Parameters
*   **`G` / `CIJ`**: The primary adjacency or distance matrix.
*   **`ci`**: Community affiliation vector (used for modularity-based calculations).
*   **Weighting**: The algorithms explicitly distinguish between binary (unweighted) and weighted implementations, necessitating correctly formatted inputs (e.g., connection-length matrices for weighted betweenness).

---

## bct/algorithms/clustering.py

This analysis covers `bct/algorithms/clustering.py` from the Brain Connectivity Toolbox (BCT) Python repository.

### 1. Purpose
This module implements various clustering-related algorithms for network analysis, specifically focusing on computing clustering coefficients for different graph types (directed/undirected, binary/weighted) and calculating consensus partitions from agreement matrices.

### 2. Key Functions/Classes
*   **`agreement` / `agreement_weighted`**: Aggregates multiple vertex partitions into an agreement matrix that quantifies how often node pairs appear in the same community.
*   **`clustering_coef_bd` / `clustering_coef_bu`**: Calculates the clustering coefficient for binary directed and undirected graphs, respectively.
*   **`clustering_coef_wd` / `clustering_coef_wu`**: Calculates the clustering coefficient for weighted directed and undirected graphs.
*   **`clustering_coef_wu_sign`**: Computes weighted clustering coefficients for signed networks using three distinct algorithmic variations (Default, Zhang, and Costantini).
*   **`consensus_und`**: Performs an iterative process of thresholding an agreement matrix and re-clustering to identify a robust consensus community partition.

### 3. Data Flow
*   **Inputs**: Primarily expects adjacency matrices (as `NxN` NumPy arrays) for graphs, or partition matrices (`NxM`) for consensus/agreement calculations.
*   **Processing**: Uses linear algebra (matrix dot products, diagonal extraction, sum reductions) and topological operations to calculate coefficients and agreement metrics.
*   **Outputs**: Returns node-specific vector arrays (`Nx1`) for clustering coefficients or square matrices (`NxN`) for agreement/consensus calculations.

### 4. Dependencies
*   **External**: `numpy`
*   **Internal**:
    *   `bct.modularity`: Uses `modularity_louvain_und_sign`.
    *   `bct.utils`: Uses `cuberoot`, `BCTParamError`, `dummyvar`, `binarize`, `get_rng`.
    *   `bct.distance`: Uses `breadthdist`, `distance_wei_floyd`, `retrieve_shortest_path`.
    *   `bct.due` / `bct.citations`: Manages academic references (BibTeX) for documented methods.

### 5. Analysis Methods
*   **Clustering Coefficients**: Methods based on triangle counting and normalized intensity, referencing foundational network science papers (Watts & Strogatz 1998, Onnela et al. 2005, Fagiolo 2007).
*   **Signed Clustering**: Implements domain-specific logic to handle positive and negative weights, including methods for adjusting sensitivity via the Zhang or Costantini approaches.
*   **Consensus Clustering**: An iterative re-clustering approach to find stable partitions, inspired by the Lancichinetti & Fortunato (2012) framework.

### 6. Figures/Outputs
*   The module does **not** generate graphical plots or visualization figures.
*   Outputs are raw numerical data: square `NxN` matrices representing agreement or `Nx1` vectors representing node-wise metrics.

### 7. Key Parameters
*   **`buffsz`**: Used in `agreement` to manage memory usage by processing partitions in chunks.
*   **`tau`**: Threshold parameter in `consensus_und` to remove weak connections in the agreement matrix.
*   **`coef_type`**: Toggle in `clustering_coef_wu_sign` to switch between 'default', 'zhang', and 'costantini' calculation methodologies.
*   **`reps`**: Number of repetitions for the consensus clustering algorithm.

---

## bct/algorithms/core.py

This file, `bct/algorithms/core.py`, is a component of the Brain Connectivity Toolbox (BCT) focused on calculating core structural properties of graphs, including assortativity, core-periphery structure, k-core decomposition, and rich-club coefficients.

### 1. Purpose
This module implements fundamental network analysis metrics used to quantify structural topology in both binary and weighted, directed and undirected networks. It provides tools for identifying hubs, dense core-periphery subdivisions, and connectivity tendencies across different node degrees or strengths.

### 2. Key Functions/Classes
*   **`assortativity_bin` / `assortativity_wei`**: Calculates the assortativity coefficient, measuring the correlation between node degrees (binary) or strengths (weighted).
*   **`core_periphery_dir`**: Identifies the optimal core-periphery partition of a directed network using a Kernighan-Lin based optimization algorithm.
*   **`kcore_bd` / `kcore_bu`**: Performs k-core decomposition by iteratively removing nodes with degree less than $k$ (supports directed and undirected graphs).
*   **`local_assortativity_wu_sign`**: Calculates local assortativity in weighted, signed networks (positive/negative weights).
*   **`rich_club_bd`**: Computes the rich-club coefficient, representing the tendency of high-degree nodes to form a highly interconnected sub-network.

### 3. Data Flow
*   **Inputs**: Primarily takes connection matrices (`CIJ` or `W`) as `NxN numpy.ndarray` objects.
*   **Processes**: Transforms connection matrices using various graph-theoretic metrics, often involving row/column index slicing, degree/strength calculations, and optimization loops.
*   **Outputs**: Returns network metrics as scalars (e.g., assortativity coefficient), vectors (e.g., rich-club coefficients), or modified adjacency matrices (e.g., k-core subgraphs).

### 4. Dependencies
*   **Libraries**: `numpy`
*   **Internal Utilities**: `..utils.miscellaneous_utilities` (RNG, error handling), `..utils.other` (binarization), `..citations` (bibliography tracking).
*   **BCT Modules**: `degree.py` (for calculating degrees/strengths), `clustering.py`.

### 5. Analysis Methods
*   **Assortativity Coefficient**: Correlation between node properties at opposite ends of links.
*   **Kernighan-Lin Optimization**: Used in `core_periphery_dir` to maximize the core-structure objective function.
*   **k-Core Decomposition**: Recursive pruning algorithm to find the largest subset of nodes with a minimum degree threshold.
*   **Rich-Club Analysis**: Calculation of sub-graph density for high-degree node subsets.

### 6. Figures/Outputs
*   This module does not generate graphical plots; it returns numerical results (floats, arrays, and tuples) intended for further analysis or downstream visualization in other scripts.

### 7. Key Parameters
*   **`flag`**: Determines the specific type of degree/strength correlation calculation (e.g., out-degree vs. in-degree).
*   **`gamma`**: A resolution parameter in `core_periphery_dir` that adjusts the sensitivity to core size (high $\gamma$ = small core, low $\gamma$ = large core).
*   **`k` / `klevel`**: Threshold parameters for k-core and rich-club calculations, defining the degree level of interest.
*   **`seed`**: Controls randomness for the stochastic core-periphery optimization.

---

## bct/algorithms/degree.py

This analysis covers the `bct/algorithms/degree.py` file, which is a component of the Brain Connectivity Toolbox (BCT) implementation in Python.

### 1. Purpose
This file provides foundational graph-theoretical measures for network analysis, specifically calculating node degrees (for binary networks) and node strengths (for weighted networks) in both directed and undirected connectivity matrices.

### 2. Key Functions
*   **`degrees_dir(CIJ)`**: Calculates in-degree, out-degree, and total degree for directed binary networks.
*   **`degrees_und(CIJ)`**: Calculates the node degree for undirected binary networks.
*   **`jdegree(CIJ)`**: Computes the joint degree distribution matrix for directed networks, classifying nodes by the balance between their in-degree and out-degree.
*   **`strengths_dir(CIJ)`**: Calculates the total nodal strength (sum of incoming and outgoing weights) for directed weighted networks.
*   **`strengths_und(CIJ)`**: Calculates the total nodal strength for undirected weighted networks.
*   **`strengths_und_sign(W)`**: Separates and calculates nodal strengths for positive and negative weights in undirected networks.

### 3. Data Flow
*   **Inputs**: Accepts $N \times N$ adjacency matrices (NumPy arrays).
*   **Processing**:
    *   For degree functions: Matrices are automatically binarized using `binarize()` to discard weight information.
    *   For strength functions: Raw weights are maintained and summed along axes.
*   **Outputs**: Returns 1D NumPy arrays (shape $N \times 1$) representing nodal metrics, or specific scalar/matrix summaries (e.g., joint degree distribution matrix).

### 4. Dependencies
*   **`numpy`**: Used for array manipulations, summation, and diagonal operations.
*   **`bct.utils.binarize`**: A utility function from the local repository used to force input matrices into binary (0 or 1) form.

### 5. Analysis Methods
*   **Graph Theory (Degree Centrality)**: Computes the topological importance of nodes based on link count.
*   **Joint Degree Distribution**: Maps the relationship between in-degree and out-degree to categorize nodes as "in-hubs," "out-hubs," or balanced nodes.
*   **Weighted Network Analysis**: Aggregates link weights to identify nodal influence in non-binary networks, including distinct handling for signed (positive/negative) weights.

### 6. Figures/Outputs
*   This module is strictly computational; it **does not generate plots or visual figures**. It returns numerical data structures (arrays/scalars) for further analysis by the user.

### 7. Key Parameters
*   **`CIJ` / `W`**: The $N \times N$ connectivity matrix representing the graph structure. The code assumes nodes are ordered along the columns/rows.
*   **`axis`**: Used in `np.sum` to toggle between calculating incoming (column-wise) and outgoing (row-wise) connectivity.

---

## bct/algorithms/distance.py

### Analysis of `bct/algorithms/distance.py`

This file is a core component of the Brain Connectivity Toolbox (BCT) Python implementation, focusing on graph-theoretic distance calculations within complex networks.

#### 1. Purpose
This module provides a suite of algorithms to compute shortest path lengths, reachability, global network efficiency, and path-finding metrics for both binary and weighted graphs. It serves as the primary library for quantifying communication costs and routing topology in brain networks.

#### 2. Key Functions/Classes
*   **`breadth` / `breadthdist`**: Implements Breadth-First Search (BFS) to compute shortest path distances and reachability in binary networks.
*   **`charpath`**: Calculates characteristic path length, global efficiency, eccentricity, radius, and diameter of a network.
*   **`distance_bin`**: Computes shortest paths in binary networks using algebraic (matrix multiplication) methods.
*   **`distance_wei`**: Computes weighted shortest paths and the number of edges in those paths using Dijkstra’s algorithm.
*   **`distance_wei_floyd`**: Implements the Floyd-Warshall algorithm to find all-pairs shortest paths in weighted networks; includes support for log/inverse transforms.
*   **`retrieve_shortest_path`**: Backtracks through a predecessor matrix (`Pmat`) generated by Floyd-Warshall to reconstruct the node sequence of a shortest path.
*   **`cycprob`**: Analyzes the probability of path cycles of varying lengths.

#### 3. Data Flow
*   **Inputs**: Primarily takes square connection matrices (`CIJ` or `adjacency`) as `numpy.ndarray`. Weighted variants accept length matrices or weight matrices (with specified transforms).
*   **Processes**: Transforms connection weights to lengths (if needed), executes iterative path-finding algorithms (BFS, Dijkstra, or Floyd-Warshall), and aggregates connectivity data.
*   **Outputs**: Returns distance/reachability matrices, path hop counts, predecessor matrices, or scalars representing global network properties (path length, efficiency, etc.).

#### 4. Dependencies
*   **Standard Library**: `numpy`.
*   **Repo Dependencies**: `bct.utils` (for `binarize`, `BCTParamError`, `invert`, `logtransform`) and `bct.due/citations` (for tracking scientific attribution).

#### 5. Analysis Methods
*   **Graph Theory**: Breadth-First Search (BFS), Dijkstra’s algorithm, and the Floyd-Warshall algorithm.
*   **Metrics**: Characteristic Path Length, Global Efficiency, Eccentricity, Radius, Diameter, and Cycle Probability.
*   **Data Transformation**: Logarithmic and inverse mappings for converting connectivity weights into interpretable physical "lengths."

#### 6. Figures/Outputs
*   This module does **not** generate plots or visual figures directly. It returns structured numerical arrays (e.g., $N \times N$ matrices) and scalars suitable for further analysis or visualization in external plotting libraries.

#### 7. Key Parameters
*   `transform`: (in `distance_wei_floyd`) Specifies how to convert connection weights to lengths; options include `'log'` and `'inv'`.
*   `include_diagonal`: (in `charpath`) Boolean to decide whether to incorporate self-loops/diagonal values in average path calculations.
*   `qmax`: (in `findpaths`) Defines the maximum path length for search algorithms.
*   `source`: (in `breadth`) The starting vertex index for BFS operations.

---

## bct/algorithms/efficiency.py

This file is a module within the Brain Connectivity Toolbox (BCT) implementation, providing a suite of algorithms to compute network efficiency measures.

### 1. Purpose
This module calculates various metrics of "efficiency" for network graphs, including global, local, diffusion, resource, and routing efficiency. These measures quantify how efficiently information or resources propagate through a network, with versions tailored for both binary and weighted graph architectures.

### 2. Key Functions
*   **`efficiency_bin`**: Computes binary global or local efficiency.
*   **`efficiency_wei`**: Computes weighted global or local efficiency, including an improved algorithm by Wang et al. (2016).
*   **`diffusion_efficiency`**: Calculates efficiency based on the Mean First Passage Time (MFPT) of a random walker.
*   **`resource_efficiency_bin`**: Estimates the amount of resources required for a particle to arrive at a target node within the shortest path length.
*   **`rout_efficiency`**: Computes routing efficiency (the average inverse shortest path length) and its local variant.

### 3. Data Flow
*   **Input**: Takes adjacency matrices (NxN `numpy.ndarray`) representing connections or lengths, along with configuration flags (like `local` or `lamb`).
*   **Processing**: Converts matrices into distance matrices (using Floyd-Warshall or BFS), computes topological metrics, and applies inverse transformations.
*   **Output**: Returns scalars (global efficiency) or arrays (node-specific local efficiency vectors or NxN efficiency matrices).

### 4. Dependencies
*   **Libraries**: `numpy`
*   **BCT Utils**: `cuberoot`, `BCTParamError`, `binarize`, `invert` (from `bct.utils`).
*   **Internal Dependencies**: `distance.distance_wei_floyd`, `distance.mean_first_passage_time`.
*   **Metadata**: `due` and `citations` modules for tracking academic references.

### 5. Analysis Methods
*   **Shortest Path Calculation**: Uses iterative path counting and Dijkstra’s algorithm to determine communication lengths.
*   **Random Walk Theory**: Uses Mean First Passage Time (MFPT) to evaluate diffusion efficiency.
*   **Probabilistic Modeling**: Uses transition probability matrices and logarithmic resource requirements to evaluate node-to-node resource efficiency.
*   **Normalization**: Applies cube-root and inverse transformations to handle weights as connection lengths.

### 6. Figures/Outputs
*   This module **does not generate plots or visual figures**. It returns numerical data structures (floats, vectors, and matrices) to be used for further statistical analysis or visualization by other modules.

### 7. Key Parameters
*   **`local` (bool/str)**: Determines whether to compute the network-wide average efficiency or node-specific neighborhood efficiency (supports specific algorithmic versions like `'original'` vs `'recommended'`).
*   **`lamb` (float)**: The probability threshold parameter used in resource efficiency calculations (must be $0 < \lambda < 1$).
*   **`transform` (str)**: Used in routing efficiency to define how raw weights are converted to lengths (e.g., `'log'` or `'inv'`).

---

## bct/algorithms/generative.py

### Analysis Summary: `bct/algorithms/generative.py`

#### 1. Purpose
This module implements generative network modeling based on the framework proposed by Betzel et al. (2016). It creates synthetic graphs by iteratively adding edges between nodes based on a probability function derived from spatial distance and topological features.

#### 2. Key Functions/Classes
*   **`generative_model`**: The primary entry point. It manages the configuration, initializes the network, and delegates to the appropriate model-specific generation function based on the selected `model_type`.
*   **Generation Helpers**: Several internal functions (e.g., `clu_gen`, `deg_gen`, `matching_gen`, `neighbors_gen`, `euclidean_gen`) handle the logic for specific generative rules (clustering-based, degree-based, matching index, common neighbors, and spatial distance only).
*   **Topological Transform Helpers**: Functions like `k_avg`, `k_diff`, `k_prod`, etc., serve as interface wrappers to define how node-level statistics are transformed into pairwise "basis" values ($K$) for the generative formula.

#### 3. Data Flow
*   **Input**: Takes an initial binary network (`A`), a distance matrix (`D`), and desired edge count (`m`).
*   **Processing**: Calculates initial node-based statistics (clustering, degree, etc.), computes an edge-probability matrix ($P(u, v)$), and iteratively samples edges based on these probabilities.
*   **Update**: As edges are added, the code dynamically updates the topological metrics (e.g., recomputing clustering coefficients) and the probability matrix until the target edge count ($m$) is reached.
*   **Output**: Returns the synthetic binary adjacency matrix.

#### 4. Dependencies
*   **Core Libraries**: `numpy`.
*   **BCT Utilities**: `bct.utils` (`BCTParamError`, `get_rng`).
*   **Internal BCT**: 
    *   `bct.algorithms.similarity` (`matching_ind`)
    *   `bct.algorithms.clustering` (`clustering_coef_bu`)
    *   `bct.algorithms.centrality` (`betweenness_bin`)
    *   `bct.due` and `bct.citations` for attribution/provenance.

#### 5. Analysis Methods
*   **Generative Modeling**: Implements models defined by $P(u,v) = E(u,v)^\eta \cdot K(u,v)^\gamma$ (power law) or $P(u,v) = \exp(E(u,v)\cdot\eta) \cdot \exp(K(u,v)\cdot\gamma)$ (exponential).
*   **Iterative Sampling**: Uses cumulative distribution functions (via `cumsum` and uniform random sampling) to select new edges based on the calculated probability weights.
*   **Topological Metrics**: Incorporates local graph metrics such as clustering coefficients and degree sequences into the edge-formation process.

#### 6. Figures/Outputs
*   No figures are generated. The function returns a `numpy.ndarray` representing the final synthetic adjacency matrix.

#### 7. Key Parameters
*   **`A`**: Seed network.
*   **`D`**: Pairwise distance matrix (spatial constraint).
*   **`m`**: Total number of connections to reach in the output network.
*   **`eta` / `gamma`**: Hyperparameters controlling the trade-off between spatial distance and topological structure.
*   **`model_type`**: Defines the topological rule (e.g., `matching`, `clu-avg`, `deg-max`).
*   **`model_var`**: Defines the mathematical formulation (`powerlaw` vs `exponential`).

---

## bct/algorithms/models.py

This analysis pertains to the `bct/algorithms/models.py` file within the Brain Connectivity Toolbox (BCT) repository.

### 1. Purpose
The file provides algorithmic implementations for generating null model networks that satisfy specific structural constraints (e.g., node strength, module affiliation). These models are used in network neuroscience to create unbiased ensembles for statistical comparison against empirical connectivity matrices.

### 2. Key Functions/Classes
*   **`mleme_constraint_model`**: A function designed to return an ensemble of networks sampled to satisfy weighted node-strength and module-weight constraints. (Note: The current implementation is a stub raising a `NotImplementedError`).

### 3. Data Flow
*   **Input**: Takes a connectivity matrix `W` (NxN directed/weighted), along with vectors for module affiliations (`ci`) and strength constraints (`lo`, `li`, `lm`).
*   **Output**: Generates a multi-dimensional array `W0` (NxNxnr_samples) representing the sampled network ensemble, along with expected weights (`E0`), probability matrices (`P0`), and a convergence error metric (`delt0`).

### 4. Dependencies
*   **External**: `numpy` (for matrix operations and random state management).
*   **Internal**: 
    *   `bct.utils`: Uses `BCTParamError` for error handling and `get_rng` for reproducible random sampling.
    *   `..due`: Uses `due` and `BibTex` utilities for academic attribution and citation tracking.

### 5. Analysis Methods
*   **Maximum Likelihood Ensemble (MLEME)**: The function name implies the use of a Maximum Likelihood Estimation approach for network generation. This method typically involves finding a probability distribution that maximizes the entropy given the constraints, ensuring the ensemble is "unbiased" regarding features not explicitly constrained.
*   **Stochastic Sampling**: Uses a random state (`rng`) to generate the ensemble of networks based on the probability matrix.

### 6. Figures/Outputs
*   The function does not generate visual plots or figures. It returns numerical structures: a 3D ensemble array (`W0`), the expected weight matrix (`E0`), the probability matrix (`P0`), and the convergence error (`delt0`).

### 7. Key Parameters
*   **`nr_samples`**: Defines the size of the generated network ensemble.
*   **`W`**: The empirical connectivity matrix (requires non-negative integers).
*   **`ci`**: Module affiliation vector for defining community structures.
*   **`lo`/`li`**: Logical/boolean constraints for out-strength and in-strength preservation at the node level.
*   **`lm`**: Configuration for module-level constraints (e.g., intra-module vs. inter-module weighting).
*   **`seed`**: Optional parameter for controlling the randomness of the simulation, ensuring reproducibility.

---

## bct/algorithms/modularity.py

This analysis covers the `bct/algorithms/modularity.py` file, a component of the Brain Connectivity Toolbox (BCT).

### 1. Purpose
This module implements community detection algorithms for complex networks, specifically providing multi-iterative versions of the Louvain method and hierarchical link-based community detection.

### 2. Key Functions/Classes
*   **`community_louvain`**: A robust, fast implementation for finding optimal community structures in weighted/binary, directed/undirected networks using modularity-based objective functions.
*   **`link_communities`**: Detects overlapping community structures by performing hierarchical clustering on network links rather than nodes.
*   **`ci2ls` / `ls2ci`**: Utility functions to convert between community index vectors and Python list representations of modules.

### 3. Data Flow
*   **Inputs**: Primarily takes an adjacency matrix (`W`), which represents network connectivity.
*   **Processing**:
    *   `community_louvain` iterates by locally optimizing modularity and then aggregating nodes into new meta-nodes to refine the partition.
    *   `link_communities` computes edge similarity scores (Jaccard similarity) and progressively merges link clusters based on density criteria.
*   **Outputs**: Returns community index vectors (1D arrays) representing node-to-module assignments or binary membership matrices for overlapping communities.

### 4. Dependencies
*   **Internal**: `bct.utils` (for error handling, normalization, and random number generation).
*   **External**: `numpy` (for heavy matrix/array manipulation).
*   **Citations**: References research (Blondel, Reichardt, etc.) through a `citations` module.

### 5. Analysis Methods
*   **Louvain Algorithm**: A heuristic method for maximizing network modularity (and other objective functions like the Potts model) via iterative local search and community aggregation.
*   **Link Clustering**: A hierarchical approach that identifies communities of edges, allowing for overlapping node participation (a node can belong to multiple communities if it connects to edges in different clusters).
*   **Objective Functions**: Supports various modularity metrics including standard Q-metric, Potts Hamiltonian, and specialized methods for treating negative weights (symmetric/asymmetric).

### 6. Figures/Outputs
*   The functions do not generate plots or visual figures. They return numerical structures (indices/matrices) intended for subsequent quantitative network analysis or diagnostic visualization in other modules.

### 7. Key Parameters
*   **`gamma`**: The resolution parameter in `community_louvain`; controls the scale of detected modules (higher values yield smaller, more numerous modules).
*   **`B`**: The objective function identifier (or custom matrix), defining what "modularity" means for the specific analysis.
*   **`type_clustering`**: Defines the linkage criteria ('single' vs. 'complete') for the hierarchical clustering in link-community detection.
*   **`seed`**: Controls the random number generator state for reproducible stochastic clustering results.

---

## bct/algorithms/motifs.py

This file is part of the Brain Connectivity Toolbox (BCT) and implements network motif analysis for directed, weighted, and binary graphs.

### 1. Purpose
The module identifies and analyzes the frequency, intensity, and coherence of 3-node and 4-node subgraphs (motifs) within complex networks, specifically focusing on structural and functional motif characterizations as described in Onnela et al. (2005).

### 2. Key Functions
*   **`find_motif34`**: A utility to map motif IDs to their corresponding adjacency matrices or vice-versa for 3 or 4-node motifs.
*   **`make_motif34lib`**: Generates a local MATLAB file (`motif34lib.mat`) containing the canonical classification of all possible 3 and 4-node directed subgraphs.
*   **`motif3funct_bin` / `motif3funct_wei`**: Calculates the frequency (binary) or intensity/coherence (weighted) of motifs around nodes based on functional connectivity logic.
*   **`motif3struct_bin` / `motif3struct_wei`**: Similar to the functional versions but calculates metrics based on structural connectivity definitions.

### 3. Data Flow
*   **Reads**: Loads graph adjacency matrices (N x N arrays) as input. Reads `motif34lib.mat` (a library of precomputed subgraph templates) to identify and classify subgraphs during the search process.
*   **Processes**: Iterates through all possible triplets (and quadruplets, where supported) in the graph, identifies the subgraph structure, and matches it against the motif library to categorize it into one of the 13 defined 3-node motif classes.
*   **Writes**: Returns matrices of motif metrics (Frequency, Intensity, Coherence) of size $13 \times N$, representing the prevalence or strength of each of the 13 motif types for each node.

### 4. Dependencies
*   **Standard/Scientific**: `numpy`, `scipy.io`, `os`.
*   **Internal**: `bct.utils` (for `binarize` and `BCTParamError`), `bct.citations` (for bibliographic tracking via `due`).

### 5. Analysis Methods
*   **Motif Classification**: Uses canonical labels based on subgraph connectivity properties (degree distributions) to identify motif types.
*   **Weighted Generalizations**: Implements intensity (geometric mean of weights) and coherence (ratio of geometric to arithmetic mean) to characterize the "strength" and "consistency" of specific motif patterns in weighted networks.

### 6. Figures/Outputs
*   **Outputs**: Returns numerical arrays (motif frequency, intensity, and coherence matrices).
*   **Note**: The code performs internal calculations to determine motif metrics but does not produce visual plots or figures directly.

### 7. Key Parameters
*   **`m`**: Motif ID or motif matrix.
*   **`n`**: Motif class (number of nodes, typically 3 or 4).
*   **`A` / `W`**: Binary or weighted adjacency matrices, respectively, representing the input brain network.

---

## bct/algorithms/physical_connectivity.py

This file is part of the Brain Connectivity Toolbox (BCT) and provides utility functions for calculating graph density and assessing the physical embedding of networks via Rentian scaling.

### 1. Purpose
This module provides functions to calculate basic graph density for directed and undirected networks and to perform Rentian scaling analysis, which assesses how efficiently a network is embedded within a physical coordinate space.

### 2. Key Functions/Classes
*   **`density_dir(CIJ)`**: Calculates the density of a directed, unweighted/weighted connection matrix.
*   **`density_und(CIJ)`**: Calculates the density of an undirected, unweighted/weighted connection matrix.
*   **`rentian_scaling(A, xyz, n, seed)`**: Estimates Rentian scaling by partitioning a graph into random cubes and calculating the relationship between the number of nodes inside a partition ($N$) and the edges crossing the boundary ($E$).

### 3. Data Flow
*   **Input**: Takes adjacency matrices (`NxN` arrays) and, for Rentian scaling, spatial coordinate arrays (`Nx3` arrays).
*   **Processing**:
    *   Density functions convert the matrix to binary and calculate the fraction of existing edges vs. total possible connections.
    *   `rentian_scaling` iteratively generates random 3D partitions, identifies nodes within those spatial bounds, and counts boundary-crossing edges using index slicing.
*   **Output**: Returns density metrics (scalar floats) or arrays of partition data ($N$ and $E$ vectors) used to derive the Rent's exponent.

### 4. Dependencies
*   **`numpy`**: Standard numerical processing.
*   **`..utils.miscellaneous_utilities.get_rng`**: Local utility for managing random number generator states.

### 5. Analysis Methods
*   **Graph Density**: Computed as the ratio of present edges to the total possible edges in the graph ($N^2-N$ for directed; $(N^2-N)/2$ for undirected).
*   **Rentian Scaling**: A "topo-physical" analysis method. It involves log-log regression of the relationship between internal node counts and boundary edge counts. The slope of this regression (Rent's exponent) indicates the spatial cost-efficiency of the network's wiring.

### 6. Figures/Outputs
*   The module does not generate plots directly, but provides the raw `N` and `E` data required to produce a **log-log plot**. The docstrings recommend using a robust fitting method (e.g., `robustfit`) on the output to determine the Rent's exponent.

### 7. Key Parameters
*   **`CIJ` / `A`**: The connectivity (adjacency) matrix of the network.
*   **`xyz`**: Physical coordinates (for Rentian scaling).
*   **`n`**: The number of partitions to generate; the docstring suggests `n=5000` (consistent with literature like *Bassett et al., 2010*).
*   **`seed`**: Optional parameter for reproducibility of the random spatial partitions.

---

## bct/algorithms/reference.py

### File Analysis: `bct/algorithms/reference.py`

#### 1. Purpose
This file provides algorithms to "latticize" networks (both directed and undirected, connected and unconnected). Latticization transforms a given network into a lattice-like structure while preserving its degree distribution (or out-strength distribution in weighted networks), which is a common procedure in benchmarking complex network models.

#### 2. Key Functions
*   **`latmio_dir_connected`**: Latticizes a directed, connected network while preserving in/out-degree distributions and maintaining network connectivity.
*   **`latmio_dir`**: Similar to the above, but does not enforce a strict connectivity constraint, applicable to general directed networks.
*   **`latmio_und_connected`**: Latticizes an undirected, connected network while preserving the degree distribution and ensuring connectivity.
*   **`latmio_und`**: Latticizes a general undirected network while preserving the degree distribution.

#### 3. Data Flow
*   **Inputs**: Reads an $N \times N$ connection matrix (binary or weighted) and an iteration parameter (`itr`). 
*   **Processing**: Applies iterative edge-rewiring techniques. It creates a distance-to-diagonal matrix (`D`) if none is provided to guide the latticization process.
*   **Outputs**: Returns the latticized network in original and permuted node orderings, the permutation index, and the count of successful rewirings (`eff`).

#### 4. Dependencies
*   **Libraries**: `numpy`
*   **Internal Repository Modules**:
    *   `bct.utils`: For parameter validation (`BCTParamError`), matrix operations (`binarize`), random number generation (`get_rng`), and specialized helper functions.
    *   `bct.algorithms.clustering`: Used for the `number_of_components` check.
    *   `bct.citations` & `bct.due`: Manages scientific attribution and tracking.

#### 5. Analysis Methods
*   **Edge Rewiring**: Uses stochastic edge-swapping algorithms (Maslov-Sneppen style) modified by a "lattice condition" (based on distance-to-diagonal metrics) to force the network into a modular, lattice-like topology.
*   **Connectivity Preservation**: Implements breadth-first search logic within the rewiring loop to ensure that proposed edge swaps do not disconnect the graph in the "connected" variants of the functions.

#### 6. Figures/Outputs
*   This module is computational; it returns processed matrices and diagnostic scalars rather than generating visual plots or files.

#### 7. Key Parameters
*   **`R`**: The input adjacency matrix ($N \times N$).
*   **`itr`**: An integer factor determining the number of rewiring attempts; higher values lead to more thorough randomization/latticization.
*   **`D`**: Optional distance-to-diagonal matrix defining the target "lattice" geometry.
*   **`seed`**: Optional seed for reproducibility in random edge selection.

---

## bct/algorithms/similarity.py

### Analysis of `bct/algorithms/similarity.py`

This file is a component of the Brain Connectivity Toolbox (BCT) implementation in Python. It provides a library of functions to calculate various similarity and overlap metrics between nodes or edges in brain network adjacency matrices.

---

#### 1. Purpose
This module implements network-theoretic similarity measures used to quantify the correspondence between connection patterns (node neighborhoods or edge weights) in both directed and undirected graphs. These metrics are fundamental for analyzing community structure, modularity, and topological similarity in neuroimaging data.

#### 2. Key Functions/Classes
*   **`edge_nei_overlap_bd` / `bu`**: Calculates the neighborhood overlap for edges in directed/undirected graphs, identifying "weak ties" (low overlap) and "local bridges."
*   **`gtom`**: Computes the Generalized Topological Overlap Measure (GTOM), which evaluates the similarity of node connection profiles up to a specified path length ($m$).
*   **`matching_ind` / `matching_ind_und`**: Calculates the "matching index" between nodes, a symmetric measure of similarity in connection patterns that excludes direct mutual connections.
*   **`dice_pairwise_und`**: Computes the Dice similarity coefficient for the connection profiles of vertices between two different matrices.
*   **`corr_flat_und` / `corr_flat_dir`**: Performs a correlation analysis on the flattened upper triangular (undirected) or full (directed) segments of two matrices to assess global edgewise similarity.

#### 3. Data Flow
*   **Inputs**: Primarily takes $N \times N$ numpy arrays representing adjacency/connection matrices.
*   **Processing**: Functions compute topological metrics by iterating over node/edge indices and applying set-based operations (intersection/union of neighbors) or linear algebraic operations (dot products).
*   **Outputs**: Returns numpy arrays (matrices/vectors) representing overlap/similarity scores or float scalars (for correlation coefficients).

#### 4. Dependencies
*   **External**: `numpy`.
*   **Internal**:
    *   `bct.utils`: `BCTParamError`, `binarize`.
    *   `bct.algorithms.degree`: `degrees_dir`, `degrees_und`.
    *   `bct.due` / `bct.citations`: Citation management (BibTeX references to YIP2007 and RAVASZ2002 for GTOM).

#### 5. Analysis Methods
*   **Topological Overlap**: Compares the neighborhood sets of nodes or edges using intersection/union ratios.
*   **Generalized Topological Overlap (GTOM)**: Multi-step neighborhood expansion using path-length-based adjacency matrix powers.
*   **Matching Index**: Proportion of shared connections relative to total connections between nodes.
*   **Correlation-based Similarity**: Pearson correlation coefficient applied to flattened adjacency matrices to compare two networks at an edgewise level.

#### 6. Figures/Outputs
*   **Outputs**: The module does not generate visual plots. It returns analytical matrices (`NxN`) representing similarity scores, distance-equivalent matrices, or vectors of similarity per vertex/edge.
*   **Side Effects**: Some functions print status warnings (e.g., `gtom` warns if `nr_steps` exceeds node count).

#### 7. Key Parameters
*   **`nr_steps` (in `gtom`)**: Integer defining the path length considered for neighborhood overlap; higher values consider more distal nodes.
*   **`CIJ` / `adj` / `a1` / `a2`**: The primary $N \times N$ adjacency matrix inputs representing the network structure.

---

## bct/citations.py

This analysis pertains to the `bct/citations.py` file within the `bctpy` (Brain Connectivity Toolbox for Python) repository.

### 1. Purpose
This file serves as a centralized bibliographic repository for the `bctpy` package. It stores citation metadata in BibTeX format to facilitate academic referencing for the various network analysis algorithms implemented in the toolbox.

### 2. Key Functions/Classes
There are no executable functions or classes in this file. It contains a series of **string constants**, each representing a unique scientific paper or software reference formatted as a BibTeX entry.

### 3. Data Flow
*   **Reads**: It imports `__version__` from the local `.version` module.
*   **Processes**: It dynamically injects the package version and the current system date (via `datetime.utcnow()`) into the `BCTPY` citation string.
*   **Writes**: It does not write to files; it provides static data to be accessed by other parts of the package (likely for displaying citation requirements to users).

### 4. Dependencies
*   **Internal**: `bct.version` (for the current package version).
*   **Standard Library**: `datetime` (for generating dynamic metadata in the software citation).

### 5. Analysis Methods
This file does not perform mathematical or statistical analysis. It acts as a supporting metadata module for the algorithms implemented elsewhere in the repository, documenting the theoretical foundations of the tools provided (e.g., Small-world networks, Betweenness centrality, Modularity, PageRank, etc.).

### 6. Figures/Outputs
None. This file generates text-based BibTeX strings intended for programmatic display or export for the end-user.

### 7. Key Parameters
*   `__version__`: The version number of the `bctpy` package, used to generate the correct citation metadata for the software itself.
*   `datestamp`: The current UTC date, used in the `BCTPY` citation note field to document when the user accessed/referenced the library.

---

## bct/due.py

### Analysis of `bct/due.py`

#### 1. Purpose
This file serves as a safe fallback (stub) for the `duecredit` library, ensuring that a scientific codebase remains functional even if `duecredit` is not installed in the environment. It allows developers to decorate functions with citation information without causing runtime errors in the absence of the primary package.

#### 2. Key Functions/Classes
*   **`InactiveDueCreditCollector`**: A mock class that implements the `duecredit` API with no-operation methods. This ensures that any calls to `cite`, `activate`, or `dump` do not crash the program.
*   **`_donothing_func`**: A placeholder function assigned to citation-related objects (`BibTeX`, `Doi`, `Url`, `Text`) when the main library is unavailable.
*   **`due`**: The primary object exposed to the user. It is either the live `duecredit` instance or an instance of `InactiveDueCreditCollector`.

#### 3. Data Flow
*   **Reads**: Attempts to import the external `duecredit` package via `try-except` block.
*   **Processes**: If the import fails, it initializes the local `due` object as an inactive stub.
*   **Writes**: Logs an error message to the `duecredit` logger if an import failure occurs due to reasons other than a standard `ImportError`.

#### 4. Dependencies
*   **`duecredit` (Optional)**: The primary library for scientific citation tracking.
*   **`logging` (Standard Library)**: Used to report unexpected import errors.

#### 5. Analysis Methods
*   **None**: This file does not implement scientific or statistical methods. It is strictly a utility wrapper for software dependency management.

#### 6. Figures/Outputs
*   **None**: This file generates no figures, plots, or processed data outputs.

#### 7. Key Parameters
*   **`__version__`**: String ('0.0.8') indicating the version of the stub file.
*   **`active`**: A boolean flag (set to `False` in the stub) used by the collector to signal the status of the citation system.

---

## bct/nbs.py

This analysis covers `bct/nbs.py`, a core module in the Brain Connectivity Toolbox (BCT) implementation, designed for performing the Network-Based Statistic (NBS).

### 1. Purpose
This file implements the **Network-Based Statistic (NBS)**, a non-parametric statistical method used to identify significant differences in connectivity between two populations of brain networks while controlling for the family-wise error rate. It tests whether sets of connected edges differ between populations by comparing observed component sizes against an empirical null distribution generated through permutation testing.

### 2. Key Functions
*   **`nbs_bct`**: The primary function that executes the NBS workflow, including t-statistic calculation, thresholding, component identification, and permutation testing.
*   **`ttest2_stat_only`**: A helper function that calculates the t-statistic for two independent samples at a specific edge.
*   **`ttest_paired_stat_only`**: A helper function that calculates the t-statistic for paired samples (within-subject comparisons) at a specific edge.

### 3. Data Flow
*   **Input**: Two multi-dimensional arrays (`x` and `y`) of shape `(N, N, P)` and `(N, N, Q)`, representing connectivity matrices for two populations.
*   **Processing**:
    1.  Extracts upper-triangular edges to vectorize the connectivity data.
    2.  Computes t-statistics for each edge across the population.
    3.  Applies a user-defined threshold to identify suprathreshold edges.
    4.  Identifies connected components and computes their sizes.
    5.  Performs $K$ permutations to estimate the null distribution of the maximum component size.
*   **Output**: Returns corrected p-values for identified components, an adjacency matrix labeled by component ID, and the null distribution array.

### 4. Dependencies
*   **`numpy`**: Used for all matrix manipulations and statistical calculations.
*   **Local Modules**:
    *   `.utils` (`BCTParamError`, `get_rng`): Handles error raising and random number generator initialization.
    *   `.algorithms` (`get_components`): Used to identify graph clusters.
    *   `.due` and `.citations` (`ZALESKY2010`): Handles academic citation tracking for the method.

### 5. Analysis Methods
*   **Network-Based Statistic (NBS)**: A graph-theoretical statistical framework (Zalesky et al., 2010).
*   **Two-sample / Paired t-tests**: Used to identify potential edges of interest before cluster-based thresholding.
*   **Permutation Testing**: A non-parametric approach to generate an empirical null distribution and derive corrected p-values for multiple comparisons.

### 6. Figures/Outputs
*   **Console Output**: Prints progress updates on the permutation iterations, the current maximum component size, and intermediate p-value estimations.
*   **Return Values**:
    *   `pval`: Vector of corrected p-values.
    *   `adj`: An `(N, N, C)` adjacency matrix where edges are indexed by component.
    *   `null`: An array containing the empirical null distribution.

### 7. Key Parameters
*   **`thresh`**: The minimum t-value threshold used to identify suprathreshold edges.
*   **`k`**: The number of permutations (default 1000) for null distribution estimation.
*   **`tail`**: Defines the direction of the alternative hypothesis ('left', 'right', or 'both').
*   **`paired`**: Boolean toggle to switch between independent and paired t-tests.
*   **`seed`**: Optional parameter to ensure reproducibility of the permutation results.

---

## bct/nbs_parallel.py

This file contains a parallelized implementation of the Network-Based Statistic (NBS) for neuroimaging data analysis, specifically designed for group-level comparison of connectivity matrices.

### 1. Purpose
The file provides tools to perform the Network-Based Statistic (NBS) to identify connected sub-networks that significantly differ between two groups of connectivity matrices. It leverages parallel processing to compute permutation-based null distributions efficiently.

### 2. Key Functions/Classes
*   **`nbs_bct`**: The main entry point that coordinates the NBS workflow, including thresholding the connectivity data, identifying clusters, performing parallelized permutations, and calculating p-values.
*   **`_permutation`**: A helper function executed by worker processes to compute the maximum component size for a single permutation of the data.
*   **`ttest2_stat_only` / `ttest_paired_stat_only`**: Utility functions for calculating t-statistics for two-sample and paired-sample designs, respectively.

### 3. Data Flow
*   **Input**: Takes two sets of 3D connectivity matrices ($x$ and $y$, dimensions: nodes $\times$ nodes $\times$ subjects).
*   **Processing**: Converts 3D matrices into a vectorized format, computes observed statistics, and generates a null distribution via permutation tests.
*   **Output**: Returns p-values for detected components, the thresholded adjacency matrix, and the null distribution array.

### 4. Dependencies
*   **Standard Library**: `multiprocessing`
*   **External**: `numpy`
*   **Local (`bct`)**: 
    *   `.utils` (for `BCTParamError` and `get_rng`)
    *   `.algorithms` (for `get_components`)
    *   `.due` / `.citations` (for provenance/citation tracking via `duecredit`)

### 5. Analysis Methods
*   **Network-Based Statistic (NBS)**: A method to control the family-wise error rate (FWER) when performing mass-univariate testing on graph edges.
*   **Permutation Testing**: Used to build a non-parametric null distribution by shuffling group labels or flipping signs (for paired data).
*   **Connected Component Analysis**: Identifies clusters of suprathreshold edges.
*   **Statistical Tests**: Implementation of independent and paired t-tests for edge-level statistics.

### 6. Figures/Outputs
*   **Text Output**: Prints progress updates during the permutation process and identifies the size of the maximum component found in the true dataset.
*   **Return Values**: 
    *   `pvals`: Significance levels for each identified sub-network component.
    *   `adj`: Adjacency matrix representing the suprathreshold network.
    *   `null_dist`: The generated null distribution for significance testing.

### 7. Key Parameters
*   `thresh`: The t-statistic threshold applied to edges before identifying components.
*   `k`: Number of permutations (default 1000).
*   `tail`: Directionality of the test ('both', 'left', or 'right').
*   `paired`: Boolean to toggle between paired and two-sample t-tests.
*   `workers`: Number of CPU cores to utilize for parallel processing (defaults to all available cores if -1).

---

## bct/utils/__init__.py

This file is a standard Python package initialization file (`__init__.py`). Below is the structured analysis:

### 1. Purpose
This file serves as the package interface for the `utils` (utilities) submodule within the Brain Connectivity Toolbox (BCT) repository. It exposes all functions and classes from the `miscellaneous_utilities`, `visualization`, and `other` modules to the top-level `bct.utils` namespace.

### 2. Key Functions/Classes
*   **Imported Utilities**: This file does not define its own functions; instead, it imports all public members (`*`) from:
    *   `miscellaneous_utilities`: General helper functions for graph theory/connectivity data.
    *   `visualization`: Tools for plotting brain connectivity matrices or graph visualizations.
    *   `other`: Ancillary functions that do not fit into the primary categories.

### 3. Data Flow
*   **Data Flow**: The file does not process data directly. It facilitates data flow by aggregating internal module resources so that a user can call `import bct.utils` and access helper methods (e.g., matrix thresholding, plot formatting) directly from that namespace.

### 4. Dependencies
*   **Internal Dependencies**: 
    *   `.miscellaneous_utilities`
    *   `.visualization`
    *   `.other`
*   **External Dependencies**: None at this file level (dependencies are inherited from the imported modules, typically `numpy`, `scipy`, or `matplotlib`).

### 5. Analysis Methods
*   N/A (This is a structural file). The underlying modules implement methods related to network topology, connectivity matrix normalization, and statistical visualization.

### 6. Figures/Outputs
*   N/A (This file does not generate figures). It exposes the API for the visualization modules contained in the directory.

### 7. Key Parameters
*   N/A. This file does not define parameters or configuration logic; it acts strictly as an entry point/aggregator for the sub-modules.

---

## bct/utils/miscellaneous_utilities.py

### Code Analysis: `bct/utils/miscellaneous_utilities.py`

This file provides a collection of low-level helper functions designed to ensure mathematical compatibility between Python implementations and MATLAB-based Brain Connectivity Toolbox (BCT) functions.

#### 1. Purpose
The module contains utility functions for handling rounding, random number generation, and data transformation (specifically community structure indexing), ensuring consistency in behavioral results between Python and MATLAB scientific workflows.

#### 2. Key Functions/Classes
*   **`BCTParamError`**: A custom exception class for handling errors in BCT parameter validation.
*   **`teachers_round(x)`**: Implements "round half up" logic (where .5 always rounds to 1), overriding standard Python "banker's rounding" for MATLAB compatibility.
*   **`pick_four_unique_nodes_quickly(n, seed)`**: An optimized method for selecting four unique node indices without replacement, useful for sampling in graph algorithms.
*   **`cuberoot(x)`**: Computes the cube root of a number, ensuring correct sign handling for negative weights (unlike standard Python operators).
*   **`dummyvar(cis, ...)`**: An efficient implementation of MATLAB’s `dummyvar` function, converting categorical community membership arrays into binary indicator matrices.
*   **`get_rng(seed)`**: A utility for standardizing random number generator state management across different library calls.

#### 3. Data Flow
*   **Inputs**: The functions accept scalar values (for rounding/roots), node counts `n`, and multidimensional arrays (for `dummyvar` community partitions).
*   **Processing**: Uses standard NumPy arithmetic and logical operations, with `scipy.sparse` utilized internally for performance-optimized binary matrix creation.
*   **Outputs**: Returns scalars, tuples of indices, or dense NumPy matrices.

#### 4. Dependencies
*   **NumPy (`np`)**: Used for array manipulation, sorting, and random number generation.
*   **SciPy (`scipy.sparse`)**: Used within `dummyvar` to generate indicator matrices efficiently.
*   **Standard Library**: `random` is utilized for seeding and integer generation.

#### 5. Analysis Methods
*   **Indicator Encoding**: `dummyvar` effectively maps categorical labels (community memberships) into dummy-coded sparse matrices, a common requirement for statistical analysis of graph partitions.
*   **Stochastic Sampling**: Uses optimized integer partitioning (`n**4`) for constant-time sampling of unique nodes, which avoids the computational overhead of standard NumPy `choice` calls for small sets.

#### 6. Figures/Outputs
*   This module is a **utility library** and does not generate plots or visual outputs. Its output is exclusively numerical data processed for downstream network analysis functions.

#### 7. Key Parameters
*   **`seed`**: Used in `get_rng` and `pick_four_unique_nodes_quickly` to control reproducibility of scientific results.
*   **`cis`**: An $N \times M$ array input for `dummyvar`, where $N$ represents nodes and $M$ represents the number of partitions to be dummy-coded.
*   **`return_sparse`**: A boolean flag in `dummyvar` (though the provided code currently converts back to `toarray()`) intended to dictate the memory footprint of the output.

---

## bct/utils/other.py

### Analysis of `bct/utils/other.py`

#### 1. Purpose
This file provides a collection of utility functions for manipulating and preprocessing graph/network connectivity matrices, including thresholding, weight conversion, and data cleaning. It is designed for compatibility with the Brain Connectivity Toolbox (BCT).

#### 2. Key Functions/Classes
*   **`threshold_absolute`**: Sets connections below a specific weight magnitude threshold to zero.
*   **`threshold_proportional`**: Keeps a defined proportion ($p$) of the strongest weights and sets the rest to zero; handles symmetry if the input matrix is symmetric.
*   **`weight_conversion`**: A wrapper function to perform binarization, normalization, or inversion (length conversion).
*   **`binarize`**: Converts all non-zero weights in a matrix to 1.
*   **`normalize`**: Scales matrix weights to the range $[0, 1]$ by dividing by the maximum weight.
*   **`invert`**: Performs an element-wise inversion ($1/w$) of the matrix, typically used to convert connection strengths into connection lengths.
*   **`logtransform`**: Performs a negative logarithmic transformation ($-log(w)$), typically used to convert normalized connection strengths into distances.
*   **`autofix`**: Cleans a connectivity matrix by removing `inf`/`nan` values, zeroing the diagonal, and enforcing floating-point consistency for binariness and symmetry.

#### 3. Data Flow
*   **Input**: Takes a 2D `numpy.ndarray` (weighted connectivity matrix) as the primary input.
*   **Processing**: Functions either return a new array (if `copy=True`) or modify the input array in-place (if `copy=False`).
*   **Output**: Returns the processed `numpy.ndarray`.

#### 4. Dependencies
*   **External**: `numpy` (the core library for matrix operations).
*   **Internal**:
    *   `.miscellaneous_utilities.BCTParamError`: Custom error handling.
    *   `.miscellaneous_utilities.teachers_round`: Custom rounding utility used in proportional thresholding.

#### 5. Analysis Methods
*   **Graph Preprocessing**: Methods for network sparsification (thresholding) and weight standardization.
*   **Distance Metric Conversion**: Transformation of strength-based matrices into distance-based matrices (inversion and log-transformation), common in path-length and centrality calculations.
*   **Data Validation**: Cleaning methods for floating-point stability and handling of sparse/signed matrices.

#### 6. Figures/Outputs
*   This file performs data manipulation only and **does not generate any figures or plots**. Outputs are strictly numerical matrices.

#### 7. Key Parameters
*   `W`: The input connectivity matrix ($N \times N$ `numpy.ndarray`).
*   `copy`: A boolean toggle determining whether to modify the input matrix in-place or return a modified copy.
*   `thr` (in `threshold_absolute`): The absolute cutoff value for edge weights.
*   `p` (in `threshold_proportional`): The proportion (0 to 1) of edges to retain.
*   `wcm` (in `weight_conversion`): A string command ('binarize', 'normalize', 'lengths') defining the transformation type.

---

## bct/utils/visualization.py

This file, `bct/utils/visualization.py`, is a utility module from the Brain Connectivity Toolbox (BCT) providing various helper functions to facilitate the visualization and structural reordering of brain network connectivity matrices.

### 1. Purpose
This module provides tools to visualize adjacency matrices, reorder nodes to highlight network community structure, and extract network backbones. It bridges the gap between raw data matrices and visual representations suitable for analysis or publication.

### 2. Key Functions
*   `adjacency_plot_und`: Uses Mayavi to generate 3D interactive visualizations of undirected networks based on spatial coordinates.
*   `align_matrices`: Uses simulated annealing to reorder nodes in one connectivity matrix to match another, minimizing a specified distance metric.
*   `backbone_wu`: Extracts the "backbone" of a weighted, undirected network using a Minimum Spanning Tree (MST) approach to identify dominant connections.
*   `grid_communities`: Calculates reordering indices and boundaries for community structures to assist in plotting modularity matrices with `matplotlib`.
*   `reorderMAT`: Reorders a connectivity matrix to cluster edges near the diagonal, revealing latent community structures.

### 3. Data Flow
*   **Input**: Typically expects NxN adjacency matrices (weighted or binary) and Nx3 spatial coordinate arrays for plotting functions.
*   **Processing**: Functions perform matrix reordering (permutation), graph traversal (MST construction), and optimization (simulated annealing).
*   **Output**: Returns reordered matrices, plotting indices/boundaries, or Mayavi scene objects (3D figures).

### 4. Dependencies
*   **Scientific Stack**: `numpy`
*   **Visualization**: `mayavi.mlab` (optional, used specifically by `adjacency_plot_und`)
*   **Internal**: `bct.utils.miscellaneous_utilities.BCTParamError`, `bct.due`, `bct.citations` (for bibliographic tracking).

### 5. Analysis Methods
*   **Simulated Annealing**: Used in `align_matrices` to solve the combinatorial optimization problem of node permutation alignment.
*   **Minimum Spanning Tree (MST)**: Used in `backbone_wu` to identify the most significant paths within a weighted graph.
*   **Community Sorting**: Uses community assignment vectors to perform index-based sorting for matrix visualization.

### 6. Figures/Outputs
*   **3D Network Plots**: Generates interactive 3D visualizations (spheres for nodes, tubes/dashes for edges) via Mayavi.
*   **Diagnostic/Structural Plots**: Provides geometric bounds (`grid_communities`) for visual inspection of community structure using standard 2D image plots (e.g., `imshow`).

### 7. Key Parameters
*   **Annealing Parameters**: `H` (max steps), `Texp` (gradient steepness), `T0` (initial temperature) — crucial for `align_matrices` to avoid local minima.
*   **Visualization Modality**: `tube` (bool) toggles between cylindrical and line representations for 3D edges.
*   **Constraint Parameters**: `avgdeg` (desired average degree) in `backbone_wu` controls the density of the backbone structure returned.

---

## bct/version.py

This file is a standard metadata configuration script commonly found in Python research packages. Here is the structured analysis:

### 1. Purpose
This file serves as the single source of truth for the package versioning. It defines the current version string and a corresponding tuple for programmatic version comparison.

### 2. Key Functions/Classes
There are no functions or classes defined in this file. It contains only global variable assignments.

### 3. Data Flow
*   **Reads**: It processes the string `'0.6.0'` into a tuple of integers.
*   **Writes**: It initializes two global variables, `__version__` and `__version_info__`, which are intended to be accessed by other modules in the package or by automated deployment scripts.

### 4. Dependencies
*   **External**: None.
*   **Internal**: None. It relies solely on Python's standard built-in functions (`tuple`, `int`, `str.split`).

### 5. Analysis Methods
None. This is a configuration file and does not contain scientific or statistical implementations.

### 6. Figures/Outputs
None.

### 7. Key Parameters
*   `__version__`: A string representing the semantic version of the BCT (Brain Connectivity Toolbox) package (currently `'0.6.0'`).
*   `__version_info__`: A tuple `(0, 6, 0)` derived from the version string, used by other code to programmatically check for version compatibility or requirements.

---

## docs/_build/html/_sources/_templates/function.txt

### Analysis of `docs/_build/html/_sources/_templates/function.txt`

This file is a **template file** used by the documentation generation system (likely Sphinx) to standardize the formatting of function documentation throughout the repository.

---

### 1. Purpose
This file serves as a Jinja2-based template for automatically generating documentation pages for Python functions. It ensures that every function documented in the API reference follows a consistent layout, including the title, module context, and automated signature extraction.

### 2. Key Functions/Classes
*   **Not Applicable:** This is a template file, not a source code file containing executable functions or classes. It is processed by the documentation builder.

### 3. Data Flow
*   **Reads**: It consumes metadata provided by the Sphinx autodoc extension, specifically `{{ fullname }}`, `{{ module }}`, and `{{ objname }}`.
*   **Writes**: It acts as a blueprint for the final reStructuredText (`.rst`) files that are eventually rendered into HTML documentation.

### 4. Dependencies
*   **Sphinx**: Specifically the `sphinx.ext.autodoc` extension.
*   **Jinja2**: The templating engine used by Sphinx to inject variable values into the text.

### 5. Analysis Methods
*   **None**: This file performs no scientific or statistical analysis. It is purely structural documentation metadata.

### 6. Figures/Outputs
*   **Outputs**: It generates reStructuredText markup that, when rendered, produces standard function signature blocks, including the function name, module hierarchy, and a link to the corresponding docstrings defined in the source code.

### 7. Key Parameters
The file uses three primary template variables:
*   `{{ fullname }}`: The fully qualified name of the function (e.g., `package.module.function_name`).
*   `{{ module }}`: The parent module path.
*   `{{ objname }}`: The short name of the object being documented.
*   `{{ underline }}`: A dynamic string of characters (e.g., `====`) generated to match the length of the `fullname` for valid reStructuredText header formatting.

---

## docs/_build/html/_sources/bct.txt

### Analysis Report: `docs/_build/html/_sources/bct.txt`

#### 1. Purpose
This file serves as a **reStructuredText documentation source** for the Brain Connectivity Toolbox (BCT) Python implementation. It acts as an API reference, organizing the toolbox's comprehensive set of graph-theoretical analysis functions into logical scientific categories.

#### 2. Key Functions/Classes
The document categorizes the `bct` module into several core scientific domains:
*   **Centrality:** Algorithms to identify influential nodes (e.g., `betweenness_bin`, `pagerank_centrality`).
*   **Clustering:** Metrics to evaluate network segregation (e.g., `clustering_coef_bu`, `transitivity_bd`).
*   **Modularity:** Community detection and structural organization algorithms (e.g., `community_louvain`, `partition_distance`).
*   **Motif:** Analysis of sub-graph frequency and structure (e.g., `find_motif34`, `motif4struct_bin`).
*   **Distance/Efficiency:** Measures of network integration (e.g., `charpath`, `efficiency_bin`).
*   **Reference (Null Models):** Generators for randomized graphs to test statistical significance (e.g., `randmio_und`, `null_model_und_sign`).
*   **Miscellaneous:** Pre-processing and matrix utilities (e.g., `binarize`, `threshold_proportional`).

#### 3. Data Flow
*   **Inputs:** Primarily accepts adjacency matrices (binary or weighted, directed or undirected) representing brain networks.
*   **Processing:** Transforms structural/functional connectivity matrices into graph-theoretical topological indices.
*   **Outputs:** Returns scalar metrics, vector-based centrality scores, or modified adjacency matrices (e.g., thresholded or randomized versions).

#### 4. Dependencies
*   **Internal:** The file documents the `bct` and `nbs` (Network Based Statistic) modules.
*   **Implicit:** As a standard scientific library, it relies on foundational numerical processing libraries common in this ecosystem, typically **NumPy** and **SciPy**, though these are abstracted by the Sphinx documentation generator used here.

#### 5. Analysis Methods
The toolbox implements widely recognized methods from neuroinformatics and graph theory:
*   **Graph Theory:** Measures of path length, clustering, and centrality.
*   **Community Detection:** Louvain method for modularity maximization.
*   **Statistical Null Models:** Randomized matrix generation to assess whether observed network properties differ significantly from random configurations.
*   **Network-Based Statistic (NBS):** A cluster-based statistical method for testing hypotheses on connectivity networks.

#### 6. Figures/Outputs
*   **Visualizations:** Functions listed under the `Visualization` category (`adjacency_plot_und`, `reorderMAT`, `writetoPAJ`) are specifically designed to output matrix visualizations or export data for external network analysis tools like Pajek.

#### 7. Key Parameters
While the `.txt` file only lists function names, the API structure implies consistent parameter usage across the library:
*   **Matrix Type:** Users must specify whether input data is `bin` (binary) vs `wei` (weighted), and `und` (undirected) vs `dir` (directed).
*   **Thresholding:** Functions like `threshold_proportional` and `threshold_absolute` are critical configuration steps prior to running connectivity metrics.
*   **Sign:** Special handling for signed networks (e.g., `modularity_und_sig`) which account for inhibitory vs. excitatory connections.

---

## docs/_build/html/_sources/index.txt

This file is a source configuration file for the Sphinx documentation generator, specifically acting as the root entry point for a documentation project named `bct`.

### 1. Purpose
This file serves as the master source file (written in reStructuredText) for the `bct` project's documentation. It defines the hierarchical structure and table of contents for the generated HTML documentation.

### 2. Key Functions/Classes
*   **`.. toctree::`**: This is a core Sphinx directive used to organize documentation into a tree structure. It acts as the navigation menu for the project.
*   **Indices and tables**: These are standard Sphinx roles (`genindex`, `modindex`, `search`) that automatically generate a general index, module index, and search page for the documentation.

### 3. Data Flow
*   **Reads**: It references other `.rst` files (though currently empty) to assemble the final documentation build.
*   **Writes**: During the documentation build process, it instructs Sphinx to generate static HTML files (e.g., `index.html`) based on the defined hierarchy.

### 4. Dependencies
*   **Sphinx**: This file is strictly a dependency of the Sphinx documentation generator framework. It relies on the presence of a Sphinx environment to process the directives.

### 5. Analysis Methods
*   **None**: This is a configuration/markup file; it does not contain scientific or statistical implementations.

### 6. Figures/Outputs
*   **Outputs**: It produces the landing page (`index.html`) for the project's documentation, providing navigation to API references and search functionality.

### 7. Key Parameters
*   **`:maxdepth: 2`**: A configuration parameter for the `toctree` directive, which limits the depth of the navigation tree to two levels, controlling the granularity of the generated sidebar/menu.

---

## docs/_build/html/_sources/modules.txt

Based on the provided content, here is the structured summary for `docs/_build/html/_sources/modules.txt`:

### 1. Purpose
This file serves as a **Sphinx documentation configuration file** (in reStructuredText format) used to generate the API reference section of the project's documentation. It instructs the documentation builder to include the `bct` module in the table of contents.

### 2. Key Functions/Classes
*   **None**: This file does not contain functional code. It is a structural document used by the documentation generator (Sphinx).

### 3. Data Flow
*   **Reads**: It references the `bct` module directory/package.
*   **Writes**: During the documentation build process, it feeds into the generation of the `modules.html` (or equivalent) page, which maps the project's API structure.

### 4. Dependencies
*   **Sphinx**: Requires the Sphinx documentation generator framework to interpret the `.. toctree::` directive.
*   **`bct` package**: The file is a structural dependency that points to the main source code package of the repository.

### 5. Analysis Methods
*   **None**: This file is for documentation metadata and does not perform scientific or statistical calculations.

### 6. Figures/Outputs
*   **Output**: Produces a navigation menu (Table of Contents) in the generated HTML documentation, allowing users to browse the module hierarchy of the `bct` library.

### 7. Key Parameters
*   **`:maxdepth: 4`**: A configuration parameter for the `toctree` directive, specifying that the documentation generator should expand the module tree down to four levels of nested sub-modules/functions.

---

## docs/_build/html/_sources/stupid.txt

### Analysis Report: `docs/_build/html/_sources/stupid.txt`

#### 1. Purpose
This file serves as a **Sphinx documentation source file** (reStructuredText format) generated for the `bct` (Brain Connectivity Toolbox) Python package. It acts as an API reference index, instructing the documentation generator to pull and display docstrings for the library's modules.

#### 2. Key Functions/Classes
As an auto-documentation directive, it does not contain implementation code but points to the following modules:
*   **`bct.bct`**: The core module likely containing primary graph-theoretical measures.
*   **`bct.nbs`**: A specialized module for Network-Based Statistics (NBS).
*   **`bct` (Package root)**: Provides high-level access to the package contents.

#### 3. Data Flow
*   **Input**: Reads source code docstrings and module metadata from the `bct/` directory.
*   **Output**: Renders these into HTML documentation pages via the Sphinx build process.

#### 4. Dependencies
*   **Sphinx**: The documentation generator required to interpret the `.. automodule::` directives.
*   **`bct` package**: The actual scientific code repository being documented.

#### 5. Analysis Methods
While the file itself does not perform scientific analysis, it documents the underlying methods implemented in the `bct` package, which typically includes:
*   Graph theory metrics (centrality, clustering, path length).
*   Network-Based Statistics (NBS) for statistical inference on brain networks.

#### 6. Figures/Outputs
*   **Output**: Generates formatted HTML API documentation files. It does not produce scientific plots or data outputs directly.

#### 7. Key Parameters
The file utilizes Sphinx configuration directives:
*   `:members:`: Includes all members (functions, classes) of the module in the documentation.
*   `:undoc-members:`: Includes members that do not have explicit docstrings.
*   `:show-inheritance:`: Visualizes class hierarchy/inheritance trees in the final documentation.

***

**Analyst Note:** Despite the filename (`stupid.txt`), this is a standard configuration file for Python documentation pipelines. It should be treated as a build-artifact/source-metadata file rather than a script intended for execution.

---

## docs/conf.py

### 1. Purpose
This file is the configuration script for the **Sphinx** documentation generator for the `bct` (Brain Connectivity Toolbox) project. It defines the settings for building the project's documentation in various formats, including HTML, LaTeX, and manual pages.

### 2. Key Functions/Classes
*   **Sphinx Configuration**: This file does not contain user-defined classes or functions; rather, it sets variables that the Sphinx engine reads at runtime to govern the documentation build process.

### 3. Data Flow
*   **Reads**: It reads ReStructuredText (`.rst`) files from the documentation root (master document: `index.rst`) and includes custom Sphinx extensions located in the `sphinxext` directory.
*   **Writes**: It processes these source files to generate output formats, specifically HTML files (stored in `_build/html`), LaTeX files (`bct.tex`), and manual pages.

### 4. Dependencies
*   **Python Libraries**: `sys`, `os`.
*   **External Extensions**:
    *   `sphinx.ext.autodoc`: Automatically extracts documentation from docstrings in the source code.
    *   `sphinx.ext.autosummary`: Generates summary lists for modules/classes.
    *   `numpy_ext.numpydoc`: Custom extension for formatting NumPy-style docstrings, which is standard in scientific Python projects.

### 5. Analysis Methods
*   **N/A**: This file is purely for documentation infrastructure and does not implement scientific or statistical analysis methods.

### 6. Figures/Outputs
*   **Documentation Outputs**:
    *   **HTML**: Full documentation website for the `bct` project.
    *   **LaTeX/PDF**: A printable manual (`bct.tex`).
    *   **Manual Pages**: Unix-style man pages for the project.

### 7. Key Parameters
*   **`project`**: Set to `'bct'`.
*   **`version` / `release`**: Fixed at `'0.4'`.
*   **`extensions`**: Configured to include `autodoc`, `autosummary`, and `numpydoc`.
*   **`source_suffix`**: Set to `.rst` (the standard format for Sphinx).
*   **`html_theme`**: Set to `'default'`, which controls the visual layout of the generated documentation.
*   **`exclude_patterns`**: Set to `['_build']` to prevent the generator from parsing existing build artifacts.

---

## docs/sphinxext/numpy_ext/docscrape.py

This analysis covers the `docscrape.py` module, a core utility within the NumPy documentation infrastructure designed to parse and format docstrings conforming to the NumPy/SciPy documentation standard.

### 1. Purpose
The file provides tools to parse structured docstrings into a programmatic object representation and convert them back into reStructuredText (reST) format. It serves as the bridge between raw Python docstrings and the documentation generated by Sphinx.

### 2. Key Functions/Classes
*   **`Reader`**: A utility class that facilitates line-by-line reading of string data with look-ahead and condition-based stopping capabilities.
*   **`NumpyDocString`**: The primary parser class that breaks down a docstring into specific sections (e.g., `Parameters`, `Returns`, `See Also`) and stores them in a dictionary-like structure.
*   **`FunctionDoc`**: A subclass of `NumpyDocString` that extracts signature information from live function objects using `inspect`.
*   **`ClassDoc`**: A subclass that processes class-level documentation, including handling members like methods and attributes.

### 3. Data Flow
*   **Input**: Raw docstring strings (often obtained via `inspect.getdoc` or `pydoc.getdoc`) or live Python objects (functions/classes).
*   **Processing**:
    1.  The `Reader` consumes the docstring lines.
    2.  `NumpyDocString` uses regex and section detection logic (looking for underline symbols like `---` or `===`) to segment the text.
    3.  Specific section parsers (e.g., `_parse_param_list`, `_parse_see_also`) transform text segments into tuples or lists of metadata.
*   **Output**: A structured `NumpyDocString` object, which can be serialized back into a formatted reST string via the `__str__` method.

### 4. Dependencies
*   **Standard Library**: `inspect` (for object introspection), `textwrap`, `re` (regular expressions), `pydoc`, `warnings`, `io/StringIO`.
*   **Repo Context**: Part of the `sphinxext` (Sphinx extensions) directory, meaning it is designed to be used in conjunction with the Sphinx documentation generator.

### 5. Analysis Methods
While this file does not implement scientific algorithms, it implements **textual parsing logic**:
*   **Structural Parsing**: Identifies and validates specific documentation sections defined in the NumPy style guide.
*   **Introspection**: Uses Python’s `inspect` module to dynamically retrieve method signatures, argument specifications, and class hierarchy info from live code.

### 6. Figures/Outputs
*   **Outputs**: Generates formatted reStructuredText (reST) code blocks. These are ultimately consumed by Sphinx to build HTML, PDF, or man-page documentation for the repository.

### 7. Key Parameters
*   **`config`**: A dictionary passed to the constructors to toggle documentation behavior (e.g., `show_class_members` in `ClassDoc` determines whether to automatically include methods and properties in the documentation).
*   **`role`**: Used in `FunctionDoc` to define whether the documented item is a `:func:` or `:meth:`, affecting the resulting reST cross-reference syntax.

---

## docs/sphinxext/numpy_ext/docscrape_sphinx.py

This file provides a bridge between raw NumPy-style docstrings and the Sphinx documentation generator, allowing scientific Python projects to automatically render readable, formatted documentation.

### 1. Purpose
The module defines classes and helper functions that transform NumPy-style docstrings into Sphinx-compatible ReStructuredText (RST). It facilitates the automated generation of API documentation by handling sections like parameters, examples, references, and member lists specifically for Python functions, classes, and modules.

### 2. Key Functions/Classes
*   **`SphinxDocString`**: The base class that overrides base `NumpyDocString` methods to return formatted ReStructuredText (e.g., using `.. rubric::` for headers or `.. autosummary::` for members).
*   **`SphinxFunctionDoc` & `SphinxClassDoc`**: Specialized subclasses that integrate with `FunctionDoc` and `ClassDoc` to process specific object types.
*   **`get_doc_object`**: A factory function that inspects an object type (class, module, callable) and returns the appropriate `SphinxDocString` wrapper.

### 3. Data Flow
*   **Input**: Takes docstrings (via `NumpyDocString`) or objects (via `inspect`) as input.
*   **Processing**: Iterates through sections of the docstring (Parameters, Returns, Examples, etc.), parses the content, and injects Sphinx-specific markup syntax (directives like `:param:`, `.. warning::`, `.. plot::`).
*   **Output**: Returns a multi-line string representing formatted ReStructuredText suitable for rendering by the Sphinx engine.

### 4. Dependencies
*   **Internal**: Inherits from `docscrape.py` (part of the same local `numpy_ext` package).
*   **Standard Library**: `re` (regex parsing), `inspect` (object metadata retrieval), `textwrap` (formatting), `pydoc`.
*   **External**: `sphinx` (detected dynamically to handle version-specific formatting for LaTeX references).

### 5. Analysis Methods
This is a documentation-processing utility rather than a mathematical analysis tool. It uses **reflection/introspection** (`inspect`) to identify object types and structure to determine how to best display their documentation.

### 6. Figures/Outputs
*   **Outputs**: ReStructuredText strings for integration into build systems.
*   **Plots**: It features logic to automatically wrap code blocks containing Matplotlib imports within a `.. plot::` directive if the `use_plots` configuration is enabled.

### 7. Key Parameters
*   **`config`**: A dictionary that controls formatting behavior.
*   **`use_plots`**: A boolean flag (within `config`) that determines whether to process code examples into actual visual plots during documentation building.
*   **`func_role`**: Specifies the ReStructuredText role used for cross-referencing objects (default is `"obj"`).

---

## docs/sphinxext/numpy_ext/numpydoc.py

### File Analysis: `docs/sphinxext/numpy_ext/numpydoc.py`

#### 1. Purpose
This file implements a Sphinx extension designed to parse and format Python docstrings written in the NumPy documentation standard. It converts structured sections (e.g., Parameters, See Also) into readable documentation for scientific software projects.

#### 2. Key Functions/Classes
*   **`mangle_docstrings`**: A callback function that processes docstring text, standardizes references, and inserts configuration-specific elements (like edit links).
*   **`mangle_signature`**: Intercepts the function/method signature processing to extract signatures directly from the docstring if they are not dynamically determined.
*   **`setup`**: The entry point for the Sphinx extension; registers the docstring and signature processors and defines configuration values.
*   **`ManglingDomainBase` / `NumpyPythonDomain` / `NumpyCDomain`**: Custom Sphinx domains that wrap standard Python and C directives to enable docstring processing within specific contexts (e.g., `np:` functions).
*   **`wrap_mangling_directive`**: A decorator-like class wrapper that ensures docstrings are mangled during the directive execution phase in Sphinx.

#### 3. Data Flow
*   **Input**: Receives raw docstring lines from Sphinx’s `autodoc` process.
*   **Processing**: 
    *   Uses `get_doc_object` (from `docscrape_sphinx`) to transform standard NumPy docstrings into Sphinx-compatible field lists.
    *   Renames internal documentation references (to avoid collisions across multiple pages).
    *   Wraps directives to inject processed content back into the Sphinx document object model.
*   **Output**: Returns modified `lines` (lists of strings) to Sphinx, which then renders them into final documentation (HTML, PDF, etc.).

#### 4. Dependencies
*   **Sphinx**: Core dependency for documentation generation.
*   **`docutils`**: Used for `ViewList` manipulation to update content dynamically.
*   **Internal modules**: Imports `get_doc_object` and `SphinxDocString` from the local `docscrape_sphinx` module.
*   **Standard Library**: `re` (regex), `inspect` (introspecting objects), `pydoc` (retrieving docstrings).

#### 5. Analysis Methods
*   **String Pattern Matching**: Uses extensive regular expressions to identify and strip titles, renumber cross-references, and parse signatures.
*   **Introspection**: Utilizes `inspect` and `pydoc` to probe object attributes and docstrings at runtime to determine how to format the documentation.

#### 6. Figures/Outputs
*   **Documentation Output**: Does not generate figures or plots itself but enables the documentation build process to include them if `numpydoc_use_plots` is enabled.
*   **Processed Text**: Produces structured text formatting (ReStructuredText field lists) compatible with Sphinx builders.

#### 7. Key Parameters
*   **`numpydoc_use_plots`**: Boolean to toggle the generation/inclusion of plots within the documentation.
*   **`numpydoc_show_class_members`**: Boolean to control whether class members are automatically documented.
*   **`numpydoc_edit_link`**: A template string used to append an "Edit on GitHub/GitLab" link to documented objects.

---

## requirements.txt

This is a structured analysis of the `requirements.txt` file provided.

### 1. Purpose
This file serves as a manifest of the Python dependencies required to set up the development, testing, and execution environment for the research repository. It ensures that all necessary scientific libraries and testing frameworks are installed to achieve consistent performance and reproducible research results.

### 2. Key Functions/Classes
*   **None**: As a configuration file rather than a script, this file contains no executable code, functions, or classes.

### 3. Data Flow
*   **Input**: Read by package managers (e.g., `pip`) to resolve and install project dependencies.
*   **Output**: None.

### 4. Dependencies
The file lists the following external libraries:
*   **`numpy`**: Fundamental package for scientific computing and array manipulation.
*   **`scipy`**: Library for advanced scientific and technical computing (optimization, integration, statistics).
*   **`pytest`**: The framework used for running the project's test suite.
*   **`setuptools`**: Facilitates the packaging and installation of the project.
*   **`tox`**: A tool for automating virtual environment management and multi-environment testing.
*   **`duecredit`**: A tool for collecting and reporting academic citations for the software and the libraries it uses (promotes reproducibility and credit in research).

### 5. Analysis Methods
*   **Not Applicable**: The file does not implement analysis methods; rather, it provides the foundation (numerical methods via `numpy`/`scipy`) for methods to be implemented elsewhere in the repository.

### 6. Figures/Outputs
*   **None**: This file does not produce any visual outputs or data files.

### 7. Key Parameters
*   **Version Specifications**: The file currently lists package names without pinned versions (e.g., `numpy` vs `numpy==1.21.0`). This indicates that the repository currently relies on the latest compatible versions available at the time of installation, rather than a strictly locked dependency environment.

---

## setup.py

This file is a standard Python packaging script used to manage the installation and distribution of the `bctpy` library.

### 1. Purpose
This `setup.py` file serves as the build configuration script for the `bctpy` package, facilitating its installation via `pip` or `setuptools`. It defines package metadata, versioning, dependencies, and structural organization for the Brain Connectivity Toolbox (BCT) port.

### 2. Key Functions/Classes
*   **`read(fname)`**: A helper function that locates a file relative to the script's directory and returns its content as a string, typically used to load the `README.md` for the long package description.
*   **`setuptools.setup()`**: The primary function that registers package metadata, defines the modules to include (`bct`, `bct.algorithms`, `bct.utils`), and specifies installation requirements.

### 3. Data Flow
*   **Reads**: Imports `os` and `setuptools`. It reads `README.md` and `LICENSE` files from the local directory to include them in the package metadata.
*   **Writes**: Does not perform data processing or write data; it configures the installation process to map source code to the site-packages directory of the user's Python environment.

### 4. Dependencies
*   **External Libraries**: 
    *   `numpy`: Required for numerical array processing.
    *   `scipy`: Required for scientific computing and matrix operations.
*   **Standard Library**: `os` and `setuptools`.

### 5. Analysis Methods
*   *None:* As a configuration file, it does not implement scientific or statistical methods. However, it exposes the package structure for the `bct.algorithms` module, which contains the scientific analysis methods for brain connectivity.

### 6. Figures/Outputs
*   *None:* This script does not generate figures, plots, or research outputs. Its "output" is a successfully installed Python package environment.

### 7. Key Parameters
*   **`version="0.6.1"`**: Defines the current release version of the codebase.
*   **`packages=['bct', 'bct.algorithms', 'bct.utils']`**: Defines the module hierarchy included in the installation.
*   **`install_requires`**: Explicitly dictates that `numpy` and `scipy` are mandatory for the code to run.
*   **`classifiers`**: Lists the supported Python environments (2.7, 3.5, 3.6, 3.7) and the intended scientific research audience.

---

## test/basic_test.py

This analysis covers `test/basic_test.py`, a unit testing script designed to validate the functionality of the `bct` (Brain Connectivity Toolbox) Python implementation.

### 1. Purpose
This file contains a suite of unit tests designed to verify the correct implementation of graph-theoretical network analysis algorithms within the `bct` library. It ensures that matrix processing functions return expected numerical results when applied to standardized sample datasets.

### 2. Key Functions/Classes
All functions are test cases prefixed with `test_`, executing specific BCT algorithms:
*   **`test_threshold_proportional` / `nocopy`**: Validates the proportional thresholding algorithm.
*   **`test_threshold_absolute`**: Validates thresholding based on fixed numerical values.
*   **`test_strengths_und` / `degrees_und`**: Validates calculation of node strength and node degree for undirected graphs.
*   **`test_binarize`**: Validates the conversion of weighted matrices to binary adjacency matrices.
*   **`test_autofix`**: Validates automatic matrix repair/cleaning functions.
*   **`test_normalize` / `test_invert`**: Validates matrix normalization and weight inversion operations.

### 3. Data Flow
*   **Inputs**: Reads empirical network data samples (undirected and directed matrices) via `load_samples.py`.
*   **Processing**: Applies BCT library transformations (thresholding, binarization, normalization) to these matrices.
*   **Outputs**: Performs assertions comparing the resulting matrix properties (primarily `np.sum(x)`) against hard-coded, pre-calculated floating-point benchmarks.

### 4. Dependencies
*   **Internal**: `.load_samples` (modules `load_sample`, `load_directed_sample`).
*   **External**: 
    *   `bct`: The primary toolbox under test.
    *   `numpy`: Used for numerical array manipulation and floating-point comparisons (`np.allclose`).

### 5. Analysis Methods
The script exercises fundamental network neuroscience metrics, including:
*   **Proportional Thresholding**: Removing edges to maintain a specific density.
*   **Absolute Thresholding**: Removing edges below a specific weight magnitude.
*   **Degree and Strength Calculation**: Measures of node centrality in weighted and binary networks.
*   **Matrix Sanitization**: Binarization and normalization techniques standard in neuroimaging connectivity pipelines.

### 6. Figures/Outputs
*   **Outputs**: None. The file is a non-graphical testing script that produces console-based pass/fail signals (via standard testing frameworks like `pytest`).

### 7. Key Parameters
*   **Threshold Ratios**: Various float values (e.g., `.5`, `.3`, `.28`, `.41`, `.79`) are used to test the sensitivity of the algorithms to different sparsity levels.
*   **Copy Flag**: Boolean `copy=True/False` parameters test the memory handling and in-place vs. out-of-place modification logic of the BCT functions.

---

## test/centrality_test.py

This analysis pertains to the `test/centrality_test.py` file within the scientific research repository.

### 1. Purpose
This file serves as a unit testing module for verifying the accuracy of network centrality algorithms (specifically gateway coefficients) implemented in the `bct` (Brain Connectivity Toolbox) library. It ensures that functions calculating node roles in modular networks produce expected numerical results based on provided sample data.

### 2. Key Functions/Classes
*   **`test_gateway_coef()`**: A testing function that computes the gateway coefficient for a sample network using both default and alternative (betweenness) centrality metrics, verifying the output against predefined constant values.

### 3. Data Flow
*   **Input**: Loads pre-defined network adjacency matrices via helper functions (`load_sample`).
*   **Processing**: The loaded matrices are passed to `bct.modularity_und` to determine community structure and then to `bct.gateway_coef_sign` to calculate positive and negative gateway coefficients.
*   **Output**: The function performs `assert` statements to validate numerical results; it does not output files or visual plots.

### 4. Dependencies
*   **`bct`**: The Brain Connectivity Toolbox (Python implementation), providing the graph theory algorithms.
*   **`numpy`**: Used for numerical array handling and verification (`np.allclose`, `np.sum`).
*   **`.load_samples`**: A local module within the repository that provides standard network datasets for testing.

### 5. Analysis Methods
*   **Community Detection**: Uses modularity maximization (`bct.modularity_und`) to partition the network into clusters.
*   **Gateway Coefficient Calculation**: Implements algorithms to measure the diversity of connections a node maintains across different communities, specifically using `gateway_coef_sign` to handle signed networks.

### 6. Figures/Outputs
*   **None**: This is a non-graphical test script; its only "output" is a boolean pass/fail status for the test suite.

### 7. Key Parameters
*   **`thres=.41`**: A thresholding parameter used in the sample loader to densify or sparsify the adjacency matrix before analysis.
*   **`centrality_type`**: A parameter in `bct.gateway_coef_sign` (set to `'betweenness'` in the test) that dictates which centrality measure is used as the basis for the gateway coefficient calculation.

---

## test/clustering_test.py

### Analysis of `test/clustering_test.py`

#### 1. Purpose
This file serves as a unit testing suite for the `bctpy` (Brain Connectivity Toolbox for Python) library. It verifies the correctness of various graph theory metrics, specifically those related to clustering, transitivity, components, modularity, and agreement matrices.

#### 2. Key Functions/Classes
*   **Clustering & Transitivity Tests**: `test_cluscoef_wu/wd/bu/bd` and `test_transitivity_wu/wd/bu/bd` test the clustering coefficient and transitivity calculations for weighted undirected (wu), weighted directed (wd), binary undirected (bu), and binary directed (bd) graphs.
*   **Structural/Component Tests**: `test_component` verifies the identification of graph components.
*   **Modularity/Consensus**: `test_consensus` tests consensus clustering and modularity optimization.
*   **Agreement Testing**: `test_agreement` and `test_agreement_weighted` verify the calculation of node-pairing agreement matrices across multiple partitions.
*   **Path Transitivity**: `test_path_transitivity` checks path-based transitivity metrics with inverse and logarithmic transforms.

#### 3. Data Flow
*   **Input**: The tests consume sample network matrices (adjacencies) loaded via local helper functions (e.g., `load_sample`, `load_sparse_sample`).
*   **Processing**: These matrices are passed to `bct` library functions.
*   **Output**: The script prints intermediate calculation results to the console and uses `assert` statements to compare these results against pre-computed ground-truth values (using `np.allclose` for numerical stability).

#### 4. Dependencies
*   **Internal**: `load_samples` (helper module for test data).
*   **External**: 
    *   `numpy`: Array manipulation and numerical comparisons.
    *   `bct`: The Brain Connectivity Toolbox library under test.
    *   `scipy.stats`: Used within the component test.

#### 5. Analysis Methods
*   **Graph Theory Metrics**:
    *   **Clustering Coefficient**: Measures the degree to which nodes in a graph tend to cluster together.
    *   **Transitivity**: The ratio of triangles to triplets in the network.
    *   **Modularity (`Q`)**: A measure of the strength of division of a network into modules.
    *   **Agreement Matrices**: Used to quantify consistency across different clusterings or partitions of the same nodes.
*   **Statistical Validation**: Uses floating-point tolerance checks (`np.allclose`) to validate that library output matches expected scientific benchmarks.

#### 6. Figures/Outputs
*   **Console Output**: The script outputs the computed metrics (e.g., `sum(cc)`, `t`, `q`) to the terminal to facilitate debugging and verification.
*   **Return Values**: No visual figures or plots are generated; the output is purely numerical/log-based for assertion validation.

#### 7. Key Parameters
*   **`thres`**: Thresholds (e.g., `.23`, `.85`, `.17`) applied during sample loading to convert continuous data into sparse adjacency matrices.
*   **`reps`**: Used in `bct.consensus_und` to define the number of repetitions for consensus clustering.
*   **`buffsz`**: Used in `bct.agreement` to test the buffer size functionality during partition comparison.
*   **`transform`**: Used in `path_transitivity` to toggle between `'inv'` (inverse) and `'log'` (logarithmic) weight transformations.

---

## test/conftest.py

### Analysis of `test/conftest.py`

This file is a configuration script for the `pytest` testing framework, designed to manage test execution behavior within the research repository.

---

#### 1. Purpose
This file extends the `pytest` testing suite by introducing custom markers and command-line options, specifically allowing researchers to selectively skip time-consuming "long-running" tests during routine development.

#### 2. Key Functions
*   **`pytest_configure(config)`**: Registers the `long` marker globally, allowing the test suite to recognize and categorize specific tests as long-running.
*   **`pytest_addoption(parser)`**: Injects a custom command-line argument `--skiplong` into the test runner interface.
*   **`pytest_collection_modifyitems(config, items)`**: Logic controller that intercepts the test collection phase; if `--skiplong` is triggered, it dynamically applies a skip marker to any test decorated with `@pytest.mark.long`.

#### 3. Data Flow
*   **Input**: Reads command-line arguments (via `pytest` parser) and test metadata (via `pytest` collection items).
*   **Processing**: Evaluates whether the `--skiplong` flag is present and maps it against the keywords (markers) assigned to individual test functions.
*   **Output**: Modifies the internal list of tests to be executed by adding/removing skip markers.

#### 4. Dependencies
*   **`pytest`**: The core testing framework (Python package).

#### 5. Analysis Methods
*   **Not Applicable**: This file is infrastructure code for testing; it does not contain scientific or statistical computation logic.

#### 6. Figures/Outputs
*   **None**: This file does not generate figures or data plots. Its "output" is the modified execution behavior of the test runner (i.e., a summary of passed/skipped tests in the terminal).

#### 7. Key Parameters
*   **`--skiplong`**: A boolean flag (default `False`). When passed as `--skiplong` in the CLI, it triggers the suppression of tests marked with `@pytest.mark.long`.
*   **`long`**: The identifier used to annotate specific test functions within the repository that should be subject to the skipping logic.

---

## test/core_test.py

This analysis provides a structured overview of the `test/core_test.py` file, which serves as a testing suite for a neuroimaging or network analysis research package.

### 1. Purpose
This file contains unit tests designed to verify the correct implementation of graph-theoretical algorithms (specifically core-periphery and community detection metrics) provided by the `bct` (Brain Connectivity Toolbox) library. It ensures that functions produce consistent results when applied to standardized sample network data.

### 2. Key Functions/Classes
*   **`test_assortativity_wu_sign()`**: Validates the calculation of local assortativity for weighted, undirected, signed networks.
*   **`test_core_periphery_dir()`**: Validates the detection of core-periphery structures in directed networks, checking both the assignment vector and the quality of the partition.
*   **`test_clique_communities()`**: Validates the identification of overlapping communities based on clique percolation (specifically $k$-clique communities).

### 3. Data Flow
*   **Input**: Reads sample graph data (likely adjacency matrices) using the `load_sample` utility function from the local module `load_samples`.
*   **Processing**: Passes these matrices into `bct` library functions.
*   **Output**: Asserts equality between computed results and known hard-coded constants (e.g., specific sums and scalar values) to verify accuracy.

### 4. Dependencies
*   **External**: 
    *   `bct`: The Brain Connectivity Toolbox (core network analysis library).
    *   `numpy`: Used for matrix manipulation and numerical comparisons (`np.allclose`, `np.sum`).
*   **Internal**:
    *   `.load_samples`: Specifically the `load_sample` function used to retrieve test datasets.

### 5. Analysis Methods
The script tests specific graph-theoretical analytical methods:
*   **Local Assortativity (`wu_sign`)**: Measures the correlation between the degrees of connected nodes in weighted signed networks.
*   **Core-Periphery Detection**: Identifies a subset of nodes (core) that are more densely connected than the rest of the network (periphery).
*   **Clique Percolation**: Detects communities as the union of all $k$-cliques that can be reached from one another through a series of adjacent cliques.

### 6. Figures/Outputs
*   **No graphical plots**: This file is strictly for automated unit testing.
*   **Console Output**: Prints intermediate summation values and shape dimensions to standard output for debugging/verification purposes during test runs.

### 7. Key Parameters
*   **`thres`**: A threshold value passed to `load_sample` (e.g., `.1`, `.23`) to binarize or sparsify the input graph data before analysis.
*   **`k` (clique size)**: Set to `9` in the `clique_communities` test, determining the minimum size of cliques used for community formation.
*   **`atol`**: An absolute tolerance parameter (`.0001`) used in `np.allclose` to account for floating-point precision differences between the library output and the test expectations.

---

## test/distance_test.py

This file is a test suite designed to validate the functionality of distance and path-length algorithms within the `bct` (Brain Connectivity Toolbox) Python implementation.

### 1. Purpose
The file performs regression and integrity testing for graph-theoretic distance metrics, ensuring that connectivity calculations—such as path length, reachability, and network navigation—produce expected numerical outputs consistent with established benchmarks.

### 2. Key Functions
*   **`test_breadthdist`**: Validates the breadth-first search implementation for distance calculations.
*   **`test_reachdist`**: Verifies reachability and distance distributions for both raw and binarized graph inputs.
*   **`test_distance_bin` / `test_distance_wei`**: Tests shortest path algorithms for binary and weighted networks, respectively.
*   **`test_charpath`**: Validates characterization of network properties like eccentricity, radius, and diameter.
*   **`test_distance_floyd`**: Checks the Floyd-Warshall implementation for all-pairs shortest paths.
*   **`test_navigation_wu`**: Tests greedy navigation algorithms based on geometric constraints (Euclidean distance).

### 3. Data Flow
*   **Input**: Loads sample connectivity matrices via `load_sample` (presumably from a local directory or cache).
*   **Processing**: Applies BCT functions (binarization, inversion, distance transformations).
*   **Validation**: Compares the sum of result matrices/arrays against hard-coded expected values or checks for non-NaN properties.

### 4. Dependencies
*   **Internal**: `bct` (Brain Connectivity Toolbox), `.load_samples` (helper for fetching test data).
*   **External**: `numpy` (for matrix manipulation and statistical assertions).

### 5. Analysis Methods
*   **Graph Theory**: Implements standard neuroinformatics metrics, specifically shortest path lengths, reachability, characteristic path length, global efficiency, and network navigation algorithms (Wu et al.).
*   **Validation Logic**: Uses `np.allclose` for floating-point comparisons and explicit assertion checks on matrix sums to ensure mathematical stability across library versions.

### 6. Figures/Outputs
*   **Outputs**: Does not generate visual plots.
*   **Console**: Prints matrix sums during execution to the standard output for manual verification/debugging (e.g., `print(np.sum(r), np.sum(d))`).

### 7. Key Parameters
*   **`thres`**: Thresholding parameter passed to `load_sample` to determine network sparsity (e.g., `.02`, `.24`, `.31`).
*   **`max_hops`**: A constraint parameter in `navigation_wu` that limits the traversal depth in the network search algorithm.
*   **`transform`**: Method parameter (e.g., `'inv'`) used in `distance_wei_floyd` to convert edge weights to distances.

---

## test/duecredit_test.py

This file is a component of a test suite for the `duecredit` library, which is designed to automate the collection and reporting of citations for scientific software and libraries used in a research project.

### 1. Purpose
This file performs integration testing for the `duecredit` system by executing a sample script, confirming successful citation collection, and verifying the correct generation of BibTeX-formatted citation output.

### 2. Key Functions/Classes
*   **`script_path` (Fixture)**: Dynamically resolves the filesystem path to a helper script (`simple_script.py`) used for testing.
*   **`dc_context` (Fixture)**: Manages the testing environment by backing up existing `duecredit` cache files, ensuring a clean state, enabling the `DUECREDIT_ENABLE` environment variable, and restoring the original cache after test completion.
*   **`test_duecredit`**: The primary test function that runs the target script, invokes the `duecredit` CLI to generate a summary, and validates that expected authors are present in the resulting BibTeX output.

### 3. Data Flow
*   **Reads**: It reads the contents of `simple_script.py` and the `duecredit` cache file (`.duecredit.p`).
*   **Writes**: It temporarily renames/backs up existing cache files and generates a new citation summary output via `stdout`.
*   **Processes**: It intercepts the output of the `duecredit` CLI to perform string parsing and assertion checks on the generated BibTeX citations.

### 4. Dependencies
*   **`pytest`**: The framework used for test orchestration.
*   **`subprocess`**: Used to execute shell commands (running the script and the `duecredit` CLI).
*   **Standard Library**: `os`, `sys`, and `datetime` for environment and file path management.
*   **Local Dependencies**: Expects a `simple_script.py` file to exist in the same directory.

### 5. Analysis Methods
This test does not implement scientific/statistical methods; it performs **functional validation** and **regression testing** to ensure the citation recording mechanism correctly identifies and formats bibliographic metadata.

### 6. Figures/Outputs
*   **Output**: The test generates a BibTeX-formatted citation string via `stdout`, which is captured and validated for specific author names and count headers.

### 7. Key Parameters
*   **`DUECREDIT_ENABLE`**: An environment variable set to "yes" to force the library to record citations during the execution of the test script.
*   **Author list**: A hardcoded list of researchers ("LaPlante", "Latora", etc.) that the system is expected to find within the generated citation summary.

---

## test/efficiency_test.py

This analysis summarizes the provided Python test file from a scientific repository, likely associated with the **Brain Connectivity Toolbox (BCT)**.

### 1. Purpose
This file contains automated unit tests to verify the correct computation of various network efficiency metrics within a graph theory-based analysis framework. It ensures that functions calculating diffusion, resource, and routing efficiency produce mathematically expected outputs for standardized sample datasets.

### 2. Key Functions
*   **`test_diffusion_efficiency()`**: Validates the `bct.diffusion_efficiency` function, which computes the diffusion efficiency (a measure of global communication efficiency) of a weighted network.
*   **`test_resource_efficiency()`**: Validates `bct.resource_efficiency_bin`, checking the efficiency of resource allocation in binarized networks.
*   **`test_rout_efficiency()`**: Validates `bct.rout_efficiency`, which computes routing efficiency, specifically testing it against directed network data.

### 3. Data Flow
*   **Inputs**: Loads graph samples via `load_sample` and `load_directed_sample` (defined in a local sibling module).
*   **Processing**: Applies thresholds to the input graphs, performs binarization (where required), and computes BCT network metrics.
*   **Outputs**: Performs boolean assertions against hardcoded reference values (using `np.allclose`) to verify numerical precision.

### 4. Dependencies
*   **`numpy`**: Used for array manipulation and numerical comparisons (`np.allclose`).
*   **`bct`**: The core library containing the network analysis implementations.
*   **`.load_samples`**: A local module providing test graph data (e.g., `load_sample`, `load_directed_sample`).

### 5. Analysis Methods
The script focuses on **Graph Theory metrics**, specifically:
*   **Diffusion Efficiency**: Assessing the efficiency of information transmission via diffusion processes on graphs.
*   **Resource Efficiency**: Measuring how efficiently resources are routed or distributed in a binary graph at a specific probability threshold.
*   **Routing Efficiency**: Evaluating how efficiently information is routed through a network (here specifically using the 'inv' / inverse transform method).

### 6. Figures/Outputs
*   **Outputs**: The script does not generate figures. Its primary output is a console print statement for `test_diffusion_efficiency` (displaying calculated metrics) and standard `pytest` success/failure signals via the `assert` statements.

### 7. Key Parameters
*   **`thres`**: Threshold values used to filter the graph connectivity matrices (e.g., `.23`, `.39`, `1`).
*   **`atol` (Absolute Tolerance)**: Used in `np.allclose` to define the acceptable margin of error between computed values and reference benchmarks.
*   **Transformation string**: The `'inv'` argument passed to `rout_efficiency` indicates the transformation method applied to edge weights (e.g., calculating efficiency on inverted weights).

---

## test/load_samples.py

This file acts as a utility module for the testing suite of a Brain Connectivity Toolbox (BCT) implementation. It provides a centralized interface for loading, thresholding, and binarizing standard sample connectivity matrices used in unit tests.

### 1. Purpose
The file provides helper functions to load standardized neurological dataset samples (saved as `.npy` files) and apply common graph-theoretic transformations. It ensures consistency across tests by standardizing the preprocessing of input data.

### 2. Key Functions
*   **`load_sample(thres)`**: Loads base connectivity data and applies proportional thresholding.
*   **`load_signed_sample(thres)`**: Loads signed network data, rounding values to 8 decimal places before thresholding.
*   **`load_binary_sample(thres)`**: Loads base sample and converts it to a binary adjacency matrix.
*   **`load_directed_sample(thres)`**: Loads a directed graph sample and applies thresholding.
*   **`load_sample_group_[qball/dsi/fmri]()`**: Load group-level connectivity matrices and apply specific normalization and thresholding pipelines (typically used for Network Based Statistic, NBS, testing).
*   **Unimplemented Placeholders**: Includes several `NotImplementedError` stubs for sparse and signed-directed combinations.

### 3. Data Flow
*   **Input**: Reads binary `.npy` files from a subdirectory named `mats/` relative to the script location.
*   **Processing**: Applies BCT algorithms (`bct.threshold_proportional`, `bct.binarize`, `bct.normalize`) to the loaded arrays.
*   **Output**: Returns processed NumPy arrays to the calling test script.

### 4. Dependencies
*   **`numpy`**: Used for array manipulation and loading `.npy` files.
*   **`bct`**: The Brain Connectivity Toolbox (the core library being tested).
*   **`os`**: Used for file path management.
*   **`functools`**: Used for function composition in the `load_sample_group_fmri` helper.

### 5. Analysis Methods
*   **Proportional Thresholding**: Retains a specific percentage of the strongest edges in a graph.
*   **Binarization**: Converts weighted graphs into unweighted binary graphs.
*   **Normalization**: Re-scales connectivity values, utilized heavily in the group-level sample loading functions.
*   **Function Composition**: Uses functional programming patterns to chain preprocessing steps for fMRI group data.

### 6. Figures/Outputs
*   **None**: This is a utility file for testing; it does not generate visual plots or save files. It returns processed data structures to the testing framework.

### 7. Key Parameters
*   **`thres`**: The primary parameter across most functions, representing the threshold proportion (default values range from `0.02` to `1.0`).
*   **`copy`**: Used in `bct` calls (e.g., `copy=False`) to manage memory efficiency during thresholding operations.

---

## test/modularity_derived_metrics_test.py

This file, `test/modularity_derived_metrics_test.py`, serves as a test suite for validating network modularity-based metrics within a scientific brain connectivity analysis workflow.

### 1. Purpose
The file performs unit and integration testing to ensure that the implementation of graph-theoretical modularity metrics (like participation coefficients, gateway coefficients, and Z-scores) in the `bct` (Brain Connectivity Toolbox) Python port remains consistent with reference data.

### 2. Key Functions/Classes
*   `test_pc()`: Validates `bct.participation_coef` against pre-computed sample data.
*   `test_participation()`: Validates participation coefficients using controlled, small-scale graph inputs (identity and ones matrices).
*   `test_gateway()`: Tests `bct.gateway_coef_sign` with different centrality settings.
*   `test_zi()`: Validates `bct.module_degree_zscore` (Z-score of intra-module connections) against reference samples.
*   `test_shannon_entropy()`: Tests `bct.diversity_coef_sign` for calculating network diversity.

### 3. Data Flow
*   **Reads**: Loads graph matrices and reference output vectors (`.npy` files) from a local path accessed via `load_samples.py`.
*   **Processes**: Passes network matrices and partition vectors into `bct` library functions to generate new output metrics.
*   **Compares**: Uses `numpy.allclose` to compare newly calculated metrics against the loaded reference values.

### 4. Dependencies
*   **External**: `numpy`, `bct` (Brain Connectivity Toolbox).
*   **Internal**: `.load_samples` (functions `load_sample` and `mat_path` are used to retrieve test data).

### 5. Analysis Methods
The script validates standard graph-theory metrics used in neuroimaging:
*   **Participation Coefficient**: Measures the distribution of a node’s edges across different modules.
*   **Gateway Coefficient**: Measures the role of a node in bridging different modules using centrality measures.
*   **Module Degree Z-score**: Quantifies how well-connected a node is within its own module relative to other nodes in that module.
*   **Diversity Coefficient (Shannon Entropy)**: Quantifies the diversity of a node's connectivity profile.

### 6. Figures/Outputs
*   **Outputs**: Does not generate visual plots; it outputs comparison logs to the console (`print` statements) showing discrepancies between current results and reference data.
*   **Success Criteria**: Success is determined by `assert` statements passing within specific `atol` (absolute tolerance) thresholds.

### 7. Key Parameters
*   **`thres`**: Threshold value used for filtering edges in the sample graph (e.g., `0.4`, `0.1`).
*   **`atol`**: Tolerance levels for assertions (e.g., `0.02`, `0.05`), specifically used to account for minor mathematical differences between NumPy and original MATLAB implementations (e.g., population vs. sample standard deviation).
*   **`centrality_type`**: A parameter in `test_gateway` to switch between connectivity methods (e.g., 'betweenness').

---

## test/modularity_test.py

This analysis provides a structured summary of `test/modularity_test.py` from the BCT (Brain Connectivity Toolbox) repository.

### 1. Purpose
This file contains a comprehensive suite of unit tests designed to validate the modularity-related algorithms in the `bct` library. It ensures mathematical consistency, checks for numerical stability, and verifies regression fixes across various graph types (undirected, directed, and signed).

### 2. Key Functions
The file contains individual test functions for the following BCT algorithms:
*   `test_modularity_und`: Tests standard undirected modularity calculation.
*   `test_modularity_louvain_und`: Tests Louvain community detection for undirected graphs.
*   `test_modularity_finetune_und`: Tests fine-tuning of community structures in undirected graphs.
*   `test_modularity_probtune_und_sign`: Tests probabilistic tuning for signed undirected networks.
*   `test_modularity_dir`: Tests modularity calculation for directed networks.
*   `test_community_louvain`: Wrapper test for the community detection Louvain implementation.
*   `test_modularity_dir_bug71`: A regression test verifying fixes for specific directed network edge cases.

### 3. Data Flow
*   **Inputs**: Loads graph samples via `load_sample`, `load_directed_sample`, `load_signed_sample`, and `load_directed_low_modularity_sample`. Also reads external CSV data for regression testing (`modularity_dir_example.csv`).
*   **Processing**: Applies `bct` algorithms to these adjacency matrices, using fixed random seeds to ensure deterministic results where applicable.
*   **Verification**: Uses `np.allclose` to compare computed modularity scores ($Q$) against pre-calculated "golden" values or expected bounds.

### 4. Dependencies
*   **Internal**: Imports utilities from `.load_samples` (specifically `load_sample` family and `TEST_DIR`).
*   **External**: 
    *   `numpy`: Used for array manipulation and numerical comparisons.
    *   `bct`: The library being tested (Brain Connectivity Toolbox).
    *   `os`: Used for file path management.

### 5. Analysis Methods
*   **Deterministic Validation**: Uses fixed seeds to check if the algorithms reach known modularity values.
*   **Stability Testing**: Executes loops (e.g., 100 iterations) to check for consistent convergence and to identify non-deterministic behavior or potential "bistable" transitions in the algorithms.
*   **Regression Testing**: Specifically targets documented bugs (e.g., Issue #71) to ensure old faults do not re-emerge.

### 6. Figures/Outputs
*   **Outputs**: Prints modularity scores ($Q$) to stdout during test execution for manual debugging and monitoring of value differences.
*   **Assertions**: No visualizations are generated; testing relies strictly on boolean success/failure via standard Python `assert` statements.

### 7. Key Parameters
*   **Thresholding (`thres`)**: Used during sample loading (e.g., `.4`, `.67`) to define sparsity levels for the input adjacency matrices.
*   **Random Seeds (`seed`)**: Essential for the reproducibility of stochastic algorithms like Louvain; specific long-integer seeds are utilized throughout to ensure test consistency.
*   **Tolerances (`atol`)**: Used in `np.allclose` and direct comparisons to account for floating-point arithmetic differences and inherent numerical instability in eigendecomposition across different programming environments (Python vs. MATLAB).

---

## test/nbs_test.py

This file serves as a unit testing suite for the Network-Based Statistic (NBS) implementation within a scientific neuroimaging analysis repository.

### 1. Purpose
The file `test/nbs_test.py` validates the correctness of the Network-Based Statistic (`bct.nbs_bct`) implementation by comparing results obtained from different neuroimaging data modalities (DSI, Q-ball, fMRI) against expected p-values. It ensures that the NBS algorithm produces consistent statistical outputs across varying sample datasets.

### 2. Key Functions/Classes
*   **`_nbs_helper(...)`**: A utility function that wraps the `bct.nbs_bct` call, runs the statistical test, and performs an assertion to verify the result against an expected p-value within a specified tolerance.
*   **`test_nbs_dsi_qbi()`**: Tests the NBS implementation using Q-ball and DSI neuroimaging samples.
*   **`test_nbs_dsi_fmri()`**: Tests the NBS implementation comparing DSI and fMRI data modalities.
*   **`test_nbs_paired_dsi_qbi()` & `test_nbs_paired_dsi_fmri()`**: Placeholder functions intended for testing paired-sample NBS configurations.

### 3. Data Flow
*   **Input**: Reads neuroimaging sample data (DSI, Q-ball, fMRI) via import functions (`load_sample_group_...`).
*   **Process**: Passes these data arrays into the `bct.nbs_bct` algorithm to calculate p-values.
*   **Verification**: Compares the calculated `pval` against hardcoded `expected_pval` constants using `np.allclose`.

### 4. Dependencies
*   **Internal**: `load_samples.py` (specifically `load_sample_group_dsi`, `load_sample_group_fmri`, `load_sample_group_qball`).
*   **External**:
    *   `numpy`: Used for array operations and floating-point comparisons (`allclose`).
    *   `bct`: The Brain Connectivity Toolbox (Python implementation), used for the core `nbs_bct` function.

### 5. Analysis Methods
*   **Network-Based Statistic (NBS)**: A non-parametric statistical method used to identify connected components (subgraphs) in neuroimaging connectivity data that show significant differences between experimental groups.
*   **Statistical Validation**: Uses threshold-based verification and tolerance-based testing (`atol`) to accommodate the stochastic nature of permutation-based tests (NBS).

### 6. Figures/Outputs
*   **Outputs**: Prints the computed `pval` and `expected_pval` to the console during test execution for debugging purposes.
*   **Figures**: None generated.

### 7. Key Parameters
*   **`thresh` (0.1)**: The primary threshold used for the NBS edge-intensity filter.
*   **`ntrials` (25)**: The number of permutations used in the NBS process.
*   **`atol`**: Absolute tolerance for floating-point comparisons, ensuring tests pass despite minor variations in permutation results.
*   **`paired` (bool)**: Determines if the statistical comparison is performed as an independent or paired-sample test.

---

## test/nodals_test.py

This file, `test/nodals_test.py`, is a unit testing module designed to verify the correctness of graph theory metrics calculated by the Brain Connectivity Toolbox (BCT) implementation within the research repository.

### 1. Purpose
The file serves as a regression test suite to ensure that global and local efficiency metrics for both weighted and binary graphs are calculated accurately according to expected benchmarks. It validates that the implemented algorithms produce results consistent with known reference values.

### 2. Key Functions/Classes
*   **`test_glob_eff()`**: Validates the global efficiency calculation for weighted networks.
*   **`test_loc_eff()`**: Validates local efficiency calculations, testing both "original" and standard weighted methods.
*   **`test_glob_eff_bin()`**: Verifies that binary global efficiency calculations yield consistent results when applied to raw weighted data vs. pre-binarized data.
*   **`test_loc_eff_bin()`**: Verifies consistency in local efficiency calculations for binary network representations.

### 3. Data Flow
*   **Reads**: The file calls `load_sample()` (from `.load_samples`) to retrieve a sample network matrix (graph) for testing purposes.
*   **Processes**: It passes the loaded sample into `bct` functions, calculates efficiency metrics, and compares these values against hardcoded expected outputs using `np.allclose`.
*   **Writes**: No persistent files are written; the output is limited to standard console print statements for debugging/verification during test execution.

### 4. Dependencies
*   **External**: 
    *   `numpy`: Used for array manipulation and numerical comparison (`allclose`).
    *   `bct`: The Brain Connectivity Toolbox, which provides the graph theoretical algorithms being tested.
*   **Internal**: 
    *   `.load_samples`: A local utility used to import the test graph data.

### 5. Analysis Methods
*   **Graph Theory Efficiency**: The tests cover both Global Efficiency (a measure of network integration) and Local Efficiency (a measure of segregation/cluster-level connectivity).
*   **Unit Testing (Assertion)**: Employs standard numerical tolerance checks (`atol`) to handle floating-point precision differences between the computed result and the expected benchmark.

### 6. Figures/Outputs
*   **Console Output**: The file prints the calculated efficiency values alongside the expected benchmark values, serving as a rudimentary log of test results. No graphical figures or plots are generated.

### 7. Key Parameters
*   **`thres=.4`**: A sparsity or weight threshold passed to the `load_sample` function to standardize the test graph density.
*   **`atol`**: Absolute tolerance values (set to `1e-4` for global metrics and `0.1` for local efficiency sums), defining the acceptable margin of error for numerical validation.

---

## test/partition_distance_test.py

This analysis covers the `test/partition_distance_test.py` file, which serves as a validation script for verifying community structure comparison metrics within a neuroimaging analysis pipeline.

### 1. Purpose
The file performs unit testing to ensure the correct calculation of partition distance metrics (Variation of Information and Mutual Information) between two different brain network modalities (Q-ball and DSI). It validates that the implemented algorithms match established benchmark values for comparing community assignments.

### 2. Key Functions/Classes
*   **`test_partition_distance()`**: The primary test function that orchestrates the loading of brain network data, computes modularity partitions, calculates distance metrics, and asserts the accuracy of the results against expected values.

### 3. Data Flow
*   **Input**: Loads sample group data for Q-ball and DSI modalities via helper functions.
*   **Processing**:
    1. Averages multi-slice data into a single representative adjacency matrix for each modality.
    2. Performs community detection (modularity) to generate partition vectors.
    3. Computes the partition distance between the two resulting vectors.
*   **Output**: Prints the computed distance metrics and performs a boolean assertion against hardcoded expected values.

### 4. Dependencies
*   **Local Modules**: `load_samples.py` (specifically `load_sample_group_qball` and `load_sample_group_dsi`).
*   **External Libraries**: 
    *   `numpy`: Used for matrix averaging and numerical assertions.
    *   `bct`: The Brain Connectivity Toolbox (Python implementation), used for modularity detection and partition distance calculation.

### 5. Analysis Methods
*   **Modularity Maximization (`bct.modularity_und`)**: Detects community structure within undirected weighted networks.
*   **Partition Comparison (`bct.partition_distance`)**: 
    *   **Variation of Information (VI)**: Measures the distance between two partitions based on information theory.
    *   **Mutual Information (MI)**: Quantifies the "amount of information" obtained about one partition through the other.

### 6. Figures/Outputs
*   **Console Output**: Prints the calculated `vi` and `mi` values to the standard output.
*   **Test Result**: Returns a success/fail state for the test runner (e.g., `pytest`). No visual plots are generated.

### 7. Key Parameters
*   **`atol=0.01`**: The absolute tolerance parameter used in the `np.allclose` assertions, allowing for minor floating-point variations in the distance calculations.
*   **Expected Constants**: `0.1964` (target VI) and `0.6394` (target MI), which represent the benchmarks for the specific sample datasets provided.

---

## test/reference_test.py

This analysis covers the `test/reference_test.py` file, which serves as a validation suite for the Brain Connectivity Toolbox (BCT) implementation within the repository.

### 1. Purpose
The file performs unit and regression testing for specific graph-theoretical algorithms (null model generation and randomized network rewiring) in the `bct` library. It ensures the mathematical consistency of network randomization functions and tracks known issues via regression tests.

### 2. Key Functions/Classes
*   `test_null_model_und_sign()`: Regression test for undirected signed null model generation.
*   `test_null_model_dir_sign()`: Regression test for directed signed null model generation.
*   `test_randmio_und_seed()`: Validates that the randomized rewiring algorithm produces deterministic outputs when provided with a consistent random seed.

### 3. Data Flow
*   **Reads**: Imports network adjacency matrices via `load_sample` and `load_directed_sample` from a local module (`.load_samples`).
*   **Processes**: Passes network matrices into BCT functions (`null_model_und_sign`, `null_model_dir_sign`, `randmio_und`).
*   **Outputs**: Performs boolean assertions (`assert`) to verify equality/inequality of the processed matrices.

### 4. Dependencies
*   **`pytest`**: Testing framework used for running the suite.
*   **`numpy`**: Used for numerical array handling and comparison (`np.allclose`).
*   **`bct`**: The Brain Connectivity Toolbox library being tested.
*   **`.load_samples`**: A local project module used to fetch test datasets.

### 5. Analysis Methods
*   **Null Model Generation**: Tests the generation of randomized networks that preserve specific topological properties (degree/weight distribution).
*   **Deterministic Randomization**: Uses random seed propagation to test the repeatability of Markov-chain-based graph rewiring (`randmio_und`).
*   **Regression Analysis**: Uses `pytest.mark.xfail` to document known unresolved bugs (specifically referencing bug #68).

### 6. Figures/Outputs
*   **None**: This is a test script; it generates no visual figures or persistent output files. Its "output" is a pass/fail status provided by the `pytest` runner.

### 7. Key Parameters
*   `SEED` (int): A constant (`1`) used to control the stochastic nature of the randomization algorithms.
*   `thres` (float): A threshold value (e.g., `0.4`) used by the loading functions to prune network edges before testing.
*   `swaps` (int): The number of rewiring iterations performed in `randmio_und` (set to `5` in the test).

---

## test/simple_script.py

### Analysis Summary: `test/simple_script.py`

#### 1. Purpose
This script serves as a functional test suite to ensure that the `bct` (Brain Connectivity Toolbox) library correctly processes graph-theoretic metrics and that citation tracking/metadata for these functions is correctly implemented.

#### 2. Key Functions/Classes
*   `bct.binarize()`: Converts a weighted adjacency matrix into a binary (unweighted) adjacency matrix.
*   `bct.efficiency_bin()`: Calculates the global efficiency of a binary graph.
*   `bct.modularity_und()`: Computes the modularity index and community structure of an undirected graph.
*   `bct.randmio_und_connected()`: Generates a null-model random graph with the same degree distribution as the input, while maintaining connectivity.

#### 3. Data Flow
*   **Input**: A hardcoded string representing the edge list of the Zachary Karate Club social network.
*   **Processing**: The string is parsed into a 34x34 adjacency matrix, which is then symmetrized, binarized, and passed through various connectivity analysis functions.
*   **Output**: The script stores intermediate results in variables (`eff`, `mod`, `rand`), though it does not explicitly print or save them to disk.

#### 4. Dependencies
*   `numpy`: Used for matrix manipulation and pseudo-random number generation.
*   `bct`: The Brain Connectivity Toolbox (Python implementation).

#### 5. Analysis Methods
*   **Graph Theory**: Computes global efficiency, modularity (community detection), and degree-preserving randomization of a social network graph.

#### 6. Figures/Outputs
*   **None**: The script runs in a headless state. It is designed to verify execution completion rather than produce visual output.

#### 7. Key Parameters
*   `np.random.seed(1991)`: Ensures the reproducibility of the random graph generation.
*   `5` (in `randmio_und_connected`): The number of iterations or attempts used to shuffle the network while maintaining connectivity/degree distribution.

---

## test/very_long_test.py

This file is a test script designed to verify the functionality of a specific network analysis algorithm within the Brain Connectivity Toolbox (BCT) wrapper.

### 1. Purpose
The file serves as a long-running integration test for the `link_communities` algorithm to ensure it correctly processes connectivity data and produces valid output without crashing.

### 2. Key Functions/Classes
*   `test_link_communities()`: A test function marked with the `pytest.mark.long` decorator, indicating it is intended for a comprehensive test suite rather than quick unit testing. It executes the algorithm and performs a validation assertion.

### 3. Data Flow
*   **Input**: Loads a sample network dataset via the `load_sample` utility function.
*   **Processing**: Passes the sample matrix `x` to `bct.link_communities`.
*   **Output**: Asserts that the maximum value in the resulting partition matrix `M` equals 1, confirming a successful identification of link communities.

### 4. Dependencies
*   **`pytest`**: Testing framework.
*   **`numpy`**: For numerical operations and validation of the output matrix.
*   **`bct`**: The target library being tested (Brain Connectivity Toolbox).
*   **`.load_samples` (Local)**: A utility script within the repository used to retrieve sample connectivity matrices for testing.

### 5. Analysis Methods
*   **Link Communities**: This method represents a network community detection algorithm that clusters edges (links) rather than nodes, allowing for overlapping community assignments.

### 6. Figures/Outputs
*   **No visual output**: The script does not generate plots or figures; it produces a boolean success/fail status for the test runner.

### 7. Key Parameters
*   **`thres=0.4`**: Passed to `load_sample`, this defines the density or weight threshold used to generate the sample adjacency matrix.
*   **`seed = 949389104`**: Though defined in the code, it is currently unused in the algorithm call; it appears to be a placeholder for ensuring reproducibility in future or alternate iterations of the test.

---

