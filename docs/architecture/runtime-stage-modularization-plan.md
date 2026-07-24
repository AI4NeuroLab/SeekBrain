# SeekBrain Runtime 阶段化拆分计划

状态：Proposed implementation plan
日期：2026-07-23
范围：`src/extension/seekbrain-runtime.ts` 及其直接 Extension 适配层依赖
核心约束：重构期间不改变 SeekBrain 的科学工作流、工具契约、状态语义和用户交互

## 1. 背景

当前 `src/extension/seekbrain-runtime.ts` 约 3944 行，注册 36 个 SeekBrain 工具，
同时承担以下职责：

1. 配置加载、缓存、环境变量和配置文件监听。
2. Agent 配置解析与阶段 Agent 执行。
3. 日志、usage、诊断文件和透明度卡片数据整理。
4. Run 查找、恢复、状态更新和 Artifact 快照。
5. 图片加载、Artifact 归一化和代码编辑后的文件核验。
6. Workflow 实例创建与依赖注入。
7. Research Planning、Research Execution、Analytical Formulation、Code
   Generation & Execution、Validation、Figure Refinement、Result
   Interpretation、Reporting 等阶段的工具注册。
8. 原生研究者审批选择器和非交互环境兜底。
9. Research Task 并行执行的运行时编排。
10. Extension hooks、commands 和工具结果 renderer 的连接。

文件的大致结构为：

| 区域 | 当前行数范围 | 主要职责 |
|---|---:|---|
| 公共函数和适配器 | 1–1245 | 配置、日志、文件、Artifact、Agent 执行、schemas |
| Runtime 组合 | 1246–1881 | Workflow 创建、Research Task executor、hooks、commands |
| 工具注册 | 1882–3944 | 36 个工具的 schema、execute 和 renderer 绑定 |

这不会直接导致运行错误，但会增加以下维护风险：

- 修改一个阶段时需要理解大量无关代码。
- 共享闭包状态和阶段逻辑难以区分。
- 新工具容易继续堆积在同一文件。
- 工具注册顺序、配置缓存、原生 UI 和 Workflow 状态更新容易发生隐式耦合。
- 单元测试难以只针对一个阶段的 Extension 适配器。
- 多人同时修改同一文件时冲突概率较高。

## 2. 重构目标

### 2.1 主要目标

1. 按 SeekBrain 产品阶段拆分工具定义，Research Planning 形成独立模块。
2. 把共享运行能力收敛为明确的 runtime services，而不是依赖巨型闭包。
3. 保持 Extension 层、Workflow 层和 Core 层的单向依赖。
4. 保持 36 个工具的名称、参数 schema、注册顺序和返回结构不变。
5. 保持 `state.json`、project layout、Artifact 路径和事件语义不变。
6. 保持原生选择器、非交互兜底和审批状态机不变。
7. 最终将主组合入口控制在约 300–500 行。
8. 使每个阶段的 Extension 适配器可以独立进行单元和契约测试。

### 2.2 非目标

本次拆分不包含：

- 不重新设计 Research Planning 或普通分析工作流。
- 不更改并发策略、重试策略或 Research Task 调度算法。
- 不修改 Prompt 内容和 Agent 职责。
- 不重命名任何公开工具。
- 不修改工具参数或返回字段。
- 不迁移或重写现有研究项目和运行结果。
- 不引入新的模型调用、文件扫描或启动时网络请求。
- 不通过动态 import 延迟加载阶段模块。
- 不把 Workflow 业务逻辑重新放回 Extension 工具文件。
- 不在此次重构中继续进行 UI 术语迁移。

## 3. 必须保持的兼容契约

以下内容是本次重构的硬约束。

### 3.1 工具契约

- 工具名称完全不变。
- TypeBox 参数 schema 完全不变。
- 工具注册顺序完全不变。
- interactive 和 automation 工具集合完全不变。
- tool label、description、renderer 和 compact result 语义不变。
- `onUpdate` 的阶段事件和 progress payload 不变。

### 3.2 工作流契约

