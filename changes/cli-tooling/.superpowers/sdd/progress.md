
## cwd 警告（ensure-branch 自动写入）

- 隔离上下文：`G:\xiaoyi\ai-coding-lessons`
- Bash cwd 不持续：每条命令都会回到会话初始目录，不会记住上一次的 cd
- 强制规则：后续实现编辑必须使用隔离上下文内的绝对路径，或每条命令以前缀 `cd G:\xiaoyi\ai-coding-lessons &&` 开头

## 2026-10-29 实现完成（T1–T13）

- 新增 `scripts/lib/{build,project,validate-strict,search,scaffold}.mjs`、`scripts/cli/{output,validate,build,check,search,new,init,serve,publish}.mjs`、`bin/lessons.mjs`、`test/cli/*.test.mjs`（6 个文件，32 条用例）
- 改写 `scripts/{build-index,build-content}.mjs` 为薄封装；`index.json` 重建后哈希不变（42610A0A…8D31）
- strict 基线：51 条经验 → 0 warning；为避免误报收紧了三条规则（模糊根因只认「可能是/推测」句式、密钥赋值要求 ≥12 位不透明值、证据无实据仅限单行无信号）
- 验证：`npm run check` / `npm run test:cli`（32 passed）/ `node bin/lessons.mjs validate --strict` / `pnpm --dir server test`（9 passed）全部通过
- 未决风险：`serve` 在 npx 缓存安装场景下复用包内 `server/`，`print-config` 的路径指向包目录而非用户仓库（已在 README 说明需在仓库根运行）

