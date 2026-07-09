# Structural Connectivity Hierarchical Consensus Module Detection

## Description
This skill identifies structural connectivity (SC) network modules in a zebrafish brain connectome using a hierarchical consensus clustering algorithm. It first generates a co-assignment probability matrix from an ensemble of 10,000 Louvain modularity partitions with varying resolution parameters, then applies Ward's hierarchical clustering to extract a specified number of modules (default 4). Modules are reordered by anterior-posterior anatomical position. The final visualization displays a dendrogram alongside the reordered co-assignment probability matrix with colored thick-edge boxes highlighting module boundaries.

## Tags
- structural connectivity
- consensus clustering
- Louvain modularity
- hierarchical clustering
- co-assignment probability
- Ward's linkage
- zebrafish connectome
- network modules
- community detection
- brain parcellation
- dendrogram
- matrix visualization

## Input
- **SC_matrix_directed_terminals_expanded.npy**: Directed structural connectivity matrix (N×N numpy array) located in `ZEBRAFISH_PATH/Files/`.
- **Figure1_excluded_regions.npy**: 1D numpy array of region indices to exclude from the analysis, located in `PROCESS_DATA_DIR`.

## Output
- **Figure3_coassignment_matrix_SC.npy**: Co-assignment probability matrix (M×M, where M = N − number of excluded regions), saved in `PROCESS_DATA_DIR`.
- **Figure3_coassignment_matrix_SC_4module.npy**: 1D array of module labels (1-indexed) from hierarchical clustering with 4 modules, saved in `PROCESS_DATA_DIR`.
- **Figure3_coassignment_matrix_SC_4module_ordered.npy**: 1D array of module labels reordered by anterior-posterior anatomical position, saved in `PROCESS_DATA_DIR`.
- **figure.png**: Composite visualization with dendrogram and co-assignment matrix, saved in `SAVE_DIR`.

## Algorithm / Processing Steps
1. **Data Loading & Region Exclusion**:
   - Load the directed SC matrix from file.
   - Load the excluded regions index array.
   - Create a boolean mask to remove excluded rows and columns from the SC matrix.

2. **Consensus Modularity Maximization**:
   - Call `compute_coassignment_probability()` with the filtered SC matrix.
   - Generate an ensemble of 10,000 node partitions using the iterative Louvain algorithm.
   - Vary the resolution parameter γ uniformly between 0.7 and 2.2 across iterations.
   - The function returns a co-assignment probability matrix C where C[i,j] represents the fraction of partitions in which nodes i and j were assigned to the same community.
   - Set `threshold=False` to skip null model subtraction.
   - Ensure the diagonal of the co-assignment matrix is 1.0.

3. **Hierarchical Clustering**:
   - Convert co-assignment probabilities to distances: D = 1 − C.
   - Clip negative distances to 0.
   - Convert the distance matrix to condensed form using `scipy.spatial.distance.squareform`.
   - Apply Ward's linkage (`scipy.cluster.hierarchy.linkage` with `method='ward'`) to obtain the linkage matrix Z.
   - Cut the dendrogram at 4 clusters using `scipy.cluster.hierarchy.fcluster` with `criterion='maxclust'`.

4. **Anterior-Posterior Reordering**:
   - Apply `reorder_clusters_anteroposterior()` to relabel modules based on their anterior-posterior anatomical position.

5. **Visualization**:
   - Create a figure with three axes: dendrogram (left), matrix (center), colorbar (right).
   - **Dendrogram**: Plot with `orientation='left'`, color the four main branches with module-specific colors (red, light yellow-green/#ADFF2F, cyan, purple/#9370DB). Style above-threshold branches in black with linewidth 0.5. Hide all spines, ticks, and labels.
   - **Matrix**: Reorder the co-assignment matrix and module labels according to dendrogram leaf order. Display with `cmap='gray'`. Draw colored thick-edge rectangles (linewidth 2.5) around each module's diagonal block using the same module color coding.
   - **Colorbar**: Vertical colorbar labeled "Coass. prob." on the right side.

## Key Parameters
| Parameter | Value | Description |
|-----------|-------|-------------|
| N_iters | 10,000 | Number of Louvain partitions in the ensemble |
| gamma_min | 0.7 | Minimum resolution parameter for Louvain |
| gamma_max | 2.2 | Maximum resolution parameter for Louvain |
| threshold | False | Do not subtract null model co-assignment matrix |
| n_clusters | 4 | Number of modules to extract from hierarchical clustering |
| linkage method | ward | Ward's minimum variance linkage |
| criterion | maxclust | Cut dendrogram by maximum number of clusters |
| cmap | gray | Colormap for co-assignment matrix |
| Module colors | red, #ADFF2F, cyan, #9370DB | Color coding for modules 1–4 |
| Box linewidth | 2.5 | Thickness of module boundary rectangles |
| Branch linewidth | 0.5 | Line width for dendrogram branches |

## Usage Example
```python
import os
import numpy as np
from scipy.cluster.hierarchy import linkage, fcluster
from scipy.spatial.distance import squareform

# Load data
SC_matrix = np.load(os.path.join(ZEBRAFISH_PATH, "Files", "SC_matrix_directed_terminals_expanded.npy"))
excluded = np.load(os.path.join(PROCESS_DATA_DIR, "Figure1_excluded_regions.npy")).astype(int)

# Exclude regions
keep = np.ones(SC_matrix.shape[0], dtype=bool)
keep[excluded] = False
SC_filtered = SC_matrix[keep][:, keep]

# Consensus clustering
coassignment = compute_coassignment_probability(
    SC_filtered, N_iters=10000, gamma_min=0.7, gamma_max=2.2, threshold=False
)
np.fill_diagonal(coassignment, 1.0)

# Hierarchical clustering
D = np.clip(1 - coassignment, 0, None)
Z = linkage(squareform(D, checks=False), method='ward')
communities = fcluster(Z, t=4, criterion='maxclust')
communities_ordered = reorder_clusters_anteroposterior(communities)
```

## Dependencies
- **Python packages**: numpy, scipy (cluster.hierarchy, spatial.distance), matplotlib
- **Custom utilities** (from zebrafish_Ca shared library):
  - `compute_coassignment_probability`: Generates co-assignment probability matrix via iterative Louvain modularity maximization
  - `reorder_clusters_anteroposterior`: Relabels cluster IDs based on anterior-posterior anatomical position
  - `plot_matrix_communities`: Plots a matrix with community boundary boxes (used as reference; manual implementation in visualization)
- **Environment variables**: `ZEBRAFISH_PATH`, `PROCESS_DATA_DIR`, `SAVE_DIR`

## Limitations
- The consensus clustering step with 10,000 iterations is computationally expensive and may take significant time.
- Results are stochastic due to the random nature of the Louvain algorithm; different runs may produce slightly different co-assignment matrices.
- The number of modules (4) is hardcoded; choosing an optimal number of modules requires additional validation (e.g., stability analysis across different cuts).
- The anterior-posterior reordering assumes a specific anatomical coordinate system embedded in the utility function.
- The `threshold=False` setting means the raw co-assignment probabilities are used without null model correction, which may include spurious co-assignments.
- Region exclusion relies on a pre-computed exclusion list; changes to exclusion criteria require regeneration of that file.

## Source
Derived from zebrafish structural connectivity analysis pipeline for consensus community detection, using iterative Louvain modularity maximization and Ward's hierarchical clustering on co-assignment probability matrices.
