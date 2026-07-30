---
name: ns_ana-zebrafish-ca-tsne_hdbscan-cluster_scatter_plot
description: Produce the 2-D t-SNE scatter plot of high-amplitude whole-brain coactivation events coloured by brain state, by embedding the event × region matrix with t-SNE, clustering the embedding with HDBSCAN, reassigning noise points to their best-correlating cluster centroid in the original region space, relabelling clusters by descending size, and drawing them as red/blue/black point clouds with colour-matched legend text. Reach for this when someone asks to visualize brain states, plot the t-SNE embedding of coactivation events, show clusters in low-dimensional space, "draw the state space", a scatter of network states, or a cluster-coloured t-SNE/UMAP-style map of zebrafish calcium events. It reads Figure4_events_high.npy and writes Figure4_events_high_clusters.npy and Figure4_events_high_embedding.npy — the same two artifacts that ns_seg-zebrafish-ca-tsne_hdbscan-brain_state_cluster writes, so pick one of the two and know that running both recomputes and overwrites them.
triggers:
- Run the t-SNE state-space scatter of coactivation events recipe
- Produce the 2-D t-SNE scatter plot of high-amplitude whole-brain coactivation events coloured by brain state, by embedding the event × region matrix with t-SNE, clustering the embedding with HDBSCAN, reassigning noise points to their best-correlating cluster centroid in the original region space, relabelling clusters by descending size, and drawing them as red/blue/black point clouds with colour-matched legend text.
- Generate the outputs described by ns_ana-zebrafish-ca-tsne_hdbscan-cluster_scatter_plot
tags:
- zebrafish
- ca
- tsne
- hdbscan
- cluster
version: '1.0'
---

# t-SNE state-space scatter of coactivation events

The same t-SNE + HDBSCAN pipeline as
`ns_seg-zebrafish-ca-tsne_hdbscan-brain_state_cluster`, rendered as a 2-D scatter with one
colour per brain state.

## When to use this

The deliverable is a **picture of the state space** — 244 events as points, coloured by which
of the three states they belong to. This is the panel that shows the clusters are separated;
it is not the panel that proves they are real.

If you need evidence that the states are internally coherent rather than just visually
separated, use `ns_seg-zebrafish-ca-tsne_hdbscan-brain_state_cluster` instead, which renders
the cluster-sorted event × event correlation matrix. That matrix is computed in the original
120-D space and so is not an artefact of the embedding; a t-SNE scatter, by construction, will
show separated blobs even for data with no cluster structure at all.

The two runs share the entire analysis and write the same two `.npy` files. They differ only
in the figure and in the label base (1-based here, 0-based there). Do not chain them.

Do not use this to *detect* the events — that is
`ns_ana-zebrafish-ca-circular_null-cofluctuation_event`.

## Preconditions

- `Figure4_events_high.npy` present in `PROCESS_DATA_DIR`, shape (120 bilateral regions,
  244 events), produced by `ns_ana-zebrafish-ca-circular_null-cofluctuation_event`. This
  script checks for it and raises `FileNotFoundError` with the path if it is missing.
- `hdbscan` and `scikit-learn` installed. The script uses the standalone `hdbscan` package,
  not `sklearn.cluster.HDBSCAN`; substituting one for the other changes the labels.
- Env vars `PROCESS_DATA_DIR` and `SAVE_DIR`. Both are validated up front with an explicit
  `ValueError` — the right behaviour, since silently writing to the wrong directory would
  corrupt the shared artifact bus.
- The custom library is wildcard-imported (five modules) but **no symbol from it is ever
  used**. All five are vendored into `scripts/` and the `sys.path` line points at the script's
  own directory, so the imports resolve with no external setup — that line is the only edit to
  the script; everything else is as it ran. The imports remain dead weight: they pull in the
  modules' heavy third-party dependencies (`numba`, `bctpy`, `networkx`, `hdbscan`,
  `opencv-python`) at load time, so deleting those lines leaves the script working and lighter.
  See the root `README.md`.

## Inputs and outputs

