---
name: ns_ana-zebrafish-ca-tsne_hdbscan-correlation_matrix_heatmap
description: Cluster high-amplitude whole-brain coactivation events into discrete brain states by t-SNE-embedding the event × region matrix and running HDBSCAN on the 2-D embedding, reassigning every HDBSCAN noise point to its best-correlating cluster centroid, relabelling clusters by size, and rendering the event × event Pearson correlation matrix sorted by cluster to expose block-diagonal structure. Reach for this whenever someone asks for brain state clustering, discrete network states, functional repertoires, "how many states does the brain visit", state segmentation of coactivation events, t-SNE plus HDBSCAN on neural events, or a sorted/block-diagonal event correlation matrix from zebrafish calcium imaging. It reads Figure4_events_high.npy and writes Figure4_events_high_clusters.npy and Figure4_events_high_embedding.npy — the same two artifacts that ns_vis-zebrafish-ca-tsne_embedding-state_cluster_scatter writes, so pick one of the two and know that running both recomputes and overwrites
  them.
triggers:
- Run the Brain state clustering of high-amplitude coactivation events recipe
- Cluster high-amplitude whole-brain coactivation events into discrete brain states by t-SNE-embedding the event × region matrix and running HDBSCAN on the 2-D embedding, reassigning every HDBSCAN noise point to its best-correlating cluster centroid, relabelling clusters by size, and rendering the event × event Pearson correlation matrix sorted by cluster to expose block-diagonal structure.
- Generate the outputs described by ns_ana-zebrafish-ca-tsne_hdbscan-correlation_matrix_heatmap
tags:
- zebrafish
- ca
- tsne
- hdbscan
- correlation
version: '1.0'
---

# Brain state clustering of high-amplitude coactivation events

t-SNE + HDBSCAN over the 244 high-amplitude coactivation events, producing three brain
states and a cluster-sorted event correlation heatmap.

## When to use this

The question is *"does spontaneous activity visit a small number of discrete states, or does
it drift continuously?"* and you already have detected coactivation events. This recipe answers
it by clustering, then shows the answer as a sorted correlation matrix: visible blocks on the
diagonal mean the states are real and internally coherent.

Use this variant when the deliverable is the **sorted event × event correlation heatmap**.
If the deliverable is the **2-D t-SNE scatter coloured by cluster**, use
`ns_vis-zebrafish-ca-tsne_embedding-state_cluster_scatter` instead. The two runs share the
entire analysis pipeline and write the same two `.npy` files; they differ only in the figure.
Do not run both expecting them to compose — the second overwrites the first's artifacts, and
their label conventions are not the same (see Pitfalls).

Do not use this to *detect* the events. Event detection against a circular-shift null lives in
`ns_ana-zebrafish-ca-circular_null-cofluctuation_event`; this recipe starts from its output.

## Preconditions

- `Figure4_events_high.npy` present in `PROCESS_DATA_DIR`, shape (120 bilateral regions,
  244 events), produced by `ns_ana-zebrafish-ca-circular_null-cofluctuation_event`.
- `hdbscan` and `scikit-learn` installed. The script imports `hdbscan` as a standalone
  package, not `sklearn.cluster.HDBSCAN`; the two implementations do not give identical
  labels, so substituting one changes the answer.
- Env vars `PROCESS_DATA_DIR` and `SAVE_DIR`. This script does **not** validate them — it
  passes `None` straight into `os.makedirs`, which raises a confusing `TypeError` rather than
  a clear message. Set them before running.
- The custom library is wildcard-imported (`from zebrafish_Ca_utils import *` and four patch
  modules) but **no symbol from it is ever used**. All five modules are vendored into `scripts/`
  and the `sys.path` line points at the script's own directory, so the imports resolve with no
  external setup — that line is the only edit to the script; everything else is as it ran. The
  imports are still dead weight: they drag in the modules' heavy third-party dependencies
  (`numba`, `bctpy`, `networkx`, `hdbscan`, `opencv-python`) at load time, so deleting those five
  lines makes the script run unchanged and lighter. See the root `README.md`.

## Inputs and outputs

| Direction | File | Shape |
|---|---|---|
| in | `$PROCESS_DATA_DIR/Figure4_events_high.npy` | (120, 244) — regions × events |
| out | `$PROCESS_DATA_DIR/Figure4_events_high_clusters.npy` | (244,) int labels, 0-based here |
| out | `$PROCESS_DATA_DIR/Figure4_events_high_embedding.npy` | (244, 2) t-SNE coordinates |
| out | `$SAVE_DIR/figure.png` / `figure_refine.png`, `$SAVE_DIR/statistics.json` | |

Full detail in `references/data_contract.md`.

## Procedure

1. Load `Figure4_events_high.npy` as `(n_regions, n_events)` and transpose to
   `(n_events, n_regions)` — sklearn wants events as rows/samples. Getting this backwards
   silently clusters regions instead of events and still produces a plausible-looking figure.
2. Run `TSNE(n_components=2, perplexity=30, learning_rate='auto', init='random',
   random_state=420)` on the transposed matrix.
3. Run `hdbscan.HDBSCAN(min_cluster_size=10).fit_predict(embedding)` on the **2-D embedding**,
   not on the original 120-D data. This is a deliberate choice: HDBSCAN's density estimate is
   much better behaved in 2-D, at the cost of inheriting whatever distortions t-SNE introduced.
