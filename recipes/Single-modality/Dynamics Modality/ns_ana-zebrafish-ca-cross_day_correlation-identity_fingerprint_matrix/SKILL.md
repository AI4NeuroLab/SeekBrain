---
name: ns_ana-zebrafish-ca-cross_day_correlation-identity_fingerprint_matrix
description: Test whether individual zebrafish larvae can be re-identified across two imaging sessions 24 hours apart (6 dpf vs 7 dpf) by correlating the upper triangles of their functional connectivity matrices, building a symmetric larva×larva FC-similarity matrix, and scoring how often each larva's best match is itself. Use this whenever someone asks about connectome fingerprinting, brain fingerprints, individual identifiability, subject identification accuracy, test–retest or day-to-day stability of functional connectivity, "can you tell the fish apart from their brain activity", "is the FC pattern unique to each animal", or wants the FC-similarity heatmap with asterisks marking each row's maximum. This is the identification-accuracy half of the fingerprinting pair; the significance test of intra- vs inter-individual similarity lives in ns_ana-zebrafish-ca-mannwhitney-fingerprint_significance. Both write Figure1_FC_fingerprinting.npy.
triggers:
- Run the Cross-day identification of individual larvae from FC fingerprints recipe
- Test whether individual zebrafish larvae can be re-identified across two imaging sessions 24 hours apart (6 dpf vs 7 dpf) by correlating the upper triangles of their functional connectivity matrices, building a symmetric larva×larva FC-similarity matrix, and scoring how often each larva's best match is itself.
- Generate the outputs described by ns_ana-zebrafish-ca-cross_day_correlation-identity_fingerprint_matrix
tags:
- zebrafish
- ca
- cross
- day
- correlation
version: '1.0'
---

# Cross-day identification of individual larvae from FC fingerprints

Correlates each larva's day-6 connectivity profile against every larva's day-7 profile,
symmetrizes, and asks how often the strongest match is the correct animal.

## When to use this

The question is *"is a larva's functional connectome individually distinctive, and stable
enough to recognise it again a day later?"* — the zebrafish analogue of human connectome
fingerprinting.

Reach for **this** recipe when you want the identification accuracy or the similarity
**heatmap**. Reach for `ns_ana-zebrafish-ca-mannwhitney-fingerprint_significance` when you
want the intra- vs inter-individual **boxplot and p-value**. The two runs share steps 1–4
verbatim and write the same `Figure1_FC_fingerprinting.npy`; running both twice recomputes the
same matrix, which is harmless but wasteful.

This works on the dedicated 7-larva longitudinal fingerprinting cohort shipped as
`Files/FC_matrices_fingerprinting_{6,7}dpf.npy`, not on the 22-larva single-session FC stack
from `ns_ana-zebrafish-ca-pearson-fc_matrix`. Those matrices are 116×116, not 65×65 — do not
mix them.

## Preconditions

- `ZEBRAFISH_PATH` must point at a dataset root containing `Files/`. The script reads it with
  `os.getenv` and does **not** check for `None`, so an unset variable fails inside
  `os.path.join` rather than with a helpful message.
- `PROCESS_DATA_DIR` and `SAVE_DIR` must be set; both are `os.makedirs(..., exist_ok=True)`'d.
- The one library module this script imports is vendored into `scripts/` —
  `zebrafish_Ca_utils.py`. The `sys.path` line points at the script's own directory
  (`sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))`), so
  `from zebrafish_Ca_utils import *` resolves with no external setup. That single line is the
  only edit to the script; everything else is as it ran.
- **The import is nonetheless dead weight**: no symbol from that wildcard is ever used, and the
  script is otherwise pure numpy/matplotlib. Importing it still pulls in the module's own heavy
  dependencies at load time (`h5py`, `numba`, `tqdm`, `tifffile`, `scikit-image`,
  `scikit-learn`, `bctpy`, `IPython`), so the two lines can safely be deleted.
- Both `.npy` files must contain the same number of subjects and be square in the last two
  axes; the script asserts this.

## Inputs and outputs

| Direction | File | Shape |
|---|---|---|
| in | `$ZEBRAFISH_PATH/Files/FC_matrices_fingerprinting_6dpf.npy` | (7, 116, 116) |
| in | `$ZEBRAFISH_PATH/Files/FC_matrices_fingerprinting_7dpf.npy` | (7, 116, 116) |
| out | `$PROCESS_DATA_DIR/Figure1_FC_fingerprinting.npy` | (7, 7) symmetric |
| out | `$SAVE_DIR/figure.png` / `figure_refine.png`, `$SAVE_DIR/statistics.json` | |

Full detail in `references/data_contract.md`.

## Procedure

1. Load both FC stacks with `np.load(..., allow_pickle=False)`. Assert equal subject counts
   and squareness.
2. Vectorize each larva's FC matrix with `np.triu_indices(n, k=1)` — upper triangle,
   **diagonal excluded**. `k=1` matters: the diagonal is a constant 1.0 for every larva and
   would inflate every correlation toward a shared baseline, compressing the differences the
   whole analysis depends on. Cast to `float` so integer-typed inputs cannot truncate.
