# Method details — ns_ana-zebrafish-ca-mannwhitney-fingerprint_significance

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
| `ROOT_DIR` | `<data-root>` | module constant | Hard-coded input root; not overridable without editing the source. Dead mount. |
| `k` | `1` | `vectorize_upper_triangle` → `np.triu_indices(116, k=1)` | Strict upper triangle, 6670 edges per larva. Excludes the constant unit diagonal. |
| minimum finite overlap | `3` | inline in the correlation loop | Pairs with fewer than 3 jointly finite edges become NaN. |
| NaN policy | pairwise-complete | inline | Each cell uses its own finite mask. |
| symmetrization | `(S + S.T) / 2` | after correlation | Averages the two temporal directions; leaves the diagonal untouched. |
| intra extraction | `np.diag(...)` | group split | n = 7. |
| inter extraction | `np.triu_indices(n_larvae, k=1)` | group split | n = 21, each unordered pair once. |
| finite filter | `np.isfinite` | before test and plot | Applied to the *copies used for statistics*; the saved `.npy` vectors are unfiltered. |
| test | `mannwhitneyu` | `scipy.stats` | Two-sample rank-sum test. |
| `alternative` | `'two-sided'` | `mannwhitneyu` | Conservative; the directional hypothesis would justify one-sided. |
| `np.random.seed` | `42` | before jitter | Reproducible scatter jitter only. No statistic depends on it. |
| jitter distribution | `np.random.normal(0, 0.02, n)` | Display | Added to base x positions 0.5 and 1.0. |
| scatter | `s=20`, `alpha=0.6`, `edgecolors='none'`, blue (intra) / red (inter) | Display | |
| boxplot positions | `[0.5]`, `[1.0]` | Display | Two separate `ax.boxplot` calls, one per group, so each can take its own colour. |
| boxplot `widths` | `0.2` | Display | |
| boxplot `whis` | `[0, 100]` | Display | Whiskers at the 0th and 100th percentile, i.e. true min to true max, as specified. |
| boxplot `showfliers` | `False` | Display | Nothing can be an outlier given `whis=[0,100]`; the flag is belt-and-braces. |
| boxplot `patch_artist` | `True` with `facecolor='none'` | Display | Patch created but transparent — the "no fill" requirement. |
| box/whisker/cap colour | blue (intra), red (inter), `linewidth=1.2` | Display | |
| median line | black, `linewidth=1.5` | Display | |
| `xlim` | `(0.2, 1.3)` | Display | |
| `ylim` | `(0.6, 0.85)` | Display | Values outside would be clipped without warning. |
| `yticks` | `np.arange(0.6, 0.86, 0.05)` | Display | 0.60, 0.65, 0.70, 0.75, 0.80, 0.85. |
| y-label | `"FC similarity"`, fontsize 12 | Display | |
| x-ticklabels | base: `["intra-individual", "inter-individual"]`; refine: `["intra-\nindividual", "inter-\nindividual"]`, fontsize 10 | Display | The refine change — see below. |
| x tick marks | `length=0` | Display | Removes the tick marks, keeps the labels. |
| annotation bracket | base `y_pos = 0.83`, text at `y_pos + 0.005`; refine `y_line = 0.83`, `y_text = 0.832` | Display | Cosmetically equivalent (0.835 vs 0.832). |
| annotation text | `f'p={pval:.2e}\nMann-Whitney U'`, fontsize 9, centred at x = 0.75 | Display | |
| `figsize` | `(3, 5)` | Display | The narrow width is the direct cause of the label overlap. |
| `dpi`, `bbox_inches` | `300`, `'tight'` | Save | |

## Statistical approach

**Test.** Two-sided Mann-Whitney U (Wilcoxon rank-sum) comparing 7 intra-individual similarity
values against 21 inter-individual values. A rank test rather than a t-test because n = 7 makes
any normality check unfalsifiable and because the two groups have different sampling structure
(see below) — ranks are the weaker, safer assumption.

