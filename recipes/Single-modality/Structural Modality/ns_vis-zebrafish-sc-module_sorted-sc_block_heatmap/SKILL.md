---
name: "ns_vis-zebrafish-sc-module_sorted-sc_block_heatmap"
description: "Render the undirected zebrafish structural connectome as a module-sorted block-diagonal heatmap — reorder the 65×65 SC matrix by the four consensus-Louvain module labels, square it element-wise to boost contrast, and draw thick black boxes around each module along the diagonal. Reach for this whenever someone asks to 'show the modules on the SC matrix', 'visualize the community structure of the structural connectome', 'block-diagonal connectivity matrix', 'sorted adjacency matrix with community boxes', 'are connections stronger within modules than between them', or wants the Figure 3B-style SC² heatmap with module outlines. It is the visual companion to the module partition: it consumes Figure3_coassignment_matrix_SC_4module_ordered.npy and the raw undirected SC matrix, writes no .npy artifact, and exists purely to produce the figure and its descriptive statistics."
triggers:
- "Analyze module-sorted structural connectivity block heatmap"
- "Generate module-sorted structural connectivity block heatmap outputs"
- "Apply the ns_vis-zebrafish-sc-module_sorted-sc_block_heatmap recipe"
tags:
- "zebrafish"
- "sc"
- "module"
- "sorted"
- "block"
version: "1.0"
---

# Module-sorted structural connectivity block heatmap

Sorts the undirected structural connectome by its four-module partition and renders it as a
squared-weight heatmap with the module blocks outlined in black.

## When to use this

Use this recipe to inspect whether a structural-connectivity matrix shows block structure after sorting regions by a supplied module partition. Do not use it to infer modules; it visualizes labels produced upstream.

## Preconditions

- Install NumPy, SciPy, Matplotlib, and any additional packages imported by the selected script.
- Set `ZEBRAFISH_PATH`, `PROCESS_DATA_DIR`, `SAVE_DIR`, and `ATLAS_PATH` when they are referenced; do not rely on fallback paths.
- Provide the input artifacts listed below and validate their shapes, finite values, and shared region ordering before analysis.
- Use the bundled helper modules in `scripts/` when the implementation imports project-specific functions.

## Inputs and outputs

| Direction | File | Shape |
|---|---|---|
| in | `$ZEBRAFISH_PATH/Files/SC_matrix_undirected_terminals_expanded.npy` | (70, 70) float |
| in | `$PROCESS_DATA_DIR/Figure3_coassignment_matrix_SC_4module_ordered.npy` | (65,) int, values 1–4 |
| in | `$PROCESS_DATA_DIR/Figure1_excluded_regions.npy` | (5,) int |
| out | `$SAVE_DIR/figure.png` / `figure_refine.png` | 8×8 in, 300 dpi |
| out | `$SAVE_DIR/statistics.json` | reference implementation only |

No `.npy` artifact is written. Full detail in `references/data_contract.md`.

## Procedure

1. Load the module label vector, the 70×70 undirected SC matrix, and the 5-element exclusion
   index array (cast to `int` — the saved dtype is not guaranteed).
2. Build a boolean keep-mask of length 70 and clear the excluded positions, then index the SC
   matrix on **both** axes with it: `sc[mask][:, mask]` → (65, 65). Use the mask rather than
   `np.delete` twice; deleting sequentially shifts the indices between the two calls and
   silently drops the wrong rows.
3. Reconcile the label vector length against the matrix. The stored labels are *already*
   post-exclusion (65), so the branch that matches `len(labels) == filtered.shape[0]` fires and
   the labels are used as-is. Keep the other branch (labels of length 70 → apply the same
   mask) because it is the only thing standing between you and a silent misalignment if the
   upstream recipe ever changes what it saves.
4. Assert the matrix is square, that its size equals the label count, and that it holds no
   NaN/Inf. A misalignment here produces a plausible-looking but wrong figure, which is worse
   than a crash.
5. Square the matrix element-wise (`sc ** 2`). Weights lie in [0, 1], so squaring compresses
   weak links toward zero and leaves strong ones near their value — it widens the visual gap
   between within-module and between-module edges without changing their rank order.
6. Sort rows and columns by module label with `np.argsort(labels)`, applied to both axes, to
   block-diagonalise the matrix. `argsort` is stable, so within a module the original region
   order is preserved.
7. Walk the sorted labels to recover module boundaries as `(start, end)` pairs by cumulative
   module size. Derive them from the sorted labels rather than assuming equal-size blocks.
8. `imshow` the sorted squared matrix with `cmap='Purples'`, `aspect='equal'`,
   `interpolation='nearest'`. Nearest-neighbour interpolation keeps each region pair a crisp
   cell; the default would blur adjacent modules into each other at the boundaries.
9. For each boundary pair draw a `plt.Rectangle` at `(start - 0.5, start - 0.5)` of side
   `end - start`, `linewidth=3`, `edgecolor='black'`, `facecolor='none'`. The `-0.5` offset
   matters: `imshow` places integer coordinates at *pixel centres*, so a box drawn at `start`
   would bisect the first row of the module.
10. Add a horizontal colorbar labelled `SC^2` (`fraction=0.046`, `pad=0.08`), hide all ticks
    and tick labels on both axes, and save at 300 dpi with `bbox_inches='tight'`.
11. Write `statistics.json` with the shapes, module sizes, boundaries and the distribution of
    the squared weights.

## Key parameters

| Parameter | Value | Why it matters |
|---|---|---|
| element-wise power | `2` | Contrast enhancement. Monotonic on [0, 1], so module structure is unchanged — only its visibility. Reporting the mean of `SC²` as a connectivity strength would be misleading; it is a display transform. |
| `cmap` | `'Purples'` | Sequential, light-to-dark. Matches the Figure 3 panel convention. |
| `interpolation` | `'nearest'` | Prevents blurring across module boundaries. |
| `aspect` | `'equal'` | Keeps the matrix square so the diagonal boxes read as squares. |
| rectangle `linewidth` | `3` | "Thick-edge black boxes" as specified; thinner lines vanish at 65×65. |
| rectangle offset | `-0.5` | Aligns box edges with pixel edges rather than pixel centres. |
| `figsize`, `dpi` | `(8, 8)`, `300` | |
| colorbar | horizontal, `fraction=0.046`, `pad=0.08` | |

## Expected results

A correct re-run on the same data should reproduce:

- Original matrix `(70, 70)`, 5 excluded regions, filtered matrix `(65, 65)`
- 4 modules with labels `[1, 2, 3, 4]` and sizes **22, 11, 19, 13**
- Module boundaries `(0, 22)`, `(22, 33)`, `(33, 52)`, `(52, 65)`
- `SC²` over the filtered matrix: min **0.0**, max **1.0**, mean **0.2990**, median **0.3061**,
  SD **0.2238**, p25 **0.1091**, p75 **0.4652**, p90 **0.5928**, p95 **0.6739**

The claim these support: the squared undirected SC matrix across 65 regions shows a distinct
four-community modular architecture, with high-intensity connectivity concentrated in the
diagonal blocks and sparse inter-modular connections.

## Bundled files

- `scripts/reference_implementation.py` — executable implementation or helper module.
- `scripts/refine_implementation.py` — executable implementation or helper module.
- `references/data_contract.md` — input, output, shape, and indexing contract.
- `references/method_details.md` — parameters, statistical details, and validation notes.

## Usage

```bash
python scripts/refine_implementation.py
```
