# SeekBrain 0.1.4 运行机制

## 模式

新会话 Research；恢复会话读取 Pi 自定义会话记录中的模式和项目。`/ask`、`/plan`、`/research` 持续切换，附带参数时提交该请求。`/deep-research` 启用基于每轮报告和任务结果的多轮研究。`--mode` 设置启动模式，Pi 自身的 JSON/RPC 传输模式仍通过 `--` 传递。

模式控制统一约束主智能体工具入口和直接调用的工作流工具。Ask、Plan 和 Research 中的规划子智能体均开放 Bash，统一使用现有工具探索材料，不再注册专用材料预览器。Ask 不开放 write/edit、计划生成及其他科研工作流工具；只读行为通过提示词约束，Bash 本身没有只读沙箱。Plan 的 write/edit 工具仍限定计划文件路径；提示词要求保留输入材料、临时文件放临时目录，并将完整分析留给执行阶段。运行中切换先中止和收尾，再应用新权限，不自动恢复任务。

终端通过实际事件展示模式、当前活动、任务状态及产物，移除固定四阶段计时条。Ask/Plan 不加载完整研究流程提示词。模式名称保持英文。

## 主提示词

`prompts/assistant.md` 是所有模式共用的身份、四模式定义与交流原则；Deep Research 按完整结果驱动研究能力介绍，不在主提示中混入临时开发状态。`ModeController.prompt()` 仅提供当前模式、项目和当前操作范围。`prompts/research.md` 在 Research / Deep Research 中提供按需工具操作指引，普通讨论、局部编辑、planning-only 和 report-only 请求无需走完整流程。

`before_agent_start` 通过 `systemPromptOptions.sections` 更新 SeekBrain 自己的分区，不返回完整 `systemPrompt` 替换；Pi 继续保留工具指导、项目 AGENTS、cwd 和 Skill 上下文。CLI 直接提交原始问题及显式数据/输出参数，自动运行范围通过运行时分区说明，不再使用 `/entry`、提示模板或在用户消息中附加固定研究步骤。原 `prompts/entry.md` 已移除。

文献工具通过 Pi 原生 `promptSnippet` 和 `promptGuidelines` 提供简介与使用指引，随激活的工具进入系统提示词。科学规划和分析规划提示词保留研究要求与引用原则，不重复工具调用说明。Ask、Plan、Research 和 Report 共用同一组搜索/读取工具及应用级文献缓存（`$XDG_CACHE_HOME/seekbrain/literature`，默认 `~/.cache/seekbrain/literature`）。搜索只返回论文元信息、真实摘要或明确标记的正文预览；读取按 paper_id 返回已有全文，不重复搜索。超长全文标明截断并提供完整缓存路径。未获取全文的论文会明确说明。

## 工作流

`Plan → Formulation → Code / Validation → Report`

新流程不兼容旧项目状态。模型、认证和文献源仍由原有配置与 Pi 管理。

## 输出位置

用户通过 `--work-dir` 或纯文本指定的输出目录是唯一研究根目录，程序绑定它，不追加 `_project`。单任务直接在其中执行；多个任务在 `tasks/<id>` 下隔离，避免文件冲突。输入相对路径按用户原始工作目录解析，输出路径按研究根目录解析。

Plan 支持多份 Markdown、JSON、文本或 YAML 文件及原位修订，默认 `plan.md`。候选路径与执行选定路径分别记录；Formulation 读取选定文件原文。Report 根据指定目标写 Markdown 并导出 PDF；PDF-only 的 Markdown 放在内部调用目录。内部状态、任务图、诊断与使用记录放在 `.seekbrain`，不要求用户或 Agent 交付它们。产物按研究根目录保存相对路径，整个目录移动后可以按新路径恢复。根目录内的输入路径同样随目录恢复。

## 任务输入输出

Formulation 只定义任务目标、依赖、可选输入角色、预期结果和必要科学检查。无 execution_contract、固定文件名或统一交付清单。目录、多个代码文件、CSV/TSV、JSON、数组和图形都可作为结果；不强制代码目录、statistics.json、结论、handoff、环境锁或图表数量。

任务结束时登记实际产物。Execution、Validation 与产物可用性分别记录；缺辅助文件或文件名不同不会被当作科学失败。Validation 返回 accepted、partial、retry 或 unusable，并可标明独立可用的结果。下游按所需结果是否可用执行，不仅依赖整个任务的完成标签。Pilot 可以直接返回 primitive decisions，不必另写统计 JSON。

## 修复与恢复

