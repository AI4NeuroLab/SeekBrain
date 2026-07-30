# Method details — ns_vis-zebrafish-ca-tsne_embedding-state_cluster_scatter

## Contents

- [Full parameter list](#full-parameter-list)
- [Statistical approach and assumptions](#statistical-approach-and-assumptions)
- [Recorded statistics (`statistics.json`)](#recorded-statistics-statisticsjson)
- [Implementation requirements](#implementation-requirements)
- [Scientific conclusion supported](#scientific-conclusion-supported)
- [Output requirements](#output-requirements)
- [Relationship to `ns_seg-zebrafish-ca-tsne_hdbscan-brain_state_cluster`](#relationship-to-nsseg-zebrafish-ca-tsnehdbscan-brainstatecluster)


## Full parameter list

| Name | Value | Where | Effect |
|---|---|---|---|
| `n_components` | `2` | `TSNE` | Embedding dimensionality; also the clustering space, since HDBSCAN runs on the output |
| `perplexity` | `30` | `TSNE` | Effective number of neighbours, ≈12% of the 244 events. Below ~10 the map fragments; above ~50 the minority clusters merge into the dominant one |
| `learning_rate` | `'auto'` | `TSNE` | sklearn ≥1.2 computes `max(N / early_exaggeration / 4, 50)` = `max(244/12/4, 50)` = 50 here. sklearn <1.2 defaulted to 200 — a silent version-dependent parameter |
| `init` | `'random'` | `TSNE` | Not the `'pca'` default of recent sklearn. No deterministic anchor, so even the orientation of the map is seed-determined |
| `random_state` | `420` | `TSNE` | The single most consequential number in this recipe. See "Seed dependence" |
| `min_cluster_size` | `10` | `hdbscan.HDBSCAN` | Minimum members for a group to count as a cluster |
| all other HDBSCAN args | defaults | `hdbscan.HDBSCAN` | `min_samples=None` (falls back to `min_cluster_size`), `metric='euclidean'`, `cluster_selection_method='eom'`, `alpha=1.0` |
| noise-reassignment metric | Pearson `r` | `scipy.stats.pearsonr` | Computed in the original 120-D region space against cluster centroids |
| centroid definition | `np.mean(events_transposed[mask], axis=0)` | inline | Arithmetic mean over the 120 regions of the members, computed from the **pre-reassignment** membership; reassignment is single-pass and non-iterative |
| relabelling | sort by size desc, `new_label + 1` | inline | Largest cluster → 1, giving `{1, 2, 3}` |
| `n_events < 10` guard | raise | inline | Below this HDBSCAN cannot form a cluster at `min_cluster_size=10` |
| cluster colours | `{1: 'red', 2: 'blue', 3: 'black'}` | `scatter` | Fixed by the required configuration |
| overflow colour | `'gray'`, `alpha=0.5` | `scatter` | Applied to any `cluster_id > 3`; never triggers on this data |
| `s` | `20` | `scatter` | Marker size |
| `alpha` | `0.7` | `scatter` | Marker opacity for clusters 1–3 |
| legend | `loc='upper right'`, `frameon=False` | `ax.legend` | |
| legend text colours | red / blue / black | refine only | `text.set_color(...)` per entry |
| spines | top and right hidden | `ax.spines[...].set_visible(False)` | |
| `figsize` | `(6, 5)` | `plt.subplots` | |
| `dpi` | `300` | `savefig` only | Note the figure is *created* at default dpi and only saved at 300, unlike the 4C twin which sets dpi on both |
| layout | `tight_layout()` | | The 4C twin uses `bbox_inches='tight'` at save time instead |

## Statistical approach and assumptions

**t-SNE.** A non-linear neighbour-embedding method optimising a KL divergence between
neighbour distributions in 120-D and 2-D. It preserves *local* neighbourhood structure and
explicitly does not preserve global distances, cluster extents, or inter-cluster gaps. For a
figure whose entire content is a 2-D layout, the consequences are severe and worth stating
plainly:

- The distance between two clusters in the scatter carries no quantitative meaning.
- The apparent spread of a cluster is not its variance in the data. Cluster 1's larger
  recorded std (≈4.8, 5.5 vs ≈1.1, 1.4 for cluster 3) is substantially an artefact of having
  171 points instead of 17.
- t-SNE will produce visually separated blobs from data with no cluster structure at all. A
  clean-looking scatter is therefore *not* evidence that discrete states exist.

The evidence for discrete states lives in the twin recipe's figure — the cluster-sorted event ×
event correlation matrix, computed in the original space and independent of the embedding.
This panel shows the partition; it does not justify it.

**HDBSCAN.** Density-based hierarchical clustering; it selects the number of clusters itself
from the condensed cluster tree, which is why no `k` appears anywhere. Running it on the 2-D
embedding rather than the 120-D data is deliberate: 244 points in 120 dimensions are far too
sparse for a mutual-reachability density estimate to mean anything. The trade-off is explicit
— better-behaved density estimation, at the cost of clustering a distorted space.

**Noise reassignment.** HDBSCAN's `-1` means "not in a dense region", not "unlike every
cluster". 35 of 244 events (14.3%) come back as noise. Each is assigned to
`argmax_c pearsonr(event, centroid_c)`. Two properties matter:

1. It is done in the **original 120-D space**, not in the embedding. An embedding distance
   would only ask "which blob did t-SNE happen to place you near". Pearson r over the 120
   regional amplitudes asks the biological question — does this event have the same *spatial
   pattern* as that state? Correlation is also amplitude-invariant, so a weak-but-correctly-
   patterned event is assigned on pattern rather than being drawn toward the smallest-norm
   centroid.
2. It is single-pass and greedy. Centroids are computed once from the pre-reassignment
   membership and never updated, so this is not a k-means iteration to convergence; the result
   depends on the initial HDBSCAN partition and is not a fixed point.

Every event ends up assigned — the procedure cannot fail to assign anything, so the report's
framing that reassignment "validated" the outliers is stronger than the method supports.

**No significance testing.** No null model, no p-value. The existence of the events is tested
upstream in `ns_ana-zebrafish-ca-circular_null-cofluctuation_event`; the number of states is
not tested anywhere.

### Seed dependence

t-SNE and HDBSCAN-on-t-SNE are both seed-sensitive and the effects compound: a different
`random_state` gives a different embedding, and HDBSCAN reads its cluster count off that
embedding's density landscape. The observed 3-cluster, 171/56/17 partition is a property of
`random_state=420` applied to this data, not a measured quantity. With `init='random'` there
is not even a deterministic orientation, so the recorded cluster centroid coordinates are pure
reproducibility fingerprints — they identify this exact run and nothing more. A cluster-count
claim that would survive review needs a stability analysis over seeds and perplexities, which
this run did not perform.

## Recorded statistics (`statistics.json`)

Verbatim from the original run:

```json
{
  "n_events": 244,
  "n_regions": 120,
  "embedding_shape": [
    244,
    2
  ],
  "n_clusters": 3,
  "cluster_sizes": {
    "cluster_1": 171,
    "cluster_2": 56,
    "cluster_3": 17
  },
  "cluster_means": {
    "cluster_1": {
      "dim1": 4.54591178894043,
      "dim2": -4.506606578826904
    },
    "cluster_2": {
      "dim1": -10.24340534210205,
      "dim2": 9.542248725891113
    },
    "cluster_3": {
      "dim1": -2.5228941440582275,
      "dim2": 14.414977073669434
    }
  },
  "cluster_stds": {
    "cluster_1": {
      "dim1": 4.796016216278076,
      "dim2": 5.53782320022583
    },
    "cluster_2": {
      "dim1": 2.7066948413848877,
      "dim2": 2.4412858486175537
    },
    "cluster_3": {
      "dim1": 1.0517668724060059,
      "dim2": 1.3564929962158203
    }
  },
  "cluster_medians": {
    "cluster_1": {
      "dim1": 4.636446475982666,
      "dim2": -4.5797224044799805
    },
    "cluster_2": {
      "dim1": -10.254606246948242,
      "dim2": 9.844182968139648
    },
    "cluster_3": {
      "dim1": -2.4658825397491455,
      "dim2": 14.72188663482666
    }
  }
}
```

The base and refine scripts produce identical values on this data — the refine script's only
statistical change is to exclude `-1` from `n_clusters` and from the per-cluster loop, and no
`-1` survives.

### Intermediate counts not in `statistics.json`


- HDBSCAN raw labels `[-1, 0, 1, 2]` with 35 noise points
- valid clusters `[0, 1, 2]`, 35 noise points reassigned, 0 remaining
- relabelling: cluster 1 was HDBSCAN 2 (171 events), cluster 2 was HDBSCAN 1 (56), cluster 3
  was HDBSCAN 0 (17)

confirming the two runs produce the identical partition — 1 noise point absorbed into
HDBSCAN-cluster 0, 10 into cluster 1, 24 into cluster 2.

## Implementation requirements

Apply the following implementation requirements (four ways). Only the first was
identified during visual inspection; the rest are defensive hardening the model
added while it was in there.

1. **Legend text colouring.** The spec asked for each legend label to be drawn in its
   cluster's colour. The base script left them all black. The refine script iterates
   `legend.get_texts()` and applies `{'Cluster 1': 'red', 'Cluster 2': 'blue',
   'Cluster 3': 'black'}` by matching the label string.
2. **Output renamed** `figure.png` → `figure_refine.png`.
3. **`-1` excluded from the size ranking.** The base script builds `cluster_sizes` from
   `np.unique(cluster_labels)` *including* `-1`, so surviving noise would be ranked by count
   and handed a positive label like any real cluster. The refine script filters
   `valid_unique_labels = unique_labels[unique_labels != -1]` and adds `label_mapping[-1] = -1`
   so noise stays noise. It also guards the whole reassignment block with
   `if len(valid_clusters) > 0`, and excludes `-1` from `n_clusters` and the per-cluster
   statistics loop.
4. Print statements adjusted to skip the `-1` entry.

None of this changes the output on this data — all 35 noise points are reassigned, so `-1`
never survives. The refine script is nonetheless the one to use, both for the legend and
because its `-1` handling is correct if a different seed or `min_cluster_size` leaves noise
behind.

One residual gap in the refine script: having preserved `-1` as `-1`, its plotting loop still
only draws clusters `1, 2, 3` and then `cluster_id > 3`, so a surviving `-1` point would be
silently absent from the scatter. Assert `np.sum(labels == -1) == 0` rather than trusting the
figure.

## Scientific conclusion supported

From `conclusions.json`:

> The application of t-SNE dimensionality reduction and HDBSCAN clustering to 244
> high-amplitude coactivation events reveals that these events spontaneously organize into
> three distinct, non-overlapping clusters within the low-dimensional embedding space.

> Quantitative analysis of the clustered high-amplitude coactivation events indicates a
> hierarchical distribution of brain states, characterized by a dominant state (Cluster 1)
> containing 171 events, which is significantly more frequent than the secondary states
> represented by Cluster 2 (56 events) and Cluster 3 (17 events).

Both are careful to say "within the low-dimensional embedding space" and both inherit the seed
dependence described above. The word "significantly" in the second conclusion is not backed by
a test — no comparison of cluster sizes against any null was performed.

## Output requirements

Single axes, figsize (6, 5), saved at 300 dpi with `tight_layout()`.

Three scatter calls, one per cluster, drawn in order 1, 2, 3 so later clusters overplot
earlier ones: cluster 1 red, cluster 2 blue, cluster 3 black, all `s=20`, `alpha=0.7`, with
legend labels `Cluster 1` / `Cluster 2` / `Cluster 3`. Any cluster with id > 3 is drawn grey at
`alpha=0.5` with label `Cluster {id}` — dead code on this data, retained so a different seed
would not silently drop points.

X-axis labelled `t-SNE 1`, y-axis `t-SNE 2`. Top and right spines hidden. Legend in the upper
right, `frameon=False`, with **each entry's text colour matched to its marker colour** in the
refine script. Ticks left at matplotlib defaults.

The known rendering failure was black legend text where coloured text was specified; see
Pitfalls in `RECIPE.md`.

## Relationship to `ns_seg-zebrafish-ca-tsne_hdbscan-brain_state_cluster`

The two runs are near-duplicates. Identical input, identical t-SNE parameters, identical seed,
identical HDBSCAN parameters, identical noise-reassignment logic, identical size-based
reordering — and they write the same two artifact filenames. They diverge in exactly two
places, plus some error-handling polish:

| | 4D (this recipe) | 4C (heatmap recipe) |
|---|---|---|
| Figure | 2-D t-SNE scatter, one colour per cluster | sorted 244×244 event correlation heatmap |
| Label base | 1-based `{1, 2, 3}` | 0-based `{0, 1, 2}` |
| `statistics.json` | per-cluster embedding centroid / std / median | correlation-matrix and cluster-size summaries |
| Env var guard | explicit `ValueError` naming the variable | none (`TypeError` on unset) |
| Input existence check | `FileNotFoundError` with path | none |
| `np.corrcoef` | not used | used, (244, 244) |

Pick one. Running both recomputes the same embedding (same seed, so identical coordinates) but
leaves whichever ran last in control of the label vector on disk, under a different base.
