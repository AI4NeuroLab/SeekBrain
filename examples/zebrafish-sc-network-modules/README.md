# Zebrafish structural-connectivity examples

This bundled SeekBrain case uses a compact, file-level subset of the processed
zebrafish brain-network dataset from Légaré et al. (2025). It supports both
hierarchical module detection and anatomical SC-network visualization. The input
remains a dataset directory rather than a list of individual files.

```text
zebrafish-sc-network-modules/
  question.txt
  question-atlas-overlay.txt
  dataset/
    README.md
    LICENSE_DATA.md
    excluded_regions.npy
    Atlas/
      centroids.pkl
      XY_H2BGCaMP6s.tif
      XZ_H2BGCaMP6s.tif
    Files/
      SC_matrix_directed_terminals_expanded.npy
      SC_matrix_undirected_terminals_expanded.npy
```

## Example 1: hierarchical consensus modules

Enter this directly in SeekBrain:

```text
I want to identify structural connectivity (SC) network modules through a hierarchical consensus algorithm. First, generate a co-assignment probability matrix of SC based on the iterative Louvain algorithm for maximization of modularity. Then, generate the list of module labels by using hierarchical clustering (Ward’s linkage) on the co-assignment matrix of SC. Highlight a partition with 4 modules with thick-edge boxes on the co-assignment probability matrix of SC. Plot the dendrogram along the left side of the matrix. Use SC_matrix_directed_terminals_expanded.npy in ZEBRAFISH_PATH for analysis and visualization. Before analysis, use excluded_regions.npy to identify regions to exclude from the SC matrix.

dataset: "$(npm root --global)/seekbrain/examples/zebrafish-sc-network-modules"
```

SeekBrain should retrieve its bundled hierarchical-consensus SC recipe, remove
the excluded regions from both matrix axes, build a 10,000-partition Louvain
co-assignment matrix over γ = 0.7–2.2, apply Ward clustering, select four
modules, and render a left-side dendrogram with colored module boxes.

## Example 2: SC network overlay on the brain atlas

Enter this directly in SeekBrain:

```text
I want to visualize the Structural Connectivity (SC) network on the zebrafish brain atlas. Overlay the regional centroid network representation onto the top and side views of the brain projection images. Use the SC values stored in SC_matrix_undirected_terminals_expanded.npy to color the edges between regional centroids. Note that the undirected SC matrix is unilateral, a bilateral SC matrix should be created from it. Get the coordinates of left and right-brain regional centroids from the atlas folder, adjusting the y-coordinates of the centroids to match the image orientation. Before visualization, remove those regions listed in the excluded_regions.npy(the regions IDs only in a half brain, also need to double them for bilateral visualization) from the bilateral SC matrix and regional centroids.

dataset: "$(npm root --global)/seekbrain/examples/zebrafish-sc-network-modules"
```

This case uses the undirected unilateral SC matrix, bilateral atlas centroids,
and the XY/XZ projection images. Regions in `excluded_regions.npy` are removed
from both hemispheres before the weighted network is overlaid on the atlas.

See `dataset/README.md` and `dataset/LICENSE_DATA.md` for provenance and data
licensing.
