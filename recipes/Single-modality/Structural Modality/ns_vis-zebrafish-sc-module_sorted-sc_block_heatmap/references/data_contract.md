# Data contract — ns_vis-zebrafish-sc-module_sorted-sc_block_heatmap

## Contents

- [Environment variables](#environment-variables)
- [Library dependencies](#library-dependencies)
- [Inputs](#inputs)
- [Outputs](#outputs)
- [Indexing conventions](#indexing-conventions)
- [Dimension-reconciliation branch](#dimension-reconciliation-branch)

## Environment variables

| Variable | Required | Use |
|---|---|---|
| `ZEBRAFISH_PATH` | yes | Root holding `Files/SC_matrix_undirected_terminals_expanded.npy` |
| `PROCESS_DATA_DIR` | yes | Reads the module label vector and the exclusion mask. Nothing is written here. |
| `SAVE_DIR` | yes | Writes `figure.png` (base) / `figure_refine.png` (refine) and `statistics.json` (base only) |
| `ATLAS_PATH` | no | Not used by this recipe |

Both scripts fetch these with plain `os.getenv(...)` and perform **no validation**. An unset
variable becomes `None` and fails later inside `os.path.join` with
`TypeError: expected str, bytes or os.PathLike object, not NoneType`. Only `SAVE_DIR` is
`os.makedirs`-ed; `PROCESS_DATA_DIR` is assumed to exist.

## Library dependencies

```python
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))  # vendored library modules sit beside this script
```

Present in both scripts, but **no symbol is imported from the custom library, and no library
module is bundled** — `scripts/` holds only the two implementations. The line is vestigial and
resolves nothing either way. The full import set is:

| Script | Imports |
|---|---|
| `reference_implementation.py` | `os`, `sys`, `numpy`, `matplotlib.pyplot`, `json` |
| `refine_implementation.py` | `os`, `sys`, `numpy`, `matplotlib.pyplot` |

### Helpers defined inline (not external dependencies)

| Name | Where | Signature |
|---|---|---|
| `plot_matrix_communities` | `refine_implementation.py` lines 15–50 | `plot_matrix_communities(matrix, labels, ax=None, cmap='Purples', edge_color='black') -> AxesImage` |

`zebrafish_Ca_visualization_patch_xps.plot_matrix_communities` exists in the wider library and
is named in the task spec and the workflow description, but **neither script imports it**. The
figure-oriented implementation re-implements it locally with the docstring "Mimics the expected behavior of the
library function if not importable". Travel this function with the script; do not list the
module as a dependency.

`MapzebrainAtlas` is **not** needed by this recipe — no atlas member is touched.

## Inputs

### `SC_matrix_undirected_terminals_expanded.npy`

- Location: `$ZEBRAFISH_PATH/Files/SC_matrix_undirected_terminals_expanded.npy`
- Shape: `(70, 70)`, float, symmetric, weights in `[0, 1]`
- Content: terminal-expanded structural connectome, symmetrised
- Produced by: upstream of this recipe set (shipped with the dataset, not written by any recipe here)

### `Figure3_coassignment_matrix_SC_4module_ordered.npy`

- Location: `$PROCESS_DATA_DIR/Figure3_coassignment_matrix_SC_4module_ordered.npy`
- Shape: **`(65,)`, integer** — a per-region module label, values `1, 2, 3, 4`
- Produced by: `ns_seg-zebrafish-sc-consensus_louvain-module_partition`, as
  `communities_ordered = reorder_clusters_anteroposterior(fcluster(Z, t=4, criterion='maxclust'))`
- The filename is misleading. The actual square co-assignment probability matrix is a
  *different* file from the same upstream recipe, `Figure3_coassignment_matrix_SC.npy`. The
  `_4module_ordered` suffix marks a label vector whose labels have been renumbered so that
  module 1 is most anterior and module 4 most posterior.
- Length is 65, i.e. **already post-exclusion**

### `Figure1_excluded_regions.npy`

- Location: `$PROCESS_DATA_DIR/Figure1_excluded_regions.npy`
- Shape: `(5,)`, cast to `int` on load
- Values in this dataset: `[10, 34, 44, 49, 69]` — retina (10) plus four regions failing the
  sampling-density threshold
- Produced by: `ns_pre-zebrafish-ca_atlas-region_census-exclusion_mask`

## Outputs

### `.npy` artifacts

**None.** This is an `ns_vis` recipe: it renders a figure and writes descriptive statistics, and
no other recipe in the set reads anything it produces. Its downstream set is empty.

### Figure and statistics

- `$SAVE_DIR/figure.png` — reference implementation, 8×8 in, 300 dpi, `bbox_inches='tight'`
- `$SAVE_DIR/figure_refine.png` — figure-oriented implementation, same geometry
- `$SAVE_DIR/statistics.json` — **reference implementation only**; the figure-oriented implementation dropped `import json`
  and the entire statistics block

## Indexing conventions

- Region indices are **0-indexed** throughout (0–69 pre-exclusion). The exclusion array holds
  0-indexed values.
- Exclusion is applied by boolean mask on both axes simultaneously
  (`sc_matrix[valid_mask][:, valid_mask]`), not by two successive `np.delete` calls. Sequential
  deletion would renumber the remaining indices between calls and remove the wrong rows.
- After exclusion the 65 surviving regions are **renumbered contiguously 0–64**. Position 34 in
  the filtered matrix is *not* atlas region 34. Nothing in this recipe maps back to anatomy, so
  the renumbering is harmless here — but the module label vector shares the same post-exclusion
  numbering, and any attempt to place these labels on atlas coordinates has to reconstruct the
  original indices from the exclusion mask (which is exactly what
  `ns_vis-zebrafish-sc_atlas-node_projection-module_topography` does).
- The display sort (`np.argsort(module_labels)`) introduces a **third** ordering — module-sorted
  position — used only for `imshow` and the rectangle boundaries. Do not conflate it with the
  post-exclusion region index.
- This recipe is **unilateral**: 70 regions, one hemisphere. The bilateral `i` / `i + 70`
  convention used in the Figure 4 recipes does not apply.

## Dimension-reconciliation branch

The scripts accept either label length and branch on it:

| `len(module_labels)` | Action taken |
|---|---|
| 65 (= filtered size) | Use as-is. **This is the branch that fires in practice.** |
| 70 (= raw size) | Apply the same `valid_mask` to the labels |
| anything else | `raise ValueError` |

The two scripts test these conditions in the opposite order, which is behaviourally identical
here because 65 ≠ 70. Keep the branch: it is the only guard against a silent misalignment if
the upstream partition recipe ever changes what it saves.
