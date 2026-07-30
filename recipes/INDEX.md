# Analysis Recipe Index

> Bundled with SeekBrain
> Total recipes: 68

## Multimodal-joint-analysis

### Dynamics-Behavior Coupling

#### `ns_multi-c_elegans-ca_behavior-correlation-timeseries_trace`

Analyzes how individual neurons encode velocity across diverse temporal scales using exponentially weighted moving averages and correlation optimization.

#### `ns_multi-c_elegans-ca_behavior-half_decay-distribution`

Computes the empirical cumulative distribution function of median half-decay times for behaviorally significant neurons, including inter-animal variance shading.

#### `ns_multi-c_elegans-ca_behavior-pca-pc_feature_heatmap`

Performs PCA on z-scored neural activity, clusters neurons by PC loadings, and aligns results with CePNEM behavioral tuning for a specified experimental animal.

#### `ns_multi-c_elegans-ca_behavior-ridge-timeseries_trace`

Performs time-offset ridge regression to evaluate if neural activity encodes past behavioral velocity, quantifying performance against shuffled control decoders.

#### `ns_multi-c_elegans-ca_behavior-umap-embedding_scatter_plot`

This recipe analyzes neural population dynamics by mapping CePNEM-derived feeding tuning indices onto continuous UMAP manifold embeddings to reveal graded encoding patterns.

#### `ns_multi-drosophila-ca_behavior-circular_statistics-encoding_accuracy`

Quantifies HD encoding accuracy in Drosophila E-PG neurons by calculating vector strength from fluorescence imaging and heading data across varying visual cue conditions.

#### `ns_multi-drosophila-ca_behavior-pearson-scatter_plot`

Calculates the Pearson correlation between EPG bump width and heading-direction encoding accuracy across fly trials during active movement periods.

#### `ns_multi-macaque-spike_behavior-classified_firing_rate-psth_distribution`

Computes and visualizes trial-averaged PSTHs for PMd neurons categorized by decision choice and coherence difficulty during the perceptual decision-formation period.

#### `ns_multi-macaque-spike_behavior-classified_firing_rate-psth_trace`

Generates trial-averaged firing rate curves for 14 PMd neurons, segmented by choice and difficulty, using a 75ms sliding window with SEM error shading.

#### `ns_multi-macaque-spike_behavior-classified_firing_rate-raster_psth`

Analyzes and visualizes single-neuron spiking activity in the macaque dorsal premotor cortex by decomposing trial-binned firing rate tensors across task-specific variables.

#### `ns_multi-macaque-spike_behavior-glm-performance`

Quantifies whether post-stimulus superior colliculus activity reflects prior-dependent shifts in perceptual choice using trial-aligned firing rates and logistic regression.

#### `ns_multi-macaque-spike_behavior-tensor_decomposition-temporal_motif`

Analyzes heterogeneous firing rate profiles in macaque PMd neurons by applying CP tensor decomposition to trial-averaged data sorted by choice and stimulus difficulty.

#### `ns_multi-mouse-spike_behavior-classified_firing_rate-psth_heatmap`

Calculates and visualizes trial-averaged firing rate profiles for neuronal populations, segmented by stimulus difficulty and behavioral choice.

#### `ns_multi-mouse-spike_behavior-decay_correlation-scatter_plot`

Tests whether neural and behavioral temporal dynamics covary across sessions by estimating and correlating their inverse decay constants.

#### `ns_multi-mouse-spike_behavior-exponential_kernel_glm-decay_distribution`

Calculates session-specific exponential decay constants from neural GLMs and behavioral action kernels, then quantifies their alignment using Pearson correlation.

#### `ns_multi-mouse-spike_behavior-glm-decoding_metrics`

Analyzes orbitofrontal cortex (ORBvl) neural activity during the inter-trial interval to decode the subject's internal prior probability of stimulus presentation, benchmarking against a Bayes-optimal observer model.

#### `ns_multi-zebrafish-ca_behavior-circular_correlation-tuning_curve`

Performs circular correlation analysis and visualization to compare neural bump phase against scene orientation across pre-learning, learning, and post-training phases.

#### `ns_multi-zebrafish-ca_behavior-circular_statistics-phase_locking`

Quantifies disruption of scene–bump phase alignment across learning epochs using circular offsets and within-subject out-of-phase fractions.

#### `ns_multi-zebrafish-ca_behavior-circular_statistics-tuning_curve`

Analyzes and visualizes head-direction cell tuning transformations in symmetric environments by generating synchronized heatmaps across pre-learning, learning, and post-learning epochs.

