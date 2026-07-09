---
name: "Analyze Neural Population Dynamics via PCA, Clustering, and CePNEM Tuning"
description: "Performs PCA on z-scored neural activity, clusters neurons by PC loadings, and aligns results with CePNEM behavioral tuning for a specified experimental animal."
triggers:
  - "run PCA and cluster neurons for animal 2022-04-12-04"
  - "generate a heatmap of PC loadings and CePNEM behavioral tuning"
  - "hierarchically cluster neural data using top 5 PCA components"
  - "analyze neural population dynamics using CePNEM model outputs"
  - "visualize behavioral tuning and PCA loading similarity for a specific session"
tags:
  - "PCA"
  - "CePNEM"
  - "hierarchical-clustering"
  - "neural-encoding"
  - "dimensionality-reduction"
  - "calcium-imaging"
version: "1.0"
---

# Skill: Dimensionality Reduction and Behavioral Tuning Profiling for Neural Populations

## Overview
This skill describes the workflow for identifying functional neural manifolds in the example animal `2022-04-12-04`. The analysis requires reducing the dimensionality of neural activity to capture latent population dynamics and correlating these latent representations with behavioral state preferences. By combining standard PCA with hierarchical clustering of loading vectors, we can group neurons into functional ensembles and characterize them via CePNEM behavioral tuning parameters.

The integration of CePNEM model outputs allows for a robust interpretation of the manifold, moving beyond simple neural-behavior correlations. This workflow uses `scikit-learn` for PCA, `scipy` for clustering, and requires access to pre-calculated CePNEM model files.

## Objective
To decompose neural activity of animal `2022-04-12-04` using PCA, cluster neurons by their functional loadings on the top 5 PCs, and visualize the congruence between these structural clusters and behavioral tuning weights (forwardness, dorsalness, feedingness) derived from the CePNEM model.

## Background (from Paper)
### Scientific Context
Neural population dynamics often reside on low-dimensional manifolds. Understanding the structure of this manifold requires isolating principal components that explain maximum variance, then mapping these components to behavior-specific tuning.

### Methods Description
1. **Standardization:** Neural activity is z-scored to ensure neurons with high firing rates do not disproportionately drive the PCA results.
2. **Dimensionality Reduction:** Principal Component Analysis (PCA) is performed to extract the top $K$ principal components.
3. **Clustering:** Hierarchical clustering (using Ward’s linkage) is applied to the neuron-by-PC loading matrix to identify functional groups.
4. **Behavioral Mapping:** Tuning coefficients from a probabilistic model (CePNEM) are assigned to each neuron to validate the functional identity of the clusters.

### Expected Results
The paper demonstrates that neurons cluster into functional ensembles that align with specific behavioral states. The heatmap should reveal strong coherence where groups of neurons with similar PC loadings also share high weights for specific behaviors like "forwardness" or "feedingness."

## Implementation Guidance
### Verified Repository Components
No verified repository implementation was available in the provided context for the specific CePNEM behavioral tuning integration or the `2022-04-12-04` dataset. The logic relies on `sklearn.decomposition.PCA` and `scipy.cluster.hierarchy`.

### Conceptual Implementation Plan
1. **Data Prep:** Z-score the neural matrix `Y` ($N \times T$).
2. **PCA:** Fit a `PCA(n_components=5)` object to the standardized neural matrix to extract loadings.
3. **Clustering:** Apply `linkage(loadings, method='ward')` to the $N \times 5$ matrix.
4. **Integration:** Join the CePNEM behavioral tuning weights to the clustered indices of the neuron matrix.
5. **Visualization:** Produce a dual-heatmap display representing PCA loadings on one side and behavioral weights on the other.

### Dependencies
*   `numpy`, `scipy`, `scikit-learn`, `matplotlib`, `seaborn`

## Structured Prompt
### Input Specification
1. Neural calcium imaging matrix `Y` for animal `2022-04-12-04` (shape $N \times T$).
2. CePNEM behavioral tuning model outputs for `2022-04-12-04` (containing weights for forwardness, dorsalness, feedingness).

### Processing Steps
1. **Z-score:** Normalize the neural matrix across time: $Z = \frac{Y - \mu}{\sigma}$.
2. **Run PCA:** Use `sklearn.decomposition.PCA` to fit the $N \times T$ matrix and extract the loading vectors for the top 5 components.
3. **Cluster:** Perform hierarchical clustering on the loadings matrix ($N_{neurons} \times 5_{PCs}$) using `scipy.cluster.hierarchy.linkage` with `method='ward'`.
4. **Retrieve Order:** Extract the optimal leaf order from the linkage result using `leaves_list`.
5. **Align:** Sort the neurons in both the PC loading matrix and the CePNEM tuning coefficient matrix based on the hierarchical order.

### Output Specification
1. **Clustering Dendrogram:** Visualization of neuron grouping.
2. **Combined Heatmap:** A side-by-side visualization displaying sorted PC1–5 loadings and corresponding CePNEM behavioral weights.

### Validation Criteria
*   Verify that the input to PCA was standardized (z-scored).
*   Ensure that the clustering input is exactly the $N \times 5$ loading matrix.
*   Check that CePNEM values are weights from the probabilistic fit, not simple correlations.

## File Structure

```
For_the_example_animal__2022-04-12-04___run_PCA_on_the_z-sco__machenslab_dPCA/
    references/
        matched_files/
            .github_workflows_uploadpypy.yml
            .travis.yml
            License.md
            README.md
            python_dPCA_dPCA.py
            python_dPCA_demo.ipynb
            python_dPCA_utils.py
            python_pyproject.toml
            python_requirements.txt
            python_setup.py
        connection_analysis.md
        paper_context.md
        paper_figure_methods.md
        paper_structured_summary.md
        question.md
        repo_context.md
        repo_file_summaries.md
        repo_overview.md
        reproduction_plan.md
    scripts/
        run_analysis.py
        utils.py
```

## Scripts Documentation
*   `python/dPCA/dPCA.py`: Reference implementation for handling tensor-based neural data; can be adapted for general PCA logic.
*   `python/dPCA_demo.ipynb`: Template for ingestion and plotting; useful for formatting the final heatmap.

## References Documentation
*   `CePNEM_Model_Outputs.pkl/mat`: The source of behavioral tuning coefficients for animal `2022-04-12-04`.

## Usage Example
```bash
# Conceptual execution flow
python analyze_animal.py --animal 2022-04-12-04 --method PCA --components 5 --cluster ward
```

## Notes & Caveats
*   **Provenance:** Ensure you use the specific behavioral weights from the CePNEM model. Do not substitute with raw correlation coefficients.
*   **Scaling:** PCA is sensitive to signal magnitude. Failure to z-score the input will result in a manifold driven by total firing rate rather than co-activation patterns.
*   **Alignment:** Ensure that neuron IDs used in the PCA step are identically mapped to the IDs in the CePNEM results file to avoid misaligned behavioral tuning labels.