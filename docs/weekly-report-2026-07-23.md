# 2026年7月23日周报

## 本周进展

### 1. SeekBrain 支持在任意路径使用

SeekBrain 不再依赖固定项目目录。用户可以在任意数据目录或工作目录中直接启动 `seekbrain`，研究结果会保存到当前项目对应的位置。

【图片】

### 2. Research Planning 树状规划、并行执行与 PDF 报告

SeekBrain 现在可以根据用户输入的问题，自动判断任务是否需要进入 Research Planning。单一、明确的分析问题会直接进入标准研究流程；需要整合多类数据、多个科学问题或多条证据的复杂任务，则会进入 Research Planning，先拆分研究树，再分别执行各个 Task。

Research Planning 支持同时输入科学问题、数据集路径和规划要求。系统会先读取数据集中的实际文件、数据类型和元信息，再生成可以执行的树状研究计划。

真实输入示例：

```text
问题：
研究斑马鱼脑中结构连接（SC）、功能连接（FC）和基因表达之间的关系，
并分析这些关系是否随发育阶段发生变化。

数据集：
/mnt/shared-storage-gpfs2/ai4neuro-share/neuro_scientist/library/data/27

规划要求：
生成2个子问题（SQ），每个SQ包含2个可以独立执行的Task。
```

系统识别到该问题需要同时整合SC、FC、基因表达和发育阶段等多条证据，因此自动选择 Research Planning。

输入数据集包含22条斑马鱼的全脑双光子钙成像数据、SC/FC矩阵、区域基因表达数据，以及6 dpf和7 dpf的FC数据。

系统生成的精简研究树：

```text
SQ1：SC、FC和基因表达是否存在静态耦合？
├─ SQ1-T1：检验SC与FC之间的拓扑耦合
└─ SQ1-T2：检验基因表达与SC/FC连接模式的关系

SQ2：FC网络是否随发育阶段变化？
├─ SQ2-T1：比较6 dpf与7 dpf的FC强度和网络拓扑
└─ SQ2-T2：比较FC模式的年龄分离和网络稳定性
```

Research Plan 已支持并行化，界面会分别显示每个任务的执行进度：

```text
SQ1-T1  Skill ○  Plan ○  Code ○  Validate ○  Interpret ○
SQ1-T2  Skill ○  Plan ○  Code ○  Validate ○  Interpret ○
SQ2-T1  Skill ○  Plan ○  Code ○  Validate ○  Interpret ○
SQ2-T2  Skill ○  Plan ○  Code ○  Validate ○  Interpret ○
```

目前最多支持3个 Task 同时进行 Skill、Deep Research 和 Plan；最多支持2个 Task 同时进入 Code 和后续执行阶段，其余任务会自动排队等待。

所有任务完成后，SeekBrain 可以为内部用户自动汇总生成 PDF 研究报告，包括研究摘要、各任务结果图、证据综合、研究限制和最终结论。

【图片】

【附件：斑马鱼SC-FC-基因表达综合研究报告 PDF】

### 3. 接入 PubMed/PMC 与 Semantic Scholar

SeekBrain 新增了 PubMed/PMC 和 Semantic Scholar 两种文献来源，同时保留 Shanghai AI Lab Paper RAG。

系统会根据科学问题自动生成检索条件，并对结果进行合并、去重和相关性排序。PubMed 还可以读取 PMC 开放全文，为 Research Survey、Deep Research 和 Skill 提供更完整的论文信息。

在真实 zebrafish HD-cell 任务中，PubMed 成功找到了对应的 Nature 论文、PMC 全文以及论文公开的分析代码仓库。

【图片】

### 4. 设计 SeekBrain Setup 界面

完成了 `seekbrain setup` 配置界面的设计，用于统一配置模型和文献服务。

文献来源支持：

```text
Semantic Scholar
PubMed/PMC
Shanghai AI Lab Paper RAG
None
```

Setup 会记录用户已经选择的配置和 API Key，避免每次重复填写；PubMed 和 Semantic Scholar 使用默认官方地址，用户只需输入 API Key。配置完成后直接关闭 Setup，不再自动重新加载 SeekBrain。

【图片】

## 下周 TODO

1. SeekBrain 前端优化。（预计今天完成）
2. 界面功能名称和提示用词与 Paper 统一。（预计今天完成）
