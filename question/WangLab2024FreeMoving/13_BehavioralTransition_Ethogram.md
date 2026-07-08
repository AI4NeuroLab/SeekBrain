Analyze the WangLab2024FreeMoving dataset to deconstruct hunting behavior in larval zebrafish. Evaluate behavioral sequences and transition patterns by performing first-order transition analysis, statistical significance testing, and conditional entropy calculations. Save key results and give a conclusive biological interpretation in accordance with them.

# Input sources/files
Find source files in /mnt/shared-storage-gpfs2/ai4neuro-share/neuro_scientist/library/data/lyx/WangLab2024FreeMoving/Processed_data/Bout_Clustering/
- bouts_qc.pkl 
Core metadata dictionary list. Contains fish_id, trial_id, bout_id, onset_frame_beh, offset_frame_beh, and the critical clustered (boolean) flag for all detected bouts.
- cluster_labels_K7.npy
An array of length N (where N is the number of bouts where clustered == True), containing the corresponding cluster labels.

# Operations
## Step 1 — Label Alignment and Sub-sequence Construction
### Label Mapping and Assembly:
Load bouts_qc.pkl to extract metadata for all bouts.
Load cluster_labels_K7.npy. Map these labels back to the full dictionary list sequentially, assigning them only to bouts where clustered == True.
For bouts where clustered == False (flagged during QC or padding), assign a null/NaN or -1 label.
Save the assembled tabular data as bout_labels_core.csv for downstream reference.
### Sort and Segment:
Sort the full set of bouts chronologically by (fish_id, trial_id, onset_frame_beh).
Within each (fish, trial) group, identify sequences consisting of maximal runs of consecutive bouts where clustered=True.
Any row with clustered=False acts as a "sequence break", terminating the current run and excluding it from transition calculations.
### Data Storage:
Output sequences.pkl along with a summary dictionary sequence_summary.json.
- sequences.pkl 
Store the {fish_id, trial_id, subseq_id, labels_K, bout_ids, onset_frames} of all segmented sequences.
- sequence_summary.json
Contain number of sub-sequences, length distribution, and the proportion of sequences meeting analysis requirements. 

## Step 2 — First-order transition matrix
### Extract Pairs:
For all sequences with length ≥ 2, extract consecutive (current, next) behavioral pairs.
### Compute Transition Counts:
Pool all pairs across sequences to calculate the transition count matrix C.
### Row-normalize:
Calculate the conditional probability, utilizing a zero-row guard.
### Save Output:
Save `transition_counts_K7.npy` and `transition_matrix_K7.npy`

## Step 3 — Permutation test (per-fish shuffle × 1000)
### Null Distribution Construction:
Generate 1000 permutations. For each fish, shuffle its bout labels while preserving the original trial boundaries and sub-sequence length structures.
### Statistical Metric Calculation of each transition pair:
Calculate the one-tailed raw p-value.
Apply Holm-Bonferroni correction across all K×K pairs to obtain p_holm.
Calculate Fold Change.
Define enrichment flag with the fold change larger than 1.0 and the p_holm less than 0.05.
### Save Output:
Write `transition_pvals_K7.csv` containing observed probability, expected probability, p-values, fold change, and significance flags.

## Step 4 — Per-fish Analysis and Consistency Validation
### Individual Matrix Construction:
Group data by fish_id to calculate independent count and probability matrices for each fish to audit for individual biases.
### Individual Permutation Test:
Run 1000 permutations per fish to verify whether significant transitions in the Ethogram are statistically robust across multiple individuals.
### Save Output:
per_fish_transition_matrix_K7.npy and per_fish_sig_transitions.csv.

## Step 5 — Conditional Entropy and Second-order Descriptive Analysis
### Compute Triplets:
For sub-sequences with length ≥ 3, extract triplets to calculate C[i,j,k]=count(prev=i,curr=j,next=k).
### Behavioral Determinism Assessment:
Calculate first-order entropy.
Calculate second-order conditional entropy.
Compare H1 and H2 to verify the "memoryless" characteristic of the sequence (stimulus-response model) and identify decision points.
### Save Output:
second_order_transition_tensor.npy (3D array of shape K×K×K) and transition_entropy_per_cluster.csv.

## Step 6 — Ethogram Visualization
### Layout and Style:
Create two panels side by side. 
Layout K nodes in a ring, starting at 90° and walking clockwise.
Arrows: Directed from the source node to the target node.
Set the Cluster Color Palette as a 7-color hex list starting #E76F51, #2A9D8F, #264653, #F4A261, #8E7DBE, #457B9D, #A8C256, wrapping by index. 
Set node marker size to ~260, black edge, and color from the palette.
Place cluster labels outward at radius 1.55.

### Figure Content:
**Left Panel — Base Transition Probabilities**
Draw all transitions with observed probability ≥ 0.05.
Arrow width is proportional to the transition probability; color is set to grey. 
Self-loops are rendered as arcs outside the nodes.
**Right Panel — Significantly Enriched Transitions**
Draw only pairs with enriched=True.
Arrow width is proportional to Fold Change; color matches the source node.
**Legends**
Place a shared legend section at the bottom of the figure, including 3 parts:
Probability Scale, a visual guide showing how different arrow widths represent transition probabilities.
Fold Change Scale, a visual guide showing how different arrow widths represent the fold change compared to chance.
Node Colors, a single horizontal row of colored markers acting as a key to identify the behavioral clusters.