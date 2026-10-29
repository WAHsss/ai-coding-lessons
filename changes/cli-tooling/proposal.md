# 提案：ai-coding-lessons CLI（零依赖贡献与自托管工具链）

## 1. 背景与问题

当前仓库的贡献与使用路径完全依赖手写脚本 + 人工记忆命令：

- 贡献者要自己搞清 `front-matter` 字段、五段结构、`domain` 与目录必须一致、`id` 编号规则；
- 自托管用户要自己 `pnpm --dir server install && build`，再手抄 `mcp.json` 片段；
- 编辑/校验/索引/内容四个脚本都以 `path.resolve()` 读 cwd，**不在仓库根执行就静默找错目录**；
- `validate.mjs` 只做硬性校验，对「根因写得很虚」「证据段是模板占位」这类低质量条目零提示，维护者只能人工 review。

结论：**先做 CLI，不做内容审核平台。** 审核成本靠 CLI 侧预检 + 构建期拦截 + PR review 三层消化，量级未到需要平台的程度。

## 2. 目标与非目标

### 目标

1. 单一入口 `lessons`，覆盖 `init / new / validate / search / build / serve / publish / check` 八个子命令。
2. **零依赖**（只用 `node:` 内置模块，Node ≥18），可通过 `npx github:WAHsss/ai-coding-lessons` 直接用。
3. 支持两种使用形态：
   - **自托管**：`init → new → validate → serve`，一键产出本地 MCP 配置；
   - **公共贡献**：`validate --strict → publish`，产出可直接提 PR 的 `sources.json` 片段。
4. `--root` 与「向上查找项目根」，消除对 cwd 的隐式依赖。
5. `validate --strict` 引入质量启发式（全部为 **warning**，`--strict` 才升级为失败），降低维护者 review 成本。

### 非目标（明确不做）

- 内容审核平台 / Web 表单 / 社区投票 / 评分排序；
- 自动建 PR（不引入 GitHub Token 与网络写权限，只输出可粘贴片段与链接）；
- npm 正式发布（先用 `npx github:` 路径，`private: true` 保持不变）；
- 语义去重、向量检索、BM25（属于 README 已记录的暂缓项，触发条件未到）；
- 改动 MCP 服务的检索实现或协议。

## 3. 架构

```
bin/lessons.mjs                 # 入口：参数解析、子命令分发、--help/--version、统一退出码
scripts/lib/project.mjs         # 项目根定位（--root > 向上找 lessons/ > cwd）、路径解析
scripts/lib/build.mjs           # buildIndexJson(root) / buildContentJson(root) / checkIndexFresh(root)
scripts/lib/validate-strict.mjs # 质量启发式（warning）+ 复用现有硬校验（error）
scripts/lib/search.mjs          # 本地全文检索（对齐 server/src/search.ts 权重）
scripts/lib/scaffold.mjs        # init 目录骨架 / new 模板渲染 / ID 序号分配
scripts/cli/<cmd>.mjs           # 八个子命令实现（薄编排层）
test/cli/*.test.mjs             # node --test，零依赖
```

### 3.1 关键设计决策

**D1｜构建逻辑下沉为库，脚本保留薄封装。**
`scripts/build-index.mjs`、`scripts/build-content.mjs` 现有逻辑搬入 `scripts/lib/build.mjs` 并接受 `root` 参数；原脚本改为「解析 cwd → 调用库」，保证 CI 的 `node scripts/*.mjs` 行为与产物**字节不变**。

**D2｜根目录只解析一次，向下传递。**
`scripts/lib/lessons.mjs` 的 `loadLessons(root)` 已支持显式根，问题只在调用方。CLI 统一由 `project.mjs` 解析出 `{ root, lessonsDir, indexFile, contentFile, sourcesFile }` 后逐层传入。查找顺序：`--root` 显式指定 → 从 cwd 向上找含 `lessons/` 的目录 → 回退 cwd。

