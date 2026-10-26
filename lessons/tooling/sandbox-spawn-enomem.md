---
id: GEN-TOOL-0009
title: 受限环境非 watch 构建报 spawn ENOMEM，属于环境限制而非代码问题
domain: tooling
tags: [sandbox, enomem, esbuild, build, taro]
status: verified
scope: generic
applies_to: "受限沙箱 / 容器中的前端构建（esbuild 等会 fork 子进程的工具）"
summary: spawn ENOMEM 是子进程或内存受限导致，改用 dev server 产物取证，不要反复重试。
first_seen: 2026-10-18
last_verified: 2026-10-26
related: [GEN-BUILD-0006, GEN-TEST-0003]
---

## 现象

在受限沙箱里执行非 watch 构建，退出码 1，日志末尾：

```
Error: spawn ENOMEM
```

产物时间戳未更新。同一份代码在普通终端或 CI 里构建正常，因此很容易被误判为代码或依赖问题。

## 根因

沙箱对**子进程数量与内存**有限制，esbuild 一类工具需要 fork 子进程做 transform，创建失败即 `ENOMEM`。这类错误与代码无关，是执行环境边界。

同类信号还有 `Zone Allocation failed - process out of memory`（并行 worker 过多）。

## 处置

1. **不把该失败当代码问题**，也不要反复重试（重试只会重复失败）。
2. 改用 **dev server 产物**取证：启动 watch 模式 → 等 `/status` 返回 `packager-status:running` → 拉 bundle → grep 目标模块。
3. 需要真实出包时，把构建放到**不受限的环境**（CI runner、云主机、本地终端）执行。

## 证据

- 沙箱内非 watch 构建稳定复现 `spawn ENOMEM`，产物 mtime 不变。
- 同一代码在 dev server 模式下可正常产出 bundle，grep 目标符号命中。
- 串行单进程执行（降低并行度）可绕开部分内存类限制。

## 教训

- 看到 `ENOMEM` 先确认是不是环境限制：换一个不受限的执行位置验证一次即可定性。
- 「构建失败」不等于「代码错误」，产物取证链在两种环境里应当一致。
- 受限环境下优先选「常驻 dev server + 拉包校验」，比反复触发全量构建省时。

## 适用边界

- 适用：沙箱 / 低内存容器中的 esbuild、webpack、metro 全量构建。
- 不适用：内存充足的本地或 CI 环境；此时 `ENOMEM` 更可能是真实的内存泄漏或依赖膨胀，需要排查。
