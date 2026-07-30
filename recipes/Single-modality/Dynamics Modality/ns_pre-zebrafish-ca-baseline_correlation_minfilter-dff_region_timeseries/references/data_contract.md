# Data contract — ns_pre-zebrafish-ca-minfilter-dff_region_series

## Contents

- [Environment variables](#environment-variables)
- [Library dependencies](#library-dependencies)
- [Inputs](#inputs)
- [Outputs](#outputs)
- [Indexing conventions](#indexing-conventions)

## Environment variables

| Variable | Required | Use |
|---|---|---|
| `ZEBRAFISH_PATH` | yes | Root scanned by `get_datasets(..., keywords=['fish'])`; also the source of `data.hdf5` and `timesteps` |
| `ATLAS_PATH` | yes | Only for `acronyms.txt`. No atlas volume, mask, or projection is loaded — `MapzebrainAtlas` is never instantiated |
| `PROCESS_DATA_DIR` | yes | Writes both per-larva artifacts; reads the exclusion mask |
| `SAVE_DIR` | yes | Writes the figure and `statistics.json` |

No variable is validated. `os.makedirs(PROCESS_DATA_DIR, exist_ok=True)` raises `TypeError` on
`None`, so a missing `PROCESS_DATA_DIR` or `SAVE_DIR` fails at line 20. A missing `ATLAS_PATH`
fails at the `os.path.join` for `acronyms.txt`. Both scripts behave identically here.

## Library dependencies

```python
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))  # vendored library modules sit beside this script
from zebrafish_Ca_utils import get_datasets
```

The library is bundled, not external: `scripts/zebrafish_Ca_utils.py` is the one module this
recipe carries, and the `sys.path` line above resolves the import to it (identically in both the
base and figure-oriented implementations). The API contract below is unchanged.

| Symbol | Signature as used | Contract |
|---|---|---|
| `get_datasets` | `get_datasets(ZEBRAFISH_PATH, keywords=['fish'])` | Returns a list of per-larva directory paths. The script then applies `sorted()` |

That is the entire custom-library surface. `MapzebrainAtlas` is **not** used — neither
`.centroids` nor `.regionCentroids` nor `.getRegionMask`. Region membership comes from the
per-larva HDF5 `region_labels` dataset, and region names come from a plain text file. The
surface is so small that `get_datasets` could be swapped for a `glob` over `fish*/` and the
custom import dropped entirely — worth knowing, since importing the module also pulls in its
own heavy dependency set (`numba`, `tifffile`, `scikit-image`, `scikit-learn`, `bctpy`,
`IPython`) at load time.

Third-party imports: `numpy`, `matplotlib.pyplot`,
`scipy.ndimage.gaussian_filter1d`, `scipy.ndimage.minimum_filter1d`, `h5py`, `tqdm.tqdm`.
Standard library: `os`, `sys`, `json`.

No helper function is defined inline; the script is straight-line code with two loops.

## Inputs

### `data.hdf5` (one per larva)

- Location: `<larva_folder>/data.hdf5`
- Datasets read:
  - `timeseries` — `(n_neurons, T)`, cast to `float64`. Raw motion-corrected fluorescence.
  - `region_labels` — `(n_neurons, 70)`, cast to `bool`. Column `r` is `True` where the neuron
    belongs to atlas region `r`.
  - `timesteps` — `(T,)`, cast to `float64`, seconds. Read only for the representative larva,
    used as the x axis and to place the acronym column.
- `T` = 892 and the record spans 0.0–903.06 s in this dataset (≈ 1.01 s per frame).
- Produced by: upstream acquisition and registration, outside this recipe set.
- Missing file: printed skip, loop continues.
- Any exception during processing: caught, printed, loop continues. There is no re-raise.

### `acronyms.txt`

- Location: `$ATLAS_PATH/acronyms.txt`
- Format: one region acronym per line, in atlas region-id order, read with
  `[line.strip() for line in f.readlines()]`
- Length must be ≥ 70. `statistics.json` records `n_regions_total = 70`, i.e. `len(region_acronyms)`.
- The filter `[region_acronyms[i] for i in range(len(mask)) if mask[i]]` indexes it by
  `range(fish2_regional.shape[0])` = `range(70)`, so a shorter file raises `IndexError`.

### `Figure1_excluded_regions.npy`

- Location: `$PROCESS_DATA_DIR/Figure1_excluded_regions.npy`
- Shape: `(5,)`, dtype int; values `[10, 34, 44, 49, 69]`
- Produced by: `ns_pre-zebrafish-ca_atlas-region_census-exclusion_mask`
- **Optional here.** Both scripts wrap the load in `os.path.exists`; if the file is absent they
  substitute `np.array([], dtype=int)` and plot all 70 regions. There is no warning. Most
  sibling recipes raise `FileNotFoundError` instead. Verify the file is present before trusting
  a `n_regions_plotted` of 70.
- Applied as a boolean mask on a 70-length axis: `mask = np.ones(70, bool); mask[excluded] =
  False`. No bounds check, so an index ≥ 70 would raise.

## Outputs

### `Figure1_dff_{fish_name}.npy`

- Location: `$PROCESS_DATA_DIR/Figure1_dff_{fish_name}.npy`, e.g. `Figure1_dff_fish2.npy`
- `fish_name` = `os.path.basename(folder.rstrip('/'))`
- Shape: `(n_neurons, T)`, dtype `float64`. With ≈ 54 000 neurons and `T` = 892 this is about
  390 MB per larva, ≈ 8.5 GB for all 22.
- Content: per-neuron ΔF/F₀, guaranteed free of NaN and Inf by an assertion.
- Consumed by: **no other recipe in this set.** It exists as the voxel-level corrected dataset
  for ad-hoc single-cell analysis. If disk is tight, this is the artifact to drop.

### `Figure1_region_series_dff_{fish_name}.npy`

- Location: `$PROCESS_DATA_DIR/Figure1_region_series_dff_{fish_name}.npy`
- Shape: **`(70, T)`** — regions × time, dtype `float64`. `statistics.json` confirms
  `fish2_timeseries_shape = [70, 892]`.
- Content: `dff[region_labels[:, r]].mean(axis=0)` per region. A region with no neurons in this
  larva is filled with `np.nan` for its whole row, not zeros. This is the origin of the NaNs
  that `ns_ana-zebrafish-ca-pearson-fc_matrix` handles with `np.nanmean` and
  `ns_ana-zebrafish-ca-triu_pearson-network_stereotypy` handles with `np.nan_to_num`.
- Pre-exclusion: all 70 rows are present. Filtering to 65 happens in the consumer, not here.

**Naming mismatch — read this before building a pipeline.** No other script in this set reads
either of these two filenames. The two recipes that consume regional ΔF/F₀ read different
paths:

| Consumer | Path it actually opens |
|---|---|
| `ns_ana-zebrafish-ca-pearson-fc_matrix` | `<larva_folder>/region_series_dff.npy` |
| `ns_pre-zebrafish-ca-minfilter_zscore-bilateral_state_matrix` | `<larva_folder>/region_series_dff_bilateral.npy` |

Both look inside the larva folder under `ZEBRAFISH_PATH`, not in `PROCESS_DATA_DIR`, and
neither uses the `Figure1_` prefix or the `_{fish_name}` suffix. Those files were evidently
pre-existing in the raw dataset. So although this recipe is conceptually the ΔF/F₀ producer for
the FC chain, the on-disk edge is broken. To wire it up, either also write
`region_series_dff.npy` into each larva folder, or repoint the consumers. Recording this
matters because a DAG derived from filenames alone will show this recipe as a leaf.

### Figure and statistics

- `$SAVE_DIR/figure.png` (base) / `$SAVE_DIR/figure_refine.png` (refine), 300 dpi,
  `bbox_inches='tight'`
- `$SAVE_DIR/statistics.json` — see `method_details.md`; the output file does not match either
  script's serialisation exactly.

## Indexing conventions

- **Regions are 0-indexed, 0–69**, matching `region_labels` columns, `acronyms.txt` line order,
  and the exclusion list. Region 10 is the eleventh line of `acronyms.txt`.
- **The saved arrays are pre-exclusion (70 rows).** Only the figure works on the 65 survivors.
  A consumer loading `Figure1_region_series_dff_fish2.npy` gets all 70 and must apply the mask
  itself — do not assume it is already filtered.
- **After exclusion, the 65 survivors are renumbered contiguously 0–64** for plotting, and
  `region_acronyms_filtered` is renumbered in lockstep. Post-exclusion index 34 is not atlas
  region 34.
- **Trace order is anterior → posterior top to bottom.** `y_offset = (n - 1 - i) * 0.5` puts
  index 0 (`OE`) at the top and index 64 (`VSL`) at the bottom. Both the traces and the acronym
  text use the same expression, so they cannot desynchronise.
- **This is the hemisphere-collapsed 70-region space.** There is no left/right split and no
  `i` / `i + 70` bilateral pairing here. That convention is introduced by
  `ns_pre-zebrafish-ca-minfilter_zscore-bilateral_state_matrix` and the atlas projection
  recipes, which read a separate `region_series_dff_bilateral.npy` with 140 rows.
- **Larva ordering is lexicographic, not numeric.** `sorted()` on the folder list yields
  `fish1, fish10, fish11, …, fish19, fish2, fish20, fish21, fish22, fish3, …`. Output files are
  keyed by name so this is harmless for the artifacts, but do not index the sorted list
  positionally expecting `fish2` at position 1. The script instead searches for the first
  basename containing the substring `fish2`.
- **Time is in seconds** in `timesteps`, but every filter parameter (`size=300`, `sigma=3`,
  `sigma=60`, `sigma=1`) is in **frames**. At ≈ 1.01 s/frame the 300-frame baseline window is
  ≈ 5 minutes. Mixing the two units is the easiest way to break the reference implementationline estimate.
