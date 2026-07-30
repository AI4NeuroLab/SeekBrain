# Method details — ns_ana-zebrafish-ca-cross_day_match-identity_fingerprint

## Contents

- [Full parameter list](#full-parameter-list)
- [Statistical approach](#statistical-approach)
- [Recorded statistics (`statistics.json`)](#recorded-statistics-statisticsjson)
- [Implementation requirements](#implementation-requirements)
- [Scientific conclusion supported](#scientific-conclusion-supported)
- [Output requirements](#output-requirements)
- [Related recipes](#related-recipes)


## Full parameter list

| Name | Value | Where | Effect |
|---|---|---|---|
| `k` | `1` | `vectorize_upper_triangle` → `np.triu_indices(n, k=1)` | Strict upper triangle. Excludes the unit diagonal, which is constant across larvae and would compress the between-larva spread. |
| dtype cast | `.astype(float)` | `vectorize_upper_triangle` | Guards against integer-typed input truncating during correlation. |
| minimum finite overlap | `3` | `safe_corrcoef` | Pairs with fewer than 3 jointly finite edges return NaN rather than a degenerate r. |
| NaN policy | pairwise-complete | `safe_corrcoef` | Each pair uses its own finite mask, so different cells of the similarity matrix may be computed over different edge subsets. |
| symmetrization | `0.5 * (S + S.T)` | after correlation | Averages the two temporal directions. Leaves the diagonal untouched. |
| symmetry assertion | `rtol=1e-5, atol=1e-8` | `np.allclose` | Sanity check; cannot fail by construction unless NaNs are present. |
| `cmap` | `'Reds'` | Display | White-to-red, as required. |
| `vmin`, `vmax` | `0.60`, `0.85` | Display | Values outside clip. Display only; does not affect saved data. |
| `aspect` | `'equal'` | Display | Square cells. |
| `figsize` | `(6, 5)` | Display | |
| colorbar | `fraction=0.046`, `pad=0.04`, label `"FC similarity"` fontsize 12 | Display | |
| asterisk | `'*'`, `color='white'`, `fontsize=14`, `fontweight='bold'`, `ha='center'`, `va='center'` | Display | Placed at `(argmax_col, row)` for every row. |
| tick labels | `np.arange(1, N+1)`, fontsize 10 | Display | 1-indexed larva IDs on both axes. |
| axis labels | `"Larvae"` on both x and y, fontsize 12 | Display | |
| `dpi` | `300` | Save | No `bbox_inches` argument. |
| seed | none | — | The analysis is fully deterministic; there is no randomization anywhere. |

## Statistical approach

**Similarity metric.** Pearson correlation between vectorized upper-triangular FC profiles.
Because both vectors are edge-weight profiles of the same parcellation, this is a profile
similarity, not a test statistic — it inherits the usual sensitivity of Pearson r to a few
extreme edges.

**Symmetrization.** `0.5 * (S + Sᵀ)` averages `corr(i@6dpf, j@7dpf)` with
`corr(j@6dpf, i@7dpf)`. This removes the arbitrary choice of which animal is "the reference".
Note the consequence: diagonal entries are *not* averages of two different quantities —
`S[i,i]` is its own mirror — so intra-individual values are raw cross-day correlations while
off-diagonal values are two-sample means. Their sampling variance therefore differs slightly.

**Identification rule.** Winner-take-all nearest-neighbour: larva *i* is identified correctly
if `argmax_j S_sym[i, j] == i`. Chance level is 1/N = 14.3 % for N = 7. No permutation null is
computed here; the significance of the intra/inter gap is tested separately in
`ns_ana-zebrafish-ca-mannwhitney-fingerprint_significance`.

**No multiple-comparison correction, no confidence interval.** With N = 7 the accuracy has a
binomial standard error of roughly 13 percentage points. Treat 85.7 % as "most larvae, with
one failure", not as a precise rate.

**Off-diagonal sample definition.** `~np.eye(N)` counts each unordered pair twice (n = 42).
Descriptive statistics are unaffected by the duplication (mean and SD are identical to the
21-value upper-triangle set) but any inferential use would be wrong.

## Recorded statistics (`statistics.json`)

Verbatim from the original run:

```json
{
  "n_subjects": 7,
  "n_regions": 116,
  "within_fish_similarity": {
    "mean": 0.7862941005559134,
    "std": 0.0251474450558873,
    "median": 0.7914154428816852,
    "min": 0.7378933978784515,
    "max": 0.8134632833933269,
    "values": [
      0.7914154428816852,
      0.8024168117803744,
      0.7378933978784515,
      0.7644543518586793,
      0.8134632833933269,
      0.8103341544363768,
      0.7840812616624998
    ]
  },
  "between_fish_similarity": {
    "mean": 0.7088560905264988,
    "std": 0.03704653510522762,
    "median": 0.712865855049948,
    "min": 0.6260773788428466,
    "max": 0.7895338434565122,
    "n_values": 42
  },
  "diagonal_accuracy": {
    "correct_identifications": 6,
    "accuracy": 0.8571428571428571
  },
  "similarity_matrix_range": {
    "min": 0.6260773788428466,
    "max": 0.8134632833933269,
    "mean": 0.7199186633878437,
    "std": 0.044732618877988795
  }
}
```

Both the base and the refine script write this identical dictionary — the refine pass changed
nothing about the computation.

Note `similarity_matrix_range.mean` = 0.7199 is over the **whole** matrix including the
diagonal, so it sits between the within-fish (0.786) and between-fish (0.709) means. It is not
comparable to either group directly.

The maximum of `between_fish_similarity` (0.7895) exceeds the minimum of
`within_fish_similarity` (0.7379) — the two distributions overlap. That overlap is exactly the
single misidentification.

## Implementation requirements

Apply the following two lines only implementation requirements:

```diff
-# Save figure
-figure_path = os.path.join(SAVE_DIR, "figure.png")
+# Save figure (refined name)
+figure_path = os.path.join(SAVE_DIR, "figure_refine.png")
```

Visual inspection found no rendering defect but identified the output
filename and noted an ambiguity in the required configuration — the spec mandated a y-axis label `"Larvae"`
and, through a typo (a stray double comma), left the x-axis label unspecified. The refine pass
deliberately **kept** the x-axis label for readability.

**Either script produces identical numbers.** Prefer the refine script only if you want the
`figure_refine.png` filename; otherwise they are interchangeable. This is unusual in this
dataset, where most refine passes fix a real defect.

## Scientific conclusion supported

From `conclusions.json`:

> The functional connectivity patterns of zebrafish larvae exhibit significant individual
> stability over a 24-hour interval (6dpf to 7dpf), with the mean within-subject correlation
> (r ≈ 0.79) exceeding the mean between-subject correlation (r ≈ 0.71).

> Cross-session matching of functional connectivity matrices allows for the identification of
> individual larvae with 85.7% accuracy (6 out of 7 subjects), demonstrating that whole-brain
> network organization contains robust subject-specific features.

The report adds an interpretation worth carrying: the single misidentification indicates that
while the functional connectome is generally stable, noise or rapid developmental
reorganization can occasionally confound fingerprinting at this age.

## Output requirements

Figure 6×5 in. `imshow` of the 7×7 symmetric similarity matrix, `cmap='Reds'`,
`vmin=0.60`, `vmax=0.85`, `aspect='equal'`. Colorbar on the right (`fraction=0.046`,
`pad=0.04`) labelled `FC similarity` at fontsize 12. A bold white asterisk (`fontsize=14`,
centred) is drawn at the column of the row maximum for every row — on the diagonal for the 6
correctly identified larvae, off-diagonal for the one failure. Ticks at every larva on both
axes, labelled 1…7 at fontsize 10. Both axes labelled `Larvae` at fontsize 12.
`plt.tight_layout()`, saved at 300 dpi.

The intended read: a visibly darker diagonal with asterisks sitting on it is the evidence for
identifiability; the off-diagonal asterisk is the one failure.

## Related recipes

- `ns_ana-zebrafish-ca-mannwhitney-fingerprint_significance` — the sibling run. Same steps 1–4,
  same `Figure1_FC_fingerprinting.npy`, then splits the matrix into intra (diagonal) and inter
  (upper triangle) groups and runs a Mann-Whitney U test. Use it for the p-value and the
  boxplot; use this recipe for the accuracy and the heatmap.
- `ns_ana-zebrafish-ca-pearson-fc_matrix` — builds FC matrices for the *other* cohort
  (22 larvae, 65 regions, single session). Its outputs are not inputs here.
- `ns_ana-zebrafish-ca-triu_pearson-network_stereotypy` — the complementary question: how
  *similar* larvae are to each other, rather than how distinguishable.