**D3｜校验分两档，strict 规则默认不阻塞。**
`validate` = 现有硬校验（error），退出码 1 即失败；`--strict` 追加质量启发式（warning），并把 warning 计入失败。这样 CI 与历史条目零影响，新增规则可先观察误报率再决定是否收紧。

**D4｜搜索不跨包共享，用一致性测试守门。**
`server/src/search.ts` 属独立 pnpm 包（TS + MCP SDK），不把 `scripts/lib/search.mjs` 反向依赖进 server，避免构建耦合。改为写一条对比测试：同一 query 在本地条目集合上，CLI 结果顺序须与 server 的 `searchLessons` 一致（正文权重取自 `lesson.raw`）。

**D5｜`serve` 只编排，不重写服务端。**
stdio 复用 `server/bin/mcp-local.mjs`（已有自动重建 content 的能力），HTTP 复用 `server/dist/src/index.js --http`。未编译时输出**可直接复制的修复命令**后退出 1，不做静默降级。

**D6｜`new` 在非 TTY 环境禁止阻塞。**
交互式向导仅当 `process.stdin.isTTY` 且未提供 `--title/--domain` 时启用；CI / 管道环境缺参数立即报错退出 2，绝不 `await` 等待输入。

**D7｜ID 分配只保证本地唯一。**
`new` 按域代码取现有最大序号 +1。域代码映射：`ai-coding→AI`、`testing→TEST`、`tooling→TOOL`，其余取末段大写（`frontend/rn→RN`、`frontend/h5→H5`、`build→BUILD`、`deploy→DEPLOY`）。全局唯一性（与外部源冲突）由 `publish`/构建期「ID 已被占用」拦截提示。

### 3.2 命令契约

| 命令 | 主要参数 | 行为 | 退出码 |
|---|---|---|---|
| `init` | `[dir]` | 创建 `lessons/` 骨架与 `README.md`，不生成 `sources.json` | 0 / 1 |
| `new` | `--domain --title [--tags] [--status]` | 向导或参数直填，渲染模板并落盘 | 0 / 1 / 2（缺参） |
| `validate` | `[--strict] [--root]` | 硬校验 + 可选质量启发式 | 0 / 1 |
| `search` | `<query> [--domain] [--tags] [--status] [--limit] [--json]` | 本地全文检索（仅 `lessons/`，不含外部源） | 0 / 1 |
| `build` | `[--index-only \| --content-only] [--check]` | 生成 `index.json` / `dist/content.json` | 0 / 1 |
| `serve` | `[--http] [--port] [--print-config]` | 启动 MCP 或打印客户端配置 | 0 / 1 |
| `publish` | `[--repo <owner/name> --path lessons --ref main]` | 输出 `sources.json` 片段 + PR 链接 + 自托管指引 | 0 / 1 |
| `check` | — | `validate` + `build --check`（等价 `npm run check`） | 0 / 1 |

全局：`--root <path>`、`--json`、`--help`、`--version`、`--no-color`。

### 3.3 输出约定

- 面向人的叙述中文；错误前缀 `✗`、警告 `⚠`、成功 `✓`，`--no-color` 或非 TTY 时退化为纯文本。
- **stdout 只放结构化结果**（`--json`、`--print-config` 的 JSON），诊断信息一律走 stderr —— 与 `server/bin/mcp-local.mjs` 同一纪律，保证管道可用。
- 每条 error/warning 形如 `lessons/frontend/rn/xxx.md: <message>`。

## 4. strict 校验规则（全部 warning）

