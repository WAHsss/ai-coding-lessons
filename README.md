# ai-coding-lessons

面向 AI Coding 与软件工程的可复用经验库。

## 定位

- **本仓库**：只收录**去项目化、可跨项目复用**的经验。
- **项目仓库**：保留业务规则、内网环境、项目设计约束等**项目特有**经验。
- **Agent 使用时**：先读项目本地经验（优先级最高），再用本仓库通用经验补充；冲突以本地为准，详见 [AGENTS.md](./AGENTS.md)。

目标：让 Agent 和人用「一句话结论 + 证据」快速判断，避免重复试错。

## 目录结构

```
.
├── README.md                  # 本文件
├── AGENTS.md                  # Agent 查询与合并契约
├── index.json                 # 自动生成，机器检索入口
├── schema/lesson.schema.json  # front-matter 字段约束
├── templates/lesson.md        # 新条目模板
├── lessons/                   # 一条经验一个文件
│   ├── ai-coding/             # Agent 协作、计划确认、上下文管理、工具使用
│   ├── frontend/rn/           # Taro / React Native
│   ├── frontend/h5/           # Taro H5
│   ├── build/                 # 构建、产物、缓存
│   ├── deploy/                # 部署、域名、证书、Nginx
│   ├── testing/               # 测试、取证、验收方法
│   └── tooling/               # 本地工具链、命令、环境
└── scripts/                   # 零依赖校验与索引脚本
```

## 条目规范

每条经验一个文件：`lessons/<domain>/<kebab-slug>.md`。

- 文件头为 YAML front-matter，字段见 [schema/lesson.schema.json](./schema/lesson.schema.json)。
- 正文固定五段：**现象 / 根因 / 处置 / 证据 / 教训**，并补充 **适用边界**。
- 结论必须可验证：命令、报错原文、校验方式优先于叙述。

模板见 [templates/lesson.md](./templates/lesson.md)。

### 收录判定

| 类型 | 判定 | 存放位置 |
|------|------|----------|
| 通用 | 根因在机制或工具链；换项目仍成立；可给出通用命令/配置 | 本仓库 |
| 项目内 | 涉及业务规则、内网 IP/域名/证书/账号、项目设计约束 | 项目仓库 |
| 拆分 | 通用机制 + 项目差异 | 机制在本仓库，差异在项目仓库 |

项目经验通过 front-matter 的 `generic_ref` 引用本仓库条目 ID，**不复制正文**，避免双源漂移。

## 检索

- 人读：看 [index.json](./index.json)。
- 机器读：按 `domain` / `tags` / `status` 过滤。

```bash
node -e "const i=require('./index.json');console.log(i.lessons.filter(l=>l.tags.includes('metro')))"
```

### MCP Server

Agent 可通过 MCP 直接检索（契约见 [AGENTS.md](./AGENTS.md) 第 5 节）：

- 公开端点：`https://lessons.e-top.online/mcp`
- 本地运行：`cd server && pnpm install && pnpm build && node dist/src/index.js`（stdio；`--http` 走 HTTP）
- 工具：`search_lessons` / `get_lesson` / `list_domains` / `list_tags` / `get_content_version`，默认只返回 `verified` 条目。

## 本地使用（stdio）

```bash
pnpm --dir server install
pnpm --dir server build
```

MCP 客户端配置（各 harness 结构相同）：

```json
{
  "mcpServers": {
    "ai-coding-lessons": {
      "command": "node",
      "args": ["<本仓路径>/server/bin/mcp-local.mjs", "--stdio"],
      "env": { "CONTENT_PATH": "<本仓路径>/dist/content.json" }
    }
  }
}
```

| Harness | 配置文件 |
|---|---|
| Claude Code | `<项目根>/.mcp.json` |
| Trae / WorkBuddy | `<项目根>/.trae/mcp.json` |
| Codex | `~/.codex/config.toml` 的 `[mcp_servers.ai-coding-lessons]` |

启动器 `server/bin/mcp-local.mjs` 会在 `lessons/` 比 `content.json` 新时自动重建内容；构建输出走 stderr，不污染 stdout 的 JSON-RPC 通道。内容过期或缺失时无需手动干预。

## 本地校验

零依赖，Node 18+：

```bash
node scripts/validate.mjs        # 字段、ID 唯一性、必填段落、脱敏
node scripts/build-index.mjs     # 生成 index.json
node scripts/build-index.mjs --check  # CI 用：索引是否过期
```

## 生命周期

`draft`（已记录，待复现）→ `verified`（有证据，可复用）→ `deprecated`（版本升级后失效，保留痕迹不删除）。

## 贡献

两种方式，都只需通过 `node scripts/validate.mjs`（字段、五段结构、脱敏）：

1. **外部源（推荐，零搬运）**：经验继续留在你自己的仓库，向 [sources.json](./sources.json) 提一个只增一行的 PR。构建时由服务器拉取合并，**本仓不存正文**，你删除或改私后 15 分钟内下架。格式见 [AGENTS.md §6](./AGENTS.md)。
2. **本地托管**：直接在本仓 `lessons/` 下新增条目走 PR，适合长文或需长期归档的内容。

## 后续改进（暂缓）

以下两项经评估**暂不实施**，等真实使用中出现痛点在再动手，避免过度设计：

1. **配套 Skill**：拆成 `lessons-query`（排查时先查本地再查本仓）与 `lessons-record`（收尾时去重、校验、提 PR）两个薄 skill。
   触发条件：每周重复口头要求 ≥ 2 次，且检索命中率达标后再写。
2. **检索升级**：当前为子串加权匹配，短板是中文未分词。演进顺序为「中文二元组切词 + BM25」→「错误签名归一化入索引」→ 最后才考虑向量检索。
   触发条件：条目数 > 200 或 Recall@5 低于 80%；届时需先建 30 条黄金查询集作为基线。

## License

- 脚本与工具代码：[MIT](./LICENSE)
- `lessons/` 下的文档内容：[CC BY 4.0](./LICENSE-CONTENT.md)