- Research Planning 的路由、审批、生成、Reviewer Agent、研究者审批和任务物化顺序不变。
- 普通工作流继续保持：Recipe → Deep Research → Analytical Formulation →
  Code Generation & Execution → Validation → optional Figure Refinement →
  Result Interpretation。
- Research Task Pipeline 的并行准备、串行审批和并行执行行为不变。
- 研究者反馈后的 revision 行为不变。
- 现有 Workflow 类继续拥有状态转换和领域规则。

### 3.3 状态与文件契约

- `state.json` schema 和字段语义不变。
- `project.json`、run index 和 current-run 指针不变。
- `research_plan/`、`execution/`、`reports/` 和 Artifact 路径不变。
- events、usage、diagnostic 和 transparency 输出不变。
- 配置缓存和配置 watcher 的生命周期不变。

### 3.4 性能契约

- Extension 注册前不得新增 awaited I/O。
- 不得新增启动时模型调用。
- 不得为每个阶段重复创建 Workflow、literature provider 或 skill library。
- 配置预热继续保持 fire-and-forget，不阻塞工具和 command 注册。
- 模块拆分使用静态 import，避免首次工具调用额外加载阶段代码。

## 4. 目标架构

```text
src/extension/
├── seekbrain-runtime.ts                 # 兼容入口；最终仅 re-export
├── runtime/
│   ├── index.ts                         # Composition Root
│   ├── tool-registry.ts                 # 固定工具注册顺序
│   ├── runtime-types.ts                 # 公共类型和最小接口
│   ├── create-runtime-services.ts        # 创建共享 services/workflows
│   ├── create-runtime-hooks.ts           # active run、watcher、usage hooks
│   │
│   ├── shared/
│   │   ├── config-service.ts             # config cache、env、agent config
│   │   ├── subagent-runner.ts            # runSubagent 与 Agent adapter
│   │   ├── run-access.ts                 # resolve/start/resume/update run
│   │   ├── artifact-service.ts           # Artifact 和图片适配
│   │   ├── observability-service.ts      # logs、usage、diagnostics
│   │   ├── file-service.ts               # JSON/text 和受控文件操作
│   │   └── code-edit-service.ts          # diff、stamp、approved rerun
│   │
│   └── stages/
│       ├── system-tools.ts
│       ├── dataset-tools.ts
│       ├── lifecycle-tools.ts
│       ├── research-planning-tools.ts
│       ├── research-execution-tools.ts
│       ├── reporting-tools.ts
│       ├── review-tools.ts
│       ├── code-review-tools.ts
│       ├── recipe-research-tools.ts
│       ├── formulation-tools.ts
│       ├── code-execution-tools.ts
│       ├── validation-tools.ts
│       ├── figure-refinement-tools.ts
│       └── interpretation-tools.ts
│
├── commands/
├── tui/
├── runtime-hooks.ts
└── tool-adapter.ts
```

现有 `src/workflows/seekbrain/` 保持独立，不迁入 `extension/runtime/`。

## 5. 依赖方向

目标依赖必须保持单向：

```text
extension/runtime/index.ts
        │
        ├── tool-registry.ts
        ├── create-runtime-services.ts
        ├── stages/*
        └── commands / hooks / TUI
                   │
                   ▼
             workflows/*
                   │
                   ▼
                core/*
```

规则：

1. `runtime/index.ts` 可以依赖所有 stage factory。
2. stage 模块可以依赖自己的窄接口、TUI selector/renderer 和 Workflow 类型。
3. stage 模块不得导入 `runtime/index.ts`。
4. `shared/` 不得导入任何 stage 模块。
5. Workflow 不得导入 Extension、TUI 或 Pi API。
6. Core 不得导入 Workflow 或 Extension。
7. 阶段之间不得直接互相调用；跨阶段动作通过 Workflow/service 或返回的
   `next_tool` 表达。

## 6. 工具注册设计

### 6.1 不直接按模块调用 `registerXTools`

当前工具顺序并不完全按照产品阶段排列。例如 Reporting、Lifecycle、Review 和普通
分析阶段工具在现有注册序列中存在交错。如果简单执行：

```ts
registerLifecycleTools(pi, deps);
registerResearchPlanningTools(pi, deps);
registerReportingTools(pi, deps);
```

