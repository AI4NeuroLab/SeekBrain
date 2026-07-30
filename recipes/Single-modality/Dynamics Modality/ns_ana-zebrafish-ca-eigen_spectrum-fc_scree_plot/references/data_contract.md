# Data contract — ns_vis-zebrafish-ca-eigen_spectrum-fc_scree_plot

## Contents

- [Environment variables](#environment-variables)
- [Library dependencies](#library-dependencies)
- [Inputs](#inputs)
- [Outputs](#outputs)
- [Indexing conventions](#indexing-conventions)
- [Relationship to the SC scree plot](#relationship-to-the-sc-scree-plot)


## Environment variables

| Variable | Required | Use |
|---|---|---|
| `PROCESS_DATA_DIR` | yes | Reads `Figure6_FC_eigenvalues.npy`. Nothing is written here. |
| `SAVE_DIR` | yes | Writes `figure.png` / `figure_refine.png` and `statistics.json` |
| `ZEBRAFISH_PATH` | no | Not used — no raw data is touched |
| `ATLAS_PATH` | no | Not used — no atlas geometry is involved |

Both required variables are validated up front:

```python
if not PROCESS_DATA_DIR:
    raise ValueError("PROCESS_DATA_DIR environment variable not set")
if not SAVE_DIR:
    raise ValueError("SAVE_DIR environment variable not set")
```

Then `os.makedirs(SAVE_DIR, exist_ok=True)`. Both scripts do this identically.

## Library dependencies

**This recipe bundles no library modules at all.** `scripts/` contains
`reference_implementation.py` and `refine_implementation.py` and nothing else — because neither
script imports the custom library. Both contain:

```python
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
```

and **no import from it**. No `from zebrafish_Ca_utils import ...`, no `MapzebrainAtlas`,
neither `.centroids` nor `.regionCentroids`. The `sys.path` line is vestigial; deleting it
changes nothing. This makes both scripts runnable given only the input `.npy`.

Note this differs from the sibling `ns_vis-zebrafish-sc-eigen_spectrum-sc_scree_plot`
(Figure 6B), whose **base** script wildcard-imports five custom modules
(`zebrafish_Ca_utils`, `zebrafish_Ca_stats_patch_xps`, `zebrafish_Ca_utils_patch_xps`,
`zebrafish_Ca_utils_predictors_xps`, `zebrafish_Ca_visualization_patch_xps`) — and therefore
carries all five in its own `scripts/` — before its refine pass strips them. The 6D scripts
never had those imports to begin with, so they carry nothing.

### Actual dependencies

| Script | Imports |
|---|---|
| base | `os`, `sys`, `json`, `numpy`, `matplotlib.pyplot` |
| refine | the same, plus `matplotlib.ticker.FormatStrFormatter`, `matplotlib.ticker.AutoMinorLocator` |

No helper function is defined inline; the whole run is top-level script code.

## Inputs

### `Figure6_FC_eigenvalues.npy`

- Location: `$PROCESS_DATA_DIR/Figure6_FC_eigenvalues.npy`
- Shape: `(64,)` float, 1-D
- Order: descending — `eigenvalues[0]` = 0.36940 is the largest, `eigenvalues[49]` = -0.032175
  is the smallest of the first 50
- Sign: **mixed**. The median of the first 50 is -0.0225, so most of the plotted spectrum is
  negative. The curve crosses zero at roughly index 8–9.
- Content: the eigenvalue spectrum of the diffusion-map embedding of the group-average FC
  matrix. 64 components = `min(64, n_regions - 1)` from a 65-region matrix.
- Produced by: `ns_multi-zebrafish-sc_ca-diffusion_map-connectivity_gradient`
- Loaded with plain `np.load(path)`. If `ndim > 1` the script flattens it, so a `(64, 1)`
  column vector also works. The sibling SC script instead uses
  `np.load(path, allow_pickle=True).astype(float)` — a different, stricter load. Do not assume
  the two are interchangeable if you swap inputs.
- Fatal if missing: explicit `os.path.exists` check → `FileNotFoundError`

### Assertions

```python
assert isinstance(eigenvalues, np.ndarray), "Eigenvalues must be a numpy array"
assert eigenvalues.size >= 50, f"Need at least 50 eigenvalues, got {eigenvalues.size}"
```

Both scripts keep both assertions. The size check exists because `xlim=[-1, 51]`,
`xticks=[1, 50]` and the `[:50]` statistics window all assume at least 50 values.

## Outputs

### No `.npy` artifacts

This is an `ns_vis` recipe: it renders a panel and records descriptive numbers. There is no
`np.save` call anywhere in either script, and `analytical_report.md` correctly lists
"Artifacts: None". **No recipe in the set is downstream of this one.**

### Figure

- `$SAVE_DIR/figure.png` (base) / `$SAVE_DIR/figure_refine.png` (refine)
- 300 dpi, `bbox_inches='tight'`, preceded by `plt.tight_layout()`

### `statistics.json`

- `$SAVE_DIR/statistics.json`
- Written by both scripts with **identical content** — the refine pass changed only styling.
- Full contents in `method_details.md`. Two blocks inside it
  (`cumulative_variance_explained`, `gradients_for_variance_thresholds`) are degenerate; see
  Pitfalls in `RECIPE.md`.

## Indexing conventions

- **Eigenvalues are 0-indexed in the array, 1-indexed on the plot.** `gradient_indices =
  np.arange(1, n+1)` is the x coordinate, so array position `k` is displayed as gradient
  `k + 1`. `eigenvalue_1` in the statistics is `eigenvalues[0]`; `eigenvalue_50` is
  `eigenvalues[49]`.
- **All 64 values are plotted; the x-limit hides the tail.** No slicing happens before
  plotting. `xlim=[-1, 51]` merely frames the view, so indices 51–64 exist in the line object
  but are off-screen. Widening the limit reveals them.
- **The statistics window is a real slice**: `first_50_eigenvalues = eigenvalues[:50]`. Every
  field except `n_eigenvalues` is computed on those 50, not on all 64.
- **Regions do not appear in this recipe.** The 70 → 65 exclusion happened far upstream; by the
  time the spectrum is written the region axis is gone. `Figure1_excluded_regions.npy` is not
  read here.

## Relationship to the SC scree plot

`ns_vis-zebrafish-sc-eigen_spectrum-sc_scree_plot` (Figure 6B) is the same plot for
`Figure6_SC_eigenvalues.npy` (69 values, first eigenvalue 0.63873, min -0.18672). Its
`statistics.json` uses a **different, smaller schema** — `n_eigenvalues`, `first_eigenvalue`,
`mean_eigenvalue`, `median_eigenvalue`, `min_eigenvalue`, `max_eigenvalue` — with no
cumulative-variance block, so it avoids the degeneracy documented here. The two files cannot be
compared field-by-field; match on the values themselves.
