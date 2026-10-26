---
id: GEN-TOOL-0001
title: PowerShell 执行策略禁用导致 pnpm/npx 无法运行，改用 .cmd 入口
domain: tooling
tags: [powershell, execution-policy, pnpm, windows]
status: verified
scope: generic
applies_to: "Windows PowerShell 5.x；pnpm / npm / npx 的 .ps1 包装脚本"
summary: 看到 cannot be loaded because running scripts is disabled 时换 .cmd 入口，不要改机器策略。
first_seen: 2026-10-18
last_verified: 2026-10-26
related: [GEN-TEST-0001]
---

## 现象

PowerShell 5 终端里执行 `pnpm exec jest ...` 直接失败，命令未执行：

```
pnpm : File C:\...\pnpm.ps1 cannot be loaded because running scripts is disabled on this system.
```

同一终端还伴随一条 profile 快照脚本（`powershell-profile-snapshot.ps1`）加载失败的报错，容易被误读为环境损坏。

## 根因

系统执行策略（ExecutionPolicy）不允许运行 `.ps1` 脚本。Shell 把 `pnpm` 解析到同目录的 `pnpm.ps1` 包装脚本，加载即被拒。**与依赖是否安装、Node 版本、包管理器配置无关**。

## 处置

改用 `.cmd` 入口，或经 `cmd` 转发：

```powershell
pnpm.cmd exec jest src/__tests__/pages/home-tabs.test.ts
# 或
cmd /c pnpm exec jest ...
```

在脚本、CI、Agent 工具调用中统一写 `pnpm.cmd`，从源头避免命中 `.ps1`。

**不要**为了省事去改机器的 `Set-ExecutionPolicy`：那会改变整台机器的安全边界，且换台机器/换账号又会复现。

## 证据

- `pnpm.cmd exec jest src/__tests__/pages/home-tabs.test.ts` 正常输出 `PASS`。
- 同一命令把 `pnpm.cmd` 换成 `pnpm` 即报上述错误，二者只差入口脚本后缀。

## 教训

- 见到 `cannot be loaded because running scripts is disabled`，先换 `.cmd` 入口，不要误判为依赖缺失或 Node 环境损坏。
- 这类问题在「命令可用性」上表现成随机失败（取决于 shell 类型），把它固化成书写规范比每次排查便宜。
- 附带收益：`.cmd` 入口在 `cmd.exe`、PowerShell、CI 里都能跑，脚本可移植性更好。

## 适用边界

- 适用：Windows + PowerShell 且执行策略为 Restricted / AllSigned 的机器。
- 不适用：已显式放开执行策略的环境（此时 `.ps1` 可用）；非 Windows 平台无此机制。