会改变工具注册顺序，并导致 contract baseline 发生变化。

因此，每个阶段模块应当导出工具定义，不直接注册：

```ts
export function createResearchPlanningTools(
  deps: ResearchPlanningToolDependencies,
): SeekBrainToolDefinition[] {
  return [
    createPlanningAssessTool(deps),
    createPlanningDecisionReviewTool(deps),
    createPlanningDecisionRecordTool(deps),
    createPlanningGenerateTool(deps),
    createPlanningPeerReviewTool(deps),
    createPlanningResearcherReviewTool(deps),
    createPlanningResearcherDecisionRecordTool(deps),
    createAnalysisTasksPrepareTool(deps),
  ];
}
```

统一 registry 按冻结顺序注册：

```ts
export const TOOL_REGISTRATION_ORDER = [
  "seekbrain_system_check",
  "seekbrain_system_capabilities",
  "seekbrain_data_resolve",
  "seekbrain_research_start",
  // ...保持当前完整顺序
] as const;

export function registerTools(
  pi: ExtensionAPI,
  definitions: SeekBrainToolDefinition[],
) {
  const byName = new Map(definitions.map((tool) => [tool.name, tool]));
  for (const name of TOOL_REGISTRATION_ORDER) {
    const tool = byName.get(name);
    if (!tool) throw new Error(`Missing SeekBrain tool definition: ${name}`);
    pi.registerTool(tool);
  }
  if (byName.size !== TOOL_REGISTRATION_ORDER.length) {
    throw new Error("Unexpected or duplicate SeekBrain tool definitions.");
  }
}
```

这样既允许按阶段组织源码，又能保持对外注册顺序稳定。

### 6.2 当前工具到阶段模块的映射

| 阶段模块 | 工具 |
|---|---|
| `system-tools.ts` | `seekbrain_system_check`, `seekbrain_system_capabilities` |
| `dataset-tools.ts` | `seekbrain_data_resolve` |
| `lifecycle-tools.ts` | `seekbrain_research_start`, `seekbrain_research_continue`, `seekbrain_run_start`, `seekbrain_run_resume` |
| `research-planning-tools.ts` | `seekbrain_planning_assess`, `seekbrain_planning_decision_review`, `seekbrain_planning_decision_record`, `seekbrain_planning_generate`, `seekbrain_planning_peer_review`, `seekbrain_planning_researcher_review`, `seekbrain_planning_researcher_decision_record`, `seekbrain_analysis_tasks_prepare` |
| `research-execution-tools.ts` | `seekbrain_execution_initialize`, `seekbrain_execution_run`, `seekbrain_execution_schema_review`, `seekbrain_execution_tasks_run`, `seekbrain_analysis_task_control` |
| `reporting-tools.ts` | `seekbrain_report_evidence_compile`, `seekbrain_report_generate` |
| `review-tools.ts` | `seekbrain_review_approve`, `seekbrain_review_feedback`, `seekbrain_formulation_researcher_review`, `seekbrain_formulation_update` |
| `code-review-tools.ts` | `seekbrain_code_edit_review`, `seekbrain_code_update_propose`, `seekbrain_code_update_review` |
| `recipe-research-tools.ts` | `seekbrain_recipe_retrieve`, `seekbrain_deep_research` |
| `formulation-tools.ts` | `seekbrain_formulation_generate` |
| `code-execution-tools.ts` | `seekbrain_code_execute` |
| `validation-tools.ts` | `seekbrain_validation_run` |
| `figure-refinement-tools.ts` | `seekbrain_figure_refine` |
| `interpretation-tools.ts` | `seekbrain_interpretation_run` |

## 7. Runtime Services 设计

### 7.1 Composition Root

`runtime/index.ts` 只负责：

1. 创建共享 runtime services。
2. 创建 Workflow 实例。
3. 注册 transparency renderer、hooks 和 commands。
4. 从所有阶段收集工具定义。
5. 按固定顺序注册工具。
6. 启动非阻塞配置预热。

它不应包含工具的参数 schema、长 execute 实现或阶段 Prompt 组装。

### 7.2 共享实例必须唯一

以下对象在一次 Extension 注册中只能创建一次：

