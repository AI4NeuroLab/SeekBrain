---
name: "ns_multi-zebrafish-sc_fc_matrix-degree_correlation_polyfit-scatter_plot"
description: "Quantify how well structural node degree predicts functional node degree in the zebrafish brain — weighted row sums of the undirected structural connectome versus weighted row sums of the group-average FC matrix, tested with Pearson correlation and a least-squares line, plotted as a scatter with a best-fit line and the r value in the corner. Reach for this whenever the question is 'does physical connectivity predict correlated activity', 'are structural hubs also functional hubs', 'correlate SC degree with FC degree', 'how much FC variance does structural degree explain', 'regress functional degree on structural degree', 'degree-degree scatter', or 'SC-FC hub correspondence'. It writes Figure2_Node_degree_SC.npy and Figure2_Node_degree_FC.npy and reports r = 0.694, p = 1.46e-10, slope 0.605, R² = 0.482 across 65 regions. If the deliverable is an anatomical atlas map of those degrees rather than a scatter, use ns_vis-zebrafish-sc_ca-node_degree-degree_atlas_map — it writes the"
triggers:
- "Analyze structural degree vs functional degree — correlation and linear fit"
- "Generate structural degree vs functional degree — correlation and linear fit outputs"
- "Apply the ns_multi-zebrafish-sc_fc_matrix-degree_correlation_polyfit-scatter_plot recipe"
tags:
- "zebrafish"
- "sc"
- "fc"
- "matrix"
- "degree"
version: "1.0"
---

# Structural degree vs functional degree — correlation and linear fit

Reduces both connectomes to one number per region (weighted degree), then asks how tightly the
two track each other.

## When to use this

Use this recipe to compare structural and functional node degree across matched brain regions with a correlation and linear fit. Do not interpret the result if the two degree vectors were produced with different masks, matrix conventions, or region orders.

## Preconditions

- Env vars `PROCESS_DATA_DIR`, `SAVE_DIR`, and `ZEBRAFISH_PATH`. **`ZEBRAFISH_PATH` must be set
  explicitly**: the script falls back to a hard-coded path under the dead
  `<data-root>` mount, so leaving it unset produces a `FileNotFoundError`
  pointing at a directory that no longer exists rather than a useful message.
- `$ZEBRAFISH_PATH/Files/SC_matrix_undirected_terminals_expanded.npy`, the **undirected**
  connectome.
- `Figure1_FC_matrix.npy` in `PROCESS_DATA_DIR` — the group average, from
  `ns_ana-zebrafish-ca-pearson-fc_matrix`.
- `Figure1_excluded_regions.npy` in `PROCESS_DATA_DIR`, from
  `ns_pre-zebrafish-ca_atlas-region_census-exclusion_mask`.
- **No custom library is needed, and this recipe carries none.** Its `scripts/` directory holds
  the two implementations and nothing else — zero vendored modules, because the script extends
  `sys.path` but imports nothing from the library. See Pitfalls. `ATLAS_PATH` is not read; no
  atlas geometry is involved. This is a genuinely dependency-light script.

## Inputs and outputs

| Direction | File | Shape |
|---|---|---|
| in | `$ZEBRAFISH_PATH/Files/SC_matrix_undirected_terminals_expanded.npy` | (70, 70) |
| in | `$PROCESS_DATA_DIR/Figure1_FC_matrix.npy` | (65, 65) |
| in | `$PROCESS_DATA_DIR/Figure1_excluded_regions.npy` | (5,) int |
| out | `$PROCESS_DATA_DIR/Figure2_Node_degree_SC.npy` | (65,) float |
| out | `$PROCESS_DATA_DIR/Figure2_Node_degree_FC.npy` | (65,) float |
| out | `$SAVE_DIR/figure.png` (or `figure_refine.png`), `$SAVE_DIR/statistics.json` | |

Full detail in `references/data_contract.md`.

## Procedure

1. Load the undirected SC (70×70), the group-average FC (65×65), and the exclusion list. All
   three loads are guarded by an `os.path.exists` check that raises a readable
   `FileNotFoundError` — worth keeping when adapting.
