# 其他论文 Rubric Audit 报告

按 [`rubric_writing_SOP.md`](./rubric_writing_SOP.md) 的标准（L1/L2/L3 三层金字塔 + 独立视觉项）抽查 Adam_2023_Cell、Komiyama_2025_Science、Michael_2019_Neuron 三篇论文的 rubric。

抽查 panels：
- Adam: Fig_1H、Fig_2C、Fig_3B
- Komiyama: Fig_2B、Fig_5F
- Michael: Fig_5A、Fig_8B

---

## 总体诊断：三篇论文都有 SOP 违规，但严重程度不一

| 问题 | Adam | Komiyama | Michael | 与 Findling/Koninck 对比 |
|------|------|----------|---------|------------------------|
| L1 占比过大 (>50%) | ✅ 严重 | ⚠️ 中等 | ✅ 严重 | 相同问题 |
| L3 占比 < 20% | ✅ 严重 | ✅ 严重（多为 10pt） | ⚠️ 部分（Fig_8B 较好） | 相同问题 |
| 完全无视觉评分项 | ✅ | ✅ | ✅ | 相同问题 |
| 描述性动词主导 | ✅ | ✅ | ✅ | 相同问题 |
| Question/figure 错配 | 未发现 | 未发现 | 未发现 | 比 Koninck Fig_5F 好 |
| 要求 question 外背景知识 | ⚠️ 轻微 | 未发现 | ⚠️ Fig_5A 引入了"功能特化"作为主要扣分点 | 比 Koninck Fig_2B 好 |

---

## 各论文具体问题

### Adam_2023_Cell

#### Fig_1H — C. elegans 神经元编码速度的不同时间尺度

**评分项分布**：

| 项 | 分值 | 类型 | 评价 |
|----|------|------|------|
| "states velocity-related timescale encoding" | 30 | L1 | 复述 question |
| "explains EWMA method" | 25 | L1 | 复述 question 中给出的方法 |
| "reports sub-second to tens of seconds range" | 20 | L1 | 数值复述 |
| "notes longer timescales exceed GCaMP7f kinetics" | 15 | L2 | 还可以——把模式对照 control |
| "biological interpretation: integrate past vs present" | 10 | L3 | **只有 10 分** |

**问题**：
- L1 占 75%，L3 仅 10%
- 完全无视觉评分项，但这张图本身就是三条 trace 对比（即时 / 中等 / 长时程速度滤波）—— 视觉 pattern 是核心信息（trace 越长时程越平滑）
- **缺失的 L3**：(a) 神经元作为时间积分器的功能含义；(b) 行为历史可被神经活动以多个时间尺度并行表示的计算原理；(c) 与传统"瞬时表征"假设的对比

#### Fig_2C — Half-decay time 的 ECDF

**评分项分布**：25 + 20 + 20 + 15 + 20 = 100

| 项 | 类型 | 评价 |
|----|------|------|
| "shows distribution of encoding timescales" (25) | L1 | 复述 |
| "identifies as ECDF of median half-decay time" (20) | L1 | 复述 |
| "CePNEM-derived, restricted to encoding neurons" (20) | L1 | 复述 |
| "shading is across-animal SD" (15) | L1 | 复述 |
| "main result: most short, subset extends to tens of s" (20) | L2 | 唯一接近解读层的项 |

**问题**：
- L1 占 80%，无 L3
- 没有任何 inference 类项目（ECDF 形状揭示了什么？continuous spectrum 还是 bimodal？这关乎"连续 timescales"的科学论断）

#### Fig_3B — UMAP 中 feeding 编码

**评分项分布**：20 + 25 + 15 + 30 + 10 = 100

| 项 | 类型 | 评价 |
|----|------|------|
| "identifies UMAP embedding" (20) | L1 | 复述 |
| "feeding tuning" (25) | L1 | 复述 |
| "color = activated vs inhibited" (15) | L1 | 复述 |
| **"continuous gradient rather than discrete clusters" (30)** | **L2** | 较好的 pattern 解读 |
| "model-derived / population-level" (10) | L1 | 复述 |

**问题**：
- 30 分的 "continuous gradient" 是这张图唯一的 L2，方向对但缺乏 L3 升华
- **缺失的 L3**：连续梯度组织对脑表征的含义——大脑用 graded 而非分立的 functional types 编码行为，与"细胞类型分类学"假设形成对比
- 完全无视觉项，但这张图本质就是视觉 pattern（绿色与紫红色在 UMAP 中是渐变 vs 分离？）—— 视觉评测对该 panel 几乎是必需

---

### Komiyama_2025_Science

#### Fig_2B — GLM-HMM 状态分解

**评分项分布**：25 + 25 + 20 + 20 + 10 = 100

