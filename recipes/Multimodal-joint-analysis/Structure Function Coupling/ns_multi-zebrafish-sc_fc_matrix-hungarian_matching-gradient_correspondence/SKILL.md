---
name: "ns_multi-zebrafish-sc_fc_matrix-hungarian_matching-gradient_correspondence"
description: "Establish an optimal one-to-one correspondence between structural connectivity (SC) and functional connectivity (FC) diffusion-map gradients in zebrafish, by computing an all-pairs Pearson similarity matrix between the first 50 SC modes and the first 50 FC modes and then solving the assignment problem with the Hungarian algorithm on cost 1 - |r|. Use this whenever someone asks how well structural eigenmodes match functional gradients, wants to align SC and FC modes, asks 'which functional gradient corresponds to which structural gradient', 'do structural modes predict functional modes', 'match the eigenmodes', 'gradient similarity matrix', 'SC-FC mode alignment', or wants the red diagonal heatmap of gradient similarity |r|. It consumes Figure6_SC_gradients.npy and Figure6_FC_gradients.npy from ns_multi-zebrafish-sc_ca-diffusion_map-connectivity_gradient, so run that first, and it writes the sorted correlation matrix plus the mapping-index vector that define the alignment."
triggers:
- "Analyze optimal sc–fc gradient correspondence by hungarian matching"
- "Generate optimal sc–fc gradient correspondence by hungarian matching outputs"
- "Apply the ns_multi-zebrafish-sc_fc_matrix-hungarian_matching-gradient_correspondence recipe"
tags:
- "zebrafish"
- "sc"
- "fc"
- "matrix"
- "hungarian"
version: "1.0"
---

# Optimal SC–FC gradient correspondence by Hungarian matching

Takes the first 50 diffusion-map gradients of the structural connectome and the first 50 of
the group-average functional connectome, correlates every SC mode against every FC mode, and
finds the permutation of FC modes that maximises total absolute correlation.

## When to use this

Use this recipe to pair structural and functional gradients by maximum absolute correlation with one-to-one Hungarian assignment. Do not use independent per-gradient maxima when unique matching is required.

## Preconditions

- Install NumPy, SciPy, Matplotlib, and any additional packages imported by the selected script.
- Set `ZEBRAFISH_PATH`, `PROCESS_DATA_DIR`, `SAVE_DIR`, and `ATLAS_PATH` when they are referenced; do not rely on fallback paths.
- Provide the input artifacts listed below and validate their shapes, finite values, and shared region ordering before analysis.
- Use the bundled helper modules in `scripts/` when the implementation imports project-specific functions.

## Inputs and outputs

| Direction | File | Shape |
|---|---|---|
| in | `$PROCESS_DATA_DIR/Figure6_SC_gradients.npy` | (69, 65) — modes × regions |
| in | `$PROCESS_DATA_DIR/Figure6_FC_gradients.npy` | (64, 65) — modes × regions |
| out | `$PROCESS_DATA_DIR/Figure6_FC_SC_gradients_correlations.npy` | (50, 50) — rows SC, cols reordered FC |
| out | `$PROCESS_DATA_DIR/Figure6_FC_SC_gradients_mapping_indcies.npy` | (50,) int — note the misspelling |
| out | `$SAVE_DIR/figure.png` / `figure_refine.png`, `$SAVE_DIR/statistics.json` | |

Full detail in `references/data_contract.md`.

## Procedure

1. Load both gradient arrays from `PROCESS_DATA_DIR`.
2. Slice the leading 50 modes from each: `sc_gradients[:50, :]`, `fc_gradients[:50, :]`.
   The eigenvalue spectrum decays quickly, so modes beyond ~50 carry little structure and
   would only add noise to the assignment.
3. Build the raw similarity matrix: for every `(i, j)` in 50×50, `pearsonr(sc[i], fc[j])[0]`
   across the 65 regions. Rows index SC modes, columns index FC modes.
4. Form the cost matrix `1 - np.abs(corrs)` and solve
   `linear_sum_assignment(cost_matrix)`, keeping the **column** assignment as `mapping`.
   This is the Hungarian algorithm: it returns the permutation of FC modes that minimises
   total cost, i.e. maximises the summed |r| along the diagonal, subject to each FC mode
   being used exactly once.
5. Take the absolute value in the cost, not the signed correlation. A diffusion-map
   eigenvector is only defined up to sign — flipping a gradient's sign leaves the embedding
   identical — so an SC/FC pair at r = -0.8 describes the same spatial pattern as a pair at
   r = +0.8 and must be treated as an equally good match. Using signed r as the objective
   would reject half the genuine matches on an arbitrary convention.
