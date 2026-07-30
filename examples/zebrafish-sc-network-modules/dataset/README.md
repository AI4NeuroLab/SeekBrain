# Focused zebrafish structural-connectivity dataset

This directory is the complete input dataset for two bundled SeekBrain cases:
hierarchical-consensus module detection and anatomical SC-network visualization.
It is a focused subset of the processed data released with Légaré et al.,
*Structural and genetic determinants of zebrafish functional brain networks*
(*Science Advances*, 2025).

## Files

- `Files/SC_matrix_directed_terminals_expanded.npy` — directed, expanded
  structural-connectivity matrix; NumPy `float64`, shape `(70, 70)`, values in
  `[0, 1]`.
- `Files/SC_matrix_undirected_terminals_expanded.npy` — unilateral undirected
  structural-connectivity matrix; NumPy `float64`, shape `(70, 70)`.
- `excluded_regions.npy` — zero-based atlas-region indices removed from both
  matrix axes before analysis; NumPy `int64`, shape `(5,)`, values
  `[10, 34, 44, 49, 69]`.
- `Atlas/centroids.pkl` — dictionary containing `left` and `right` regional
  centroid arrays, each with shape `(70, 3)`.
- `Atlas/XY_H2BGCaMP6s.tif` — dorsal atlas projection, grayscale, `597 × 974`
  pixels.
- `Atlas/XZ_H2BGCaMP6s.tif` — sagittal atlas projection, grayscale, `974 × 359`
  pixels.

After exclusion, both analyses operate on 65 retained unilateral regions. No
calcium timeseries, three-dimensional atlas masks, gene-expression arrays, or
subject-level files are required for either case.

## Provenance

- Dataset: https://doi.org/10.5683/SP3/IIVGOB
- Associated code: https://github.com/pdesrosiers/Legare-zebrafish-brain-networks
- License: CC BY 4.0; see `LICENSE_DATA.md`.

All data files were copied unchanged from the processed source dataset.

## Checksums

```text
3a36bbeaa7ffab158eaacd1e4bc520b91644abca276c95d2e1fe1abf42269a97  Files/SC_matrix_directed_terminals_expanded.npy
7399855262f4f59b24a79e1f8b1c6ec8a4174d98529ee0a47b9e180f4073470f  Files/SC_matrix_undirected_terminals_expanded.npy
e28027b2ef7b8b11cafa29cea10c520bcdda3d8a8356499ac010e35c97d9b37d  excluded_regions.npy
8b96b865122f98381941dabbfc5393e3ed4c8f716bb93a204968bb89a1026bdc  Atlas/centroids.pkl
7f33ac955e1334b5664bf9db0449f6b7cf53e3eb1a03cbf918a0cd2b0efe7ab6  Atlas/XY_H2BGCaMP6s.tif
6fd2e9aedfdf266eb63134bee2ccccdcc15299861e13e05e74de8e1a7f355a9d  Atlas/XZ_H2BGCaMP6s.tif
```
