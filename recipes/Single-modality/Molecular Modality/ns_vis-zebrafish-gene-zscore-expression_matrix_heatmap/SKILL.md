---
name: "ns_vis-zebrafish-gene-zscore-expression_matrix_heatmap"
description: "Render a grayscale heatmap of 290 genes across 65 zebrafish brain regions after within-region z-scoring. Use for regional expression-pattern visualization or for inspecting the expression matrix before structure-function comparisons; this recipe produces a figure and statistics but no NumPy artifact."
triggers:
- "Analyze z-scored gene × region expression heatmap"
- "Generate z-scored gene × region expression heatmap outputs"
- "Apply the ns_vis-zebrafish-gene-zscore-expression_matrix_heatmap recipe"
tags:
- "zebrafish"
- "gene"
- "zscore"
- "expression"
- "matrix"
version: "1.0"
---

# Z-scored gene × region expression heatmap

The only spatial-transcriptomics recipe in this set. It takes the 290-gene × 70-region
expression matrix, drops the five excluded regions, standardises each region's expression
profile across genes, and renders a wide grayscale heatmap.

## When to use this

Use this recipe to render a gene-by-region heatmap after per-gene z-scoring and region exclusion. Do not use it to compare absolute abundance between genes because standardization removes scale differences.

## Preconditions

- Install NumPy, SciPy, Matplotlib, and any additional packages imported by the selected script.
- Set `ZEBRAFISH_PATH`, `PROCESS_DATA_DIR`, `SAVE_DIR`, and `ATLAS_PATH` when they are referenced; do not rely on fallback paths.
- Provide the input artifacts listed below and validate their shapes, finite values, and shared region ordering before analysis.
- Use the bundled helper modules in `scripts/` when the implementation imports project-specific functions.

## Inputs and outputs

| Direction | File | Shape |
|---|---|---|
| in | `$ZEBRAFISH_PATH/Files/gene_expression.npy` | (290, 70) — genes × regions |
| in | `$PROCESS_DATA_DIR/Figure1_excluded_regions.npy` | (5,) int — `[10, 34, 44, 49, 69]` |
| out | `$SAVE_DIR/figure.png` / `figure_refine.png` | 300 dpi |
| out | `$SAVE_DIR/statistics.json` | |

No `.npy` is written. Full detail in `references/data_contract.md`.

## Procedure

1. Load `gene_expression.npy` from `$ZEBRAFISH_PATH/Files/`. Assert it is 2-D; unpack
   `n_genes, n_regions = shape` — genes are **rows**, regions are **columns**.
2. Load `Figure1_excluded_regions.npy` and `.astype(int)`. Assert every index is within
   `[0, n_regions)`; the mask was built for the 70-region atlas and must line up with the
   expression matrix's column ordering.
3. Build `keep_mask = np.ones(n_regions, bool)`, set `keep_mask[excluded_regions] = False`,
   and take `gene_expression[:, keep_mask]` → (290, 65). Only columns are dropped; all 290
   genes are kept.
4. Z-score with `zscore(filtered, axis=0, nan_policy='propagate')`. **`axis=0` standardises
   down the gene axis, so each region (column) independently gets mean 0 and sd 1 across the
   290 genes.** The purpose is to remove per-region differences in overall signal — total RNA
   capture, tissue volume, staining intensity — which otherwise make some regions uniformly
   dark and swamp the biology. After normalisation a value reads as "how far this gene sits
   from the typical gene *in this region*", i.e. relative specificity, not absolute abundance.
5. `np.nan_to_num(..., nan=0.0)` to neutralise columns whose standard deviation was zero
   (a constant region would give 0/0 → NaN).
6. Transpose for display: `.T` → (65 regions, 290 genes). Rows become regions so the panel
   reads left-to-right along the gene axis.