4. Reassign noise. HDBSCAN labels 35 of the 244 events `-1`. For each valid cluster compute a
   centroid as the mean over its members **in the original 120-D space**, then for each noise
   event take the Pearson correlation against every centroid and assign it to the argmax.
   Doing this in the native space rather than the embedding matters: t-SNE preserves local
   neighbourhoods but not global distances, so a 2-D distance to a cluster centre is not a
   meaningful similarity. Correlation over the 120 regional amplitudes is the quantity the
   biology is actually about — does this event have the same spatial pattern as that state?
5. Relabel clusters by descending size, largest first. Here the mapping produces **0, 1, 2**.
6. Save the relabelled vector and the embedding to `PROCESS_DATA_DIR`.
7. Compute `np.corrcoef(events_T)` → a (244, 244) event × event Pearson matrix.
8. Sort with `np.argsort(reordered_labels, kind='stable')[::-1]` and index both axes with it.
   `kind='stable'` preserves the original event order inside each cluster, so any temporal
   substructure within a state stays visible; without it, ties are shuffled arbitrarily.
9. `imshow` the sorted matrix, `aspect='equal'`, `cmap='gray'`, `vmin=-0.2`, `vmax=0.5`,
   `interpolation='nearest'`, figsize (8, 8), dpi 300. Vertical colorbar labelled
   `Correlation`. Y-axis `Coactivation events`, ticks only at `[0, n_events-1]` labelled
   `[1, 244]`. No x ticks.

## Key parameters

| Parameter | Value | Why it matters |
|---|---|---|
| `random_state` | `420` | t-SNE is stochastic and HDBSCAN reads its output, so the seed determines the embedding, the cluster count, and the split. The 3-cluster 171/56/17 result is a property of this seed, not a robust fact about the data. Change it and you may get 2 or 4 clusters. |
| `perplexity` | `30` | Effective neighbourhood size, ~12% of the 244 events. Lower fragments the map; higher merges the small clusters. |
| `learning_rate` | `'auto'` | sklearn ≥1.2 sets `max(N/early_exaggeration/4, 50)`. Older versions defaulted to 200 — a version bump silently changes the embedding. |
| `init` | `'random'` | Not `'pca'`. Random init makes the result more seed-dependent than the sklearn default would. |
| `min_cluster_size` | `10` | HDBSCAN's floor for a cluster. Raising it would absorb the 17-event cluster into noise, then into cluster 0 via the reassignment step. |
| noise reassignment space | original 120-D | Pearson r against centroids, not embedding distance. See step 4. |
| sort | `argsort(..., kind='stable')[::-1]` | Stable within cluster, then reversed so the largest cluster ends at the bottom-right. |
| colour scale | `gray`, `[-0.2, 0.5]` | Display only. The unit diagonal clips to white in the refine script. |

## Expected results

From `statistics.json` — a correct re-run at seed 420 should reproduce these:

- 244 events, 120 bilateral regions, **3 clusters**
- HDBSCAN before reassignment: 35 noise, then 16 / 46 / 147
- after reassignment and relabelling: **171 / 56 / 17** (70.1% / 23.0% / 7.0%), 0 noise left
- cluster size mean 81.33, std 65.37, median 56
- event × event correlation (upper triangle, k=1): mean **0.1453**, std 0.3400,
  median 0.1831, min −0.6601, max 0.9218, IQR [−0.1444, 0.4317]
- t-SNE extent: x ∈ [−14.52, 13.18], y ∈ [−15.35, 16.11]

The claims these support: the event correlation matrix is visibly block-diagonal, so
spontaneous activity segregates into discrete recurring spatial patterns; and three states
exist with one dominant state holding ~70% of events, i.e. the temporal organisation is not
random.

## Pitfalls

- **Do not zero the diagonal.** The base script calls `np.fill_diagonal(corr_matrix, 0)`,
  which is not in the spec and renders self-correlation as mid-grey instead of the clipped
  white a value of 1.0 should produce — it reads as a dark stripe through the figure. The
  refine script drops it. The reported correlation statistics are unaffected because they are
  taken from `np.triu_indices(n, k=1)`, which already excludes the diagonal.
- **Unstable sort scrambles within-cluster order.** The base script uses bare `np.argsort`.
  With only three distinct label values and 244 ties, the intra-cluster ordering is arbitrary.
  The refine script adds `kind='stable'`.
- **The label convention differs from Figure4D.** This script writes 0-based labels
  `{0, 1, 2}`; `ns_vis-zebrafish-ca-tsne_embedding-state_cluster_scatter` writes 1-based
  `{1, 2, 3}` to the *same filename*. Whichever ran last determines what a downstream reader
  gets. Check `labels.min()` before interpreting, and do not assume `label == 0` means
  "largest cluster" without looking.
- **Both runs overwrite the same artifacts.** Running 4C then 4D, or the reverse, silently
  replaces `Figure4_events_high_clusters.npy` and `Figure4_events_high_embedding.npy`. The
  t-SNE seed is the same, so the embedding is reproducible, but the label vector is not
  interchangeable.
- **The seed is load-bearing.** Treat 171/56/17 as the fingerprint of this run, not as a
  measurement. If you need a defensible cluster count, re-run across seeds and report the
  stability, which this analysis never did.
- **No dependence on the custom library.** The five wildcard imports resolve nothing, even
  though the modules are bundled in `scripts/` and import fine. Do not list them as requirements
  when porting — and note they cost the modules' own heavy dependencies (`numba`, `bctpy`,
  `networkx`, `hdbscan`, `opencv-python`) at load time, so the lines are safe to delete.

## Bundled files

- `scripts/reference_implementation.py` — the original run, verbatim.
- `scripts/refine_implementation.py` — diagonal preserved, stable sort. **Prefer this one.**
- `references/data_contract.md` — env vars, file shapes, artifact consumers, label convention.
- `references/method_details.md` — every parameter, full statistics, provenance.
