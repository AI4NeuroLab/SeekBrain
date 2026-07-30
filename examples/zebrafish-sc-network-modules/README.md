# Zebrafish structural-connectivity modules

This bundled SeekBrain case uses a compact, file-level subset of the processed
zebrafish brain-network dataset from Légaré et al. (2025). The input remains a
dataset directory rather than a list of individual files.

```text
zebrafish-sc-network-modules/
  question.txt
  dataset/
    README.md
    LICENSE_DATA.md
    excluded_regions.npy
    Files/
      SC_matrix_directed_terminals_expanded.npy
```

Enter this directly in SeekBrain:

```text
I want to identify structural connectivity (SC) network modules through a hierarchical consensus algorithm. First, generate a co-assignment probability matrix of SC based on the iterative Louvain algorithm for maximization of modularity. Then, generate the list of module labels by using hierarchical clustering (Ward’s linkage) on the co-assignment matrix of SC. Highlight a partition with 4 modules with thick-edge boxes on the co-assignment probability matrix of SC. Plot the dendrogram along the left side of the matrix. Use SC_matrix_directed_terminals_expanded.npy in ZEBRAFISH_PATH for analysis and visualization. Before analysis, use excluded_regions.npy to identify regions to exclude from the SC matrix.

dataset: "$(npm root --global)/seekbrain/examples/zebrafish-sc-network-modules"
```

SeekBrain should retrieve its bundled hierarchical-consensus SC recipe, remove
the excluded regions from both matrix axes, build a 10,000-partition Louvain
co-assignment matrix over γ = 0.7–2.2, apply Ward clustering, select four
modules, and render a left-side dendrogram with colored module boxes.

The Louvain ensemble is stochastic, so exact labels may vary slightly between
runs. The scientific contract, input matrix, excluded regions, number of
partitions, resolution interval, Ward linkage, and four-module display should
remain fixed.

See `dataset/README.md` and `dataset/LICENSE_DATA.md` for provenance and data
licensing.
