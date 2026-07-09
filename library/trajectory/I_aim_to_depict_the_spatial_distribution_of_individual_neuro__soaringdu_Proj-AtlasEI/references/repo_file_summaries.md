# Repository File Summaries

## morphology-based_neuron_classification.ipynb

This analysis covers the `morphology-based_neuron_classification.ipynb` notebook, which provides a workflow for the hierarchical clustering of neuronal morphological data.

### 1. Purpose
This notebook performs morphological classification of neurons by calculating pairwise distance metrics and visualizing the results through hierarchical clustering. It serves as an analytical pipeline to group neurons based on structural similarities.

### 2. Key Functions/Classes
*   **`snat.datasets.load_fish_neurons`**: Loads the source neuronal dataset into the environment.
*   **`snat.distance.NeuronDistance`**: A class responsible for computing the distance matrix between neurons based on morphological information.
*   **`distance_score.pipline`**: Executes the computation of the distance metrics across multiple processor cores.
*   **`distance_score.negsigmoid_score`**: Normalizes the computed distance scores using a negative sigmoid function.
*   **`scipy.cluster.hierarchy.linkage`**: Performs hierarchical clustering on the normalized distance scores.
*   **`scipy.cluster.hierarchy.dendrogram`**: Generates a visual representation (dendrogram) of the clustering process.

### 3. Data Flow
1.  **Input**: Reads raw neuron data from a user-specified `data_folder`.
2.  **Processing**: Computes a raw distance matrix, transforms it into a normalized score, and applies Ward’s linkage for clustering.
3.  **Output**: Updates the `information` attribute of the `distance_score` object by appending a column for `morphology_cluster_hierarchy`.

### 4. Dependencies
*   **`snat`**: Custom research package (likely specialized for **S**ynaptic **N**euron **A**nalysis **T**ools).
*   **`scipy`**: Used for hierarchical clustering (`scipy.cluster.hierarchy`).
*   **`matplotlib.pyplot`**: Used for visualizing the clustering dendrogram.

### 5. Analysis Methods
*   **Distance Metric**: Uses the `NeuronDistance` algorithm provided by the `snat` library.
*   **Clustering**: Implements **Ward’s Method** (`ward`) for agglomerative hierarchical clustering, which minimizes the variance of clusters being merged.
*   **Transformation**: Employs a negative sigmoid function to bound or normalize the distance scores.

### 6. Figures/Outputs
*   **Dendrogram**: A truncated tree plot (`p=80` levels deep) displaying the hierarchical relationship between neuron clusters, color-coded based on the similarity threshold.
*   **Dataframe Update**: Modifies the internal metadata table to include assigned cluster IDs for each neuron.

### 7. Key Parameters
*   **`core`**: Number of processor cores used for distance calculations (set to 4).
*   **`threshold`**: The cutoff value (currently 2.5) used to determine the height at which the dendrogram is cut to form distinct clusters (`hierarchy.fcluster`).
*   **`p`**: The number of levels to display in the truncated dendrogram (set to 80).

---

## motif_analysis.py

This code file, `motif_analysis.py`, performs a structural analysis of excitatory and inhibitory brain connectivity networks by identifying and characterizing sub-graph motifs.

### 1. Purpose
The script analyzes directed graph representations of neural networks (Excitatory and Inhibitory) to identify the frequency of specific 3-node motifs and investigate their functional importance through perturbation analysis (node removal).

### 2. Key Functions/Classes
*   `mcounter(gr, mo)`: Iterates through all unique 3-node subgraphs of a network and counts the frequency of each defined motif (`S1`-`S13`) using graph isomorphism.
*   `mcounter_motifs(gr, mo)`: Similar to `mcounter`, but returns a dictionary containing the actual node identities (list of triplets) for each detected motif occurrence.
*   `Fun_perturbation_motifs(...)`: Conducts a comparative robustness test by calculating the average shortest path length of a graph after removing either randomly selected nodes or nodes identified as part of a specific motif.

