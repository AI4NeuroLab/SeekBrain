---
name: ns_multi-c_elegans-ca_behavior-pca-pc_feature_heatmap
description: Performs PCA on z-scored neural activity, clusters neurons by PC loadings, and aligns results with CePNEM behavioral tuning for a specified experimental animal.
triggers:
  - run PCA and cluster neurons for animal 2022-04-12-04
  - generate a heatmap of PC loadings and CePNEM behavioral tuning
  - hierarchically cluster neural data using top 5 PCA components
  - analyze neural population dynamics using CePNEM model outputs
  - visualize behavioral tuning and PCA loading similarity for a specific session
tags:
  - PCA
  - CePNEM
  - hierarchical-clustering
  - neural-encoding
  - dimensionality-reduction
  - calcium-imaging
version: '1.0'
---

# Dimensionality Reduction and Behavioral Tuning Profiling for Neural Populations

This recipe describes the workflow for identifying functional neural manifolds in the example animal `2022-04-12-04`. The analysis requires reducing the dimensionality of neural activity to capture latent population dynamics and correlating these latent representations with behavioral state preferences. By combining standard PCA with hierarchical clustering of loading vectors, we can group neurons into functional ensembles and characterize them via CePNEM behavioral tuning parameters.

The integration of CePNEM model outputs allows for a robust interpretation of the manifold, moving beyond simple neural-behavior correlations. This workflow uses `scikit-learn` for PCA, `scipy` for clustering, and requires access to pre-calculated CePNEM model files.

## When to use this

- Cluster neurons from the top five PCA loading vectors and align the clusters with CePNEM tuning coefficients.
- Generate paired loading and behavioral-tuning heatmaps for a session with matched neuron identifiers.
- Do not use this workflow for demixed PCA or for datasets lacking compatible CePNEM outputs.

## Scientific context

Neural population dynamics often reside on low-dimensional manifolds. Understanding the structure of this manifold requires isolating principal components that explain maximum variance, then mapping these components to behavior-specific tuning.

## Preconditions

*   `numpy`, `scipy`, `scikit-learn`, `matplotlib`, `seaborn`

## Inputs and outputs

1. Neural calcium imaging matrix `Y` for animal `2022-04-12-04` (shape $N \times T$).
2. CePNEM behavioral tuning model outputs for `2022-04-12-04` (containing weights for forwardness, dorsalness, feedingness).

1. **Clustering Dendrogram:** Visualization of neuron grouping.
2. **Combined Heatmap:** A side-by-side visualization displaying sorted PC1–5 loadings and corresponding CePNEM behavioral weights.

## Procedure

1. **Standardization:** Neural activity is z-scored to ensure neurons with high firing rates do not disproportionately drive the PCA results.
2. **Dimensionality Reduction:** Principal Component Analysis (PCA) is performed to extract the top $K$ principal components.
3. **Clustering:** Hierarchical clustering (using Ward’s linkage) is applied to the neuron-by-PC loading matrix to identify functional groups.
4. **Behavioral Mapping:** Tuning coefficients from a probabilistic model (CePNEM) are assigned to each neuron to validate the functional identity of the clusters.

1. **Data Prep:** Z-score the neural matrix `Y` ($N \times T$).
2. **PCA:** Fit a `PCA(n_components=5)` object to the standardized neural matrix to extract loadings.
3. **Clustering:** Apply `linkage(loadings, method='ward')` to the $N \times 5$ matrix.
4. **Integration:** Join the CePNEM behavioral tuning weights to the clustered indices of the neuron matrix.
5. **Visualization:** Produce a dual-heatmap display representing PCA loadings on one side and behavioral weights on the other.

1. **Z-score:** Normalize the neural matrix across time: $Z = \frac{Y - \mu}{\sigma}$.
2. **Run PCA:** Use `sklearn.decomposition.PCA` to fit the $N \times T$ matrix and extract the loading vectors for the top 5 components.
3. **Cluster:** Perform hierarchical clustering on the loadings matrix ($N_{neurons} \times 5_{PCs}$) using `scipy.cluster.hierarchy.linkage` with `method='ward'`.
4. **Retrieve Order:** Extract the optimal leaf order from the linkage result using `leaves_list`.
5. **Align:** Sort the neurons in both the PC loading matrix and the CePNEM tuning coefficient matrix based on the hierarchical order.

## Expected results

The method's demonstrates that neurons cluster into functional ensembles that align with specific behavioral states. The heatmap should reveal strong coherence where groups of neurons with similar PC loadings also share high weights for specific behaviors like "forwardness" or "feedingness."

*   Verify that the input to PCA was standardized (z-scored).
*   Ensure that the clustering input is exactly the $N \times 5$ loading matrix.
*   Check that CePNEM values are weights from the probabilistic fit, not simple correlations.

## Pitfalls

*   **Provenance:** Ensure you use the specific behavioral weights from the CePNEM model. Do not substitute with raw correlation coefficients.
*   **Scaling:** PCA is sensitive to signal magnitude. Failure to z-score the input will result in a manifold driven by total firing rate rather than co-activation patterns.
*   **Alignment:** Ensure that neuron IDs used in the PCA step are identically mapped to the IDs in the CePNEM results file to avoid misaligned behavioral tuning labels.

## Bundled files

- [`scripts/run_analysis.py`](scripts/run_analysis.py): Run the primary analysis workflow.
- [`scripts/utils.py`](scripts/utils.py): Reusable analysis and plotting helpers.
- [`references/scientific_context.md`](references/scientific_context.md): Review methodological requirements, required data, and validation criteria.
- [`references/implementation_notes.md`](references/implementation_notes.md): Review execution details, expected artifacts, known gaps, and troubleshooting guidance.

## Usage

```bash
# Conceptual execution flow
python analyze_animal.py --animal 2022-04-12-04 --method PCA --components 5 --cluster ward
```
