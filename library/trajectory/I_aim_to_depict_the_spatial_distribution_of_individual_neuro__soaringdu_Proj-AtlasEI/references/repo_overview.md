# Repository Overview

This repository provides a specialized computational framework for the structural analysis, classification, and topological modeling of neuronal systems. It combines machine learning for morphological characterization with graph theory for network-level connectivity analysis.

---

### 1. Repository Purpose
The repository is designed to facilitate a multi-scale study of neurons:
*   **Morphological Analysis**: Classifying neuronal types and identifying cell polarity (axon vs. dendrite).
*   **Structural Connectivity**: Analyzing directed brain networks (Excitatory/Inhibitory) to characterize local connectivity patterns (motifs) and identify critical network hubs.

### 2. Data Pipeline
The analysis generally follows a three-stage pipeline across the different files:
1.  **Data Ingestion**: Loading raw neuronal morphologies (SWC format) or connectivity matrices (CSV format) via the `snat` library or `pandas`.
2.  **Transformation & Processing**:
    *   *Morphological*: Distance computation, feature scaling, and hierarchical clustering.
    *   *Graph-based*: Matrix-to-graph conversion, normalization of edge weights, and topological metric calculation.
3.  **Modeling & Inference**: Training SVM classifiers for polarity, calculating motif frequencies for connectivity, and applying perturbation analysis to assess network robustness.

### 3. Key Scripts & Their Roles
*   **`morphology-based_neuron_classification.ipynb`**: Hierarchical clustering pipeline for structural grouping of neurons based on morphological distance metrics.
*   **`neuronal_polarity_identification.ipynb`**: A supervised learning workflow (SVM-based) to classify axon/dendrite polarity in neurons.
*   **`motif_analysis.py`**: Performs sub-graph motif identification (13 types) and robustness testing via node-removal simulations on brain networks.
*   **`network_hub_analysis.ipynb`**: Diagnostic notebook for identifying "hub" regions in networks using centrality metrics and t-SNE dimensionality reduction.

### 4. Analysis Methods Implemented
*   **Machine Learning**: Support Vector Machines (SVM) with RBF kernels for classification; Z-score normalization; 20-fold cross-validation.
*   **Graph Theory**: NetworkX-based DiGraph analysis including centrality (PageRank, betweenness, closeness, closeness vitality), shortest path analysis, and graph isomorphism for motif detection.
*   **Clustering & Dimensionality Reduction**: Ward’s linkage for hierarchical clustering; t-SNE for visualizing hub feature distributions.
*   **Simulation**: Comparative robustness tests comparing random node removal vs. motif-specific node deletion.

### 5. Outputs & Figures
*   **Visualizations**:
    *   *Morphology*: Dendrograms showing hierarchical neuron clusters.
    *   *Connectivity*: Motif frequency bar charts, recurrent loop distributions, and network topology layouts (Kamada-Kawai).
    *   *Diagnostic*: Learning curves (model performance) and t-SNE plots (hub clustering).
*   **Data/Models**: Exported `.swc` files with classification labels, serialized `.model`/`.scaler` artifacts, and `.json` motif count dictionaries.

### 6. Dependencies & Environment
*   **Core Research Library**: `snat` (Specialized Synaptic Neuron Analysis Tools).
*   **Scientific Stack**: `numpy`, `pandas`, `scipy`, `matplotlib`, `scikit-learn`.
*   **Graph/Data Tools**: `networkx` (graph structure), `joblib` (parallel processing/serialization).

### 7. File Dependency Graph
The repository structure suggests a modular dependency hierarchy:

*   **`snat` (Custom Library)** $\rightarrow$ Serves as the backbone for:
    *   `morphology-based_neuron_classification.ipynb`
    *   `neuronal_polarity_identification.ipynb`
*   **`networkx` / `pandas`** $\rightarrow$ Serve as the backbone for:
    *   `motif_analysis.py`
    *   `network_hub_analysis.ipynb`
*   **Data Inputs**:
    *   CSV Matrices $\rightarrow$ `motif_analysis.py`, `network_hub_analysis.ipynb`
    *   Morphological Files $\rightarrow$ `morphology-based_neuron_classification.ipynb`, `neuronal_polarity_identification.ipynb`

Repository Structure:
  morphology-based_neuron_classification.ipynb (985 chars)
  motif_analysis.py (9872 chars)
  network_hub_analysis.ipynb (6702 chars)
  neuronal_polarity_identification.ipynb (2437 chars)