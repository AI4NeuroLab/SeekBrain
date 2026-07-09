---
name: "Analyze Neural Dynamics via PCA and CePNEM Behavioral Tuning"
description: "Performs dimensionality reduction on neural activity using PCA and clusters neurons by loading profiles to visualize relationships with CePNEM behavioral tuning weights."
triggers:
  - "run PCA on animal 2022-04-12-04 neural data"
  - "visualize neuron clusters ordered by PC loadings"
  - "map CePNEM behavioral tuning to PCA clusters"
  - "generate neural population heatmap with forwardness and dorsalness scores"
  - "perform hierarchical clustering of neural PC loading profiles"
tags:
  - "CePNEM"
  - "PCA"
  - "neuroscience"
  - "hierarchical-clustering"
  - "C-elegans"
  - "calcium-imaging"
version: "1.0"
---

# Skill: Neural Dynamics and Behavioral Tuning Analysis for C. elegans (Animal 2022-04-12-04)

## Overview
This skill provides a structured approach to characterizing the neural population dynamics of the example animal `2022-04-12-04`. The analysis involves computing the dimensionality reduction of neural activity via Principal Component Analysis (PCA) and aligning these dynamics with latent behavioral tuning coefficients inferred from the *C. elegans* Probabilistic Neural Embedding Model (CePNEM).

The core of this approach lies in using hierarchical clustering to order neurons based on their functional similarity in the top-5 PC space, ensuring that neurons with shared behavioral tuning profiles—such as forwardness, dorsalness, and feedingness—are visually grouped together. This method allows researchers to interpret high-dimensional calcium imaging data within the context of specific, pre-computed behavioral latent states.

## Objective
To visualize the relationship between neural population dynamics and behavioral latent states by ordering neurons via hierarchical clustering of top-5 PC loadings and mapping them to their corresponding CePNEM tuning coefficients.

## Background (from Paper)
### Scientific Context
The neural dynamics of *C. elegans* are highly structured and low-dimensional. Dimensionality reduction techniques like PCA are utilized to capture the dominant patterns of population-wide activity. By relating these patterns to behavioral tuning coefficients derived from the CePNEM model, one can differentiate between neurons driven by locomotion (forwardness/dorsalness) versus autonomic functions (feedingness/pharyngeal pumping).

### Methods Description
1.  **Z-scoring:** Standardize raw calcium fluorescence ($\Delta F/F$) for every neuron individually to ensure equal weight during PCA.
2.  **PCA Computation:** Perform PCA on the $T \times N$ z-scored neural matrix to identify the component loading matrix $V \in \mathbb{R}^{N \times 5}$.
3.  **Hierarchical Clustering:** Execute linkage-based clustering on the top-5 loading vectors per neuron.
4.  **CePNEM Attribution:** Map behavioral weights ($\beta$) from the pre-computed model output directly to the clustered neural indices.

### Expected Results
The visualization produces a sorted heatmap where the left panel displays PC loadings and the right panel displays behavioral tuning bars. Neurons sharing similar behavioral sensitivities are clustered spatially, revealing the functional architecture of the neural circuit.

## Implementation Guidance
### Verified Repository Components
- `analysis/plot_neuron_dynamics.py`: Main visualization script.
- `src/dimensionality_reduction.py`: Contains PCA and hierarchical clustering routines.
- `src/cepnem_utils.py`: Contains extractors for behavioral weights ($\beta$ coefficients).

### Conceptual Implementation Plan
The plan involves a pipeline that extracts neural traces and model weights, standardizes the traces, extracts the components, clusters the neurons based on the loading matrix, and maps the CePNEM weights to the sorted order. *Assumption: The number of neurons in the trace data and the model result file are identical, or a mapping index is available.*

### Dependencies
- `numpy`, `scipy`, `scikit-learn` (for PCA and clustering), `matplotlib` (for visualization).

## Structured Prompt
### Input Specification
1. `data/processed/neurons_2022-04-12-04.mat`: Neural fluorescence traces.
2. `data/models/cepnem_results_2022-04-12-04.pkl`: Dictionary containing `beta_forward`, `beta_dorsal`, `beta_feeding`.

### Processing Steps
1. **Z-score:** Calculate `z_scored = (X - X.mean(axis=0)) / X.std(axis=0)`.
2. **PCA:** Run `PCA(n_components=5)` on the z-scored matrix to obtain `loadings = pca.components_.T`.
3. **Clustering:** Run `linkage(loadings, method='ward', metric='euclidean')` and extract `neuron_order = leaves_list(linkage_matrix)`.
4. **Permutation:** Reorder `loadings` and `CePNEM_weights` according to `neuron_order`.
5. **Visualization:** Plot the heatmap of `sorted_loadings` alongside the bar chart of `sorted_CePNEM_weights` using the shared `neuron_order` y-axis.

### Output Specification
- A figure displaying two side-by-side plots: a heatmap of PC1–PC5 loadings and a heatmap/bar-chart of CePNEM weights, with all neurons ordered by their hierarchical dendrogram.

### Validation Criteria
- Confirm the clustering order is identical for both the PCA-based ordering and the behavioral tuning bar plot.
- Ensure behavioral coefficients are extracted from the CePNEM weight matrix ($W$) rather than by simple correlation calculations.

## File Structure

```
For_the_example_animal__2022-04-12-04___run_PCA_on_the_z-sco__MouseLand_astermap/
    references/
        matched_files/
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
- `run_visualization_pipeline.sh`: Triggers the processing of animal-specific data; call this with the target ID.

## References Documentation
- `data/processed/neurons_2022-04-12-04.mat`: Stores time-series data for analysis.
- `data/models/cepnem_results_2022-04-12-04.pkl`: Contains the trained behavioral weights for mapping.

## Usage Example
```bash
python analysis/plot_neuron_dynamics.py --animal_id 2022-04-12-04
```

## Notes & Caveats
- Ensure that the `method` parameter in `scipy.cluster.hierarchy.linkage` is set to 'ward' (as per paper standard) to prevent visual discrepancies.
- If behavioral bars appear inversely correlated with neural activity, check the sign convention of the CePNEM model weights.
- Filter out non-responsive neurons only if they were excluded in the original published experiment to avoid index mismatching.