6. Recompute the sorted correlation matrix with the FC columns permuted:
   `sorted_corrs[i, j] = pearsonr(sc[i], fc[mapping[j]])[0]`. Note this keeps **signed** r,
   so the saved artifact still carries the (arbitrary) signs; only the display takes `np.abs`.
7. Save `Figure6_FC_SC_gradients_correlations.npy` and
   `Figure6_FC_SC_gradients_mapping_indcies.npy` (the misspelling is part of the contract).
8. Plot `np.abs(correlations).T` — the transpose puts FC on the y-axis and SC on the x-axis
   to match the requested labels. `imshow`, `cmap='Reds'`, `aspect='equal'`, figsize (5, 5).
9. Label ticks only at positions 0 and 49, displayed as `1` and `50`, with
   `tick_params(length=0)` so the marks vanish but the end labels stay anchored to the axis.
   Colorbar labelled `Gradient similarity |r|`, rotated 270°, `labelpad=20`.

## Key parameters

| Parameter | Value | Why it matters |
|---|---|---|
| `n_modes` | 50 | How many leading modes enter the assignment. The matching is global — adding or removing modes changes which pairs are chosen, not just the matrix size. |
| `method` | `'pearson'` | The function also supports `'spearman'`; the run used Pearson, so the values are linear correlations across 65 regions. |
| cost | `1 - np.abs(corrs)` | Sign-invariant matching. See step 5 — this is the single most important choice in the method. |
| assignment | `linear_sum_assignment` | Enforces one-to-one. A greedy per-row argmax would let several SC modes claim the same FC mode and is not what happened here. |
| display transform | `np.abs(...).T` | Absolute value for colour, transpose for axis semantics. Figure-oriented implementation only. |
| `cmap`, `aspect` | `'Reds'`, `'equal'` | Display only. |
| `figsize`, `dpi` | (5, 5), 300 | Display only. |

## Expected results

From the bundled `statistics.json` (written by the figure-oriented implementation):

- `n_modes` = **50**
- `correlation_mean` = **0.004672** — mean of the *signed* sorted matrix, near zero exactly as
  expected when eigenvector signs are arbitrary
- `abs_correlation_mean` = **0.09967** — mean |r| over all 2500 entries, the off-diagonal
  background level
- `diagonal_mean` = **0.06096** — mean of the *signed* diagonal

Read those last two together before quoting anything. `diagonal_mean` is computed on signed
values, so sign cancellation drags it below the background |r| level; it is **not** a measure
of match strength and must not be reported as one. The figure's colour scale tops out at
|r| ≈ 0.63, and only the first handful of modes reach that. Input shapes recorded for the analysis:
SC (69, 65), FC (64, 65).

## Pitfalls

- **`compute_mode_similarity_matrix` is defined inline in both scripts, not imported.** It is
  not part of `zebrafish_Ca_utils`; keep or reuse the bundled inline implementation.
- **The output filename is misspelled: `Figure6_FC_SC_gradients_mapping_indcies.npy`**
  ("indcies", not "indices"). Both scripts use this literal spelling. Any consumer must match
  it exactly; "fixing" it breaks the pipeline
  DAG, which is derived from these literal filenames.
- **Do not overstate the result.** The recorded statistics and rendered figure show a diagonal
  that is visible but modest — background |r| ≈ 0.10, peak ≈ 0.63, and only the first few
  modes are strongly matched. The honest reading is the second stored conclusion: alignment is
  concentrated in the low-order (large-scale) modes and decays for higher ones.
- **A diagonal always appears.** The Hungarian step *constructs* the diagonal by permuting FC
  columns; a diagonal is guaranteed even for unrelated data. Its existence is not evidence.
  Only the magnitude relative to the off-diagonal background is, so quote `abs_correlation_mean`
  as the null level whenever you quote diagonal values.
- **Axis semantics were inverted in the untransposed implementation.** `correlations` has rows = SC and
  columns = FC, but the reference implementation plotted it untransposed under y-label "FC gradients". The
  figure-oriented implementation transposes before plotting. This does not change the matrix, only which axis
  the labels describe — but it made the published panel wrong.
- **The reference implementation's manual `ax.text` end labels were fragile.** It placed '1'/'50' at
  hand-computed data coordinates, which drifted off the spines. The figure-oriented implementation uses real
  ticks with zero length instead.
- **Statistics differ between the two scripts.** The reference implementation writes 13 fields including
  the full 50-element `diagonal_correlations` list; the bundled `statistics.json` has only the
  four fields the figure-oriented implementation writes. The per-mode diagonal values are therefore not
  preserved anywhere — recompute them from the saved correlation matrix if you need them.

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
