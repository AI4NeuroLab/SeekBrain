# Method details — ns_seg-zebrafish-ca-tsne_hdbscan-brain_state_cluster

## Contents

- [Full parameter list](#full-parameter-list)
- [Statistical approach and assumptions](#statistical-approach-and-assumptions)
- [Recorded statistics (`statistics.json`)](#recorded-statistics-statisticsjson)
- [Implementation requirements](#implementation-requirements)
- [Scientific conclusion supported](#scientific-conclusion-supported)
- [Output requirements](#output-requirements)
- [Relationship to `ns_vis-zebrafish-ca-tsne_embedding-state_cluster_scatter`](#relationship-to-nsvis-zebrafish-ca-tsneembedding-stateclusterscatter)


## Full parameter list

| Name | Value | Where | Effect |
|---|---|---|---|
| `n_components` | `2` | `TSNE` | Embedding dimensionality. HDBSCAN runs on this, so it also fixes the clustering space |
| `perplexity` | `30` | `TSNE` | Effective number of neighbours, ≈12% of the 244 events. Below ~10 the map fragments into many small islands; above ~50 the two minority clusters merge into the dominant one |
| `learning_rate` | `'auto'` | `TSNE` | sklearn ≥1.2 computes `max(N / early_exaggeration / 4, 50)` = `max(244/12/4, 50)` = 50 here. sklearn <1.2 defaulted to 200. A silent version-dependent parameter |
| `init` | `'random'` | `TSNE` | Not the `'pca'` default of recent sklearn. Random initialisation makes the embedding fully seed-determined, with no deterministic anchor |
| `random_state` | `420` | `TSNE` | The single most consequential number in this recipe. See "Seed dependence" below |
| `min_cluster_size` | `10` | `hdbscan.HDBSCAN` | Minimum members for a group to count as a cluster. The smallest surviving cluster has 17 events after reassignment but only 16 before it, so this threshold is close to binding |
| all other HDBSCAN args | defaults | `hdbscan.HDBSCAN` | `min_samples=None` (falls back to `min_cluster_size`), `metric='euclidean'`, `cluster_selection_method='eom'`, `alpha=1.0` |
| noise-reassignment metric | Pearson `r` | `scipy.stats.pearsonr` | Computed in the original 120-D region space against cluster centroids |
| centroid definition | `events_T[mask].mean(axis=0)` | inline | Arithmetic mean of member events over the 120 regions; computed from the **pre-reassignment** membership, so reassignment is single-pass and non-iterative |
| relabelling | `np.argsort(-counts)` | inline | Descending size; produces labels 0, 1, 2 |
| sort for display | `np.argsort(labels, kind='stable')[::-1]` | inline, refine only | Base script omits `kind='stable'` |
| `np.fill_diagonal(corr, 0)` | present in base, removed in refine | inline | Display artefact; does not affect statistics |
| `cmap` | `'gray'` | `imshow` | |
| `vmin`, `vmax` | `-0.2`, `0.5` | `imshow` | Values outside clip. The unit diagonal clips to white |
| `aspect` | `'equal'` | `imshow` | |
| `interpolation` | `'nearest'` | `imshow` | Present in both scripts; prevents smoothing across event boundaries |
| `figsize` | `(8, 8)` | `plt.subplots` | |
| `dpi` | `300` | both `plt.subplots` and `savefig` | |
| colorbar | `fraction=0.046`, `pad=0.04`, label rotated 270°, `labelpad=20` | `plt.colorbar` | |

## Statistical approach and assumptions

**t-SNE.** A non-linear neighbour-embedding method. It optimises a KL divergence between
neighbour distributions in the 120-D and 2-D spaces, which preserves *local* neighbourhood
structure and explicitly does not preserve global distances, cluster sizes, or inter-cluster
gaps. Consequences that matter for how these results may be read:

- The distance between two clusters in the scatter carries no quantitative meaning.
- The apparent tightness of a cluster is not its variance in the data.
- The method will produce visually separated clusters from data with no cluster structure at
  all, so the embedding alone is not evidence that discrete states exist.

The block-diagonal structure in the *correlation matrix* is the actual evidence here, because
it is computed in the original space and is independent of the embedding. That is why this
figure — rather than the 4D scatter — is the load-bearing panel for the "discrete states"
claim.

**HDBSCAN.** Density-based hierarchical clustering. It chooses the number of clusters itself
from the condensed cluster tree, which is why no `k` is specified. It is run on the 2-D
embedding rather than the 120-D data because density estimation in 120 dimensions with 244
points is hopeless — the sample is far too sparse for any mutual-reachability distance to be
informative. The trade-off is explicit: better-behaved density estimation, at the price of
clustering a distorted space.

**Noise reassignment.** HDBSCAN's `-1` label means "not in a dense region", not "unlike every
cluster". 35 of 244 events (14.3%) were labelled noise. Rather than discard them, each is
assigned to `argmax_c pearsonr(event, centroid_c)`. Two properties of this step are worth
stating:

1. It is done in the **original 120-D space**, not in the embedding. This is the defensible
   choice. An embedding distance would just be asking "which blob did t-SNE happen to place
   you near", whereas Pearson r over the 120 regional amplitudes asks the biological question
   — does this event have the same *spatial pattern* as that state? Correlation is also
   amplitude-invariant, so a weak event with the right pattern is assigned correctly rather
   than being pulled toward whichever centroid has the smallest norm.
2. It is single-pass and greedy. Centroids are computed once from the pre-reassignment
   membership and never updated, so this is not a k-means-style iteration to convergence. The
   result therefore depends on the initial HDBSCAN partition and is not a fixed point.

Every event ends up assigned; there is no "unclassified" outcome. That is a modelling
decision, not a discovery — the report's framing that reassignment "validated" the outliers is
too strong, since the procedure cannot fail to assign anything.

**No significance testing.** This recipe contains no null model and no p-value. The claim that
three states exist is descriptive. The upstream event detection
(`ns_ana-zebrafish-ca-circular_null-cofluctuation_event`) is where the circular-shift null
lives; the *existence* of the events is tested there, the *number of states* is not tested
anywhere.

### Seed dependence

Both t-SNE and HDBSCAN-on-t-SNE are seed-sensitive, and they compound: a different
`random_state` produces a different embedding, and HDBSCAN's cluster count is read off that
embedding's density landscape. The observed 3-cluster, 171/56/17 partition is a property of
`random_state=420` applied to this data, not a measured quantity. Treat it as a regression
fingerprint for reproducing this exact run and nothing more. A cluster-count claim that would
survive review needs a stability analysis over seeds (and ideally over perplexity), which this
run did not perform.

## Recorded statistics (`statistics.json`)

Verbatim from the original run:

```json
{
  "n_events": 244,
  "n_regions": 120,
  "n_clusters": 3,
  "cluster_sizes": {
    "mean": 81.33333333333333,
    "std": 65.37243727715493,
    "min": 17,
    "max": 171,
    "median": 56.0
  },
  "cluster_distribution": {
    "cluster_0": {
      "count": 171,
      "fraction": 0.7008196721311475
    },
    "cluster_1": {
      "count": 56,
      "fraction": 0.22950819672131148
    },
    "cluster_2": {
      "count": 17,
      "fraction": 0.06967213114754098
    }
  },
  "correlation_matrix": {
    "mean": 0.14528949240557487,
    "std": 0.33998314861523504,
    "median": 0.1831274953397065,
    "min": -0.6601484298674203,
    "max": 0.9218118864320207,
    "percentile_25": -0.14439238799949533,
    "percentile_75": 0.43173474471090356
  },
  "tsne_embedding": {
    "shape": [
      244,
      2
    ],
    "x_range": [
      -14.52338695526123,
      13.179131507873535
    ],
    "y_range": [
      -15.345494270324707,
      16.107091903686523
    ]
  }
}
```

Both scripts build this dict identically and write it to the same path, so the base and refine
runs produce byte-equivalent statistics. In particular the `correlation_matrix` block is
unaffected by the base script's `np.fill_diagonal(corr_matrix, 0)`, because the values are
drawn from `np.triu_indices(n_events, k=1)`, which already excludes the diagonal.

### Intermediate counts not in `statistics.json`


- HDBSCAN raw labels and counts: `-1: 35`, `0: 16`, `1: 46`, `2: 147`
- after reassignment (still in HDBSCAN's numbering): `0: 17`, `1: 56`, `2: 171`
- after size-based relabelling: `0: 171`, `1: 56`, `2: 17`

So HDBSCAN's cluster 2 becomes label 0, cluster 1 becomes label 1, and cluster 0 becomes
label 2. All 35 noise points were absorbed: 1 into HDBSCAN-cluster 0, 10 into cluster 1, and
24 into cluster 2.

## Implementation requirements

Apply the following implementation requirements (exactly two substantive ways,
both identified during visual inspection:

1). **`np.fill_diagonal(corr_matrix, 0)` removed.** The base script zeroed self-correlations,
   which was never in the spec. With `vmin=-0.2, vmax=0.5` a value of 0 renders as mid-grey
   while the true value of 1.0 would clip to white — so the base figure shows a dark diagonal
   stripe that a reader would misread as anticorrelation. The refine script keeps the
   diagonal.
2. **`kind='stable'` added to `np.argsort`.** With 244 events and only 3 distinct label
   values, the sort is almost entirely ties. An unstable sort permutes events arbitrarily
   within each cluster, destroying any index-ordered (i.e. temporal) substructure inside a
   state. Stable sorting preserves the detection order.

Everything else is renamed comments, removed progress prints, and `figure.png` →
`figure_refine.png`.

**Use the refine script.** The analysis and the saved artifacts are identical between the two;
only the figure differs, and the refine version is the correct one.

## Scientific conclusion supported

From `conclusions.json`:

> The pairwise Pearson correlation matrix of 244 high-amplitude coactivation events exhibits a
> clear block-diagonal structure, demonstrating that spontaneous brain activity segregates
> into discrete, recurring spatial patterns characterized by high intra-state similarity.

> Clustering analysis identifies three distinct functional states within the high-amplitude
> coactivation events, with a single dominant cluster comprising approximately 70% of the
> events, indicating a stable and non-random organization of the brain's temporal dynamics.

The first is well supported — block structure in the correlation matrix is computed in the
original space and does not depend on t-SNE. The second inherits the seed dependence
described above; "three" is what this seed gave.

## Output requirements

Square figure, 8×8 in, 300 dpi. A single `imshow` of the 244×244 event-by-event Pearson
correlation matrix, rows and columns permuted by `argsort(cluster_labels, kind='stable')[::-1]`
so events of the same state are contiguous and the largest cluster occupies the bottom-right
block. `cmap='gray'`, `vmin=-0.2`, `vmax=0.5`, `aspect='equal'`, `interpolation='nearest'`.

Vertical colorbar on the right, `fraction=0.046`, `pad=0.04`, labelled `Correlation` rotated
270° with `labelpad=20`. Y-axis labelled `Coactivation events`, y ticks only at positions
`[0, 243]` labelled `[1, 244]`. X ticks removed entirely (`ax.set_xticks([])`); no x label.
Saved with `bbox_inches='tight'`.

The known rendering failures were the zeroed diagonal and the unstable sort; see Pitfalls in
`RECIPE.md`.

## Relationship to `ns_vis-zebrafish-ca-tsne_embedding-state_cluster_scatter`

The two runs are near-duplicates. Identical input, identical t-SNE parameters, identical seed,
identical HDBSCAN parameters, identical noise-reassignment logic, identical size-based
reordering — and they write the same two artifact filenames. They diverge in exactly two
places:

| | 4C (this recipe) | 4D (scatter recipe) |
|---|---|---|
| Figure | sorted 244×244 event correlation heatmap | 2-D t-SNE scatter, one colour per cluster |
| Label base | 0-based `{0, 1, 2}` | 1-based `{1, 2, 3}` |
| `statistics.json` | correlation-matrix and cluster-size summaries | per-cluster embedding centroid/std/median |
| Env var guard | none (`TypeError` on unset) | explicit `ValueError` on unset |
| Input existence check | none | `FileNotFoundError` if missing |

Pick one. Running both recomputes the same embedding (same seed, so identical coordinates) but
leaves whichever ran last in control of the label vector on disk, with a different base.
