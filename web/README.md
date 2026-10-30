# SeekBrain WebUI

基于 [agegr/pi-web](https://github.com/agegr/pi-web) 的源码开发预览。上游版本与提交见 `upstream.json`，MIT 许可证保留在本目录的 `LICENSE`。

在 SeekBrain 根目录运行：

```bash
npm --prefix web ci
node bin/seekbrain.mjs web --cwd /path/to/project
```

默认地址为 `http://127.0.0.1:30141`，启动输出中的链接带有项目路径。`--ui webui` 是 `web` 的兼容写法。内网监听需设置 `PI_WEB_PASSWORD`，再加 `--hostname 0.0.0.0`；支持 `--port`。

后端直接创建 Pi 1.2.0 SDK 会话，通过 HTTP/SSE 与浏览器交互。`lib/seekbrain-host.ts` 按会话加载 SeekBrain 扩展、项目配置和 `.env`。主模型沿用 SeekBrain Primary 设置，也可在当前网页会话中切换。Fast 模型和文献设置沿用现有配置。四种模式的按钮调用原有命令，模式及研究项目随 Pi 会话持久化。

每个会话持有独立的工作流、配置缓存、日志统计和中断控制。项目环境只传给本会话的模型请求及工具。同一输出目录的初始化、科研阶段和报告写入受文件锁保护。Pi 的模型认证、用户配置仍是该运行用户共享的数据；这不是多用户隔离服务。

聊天、会话恢复、文件树、上传、Markdown/图片/PDF 预览及扩展交互复用上游。SeekBrain 设置按钮仍使用现有扩展向导。工具预设中的 Chat only 按上游规则不加载任何扩展；使用科研模式时保持默认工具预设。

当前由 Next 开发服务运行。依赖单独安装，网页尚未并入 npm 分发和一键安装；生产构建、安装分发和远程部署属于后续工作。

检查：

```bash
npm run typecheck
npm test
npm --prefix web test
npm --prefix web run lint
cd web && node_modules/.bin/tsc --noEmit
```

遵循 `AGENTS.md`，开发验证不运行 `next build`。共享存储环境关闭 Turbopack 的持久化缓存，以免 mmap 失败。`e2e/seekbrain-local.mjs` 使用本地模拟模型验证两个项目的凭据、聊天、模式恢复及实际科研目录创建；运行时服务必须使用隔离在 `.web-validation` 下的 HOME 和 Pi agent 目录，不能指向用户真实配置。
