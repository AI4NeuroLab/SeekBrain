# Koninck_2025_Science_Advances Rubric 修订版

按 [`rubric_writing_SOP.md`](./rubric_writing_SOP.md) 三层金字塔（L1/L2/L3 文本 + L1/L2 视觉）重做。每个 panel 给出新版 JSON 与"Changes vs original"。

原始文件位于：`evaluate/evaluate_query/rubric/Koninck_2025_Science_Advances/Fig_*.json`

> ⚠️ Fig_5F 的前置假设：question 已被修复为与 figure 一致的"跨多条鱼 consensus 空间密度"任务（详见 [`rubric_review_Koninck_2025_Science_Advances.md`](./rubric_review_Koninck_2025_Science_Advances.md)）。如 question 保留原样（单鱼 calcium activity 时序），先修 question 再用此 rubric。

---

## Fig_1E — Group-averaged FC matrix

### 修订后 rubric

```json
{
  "tag": "Fig_1E",
  "rubrics": {
    "score_100": {
      "GT core conclusion": "Group-averaged functional connectivity matrix from ~22 zebrafish larvae, computed as pairwise correlations between region-averaged spontaneous calcium activity, reveals that intrinsic functional coupling clusters along anatomical divisions (telencephalon / mesencephalon / rhombencephalon), with the strongest within-group correlations in the hindbrain. This shows that anatomical organization shapes large-scale functional architecture even in the absence of task input.",
      "scoring_items": [
        {
          "type": "text", "layer": "L1", "point": 8,
          "criterion": "Identifies the output as a group-level functional connectivity matrix derived from spontaneous calcium activity, computed as pairwise correlations between region-averaged signals.",
          "deduction_rule": "Deduct 8 if FC vs SC is confused or correlation-based computation is missing. Deduct 4 if 'connectivity' is described without specifying its functional / correlation source."
        },
        {
          "type": "text", "layer": "L2", "point": 12,
          "criterion": "Interprets the visible block-diagonal pattern as evidence that functional coupling clusters along anatomical divisions — functional networks are not randomly distributed but organized along the telencephalon / mesencephalon / rhombencephalon axis.",
          "deduction_rule": "Deduct 12 if the model only reports 'a clustered pattern' without linking clusters to anatomical organization. Deduct 6 if anatomical alignment is mentioned but not framed as evidence of organized functional networks."
        },
        {
          "type": "text", "layer": "L3", "point": 12,
          "criterion": "Infers a biological principle from the FC organization: anatomically proximal / developmentally related regions exhibit stronger intrinsic functional coupling, consistent with structural connectivity and shared developmental origin shaping large-scale functional architecture even in the absence of task input. (mechanism / principle)",
          "deduction_rule": "Deduct 12 if no biological inference is offered. Deduct 6 if an organizational fact is stated without explaining WHY anatomy shapes functional coupling. Deduct 3 if the principle is correct but vague ('brain is organized')."
        },
        {
          "type": "text", "layer": "L3", "point": 8,
          "criterion": "Connects the strong hindbrain coupling to the broader interpretation that posterior brain circuits — supporting tightly coordinated motor and sensory-motor functions — exhibit greater intrinsic synchronization than more functionally specialized anterior regions. (functional)",
          "deduction_rule": "Deduct 8 if no functional interpretation of the posterior dominance is offered. Deduct 4 if posterior dominance is named but not linked to motor / sensorimotor coordination."
        },
        {
          "type": "visual", "layer": "L1", "point": 25,
          "criterion": "The generated FC heatmap shows a visible block-diagonal structure aligned with the three major anatomical divisions (telencephalon / mesencephalon / rhombencephalon) — regions within the same anatomical division have visibly stronger correlations than regions across divisions.",
          "deduction_rule": "Deduct 25 if no block structure is visible. Deduct 12 if blocks are present but do not align with anatomical divisions. Deduct 8 if only one of the three blocks is identifiable."
        },
        {
          "type": "visual", "layer": "L2", "point": 20,
          "criterion": "The hindbrain (rhombencephalon, posterior) block shows the strongest within-group correlations — visibly the most intense diagonal block compared to telencephalic and mesencephalic blocks, producing an anterior-to-posterior gradient.",
          "deduction_rule": "Deduct 20 if the strongest block is in the wrong anatomical region (e.g., forebrain shown strongest). Deduct 10 if all three blocks appear roughly equal in intensity, losing the anterior-posterior gradient."
        },
        {
          "type": "visual", "layer": "L2", "point": 15,
          "criterion": "Within-block correlations are visibly stronger than cross-block correlations across the matrix, producing a clear modular appearance consistent with anatomically organized functional connectivity (rather than uniform or off-diagonal-dominated patterns).",
          "deduction_rule": "Deduct 15 if intra-block vs inter-block contrast is absent or inverted. Deduct 8 if contrast is weak / patchy rather than a clear block pattern."
        }
      ],
      "Scoring instructions": "Stage 1: text items. Stage 2: visual items via side-by-side comparison of model-generated figure with gt figure, evaluating only scientifically meaningful patterns (no formatting checks)."
    }
  }
}
```

