---
name: "ns_multi-zebrafish-gene_anatomy-expression_count_mapping-spatial_density"
description: "Map eomesa- and pvalb7-positive cells into a common zebrafish atlas from registered EASI-FISH volumes and cell-wise spot counts. Use for whole-brain expression density and co-expression maps."
triggers:
- "Analyze whole-brain spatial mapping of molecularly defined neuronal populations"
- "Generate whole-brain spatial mapping of molecularly defined neuronal populations outputs"
- "Apply the ns_multi-zebrafish-gene_anatomy-expression_count_mapping-spatial_density recipe"
tags:
- "easi-fish"
- "mapzebrain"
- "spatial-transcriptomics"
- "zebrafish-brain-atlas"
- "3d-visualization"
version: "1.0"
---

# Whole-Brain Spatial Mapping of Molecularly Defined Neuronal Populations

This recipe focuses on the 3D spatial quantification and visualization of *eomesa* and *pvalb7* expressing neurons across the zebrafish brain. By integrating EASI-FISH transcriptomic spot data with the MapZebrain Common Coordinate Framework (CCF), researchers can map specific neuronal populations to anatomical structures such as the dorsal pallium and cerebellum.

The workflow bridges molecular transcript counts with atlas-based spatial registration. It employs a pipeline that manages image-to-atlas deformable registration, identifies cell-wise gene expression, and facilitates the intersection of specific gene markers to identify co-expressing populations.

To generate three 3D whole-brain visualizations depicting the spatial distribution of *eomesa*-positive, *pvalb7*-positive, and *eomesa-pvalb7* co-expressing cells, contextualized within the MapZebrain atlas.

## When to use this

Use this recipe to register EASI-FISH brains, assign RNA spots to cells, call eomesa- and pvalb7-positive populations consistently, and map their spatial densities. Do not use the example spot-count threshold without validating it against the current signal and background distributions.

## Scientific context

The zebrafish brain displays complex spatial organization of inhibitory and excitatory populations. *eomesa* (Tbr1-homolog) serves as a key marker for specific pallial neuronal populations, while *pvalb7* is frequently utilized to identify distinct inhibitory cell types. Mapping these markers reveals the spatial architecture of deep-layer and cerebellar-related circuit components.

## Preconditions

* Nextflow, Singularity/Docker, Python 3.8+
* `bigstream` (for registration)
* `napari` or `vtk` (for visualization)
* `pandas`, `numpy` (for dataframe processing)

## Inputs and outputs

1. Raw EASI-FISH volumes for *eomesa* and *pvalb7* (three fish replicates).
2. MapZebrain atlas files (`.nrrd` or `.vtk`).
3. Registered segmentation masks (output of `main.nf`).

* `counts.csv`: Per-cell gene expression table for each fish.
* `filtered_populations.csv`: Coordinate files for the three subsets.
* 3D Visualizations: Point-cloud renders (one per subset) aligned to MapZebrain regions.

## Procedure

1. **Imaging & Registration:** EASI-FISH volumes are registered to the MapZebrain CCF using deformable transformation matrices to achieve inter-animal alignment.
2. **Segmentation:** Nuclei are segmented to create a coordinate-based mask of discrete cells.
3. **Spot Assignment:** RNA spots are assigned to nuclei centroids based on spatial proximity, generating a cell-by-gene expression count matrix.
4. **Classification:** A thresholding function is applied to identify "positive" cells (e.g., $N > 3$ spots/cell).
5. **Spatial Visualization:** Filtered cell populations are plotted in 3D using the common CCF coordinate space.

The plan involves executing the provided Nextflow pipeline to achieve registration and segmentation. Post-pipeline, you must implement a custom thresholding and intersection script that reads `count.csv` outputs, performs boolean masking, and renders the result as a point cloud using `napari` or a similar library.
*Assumption: You have the pre-registered N5/Zarr volumes for the three biological replicates.*

1. **Register Volumes:** Run `main.nf` with `demo_medium.json` to compute transformation matrices and map all fish to the MapZebrain CCF.
2. **Assign Spots:** Execute `assign_spots.py` to count spots per cell.
3. **Threshold:** Apply the threshold filter (e.g., $Count \ge 3$) to generate binary matrices for *eomesa* and *pvalb7*.
4. **Boolean Intersection:** Identify *eomesa-pvalb7* co-expressing cells using the intersection of the two filtered CSV files.
5. **Render:** Load population centroids into `napari`, using the atlas `.nrrd` volume to overlay the dorsal pallium and cerebellum boundaries.

## Expected results

The analysis yields specific spatial density maps. Researchers expect to see *eomesa* populations enriched in the dorsal pallium and *pvalb7* populations showing distinct patterns in the cerebellum, with a quantifiable co-expressing subset located at the intersection of these molecular domains.

* Consistency: The total number of cells for a given gene should not deviate significantly across replicates after normalization.
* Alignment: The anatomical markers (dorsal pallium/cerebellum) must align perfectly across all three fish when rendered in CCF space.

## Pitfalls

* **Memory Management:** Whole-brain EASI-FISH processing is memory-intensive; ensure `nextflow` is configured to utilize high-memory nodes.
* **Thresholding:** The value of "3 spots" is an empirical suggestion; inspect the signal-to-noise distribution in your data to set an objective threshold.
* **Registration Jitter:** If anatomical alignment is poor, re-examine the `bigstream` registration parameters in `maru.yaml`.

## Bundled files

- `scripts/run_analysis.py` — executable implementation or helper module.
- `scripts/utils.py` — executable implementation or helper module.
- `references/implementation_notes.md` — implementation requirements and validation checks.
- `references/matched_files/containers_registration_maru.yaml` — supporting resource referenced by this recipe.
- `references/matched_files/containers_rs_fish_maru.yaml` — supporting resource referenced by this recipe.
- `references/matched_files/containers_segmentation_scripts_python_starfinity_prediction.py` — executable implementation or helper module.
- `references/matched_files/containers_spot_assignment_scripts_python_assign_spots.py` — executable implementation or helper module.
- `references/matched_files/examples_demo_medium.sh` — supporting resource referenced by this recipe.
- `references/scientific_context.md` — scientific rationale and interpretation.

## Usage

```bash
python scripts/run_analysis.py
```