真正的科学或计算错误进入有界局部修复。Code 再次运行前收到现有产物与修复范围，优先复用结果。Code 和 Validation 明确不启用整阶段硬超时，旧用户配置中的 300/3600 秒不会作用于 014 这两个阶段；网络请求和单次工具命令仍使用各自的超时，用户仍可取消。基础设施中断不触发外层连续三次新建 Agent；保留已有结果和计算/验证状态，明确恢复时优先只继续验证。修改结果内容时，只排除受影响产物；重新执行会先重验证而非自动重跑计算。时间戳、日志或辅助文件变化不触发科学重验证。

已有目录原地恢复。Plan 修改后在同一目录重新编排，重新执行发生变化的任务和其下游，保留未受影响的工作。活动工作流使用锁避免重复执行；过期的本机进程锁可回收。

## 轻量 finalize

Plan 返回路径；Formulation 返回最小任务图或文件路径；Code 返回实际结果位置、简短说明和必要问题；Validation 返回可用性、科学错误和局限；Report 返回 Markdown 路径。正常结束漏调 finalize 时，从已有文件恢复并继续必要验证。取消、超时或截断不自动认定为完成。

## Report

Report 是唯一形成科学解释、结论和参考文献的阶段。它读取实际结果、原问题、Plan 和有关材料。已验证/局部可用结果支持科学报告，未验证和失败结果只支持进度说明。没有可用科学证据时输出进展与局限报告。教材 Skill 和文献工具保留，按问题需要阅读，不规定阅读数量。

Report 直接写 Markdown，不重复提交 JSON 全文。默认简报格式与用户明确覆盖继续生效。Report Agent 在同一次调用内读回、自行计数并局部编辑，不使用外围 Markdown 结构或引用解析器判定报告成败，也不因格式问题整篇重生成。

默认使用 report.md/report.pdf，也支持用户指定名称、格式和目录。已有 .seekbrain/reports 调用目录保留证据、用量及 PDF-only 的写作草稿。用户指定的不同命名报告分别保留；只使本次要替换的 PDF 失效，不删除其他命名报告。PDF 渲染器通过 --output 接收独立输出路径。导出失败标记 draft，保留 Markdown 并清理旧版及未完成 PDF；需要处理的是渲染，不重新写科学报告。

## 日志

原始事件和可读事件增量写入。流式 delta 不重复携带累计全文。日志序列化、写盘和用量记录错误不改变科研任务状态；关闭调试时不积累原始事件。

## 使用

```bash
seekbrain-014 run --query '分析 ./Datasets/D01，参考 ./References，实施计划并生成报告。' --work-dir ./Q1
seekbrain-014 report ./Q1
```

交互模式启动 `seekbrain-014`。重启已有进程后加载本次改动。

主对话创建研究与生成计划时，由运行时从 Pi 会话读取真实用户消息；公开工具不再接收模型重写的 `question` 或 `instruction`。后续要求以用户原话保存，必要讨论保留 user/assistant 身份，工具输出和思考内容不进入研究请求。Plan 只接收一次请求及上下文，按实际计划文件、当前用户消息和显式 action 决定创建、修订或复用；执行编排与报告写作由后续阶段负责。


## Deep Research 多轮状态

Deep Research 复用现有各阶段。工具入口将当前 interactionMode 传入内存运行上下文；只有该模式使用多轮状态。Ask、Plan、Research 的权限、单轮调度和默认输出行为继续生效；seekbrain_research_decide 仅在 Deep Research 可调用。CLI run --mode deep-research 和交互 /deep-research 使用相同实现。

`.seekbrain/state.json` 中的 deep_research 保存当前轮数、max_rounds、phase、各轮计划/任务/报告位置及决策。阶段是 plan、formulation、execution、report、decision、export、complete。报告存在不代表整项研究结束。seekbrain_run_resume 返回实际下一步；重复提交同轮相同决策不会重复推进，冲突决策被拒绝。

每轮 Formulation 只返回本轮工作，程序合并保留的历史任务并检查真实依赖。新任务 ID 带轮次前缀，单任务也使用独立目录；调度只处理本轮任务，旧失败不重置。新 Plan 显式带入前轮报告、决策与已有结果，按当前轮次判断是否需要生成，避免相同用户消息误命中旧计划复用。

Report 汇总所有仍可用的证据，每轮生成 Markdown，最终 decision=finish 才导出 PDF。内部快照重写本地相对 Markdown 链接，以保留图片和项目整体迁移后的可读性。invalidate_paths 可明确撤回已发现错误的产物；若结束决策刚刚撤回证据，先更新报告，再记录结束。达到轮数上限使用 round_limit 记录真实停止原因，保留原继续理由，不宣称科学成功。

旧文献背景 Agent、prompt、tool、工作流调用、配置生成和结果注入已删除。旧布尔配置在加载时被忽略，避免共享配置让其他模式启动失败；磁盘上的共享用户配置不会被改写。Deep Research max_rounds 独立于文献源。