### Changes vs original

- **删除原版"22 larvae" / "65 regions" 计数复述项**：这些信息已在 question 中给出，模型复述题目无价值。
- **新增 L3 mechanism 项 (12 分)**：要求模型 infer 解剖学约束塑造功能架构的科学原理。
- **新增 L3 functional 项 (8 分)**：要求把"hindbrain 最强相关"与运动协调功能联系起来。
- **L1 占比从 ~100%（全 100 分都是描述性）降到 8%**。
- **新增视觉项 (60 分)**：原版完全无视觉评分，新版三条视觉项分别测 (a) 三块解剖块结构存在；(b) hindbrain 最强（方向正确）；(c) intra > inter block 对比。
- **删除**：原版"anterior-to-posterior ordering or stronger posterior/hindbrain correlations"被埋在 10 分的 either-or 项里，新版独立列为 visual L2 (20 分)。

---

## Fig_2B — SC network on brain anatomy

### 修订后 rubric

```json
{
  "tag": "Fig_2B",
  "rubrics": {
    "score_100": {
      "GT core conclusion": "Mesoscopic structural connectivity network of the larval zebrafish brain, with weighted interregional edges representing anatomical connection strength, shows bilaterally symmetric organization with denser connectivity in posterior brain regions and sparser connections in the most anterior forebrain. This wiring topology mirrors the brain's sensorimotor processing demands.",
      "scoring_items": [
        {
          "type": "text", "layer": "L1", "point": 10,
          "criterion": "Identifies the visualization as a structural / anatomical connectivity (SC) network where weighted edges represent interregional anatomical connection strengths, distinct from functional connectivity.",
          "deduction_rule": "Deduct 10 if confused with FC. Deduct 5 if connectivity is mentioned without distinguishing structural from functional, or if edges are described as binary."
        },
        {
          "type": "text", "layer": "L2", "point": 15,
          "criterion": "Interprets the visible bilateral symmetry as evidence that the network has been correctly bilateralized from a unilateral SC matrix, producing a left-right symmetric mesoscopic wiring diagram. Notes that posterior regions show denser connectivity than anterior forebrain.",
          "deduction_rule": "Deduct 15 if neither bilateral symmetry nor posterior-anterior gradient is conveyed. Deduct 8 if only one is mentioned."
        },
        {
          "type": "text", "layer": "L3", "point": 10,
          "criterion": "Infers that the bilateral organization reflects organized commissural / midline-crossing pathways and developmental symmetry of the vertebrate brain — i.e., structural symmetry is a fundamental architectural feature, not a methodological artifact. (mechanism)",
          "deduction_rule": "Deduct 10 if no mechanism interpretation is offered. Deduct 5 if symmetry is named without linking it to commissural pathways or developmental architecture."
        },
        {
          "type": "text", "layer": "L3", "point": 5,
          "criterion": "Connects the posterior-dominant edge density to the broader interpretation that hindbrain / midbrain require dense interregional integration for motor and sensorimotor coordination, while specialized anterior regions are more locally clustered. (functional)",
          "deduction_rule": "Deduct 5 if no functional interpretation of the posterior dominance is offered."
        },
        {
          "type": "visual", "layer": "L1", "point": 15,
          "criterion": "The generated visualization renders nodes (regional centroids) and weighted edges connecting them, with edges showing heterogeneous strengths — strong / prominent edges and weak / faint edges coexist, reflecting the weighted (not binary) nature of the SC matrix.",
          "deduction_rule": "Deduct 15 if all edges appear at uniform intensity (loss of weighting). Deduct 8 if only 2-3 discrete strength levels are visible. Deduct 5 if no edges are drawn."
        },
        {
          "type": "visual", "layer": "L2", "point": 25,
          "criterion": "The top view shows clear left-right bilateral symmetry across the midline — both hemispheres are populated and the network pattern mirrors across the sagittal axis, consistent with the bilateralized SC matrix.",
          "deduction_rule": "Deduct 25 if only one hemisphere is connected. Deduct 15 if symmetry is broken (one side noticeably denser than the other). Deduct 10 if midline-crossing edges are entirely absent."
        },
        {
          "type": "visual", "layer": "L2", "point": 20,
          "criterion": "Connection density is visibly higher in posterior / mid-brain regions and sparser in the most anterior forebrain, matching the gt spatial gradient of structural connectivity (not uniform distribution and not anterior-dominant).",
          "deduction_rule": "Deduct 20 if density distribution is uniform or inverted (anterior denser than posterior). Deduct 10 if the gradient is weak."
        }
      ],
      "Scoring instructions": "Stage 1: text items. Stage 2: visual items via side-by-side comparison."
    }
  }
}
```

