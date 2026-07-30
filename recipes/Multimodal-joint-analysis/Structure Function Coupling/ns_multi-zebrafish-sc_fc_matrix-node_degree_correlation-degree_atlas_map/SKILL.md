---
name: "ns_multi-zebrafish-sc_fc_matrix-node_degree_correlation-degree_atlas_map"
description: "Project weighted structural and functional node degrees onto the Mapzebrain atlas as a split-hemisphere anatomical map — z-scored SC degree colouring the left-brain region centroids, z-scored FC degree colouring the right-brain centroids, over the XY (dorsal) atlas projection. Reach for this whenever someone wants to *see where the hubs are*: 'map the connectivity hubs onto the brain', 'which regions are structural hubs', 'show SC and FC degree side by side on the atlas', 'spatial distribution of node degree', 'do structural and functional hubs overlap anatomically', 'hub topography', 'degree map'. It computes and writes Figure2_Node_degree_SC.npy and Figure2_Node_degree_FC.npy, and reports the SC–FC degree correlation (r ≈ 0.69). If the deliverable is a scatter plot with a regression line rather than an anatomical map, use ns_multi-zebrafish-sc_ca-linregress-degree_coupling instead — it writes the same two artifacts by a slightly different FC-degree formula."
triggers:
- "Analyze structural and functional node degree projected onto the atlas"
- "Generate structural and functional node degree projected onto the atlas outputs"
- "Apply the ns_multi-zebrafish-sc_fc_matrix-node_degree_correlation-degree_atlas_map recipe"
tags:
- "zebrafish"
- "sc"
- "fc"
- "matrix"
- "node"
version: "1.0"
---

# Structural and functional node degree projected onto the atlas

Sums the weighted rows of the undirected structural connectome and of the group-average FC
matrix to get one degree per region, z-scores each, and paints them onto the left and right
halves of a dorsal atlas view.

## When to use this

Use this recipe to compute structural and functional node degree, compare them across regions, and project both measures onto atlas views. Do not use it unless matrices, centroids, and exclusion indices follow the same region order.

## Preconditions

- Install NumPy, SciPy, Matplotlib, and any additional packages imported by the selected script.
- Set `ZEBRAFISH_PATH`, `PROCESS_DATA_DIR`, `SAVE_DIR`, and `ATLAS_PATH` when they are referenced; do not rely on fallback paths.
- Provide the input artifacts listed below and validate their shapes, finite values, and shared region ordering before analysis.
- Use the bundled helper modules in `scripts/` when the implementation imports project-specific functions.

## Inputs and outputs

| Direction | File | Shape |
|---|---|---|
| in | `$ZEBRAFISH_PATH/Files/SC_matrix_undirected_terminals_expanded.npy` | (70, 70) |
| in | `$PROCESS_DATA_DIR/Figure1_FC_matrix.npy` | (65, 65) |
| in | `$PROCESS_DATA_DIR/Figure1_excluded_regions.npy` | (5,) int |
| in | atlas `.regionCentroids['left']`, `['right']`, `.XYprojection` | (70, 3) each; 2-D image |
| out | `$PROCESS_DATA_DIR/Figure2_Node_degree_SC.npy` | (65,) float |
| out | `$PROCESS_DATA_DIR/Figure2_Node_degree_FC.npy` | (65,) float |
| out | `$SAVE_DIR/figure.png` / `figure_refine.png`; `statistics.json` is written only by `reference_implementation.py` | |

Full detail in `references/data_contract.md`.

## Procedure

1. Load the undirected SC (70×70), the group-average FC (already 65×65), and the exclusion list.
2. Build a boolean keep-mask over the 70 original regions and apply it to both axes of SC → 65×65.
   Leave FC alone: it arrives pre-filtered, and re-applying the mask to a 65-wide matrix would
   drop the wrong five regions. Assert the two shapes match afterwards — that assert is the only
   thing standing between a mis-specified exclusion list and a silently misaligned figure.
3. SC degree = `np.sum(SC_filtered, axis=1)`. The undirected matrix is symmetric so row sums and
   column sums agree; its diagonal is already zero, so no self-loop correction is applied here
   (unlike the sibling recipe, which zeroes it explicitly).
4. FC degree: copy the FC matrix, `np.fill_diagonal(..., 0.0)` — the unit diagonal would
   otherwise add a constant 1 to every region and is not a connection — then
   `np.sum(np.abs(...), axis=1)`. **Absolute** value, so a strong anticorrelation counts as
   strong coupling.
5. `np.nan_to_num` both degree vectors (nan/±inf → 0) and save them under their two artifact
   names.
6. Build the atlas geometry: concatenate the 70 left and 70 right `regionCentroids` into a
   (140, 3) array, flip y with `centroids[:, 1] = 974 - centroids[:, 1]` to match the image's
   row-origin-at-top convention, then remove the excluded regions from **both** hemispheres via
   `mask[excluded] = False` and `mask[70 + excluded] = False`. The result is 130 = 65 left + 65
   right, and the split point is at index 65 of the *filtered* array, not 70.
7. Z-score each degree vector independently. Structural weights (terminal counts) and functional
   weights (summed correlations) live on incomparable scales; without z-scoring the two
   hemispheres could not share one colour axis.
8. Plot the `XYprojection` with `imshow(cmap='binary', aspect='equal')`, axis off. Scatter the
   65 left centroids coloured by z-scored SC degree and the 65 right centroids coloured by
   z-scored FC degree, both `cmap=Blues_r`, `vmin=-3`, `vmax=2`, `s=55`, black edges.
