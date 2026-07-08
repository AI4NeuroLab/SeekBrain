# 全论文 Panel 视觉评测优先级分级

扫描 `evaluate_query/query_gt_data/` 下全部 12 篇论文 / ~50 个 panel 的 query，按"视觉评测必要性"分为 A / B / C 三级。配套使用 [`rubric_writing_SOP.md`](./rubric_writing_SOP.md)。

**分级标准**：
- **A 级（必须重点设计视觉评分项）**：视觉信号是科学结论的首要载体，文字描述无法替代——graded vs 分立、空间分布 / 不对称性、拓扑结构、矩阵 block、heatmap 排序异质性
- **B 级（视觉项推荐）**：散点 / 柱状 / 相关性图，文字 R/p 复述容易但视觉趋势 / 排序仍有评测价值
- **C 级（视觉优先级低）**：数值即结论，文本结论可主导

---

## A 级 — 必须重点设计视觉评分项

### 模式 1：连续 vs 分立组织（UMAP / embedding）

| Panel | 视觉关键科学信号 | 反方向 → 结论错？ |
|-------|-----------------|------------------|
| **Adam Fig_3B** | UMAP 中 feeding 极性是连续梯度 vs 分立 cluster | ✅ |
| **Adam Fig_3G** | 神经元按 PC loading 的 hierarchical 聚类组织 | ✅ |
| **Zeng FIG_1C** | UMAP 中 15 类细胞清晰分群 vs 大幅重叠 | ✅ |
| **Zeng Fig_5A** | cluster 数随发育时间的轨迹形状 | ⚠️ |

### 模式 2：左右不对称 / 空间分布

| Panel | 视觉关键科学信号 | 反方向 → 结论错？ |
|-------|-----------------|------------------|
| **Koninck Fig_5F** | light-responsive 富集到**左** habenula（核心科学发现） | ✅✅ |
| **Koninck Fig_2B** | SC 网络的双侧对称性 + posterior dense 梯度 | ✅ |
| **Arhens Fig_4D** | eomesa / pvalb7 共表达细胞的全脑 3D 分布 | ✅ |
| **Michael Fig_5B** | 121 个 efferent neuron 按聚类着色的空间分布 | ✅ |

### 模式 3：矩阵 block 结构 / heatmap 排序

| Panel | 视觉关键科学信号 | 反方向 → 结论错？ |
|-------|-----------------|------------------|
| **Koninck Fig_1E** | FC 矩阵的三个解剖块对角结构 + hindbrain 最强 | ✅ |
| **Koninck Fig_3A** | 共指派矩阵 4 个不等大模块 + dendrogram 嵌套 | ✅ |
| **Arhens Fig_3B** | 41 基因 × 神经元 heatmap 的分子亚型 block 结构 | ✅ |
| **Arhens Fig_5A** | 神经元按响应相似度排序后的 heatmap 模式 | ✅ |
| **Komiyama Fig_5F** | task vs passive 列在 ITI 期 heatmap 颜色对比 | ✅✅ |

### 模式 4：dendrogram / 聚类拓扑

| Panel | 视觉关键科学信号 | 反方向 → 结论错？ |
|-------|-----------------|------------------|
| **Michael Fig_5A** | 8 个 cluster + PC 单独成 cluster 7（拓扑反了 → 结论反） | ✅✅ |
| **Michael Fig_6C** | 22 个 cluster 神经元形态展示 | ✅ |

### 模式 5：曲线 / trace 时序拓扑

