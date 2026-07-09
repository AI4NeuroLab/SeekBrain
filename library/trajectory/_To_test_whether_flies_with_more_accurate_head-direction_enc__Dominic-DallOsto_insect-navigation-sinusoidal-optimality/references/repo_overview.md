# Repository Overview

This repository provides the computational framework for the research paper: *"Theoretical principles explain the structure of the insect head direction circuit"* (*eLife* 2024). It investigates how circulant ring networks in the insect brain (specifically the *Drosophila* ellipsoid body) use Fourier-based encoding to achieve noise resilience, self-stabilization, and signal optimality.

---

### 1. Repository Purpose
The repository serves as a dual-purpose toolkit:
*   **Theoretical Modeling**: It explores how sinusoidal activity profiles and harmonic encoding optimize neural representations for noise rejection and spatial navigation.
*   **Biological Validation**: It bridges abstract mathematical models with empirical connectomic data, mapping theoretical optimal structures against actual fruit fly synaptic connectivity.

### 2. Data Pipeline
1.  **Ingestion**: Connectomic data from the Janelia Hemibrain dataset (`.csv` files) is parsed to extract synaptic weights and neuron populations (PEN, PEG, EPG, D7).
2.  **Transformation**: Raw connectivity is processed into grouped/hemisphere-folded adjacency matrices and represented as circulant graphs.
3.  **Simulation**: Neural activity is evolved using linear dynamical systems ($\dot{a} = -a + Wa + u$) and Hebbian learning rules (Oja’s Rule) to study how connectivity evolves toward theoretical optima.
4.  **Verification**: The system uses Maximum Likelihood Estimation (MLE) and harmonic spectral analysis to compare the "theoretical" connectivity profile with the "biological" connectivity profile.

### 3. Key Scripts & Their Roles
*   **Data Management**: `connectivity_matrices.py` acts as the primary interface for loading, slicing, and transforming connectome data into mathematical graphs.
*   **Biological Comparison**: `insect network graph analysis.ipynb` and `fruit_fly_data_analysis.ipynb` perform the structural comparison between fly connectomics and idealized ring attractors.
*   **Learning Dynamics**: `sinusoidal Hebbian learning weights...ipynb` and `sinusoidal Oja's rule...ipynb` series simulate how synaptic weights converge given sinusoidal inputs.
*   **Noise/Robustness**: `sinusoidal noise rejection...ipynb` and `encoding with multiple harmonics.ipynb` evaluate the error-correction capability of Fourier-mode based representations.

### 4. Analysis Methods Implemented
*   **Fourier/Spectral Analysis**: Decomposing connectivity and activity into harmonic modes to optimize filtering.
*   **Hebbian Learning (Oja's Rule)**: Simulating the co-evolution of activity patterns and synaptic weights with weight decay constraints.
*   **Circulant Matrix Theory**: Utilizing translation-invariant matrix structures to represent ring-attractor dynamics.
*   **Phase Portrait Analysis**: Visualizing vector fields to confirm the stability of neural attractors.
*   **Maximum Likelihood Estimation (MLE)**: Used for decoding noisy neural population activity into spatial $(x, y)$ coordinates.

### 5. Outputs & Figures
*   **Connectivity Heatmaps**: Publication-quality matrices showing grouped neuronal connections.
*   **Phase Portraits**: Quiver plots demonstrating convergence of weights/activity towards stable points.
*   **Noise Sensitivity Plots**: Quantitative curves showing how decoding error scales with noise variance.
*   **Spectral Profiles**: Plots comparing empirical synaptic weight profiles against theoretically derived Fourier mode models.

### 6. Dependencies & Environment
*   **Core**: `numpy`, `scipy` (specifically `linalg.circulant`), `matplotlib`.
*   **Graph/Data**: `networkx`, `pandas`.
*   **Environment**: Jupyter Notebooks for execution; Python 3.x scientific stack.
*   **Biological Data**: Janelia Hemibrain v1.2 datasets.

### 7. File Dependency Graph
*   **Core Modules**: `connectivity_matrices.py` $\rightarrow$ feeds raw data to almost all analysis notebooks.
*   **Theoretical Models**:
    *   *Hebbian/Oja Series* $\leftarrow$ `phase portraits.ipynb` (analysis of convergence).
    *   *Noise/Harmonic Series* $\leftarrow$ `polar coordinates noise distribution.ipynb` (validation of the probability density of noise).
*   **Integration**:
    *   `insect network graph analysis.ipynb` $\rightarrow$ imports `connectivity_matrices.py` to compare biological graphs with theoretical harmonic-based circular matrices.

Repository Structure:
  README.md (2078 chars)
  connectivity_matrices.py (11415 chars)
  encoding with multiple harmonics.ipynb (30290 chars)
  fruit_fly_data_analysis.ipynb (18772 chars)
  insect network graph analysis.ipynb (57790 chars)
  noise affected multiple harmonics encoding.ipynb (34165 chars)
  phase portaits.ipynb (5950 chars)
  polar coordinates noise distribution.ipynb (10762 chars)
  sinusoidal Hebbian learning weights negative activity with errors.ipynb (11456 chars)
  sinusoidal Hebbian learning weights negative activity.ipynb (11174 chars)
  sinusoidal Hebbian learning weights.ipynb (8346 chars)
  sinusoidal Oja's rule negative activity.ipynb (13495 chars)
  sinusoidal input rejection.ipynb (3314 chars)
  sinusoidal noise rejection negative activity.ipynb (19533 chars)
  sinusoidal noise rejection.ipynb (8652 chars)
  sinusoidal phase portraits negative activity.ipynb (9225 chars)
  sinusoidal updating activity and weights.ipynb (16763 chars)
  sinusoidal-ei-network-maths.ipynb (8719 chars)