#### `ns_multi-zebrafish-ca_behavior-linear_regression-sensorimotor_trace`

Build the three-modality sensorimotor raster for a single zebrafish larva — binarized swim behaviour, the light/dark visual stimulus sequence, and single-neuron ΔF/F₀ calcium traces for four functionally defined ensembles (Motor+, Motor−, Dark, Light) selected as the 50 most extreme neurons by precomputed correlation ranking — all drawn on one shared time axis with per-neuron traces at low alpha and the population mean overlaid in black. Reach for this when someone asks to show neural activity aligned to behaviour, plot swim-triggered or stimulus-locked calcium traces, 'which neurons fire when the fish swims', motor-correlated versus visually driven neurons, dark- versus light-responsive cells, a single-fish example trace figure, or any per-neuron time-series panel combining calcium, behaviour, and stimulus. This is a pure figure recipe on one hard-coded larva (fish16) — it writes statistics.json but no .npy artifacts, so nothing downstream consumes it.

#### `ns_multi-zebrafish-ca_behavior-permutation-spatial_density`

This recipe aggregates neuron centroids from multiple zebrafish larvae into a unified 3D brain atlas coordinate system, grouped by functional response categories: motor-correlated, motor-anticorrelated, dark-responsive, and light-responsive. It performs spatial statistical filtering using a permutation-based p-value test to retain only neurons in spatially consistent locations across individuals. The results are visualized as density-colored scatter plots on atlas projection backgrounds, providing a whole-brain map of functionally defined neuron populations.

#### `ns_multi-zebrafish-ca_behavior-vonmises_shuffling-distribution_bar_plot`

Compare empirical bump-to-scene von Mises concentration with circular-shift controls and plot the observed and null distributions. Use to assess phase-locking stability during visual perturbations.

#### `ns_multi-zebrafish-ca_behavior-vonmises-phase_locking`

Quantify bump-to-scene phase locking with von Mises concentration and a circular-shift null distribution. Use for jump or noise epochs in aligned neural-phase and visual-orientation recordings.

### Dynamics-Behavior-Anatomy-Gene Coupling

#### `ns_multi-zebrafish-ca_behavior_anatomy_gene-correlation_visual_response-neuronal_subtype_features`

Integrate zebrafish calcium responses, swimming behavior, atlas coordinates, and molecular identity to characterize neuronal subtypes. Use for glyt2/gfra1a visuomotor response and anatomical mapping analyses.

### Dynamics-Behavior-Stimulus Coupling

#### `ns_multi-macaque-spike_behavior_visual_stim-latent_dynamical_model-log_likelihood_ratio`

Evaluates the predictive performance of latent dynamical models against trial-averaged PSTH baselines by computing marginal log-likelihood improvements across neural populations.

#### `ns_multi-mouse-spike_behavior_visual_stim-spearman-scatter_plot`

Computes and visualizes the Spearman correlation between electrophysiology and widefield imaging neurometric shift values across 32 defined cortical regions.

### Molecule-Structure Coupling

#### `ns_multi-zebrafish-gene_anatomy-expression_count_mapping-spatial_density`

Map eomesa- and pvalb7-positive cells into a common zebrafish atlas from registered EASI-FISH volumes and cell-wise spot counts. Use for whole-brain expression density and co-expression maps.

#### `ns_multi-zebrafish-gene_anatomy-expression_level_clustering-heatmap`

This recipe generates a heatmap visualization of spatially resolved gene expression markers across brain regions in larval zebrafish. It loads a pre-computed gene expression matrix, excludes specified brain regions, normalizes expression values via z-scoring across genes per region, and produces a publication-quality heatmap. The white-to-black color gradient highlights genes that are highly and specifically expressed in particular brain regions, enabling researchers to identify spatial expression patterns relevant to functional connectivity studies.

### Stimulus-Dynamics Coupling

#### `ns_multi-mouse-spike_visual_stim-svm-performance`

Calculates and visualizes visual responsiveness fractions and population decoding accuracy across cortical regions using Allen Institute Ecephys data.

### Structure Function Coupling

#### `ns_multi-mouse-spike_anatomy-significant_neuron_fraction-atlas_contour_map`

Computes regional neural modulation to visual stimuli from Neuropixels data and renders a Swanson flatmap projection using the IBL atlas framework.

#### `ns_multi-zebrafish-sc_fc_matrix-correlation_polyfit-scatter_plot`

