# Scientific context

## Methodological requirements

*   **CePNEM (Cell-type-specific Population Neural Encoding Model):** This is the core method for calculating the "feeding tuning" index used to color the UMAP. 
*   **UMAP (Uniform Manifold Approximation and Projection):** The dimensionality reduction algorithm used to embed the high-dimensional neural activity into a 2D or 3D space.
*   **Cross-Animal Alignment/Concatenation:** The method used to combine data from "14 animals" into a single latent space.
*   **Tuning Index Calculation:** The specific statistical thresholding used to classify neurons as "feeding-activated" vs. "feeding-inhibited."

## Required data

*   **Neural Activity Matrix:** Spikes or calcium imaging traces for all neurons across the 14 animals.
*   **Behavioral Annotations:** High-resolution feeding event timestamps aligned with neural data.
*   **CePNEM Derived Coefficients:** The output vector of feeding-tuning weights for each neuron.
*   **UMAP Coordinates:** The (x, y) coordinates for each neuron in the embedding.

## Validation criteria

To determine if the UMAP organization successfully reveals the encoding structure, the analysis must meet these criteria:
*   **Gradient Continuity:** Does the UMAP show a smooth transition (a color gradient) rather than a sharp binary cluster?
*   **Consistency:** Is the observed axis of encoding consistent across the majority of the 14 animals included in the pooled dataset?
*   **Functional Correlation:** Is the UMAP axis orientation significantly correlated with the underlying tuning coefficients derived by the CePNEM model?
*   **Dimensionality Robustness:** Was the UMAP result checked against multiple perplexity/neighbor settings to ensure the "axis" is not an artifact of parameter choice?
