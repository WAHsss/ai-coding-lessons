---
id: GEN-TEST-0003
title: 全量 Jest 先被沙箱拦临时文件、再并行 OOM，用 --runInBand + 4GB 堆
domain: testing
tags: [jest, sandbox, oom, runinband, windows]
status: verified
scope: generic
applies_to: "Jest 全量测试；受限沙箱或内存受限机器"
summary: 沙箱拦 worker 临时文件、沙箱外并行 OOM，单进程串行 + 4GB 堆一次通过。
first_seen: 2026-10-18
last_verified: 2026-10-26
related: [GEN-TOOL-0009]
---

## 现象

全量测试在受限沙箱内失败：

```
G:\_tmp_* not allowed
```

worker 被 `SIGTERM` 终止。改到沙箱外重跑，多 worker 并行时崩溃：

```
FATAL ERROR: Zone Allocation failed - process out of memory
```

两种失败形态不同，但都指向「环境」而不是用例。

## 根因

双重限制叠加：

1. **沙箱拦截** jest worker 使用的磁盘临时文件（宿主限制，非用例问题）。
2. **内存不足**：每个 worker 约 330MB，本机物理内存撑不住多 worker 并行转译与执行。

所以「换到沙箱外」只解决了第一层，第二层仍会以 OOM 的形式出现。

## 处置

沙箱外以单进程串行运行，并抬高堆上限：

```powershell
$env:NODE_OPTIONS='--max-old-space-size=4096'
pnpm exec jest --runInBand
```

`--runInBand` 消除并行内存峰值；`--max-old-space-size` 给单进程足够空间。

## 证据

- 修复前：沙箱内 `_tmp_* not allowed` + SIGTERM；沙箱外 `Zone Allocation failed`。
- 修复后：`83` 个套件 / `693` 个用例全部通过，耗时 `71.76s`，exit 0。

## 教训

- 两段式失败要分开定位：先解决「能不能跑」，再解决「跑得动」。
- 内存受限时，并行 worker 是放大器而不是加速器；报 OOM 先降并行度。
- 全量测试命令固化在脚本里，避免每次重新试参数。

## 适用边界

- 适用：Windows 受限沙箱、低内存开发机上的 Jest 全量运行。
- 不适用：内存充足且 CI 隔离良好的环境（并行 worker 更快）；单测调试场景（应直接用文件路径过滤）。
