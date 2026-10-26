---
id: GEN-TOOL-0004
title: 沙箱 shell 里 PATH 与环境变量「凭空消失」，命令要显式前缀
domain: tooling
tags: [sandbox, path, environment, powershell, node]
status: verified
scope: generic
applies_to: "受限执行沙箱中的 shell 命令；Windows PowerShell"
summary: 沙箱新 shell 不一定继承用户 PATH，命令用显式前缀或绝对路径，不要因此重装环境。
first_seen: 2026-10-18
last_verified: 2026-10-26
related: [GEN-TOOL-0001]
---

## 现象

同一仓库、同一目录，上一条命令能用 `pnpm`，下一条报「术语 'pnpm' 不会被识别」；`node -v` 同样失效；`$env:ANDROID_HOME` / `$env:JAVA_HOME` 读出空值。

但注册表里这些变量是有值的，实际环境也没有损坏。

## 根因

沙箱新建 shell 的环境**不一定继承用户级 PATH 与变量**。而构建又可能要求特定 Node 版本目录，默认 PATH 指向的是另一个版本，于是表现为「命令随机不可用」。

## 处置

对受影响的命令显式补环境，不做全局修改：

```powershell
$env:PATH = '<node-version-dir>;<other-dir>;' + $env:PATH
```

- `pnpm` 仍解析不到时用绝对路径：`& '<...>\pnpm.cmd' <script>`。
- `ANDROID_HOME` / `JAVA_HOME` 为空时，在命令内显式赋值。
- **不要**因此重装 JDK / SDK / Node。

## 证据

- 同一会话中 `pnpm dev:rn:prod` 曾因 PATH 报未识别，改用绝对路径后正常。
- `$env:ANDROID_HOME` 实测为空，而注册表 `HKCU:\Environment` 中确有该值。
- 显式前缀后构建与测试命令稳定可执行。

## 教训

- 「命令突然不存在」先查 PATH 继承，不要归因为安装损坏。
- 环境差异用**命令内前缀**隔离，比改系统变量安全，也便于复现。
- 版本相关命令（Node 20 vs 24）必须显式指定目录，不能依赖默认解析。

## 适用边界

- 适用：沙箱 / 容器 / 远程 Agent 执行环境；多 Node 版本并存的机器。
- 不适用：普通本地终端（PATH 正常继承），此时显式前缀属于冗余。