- `RunLifecycleWorkflow`
- `ResearchPlanningWorkflow`
- `ResearchSurveyWorkflow`
- `ResearchTaskScheduler`
- `ResearchTaskExecutionCoordinator`
- `ResearchSkillWorkflow`
- `PlanWorkflow`
- `CodeWorkflow`
- `ValidateWorkflow`
- `ImageWorkflow`
- `InterpretWorkflow`
- `ReviewWorkflow`
- `ReportEvidenceCompiler`
- `ReporterWorkflow`
- `LiteratureProviderRouter`
- `SkillLibraryManager`
- `TargetedSkillResolver`
- `RagSkillGenerator`

阶段模块只能接收这些实例，不能自行 new，以避免状态、缓存和依赖重复。

### 7.3 不使用巨型依赖对象

可以在 Composition Root 内维护完整的 `RuntimeServices`，但每个 stage factory 必须
接收窄接口：

```ts
export interface ResearchPlanningToolDependencies {
  lifecycle: RunLifecycleWorkflow;
  planningWorkflow: ResearchPlanningWorkflow;
  surveyWorkflow: ResearchSurveyWorkflow;
  loadConfig(): Promise<Json>;
  readPrompt(name: ResearchPlanningPromptName): Promise<string>;
  resolveRun(cwd: string, runId?: string): Promise<RunContext>;
  updateState(run: RunContext, patch: Json): Promise<void>;
  pickPlanningAgentConfig(config: Json): Json;
  pickAgentConfig(config: Json, name: string): Json;
}
```

不要把完整 `RuntimeServices` 传给所有模块，否则只会把巨型文件问题转换成巨型
service locator 问题。

### 7.4 可变运行时状态

`activeRunDir`、config watcher 和 usage flush timer 属于一次 Extension 注册的可变状态。
应封装为单一 runtime session：

```ts
export interface RuntimeSession {
  getActiveRunDir(): string | undefined;
  setActiveRunDir(path: string | undefined): void;
  startConfigWatcher(cwd: string, notify?: Notify): void;
  stopConfigWatcher(): void;
}
```

所有 command、hook 和需要 active run 的 service 共享同一实例，不复制闭包变量。

## 8. Research Planning 首批拆分设计

Research Planning 适合作为第一批迁移，因为其工具边界清晰、已有较完整测试，并且近期
刚完成原生选择器状态机修复。

### 8.1 文件内容

`research-planning-tools.ts` 应包含：

- Research Planning 相关 TypeBox schemas。
- 八个相关工具定义。
- `applyResearchTreeDecision`。
- `presentResearchTreeReview`。
- Research Planning 专用 config selector。
- Research Survey → plan generation 的进度适配。
- 原生选择器不可用时的 pending-state 处理。

它不应包含：

- `ResearchPlanningWorkflow` 内部状态转换实现。
- 全局配置缓存实现。
- 通用 run 文件读写实现。
- Research Task 的 Code/Validation/Interpretation 执行逻辑。
- compact renderer 的呈现规则。

### 8.2 必须保留的审批状态机

```text
peer review complete
        │
        ▼
native researcher selector available?
        │
        ├── yes ── approve ──► approved_for_execution
        │        ├ revise ───► Orchestrator revision ─► selector again
        │        └ cancel ───► cancelled_by_user
        │
        └── no ──────────────► text_review_pending
                                      │
                                      ▼
                         researcher_decision_record
```

拆分后不得重新引入“由主模型决定是否调用最终选择器”的交接点。

### 8.3 Research Planning 验收条件

- `seekbrain_planning_peer_review` 仍在内部直接打开最终原生选择器。
- native UI 存在时不会返回普通聊天审批请求。
- native UI 不存在时设置 `text_review_pending=true`。
- text decision 只能在 pending state 下记录。
- revise 后通过 Orchestrator 修改计划，不再次自动调用 Reviewer Agent。
- revise 完成后重新打开同一原生选择器。
- approve 后 `next_tool` 仍为 `seekbrain_analysis_tasks_prepare`。
- cancel 后保留研究计划但不启动执行。

## 9. Research Task Execution 拆分设计