| Direction | File | Shape |
|---|---|---|
| in | `$PROCESS_DATA_DIR/Figure4_events_high.npy` | (120, 244) — regions × events |
| out | `$PROCESS_DATA_DIR/Figure4_events_high_clusters.npy` | (244,) int labels, 1-based here |
| out | `$PROCESS_DATA_DIR/Figure4_events_high_embedding.npy` | (244, 2) t-SNE coordinates |
| out | `$SAVE_DIR/figure.png` / `figure_refine.png`, `$SAVE_DIR/statistics.json` | |

Full detail in `references/data_contract.md`.

## Procedure

1. Load `Figure4_events_high.npy` as `(n_regions, n_events)`; raise if `n_events < 10`, since
   HDBSCAN with `min_cluster_size=10` cannot form a cluster below that. Transpose to
   `(n_events, n_regions)` so events are samples.
2. Run `TSNE(n_components=2, perplexity=30, learning_rate='auto', init='random',
   random_state=420)`.
3. Run `hdbscan.HDBSCAN(min_cluster_size=10).fit_predict(embedding)` on the **2-D embedding**.
   Density estimation over 244 points in 120 dimensions would be meaningless, which is why the
   clustering happens after the reduction and not before.
4. Reassign noise. 35 of the 244 events come back labelled `-1`. Compute each valid cluster's
   centroid as the mean of its members **in the original 120-D space**, then assign each noise
   event to the cluster maximising `pearsonr(event, centroid)`. Doing this in the native space
   rather than the embedding is the defensible choice: t-SNE preserves local neighbourhoods
   but distorts global distances, so proximity in the scatter is not a similarity measure.
   Pearson r over the 120 regional amplitudes asks the biological question directly — does
   this event share the spatial pattern of that state? — and being amplitude-invariant, it
   does not pull weak events toward whichever centroid has the smallest norm.
5. Relabel clusters by descending size with the **largest mapped to 1**, giving `{1, 2, 3}`.
6. Save the relabelled vector and the embedding to `PROCESS_DATA_DIR`.
7. Scatter each cluster separately: cluster 1 red, 2 blue, 3 black, `s=20`, `alpha=0.7`. Any
   cluster beyond 3 is drawn grey at `alpha=0.5`, which never triggers on this data but keeps
   the figure honest if a different seed yields more clusters.
8. Label axes `t-SNE 1` / `t-SNE 2`, hide the top and right spines, legend upper right with
   `frameon=False`, and set each legend entry's **text colour** to match its marker.
9. `tight_layout()`, save at 300 dpi, figsize (6, 5).

## Key parameters

| Parameter | Value | Why it matters |
|---|---|---|
| `random_state` | `420` | t-SNE is stochastic and HDBSCAN reads its output, so the seed determines the embedding, the cluster count, and the split. The 3-cluster 171/56/17 result is a property of this seed, not a robust fact about the data — a different seed can yield 2 or 4 clusters. |
| `perplexity` | `30` | Effective neighbourhood size, ~12% of the 244 events. Lower fragments the map; higher merges the minority clusters. |
| `learning_rate` | `'auto'` | sklearn ≥1.2 computes `max(N/12/4, 50)` = 50 here; sklearn <1.2 defaulted to 200. A library upgrade silently moves the embedding. |
| `init` | `'random'` | Not `'pca'`. No deterministic anchor, so the layout is fully seed-determined — including the orientation, which is why cluster positions here should never be quoted as coordinates. |
| `min_cluster_size` | `10` | HDBSCAN's floor. The smallest cluster has 16 members pre-reassignment, so this threshold is close to binding. |
| noise reassignment space | original 120-D | Pearson r against centroids, not embedding distance. See step 4. |
| label base | `1` | Largest cluster → 1. The twin recipe uses 0. Same filename. |
| colours | red / blue / black | Cluster 1 / 2 / 3, applied to markers *and* legend text in the refine script. |
| `s`, `alpha` | `20`, `0.7` | Marker size and opacity; display only. |
| `figsize`, `dpi` | `(6, 5)`, `300` | |