### 3. Data Flow
*   **Input**: Reads two CSV files: `all_region_region_complete_projection_length_Excitatory.csv` and `all_region_region_complete_projection_length_Inhibitory.csv`.
*   **Processing**: Converts CSV data into `networkx.DiGraph` objects, filters subgraphs, performs topological analysis (shortest paths and motif identification), and runs perturbation simulations.
*   **Output**: Exports motif count dictionaries as `.json` files and saves various diagnostic plots as `.pdf` files.

### 4. Dependencies
*   **Standard Python**: `itertools`, `sys`, `json`.
*   **Scientific Stack**: `numpy`, `pandas`, `networkx` (graph analysis), `matplotlib.pyplot` (visualization).

### 5. Analysis Methods
*   **Network Motif Identification**: Uses 3-node directed graph patterns to characterize local network topology.
*   **Graph Isomorphism**: Utilizes `nx.is_isomorphic` to categorize identified 3-node sub-graphs into 13 predefined categories.
*   **Network Robustness Analysis**: Compares network integrity (via average shortest path) after removing target motifs versus random node removal to assess the structural "value" of those motifs.
*   **Path Length Analysis**: Calculates shortest path distribution to evaluate recurrent loops within the networks.

### 6. Figures/Outputs
*   **Motif Visualization**: Saves individual images of the 13 motif types (`Motifs_figures_S*.pdf`).
*   **Statistical Plots**:
    *   `Figures_4_three_regions.pdf`: Bar chart comparing motif frequency between Excitatory and Inhibitory networks.
    *   `Figures_5_RecurrentLoops.pdf`: Bar chart showing loop length distributions.
    *   **Perturbation Histogram**: A histogram showing the effect on network shortest path length comparing random node deletion vs. motif-specific node deletion.

### 7. Key Parameters
*   **Motif Definitions**: The `motifs` dictionary defines the structural topology of the 13 classes (S1–S13) being analyzed.
*   **Perturbation Iterations**: The perturbation function defaults to 100 iterations (`range(100)`) for both random and motif-based node deletion.
*   **Perturbation Size**: Fixed at 3 nodes per deletion event.

---

## network_hub_analysis.ipynb

This analysis covers the `network_hub_analysis.ipynb` file, a diagnostic notebook designed for structural network analysis.

### 1. Purpose
The file performs a comprehensive topological analysis of a weighted directed graph to identify "hub" nodes. It calculates various centrality and strength metrics and visualizes them using dimensionality reduction (t-SNE) and network layouts.

### 2. Key Functions/Classes
*   `CreateGraphFromMatrix(table, header)`: Converts a square adjacency matrix into a `networkx.DiGraph`, filtering out zero-weight edges.
*   `AddNormDistanceAttributes(DG)`: Normalizes edge weights to a range of [0, 1] to serve as "normcost" attributes.
*   `MaxMinNorm(data)`: Helper utility to scale input data into a [0, 1] range using min-max normalization.
*   `HubFeatures(G)`: Computes an extensive suite of graph-theoretic metrics for every node (in/out degree, centrality, PageRank, clustering, and closeness vitality).

### 3. Data Flow
*   **Input**: Reads a CSV file representing an adjacency matrix via `pandas`.
*   **Processing**: Transforms the matrix into a `NetworkX` directed graph object. Generates a feature matrix (nodes × metrics) by calculating centrality measures.
*   **Output**: Produces processed feature matrices, hub ranking data, and multiple visualizations for qualitative assessment.

### 4. Dependencies
*   **NetworkX**: Graph construction and metric calculation.
*   **NumPy/Pandas**: Data manipulation and numerical operations.
*   **Matplotlib**: Visualization.
*   **Scikit-learn**: `manifold.TSNE` for dimensionality reduction.