当前 `executeResearchTask` 同时连接 Code、Validation、Figure Refinement、Result
Interpretation 和 Scheduler events，是拆分中风险最高的区域。

不应把它简单复制到 `research-execution-tools.ts`。建议建立：

```text
runtime/create-research-task-executor.ts
```

该 factory 接收已经创建的 Workflow 实例和共享配置服务，返回
`ResearchTaskExecutionDependencies["executeTask"]`。

职责：

- 恢复 child run。
- 判断是否复用现有 Code 或 Validation。
- 调用 Code/Validation/Refinement/Interpretation Workflow。
- 发布 scheduler lifecycle events。
- 处理 retry、blocked 和 recovered result。

`research-execution-tools.ts` 只负责：

- 初始化 task manifests。
- 准备和审批 methodological schemas。
- 启动 coordinator。
- 转发 progress board 更新。
- 处理 researcher task control。

这一步必须在 Research Planning 和低风险模块完成后再实施。

## 10. 分阶段实施计划

### Phase 0 — 冻结行为基线

目标：在移动代码前记录所有可观察契约。

任务：

1. 保存当前 36 个工具的名称和顺序。
2. 保存去除 description 后的参数 schema hash。
3. 确认 automation/interactive 工具集合。
4. 确认 Research Planning native/text fallback 测试。
5. 确认 setup、commands、hooks 和 renderer 测试。
6. 记录 Extension 注册过程不得 awaited I/O 的约束。

验收：

- `npm run typecheck` 通过。
- `npm run test:unit` 通过。
- `npm run test:contract` 通过。
- `git diff --check` 通过。

回滚点：此阶段不修改生产代码。

### Phase 1 — 建立 runtime 目录和固定 registry

目标：先建立模块骨架，不移动阶段逻辑。

任务：

1. 添加 `runtime/runtime-types.ts`。
2. 添加 `runtime/tool-registry.ts`。
3. 将当前工具顺序写入 `TOOL_REGISTRATION_ORDER`。
4. 为缺失、重复和额外工具定义增加启动期检查。
5. 暂时由旧 runtime 构建全部 definitions，再交给 registry 注册。

验收：

- 工具名称、顺序和 schema hash 完全不变。
- 无新增配置读取或异步等待。
- contract baseline 不需要更新 hash。

回滚点：删除新 registry，恢复原 `pi.registerTool` 调用。

### Phase 2 — Research Planning 试点拆分

目标：验证阶段 factory、窄依赖和固定 registry 的设计。

任务：

1. 创建 `stages/research-planning-tools.ts`。
2. 移动 Research Planning schemas 和八个工具定义。
3. 移动最终研究计划选择器相关 helper。
4. 通过窄依赖接口注入 Workflow、config、prompt 和 run access。
5. 保持 renderer 仍由现有 TUI 模块提供。
6. 将旧文件对应代码删除，避免双重注册。

验收：

- Research Planning 全部 unit tests 通过。
- native selector、text fallback、approve、revise、cancel 测试通过。
- peer review 仍内部触发最终选择器。
- contract schema hash 和注册顺序不变。
- Research Planning 开始时间不新增独立模型调用或 awaited I/O。

回滚点：单独还原该 stage 文件和旧 runtime 的对应区块。

### Phase 3 — 抽取共享 runtime services

目标：减少旧 runtime 对闭包 helper 的依赖。

按以下顺序抽取：

1. `file-service.ts`：JSON/text、atomic writes、diff helper。
2. `run-access.ts`：start/resolve/resume/update/snapshot。
3. `artifact-service.ts`：Artifact 归一化、图片和 refinement guard。
4. `observability-service.ts`：readable logs、usage 和 diagnostics。
5. `config-service.ts`：cache、env、agent config 和 workflow flags。
6. `subagent-runner.ts`：Existing Pi Agent adapter 和 finalize handling。

验收：

- 每个 service 有独立单元测试。
- config cache、active run 和 watcher 仍只有一个实例。
- disk-write policy 和 diagnostics 行为不变。
- 运行时错误信息不因拆分丢失上下文。

回滚点：每个 shared service 单独提交和验收，不进行一次性整体移动。

