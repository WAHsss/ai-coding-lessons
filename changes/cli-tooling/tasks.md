# 任务清单：ai-coding-lessons CLI

按依赖顺序执行。每项完成后必须跑「证明」命令并留下输出；不得跳步。

- [x] **1 构建逻辑下沉为库**
  新建 `scripts/lib/build.mjs`：`buildIndexJson(root)`、`serializeIndexJson`、`checkIndexFresh(root)`、`buildContentJson(root)`。
  改写 `scripts/build-index.mjs`、`scripts/build-content.mjs` 为薄封装（解析 cwd → 调用库），命令行参数不变。
  证明：`npm run check` 通过；`node scripts/build-index.mjs` 后 `git status` 显示 `index.json` 无改动，`dist/` 仍被忽略。

- [x] **2 项目根解析**
  新建 `scripts/lib/project.mjs`：`resolveProject({ root, cwd })` → `{ root, lessonsDir, indexFile, contentFile, sourcesFile, serverDir }`。
  查找顺序：显式 `--root` → 从 cwd 向上找含 `lessons/` 的目录 → 回退 cwd。
  证明：`test/cli/project.test.mjs` 覆盖「仓库根 / 两层子目录 / 显式 root / 找不到」四种输入。

- [x] **3 strict 校验规则**
  新建 `scripts/lib/validate-strict.mjs`：复用 `validateLesson` 的 error，追加提案 §4 的 8 条 warning。
  近似去重与段落长度判定复用已加载条目集合，不重复读盘。
  证明：对现有 50 条跑 strict 输出 warning 清单，逐条人工确认后删除或降级误报规则。

- [x] **4 本地检索**
  新建 `scripts/lib/search.mjs`：`searchLocal(lessons, params)`，权重对齐 `server/src/search.ts`（id 100 / title 4 / tags 3-1 / summary 2 / domain 1 / body 1），正文取 `lesson.raw`。
  证明：`test/cli/search.test.mjs` 用固定 fixture 断言排序结果。

- [x] **5 CLI 入口与分发**
  新建 `bin/lessons.mjs`（shebang `#!/usr/bin/env node`）：手写参数解析（`--key value`、`--key=value`、布尔 flag、`--` 截止）、子命令分发、`--help`/`--version`、未知子命令退出码 2。
  新建 `scripts/cli/output.mjs`：`ok/warn/err/info`、TTY 与 `--no-color` 降级、诊断一律走 stderr。
  证明：`node bin/lessons.mjs --help` 列出八个命令；`node bin/lessons.mjs nope` 退出码 2。

- [x] **6 validate / build / check 命令**
  新建 `scripts/cli/validate.mjs`、`build.mjs`、`check.mjs`：解析根 → 调任务 1 / 任务 3 的库。
  `build` 支持 `--index-only`、`--content-only`、`--check`；`check` = `validate` + `build --check`。
  证明：`node bin/lessons.mjs check` 与 `npm run check` 输出等价、退出码一致；构造一处 front-matter 错误验证两者都退出 1。

- [x] **7 search 命令**
  新建 `scripts/cli/search.mjs`：读本地 `lessons/` → 任务 4 检索 → 表格输出（id / domain / status / title）或 `--json`。
  证明：`node bin/lessons.mjs search metro --domain build` 命中 `GEN-BUILD-*` 的 metro 条目；`--json` 输出可被 `ConvertFrom-Json` 解析。

- [x] **8 new 命令**
  新建 `scripts/lib/scaffold.mjs`：域代码映射（`ai-coding→AI`、`testing→TEST`、`tooling→TOOL`，其余取末段大写）、最大序号 +1、kebab-slug 生成、内置模板渲染（不依赖仓库是否有 `templates/`）。
  新建 `scripts/cli/new.mjs`：有 `--title`/`--domain` 走非交互；否则仅 TTY 下用 `node:readline/promises` 走向导；非 TTY 缺参退出 2。
  证明：临时目录 `init` 后执行 `new --domain build --title "..." --tags metro` 再 `validate` 通过；连跑两次 ID 递增不冲突。

- [x] **9 init 命令**
  新建 `scripts/cli/init.mjs`：创建 `lessons/` 与 `lessons/README.md`，已存在时幂等提示。
  证明：空临时目录 `init` → `new` → `validate` 全链路退出码 0。

- [x] **10 serve 命令**
  新建 `scripts/cli/serve.mjs`：stdio 分支 spawn `server/bin/mcp-local.mjs --stdio` 并透传 stdio；`--http` 分支 spawn `server/dist/src/index.js --http --port`；`--print-config` 生成 `mcp.json` 到 stdout。
  未编译（`server/dist/src/index.js` 或 `server/node_modules` 缺失）时 stderr 打印精确修复命令并退出 1。
  证明：`serve --print-config` 输出合法 JSON 且 stderr 为空；临时重命名 `server/dist` 后 `serve` 退出 1。

- [x] **11 publish 命令**
  新建 `scripts/cli/publish.mjs`：先跑 strict 校验（不通过则拒绝），再输出 `sources.json` 片段、`edit/main/sources.json` 的 PR 链接、自托管替代方案指引。
  默认 `--repo` 从 `git remote get-url origin` 推导，失败则要求显式传参。
  证明：`--repo someone/their-lessons` 输出片段为合法 JSON，URL 形如 `https://github.com/WAHsss/ai-coding-lessons/edit/main/sources.json`。

- [x] **12 测试与 CI**
  新增 `test/cli/*.test.mjs`（`node --test`）：project / search / validate-strict / new / serve-config / parity。
  parity 测试动态 import `server/dist/src/search.js`，对同一 fixture 断言 CLI 与 server 结果 ID 顺序一致；server 未编译时 skip。
  `package.json` 加 `"bin": { "lessons": "bin/lessons.mjs" }` 与 `"test:cli": "node --test \"test/cli/*.test.mjs\""`。
  CI `check` job 增加一步 `npm run test:cli`。
  证明：`npm run test:cli` 全绿；本地跑通 `npm run check`、`npm run test:cli`、`pnpm --dir server test`。

- [x] **13 文档**
  `README.md` 新增「CLI」节：安装方式（`npx github:WAHsss/ai-coding-lessons`）、八个命令表、自托管与公共贡献两条路径。
  `AGENTS.md` §6.1 补充「用 `lessons publish` 生成注册片段」。
  证明：逐条执行 README 中出现的每个命令，确认示例输出与实际一致。

## 完成校验

```
npm run check
npm run test:cli
node bin/lessons.mjs validate --strict
pnpm --dir server test
```