| 项 | 类型 | 评价 |
|----|------|------|
| "trial-by-trial choices + posterior probabilities" (25) | L1 | 复述 |
| "identifies engaged / left-biased / right-biased states" (25) | L1 | 复述（question 已给出） |
| "within-session transitions" (20) | L2 | OK，pattern 读取 |
| "behavioral interpretation of engaged vs biased" (20) | L2 / weak L3 | 半解读 |
| "connection to broader analysis" (10) | L3 | **L3 只有 10 分** |

**问题**：
- L1 50%，L3 10%
- 没有视觉项，但这张图的关键科学信号在视觉里：状态切换的**清晰程度**（posterior 接近 0 或 1，不是中间值）
- **缺失的 L3**：(a) 状态切换说明 mouse 行为不是 stationary process；(b) 隐变量建模为分析神经数据提供了行为相关的分层

#### Fig_5F — Granule cell 运动响应的 baseline vs ITI

**评分项分布**：20 + 20 + 25 + 25 + 10 = 100

| 项 | 类型 | 评价 |
|----|------|------|
| "shows motion energy + granule cell activity" (20) | L1 | 复述 |
| "baseline-vs-ITI in task / passive" (20) | L1 | 复述 |
| **"task: reduction during ITI" (25)** | **L2** | 关键 pattern |
| **"passive: persists / increases" (25)** | **L2** | 关键对比 pattern |
| "context-dependent suppression interpretation" (10) | L3 | **L3 只有 10 分** |

**问题**：
- L2 视觉 pattern 占 50%（合理），但**这些是用文字描述图像 pattern，没有真正的图像对比项**
- L3 仅 10 pt——缺失"上下文调制 = 注意力 / 任务相关 gain control"的解读
- 应当增加视觉 L2 项：评测模型对比生成图与 gt 图，验证 task 列 ITI 时 heatmap 颜色变暗、passive 列不变的方向是否对

---

### Michael_2019_Neuron

#### Fig_5A — 121 个小脑投射神经元的 NBLAST + Ward 聚类树

**评分项分布**：18 + 12 + 15 + 20 + 20 + 15 = 100

| 项 | 类型 | 评价 |
|----|------|------|
| "121 cells, NBLAST pairwise similarity" (18) | L1 | 复述 |
| "Ward's hierarchical clustering" (12) | L1 | 复述 |
| "8 major clusters" (15) | L1 | 数值复述 |
| "PCs form single homogeneous cluster" (20) | L2 | pattern 读取 |
| "ECs across 7 clusters" (20) | L2 | pattern 读取 |
| **"functional specialization implication" (15)** | **L3** | 较好但只有 15 分 |

**问题**：
- L1 占 45%，L3 仅 15%
- **L3 内容不在 question 中**：question 只描述了聚类方法和数据，question 末尾确实提到 "PCs exclusively send their projections to the MON, whereas ECs provide a more diverse output" —— 但 "functional specialization within cerebellar output pathway" 作为 L3 有部分背景知识依赖
- **完全无视觉项**：这张图就是一棵 dendrogram，关键视觉信号包括 (a) 8 个分支颜色清晰；(b) cluster 7（PC 灰色）单独成支不与其他簇混合；(c) 各分支高度差异
- **缺失的 L3**：morphology heterogeneity → projection diversity 的发育/进化原理

#### Fig_8B — 距离 vs 连接强度散点图

**评分项分布**：15 + 20 + 15 + 25 + 25 = 100

| 项 | 类型 | 评价 |
|----|------|------|
| "72 regions parcellation" (15) | L1 | 复述 |
| "normalized connection strength calculation" (20) | L1 | 复述 |
| "plotted vs Euclidean distance" (15) | L1 | 复述 |
| **"R = -0.39, exponential decay" (25)** | **L2** | 关键定量 pattern |
| **"economic network organization minimizing wiring" (25)** | **L3** | **真正的 L3 项！** |

**评价**：
- 这是抽查中**最接近 SOP 标准**的 panel：L3 占 25%，对应"wiring economy"原理
- 仍然 L1 占 50%，可压缩
- **完全无视觉项**：散点图的视觉 pattern（点云从左上到右下、log 轴上是直线、拟合斜率为负）需要视觉 L2 检查方向

#### 注意：Michael 文件夹有 _result / _result_merged 变体

`Fig_*_result.json`、`Fig_*_result2.json`、`Fig_*_result_merged.json` 用途不明，需要确认是不是历史评分输出而非 rubric 本身。如果是评分历史，建议挪到独立子目录避免与 rubric 混淆。

---

## 共性问题清单

按 Findling / Koninck 经验梳理后，三篇论文都需要做的修订：

### 1. L1 减压：所有 panel 的"复述题目"项合并降到 ≤ 20%

- Adam Fig_1H: 75 → ≤ 20
- Adam Fig_2C: 80 → ≤ 20
- Komiyama Fig_2B: 50 → ≤ 20
- Michael Fig_5A: 45 → ≤ 20
- Michael Fig_8B: 50 → ≤ 20

### 2. 增加 L3 解读层：每个 panel 至少 2 条 L3，权重合计 ≥ 30%