**What the U statistic means here.** U = 142 out of a maximum of 7 × 21 = 147. The statistic
counts intra/inter pairwise comparisons won by the intra group, so 142/147 comparisons favour
self-similarity. The five losses correspond to the overlap between the distributions — the
maximum inter value (0.7895 in the sibling run's statistics) exceeds the minimum intra value
(0.7379), which is the same overlap that produces the single misidentification in
`ns_ana-zebrafish-ca-cross_day_match-identity_fingerprint`.

**Independence assumption is violated.** All 28 values are derived from the same 7 larvae. Each
larva contributes 1 intra value and appears in 6 of the 21 inter values, so the inter group is
internally dependent and the two groups are not independent of each other. Mann-Whitney assumes
independent observations within and between groups. The consequence is an anticonservative
p-value: the true evidence is weaker than 3.2 × 10⁻⁵ suggests. A permutation test that
reshuffles larva identity labels across days and recomputes the intra/inter split would be the
correct null. That was not done in this run. Report the p-value with the caveat attached rather
than as an exact type-I error rate.

**Directionality.** `alternative='two-sided'` was used although the hypothesis (intra > inter)
is directional. The one-sided p would be half the reported value. The stored number is
two-sided; do not silently convert.

**Group sampling variance differs.** Symmetrization averages `S[i,j]` with `S[j,i]` for
off-diagonal cells, but `S[i,i]` is its own mirror. Intra values are therefore raw single
correlations while inter values are means of two correlations, which mildly reduces the inter
group's variance relative to the intra group's. Visible in the numbers only as a second-order
effect (intra SD 0.025 vs inter SD 0.037 — the inter group is still more variable, driven by
genuine between-animal heterogeneity).

## Recorded statistics (`statistics.json`)

Verbatim from the stored file (written by the **refine** script):

```json
{
  "intra_individual": {
    "n": 7,
    "mean": 0.7862941005559134,
    "std": 0.0251474450558873
  },
  "inter_individual": {
    "n": 21,
    "mean": 0.7088560905264989,
    "std": 0.03704653510522762
  },
  "statistical_test": {
    "method": "Mann-Whitney U test",
    "p_value": 3.209351035437992e-05
  }
}
```

The **base** script writes a larger dictionary, which is *not* what is stored:
`n_larvae`, `n_regions`, and for each group `n_samples` (not `n`), `mean`, `median`, `std`,
`min`, `max`, `percentile_25`, `percentile_75`, plus `test_statistic` and `alternative` in the
test block.


```
Loaded FC matrices: 7 larvae, 116 regions
Intra-individual similarity: n=7, mean=0.786
Inter-individual similarity: n=21, mean=0.709
Mann-Whitney U test: U=142.00, p=3.21e-05
```

`np.std` is used, i.e. the population standard deviation (`ddof=0`), not the sample SD. With
n = 7 the difference is not negligible — the sample SD of the intra group would be
0.0251 × √(7/6) ≈ 0.0272. The report quotes "±0.03" either way.

Note the intra mean here (0.7862941005559134) and the sibling recipe's
`within_fish_similarity.mean` (0.7862941005559134) are bit-identical; the inter means differ
only in the last digit (…4989 vs …4988) because one averages 21 values and the other 42.

## Implementation requirements

Apply the following implementation requirements (four substantive ways:

1). **Drops the `sys.path` line and `from zebrafish_Ca_utils import *`.** Nothing was used from
   that import. The module itself is vendored into `scripts/` and resolves fine in the base
   script, but dropping it also sheds the module's own heavy third-party dependencies at load
   time. The refine script still hard-codes `ROOT_DIR` under the dead mount for *data*, so it
   is dependency-light but not yet path-free.
2. **X-tick labels split across two lines** — `"intra-\nindividual"`, `"inter-\nindividual"`.
   This is the actual fix: in the 3-inch-wide figure the two single-line labels, centred at
   x = 0.5 and x = 1.0, overlapped each other.
3. **Statistics dict trimmed** from the full base version to the nine fields above; the
   `test_statistic` and `alternative` fields are lost.
4. Removed progress prints and intermediate `intra_median` / `inter_median` / `intra_std` /
   `inter_std` locals; the annotation bracket uses two named y positions instead of one plus
   an offset (0.832 vs 0.835 — cosmetic).

The computation, the p-value, and the saved `.npy` artifacts are unchanged.
**Use the refine script.**

## Scientific conclusion supported

From `conclusions.json`:

> Intra-individual functional connectivity similarity in zebrafish larvae across a 24-hour
> interval (6 dpf to 7 dpf) is significantly higher (mean correlation ≈ 0.79) than
> inter-individual similarity (mean correlation ≈ 0.71; Mann-Whitney U test, p < 0.001),
> indicating that functional network patterns possess stable, individual-specific features
> sufficient for biological fingerprinting.

The report's added interpretation: individual variability in the functional connectome exceeds
measurement noise and temporal drift, which is what licenses longitudinal designs that track
the same larva across development or drug exposure.

## Output requirements

Figure 3×5 in — deliberately narrow, a two-group comparison panel. Jittered scatter of every
data point (intra blue at x ≈ 0.5, inter red at x ≈ 1.0; s=20, alpha=0.6, Gaussian jitter
σ=0.02, seed 42) with an unfilled boxplot of width 0.2 drawn over each group. Whiskers span
min to max (`whis=[0, 100]`), caps and box edges take the group colour, median line black.
X-limits (0.2, 1.3); y-limits (0.6, 0.85) with ticks every 0.05; y-label `FC similarity`.
X-ticks at 0.5 and 1.0 labelled `intra-\nindividual` and `inter-\nindividual`, tick marks
suppressed. A black horizontal bracket at y = 0.83 spans the two groups, with
`p=3.21e-05` and `Mann-Whitney U` annotated above it at fontsize 9. `plt.tight_layout()`,
saved at 300 dpi with `bbox_inches='tight'`.

Known rendering failure: the base script's single-line x-labels overlapped horizontally at this
figure width. Fixed in the refine script by splitting them onto two lines.

## Related recipes

- `ns_ana-zebrafish-ca-cross_day_match-identity_fingerprint` — the sibling run. Same steps 1–4
  and the same `Figure1_FC_fingerprinting.npy`, then computes winner-take-all identification
  accuracy (6/7 = 85.7 %) and draws the similarity heatmap with asterisks. Use it for the
  accuracy and the heatmap; use this recipe for the p-value and the boxplot. This recipe is the
  superset in artifacts — it also writes the SameLarva and DiffLarva vectors.
- `ns_ana-zebrafish-ca-pearson-fc_matrix` — FC matrices for the *other* cohort (22 larvae,
  65 regions, single session). Not an input here.
- `ns_ana-zebrafish-ca-triu_pearson-network_stereotypy` — the mirror-image question: how
  consistent the network is *across* larvae, rather than how distinguishable they are.
