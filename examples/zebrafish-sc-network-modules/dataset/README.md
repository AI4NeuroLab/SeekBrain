# Focused zebrafish structural-connectivity dataset

This directory is the complete input dataset for the bundled SeekBrain
hierarchical-consensus module case. It is a focused subset of the processed data
released with Légaré et al., *Structural and genetic determinants of zebrafish
functional brain networks* (*Science Advances*, 2025).

## Files

- `Files/SC_matrix_directed_terminals_expanded.npy` — directed, expanded
  structural-connectivity matrix; NumPy `float64`, shape `(70, 70)`, values in
  `[0, 1]`.
- `excluded_regions.npy` — zero-based atlas-region indices removed from both
  matrix axes before analysis; NumPy `int64`, shape `(5,)`, values
  `[10, 34, 44, 49, 69]`.

After exclusion, the analysis operates on a `(65, 65)` matrix. No calcium
timeseries, atlas volumes, gene-expression arrays, or subject-level files are
required for this case.

## Provenance

- Dataset: https://doi.org/10.5683/SP3/IIVGOB
- Associated code: https://github.com/pdesrosiers/Legare-zebrafish-brain-networks
- License: CC BY 4.0; see `LICENSE_DATA.md`.

The two NumPy files were copied unchanged from the processed source dataset.

## Checksums

```text
3a36bbeaa7ffab158eaacd1e4bc520b91644abca276c95d2e1fe1abf42269a97  Files/SC_matrix_directed_terminals_expanded.npy
e28027b2ef7b8b11cafa29cea10c520bcdda3d8a8356499ac010e35c97d9b37d  excluded_regions.npy
```
