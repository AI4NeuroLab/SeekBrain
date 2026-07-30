# SeekBrain

[![Built on pi](https://img.shields.io/badge/Built_on-pi-24292f?style=flat-square)](https://github.com/earendil-works/pi)
![Node.js >=22.19](https://img.shields.io/badge/Node.js-%3E%3D22.19-339933?style=flat-square&logo=nodedotjs&logoColor=white)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](LICENSE)

SeekBrain is an open-source, domain-specialized multi-agent framework for
semi-autonomous neuroscience discovery. It transforms broad scientific questions
and heterogeneous, multimodal brain data into hierarchical research plans,
executable analysis pipelines, validated figures and statistics, and
evidence-grounded conclusions—while keeping researchers in the loop.

## News

- **2026-07-17** — SeekBrain was released at the WAIC 2026 Science Frontiers Forum.

## Get started

> [!NOTE]
> SeekBrain requires Node.js 22.19 or newer and a supported model-provider API
> key. Node.js 24 is recommended.

Install SeekBrain from npm:

```bash
npm install --global seekbrain
```

Launch it:

```bash
seekbrain
```

On first launch, SeekBrain guides you through model routing and literature-provider
setup. To see all commands and options, run:

```bash
seekbrain --help
```

## How it works

SeekBrain adapts its workflow to what you provide.

<p align="center">
  <img src="assets/readme/workflow.png" alt="SeekBrain workflow" width="100%">
</p>

<p align="center"><em>Figure 1. SeekBrain couples a Research Planning Engine and an Analysis Execution Engine with a co-evolving Neuroscience Analysis Repertoire and hierarchical evidence reporting.</em></p>

### Explore a dataset

Enter a dataset directory:

```text
path/to/dataset
```

SeekBrain profiles the dataset and constructs canonical metadata describing its
scientific assets, repeated experimental units, conditions, modalities, data
shapes, axis semantics, and execution-relevant relationships. It then gives you
a compact dataset overview and recommends 3–5 concrete research directions
supported by the available data.

No analysis begins until you select one of the suggested directions or provide
your own question.

### Run a neuroscience study

Enter a research question together with the dataset:

```text
How does neural activity differ between the experimental conditions?

Dataset: path/to/dataset
```

SeekBrain launches its standard Analysis Execution workflow:

```text
dataset resolution
  → recipe-grounded analytical formulation
  → researcher review
  → code generation and execution
  → scientific validation
  → evidence-grounded interpretation
```

The Formulation Agent converts the question into a reviewable methodological
schema. The Code Agent translates the approved schema into executable Python
scripts and produces figures and quantitative statistics. A Validation Agent
reviews the resulting evidence, and an Interpretation Agent generates a
scientific conclusion with explicit limitations.

#### Example: hierarchical zebrafish SC modules

SeekBrain includes a compact structural-connectivity dataset from Légaré et al.,
*Structural and genetic determinants of zebrafish functional brain networks*
(*Science Advances*, 2025). It contains the original 70 × 70 directed SC matrix
and the five region indices excluded in the paper's analysis.

Enter the following question and bundled dataset path directly in SeekBrain:

```text
I want to identify structural connectivity (SC) network modules through a hierarchical consensus algorithm. First, generate a co-assignment probability matrix of SC based on the iterative Louvain algorithm for maximization of modularity. Then, generate the list of module labels by using hierarchical clustering (Ward’s linkage) on the co-assignment matrix of SC. Highlight a partition with 4 modules with thick-edge boxes on the co-assignment probability matrix of SC. Plot the dendrogram along the left side of the matrix. Use SC_matrix_directed_terminals_expanded.npy in ZEBRAFISH_PATH for analysis and visualization. Before analysis, use excluded_regions.npy to identify regions to exclude from the SC matrix.

dataset: "$(npm root --global)/seekbrain/examples/zebrafish-sc-network-modules"
```

The original panel and a SeekBrain reproduction from the same two input files
are shown below. Because the Louvain ensemble is stochastic, exact module labels
can vary slightly between runs while preserving the consensus structure.

<table>
  <tr>
    <td align="center" width="42%">
      <img src="assets/readme/zebrafish-sc-modules-original.png" alt="Original Figure 3A structural-connectivity co-assignment matrix" width="100%"><br>
      <em>Original Figure 3A from Légaré et al. (2025).</em>
    </td>
    <td align="center" width="58%">
      <img src="assets/readme/zebrafish-sc-modules-seekbrain.png" alt="SeekBrain reproduction of the structural-connectivity module analysis" width="100%"><br>
      <em>SeekBrain reproduction.</em>
    </td>
  </tr>
</table>

The processed source dataset is available under
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) at
[doi:10.5683/SP3/IIVGOB](https://doi.org/10.5683/SP3/IIVGOB), with analysis code
at [pdesrosiers/Legare-zebrafish-brain-networks](https://github.com/pdesrosiers/Legare-zebrafish-brain-networks).

### Investigate a broad question with Research Planning

For a complex, multi-part scientific objective, you can request Research Planning
directly:

```text
Use Research Planning mode to investigate how individual variability,
brain-network organization, and behavior are related across this dataset.

Dataset: path/to/dataset
```

SeekBrain may also recommend Research Planning automatically when the question
requires multiple linked hypotheses or analyses. You remain in control of whether
to use it.

The Research Planning Engine conducts a literature-grounded background survey,
decomposes the objective into dataset-grounded sub-questions and executable
analysis tasks, and subjects the plan to scientific review. After researcher
approval, task-level recipes, scientific context, and methodological schemas are
prepared in parallel. Approved tasks enter independent execution pipelines
without waiting for the remaining task reviews.

Completed task evidence is synthesized hierarchically:

```text
task-round evidence
  → sub-question conclusions
  → overall scientific conclusion
  → academic report
```

Run the following command to select completed task rounds and generate the final
report:

```text
/seekbrain-report
```

## Highlights

### A neuroscience-specific analytical repertoire

SeekBrain ships with **68 foundational, curated analysis recipes** spanning the
workflow from data preprocessing to statistical analysis, modeling, and
visualization.

The repertoire covers neural dynamics, behavior, structural and anatomical data,
molecular data, and multimodal analyses. Each recipe links a scientific objective
to its required data, processing and modeling steps, expected outputs,
visualization logic, and corresponding executable code. SeekBrain can retrieve,
adapt, and combine these recipes for new research questions rather than treating
them as fixed templates.

Together, the recipes form a **Neuroscience Analysis Repertoire** that supplies
task-conditioned analytical priors for new research problems. In BrainArena,
removing the repertoire reduced the mean score from 75.8 to 63.2
(*P* < 0.0001), demonstrating its importance for method correctness, faithful
figures, and scientifically valid interpretation.

### Learn from validated research trajectories

After a run has passed Validation, you can distill its plan, code, execution
history, results, and researcher feedback into a reusable recipe:

```text
/seekbrain-save-recipe
```

To save a specific run or Research Planning task round:

```text
/seekbrain-save-recipe <run-id>
```

The resulting recipe removes incidental details such as local paths and
dataset-specific variable names while retaining the reusable methodological
sequence and expected outputs. It is added to the user's recipe collection and
can be retrieved in future analyses.

### Researcher-in-the-loop validation

Researchers can review and revise the hierarchical research plan, methodological
schemas, and task rounds. Code generation and scientific validation form a
closed loop, allowing concrete problems to be repaired before interpretation
while preserving visible limitations when the available evidence is incomplete.

### Parallel hierarchical research

Research Planning connects broad biological objectives to concrete computational
tasks. Independent task branches can prepare methods and execute concurrently,
while task-level evidence remains linked to its originating sub-question,
hypothesis, plan, and round.

### Traceable academic reports

Research Planning projects support explicit report generation through:

```text
/seekbrain-report
```

Researchers can select one or multiple completed rounds from any task. The Report
Agent aggregates key findings, supporting statistics, figures, and limitations
from task-level evidence into sub-question conclusions and then into an overall
answer.

The built-in reporter produces a publication-style `report.md` and `report.pdf`
with a title, abstract, introduction, results with cited figures, discussion,
conclusion, and limitations. Conclusions remain traceable to their supporting
task rounds and generated artifacts.

## Paper

**SeekBrain: An Autonomous Multi-Agent Framework for Accelerating Neuroscience Discovery**

### Overview

SeekBrain accelerates neuroscience discovery through domain-grounded hierarchical
planning and cross-modal data analysis. It combines a dynamically evolving
Neuroscience Analysis Repertoire with a Research Planning Engine, an Analysis
Execution Engine, scientific validation, and researcher-in-the-loop feedback.

On the expert-annotated BrainArena benchmark, SeekBrain outperformed Claude Code
and Codex by 11.7% and 17.7%, respectively. The contribution extends beyond
benchmark performance: two real-world studies demonstrate its ability to support
both researcher-directed exploration and agent-led hypothesis testing.

### Structured neural representations of zebrafish behavior

In a multimodal dataset from free-moving larval zebrafish, SeekBrain integrated
tail kinematics, brain-wide calcium dynamics, and anatomy. It identified three
behavioral bout types and learned an eight-dimensional neural representation that
decoded these types with an accuracy of 0.949 ± 0.034.

After cross-fish alignment, matching behavioral clusters showed significantly
more similar neural geometry than nonmatching clusters
(*P* = 2.44 × 10⁻⁴, *n* = 13 larvae). Behaviorally tuned neural signals were
distributed from forebrain to hindbrain, revealing structured and distributed
brain-wide representations of behavioral types.

<p align="center">
  <img src="assets/readme/zebrafish-discovery.png" alt="Structured and distributed brain-wide neural representations of behavioral types in free-moving larval zebrafish" width="100%">
</p>

<p align="center"><em>Figure 2. Structured and distributed brain-wide neural representations of behavioral types in free-moving larval zebrafish.</em></p>

### A shared axis of regional decoding strength in mouse brain

In an agent-led reanalysis of the International Brain Laboratory mouse
decision-making dataset, SeekBrain tested whether five regional decoder maps—
stimulus, choice, feedback, speed, and velocity—shared a common organization
across 201 brain regions.

The first principal component explained 63.2% of the variance, exceeding a
5,000-permutation null distribution (*P* ≈ 0.0002). Rank-based PCA reproduced
the same regional axis (*r* = 0.96). Movement explained part, but not all, of
this organization: stimulus, choice, and feedback retained distinct regional
patterns after speed- and velocity-related variation was removed.

<p align="center">
  <img src="assets/readme/mouse-shared-axis.png" alt="Shared axis of regional decoding strength and task-specific residual patterns in mouse brain" width="100%">
</p>

<p align="center"><em>Figure 3. A shared axis of regional decoding strength and task-specific residual patterns in a mouse decision-making task.</em></p>

Together, these studies show that SeekBrain can perform cross-modal analyses,
test data-grounded hypotheses, and help researchers explore existing datasets in
new ways.

## Acknowledgements

SeekBrain is built on [Pi](https://github.com/earendil-works/pi), whose agent
runtime and terminal interface provide the foundation for its interactive
research workflow. We thank the Pi maintainers and contributors for making this
open-source infrastructure available.

The built-in academic report pipeline uses
[PDFKit](https://github.com/foliojs/pdfkit) for PDF generation,
[Marked](https://github.com/markedjs/marked) for Markdown processing, and the
[STIX General font family](assets/fonts/LICENSE_STIX.txt) for scientific
typesetting. We thank their maintainers and contributors. Third-party licenses
and font notices are listed in
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

We also acknowledge the neuroscience researchers and open-data initiatives whose
public datasets, publications, and code repositories make reproducible,
data-driven discovery possible.

## License

SeekBrain is released under the [MIT License](LICENSE).
