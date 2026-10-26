# Agent 使用契约

本仓库是**通用经验层**，不是项目规范的替代品。任何结论都必须与项目本地经验合并后使用。

## 1. 查询顺序（MUST）

1. **项目本地经验**：项目仓库的 `docs/lessons/`、踩坑文档、规格与设计约束。
2. **本仓库通用经验**：读取 `index.json`，按 `domain` / `tags` / 关键词命中后，再读对应 Markdown 文件。
3. **官方文档/源码**：前两层不足时再查，并回写新经验。

## 2. 合并规则

- **本地优先**：项目约束与通用经验冲突时，一律以项目本地为准。
- **不复制正文**：项目条目用 `generic_ref: GEN-XXX-0000` 引用本仓库条目，只写差异。
- **冲突可见**：输出结论时标注冲突来源，不要静默取一方。
- **版本校验**：先看条目的 `status` 与 `applies_to`；`deprecated` 不作为依据。

## 3. 引用格式

在本仓库内：`[GEN-RN-0007](./lessons/frontend/rn/xxx.md)`
在项目仓库内：`generic_ref: GEN-RN-0007`（可附本仓库链接）

## 4. 写入门槛

满足全部条件才可收录：

- 真实发生过，且保留原始报错/日志/命令等证据。
- 能脱离当前项目复现或解释，不依赖业务语境。
- 已脱敏：无内网 IP、内部域名、账号口令、手机号、密钥。
- 根因落在机制层；根因不明时标 `status: draft`，只写现象与已排除项。

禁止：推测性结论、未验证的偏方、纯项目业务规则。

## 5. MCP Server 契约

数据源为 `dist/content.json`（`scripts/build-content.mjs` 由 Git 内容生成），服务端只读，经验维护仍以 Git 为准。

- 公开端点：`https://lessons.e-top.online/mcp`（Streamable HTTP，无状态，仅 POST）
- 本地 stdio：`cd server && pnpm install && pnpm build && node dist/src/index.js`
- 工具：
  - `search_lessons({ query?, domain?, tags?, status?, limit? })` — 返回元数据列表
  - `get_lesson({ id })` — 返回单条全文（含正文五段）
  - `list_domains({ status? })` / `list_tags({ status?, domain? })` — 域/标签计数
  - `get_content_version()` — 内容构建时间、commit、条目数
- 默认只返回 `status: verified` 条目；`draft` / `deprecated` 需显式指定。
- 内容更新：服务器 cron 每分钟 `git pull` 并重建 content.json，进程按 mtime 热加载，见 [deploy/README.md](./deploy/README.md)。

## 6. 内容来源与贡献方式

数据源为「本地条目 + 外部源指针」，两者合并进同一份 content.json。

### 6.1 外部源（推荐，零搬运）

贡献者**不需要把内容复制到本仓**，只需在自己的仓库维护 `lessons/**/*.md`，然后向
`sources.json` 提一个只增一行的 PR：

```json
{
  "schema_version": 1,
  "sources": [
    { "repo": "someone/their-lessons", "path": "lessons", "ref": "main" }
  ]
}
```

- 构建时由服务器拉取并合并，**本仓 git 历史中没有正文**，只有这行指针。
- 源仓库需公开可读；作者删除、改私或删除条目后，下一次重建即下架（最长 15 分钟）。
- 源条目必须通过本仓同一套 front-matter 与五段校验，否则该条被跳过，原因写进构建日志。
- 单条命中脱敏规则时同样只跳过该条，不进入产物。
- 外部条目的 `source` 为 `owner/repo`，`source_url` 指向源文件，便于溯源。

### 6.2 本地托管（适合长文或需长期归档）

仍可直接在本仓 `lessons/` 下新增条目走正常 PR；适用于需要本仓长期保留、或源仓库不便公开的内容。