Produce the edge-wise scatter plot of structural PC1 against functional connectivity with a first-order polynomial best-fit line, reporting Pearson r, R², slope and intercept. Use this when someone wants to see the structure-function relationship rather than just quote it — 'plot SC against FC', 'scatter of structural PC1 vs functional connectivity', 'regression line for structure-function coupling', 'how much FC variance does structure explain', 'show me the correlation', or a figure panel accompanying an SC→FC claim. It consumes `Figure2_SC_predictor_PC1.npy` written by `ns_multi-zebrafish-sc_ca-pca_pc1-fc_prediction` together with `Figure1_FC_matrix.npy`, and closes the 2J→2K→2L chain that begins with `ns_feat-zebrafish-sc-pca-predictor_dimensionality`. Read the Pitfalls before quoting its numbers: this analysis re-applies the exclusion mask to already-filtered matrices and computes its r on 61 regions rather than the 65 used upstream.

#### `ns_multi-zebrafish-sc_fc_matrix-degree_correlation_polyfit-scatter_plot`

Quantify how well structural node degree predicts functional node degree in the zebrafish brain — weighted row sums of the undirected structural connectome versus weighted row sums of the group-average FC matrix, tested with Pearson correlation and a least-squares line, plotted as a scatter with a best-fit line and the r value in the corner. Reach for this whenever the question is 'does physical connectivity predict correlated activity', 'are structural hubs also functional hubs', 'correlate SC degree with FC degree', 'how much FC variance does structural degree explain', 'regress functional degree on structural degree', 'degree-degree scatter', or 'SC-FC hub correspondence'. It writes Figure2_Node_degree_SC.npy and Figure2_Node_degree_FC.npy and reports r = 0.694, p = 1.46e-10, slope 0.605, R² = 0.482 across 65 regions. If the deliverable is an anatomical atlas map of those degrees rather than a scatter, use ns_vis-zebrafish-sc_ca-node_degree-degree_atlas_map — it writes the

#### `ns_multi-zebrafish-sc_fc_matrix-diffusion_map-connectivity_gradient`

Compute connectivity gradients from both the structural connectome (SC) and the group-average functional connectivity matrix (FC) of the larval zebrafish brain using the diffusion map embedding algorithm (brainspace.gradient.embedding.diffusion_mapping, alpha=0.5), correlate the first two SC and FC gradients against each other, and project them onto the Mapzebrain atlas as bilateral centroid overlays in top (XY) and side (XZ) views. Reach for this whenever someone asks for connectivity gradients, gradient analysis, diffusion map embedding, diffusion embedding of a connectome, the principal gradient, macroscale gradients, a low-dimensional embedding of SC or FC, 'does structure predict the main axis of function', 'is there a rostro-caudal gradient', 'sensorimotor hierarchy from connectivity', or the correspondence between structural and functional gradients. This is the source of Figure6_SC_gradients.npy, Figure6_SC_eigenvalues.npy, Figure6_FC_gradients.npy and Figure6_FC_eigenvalues.npy

#### `ns_multi-zebrafish-sc_fc_matrix-directionality_anova-matrix_histogram`

Test whether the existence and reciprocity of a structural connection changes functional coupling strength, by classifying every zebrafish region pair as unconnected / unidirectional / bidirectional from the directed structural connectome, pooling the per-larva FC values in each class, and comparing the three distributions with a one-way ANOVA. Reach for this whenever the question is about directionality or reciprocity of anatomy versus function — 'do reciprocally connected regions correlate more strongly', 'does having a structural link raise functional connectivity', 'compare FC for connected vs unconnected pairs', 'effect of connection directionality on correlation', 'bidirectional vs unidirectional coupling', 'SC category FC distributions' — or when someone wants the FC density curves split by structural connection type with significance bars. It produces Figure2_number_of_connections.npy plus the three per-category FC value arrays (Figure2_Directionality_Corr_Bidirection/Unidirection/Unconnect.npy)

#### `ns_multi-zebrafish-sc_fc_matrix-graph_predictors-fc_variance_explained`

Compute ~40 structural graph-theoretic predictors from the zebrafish connectome (shortest path, communicability, search information, mean first passage time, matching index, cosine similarity, adjacency, Euclidean distance and their in/out/all directed variants) via the Predictors class, correlate each one edgewise against the functional connectivity matrix, and rank them by how much FC variance they explain relative to a plain undirected-SC baseline. Reach for this whenever someone asks which network metric best predicts function — 'which structural predictor explains functional connectivity', 'do communication models beat direct wiring', 'compare shortest path vs communicability vs matching index', 'delta explained variance', 'does topology explain FC better than SC weights', 'graph-theoretic predictors of functional connectivity', 'structure-function prediction benchmark'. It writes Figure2_SC_predictors.npy, Figure2_SC_predictor_names.npy, Figure2_SC_predictor_rsquared_single.npy