### Changes vs original

- **删除原版"single-neuron reconstructions" 项 (25 分)**：question 中没有提供 SC 矩阵的来源，模型无从知晓"边来自重建神经元"，原版本质要求论文级背景知识。新版改为评估模型对 question 中**实际给出**的信息（bilateral 化、加权 edge）的理解。
- **删除原版"weakest quartile not displayed" 项 (10 分)**：question 也未要求过滤弱边，是论文额外可视化处理。
- **新增 L3 mechanism 项 (10 分)**：要求 infer 双侧对称背后的 commissural pathway / 发育对称性。
- **新增 L3 functional 项 (5 分)**：把 posterior dominance 与 motor / sensorimotor 协调需求联系。
- **新增视觉项 (60 分)**：原版完全无视觉评分；新版分 weighted edges 存在 (L1)、bilateral 对称 (L2)、posterior-anterior 密度梯度 (L2) 三项。
- **L1 占比降到 10%**。

---

## Fig_3A — Coassignment matrix with hierarchical modules

### 修订后 rubric

```json
{
  "tag": "Fig_3A",
  "rubrics": {
    "score_100": {
      "GT core conclusion": "Hierarchically clustered structural-module coassignment probability matrix shows that zebrafish brain regions group consistently into structural modules across iterative Louvain partitions, with four modules of unequal size revealing nested hierarchical organization. This indicates that the structural connectome partitions into anatomically meaningful subnetworks at multiple scales, consistent with the broader principle of hierarchical modularity in brain architecture.",
      "scoring_items": [
        {
          "type": "text", "layer": "L1", "point": 10,
          "criterion": "Identifies the matrix entries as the probability / frequency that pairs of regions are assigned to the same module across many iterative Louvain modularity runs (i.e., a consensus / coassignment matrix), not raw connectivity values.",
          "deduction_rule": "Deduct 10 if matrix is described as raw SC or FC. Deduct 5 if 'modules' are mentioned without explaining the consensus / coassignment meaning."
        },
        {
          "type": "text", "layer": "L2", "point": 15,
          "criterion": "Interprets the block-diagonal structure as evidence that the structural connectome partitions into modular subnetworks, with regions preferentially clustered into communities of varying sizes — and uses the dendrogram to read off nested hierarchical relationships among modules.",
          "deduction_rule": "Deduct 15 if modular organization is not extracted from the matrix. Deduct 8 if structural modularity is named but the hierarchical / nested aspect is missing."
        },
        {
          "type": "text", "layer": "L3", "point": 15,
          "criterion": "Infers that the structural connectome's modular partition reflects functionally specialized anatomical subsystems, where one large module likely captures a hub-like integrative system and smaller modules represent more specialized circuits. (functional / mechanism)",
          "deduction_rule": "Deduct 15 if no functional interpretation of the modules is offered. Deduct 8 if functional specialization is mentioned without anchoring to the module-size hierarchy."
        },
        {
          "type": "text", "layer": "L3", "point": 15,
          "criterion": "Connects the hierarchical modularity to the broader principle that brain networks across species exhibit nested modular organization at multiple scales, supporting parallel processing and balanced segregation / integration. (principle / theoretical)",
          "deduction_rule": "Deduct 15 if no broader-principle linkage. Deduct 8 if linked vaguely ('brain is hierarchical') without specifying segregation / integration trade-off or cross-species generality."
        },
        {
          "type": "visual", "layer": "L1", "point": 15,
          "criterion": "The generated matrix shows visible block-diagonal structure: within-module diagonal blocks have substantially higher coassignment probability than off-diagonal cross-module regions, producing a clear modular appearance.",
          "deduction_rule": "Deduct 15 if no block-diagonal structure is visible. Deduct 8 if contrast is reversed (off-diagonal higher than diagonal)."
        },
        {
          "type": "visual", "layer": "L2", "point": 20,
          "criterion": "Four modules along the diagonal are clearly distinguishable with visibly UNEQUAL sizes — one module spans a substantially larger fraction of the regions than the others, matching the gt where the first module covers the largest portion and the others are smaller.",
          "deduction_rule": "Deduct 20 if number of distinguishable modules ≠ 4. Deduct 12 if all four modules appear roughly equal in size (loss of size hierarchy). Deduct 8 if module boundaries do not align with the diagonal."
        },
        {
          "type": "visual", "layer": "L2", "point": 10,
          "criterion": "Dendrogram structure exposes nested / hierarchical relationships among modules — at least one pair of modules is visibly more closely related (joined at a lower height) than the rest, rather than all modules joining at a single flat level.",
          "deduction_rule": "Deduct 10 if dendrogram is absent. Deduct 5 if dendrogram is shown but flat (no hierarchy visible)."
        }
      ],
      "Scoring instructions": "Stage 1: text items. Stage 2: visual items via side-by-side comparison."
    }
  }
}
```