### 5. Analysis Methods
*   **Centrality Metrics**: Uses `networkx` to calculate degree, betweenness, closeness, PageRank, clustering coefficients, and closeness vitality.
*   **Hub Identification**: Identifies hubs by finding nodes that exceed mean values across all computed features or by identifying nodes that rank highest in individual features.
*   **Dimensionality Reduction**: Uses t-SNE to project high-dimensional centrality metrics into a 2D space for cluster/hub visualization.

### 6. Figures/Outputs
*   **t-SNE Projection**: A 2D plot showing node distribution based on hub scores, with special markers for "high-score" hubs.
*   **Bar Chart**: A multi-series bar plot comparing all nine centrality metrics per node (region).
*   **Network Layouts**:
    *   **Kamada-Kawai Network Plot**: Visualizes the graph topology.
    *   **Closeness Vitality Plot**: A network graph where nodes are color-coded based on their closeness vitality.

### 7. Key Parameters
*   `filename`: Path to the CSV adjacency matrix (must be provided by the user).
*   `perplexity` (in t-SNE): Default set to 20, controlling the local vs. global focus of the manifold projection.
*   `width` (in visualization): Scales edge width based on edge betweenness centrality.

---

## neuronal_polarity_identification.ipynb

### Analysis Report: `neuronal_polarity_identification.ipynb`

#### 1. Purpose
This notebook implements a machine learning workflow to identify neuronal polarity (e.g., axon vs. dendrite classification) using morphological data. It guides the user through training a classifier, evaluating performance via learning curves, and applying the model to new datasets.

#### 2. Key Functions/Classes
*   **`snat.datasets.load_fish_neuron_forest`**: Loads neuronal morphological data from a specified directory.
*   **`snat.cluster.training`**: Performs the core model training using the loaded neuron dataset.
*   **`snat.datasets.save_neurons_as_swc`**: Exports classified neuron data in the standard SWC format.
*   **`MultiProcessJobs`**: A utility function to parallelize the prediction process across multiple CPU cores.
*   **`sklearn.model_selection.learning_curve`**: Used to evaluate the model's bias/variance and generalization performance.

#### 3. Data Flow
*   **Input**: Reads neuron morphological data from user-defined folders (`train_data_folder`, `predi_data_folder`).
*   **Processing**:
    *   Data is randomized and normalized using `sklearn.preprocessing.StandardScaler`.
    *   Features are fed into the training pipeline.
    *   Model predictions are applied to new neuron objects.
*   **Output**: Saves the trained `model` and `scaler` objects as serialized files; exports processed neuron data as `.swc` files.

#### 4. Dependencies
*   **Scientific Stack**: `numpy`, `matplotlib`, `sklearn` (Scikit-Learn).
*   **Repo-Specific**: `snat` (a custom library for neuron analysis/topology).
*   **Utilities**: `joblib` (for model serialization), `multiprocessing`.

#### 5. Analysis Methods
*   **Feature Scaling**: Z-score normalization (`StandardScaler`).
*   **Classification**: Support Vector Machine (`SVC`) with an RBF kernel.
*   **Model Validation**: 20-fold cross-validation with learning curves to visualize training vs. testing performance.
*   **Parallel Computing**: Uses `multiprocessing` to accelerate the prediction phase on large-scale neuronal datasets.

#### 6. Figures/Outputs
*   **Learning Curve Plot**: A Matplotlib visualization plotting training error vs. testing error against the number of training examples, used to diagnose model convergence and overfitting.
*   **SWC Files**: Exported neuronal morphology files containing classification labels.
*   **Model Files**: `lr.model` and `lr.scaler` (serialized artifacts for future use).

#### 7. Key Parameters
*   **`train_sizes`**: Range of training example subsets (10% to 100%) for the learning curve.
*   **`kernel='rbf'`**: Defines the non-linear decision boundary for the SVM classifier.
*   **`cv=20`**: Number of cross-validation folds.
*   **`core`**: Number of CPU cores allocated for parallel processing of neuronal predictions.
*   **`train_data_folder` / `predi_data_folder`**: Essential file system paths required for execution.

---