#### `ns_multi-zebrafish-sc_fc_matrix-hungarian_matching-gradient_correspondence`

Establish an optimal one-to-one correspondence between structural connectivity (SC) and functional connectivity (FC) diffusion-map gradients in zebrafish, by computing an all-pairs Pearson similarity matrix between the first 50 SC modes and the first 50 FC modes and then solving the assignment problem with the Hungarian algorithm on cost 1 - |r|. Use this whenever someone asks how well structural eigenmodes match functional gradients, wants to align SC and FC modes, asks 'which functional gradient corresponds to which structural gradient', 'do structural modes predict functional modes', 'match the eigenmodes', 'gradient similarity matrix', 'SC-FC mode alignment', or wants the red diagonal heatmap of gradient similarity |r|. It consumes Figure6_SC_gradients.npy and Figure6_FC_gradients.npy from ns_multi-zebrafish-sc_ca-diffusion_map-connectivity_gradient, so run that first, and it writes the sorted correlation matrix plus the mapping-index vector that define the alignment.

#### `ns_multi-zebrafish-sc_fc_matrix-node_degree_correlation-degree_atlas_map`

Project weighted structural and functional node degrees onto the Mapzebrain atlas as a split-hemisphere anatomical map — z-scored SC degree colouring the left-brain region centroids, z-scored FC degree colouring the right-brain centroids, over the XY (dorsal) atlas projection. Reach for this whenever someone wants to *see where the hubs are*: 'map the connectivity hubs onto the brain', 'which regions are structural hubs', 'show SC and FC degree side by side on the atlas', 'spatial distribution of node degree', 'do structural and functional hubs overlap anatomically', 'hub topography', 'degree map'. It computes and writes Figure2_Node_degree_SC.npy and Figure2_Node_degree_FC.npy, and reports the SC–FC degree correlation (r ≈ 0.69). If the deliverable is a scatter plot with a regression line rather than an anatomical map, use ns_multi-zebrafish-sc_ca-linregress-degree_coupling instead — it writes the same two artifacts by a slightly different FC-degree formula.

#### `ns_multi-zebrafish-structural_functional_matrix-graph_predictor_pca_correlation-pc1_fc_matrix`

Extract the first principal component of the zebrafish structural-predictor matrix, reshape it into a region-by-region structural PC1 matrix, sign-align it to functional connectivity, and measure how strongly it predicts FC with an edge-wise Pearson correlation over the upper triangle. Use this whenever someone asks whether structure predicts function, 'does the connectome explain functional connectivity', 'correlate SC with FC', 'structure-function coupling', 'how well does the dominant structural mode match the FC matrix', or wants the composite half-SC/half-FC heatmap that makes the two matrices visually comparable. This is the middle link of the 2J→2K→2L chain: `ns_feat-zebrafish-sc-pca-predictor_dimensionality` establishes that PC1 dominates the predictor space, this recipe turns that PC1 into the artifact `Figure2_SC_predictor_PC1.npy` and reports r ≈ 0.68, and `ns_vis-zebrafish-sc_ca-scatter_polyfit-pc1_fc_regression` consumes that artifact for the scatter plot. Reach

## Single-modality

### Behavioral Modality

#### `ns_ana-mouse-behavior-anova-task_performance`

Analyzes the impact of bilateral HDB-OB cholinergic inactivation on olfactory discrimination learning and evaluates signal reversibility post-CNO washout.

#### `ns_ana-mouse-behavior-glm-performance`

Fits Bayes-optimal, stimulus, and action kernel models to behavioral choice data and performs group-level Bayesian model selection to calculate model frequencies and exceedance probabilities.

#### `ns_ana-mouse-behavior-markov-epoch_interval`

Decomposes trial-based behavioral data into latent states like engagement and side-bias using GLM-HMM architecture and Viterbi state sequence decoding.

### Dynamics Modality

#### `ns_ana-zebrafish-ca_fc_matrix-cross_individual_correlation-network_stereotypy_matrix`