9. Label "Structural" under the left half and "Functional" under the right. Add a tickless
   vertical colorbar at `fig.add_axes` on the far left, labelled `Weighted degree`.

## Key parameters

| Parameter | Value | Why it matters |
|---|---|---|
| SC variant | undirected, terminals expanded | Row sum of a directed matrix would be out-degree only. |
| FC degree | `sum(abs(FC))`, diagonal zeroed | Absolute value, so negative correlations add to the degree. The sibling recipe rectifies instead — this is the one real numerical difference between them. |
| SC degree | `sum(SC, axis=1)`, diagonal **not** zeroed | Harmless here because the SC diagonal is zero, but it is an unguarded assumption. |
| y-flip constant | `974` | The atlas XY projection's height in pixels. Hard-coded; if the atlas volume changes, every marker lands in the wrong place with no error. |
| centroid split | first 65 = left, next 65 = right | Applied *after* filtering. Using 70 as the split point silently mixes hemispheres. |
| z-score | population σ (ddof=0) | Use `scipy.stats.zscore`; a manual calculation with a `+1e-10` guard is numerically identical for these data. |
| `cmap` | `Blues_r` | Deliberately inverted: **white = high** degree, dark blue = low. This reverses the usual heat convention, so label it clearly. |
| `vmin`, `vmax` | `-3`, `2` | Asymmetric on purpose. SC z-scores run to −3.25, FC to −2.46, so the low tail is clipped; the high end at +2 covers both maxima (+1.84, +1.41). |
| marker size `s` | `55` | |
| edge `linewidths` | `0.5` in the reference implementation) / `1.0` in the recommended implementation | |
| `figsize`, `dpi` | `(10, 8)`, `300` | |
| colorbar axes | `[0.05, 0.3, 0.02, 0.4]` in the reference implementation) / `[0.05, 0.35, 0.02, 0.3]` in the recommended implementation | Placed off the image so it never overlays anatomy. |

## Expected results

From `statistics.json` — written only by `reference_implementation.py`:

- 70 SC regions → 65 after excluding 5; FC already at 65; 65 centroids per hemisphere (130 total)
- SC degree: mean **30.280**, s.d. **8.066**, median 30.631, range **[4.069, 45.101]**,
  IQR [26.029, 35.055]
- FC degree: mean **26.371**, s.d. **6.994**, median 27.416, range **[9.162, 36.202]**,
  IQR [21.381, 32.575]
- Z-scored vectors: mean ≈ 0 (9.2e-17, 2.8e-16), s.d. ≈ 1
- SC–FC degree correlation: **r = 0.6941**
- Z-score display ranges: SC `[-3.250, 1.837]`, FC `[-2.461, 1.406]`

Headline claim: structural hubs and functional hubs occupy the same anatomy — z-scored degrees
correlate at r ≈ 0.69 across 65 regions.

## Pitfalls

- **This recipe and `ns_multi-zebrafish-sc_ca-linregress-degree_coupling` overwrite each other.**
  Both write `Figure2_Node_degree_SC.npy` and `Figure2_Node_degree_FC.npy` to the same
  `PROCESS_DATA_DIR`, and their FC degrees are **not** the same quantity: this recipe sums
  `abs(FC)`, the other sums `max(FC, 0)`. The different FC degree minima demonstrate the divergence — FC degree minimum
  is 9.162 here and 8.704 there, while the maxima agree at 36.202, exactly what you would expect
  if some regions carry negative FC edges. Whichever script ran last determines what is on disk.
  Record which one produced the file, or write to distinct names.
- **Use `.regionCentroids`, not `.centroids`.** Both members exist on `MapzebrainAtlas` and are
  used elsewhere in this dataset. They are not interchangeable and the shapes may match, so a
  substitution fails silently as scrambled marker positions.
- **Preserve statistics when using the figure-oriented implementation.** It does not write
  `statistics.json`; add the statistics block from `reference_implementation.py` if the
  numerical outputs in Expected results are required.
- **The y-flip constant 974 is unvalidated.** It is not read from `xy_projection.shape[0]`; it is
  a literal. Cross-check it against the actual projection height before trusting marker
  placement on a different atlas build.
- **The bilateral exclusion assumes `left[i]` and `right[i]` are the same region.** The mask does
  `mask[excluded] = False; mask[70 + excluded] = False`, which is only correct if the two
  centroid arrays share an ordering. They do in this atlas; verify before porting.
- **Anchor panel labels to the axes.** The reference implementation positions "Structural"
  and "Functional" at `fig_height * 0.95` in data coordinates, which crowds the anatomy and
  breaks if the projection is re-cropped. The figure-oriented implementation uses `transform=ax.transAxes` at
  `y = -0.05`, placing the labels safely below the axes. Anchor labels in axes coordinates at `y=-0.05`.
- **Averaging before degree, not after.** The FC degree comes from the group-average matrix, so
  it is the degree of the mean network, not the mean of per-larva degrees. Those differ; the
  choice is defensible but should be stated when comparing against per-larva statistics.

## Bundled files

- `scripts/reference_implementation.py` — executable implementation or helper module.
- `scripts/refine_implementation.py` — executable implementation or helper module.
- `scripts/zebrafish_Ca_utils.py` — executable implementation or helper module.
- `references/data_contract.md` — input, output, shape, and indexing contract.
- `references/method_details.md` — parameters, statistical details, and validation notes.

## Usage

```bash
python scripts/refine_implementation.py
```
