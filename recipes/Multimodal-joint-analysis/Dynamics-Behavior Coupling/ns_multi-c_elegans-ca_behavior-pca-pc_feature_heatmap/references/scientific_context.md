# Scientific context

## Methodological requirements

*   **Preprocessing:** Z-scoring the neural activity matrix $Y$ (typically $Z = \frac{Y - \mu}{\sigma}$).
*   **Dimensionality Reduction:** Applying Principal Component Analysis (PCA) to the z-scored matrix to extract the loading matrix $L$ ($N_{neurons} \times K_{pcs}$).
*   **Clustering:** Hierarchical clustering using the top 5 PC loadings as input features (typically using Ward’s linkage or Euclidean distance).
*   **Behavioral Mapping:** Extraction of parameters from the CePNEM fit specific to the session `2022-04-12-04`. Specifically, the posterior means or regression weights for behavioral states (forwardness, dorsalness, feedingness) as defined in the CePNEM model documentation.

## Required data

*   **Raw Data:** Neural calcium imaging time series for animal `2022-04-12-04`.
*   **CePNEM Model Outputs:** Pre-calculated model fit files for this specific animal containing the behavioral tuning coefficients.
*   **Metadata:** Behavioral state log for the recording period to align neural time-bins with CePNEM states.

## Validation criteria

*   **Correctness of Normalization:** Ensure the PCA input is z-scored (standardized).
*   **Feature Selection:** The input to the clustering algorithm must strictly be the $N \times 5$ loading matrix.
*   **Provenance:** Ensure behavioral tuning values match the specific CePNEM parameters for the identified animal, not simple cross-correlation values.
*   **Visualization Accuracy:** The final heatmap must align the CePNEM-derived behavioral tuning values with the PCA loading clusters, sorted by the clustering order.