Quantify how stereotyped functional connectivity is across zebrafish larvae by vectorising each larva's FC matrix upper triangle and correlating every pair of larvae, then ordering the resulting larva-by-larva similarity matrix from most to least representative and rendering it as a lower-triangular heatmap. Use this whenever the question is about inter-individual consistency, reproducibility, or conservation of a connectome — "is the functional network the same across fish", "how stereotyped is FC", "how similar are individual connectomes", "inter-subject similarity of connectivity", "which fish is most representative of the group", "is there a canonical connectome", "network stereotypy", or "compare connectivity matrices between animals". Reads Figure1_FC_matrices.npy (the per-larva stack) and writes Figure1_FC_network_similarity_across_larvae.npy plus the ordered larva ID list, so run ns_ana-zebrafish-ca-pearson-fc_matrix first. Distinct from cross-day identity fingerprinting, which asks whether an individual can be re-identified rather than how alike the group is.

#### `ns_ana-zebrafish-ca-circular_null-cofluctuation_event_trace`

Detect discrete high-amplitude co-fluctuation events in zebrafish whole-brain calcium data by computing the RMS of pairwise edge co-fluctuations at every frame, building a circular-shift null distribution, and thresholding with Benjamini-Hochberg FDR-corrected empirical p-values. Reach for this whenever someone asks about "co-fluctuation events", "edge time series", "RMS of coactivation", "moments of synchronized brain-wide activity", "high-amplitude events", "brain-wide bursts", "circular permutation null model", "how do I know these synchrony peaks are not chance", or needs the discrete event set that brain-state clustering operates on. It writes Figure4_RMS.npy, Figure4_null_RMS_distribution.npy, Figure4_RMS_threshold.npy and Figure4_events_high.npy — the last being the required input for the t-SNE/HDBSCAN state clustering and the state-cluster scatter.

#### `ns_ana-zebrafish-ca-cross_day_correlation-identity_fingerprint_matrix`

Test whether individual zebrafish larvae can be re-identified across two imaging sessions 24 hours apart (6 dpf vs 7 dpf) by correlating the upper triangles of their functional connectivity matrices, building a symmetric larva×larva FC-similarity matrix, and scoring how often each larva's best match is itself. Use this whenever someone asks about connectome fingerprinting, brain fingerprints, individual identifiability, subject identification accuracy, test–retest or day-to-day stability of functional connectivity, "can you tell the fish apart from their brain activity", "is the FC pattern unique to each animal", or wants the FC-similarity heatmap with asterisks marking each row's maximum. This is the identification-accuracy half of the fingerprinting pair; the significance test of intra- vs inter-individual similarity lives in ns_ana-zebrafish-ca-mannwhitney-fingerprint_significance. Both write Figure1_FC_fingerprinting.npy.

#### `ns_ana-zebrafish-ca-eigen_spectrum-fc_scree_plot`

Draw the scree plot of the functional connectivity (FC) diffusion-map eigenvalue spectrum for zebrafish whole-brain calcium data — a black line of eigenvalue versus gradient index — to show how fast gradient importance decays and to justify keeping only the leading modes. Use this when someone asks for an FC scree plot, an eigenvalue decay curve, "how many functional gradients should I keep", "plot the eigenvalue spectrum", "show the elbow", "how many dimensions does functional connectivity have", or wants the panel that motivates the 50-mode cutoff used in SC-FC gradient matching. It reads Figure6_FC_eigenvalues.npy from ns_multi-zebrafish-sc_ca-diffusion_map-connectivity_gradient, writes no artifacts, and is the FC twin of ns_vis-zebrafish-sc-eigen_spectrum-sc_scree_plot; reach for both when comparing structural and functional spectral decay.

#### `ns_ana-zebrafish-ca-fingerprint_mannwhitney-box_plot`

Test whether zebrafish larvae are significantly self-similar across days by splitting the cross-day FC-similarity matrix into intra-individual (diagonal) and inter-individual (off-diagonal) groups and comparing them with a two-sided Mann-Whitney U test, then plotting both distributions as jittered scatter points under unfilled min-to-max boxplots with the p-value annotated. Use this whenever someone asks whether connectome fingerprinting is statistically significant, whether within-subject FC similarity exceeds between-subject similarity, for a p-value on individual identifiability, test-retest reliability of functional connectivity, "is the fish more like itself than like other fish", or wants the intra- vs inter-individual similarity boxplot. This is the significance half of the fingerprinting pair; the identification-accuracy heatmap lives in ns_ana-zebrafish-ca-cross_day_match-identity_fingerprint. Both write Figure1_FC_fingerprinting.npy; this one additionally writes the SameLarva and DiffLarva vectors.

#### `ns_ana-zebrafish-ca-pearson-fc_matrix`