### Phase 4 — 低风险阶段拆分

按以下顺序迁移：

1. `system-tools.ts`
2. `dataset-tools.ts`
3. `lifecycle-tools.ts`
4. `reporting-tools.ts`
5. `recipe-research-tools.ts`

验收：

- dataset cache reuse 行为不变。
- start/continue/resume 的 project 和 run layout 不变。
- report evidence selection 和生成路径不变。
- Recipe 和 Deep Research 的 enabled/disabled 行为不变。

### Phase 5 — Review 和代码编辑拆分

迁移：

1. `review-tools.ts`
2. `code-review-tools.ts`
3. `code-edit-service.ts`

特别检查：

- native review selector 只位于 Pi Extension/TUI 边界。
- approved code rerun 的工作目录和 Python 环境不变。
- Artifact stamps 和 validation invalidation 语义不变。
- diff renderer 的 compact/expanded 行为不变。

### Phase 6 — Research Execution 拆分

目标：拆分复杂的 Research Task Pipeline，但不改变并发行为。

任务：

1. 创建 `create-research-task-executor.ts`。
2. 移动 `executeResearchTask` 适配逻辑。
3. 创建 `research-execution-tools.ts`。
4. 保持 Scheduler 和 Coordinator 的单例实例。
5. 保持 task event 名称、顺序和 payload。
6. 保持 schema review queue 和 Approve Remaining 行为。

验收：

- 并发 task preparation 和 execution 测试通过。
- progress board 更新不退化。
- retry、blocked、cancel 和 recovered execution 行为不变。
- Reporter 仍能发现相同 child result。

### Phase 7 — 普通分析主链拆分

迁移：

1. `formulation-tools.ts`
2. `code-execution-tools.ts`
3. `validation-tools.ts`
4. `figure-refinement-tools.ts`
5. `interpretation-tools.ts`

验收：

- 普通单轮工作流完整通过。
- plan review gate 仍在 Code 前阻断。
- Validation route 和重试次数不变。
- Figure Refinement 失败仍能安全回滚并继续解释。
- Result Interpretation 仍只消费已验证 Artifact。

### Phase 8 — 收敛 Composition Root

目标：删除旧 runtime 中已经迁移的实现，使入口保持清晰。

任务：

1. 将 Workflow 实例创建移入 `create-runtime-services.ts`。
2. 将 runtime session 和 watcher 移入独立模块。
3. `runtime/index.ts` 只保留组合、hooks、commands 和 ordered registration。
4. 原 `seekbrain-runtime.ts` 改为兼容 re-export：

```ts
export { registerSeekBrainRuntime } from "./runtime/index.ts";
```

5. 更新只检查旧源文件文本的结构测试，使其检查新的模块边界。
6. 删除过渡期 adapter 和重复类型。

验收：

- 主组合入口约 300–500 行。
- 单个 stage 文件原则上不超过 500 行；复杂 execution adapter 可单独拆分。
- 不存在 stage → composition root 的反向依赖。
- 不存在重复 Workflow/service 实例。
- 全量测试通过。

## 11. 测试策略

### 11.1 每个 Phase 的固定检查

```bash
npm run typecheck
npm run test:unit
npm run test:contract
git diff --check
```

### 11.2 Contract 检查

必须继续覆盖：

- 精确工具名称集合。
- 精确注册顺序。
- 参数 schema hash。
- automation/interactive 工具边界。
- 初始 run state 和 deliverables。
- setup 和 CLI 行为。

### 11.3 Stage 单元测试

每个 stage factory 至少测试：

1. 导出的工具名称集合。
2. 所需依赖最小化。
3. execute 参数到 Workflow 输入的映射。
4. Workflow 结果到 tool result 的映射。
5. blocked、skipped、non-interactive 和 error 分支。
6. renderer 绑定是否正确。

### 11.4 Research Planning 专项回归

- 模型没有显式请求 Research Planning 时必须弹出首个 Yes/No 选择器。
- 用户明确按名称请求 Research Planning 时允许直接开始生成。
- Peer review 后必须由工具内部弹出最终 Approve/Revise/Cancel 选择器。
- 主模型不得成为最终选择器是否出现的决定点。
- 非 UI 环境只能在 pending state 下记录文字决定。
- revise 不得自动增加第二次 Reviewer Agent 调用。