### Changes vs original

- **新增 L3 functional 项 (15 分)**：要求 infer 模块对应功能专门化子系统。
- **新增 L3 principle 项 (15 分)**：连接到跨物种"嵌套模块化"和 segregation / integration 平衡的原理。
- **新增视觉项 (45 分)**：原版完全无视觉评分；新版三条视觉项测 (a) block 对角结构存在；(b) 4 个不等大模块（size hierarchy 是科学相关 detail）；(c) dendrogram 嵌套层次。
- **删除原版"hierarchical clustering applied" / "Ward's linkage" 任务复述项**：question 已包含。
- **L1 占比从 ~75% 降到 10%**。

---

## Fig_5F — Spatial density maps of 4 sensorimotor populations

> 假设 question 已修复为"跨鱼 consensus 空间密度"任务。

### 修订后 rubric

```json
{
  "tag": "Fig_5F",
  "rubrics": {
    "score_100": {
      "GT core conclusion": "Consensus spatial density maps of four sensorimotor neuronal populations across larvae show that motor-positive cells distribute broadly through the hindbrain, motor-negative cells form smaller clusters, dark-responsive cells concentrate in anterior visual-related regions, and light-responsive cells exhibit a striking left-habenular lateralization. These populations span much of the larval brain but occupy largely distinct spatial territories, indicating functional segregation of sensorimotor pathways and a known lateralization of light processing in the zebrafish habenula.",
      "scoring_items": [
        {
          "type": "text", "layer": "L1", "point": 10,
          "criterion": "Identifies four functionally defined cell populations defined by correlations with motor and visual variables (motor-positive, motor-negative, dark-responsive, light-responsive), with maps reflecting consensus / group-level distributions across multiple larvae.",
          "deduction_rule": "Deduct 10 if the four populations are not enumerated. Deduct 5 if presented as a single-fish snapshot rather than group-level."
        },
        {
          "type": "text", "layer": "L2", "point": 10,
          "criterion": "Interprets the four density maps as showing largely distinct spatial territories — these populations together cover much of the brain but their hotspots do not extensively overlap.",
          "deduction_rule": "Deduct 10 if extensive overlap is implied. Deduct 5 if the brain-wide-but-segregated framing is missing."
        },
        {
          "type": "text", "layer": "L3", "point": 15,
          "criterion": "Infers that motor and visual processing are spatially segregated into distinct neuronal populations, supporting parallel processing of different sensorimotor modalities rather than mixed multimodal coding within a shared cell pool. (functional)",
          "deduction_rule": "Deduct 15 if no functional interpretation of segregation is offered. Deduct 8 if segregation is mentioned without contrasting with mixed / multimodal coding."
        },
        {
          "type": "text", "layer": "L3", "point": 15,
          "criterion": "Interprets the left-habenular lateralization of light-responsive cells as evidence for an asymmetric circuit specialization for light processing, consistent with the well-known habenular asymmetry in zebrafish — i.e., this lateralization is a meaningful biological feature, not noise. (mechanism / comparative)",
          "deduction_rule": "Deduct 15 if no interpretation of the asymmetry is offered. Deduct 8 if asymmetry is named without connecting to known zebrafish habenular lateralization. Deduct 12 if the answer claims the asymmetry is artifactual or random."
        },
        {
          "type": "visual", "layer": "L2", "point": 15,
          "criterion": "Motor-positive density is visibly distributed across the hindbrain (posterior brain), forming a broad posterior-dominant pattern, while motor-negative density is visibly more restricted / clustered with smaller hotspots than motor-positive.",
          "deduction_rule": "Deduct 15 if motor-positive is shown anterior-dominant. Deduct 10 if motor-positive and motor-negative show identical / inverted distributions. Deduct 8 if motor-positive is too localized."
        },
        {
          "type": "visual", "layer": "L2", "point": 15,
          "criterion": "Dark-responsive density is concentrated in anterior-to-middle visual-related regions (optic tectum / cerebellum / forebrain area), visibly anterior-dominant relative to motor populations.",
          "deduction_rule": "Deduct 15 if dark-responsive is shown in posterior hindbrain (visually opposite to gt). Deduct 8 if anterior coverage is sparse."
        },
        {
          "type": "visual", "layer": "L2", "point": 15,
          "criterion": "Light-responsive density shows clear LEFT-RIGHT ASYMMETRY in the top view, with the densest region located in the LEFT habenula. This lateralization is the key scientific finding of the panel.",
          "deduction_rule": "Deduct 15 if distribution is bilateral or symmetric. Deduct 12 if asymmetry is reversed (right-side enriched). Deduct 8 if light-responsive is broadly spread without a single focal hotspot."
        },
        {
          "type": "visual", "layer": "L1", "point": 5,
          "criterion": "Relative population abundance follows the rank order: dark-responsive > motor-positive >> motor-negative ≈ light-responsive (visible from total cell counts or relative density saturation).",
          "deduction_rule": "Deduct 5 if rank order is wrong. No deduction if rank is preserved but absolute counts deviate."
        }
      ],
      "Scoring instructions": "Stage 1: text items. Stage 2: visual items via side-by-side comparison."
    }
  }
}
```