Build per-larva and group-average functional connectivity (FC) matrices from zebrafish whole-brain calcium imaging, by Gaussian-smoothing region-averaged ΔF/F₀ traces and computing Pearson correlations between brain regions. Use this whenever someone asks for a functional connectivity matrix, an FC matrix, a region-by-region correlation matrix, brain-wide functional coupling, or a group-averaged connectivity map from calcium time series — including phrasings like "correlate the regional activity", "how synchronized are the brain regions", or "average the connectivity across fish". This is the upstream step that produces Figure1_FC_matrix.npy and Figure1_FC_matrices.npy, which almost every structure–function, gradient, fingerprinting, and network-topology analysis in this dataset depends on, so reach for it before any of those.

#### `ns_ana-zebrafish-ca-tsne_hdbscan-cluster_scatter_plot`

Produce the 2-D t-SNE scatter plot of high-amplitude whole-brain coactivation events coloured by brain state, by embedding the event × region matrix with t-SNE, clustering the embedding with HDBSCAN, reassigning noise points to their best-correlating cluster centroid in the original region space, relabelling clusters by descending size, and drawing them as red/blue/black point clouds with colour-matched legend text. Reach for this when someone asks to visualize brain states, plot the t-SNE embedding of coactivation events, show clusters in low-dimensional space, "draw the state space", a scatter of network states, or a cluster-coloured t-SNE/UMAP-style map of zebrafish calcium events. It reads Figure4_events_high.npy and writes Figure4_events_high_clusters.npy and Figure4_events_high_embedding.npy — the same two artifacts that ns_seg-zebrafish-ca-tsne_hdbscan-brain_state_cluster writes, so pick one of the two and know that running both recomputes and overwrites them.

#### `ns_ana-zebrafish-ca-tsne_hdbscan-correlation_matrix_heatmap`

Cluster high-amplitude whole-brain coactivation events into discrete brain states by t-SNE-embedding the event × region matrix and running HDBSCAN on the 2-D embedding, reassigning every HDBSCAN noise point to its best-correlating cluster centroid, relabelling clusters by size, and rendering the event × event Pearson correlation matrix sorted by cluster to expose block-diagonal structure. Reach for this whenever someone asks for brain state clustering, discrete network states, functional repertoires, "how many states does the brain visit", state segmentation of coactivation events, t-SNE plus HDBSCAN on neural events, or a sorted/block-diagonal event correlation matrix from zebrafish calcium imaging. It reads Figure4_events_high.npy and writes Figure4_events_high_clusters.npy and Figure4_events_high_embedding.npy — the same two artifacts that ns_vis-zebrafish-ca-tsne_embedding-state_cluster_scatter writes, so pick one of the two and know that running both recomputes and overwrites them.

#### `ns_multi-mouse-ca-odor_tuning_ratio_chi_square-pie_plot`

Calculates and visualizes the percentage of excited, suppressed, and non-responsive granule cell-odor pairs by pooling task and passive condition datasets.

#### `ns_pre-zebrafish-ca-baseline_correlation_minfilter-dff_region_timeseries`

Turn raw motion-corrected zebrafish calcium fluorescence into ΔF/F₀ using a Gaussian-smoothed running-minimum baseline, then average per neuron down to one time series per atlas brain region, and render the stacked anterior-to-posterior ridge plot of regional traces with the visual-stimulus window marked. Use this whenever someone asks to compute ΔF/F₀, dF/F, delta F over F, baseline correction, photobleaching or drift removal, F0 estimation, region-averaged activity, regional calcium traces, or 'the raw fluorescence needs preprocessing before I can correlate anything' — and also for the classic stacked-traces figure showing every brain region's activity over time with the stimulus period shaded. This is the preprocessing step that stands between raw data.hdf5 timeseries and every correlation, connectivity, brain-state, and cofluctuation analysis in this dataset, so run it before ns_ana-zebrafish-ca-pearson-fc_matrix or any brain-state clustering.

#### `ns_pre-zebrafish-ca-detrend_minfilter_zscore-activity_state_matrix`

Build the cross-fish bilateral brain state matrix from zebrafish calcium imaging — load each larva''s 140-region left+right regional time series, apply a three-part symmetric exclusion rule (retina, zero-signal quality failures, bilateral pairing), detrend with a min-filter ΔF/F baseline, z-score each region over time, and concatenate all larvae along the time axis into a single (120, 19624) matrix. Reach for this whenever someone asks for a 'state matrix', 'brain state matrix', 'concatenated activity across fish', 'bilateral regional time series', 'z-scored regional activity heatmap', 'large-amplitude activity patterns across larvae', or needs the preprocessed input for co-fluctuation event detection or brain state clustering. This is the required upstream step for the entire Figure 4 chain: it writes Figure4_state_matrix.npy, Figure4_rseries.npy and Figure4_excluded_regions_bilateral.npy, and the co-fluctuation, event-clustering and t-SNE scatter recipes all fail without

