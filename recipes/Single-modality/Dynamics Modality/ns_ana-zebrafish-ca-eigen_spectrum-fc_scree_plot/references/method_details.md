# Method details — ns_vis-zebrafish-ca-eigen_spectrum-fc_scree_plot

## Contents

- [Full parameter list](#full-parameter-list)
- [Statistical approach and assumptions](#statistical-approach-and-assumptions)
- [Recorded statistics (`statistics.json`)](#recorded-statistics-statisticsjson)
- [Implementation requirements](#implementation-requirements)
- [Scientific conclusion supported](#scientific-conclusion-supported)
- [Output requirements](#output-requirements)


## Full parameter list

| Name | Value | Where | Effect |
|---|---|---|---|
| flatten guard | `if eigenvalues.ndim > 1: eigenvalues.flatten()` | load | Accepts a column vector as well as a 1-D array. |
| minimum size | `assert eigenvalues.size >= 50` | load | The axis limits, the `[1, 50]` ticks and the statistics slice all assume ≥ 50 values. |
| x coordinate | `np.arange(1, n+1)` | plot | 1-based gradient numbering; array index `k` is gradient `k+1`. |
| points plotted | all `n` = 64 | plot | No subsetting. The tail is hidden by `xlim`, not removed. |
| statistics slice | `eigenvalues[:50]` | statistics | Every summary field except `n_eigenvalues` is over the first 50. |
| `color` | `'black'` | `ax.plot` | |
| `linewidth` | `1` | `ax.plot` | |
| `marker` | `'.'` | `ax.plot` | The spec said "marker size 1"; `'.'` at size 1 is essentially invisible — the line carries the shape. |
| `markersize` | `1` | `ax.plot` | |
| `xlim` | `[-1, 51]` | axes | Frames indices 1–50 with padding on both sides. |
| `ylim` bottom | `-0.05` | axes | Top autoscales (≈ 0.37 here). The fixed bottom keeps the negative plateau on screen; autoscaling both ends would still show it, but the spec pinned it so the panel is comparable across runs. |
| `xticks` | `[1, 50]` | axes | End labels only. No y tick control in the base script. |
| top / right spines | hidden | axes | `ax.spines['top'].set_visible(False)`, same for `'right'`. |
| `figsize` | `(5, 5)` | `plt.subplots` | |
| `dpi` | `300`, `bbox_inches='tight'` | `savefig` | Preceded by `plt.tight_layout()`. |
| x/y label fontsize | `14` | refine only | |
| tick labelsize | `12` (major, both axes) | refine only | |
| y major formatter | `FormatStrFormatter('%.2f')` | refine only | Forces two decimals on the y ticks. |
| x minor locator | `AutoMinorLocator()` | refine only | Adds unlabeled minor ticks so a reader can estimate indices between 1 and 50. |

No seed, no threshold on the data itself, no permutations, no smoothing. The only "thresholds"
in the script are the 0.5 / 0.8 / 0.9 variance cut-offs in the statistics block, which are
degenerate — see below.

## Statistical approach and assumptions

**What the panel shows.** A scree plot: eigenvalue magnitude against component rank for the
diffusion-map embedding of the group-average functional connectivity matrix. The visual claim
is about the *shape* of the curve — one dominant mode, a steep fall over roughly five
components, then a long shallow tail. Reading a cutoff off a scree plot is an eyeball
("elbow") criterion, not a test; no significance testing happens anywhere in this recipe.

**Descriptive statistics.** Mean, std (`np.std`, population, ddof=0), median, min, max and the
25th/75th percentiles of `eigenvalues[:50]`. These are legitimate and reproducible.

**The variance-ratio computation is invalid on this spectrum.** The code does:

```python
cumulative_sum = np.cumsum(first_50_eigenvalues)
total_variance = cumulative_sum[-1]
explained_variance_ratios = cumulative_sum / total_variance if total_variance > 0 else np.zeros_like(cumulative_sum)
```

`total_variance` is **-0.18950917979886378**. The `total_variance > 0` test fails, so
`explained_variance_ratios` becomes an array of 50 zeros. Every reported cumulative value is
then exactly 0.0, and the threshold search

```python
idx = np.where(explained_variance_ratios >= thresh)[0]
gradients_for_thresholds[...] = int(idx[0] + 1) if len(idx) > 0 else n_eigenvalues
```

finds no index satisfying 0.5, 0.8 or 0.9 and falls back to `n_eigenvalues` = 64 for all
three. The three identical 64s are a fallback, not a measurement.

**Why the guard was needed in the first place — the real issue.** "Proportion of variance
explained" is defined for a decomposition whose components are non-negative and sum to the
total variance: PCA of a covariance matrix, where the operator is positive semi-definite and
every eigenvalue is ≥ 0. The diffusion-map operator applied to this connectivity matrix is not
PSD, and its spectrum genuinely contains negative eigenvalues (median of the first 50 is
-0.0225; the SC spectrum in Figure 6B goes down to -0.187). With mixed signs:

- the cumulative sum is not monotonic, so "the first k components explain X%" has no ordering;
- the total can be near zero, making the ratio explode, or negative, flipping every sign;
- individual ratios can exceed 1 or fall below 0.

There is no repair inside the ratio framework. If a dimensionality number is needed from this
spectrum, use one of: the count of positive eigenvalues; a variance ratio computed over the
positive part only (stating that restriction); or an eigenvalue-gap / elbow criterion. Whichever
is chosen must be named explicitly, because the three give different answers.

## Recorded statistics (`statistics.json`)

The stored file, verbatim:

```json
{
  "n_eigenvalues": 64,
  "first_50_eigenvalues": {
    "mean": -0.0037901835959772735,
    "std": 0.0632993735352399,
    "median": -0.022501738906728207,
    "min": -0.03217482330671227,
    "max": 0.36940420879703423,
    "percentile_25": -0.026346463558178577,
    "percentile_75": -0.012901940933550227
  },
  "eigenvalue_1": 0.36940420879703423,
  "eigenvalue_50": -0.03217482330671227,
  "decay_ratio_50_to_1": -0.08709923314487852,
  "total_variance_first_50": -0.18950917979886378,
  "cumulative_variance_explained": {
    "gradient_10": 0.0,
    "gradient_20": 0.0,
    "gradient_30": 0.0,
    "gradient_50": 0.0
  },
  "gradients_for_variance_thresholds": {
    "gradients_for_50pct_variance": 64,
    "gradients_for_80pct_variance": 64,
    "gradients_for_90pct_variance": 64
  }
}
```

`exec_refine.log` print the same key findings — so the stored file is the same either way.

Field-by-field guidance:

| Field | Trustworthy? | Note |
|---|---|---|
| `n_eigenvalues` | yes | 64 = `min(64, 65-1)` components from the 65-region FC matrix |
| `first_50_eigenvalues.*` | yes | Plain descriptives on `eigenvalues[:50]`; `std` is population (ddof=0) |
| `eigenvalue_1` | yes | 0.36940, the spectrum maximum |
| `eigenvalue_50` | yes | -0.032175, which is also `min` of the first 50 — the spectrum is monotonically decreasing over this range |
| `decay_ratio_50_to_1` | misleading | -0.0871. Numerator is negative, so the sign reports a zero-crossing, not a decay magnitude. Quote the two eigenvalues instead. |
| `total_variance_first_50` | yes as a number, not as "variance" | -0.1895. Useful only as the diagnostic that explains the two blocks below. |
| `cumulative_variance_explained` | **no** | All 0.0 by the `else np.zeros_like(...)` branch |
| `gradients_for_variance_thresholds` | **no** | All 64 by the `else n_eigenvalues` fallback |

Also note: the spectrum crosses zero around gradient 8–9 in the rendered figure, so roughly
the first eight components are positive and everything after is a shallow negative plateau
running down to -0.032 at index 50.

## Implementation requirements

Apply the following implementation requirements (exactly four cosmetic ways, all
identified during visual inspection:

1). Axis label `fontsize=14` and `tick_params(labelsize=12)` — the defaults were small for a
   5×5 in panel.
2. `ax.xaxis.set_minor_locator(AutoMinorLocator())` — with major ticks only at 1 and 50 there
   was no way to estimate an intermediate index.
3. `ax.yaxis.set_major_formatter(FormatStrFormatter('%.2f'))` — consistent decimal precision.
4. Output renamed to `figure_refine.png`; the extra `from matplotlib.ticker import ...` line.

The load, the assertions, the plotted data, and the entire statistics block are unchanged.
**Prefer the refine script** — it is strictly more legible and produces identical numbers.
Neither script imports anything from the custom library — this recipe bundles no library modules
at all — so both run as-is given the input `.npy`.

## Scientific conclusion supported

From `conclusions.json`:

> The eigenvalue spectrum of the functional connectivity gradients exhibits a rapid decay
> pattern, with the first gradient displaying a substantially higher value (approximately 0.37)
> compared to subsequent components, indicating that the primary variance in functional network
> organization is concentrated within the first few dimensions.

The first two clauses are supported directly by the curve and by `eigenvalue_1` = 0.3694. The
final clause — "primary variance ... concentrated within the first few dimensions" — is the
part to handle carefully: with a mixed-sign spectrum, "proportion of variance" is not defined,
and the run's own attempt to quantify it produced the degenerate fields above. State the claim
as a statement about eigenvalue magnitude and curve shape, not about variance accounting.

The same caution applies to `analytical_report.md`, which says "the majority of the variance is
captured by the first few gradients". The report and the code disagree on whether that quantity
exists; the code is right, and it says it does not.

## Output requirements

Square figure, 5×5 in. Single black line, `linewidth=1`, `marker='.'` at `markersize=1`,
plotting all 64 eigenvalues against 1-based gradient index. X-axis limited to `[-1, 51]` with
ticks only at `[1, 50]`, labelled `Gradient #`. Y-axis bottom pinned at `-0.05`, top
autoscaling (≈ 0.37), labelled `Eigenvalue`, formatted to two decimals in the refine version.
Top and right spines hidden. No title, no legend, no grid. `tight_layout()`, saved at 300 dpi
with `bbox_inches='tight'`.

The resulting curve: a single high point at gradient 1 (0.369), a steep drop through gradients
2–5, a zero crossing near gradient 8–9, then a shallow negative tail reaching -0.032 at
gradient 50.

The known rendering complaints were small fonts, no intermediate x guidance, and ragged y tick
precision — all addressed in the refine script.
