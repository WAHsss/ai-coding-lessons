---
id: GEN-TOOL-0002
title: adb server 被回收导致 reverse 隧道失效，启动与采集必须放同一条命令
domain: tooling
tags: [adb, reverse, sandbox, tunnel, android]
status: verified
scope: generic
applies_to: "受限沙箱 / 容器环境中的 adb 真机调试"
summary: 反向隧道是 adb server 会话级映射，进程被回收即失效，隧道与启动要同一条命令完成。
first_seen: 2026-10-18
last_verified: 2026-10-26
related: [GEN-TEST-0001]
---

## 现象

每条 adb 命令都打印 `* daemon not running; starting now at tcp:5037`；上一条命令里建立的隧道，下一条命令就不通，App 报 `could not connect to development server`。

把 `adb reverse` 和 `am start` 分成两条命令执行时，这个现象**必然复现**。

## 根因

`adb reverse` 是 **adb server 的会话级映射**：隧道挂载在 server 进程上，server 一退出映射即消失。

受限沙箱会在**命令结束后回收 adb server 进程**，于是每条新命令都重启 server、丢失上一次的隧道。

## 处置

把整条链路放进**同一条持续运行的命令**：

```bash
adb start-server \
 && adb reverse tcp:8081 tcp:8081 \
 && adb shell am force-stop <package> \
 && adb shell am start -n <package>/.MainActivity \
 && adb logcat -v time | grep -E 'ReactNative|AndroidRuntime'
```

采集期间按需每 10 秒重设一次 `adb reverse` 兜底。**MUST NOT** 把「设隧道」和「启动 App」拆成多条命令。

## 证据

- 逐条命令执行时，每次均观察到 daemon 重启、隧道失效。
- 改为单命令脚本后，App 成功取到约 `13.5MB` bundle，日志出现 `Running "<app>"`。
- 采集期间进程存活稳定，未再出现 `could not connect to development server`。

## 教训

- 「隧道设了却不通」先怀疑 server 生命周期，而不是怀疑端口或防火墙。
- 在会被回收进程的环境里，任何依赖 daemon 会话状态的操作都要与使用方同批执行。
- 频繁重设隧道会引入 UI 抖动，按 10s 一次而非每条命令一次即可。

## 适用边界

- 适用：沙箱 / 容器 / CI 中被按命令回收子进程的环境；本地稳定的开发机一般不受影响。
- 不适用：常驻 adb server 的普通本地环境（隧道可跨命令保持）。