#### `ns_vis-zebrafish-fc_atlas-edge_projection-network_map`

Draw the group-averaged functional connectivity network as an anatomical wiring diagram — regional centroids as nodes and FC strength as coloured edges — overlaid on the Mapzebrain top (XY) and side (XZ) brain projections, with the weakest quartile of connections hidden. Use this whenever someone wants to see connectivity on the brain rather than as a matrix: 'plot the FC network on the atlas', 'show the connectome anatomically', 'where are the strong functional connections in the brain', 'map the network onto brain anatomy', 'glass-brain view', 'node-and-edge brain graph', 'top and side view of the functional network', or 'are the strong connections long-range or local'. Reads Figure1_FC_matrix.npy and Figure1_excluded_regions.npy, mirrors the 65-region matrix to a bilateral 130-node graph via atlas centroids, and writes only a figure — no .npy artifacts — so reach for it after ns_ana-zebrafish-ca-pearson-fc_matrix when the goal is a publication-quality spatial rendering rather

### Molecular Modality

#### `ns_ana-mouse-omics-differential_gene-temporal_expression_profile`

Quantifies and visualizes differential gene expression across cortical cell subclasses between pre- and post-eye-opening developmental stages using pseudobulk statistical methods.

#### `ns_ana-mouse-omics-gam-expression_profile`

Analyzes and visualizes gene expression trends across developmental time points in neural lineages, classifying markers into Up, Transient, Down, or Constant trajectory patterns.

#### `ns_ana-mouse-omics-hierarchical_clustering-scatter_type_temporal_trajectory`

Quantifies and visualizes the evolution, emergence, and diversification of hierarchical cell clusters and subclusters across developmental time points.

#### `ns_ana-mouse-omics-hierarchical_clustering-type_temporal_trajectory`

Quantifies and visualizes the temporal dynamics of cell-type and subcluster counts across developmental stages in integrated scRNA-seq datasets to assess diversification trends.

#### `ns_vis-zebrafish-gene-zscore-expression_matrix_heatmap`

Render a grayscale heatmap of 290 genes across 65 zebrafish brain regions after within-region z-scoring. Use for regional expression-pattern visualization or for inspecting the expression matrix before structure-function comparisons; this recipe produces a figure and statistics but no NumPy artifact.

### Structural Modality

#### `ns_ana-zebrafish-connectome-pearson-corrcoef_distance_scatter_plot`

Quantifies how inter-regional connectivity varies with anatomical distance and visualizes the relationship with a correlation scatter plot.

#### `ns_ana-zebrafish-sc_matrix_anatomy-hierarchical_consensus_clustering-module_topography`

Project structural-connectome module membership onto zebrafish brain anatomy — plot the bilateral Mapzebrain region centroids as coloured nodes over the atlas top (XY) and side projections, one colour per consensus-Louvain module, to show where each module sits along the anterior-posterior axis. Reach for this whenever someone asks "where are these modules in the brain", "map the communities onto the atlas", "show the module topography", "are the structural modules spatially contiguous", "do the modules follow the forebrain-to-hindbrain axis", or wants the Figure 3C-style two-panel top-and-side anatomical view with a coloured module legend. It consumes Figure3_coassignment_matrix_SC_4module_ordered.npy plus the atlas centroids, writes no .npy artifact, and exists purely to produce the figure and its descriptive statistics.

#### `ns_ana-zebrafish-sc_matrix-eigen_spectrum-sc_scree_plot`

Draw the scree plot of the structural connectivity (SC) diffusion-map eigenvalue spectrum for the larval zebrafish brain — a black line of eigenvalue against gradient index, read from Figure6_SC_eigenvalues.npy — and summarise the spectrum (first, mean, median, min, max eigenvalue). Reach for this whenever someone asks for a scree plot, an eigenvalue spectrum, an eigenvalue decay curve, "how many gradients do I need", "where is the elbow", "show the relative importance of the SC gradients", "is the structural connectome low-dimensional", or any request to visualise or characterise the eigenvalues produced by the structural gradient decomposition. It writes no .npy artifacts and depends only on Figure6_SC_eigenvalues.npy from ns_multi-zebrafish-sc_ca-diffusion_map-connectivity_gradient; its refine script drops the dead custom-library imports entirely and runs on numpy and matplotlib alone, making it the most nearly executable recipe in this set. Its sibling ns_vis-zebrafish-ca-eigen_spectrum-fc_scree_plot does the same for the FC spectrum.