### 11.5 性能检查

不建议在 CI 设置极小毫秒阈值，以免产生环境相关的不稳定测试。改为检查结构性约束：

- 注册阶段无新增 awaited I/O。
- 无动态 import。
- 无新增同步目录扫描。
- 无重复 Workflow/provider 初始化。
- 无新增路由 Agent 或审批 Agent 调用。

可在本地对拆分前后进行 10 次冷启动和 20 次热启动采样，比较注册耗时中位数；如
中位数明显增加，再使用 profiler 定位，但不因普通模块拆分预设性能退化。

## 12. 风险与控制措施

| 风险 | 可能表现 | 控制措施 |
|---|---|---|
| 工具注册顺序变化 | contract failure、模型工具列表变化 | 固定 `TOOL_REGISTRATION_ORDER` |
| schema 被重新构造 | schema hash 改变 | 迁移原 schema，不重新设计 |
| Workflow 被重复实例化 | 状态、缓存或调度不一致 | 统一 `createRuntimeServices` |
| `activeRunDir` 被复制 | command、report 或 skill 使用错误 run | 单一 `RuntimeSession` 实例 |
| 配置缓存被拆成多个副本 | 热更新不一致、重复 I/O | config service 单例 |
| 循环依赖 | 启动失败或 undefined import | 强制单向层级和 dependency tests |
| 原生 selector 丢失 | 模型改为聊天询问 | Research Planning runtime 行为测试 |
| progress callback 丢失 | 长任务缺少可见进度 | execution event contract tests |
| Agent 名称或 Prompt 改变 | 输出行为变化 | 原值直接迁移，不在本轮清理文案 |
| 源码文本测试失效 | 测试误报 | 改为检查模块边界和运行行为 |
| 大规模移动难以回滚 | 问题定位困难 | 每阶段独立提交、小步迁移 |

## 13. 提交和回滚策略

每个 Phase 至少一个独立提交，推荐进一步按 stage 拆分提交：

```text
refactor(runtime): add ordered tool registry
refactor(runtime): extract research planning tools
refactor(runtime): extract shared config and run services
refactor(runtime): extract lifecycle and dataset tools
refactor(runtime): extract research execution adapter
refactor(runtime): extract standard analysis stages
refactor(runtime): reduce legacy runtime to compatibility entry
```

每个提交都必须是可运行、可测试的状态。不得采用“先删除旧实现，后续提交再补新实现”
的方式。

若某阶段失败：

1. 只回滚当前 stage 的迁移提交。
2. 不回滚此前已经通过全量测试的阶段。
3. 保留 fixed registry 和 contract baseline。
4. 在旧 runtime 中恢复该 stage，重新缩小依赖接口后再迁移。

## 14. 完成标准

满足以下条件后，阶段化拆分才算完成：

- `seekbrain-runtime.ts` 仅保留兼容 re-export。
- `runtime/index.ts` 是清晰的 Composition Root，不包含长工具实现。
- 36 个工具全部归属明确的 stage 模块。
- 所有 Workflow 和共享 provider 每次 Extension 注册只创建一次。
- 工具名称、顺序、schema hash 和 interactive 边界与基线一致。
- Research Planning 两级原生审批流程保持不变。
- 普通分析和 Research Task Pipeline 行为保持不变。
- 不新增启动时 awaited I/O、模型调用或网络请求。
- TypeScript、unit、contract 和 diff checks 全部通过。
- 文档中的目标结构与最终源码一致。

## 15. 推荐的首个实施批次

首个批次只实施 Phase 0–2：

1. 冻结当前契约。
2. 建立 ordered tool registry。
3. 抽取 `research-planning-tools.ts`。
4. 保持所有共享 services 暂时由旧 runtime 注入。
5. 跑完整 typecheck、unit 和 contract tests。

该批次能够验证整体架构，同时把改动限制在近期已充分测试的 Research Planning
区域。确认稳定后，再开始共享 services 和 Research Execution 等高耦合区域的拆分。
