---
name: ns_multi-c_elegans-ca_behavior-umap-embedding_scatter_plot
description: This recipe analyzes neural population dynamics by mapping CePNEM-derived feeding tuning indices onto continuous UMAP manifold embeddings to reveal graded encoding patterns.
triggers:
  - How is feeding encoding organized in the UMAP space?
  - Visualize neural feeding tuning on UMAP manifolds
  - Identify graded transitions in feeding-activated and feeding-inhibited neurons
  - Perform dimensionality reduction on neural data to study feeding behavior
  - Calculate and project feeding tuning coefficients into a continuous latent space
tags:
  - UMAP
  - CePNEM
  - Neural Encoding
  - Latent Space Analysis
  - Computational Neuroscience
version: '1.0'
---

# Visualizing Neural Manifold Organization of Feeding Encoding

This recipe describes the process of characterizing how feeding-related information is distributed across a population of neurons by embedding neural activity into a continuous 2D latent space. By leveraging UMAP (Uniform Manifold Approximation and Projection) and integrating feeding-tuning coefficients derived from a Cell-type-specific Population Neural Encoding Model (CePNEM), researchers can visualize the transition from feeding-inhibited to feeding-activated states as a graded spatial feature.

Use `dplyr` operations to harmonize multi-animal neural datasets and join them with functional tuning metadata before mapping physiological properties onto the embedding.

## When to use this

- Embed pooled neural activity with UMAP and color neurons by CePNEM feeding-tuning coefficients.
- Test whether feeding activation varies continuously along a neural manifold across animals.
- Do not use this workflow for categorical cluster inference without validated tuning coefficients.

## Scientific context

Neural populations often exhibit low-dimensional structures where behavioral variables are encoded along continuous gradients. Feeding-related activity may form a graded transition correlated with the CePNEM-derived tuning index rather than discrete clusters.

## Preconditions

* **R (Data Manipulation)**: `dplyr` (for `bind_rows`, `mutate`, `filter`).
* **Visualization**: `ggplot2`.
* **Numerical/ML**: `uwot` or `umap-learn` (for manifold projection), `CePNEM` framework (for tuning calculation).

## Inputs and outputs

1. `neural_activity.csv`: $N \times T$ matrix of calcium traces for 14 animals.
2. `feeding_timestamps.csv`: Behavioral event logs aligned to neural frame rates.
3. `tuning_coefficients.csv`: Pre-calculated CePNEM indices mapping each `neuron_id` to its feeding tuning.

* A 2D scatter plot (PNG/PDF) showing the neural manifold.
* A CSV summary containing the UMAP coordinates, feeding-tuning index, and animal ID for each neuron.

## Procedure

1. **Data Integration**: Neural activity matrices for all 14 animals are concatenated to ensure a unified state space.
2. **Encoding Model (CePNEM)**: A GLM-based framework computes a feeding-tuning index for every neuron based on its responsiveness to feeding event timestamps.
3. **Dimensionality Reduction**: A UMAP projection is calculated from the concatenated activity matrix to transform high-dimensional neural activity into 2D coordinates.
4. **Mapping**: The calculated tuning indices are assigned to neurons in the latent space to reveal the functional gradient.

1. **Aggregate Data**: Concatenate individual animal neural activity matrices into a master dataframe using `dplyr::bind_rows()`.
2. **Calculate Tuning**: Execute external CePNEM logic to compute a `tuning_index` vector for each neuron.
3. **Embed**: Use the `uwot` or `umap-learn` package to generate `UMAP_1` and `UMAP_2` columns from the concatenated activity data.
4. **Join & Filter**: Use `dplyr::mutate()` to append the `tuning_index` to the UMAP coordinate dataframe and `dplyr::filter()` to identify high-confidence feeding-activated/inhibited subsets for statistical verification.
5. **Visualize**: Pass the joined dataframe to `ggplot2` to render the scatter plot with a continuous color gradient.

1. Load neural activity from all 14 files and use `bind_rows()` to create a singular `neuron_pool`.
2. Compute the UMAP embedding on the `neuron_pool` activity columns.
3. Perform a `left_join()` between the UMAP coordinate dataframe and the `tuning_coefficients` dataframe using the unique `neuron_id` as the key.
4. Add a categorical label column using `mutate()` (e.g., `is_activated = if_else(tuning_index > threshold, "activated", "inhibited")`).
5. Plot the result using `geom_point(aes(x = UMAP_1, y = UMAP_2, color = tuning_index))`.

## Expected results

The UMAP projection should display a continuous color gradient along a principal axis, representing the transition from neurons inhibited by feeding to those activated by feeding.

* The UMAP axis must capture the gradient of the `tuning_index`.
* The distribution of `tuning_index` values must be continuous across the UMAP axis rather than demonstrating disjointed clusters.

## Pitfalls

* **Manifold Artifacts**: Adjust `n_neighbors` during UMAP calculation; values too low may result in artificial local clustering rather than the intended global gradient.
* **Batch Effects**: If the visualization shows 14 distinct blobs, the UMAP is likely embedding animal-specific batch effects. Ensure neural activity is Z-scored across the population before performing dimensionality reduction.

## Bundled files

- [`scripts/run_analysis.py`](scripts/run_analysis.py): Run the primary analysis workflow.
- [`scripts/utils.py`](scripts/utils.py): Reusable analysis and plotting helpers.
- [`references/scientific_context.md`](references/scientific_context.md): Review methodological requirements, required data, and validation criteria.
- [`references/implementation_notes.md`](references/implementation_notes.md): Review execution details, expected artifacts, known gaps, and troubleshooting guidance.

## Usage

```r
# Concatenate and join data for UMAP analysis
unified_data <- bind_rows(animal_list) %>%
  left_join(tuning_data, by = "neuron_id") %>%
  mutate(feeding_state = if_else(tuning_index > 0, "activated", "inhibited"))

# Generate plot
ggplot(unified_data, aes(x = UMAP_1, y = UMAP_2, color = tuning_index)) +
  geom_point(alpha = 0.5) +
  scale_color_gradient2(low = "blue", mid = "grey", high = "red")
```