Adam 每个 panel 缺失的 L3 类型：
- Fig_1H: **计算原理**（多时间尺度的并行表征）+ **机制**（神经积分器作为内部状态变量）
- Fig_2C: **理论**（连续 timescale 频谱 vs 离散类别）+ **功能**（行为历史的分布式编码）
- Fig_3B: **理论**（graded 表征 vs 分立 cell type 分类学）+ **功能**（连续梯度支持平滑动作选择）

Komiyama 每个 panel 缺失的 L3 类型：
- Fig_2B: **方法学**（隐变量行为建模为后续神经分析提供分层）+ **理论**（行为非 stationary，多状态比单一拟合更合理）
- Fig_5F: **机制**（胆碱能 gain control 抑制运动相关响应）+ **功能**（任务参与度通过抑制无关运动信号增强信噪比）

Michael 每个 panel 缺失的 L3 类型：
- Fig_5A: **进化 / 发育原理**（ECs 形态多样性反映多投射目标 → 平行输出通道）+ **比较**（与哺乳动物小脑核单一映射的差异）
- Fig_8B: 已有 wiring economy；可补 **进化原理**（wiring minimization 在脊椎动物大脑普遍存在）

### 3. 全部增加视觉评分项

每个 panel 至少 2 条视觉项（L1 + L2），权重 ≥ 30%。**特别紧急**的 panel（图像本身就是科学结论的载体）：

- Adam Fig_1H: 三条 trace 越长越平滑（视觉 L2 方向）
- Adam Fig_3B: UMAP 中 feeding 极性的连续 vs 分立（视觉 L2 关键）
- Komiyama Fig_2B: posterior probability 接近 0/1（清晰分类，视觉 L1）
- Komiyama Fig_5F: task 列 ITI 期 heatmap 暗 / passive 列保持亮（视觉 L2 方向，**核心科学发现**）
- Michael Fig_5A: cluster 7 单独成大支（视觉 L2，方向反 → 结论错）
- Michael Fig_8B: 散点云负斜率方向（视觉 L2）

### 4. 删除格式化 / 任务参数检查项

所有 panel 都该删掉 colormap、坐标朝向、scale bar、annotation 文字、数值精确复述、neuron 数 / region 数 / animal 数等任务参数复述项。

### 5. Michael 文件夹整理

确认 `Fig_*_result*.json` 文件用途。若是评分历史输出，移到 `evaluate/output/<paper>/` 之类目录。

---

## 优先级建议（按修订投入产出比排序）

1. **Adam Fig_3B**（最不严谨）：30/100 是 L2，剩 70/100 全是 L1，且**视觉 pattern 是核心结论**——单图视觉评测价值最高
2. **Komiyama Fig_5F**：question 和 figure 都好，但 rubric L3 太弱（10pt）+ 无视觉项；修订后能很好示范"双轨评分"
3. **Adam Fig_2C**：完全 L1/L2，完全无 L3——补 L3 即可大幅提升
4. **Michael Fig_5A**：可在原 15pt L3 基础上扩到 30pt，并加视觉项检查 dendrogram 结构
5. **Komiyama Fig_2B**、**Adam Fig_1H**：L1 减压 + 加 L3 + 加视觉项
6. **Michael Fig_8B**：L3 已经较好（25pt economic network），主要是减 L1 + 加视觉项

---

## 与 Findling / Koninck 对比

| 维度 | Findling | Koninck | Adam | Komiyama | Michael |
|------|----------|---------|------|----------|---------|
| 平均 L1 占比 | ~65% | ~85% | ~75% | ~55% | ~50% |
| 平均 L3 占比 | ~10%（隐含在 interpretation） | ~5% | ~10% | ~10% | ~20% |
| 视觉项 | 无 | 无 | 无 | 无 | 无 |
| Question/figure 错配 | 无 | Fig_5F 严重 | 无 | 无 | 无 |
| 论文背景知识依赖 | 无 | Fig_2B 严重 | 轻微 | 无 | 轻微 (Fig_5A) |

**结论**：所有 7 篇论文（Findling、Koninck、Adam、Komiyama、Michael、Wilson、Ryosuke）的 rubric 都需要按 SOP 重做，主要工作量集中在 (a) L1 减压；(b) 补 L3；(c) 加视觉评分项。

Wilson_2025_Nature_Neuroscience 和 Ryosuke_2026_Nature 还未抽查，建议同样审计。

---

## 下一步建议

1. 优先按 SOP 重做 Adam Fig_3B、Komiyama Fig_5F、Adam Fig_2C 这三个"高 ROI"panel 作为 demo
2. 整理 Michael 文件夹的 `_result` 变体
3. 抽查 Wilson 和 Ryosuke 完成全集 audit
4. 形成统一 SOP 后，可能需要一个评测脚本支持新 schema（`type` + `layer` 字段）

是否继续 audit Wilson 和 Ryosuke，或先开始改某些 panel？
