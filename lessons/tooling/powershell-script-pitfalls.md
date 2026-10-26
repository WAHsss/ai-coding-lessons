---
id: GEN-TOOL-0006
title: PowerShell 脚本的 6 个高频陷阱：自动变量、别名冲突、时间比较、扩展名
domain: tooling
tags: [powershell, scripting, windows, pitfalls]
status: verified
scope: generic
applies_to: "Windows PowerShell 5.x / 7.x 脚本与自动化"
summary: $pid 只读、单字母函数撞别名、LastWriteTime 毫秒比较、node 不认 .bundle、日志被占用、CLIXML 噪声。
first_seen: 2026-10-18
last_verified: 2026-10-26
related: [GEN-TOOL-0001, GEN-TOOL-0005]
---

## 现象

同一批自动化脚本反复踩到六类互不相干的错误，每类都表现为「命令失败但原因不直观」：

| 现象 | 实际原因 |
|---|---|
| 给 `$pid` 赋值报「只读」 | `$pid` 是 PowerShell 自动变量 |
| 自定义函数报「命令名与别名冲突」 | 函数名与内置别名（如 `cp`）同名 |
| 轮询提前退出 | `[datetime]` 与带毫秒的 `LastWriteTime` 直接不等比较 |
| `node --check xxx.bundle` 报 `ERR_UNKNOWN_FILE_EXTENSION` | node 不认 `.bundle` 扩展名 |
| 读日志报「文件被另一进程占用」 | 后台进程正在写同一文件 |
| 输出夹杂 `<Objs ...>` 噪声 | 进度流被序列化为 CLIXML |

## 根因

五类来自 PowerShell 语言/运行时本身，一类来自 node 的扩展名白名单：

- 自动变量（`$pid`、`$input`、`$args` 等）不可写。
- 别名优先级高于函数，同名函数被遮蔽或冲突。
- `LastWriteTime` 精度到毫秒，与秒级 `[datetime]` 比较永远不等。
- node 只加载 `.js` / `.mjs` / `.cjs`。
- 文件句柄被写入方持有。
- 命令输出经序列化后混入 CLIXML。

## 处置

```powershell
# 1) 换变量名
$apid = $LASTEXITCODE
# 2) 函数名用多字母、加前缀
function Get-BuildStatus { }
# 3) 比较时间改秒级或字符串
[datetime]::Now.Subtract($file.LastWriteTime).TotalSeconds -gt 30
# 4) 复制成 .js 再校验
Copy-Item x.bundle x.js; node --check x.js
# 5) 读日志包 try/catch，或等任务结束
try { Get-Content -Raw $log } catch { }
# 6) 关掉进度流
$ProgressPreference = 'SilentlyContinue'
```

## 证据

- 六类均在真实脚本中出现过，按上表替换后脚本稳定执行。
- `.bundle` 复制为 `.js` 后 `node --check` 正常返回，行号定位与 logcat 一致。
- 关闭进度流后输出为纯字符串，可直接被后续命令解析。

## 教训

- PowerShell 的「只读」「冲突」类报错几乎都指向语言内置机制，不需要查环境。
- 与文件系统时间比较时，先明确精度，再决定比较方式。
- 自动化输出要求可被程序解析，任何噪声（CLIXML、进度条）都要主动关掉。

## 适用边界

- 适用：Windows PowerShell 自动化脚本、Agent 执行命令的场景。
- 不适用：bash / zsh（无这些内置变量与别名机制）；已改用 pwsh 7 且脚本显式禁用别名的项目可减少部分问题。