2. Build a keep-mask over the 70 SC regions and apply it to both SC axes → 65×65. Apply the same
   mask to FC **only if** FC is still 70-wide. In this dataset it arrives at 65, so the branch
   is skipped; re-masking a 65-wide matrix would drop five wrong regions.
3. Assert SC and FC now have the same shape. That assert is the only guard against a stale or
   mismatched exclusion list producing a silently misaligned regression.
4. Zero both diagonals with `np.fill_diagonal`. FC's unit diagonal would add a constant 1 to
   every region's degree; SC's is already zero but zeroing it costs nothing and removes the
   assumption.
5. SC degree = `np.sum(sc_filtered, axis=1)`. Save as `Figure2_Node_degree_SC.npy`.
6. FC degree: `np.nan_to_num` the matrix, then rectify with `np.maximum(fc, 0.0)` and row-sum.
   **Positive part only** — negative correlations are discarded rather than counted as coupling.
   Save as `Figure2_Node_degree_FC.npy`.
7. `pearsonr(sc_degree, fc_degree)` → r and p. `linregress(sc_degree, fc_degree)` → slope,
   intercept, and `rvalue**2` as R². Note that `linregress` regresses FC **on** SC, so the fitted
   slope is not symmetric in the two variables; swapping the arguments gives a different line.
8. Scatter the 65 points black, `s=20`, overlay the fit line in `mediumvioletred` over 200
   x-samples spanning the observed SC-degree range, hide the top and right spines, label the axes
   `Structural degree` / `Functional degree`, and print `r = 0.694` in the upper-left in axes
   coordinates.

## Key parameters

| Parameter | Value | Why it matters |
|---|---|---|
| SC variant | undirected, terminals expanded | Row sums of the directed matrix would be out-degrees only. |
| SC degree | `sum(SC, axis=1)` after zeroing the diagonal | Symmetric matrix, so row and column sums agree. |
| FC degree | `sum(max(FC, 0), axis=1)` after zeroing the diagonal | **Rectified**, not absolute. The sibling atlas-map recipe uses `abs` — the one real numerical difference between them. |
| NaN policy | `nan_to_num(..., nan=0, posinf=0, neginf=0)` | Recorded as 0 NaNs for the recorded dataset, so it is inert here. |
| regression | `scipy.stats.linregress(x=sc, y=fc)` | Ordinary least squares, FC on SC. Asymmetric — do not read the slope as a symmetric coupling coefficient. |
| scatter `s`, colour | 20, black | `alpha=0.6` in the reference implementation, removed in the figure-oriented implementation. |
| fit line | `mediumvioletred`, `linewidth=2.5`, 200 x-samples | |
| `figsize`, `dpi` | `(5, 4)`, `300` | |
| r annotation | axes coords `(0.05, 0.95)`, fontsize 11 (reference implementation, boxed) / 12 (figure-oriented implementation, unboxed) | |

## Expected results

- 65 regions, 5 excluded
- Pearson **r = 0.6940**, **p = 1.456e-10**
- Least-squares fit: **slope = 0.6054**, **intercept = 8.0080**, **R² = 0.4816**

Additional numbers the reference implementation computes but the figure-oriented implementation overwrote:

- SC degree range **[4.069, 45.101]**
- FC degree range **[8.704, 36.202]**
- FC NaN count in the input matrix: 0

Headline claim: structural degree explains about 48% of the variance in functional degree —
densely wired regions are also functional hubs.

## Pitfalls

- Rectifying FC with `np.maximum(fc, 0)` discards anticorrelations and changes the meaning of
  functional degree; state this modelling choice explicitly.
- This recipe and the atlas-map recipe can write the same degree filenames using different FC
  formulas. Write distinct filenames or record which formula produced each artifact.
- R² is an in-sample association across 65 spatially dependent regions, not cross-validated
  prediction accuracy.

## Bundled files

- `scripts/reference_implementation.py` — executable implementation or helper module.
- `scripts/refine_implementation.py` — executable implementation or helper module.
- `references/data_contract.md` — input, output, shape, and indexing contract.
- `references/method_details.md` — parameters, statistical details, and validation notes.

## Usage

```bash
python scripts/refine_implementation.py
```
