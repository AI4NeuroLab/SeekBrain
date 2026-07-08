# Rubric 撰写 SOP

适用于 `evaluate_query/` 下所有 paper 的 rubric 设计，目的是统一评分深度，避免 rubric 停留在描述层。

---

## 1. 整体结构

每个 panel 的 rubric 包含两类评分项：

- **text items** — 评模型对生成图的科学解读（基于生成图作出的文字结论）
- **visual items** — 评模型生成图与 gt 图在科学 pattern 上的一致性（评测模型对比两张图）

每条 scoring item 必须标注：
- `type`: `"text"` 或 `"visual"`
- `layer`: `"L1"` / `"L2"` / `"L3"`（text 三层，visual 两层）
- `point`: 整数分值
- `criterion`: 评分点描述
- `deduction_rule`: 扣分规则

---

## 2. Text items 三层金字塔

```
L3  生物/计算解释层  (40-60%)  ← 这意味着什么？为什么这样？
 ↑
L2  模式解读层       (25-35%)  ← 图里这个 pattern 反映了什么属性？
 ↑
L1  任务/数据描述层  (10-20%)  ← 图里画的是什么？
```

### L1 — 任务事实层（10-20%）

- 测：是否识别了分析类型、脑区/变量、数据来源
- **风险**：L1 项过多 → 模型只复述 question 即可拿分，不测出科学理解
- 控制总占比 ≤ 20%

### L2 — 模式解读层（25-35%）

- 测：是否能从图里识别关键 pattern 并赋予系统层面的含义
- 包括：相对量级、方向、对称性、显著性、模块结构等
- 描述 + 含义，但**未上升到生物机制**

### L3 — 生物 / 计算解释层（40-60%）

- 测：是否能从 pattern 推出该结果的科学意义
- **rubric 撰写者的 L3 项写不出来通常意味着**：要么图科学含量低（评测价值有限），要么 reviewer 自己未充分理解论文
- 5 种 L3 切入角度（每个 panel 选 1-2 个）：

| 类型 | 关键问题 |
|------|---------|
| 功能含义 | 这个结构让大脑/系统能做什么？ |
| 机制含义 | 什么过程 / 回路 / 算法产生了这个 pattern？ |
| 比较 / 原理含义 | 和已知原理 / 其他物种 / 其他区域的关系？ |
| 计算含义 | 暗示什么编码方案 / 计算策略？ |
| 发育 / 进化含义 | 对脑如何形成 / 演化的暗示？ |

---

## 3. Visual items 两层

```
L2 visual  方向/排序/不对称性正确  (科学结论强依赖)
 ↑
L1 visual  pattern 存在            (基础 sanity check)
```

- **L1 visual** — 关键 pattern 是否存在（块结构有没有、4 模块画出来没）
- **L2 visual** — pattern 方向 / 排序 / 不对称性是否正确（如果 light 富集到右 habenula，科学结论就反了）
- 视觉项权重应往 L2 倾斜
- **不要写**：colormap、坐标朝向、scale bar、annotation 文字、图像尺寸、布局位置等格式化项

---

## 4. 撰写动词红绿灯

写 criterion 时，主动词决定评分项的层次：

| 红灯（描述） | 黄灯（半解读） | 绿灯（推荐，解读性） |
|-------------|----------------|---------------------|
| describes | identifies | infers |
| states | mentions | attributes \_ to \_ |
| reports | notes | interprets \_ as evidence for |
| shows | preserves | explains \_ in terms of |
| | | connects \_ to the principle of |
| | | links \_ to the broader finding that |
| | | supports the conclusion that |

L1 项允许用红 / 黄灯动词；L2 / L3 项尽量用绿灯动词。

---

## 5. 撰写每个 panel 前的三个问题

按顺序写下答案，再据此分配评分项：