3. Build the asymmetric similarity matrix `S[i, j] = corr(day6 larva i, day7 larva j)` with a
   double loop over all pairs. Each pair is correlated only over positions finite in **both**
   vectors, and returns NaN if fewer than 3 positions survive — a pairwise-complete rule, so
   one bad region in one larva does not delete that larva from the analysis.
4. Symmetrize: `0.5 * (S + S.T)`. This averages the two temporal directions (i-on-day-6 vs
   j-on-day-7, and j-on-day-6 vs i-on-day-7), so no pair's score depends on which animal is
   arbitrarily called "first". Assert the result is symmetric.
5. Save as `Figure1_FC_fingerprinting.npy`.
6. Take `max_indices = np.argmax(symmetric_similarity, axis=1)`. A larva is correctly
   identified when `max_indices[i] == i`. Accuracy is the mean of that boolean vector.
7. Plot: `imshow` with `cmap='Reds'`, `vmin=0.60`, `vmax=0.85`, `aspect='equal'`, figsize
   (6, 5). Colorbar labelled `FC similarity` (`fraction=0.046`, `pad=0.04`).
8. Overlay a bold white `*` via `ax.text` at `(max_indices[i], i)` for every row.
9. Tick both axes at every larva, labelled 1…N (1-indexed for display; the arrays are
   0-indexed). Label both axes `Larvae`.
10. Write `statistics.json` with within-fish (diagonal), between-fish (off-diagonal),
    accuracy, and whole-matrix range blocks.

## Key parameters

| Parameter | Value | Why it matters |
|---|---|---|
| `k` in `np.triu_indices` | `1` | Excludes the diagonal. `k=0` would add 116 constant 1.0 entries to every vector and drive all similarities toward each other. |
| minimum finite overlap | `3` | Below 3 points a Pearson r is meaningless (or undefined); the pair becomes NaN instead of noise. |
| symmetrization | `0.5 * (S + S.T)` | Makes the score direction-free. It also means the diagonal is unchanged — `S[i,i]` is already its own transpose — so intra-individual values are raw, un-averaged correlations. |
| `vmin`, `vmax` | `0.60`, `0.85` | Display only. Chosen to span the observed range; the matrix minimum 0.626 sits just inside `vmin`. |
| `figsize` | `(6, 5)` | Display. |
| `dpi` | `300` | Save. |

## Expected results

From `statistics.json` of the original run (7 larvae, 116 regions):

- Within-fish (diagonal) similarity: mean **0.7863**, SD **0.0251**, median 0.7914,
  range 0.7379–0.8135
- Per-larva diagonal values: 0.7914, 0.8024, 0.7379, 0.7645, 0.8135, 0.8103, 0.7841
- Between-fish (off-diagonal, both triangles, n=42) similarity: mean **0.7089**,
  SD **0.0370**, median 0.7129, range 0.6261–0.7895
- Identification accuracy: **6 / 7 = 85.71 %**
- Whole-matrix range 0.6261–0.8135, mean 0.7199, SD 0.0447

The claims these support: FC patterns are individually stable across 24 h (within 0.79 >
between 0.71), and cross-session matching identifies the correct larva 85.7 % of the time.
One larva is misidentified — expect exactly one off-diagonal asterisk in the figure, and treat
it as a real feature of the data, not a bug.

## Pitfalls

- **The between-fish statistics here count each pair twice.** This script masks with
  `~np.eye(N)`, giving 42 off-diagonal values from 7 larvae, whereas
  `ns_ana-zebrafish-ca-mannwhitney-fingerprint_significance` uses the upper triangle and gets
  21. The mean and SD are identical because the matrix is symmetric, but the *n* differs — do
  not feed the 42-value set into a test that assumes independent observations.
- **Chance level is 1/7 ≈ 14 %, not 50 %.** With only 7 larvae the accuracy estimate is coarse:
  a single flip moves it by 14.3 percentage points. Report the count (6/7) alongside the
  percentage.
- **`argmax` ignores NaN handling.** If any similarity is NaN, `np.argmax` returns the NaN's
  index rather than the true maximum. The run had no NaNs, so this never fired; on noisier
  input use `np.nanargmax`.
- **The wildcard import is dead weight.** `from zebrafish_Ca_utils import *` resolves no symbol
  used anywhere in the script. The module is bundled and resolves fine, but it costs the whole
  `h5py`/`numba`/`bctpy`/`scikit-*` stack at import time for nothing — drop the two lines and
  the analysis needs only numpy and matplotlib.
- **The report rounds the matrix minimum to 0.63 and quotes the range as "0.63 to 0.81".**
  The stored value is 0.6260773788428466. Quote the statistics file, not the prose.
- Save the publication-ready figure as `figure_refine.png`; both bundled implementations compute identical numerical results.
  The figure critique found no real rendering fault, so the numbers are identical either way.

## Bundled files

- `scripts/reference_implementation.py` — the original run, verbatim.
- `scripts/refine_implementation.py` — identical apart from the output filename.
- `scripts/zebrafish_Ca_utils.py` — the vendored library module both scripts import (and then
  never use).
- `references/data_contract.md` — env vars, file shapes, artifact consumers, indexing.
- `references/method_details.md` — parameters, statistics, implementation requirements, and scientific interpretation.