### Changes vs original

- **新增 L3 functional 项 (15 分)**：要求 infer 运动 vs 视觉的空间分离 → 平行处理而非多模态共享编码。
- **新增 L3 mechanism / comparative 项 (15 分)**：要求把 left habenula 侧化与已知斑马鱼 habenular asymmetry 文献联系起来。
- **强化 light-responsive 左侧化 visual 项 (15 分)**：原版只有 10 分含蓄涉及，新版独立 L2 visual 项，明确 deduction 处理 reversed / bilateral / spread 三种错误情况。
- **保留并合并 motor / dark 分布 visual 项**：原版有四条独立项（motor+ 20, motor- 15, dark 20, light 10），新版按重要性合并为三条 L2 visual。
- **新增"rank order of cell counts" L1 visual (5 分)**：4 类细胞总数差一个量级是有科学含义的相对丰度信号。
- **删除原版**："overall brain-wide yet segregated organization" 部分整合到 L2 text 项。

---

## 总体修订要点汇总

1. **L1 占比**：原版 60-100% → 新版 10-15%。
2. **L3 占比**：原版基本无 → 新版 30-40%（每个 panel 至少 2 条 L3 项，覆盖 mechanism / functional / principle）。
3. **视觉项**：原版完全无 → 新版 45-60%。
4. **删除论文级背景知识依赖**：Fig_2B 的 "single-neuron reconstructions" 这类 question 上下文外的信息不再作为评分项。
5. **关键科学 pattern（每 panel 至少一个 L2 visual）**：
   - Fig_1E: hindbrain 块最强 + anterior-posterior 梯度
   - Fig_2B: bilateral 对称 + posterior dense 梯度
   - Fig_3A: 4 模块**不等大** + dendrogram 嵌套层次
   - Fig_5F: 左 habenula 侧化（核心科学发现）+ 四类细胞空间区位差异

---

## 通用 Scoring 流程

> Stage 1 — Text Scoring: 对模型输出的文本结论部分逐条核对 `type: "text"` 项；L1/L2/L3 项分别独立累计。
>
> Stage 2 — Visual Scoring: 对模型生成的图像与 gt 图并排比较，逐条核对 `type: "visual"` 项；只评科学 pattern 是否一致，不评配色 / 坐标 / 布局 / scale bar 等格式细节。
>
> Total = sum(text) + sum(visual)，满分 100。

---

## 与之前 `rubric_revision_Koninck_2025_Science_Advances.md` 的关系

之前的 `rubric_revision_*.md` 是**视觉项独立设计版**（提出 visual rubric 概念但还没做三层分层）。本文件按 SOP **进一步引入 L1/L2/L3 文本分层**，并对所有 L3 项给了机制 / 原理 / 功能的具体写法，是**当前推荐使用的版本**。建议把之前的 revision 文件视为过渡稿，以本文件为准。