1. **L1 — 任务事实**：这张图执行的是什么分析？产出是什么？
2. **L2 — 模式解读**：图里最显著的 pattern 是什么？它反映了什么系统层面的属性？
3. **L3 — 生物 / 计算意义**：这个属性背后的机制 / 原理 / 功能含义是什么？为什么这个结果重要？

---

## 6. 自检 checklist

写完一个 panel 的 rubric 后逐条检查：

### Text items
- [ ] L1 总分 ≤ 20%
- [ ] L3 总分 ≥ 40%
- [ ] 每条 L3 项的 criterion 用了绿灯动词
- [ ] 每条 criterion 不能仅靠复述 question 通过
- [ ] 至少 1 条 L3 项要求**机制**或**原理**层面的解读

### Visual items
- [ ] 没出现 colormap / 坐标 / scale bar / 朝向等格式词
- [ ] L2 visual 项权重 ≥ L1 visual 项权重
- [ ] 每条 visual 项描述的 pattern 错了 / 反了 → 科学结论也错 / 反

### 总体
- [ ] text 与 visual 总分加总 = 100
- [ ] 视觉权重 ≥ 30%（数据可视化型 panel 通常 ≥ 50%）

---

## 7. JSON schema

```json
{
  "tag": "Fig_XX",
  "rubrics": {
    "score_100": {
      "GT core conclusion": "<one-paragraph statement of the panel's scientific takeaway>",
      "scoring_items": [
        {
          "type": "text",
          "layer": "L1",
          "point": 10,
          "criterion": "...",
          "deduction_rule": "..."
        },
        {
          "type": "text",
          "layer": "L3",
          "point": 20,
          "criterion": "Infers ... / Attributes ... to ...",
          "deduction_rule": "..."
        },
        {
          "type": "visual",
          "layer": "L2",
          "point": 15,
          "criterion": "...",
          "deduction_rule": "..."
        }
      ],
      "Acceptable deviations": ["...", "..."],
      "Scoring instructions": "Stage 1: score text items against the model's textual output. Stage 2: score visual items by side-by-side comparison of the model-generated figure with the gt figure, evaluating only scientifically meaningful patterns (not formatting). Sum to 100."
    }
  }
}
```

---

## 8. 反例与正例（用 Findling Fig_2A 演示）

### 反例（全 L1，太描述）
```json
{"type":"text","layer":"L1","point":30,"criterion":"States that decoding was performed in ORBvl during the ITI."}
{"type":"text","layer":"L1","point":30,"criterion":"States that the decoded variable is the Bayes-optimal prior."}
{"type":"text","layer":"L1","point":20,"criterion":"Reports R² = 0.28 and P = 0.001."}
```
问题：模型只要记得 question 就能全过，从未推理任何东西。

### 正例（金字塔分布）
```json
{"type":"text","layer":"L1","point":10,"criterion":"Identifies the analysis as a cross-validated linear decoding of the Bayes-optimal prior from ORBvl population activity during the inter-trial interval."}
{"type":"text","layer":"L2","point":15,"criterion":"Notes that decoded prior tracks the Bayes-optimal prior across trials and reflects step-like changes at block transitions, with significant decoding statistics (R² ≈ 0.28, P = 0.001)."}
{"type":"text","layer":"L3","point":15,"criterion":"Infers that ORBvl maintains a persistent internal belief about block context during pre-stimulus periods — frontal cortex represents latent context variables independent of immediate sensory input."}
{"type":"text","layer":"L3","point":15,"criterion":"Connects this finding to the broader principle that the brain implements Bayesian inference by encoding the prior as an explicit, decodable neural variable, not merely as a behavioral effect."}
```

---

## 9. 适用范围与例外

- 本 SOP 适用于 `evaluate_query/rubric/<paper>/Fig_*.json`
- 对纯方法论 panel（如管道流程图、示意图）可酌情提高 L1 比例
- 对回顾性 / 综述图，L3 是必备主体（描述性 panel 缺乏评测价值）