7. `imshow` with `aspect='auto'`, `cmap='gray_r'` (white → black), `vmin=-1`, `vmax=4`,
   `interpolation='nearest'`, figsize (18, 3). The asymmetric colour range is deliberate:
   within a region, expression across 290 genes is strongly right-skewed — most genes cluster
   just below the mean while a few markers spike far above — so z rarely drops below about -1
   but usefully reaches +4.
8. Vertical colorbar, `fraction=0.02`, `pad=0.02`, label `Expression (z-scored)` rotated 270°
   with `labelpad=15`.
9. Ticks at positions `[0, n-1]` on each axis, labelled `1` and `N` (290 for genes, 65 for
   regions). `tick_params(length=0)` removes the marks while keeping the end labels; the
   figure-oriented implementation adds `pad=5` and hides all four spines.

## Key parameters

| Parameter | Value | Why it matters |
|---|---|---|
| `zscore` axis | `0` | Standardises across genes within each region. Switching to `axis=1` would standardise each gene across regions — a completely different question ("where is this gene enriched?" instead of "which genes stand out here?") and a different picture. |
| `zscore` ddof | `0` (default) | Population sd over the 290 genes. |
| `nan_policy` | `'propagate'` | NaNs pass through and are zeroed afterwards rather than silently skipped. |
| `nan_to_num(nan=0.0)` | — | Only `nan` is remapped; `posinf`/`neginf` keep numpy's defaults (±1.8e308), which would wreck the colour scale if they ever appeared. |
| `vmin`, `vmax` | `-1`, `4` | Display clipping. Asymmetric on purpose (see step 7). Values above 4 all render pure black — marker peaks are saturated, not distinguished. |
| `cmap` | `'gray_r'` | White = low, black = high, as specified. |
| `aspect` | `'auto'` | Necessary: a 65×290 matrix in an 18×3 in figure has wildly non-square cells. |
| `interpolation` | `'nearest'` | Keeps cell boundaries crisp; smoothing would invent intermediate values across genes that have no ordering. |
| `figsize` | `(18, 3)` | Very wide — the gene axis carries 290 entries. |
| `dpi` | `300`, `bbox_inches='tight'` | |

## Expected results

- `n_genes` = **290**
- `n_regions_original` = **70**, `n_excluded_regions` = **5**, `n_regions_kept` = **65**
- `excluded_region_ids` = **[10, 34, 44, 49, 69]** — identical to the list every calcium recipe
  uses, which is the point of reading the shared mask
- `normalized_expression_mean` = **-1.696e-18**, `normalized_expression_std` = **1.0**
- `expression_mean_per_gene` — 290 raw per-gene means over the 65 kept regions, ranging from
  **0.3745** (gene index 113, i.e. gene 114 in 1-based figure numbering) to **22.398**
  (gene index 175 → gene 176), overall mean **5.460**
- `expression_std_per_gene` — 290 values, from **0.0959** to **23.410**

The stored conclusion: 290 genes across 65 regions show a heterogeneous molecular
architecture, with specific genes acting as regional markers reaching z ≈ 4, over a raw
abundance range spanning 0.37 to 22.40.

## Bundled files

- `scripts/reference_implementation.py` — executable implementation or helper module.
- `scripts/refine_implementation.py` — executable implementation or helper module.
- `scripts/zebrafish_Ca_stats_patch_xps.py` — executable implementation or helper module.
- `scripts/zebrafish_Ca_utils.py` — executable implementation or helper module.
- `scripts/zebrafish_Ca_utils_patch_xps.py` — executable implementation or helper module.
- `scripts/zebrafish_Ca_utils_predictors_xps.py` — executable implementation or helper module.
- `scripts/zebrafish_Ca_visualization_patch_xps.py` — executable implementation or helper module.
- `references/data_contract.md` — input, output, shape, and indexing contract.
- `references/method_details.md` — parameters, statistical details, and validation notes.

## Usage

```bash
python scripts/refine_implementation.py
```