| Panel | 视觉关键科学信号 | 反方向 → 结论错？ |
|-------|-----------------|------------------|
| **Findling Fig_2A** | decoded prior trace 步阶式跟踪 Bayes-optimal | ✅ |
| **Findling Fig_3A** | 高/低 prior 曲线在零对比度的垂直分离方向 | ✅✅ |
| **Adam Fig_1H** | 三条 trace 随 half-decay 增大变得越平滑 | ✅ |
| **Komiyama Fig_2B** | posterior probability 接近 0/1（清晰切换）vs 中间值 | ✅ |
| **Engel Fig_2B** | 单神经元 PSTH 异质形状（ramping up / down / non-monotonic） | ✅ |
| **Engel Fig_4B** | population PSTH 排序后的异质性 pattern | ✅ |
| **Ryosuke Fig_4A** | HD cell tuning 居中排序后的对角 pattern | ✅ |
| **Ryosuke Fig_4G** | learning epoch 中 bump phase = 2θ（双峰）vs pre/post 的 θ（单峰） | ✅✅ |

**A 级总计**：23 个 panel

---

## B 级 — 视觉项推荐（散点 / 柱状 / 相关性）

| Panel | 关键视觉项 |
|-------|----------|
| Findling Fig_3C | Ephys vs WFI 散点正向趋势 |
| Findling Fig_4F | WFI 散点比 Ephys 更紧（相关强度排序）|
| Findling Fig_4A | action-kernel bar 接近 1，与其他差距大 |
| Komiyama Fig_2H | SVM 解码柱状显著高于 chance |
| Komiyama Fig_5C | task vs passive 柱状 fraction 相近 |
| Michael Fig_8B | 散点云负斜率方向 |
| Wilson Fig_2C | grouped 散点 across cue 条件 |
| Wilson Fig_3C | 散点 bump width vs HD encoding accuracy |
| Wilson Fig_3D | 模型 simulation 散点 |
| Wilson Fig_5E | 散点 offset change vs conflict 方向 |
| Ryosuke Fig_2F | per-fish κ 跨条件比较 |
| Ryosuke Fig_3E | per-epoch out-phase fraction |
| Ryosuke Fig_4B | R² 单峰 vs 双峰拟合比较 |
| Adam Fig_2C | ECDF 曲线长尾形状 |
| Adam Fig_2D | decoder error vs offset 曲线形状 |
| Zeng FIG_2B | 跨发育时间各 subclass 比例堆叠形状 |
| Zeng Fig_4B | 基因表达轨迹分类（Up / Transient / Down / Constant） |
| Zeng Fig_5D | 跨 subclass 基因表达变化分布 |
| Komiyama Fig_5M | CNO inactivation 学习曲线对比 |

**B 级总计**：19 个 panel

---

## C 级 — 视觉优先级较低（文本结论可主导）

| Panel | 原因 |
|-------|------|
| Michael Fig_S3C | boxplot of registration accuracy（数值即结论） |
| IBL_Witten Fig_4F | 跨脑区 effect-size 表格式总结 |

**C 级总计**：2 个 panel

---

## 最高优先级：方向反 = 结论反

下列 panel 视觉错误**直接导致科学结论错误**，应作为视觉评分项设计的第一批 demo：

| Panel | 致命视觉错误 |
|-------|-------------|
| **Koninck Fig_5F** | light 富集到右而非左 habenula |
| **Komiyama Fig_5F** | task 和 passive 都减弱（应只有 task 减弱）|
| **Michael Fig_5A** | PC 散布在多个 cluster（应单独成一支）|
| **Ryosuke Fig_4G** | learning epoch 单峰拟合（应双峰 = 2θ） |
| **Findling Fig_3A** | 低 prior 在上、高 prior 在下（方向反） |

---

## 系统性观察

### 1. 视觉项缺失是普遍问题
所有 12 篇论文的现有 rubric **完全没有独立视觉评分项**。其中 **A + B 级共 42 个 panel（占 84%）需要视觉评分**才能保证评测严谨性。

### 2. 数据完整性问题（建议先修复）
扫描中发现以下 query 异常：

| 文件 | 问题 |
|------|------|
| `Engel_2026_Nature/Fig_3A.json` | query 字段为空 |
| `IBL_Witten_2025_Nature/Fig_4IJK.json` | query 字段为空 |
| `IBL_Witten_2025_Nature/Fig_4LM.json` | query 字段为空 |
| `Findling_2025_Nature/` vs `Findling_Pouget_2025_Nature/` | 两份目录完全重复 |
| `Koninck_2025_Science_Advances/Fig_5F` | question 与 figure 错配（详见 review 报告）|

