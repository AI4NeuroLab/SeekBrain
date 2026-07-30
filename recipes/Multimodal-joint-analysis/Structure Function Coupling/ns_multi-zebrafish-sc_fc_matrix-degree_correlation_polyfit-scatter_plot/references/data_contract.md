# Data contract — ns_multi-zebrafish-sc_ca-linregress-degree_coupling

## Contents

- [Environment variables](#environment-variables)
- [Library dependencies](#library-dependencies)
- [Inputs](#inputs)
- [Outputs](#outputs)
- [Indexing conventions](#indexing-conventions)

## Environment variables

| Variable | Required | Use |
|---|---|---|
| `PROCESS_DATA_DIR` | yes | Reads the FC matrix and the exclusion mask; writes both degree artifacts |
| `SAVE_DIR` | yes | Writes `figure.png` / `figure_refine.png` and `statistics.json` |
| `ZEBRAFISH_PATH` | **yes, and must be set explicitly** | Root containing `Files/SC_matrix_undirected_terminals_expanded.npy` |
| `ATLAS_PATH` | no | Not used — this recipe needs no atlas geometry |

### The dead `ZEBRAFISH_PATH` default

```python
DATA_ROOT = os.getenv("ZEBRAFISH_PATH",
                      "<data-root>")
```

The fallback points under the missing mount. Because it is a default rather than a raise, an
unset env var does not fail fast — it fails at the `os.path.exists(sc_path)` guard with a
`FileNotFoundError` naming a path that never existed on this machine. Set `ZEBRAFISH_PATH`
explicitly. `ns_vis-zebrafish-sc_atlas-edge_projection-sc_network_map` carries the same defect;
these two are the only scripts in the set that do.

`SAVE_DIR` and `PROCESS_DATA_DIR` are read with plain `os.getenv` and never validated;
`os.makedirs(SAVE_DIR, exist_ok=True)` is the first thing that would fail.

## Library dependencies

**This recipe bundles no library modules at all.** `scripts/` contains only
`reference_implementation.py` and `refine_implementation.py` — nothing was vendored because
nothing is imported.

```python
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))  # vendored library modules sit beside this script
```

| Symbol | Signature as used | Contract |
|---|---|---|
| *(none)* | — | **No import statement follows the `sys.path` line.** It is vestigial here. |

Every call in both scripts comes from `numpy`, `scipy.stats` (`pearsonr`, `linregress`), and
`matplotlib.pyplot`. No `MapzebrainAtlas`, no `zebrafish_Ca_utils`, no
`zebrafish_Ca_utils_predictors_xps`.

Practical consequence: delete the `sys.path` line and this script runs anywhere the three
`.npy` inputs are present. Along with the `Figure1I` / `Figure6B` / `Figure6D` figure-oriented implementations, it
is among the closest things to executable code in this set.

### Helpers defined inline

None. There is no locally defined function of any kind in either script.

## Inputs

### `SC_matrix_undirected_terminals_expanded.npy`

- Location: `$ZEBRAFISH_PATH/Files/SC_matrix_undirected_terminals_expanded.npy`
- Shape: `(70, 70)`; loaded with `allow_pickle=True` then `.astype(float)`
- Content: symmetric terminal-expanded structural connectome, zero diagonal
- Not produced by any recipe in this set — raw dataset input
- Existence-checked before loading; raises `FileNotFoundError` with the full path
- The directed sibling is not a valid substitute: row sums of a directed matrix are out-degrees

### `Figure1_FC_matrix.npy`

- Location: `$PROCESS_DATA_DIR/Figure1_FC_matrix.npy`
- Shape: `(65, 65)` — **already post-exclusion**
- Content: group-average Pearson FC across 22 larvae, unit diagonal, contains negative entries
- Produced by: `ns_ana-zebrafish-ca-pearson-fc_matrix`
- Existence-checked before loading
- Recorded NaN count for the recorded dataset: **0**

### `Figure1_excluded_regions.npy`

- Location: `$PROCESS_DATA_DIR/Figure1_excluded_regions.npy`
- Shape: `(5,)`, cast to int
- Values in this dataset: `[10, 34, 44, 49, 69]`
- Produced by: `ns_pre-zebrafish-ca_atlas-region_census-exclusion_mask`
- 0-based indices into the original 70-region atlas ordering
- Existence-checked before loading

## Outputs

### `Figure2_Node_degree_SC.npy`

- Location: `$PROCESS_DATA_DIR/Figure2_Node_degree_SC.npy`
- Shape: `(65,)`, float
- Content: `np.sum(sc_matrix_filtered, axis=1)` after `np.fill_diagonal(..., 0.0)`
- Range for the recorded dataset: `[4.069, 45.101]`

### `Figure2_Node_degree_FC.npy`

- Location: `$PROCESS_DATA_DIR/Figure2_Node_degree_FC.npy`
- Shape: `(65,)`, float
- Content: `np.sum(np.maximum(np.nan_to_num(fc_filtered), 0.0), axis=1)` after
  `np.fill_diagonal(..., 0.0)`. **Rectified** — negative correlations are set to zero, not
  absolute-valued and not retained.
- Range for the recorded dataset: `[8.704, 36.202]`

### Filename collision — read this

`ns_vis-zebrafish-sc_ca-node_degree-degree_atlas_map` (source `Done-Figure2E-173756`) writes the
**same two filenames** to the **same directory** from the same inputs, but defines FC degree as
`np.sum(np.abs(FC_zero_diag), axis=1)`. The two definitions agree only where FC has no negative
edges — and it does have some:

| Artifact | this recipe (2F) | degree_atlas_map (2E) |
|---|---|---|
| FC degree formula | `sum(max(FC, 0))` | `sum(abs(FC))` |
| FC degree min | 8.704 | 9.162 |
| FC degree max | 36.202 | 36.202 |
| SC degree min / max | 4.069 / 45.101 | 4.069 / 45.101 |
| SC diagonal | explicitly zeroed | left as-is (already zero) |
| SC–FC correlation | 0.694003 | 0.694150 |

The SC vectors are byte-equivalent. The FC vectors are not. Whichever script ran most recently
owns the files on disk. Track which run produced them, or point one of the two at distinct names.

No recipe in this 30-run set reads either artifact — they are terminal outputs.

### Figure and statistics

- `$SAVE_DIR/figure.png` (base) / `figure_refine.png` (refine), 300 dpi, `bbox_inches='tight'`
- `$SAVE_DIR/statistics.json` — the output file is the **refine** script's 7-key dict; the reference implementation
  script's 22-key dict was overwritten. See `method_details.md`.

## Indexing conventions

- Exclusion indices are 0-based over the original **70** regions.
- The mask is applied to SC on both axes. The FC branch is `if fc_matrix.shape[0] ==
  sc_matrix.shape[0]` (base) — that is, "if FC is still 70-wide, filter it too". On this data FC
  is 65, so the branch is skipped and FC is used as-is. Re-applying a 70-length mask to a 65-wide
  matrix is the failure mode this guard prevents; the same bug is live in
  `ns_vis-zebrafish-sc_ca-scatter_polyfit-pc1_fc_regression`, which ends up with 61 regions.
- The figure-oriented implementation adds `valid_excluded = excluded_regions[excluded_regions < sc_matrix.shape[0]]`
  before building the mask — a bounds check that is a no-op here (all five indices are < 70) but
  protects against an out-of-range exclusion list.
- After filtering, the 65 survivors are **renumbered contiguously** 0–64. Index 34 in a degree
  vector is not atlas region 34. Recover the original ordering with `np.arange(70)[mask]`.
- `np.fill_diagonal` mutates in place. `sc_matrix_filtered` is a fresh array from fancy indexing
  so this is safe, but `fc_matrix_filtered` may alias `fc_matrix` when the filter branch is
  skipped — the loaded FC array is modified in memory. Irrelevant for a single-pass script;
  relevant if you refactor this into a function that reuses the input.
- There is no bilateral `i` / `i+70` pairing here — no atlas geometry is loaded.
