# Final Review — cli-tooling

- Range: `0d5fdfc..9553b72`
- Verdict: **pass**

## Spec 合规（对照 proposal.md）

| 验收标准 | 结论 | 证据 |
|---|---|---|
| 1 `lessons validate` 与脚本等价、退出 0 | 通过 | 实现共用 `validateLesson`/`checkUniqueIds`；实测 `✓ 校验通过：51 条经验` |
| 2 构建产物字节一致 | 通过 | 重构前后 `index.json` 哈希同为 `42610A0A…8D31` |
| 3 `--root` 写入指定仓库而非 cwd | 通过 | `test/cli/project.test.mjs` 四输入用例 |
| 4 现有条目 `validate --strict` 退出 0 | 通过 | 基线 51 条 → 0 warning（规则已按基线收紧） |
| 5 坏条目 strict 报 2 warning 且退出 1 | 通过 | `test/cli/validate-strict.test.mjs` |
| 6 init → new → validate 全链退出 0 | 通过 | 临时目录实测 `CHAIN=0` |
| 7 非 TTY 缺参 `new` 立即退出 2 | 通过 | 实测 `NOTTY=2`，`test/cli/cli.test.mjs` 覆盖 |
| 8 未编译 `serve` 退出 1 并给修复命令 | 通过 | 重命名 `server/dist` 后实测 |
| 9 `--print-config` stdout 为合法 JSON | 通过 | 管道 `JSON.parse` 成功；`test/cli/serve-config.test.mjs` |
| 10 CLI 检索与 server 顺序一致 | 通过 | `test/cli/search-parity.test.mjs` 7 组参数（server 已编译，未 skip） |
| 11 `publish` 输出合法 JSON + 正确 PR 链接 | 通过 | 实测 `https://github.com/WAHsss/ai-coding-lessons/edit/main/sources.json` |
| 12 CI 跑 `npm run test:cli` | 通过 | `.github/workflows/ci.yml` 新增步骤；本地 32 用例全绿 |

## 代码质量

- **D1 薄封装**：`scripts/build-index.mjs` / `build-content.mjs` 只做 cwd 解析与错误格式化，
  逻辑单点在 `scripts/lib/build.mjs`，CLI 与脚本共用同一实现，无重复。
- **D2 根解析一次**：所有命令通过 `resolveProject` 取得绝对路径，未再有 `path.resolve('lessons')`
  式的隐式依赖。
- **D3 两档校验**：`validateLesson` 的 error 与 strict 的 warning 分离，CI 只用 error，历史条目零影响。
- **D4 一致性命门**：两份 search 实现不共享代码，由 parity 测试对齐；server 未编译时显式 skip。
- **输出纪律**：`output.mjs` 把所有叙述写到 stderr，stdout 只由 `out`/`json` 写入，
  `--print-config` 与 `--json` 均可直接管道给 `JSON.parse`。
- 无新依赖；Node 内置模块（`node:fs/promises`、`node:readline/promises`、`node:child_process`）。
- 错误路径统一：缺 `lessons/`、缺编译产物、`--root` 不存在、缺参均给出可复制命令并返回明确退出码。

## 遗留与风险（不阻塞）

1. `serve` 复用 CLI 包内 `server/`；若通过 `npx github:` 从缓存运行时，包目录与用户仓库不同，
   `print-config` 中的路径指向包目录。README 已注明需在仓库根运行。属已知限制，非缺陷。
2. strict 的「证据无实据」已降级为「单行且无信号才报警」，对多条定性证据不报警——
   这是基线阶段为避免误报做的取舍，待条目质量分布变化后再收紧。
3. `new` 生成的模板仍含占位文字，未补齐时 `validate --strict` 会提示；这是设计意图（提示而非放行）。