| 规则 | 判定 | 理由 |
|---|---|---|
| 模糊根因 | 「根因」段命中 `可能/也许/大概/疑似/推测/maybe` | 违反「不写推测」 |
| 空证据 | 「证据」段为空或仅剩模板占位 | 违反「结论必须可验证」 |
| 证据无实据 | 「证据」段不含反引号命令、日志行或产物路径特征 | 同上 |
| 段落过短 | 现象/根因/处置 < 20 字，证据/教训 < 10 字 | 模板占位残留 |
| 标题近似重复 | 与已有条目同域且 tags 交集 ≥ 2 且标题二元组重合 ≥ 0.6 | 减少重复条目 |
| 条目陈旧 | `status: verified` 且 `last_verified` 距今 > 180 天 | 版本漂移提醒 |
| 未知域 | `domain` 不在已知 7 域内 | 仅提示，不阻断新域 |
| 敏感信息（弱） | 邮箱、`Bearer `、`password=`/`token=` 赋值 | 现有硬规则未覆盖 |

基线要求：对现有 50 条跑 `validate --strict`，**逐条人工确认 warning 清单**，误报规则当轮降级或删除。

## 5. 验收标准

1. **G/W/T**：Given 仓库根，When `lessons validate`，Then 输出与 `node scripts/validate.mjs` 完全一致且退出码 0。
2. Given 仓库根，When `lessons build` + `git diff`，Then `index.json` 与 `dist/content.json` 与重构前**字节一致**。
3. Given 仓库下的任意子目录，When `lessons build --root <repo>`，Then 产物写入仓库根而非 cwd。
4. Given 现有 50 条经验，When `lessons validate --strict`，Then 退出码 0（若不为 0，则规则已在 §4 基线中调整）。
5. Given 条目根因写「可能是缓存问题」且证据段为空，When `validate --strict`，Then 两条 warning 且退出码 1；`validate` 无 `--strict` 时退出码 0。
6. Given 空目录，When `init` → `new --domain build --title "…"` → `validate`，Then 全链路退出码 0 且生成文件通过硬校验。
7. Given 非 TTY 且缺 `--title`，When `lessons new`，Then 立即报错退出 2，不阻塞。
8. Given server 未编译，When `lessons serve`，Then stderr 给出 `pnpm --dir server install && build` 提示且退出码 1。
9. Given server 已编译，When `lessons serve --print-config`，Then stdout 为可直接粘贴的 `mcp.json` JSON，stderr 无内容混入。
10. Given 本地条目集合与同一 query，When 对比 CLI `search` 与 server `searchLessons`，Then 结果 ID 顺序一致。
11. Given `lessons publish --repo someone/their-lessons`，Then stdout 片段为合法 JSON 且含正确 PR 链接。
12. Given push，When CI 跑 `npm run test:cli`，Then 全部测试通过。

## 6. 风险与应对

| 风险 | 影响 | 应对 |
|---|---|---|
| 重构构建脚本导致产物漂移 | 服务器内容与 CI 不一致 | 保留薄封装 + 验收标准 2 的字节比对 |
| strict 规则误报 | 打击贡献意愿 | 全部 warning；先跑基线；单条规则可独立删除 |
| CLI 与 server 搜索权重漂移 | 本地检索与 MCP 结果不一致 | 一致性对比测试（验收 10） |
| `new` 在非 TTY 挂起 | CI 卡死 | D6：非 TTY 缺参直接退出 2 |
| `--print-config` 混入日志 | 配置粘贴失败 | stdout/stderr 严格分离 + 验收 9 |
| ID 与外部源冲突 | 构建期该条被跳过 | `publish` 提示全局唯一；构建日志已可见原因 |

## 7. 影响面

- 新增：`bin/lessons.mjs`、`scripts/lib/{project,build,validate-strict,search,scaffold}.mjs`、`scripts/cli/*.mjs`、`test/cli/*.test.mjs`
- 修改：`scripts/{validate,build-index,build-content}.mjs`（改薄封装）、`package.json`（`bin`/`test:cli`）、`.github/workflows/ci.yml`（加测试步）、`README.md`（CLI 节）、`AGENTS.md`（§6.1 补 `publish`）
- 不改：`server/**`、`schema/**`、`templates/lesson.md`、`lessons/**` 内容、`deploy/**`