#### `ns_ana-zebrafish-sc_matrix-hierarchical_consensus_clustering-consensus_matrix_dendrogram`

This recipe identifies structural connectivity (SC) network modules in a zebrafish brain connectome using a hierarchical consensus clustering algorithm. It first generates a co-assignment probability matrix from an ensemble of 10,000 Louvain modularity partitions with varying resolution parameters, then applies Ward's hierarchical clustering to extract a specified number of modules (default 4). Modules are reordered by anterior-posterior anatomical position. The final visualization displays a dendrogram alongside the reordered co-assignment probability matrix with colored thick-edge boxes highlighting module boundaries.

#### `ns_ana-zebrafish-structure_connectivity-graph_predictor_pca-scree_plot`

Run PCA on the 40-column structural-predictor matrix built from the zebrafish directed and undirected structural connectome plus inter-regional Euclidean distances, and report per-component and cumulative explained variance for the first 10 principal components. Use this whenever someone asks how many dimensions the structural predictors really span, whether graph metrics are redundant or collinear, "how much variance does PC1 explain", "scree plot of the structural predictors", "do structural properties collectively contribute to functional connectivity", "can we compress the connectome features", or wants a dimensionality/redundancy check before regressing structure onto functional connectivity. This is the first step of the 2J→2K→2L chain: it establishes that one latent structural mode dominates, `ns_multi-zebrafish-sc_ca-pca_pc1-fc_prediction` then extracts that PC1 and correlates it with FC, and `ns_vis-zebrafish-sc_ca-scatter_polyfit-pc1_fc_regression` plots the relationship. Reach for it before assuming a multi-predictor SC→FC model needs all its predictors.

#### `ns_ana-zebrafish-swc-nblast-morphological_metric`

Classifies cerebellar efferent neurons from registered SWC morphologies using NBLAST similarity and hierarchical clustering.

#### `ns_ana-zebrafish-swc-nblast-morphology`

Performs NBLAST-based hierarchical clustering on SWC neuronal data and renders the resulting clusters within a 3D standard brain template using the navis library.

#### `ns_pre-zebrafish-cell_coordinate_anatomy-region_census-atlas_contour_map_cell_density`

Census every neuron from every zebrafish larva into Mapzebrain atlas regions, report the whole-brain neuron count per fish (mean ± SD), and derive the quality-control exclusion mask that every downstream analysis in this dataset filters by. Use this whenever someone asks how many neurons were recorded, how many cells map to each brain region, which regions are too sparsely sampled to trust, which regions should be dropped or excluded, how to build or regenerate Figure1_excluded_regions.npy, or wants the atlas region projection backgrounds for plotting neurons on brain anatomy — including phrasings like 'how well is each region sampled', 'drop the badly covered regions', 'how many cells per fish', 'show me where the neurons are in the brain', or 'set up the region filter'. This is the root of the entire pipeline: it writes Figure1_excluded_regions.npy, which 17 other recipes read, so run it first and treat its thresholds as a global parameter — changing them silently shifts

#### `ns_vis-zebrafish-sc_atlas-edge_projection-network_map`

This recipe produces a dual-panel figure visualizing the zebrafish brain structural connectivity (SC) network spatially mapped onto anatomical atlas projection images. It loads an undirected SC matrix, excludes specified brain regions, constructs a bilateral SC matrix by tiling, and renders both a dorsal (Top/XY) and lateral (Side/XZ) view. Regional centroids serve as network nodes plotted atop grayscale atlas backgrounds, with edges color-coded by connection strength using a blue-to-white colormap. The bottom quartile of edges is suppressed to reduce visual clutter, and stronger connections are drawn on top for emphasis.

#### `ns_vis-zebrafish-sc-module_sorted-sc_block_heatmap`

Render the undirected zebrafish structural connectome as a module-sorted block-diagonal heatmap — reorder the 65×65 SC matrix by the four consensus-Louvain module labels, square it element-wise to boost contrast, and draw thick black boxes around each module along the diagonal. Reach for this whenever someone asks to 'show the modules on the SC matrix', 'visualize the community structure of the structural connectome', 'block-diagonal connectivity matrix', 'sorted adjacency matrix with community boxes', 'are connections stronger within modules than between them', or wants the Figure 3B-style SC² heatmap with module outlines. It is the visual companion to the module partition: it consumes Figure3_coassignment_matrix_SC_4module_ordered.npy and the raw undirected SC matrix, writes no .npy artifact, and exists purely to produce the figure and its descriptive statistics.
