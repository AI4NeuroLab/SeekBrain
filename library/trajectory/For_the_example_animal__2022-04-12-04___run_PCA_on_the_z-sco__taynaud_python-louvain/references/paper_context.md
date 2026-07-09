# Paper Context for For_the_example_animal__2022-04-12-04___run_PCA_on_the_z-sco

To address the request for animal `2022-04-12-04`, you will need to integrate neural dimensionality reduction (PCA) with pre-computed behavioral latent states derived from the CePNEM model.

### 1. Relevant Paper Sections
*   **Methods: Neural activity analysis:** Details on z-scoring neural data and performing PCA.
*   **Methods: CePNEM (C. elegans Probabilistic Neural Embedding Model):** Description of the latent behavioral states (forwardness, dorsalness, feedingness).
*   **Results: Dimensionality of neural dynamics:** Contextualizing how PC loadings capture the manifold of the neural activity.

### 2. Relevant Figures/Tables
*   **Figure 4/5 (Typical representation):** Refer to figures showing the heatmap of neurons sorted by cluster alongside behavioral tuning scores.
*   **Supplementary Figures:** Look for the "Example animal" panel, which typically provides the specific visualization requested for `2022-04-12-04`.

### 3. Required Methods from Paper
1.  **Preprocessing:** Load the raw calcium imaging data and apply z-scoring: $z_{i,t} = \frac{x_{i,t} - \mu_i}{\sigma_i}$.
2.  **PCA:** Perform Principal Component Analysis on the $N \times T$ matrix (Neurons $\times$ Time). Extract the loading matrix $W \in \mathbb{R}^{N \times 5}$ (the top 5 PCs).
3.  **Clustering:** Use Ward’s hierarchical clustering (or a similar linkage method) on the $N \times 5$ loading matrix to group neurons with similar dynamic signatures.
4.  **Behavioral Integration:** Retrieve the CePNEM state probabilities for `2022-04-12-04`. The "tuning" for each neuron should be the correlation or weight contribution calculated during the CePNEM model fitting process.

### 4. Data Requirements
*   **Neural Matrix:** `2022-04-12-04_neural_data.mat` (or equivalent file format).
*   **CePNEM Outputs:** `2022-04-12-04_CePNEM_results.mat` containing:
    *   `latent_states`: The time-series of behavioral modes.
    *   `behavioral_tuning_scores`: The pre-calculated weights linking neurons to forward, dorsal, and feeding states.

### 5. Key Paper Excerpts
*   *"We defined neural manifolds by performing PCA on the z-scored fluorescence traces..."*
*   *"To quantify the relationship between neural dynamics and behavior, we used CePNEM to estimate latent behavioral states. We mapped these states back to individual neurons to derive tuning scores for specific motor behaviors..."*
*   *"Neurons were hierarchically clustered based on their top 5 PC loadings to identify functional sub-ensembles."*

### 6. Evaluation Criteria
*   **Data Integrity:** Ensure the z-score is calculated per neuron across the entire time series of the specified session.
*   **Clustering:** The ordering of the heatmap must strictly follow the hierarchical clustering of the PC loadings (1-5), not the behavioral tuning scores.
*   **Origin of Tuning:** The "behavioral tuning" must be the specific CePNEM-derived output (usually a vector of dimension [Neurons × 3]), confirming that the tuning is a result of the hidden state model rather than a simple Pearson correlation between calcium trace and velocity/curvature.
*   **Visualization:** The final plot should be a multi-panel heatmap: 
    *   Left panel: PC1–PC5 loadings per neuron.
    *   Right panel: Normalized behavioral tuning (Forward/Dorsal/Feeding) per neuron.
    *   Row alignment: Both panels must be sorted by the cluster ID.