### 3. 跨论文模式分布
- **dendrogram / hierarchical clustering** 在 Michael (Fig_5A, 6C) 和 Adam (Fig_3G) 出现 → 可设计统一的"聚类拓扑"视觉模板
- **UMAP / 嵌入连续性** 在 Adam (Fig_3B), Zeng (FIG_1C), Findling 等出现 → 可设计"graded vs discrete"视觉模板
- **空间分布 / 全脑映射** 在 Koninck (Fig_5F, 2B), Arhens (Fig_4D), Michael (Fig_5B) 出现 → 可设计"asymmetry / 区域富集"视觉模板
- **矩阵 block 结构** 在 Koninck (Fig_1E, 3A), Arhens (Fig_3B, 5A), Komiyama (Fig_5F) 出现 → 可设计"block-diagonal contrast"视觉模板

按模式建立**视觉评分项模板库**，可以极大降低后续 rubric 重写工作量。

---

## 建议工作排序

1. **第一批（5 个 demo）**：上面"致命视觉错误"列表中的 5 个 panel，按 SOP 重写并加视觉评分项
2. **第二批（A 级剩余 18 个）**：按 5 种视觉模式批量重写
3. **第三批（B 级 19 个）**：相对简单，主要补 directionality + significance check
4. **数据修复**：补充 3 个空 query；解决 Findling 重复目录；修复 Koninck Fig_5F 的 question/figure 错配
5. **C 级**：可保留现有 rubric，仅做轻量 SOP 化（L1 减压 + L3 增加）

---

## 视觉评分模板库提议（5 个统一模板）

针对上述四种重复出现的视觉模式，建议建立可复用模板：

### Template A: graded-vs-discrete embedding
```json
{
  "type": "visual", "layer": "L2", "point": <X>,
  "criterion": "Generated <UMAP/embedding> shows the colored variable varying as a CONTINUOUS gradient across the embedding space, not as sharply isolated discrete clusters.",
  "deduction_rule": "Deduct fully if discrete clusters with no graded transition. Deduct partially if gradient is present but axis direction differs from gt."
}
```

### Template B: spatial asymmetry / 区域富集
```json
{
  "type": "visual", "layer": "L2", "point": <X>,
  "criterion": "Generated map shows clear LEFT-RIGHT asymmetry / unilateral enrichment in <region>, matching gt direction.",
  "deduction_rule": "Deduct fully if symmetric or reversed asymmetry. Deduct partially if asymmetry direction is correct but spatial extent differs."
}
```

### Template C: block-diagonal matrix structure
```json
{
  "type": "visual", "layer": "L2", "point": <X>,
  "criterion": "Generated matrix shows N visible diagonal blocks of <unequal/equal> size, with within-block values higher than off-diagonal values, matching gt block structure.",
  "deduction_rule": "Deduct fully if no block structure or contrast inverted. Deduct partially if block count differs by 1-2 or sizes are roughly equal when gt shows hierarchy."
}
```

### Template D: dendrogram topology
```json
{
  "type": "visual", "layer": "L2", "point": <X>,
  "criterion": "Generated dendrogram shows <N> major clusters with <specific cluster> forming a homogeneous singleton branch, matching gt topology.",
  "deduction_rule": "Deduct fully if singleton cluster scattered across multiple branches. Deduct partially if cluster count differs."
}
```

### Template E: paired/grouped trend direction
```json
{
  "type": "visual", "layer": "L2", "point": <X>,
  "criterion": "Generated <scatter/curve set> shows <positive/negative> trend with <high condition> consistently <above/below> <low condition>, matching gt direction.",
  "deduction_rule": "Deduct fully if direction reversed or curves overlap. Deduct partially if trend is correct but separation magnitude is much weaker."
}
```