## Expected results

From `statistics.json` — a correct re-run at seed 420 should reproduce these:

- 244 events, 120 bilateral regions, embedding (244, 2), **3 clusters**
- HDBSCAN before reassignment: 35 noise points, clusters `[0, 1, 2]`
- after reassignment and relabelling: **cluster 1 = 171, cluster 2 = 56, cluster 3 = 17**,
  0 noise remaining
- cluster centroids in embedding coordinates:
  - cluster 1 — mean (4.546, −4.507), std (4.796, 5.538), median (4.636, −4.580)
  - cluster 2 — mean (−10.243, 9.542), std (2.707, 2.441), median (−10.255, 9.844)
  - cluster 3 — mean (−2.523, 14.415), std (1.052, 1.356), median (−2.466, 14.722)

Cluster 1 is much more spread than clusters 2 and 3. Note that this is not a statement about
the data: t-SNE does not preserve cluster extent, so a wider blob in the embedding is not a
more variable state.

The claims these support: 244 high-amplitude events organise into three distinct,
non-overlapping clusters in the embedding; and the distribution is hierarchical, with a
dominant state (171 events) far more frequent than the secondary states (56 and 17).

## Pitfalls

- **Colour the legend text, not just the markers.** The spec asked for legend labels rendered
  in their cluster's colour; the base script left them black. The refine script iterates
  `legend.get_texts()` and calls `text.set_color(...)`. Trivial, but it is the entire reason
  the refine pass exists.
- **The label convention differs from Figure4C.** This script writes 1-based `{1, 2, 3}`;
  `ns_seg-zebrafish-ca-tsne_hdbscan-brain_state_cluster` writes 0-based `{0, 1, 2}` to the
  *same filename*. Whichever ran last determines what a downstream reader gets. Check
  `labels.min()` before interpreting.
- **Both runs overwrite the same artifacts.** Running 4C then 4D, or the reverse, silently
  replaces `Figure4_events_high_clusters.npy` and `Figure4_events_high_embedding.npy`. Same
  seed, so the embedding is identical; the label vector is not interchangeable.
- **The base script would mis-rank surviving noise.** It builds the size ranking from
  `np.unique(cluster_labels)` including `-1`, so any leftover noise would be handed a positive
  cluster label according to its count. This never fires on this data (reassignment clears all
  35), but it is a latent bug the refine script fixes by filtering `-1` out of the ranking and
  mapping `-1 → -1`. The refine script then also excludes `-1` from `n_clusters` and the
  per-cluster statistics.
- **Surviving noise is invisible in the refined figure.** Having preserved `-1` as `-1`, the
  refine script's plotting loop covers clusters 1, 2, 3 and then `cluster_id > 3` — so a `-1`
  point is silently omitted from the scatter. Check `np.sum(labels == -1) == 0` rather than
  trusting the picture.
- **Do not read geometry off the scatter.** t-SNE preserves local neighbourhoods only.
  Distances between clusters, the relative sizes of blobs, and the orientation of the whole
  map are all meaningless. The recorded cluster means and stds are reproducibility
  fingerprints for this seed, not measurements. The block-diagonal correlation matrix in the
  4C twin is where the evidence for discrete states actually lives.
- **The seed is load-bearing.** Treat 171/56/17 as the fingerprint of this run. A defensible
  cluster count needs a stability analysis over seeds, which this analysis never did.
- **No dependence on the custom library.** The five wildcard imports resolve nothing, even
  though the modules are bundled in `scripts/` and import fine. Do not list them as requirements
  when porting — and note they cost the modules' own heavy dependencies (`numba`, `bctpy`,
  `networkx`, `hdbscan`, `opencv-python`) at load time, so the lines are safe to delete.

## Bundled files

- `scripts/reference_implementation.py` — the original run, verbatim.
- `scripts/refine_implementation.py` — coloured legend text plus the `-1` handling.
  **Prefer this one.**
- `references/data_contract.md` — env vars, file shapes, artifact consumers, label convention.
- `references/method_details.md` — every parameter, full statistics, provenance.
