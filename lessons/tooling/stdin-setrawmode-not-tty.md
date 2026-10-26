---
id: GEN-TOOL-0003
title: 非交互终端启动 dev server 崩溃：process.stdin.setRawMode 不存在
domain: tooling
tags: [node, tty, stdin, dev-server, ci]
status: verified
scope: generic
applies_to: "Node.js CLI 在非 TTY（后台/CI/Agent）环境运行"
summary: 非 TTY 下 setRawMode 不存在，注入 shim 补齐即可，不要改工具源码。
first_seen: 2026-10-18
last_verified: 2026-10-26
related: [GEN-TOOL-0002]
---

## 现象

后台启动 dev server 时，打印 `Starting dev server on port 8081...` 后立即崩溃：

```
TypeError: process.stdin.setRawMode is not a function
    at <reporter module>:12
```

进程退出，8081 端口无监听。人工在交互终端里运行同一命令则正常。

## 根因

终端上报模块在**模块加载时**无条件调用 `process.stdin.setRawMode(true)`。该方法只存在于 TTY 环境；后台进程、CI、Agent 调用拿到的 stdin 不是 TTY，方法不存在。

属**运行环境限制**，不是项目缺陷，也不是命令写错。

## 处置

先加载一个 shim，补齐缺失方法：

```js
// stdin-shim.js
if (process.stdin && typeof process.stdin.setRawMode !== 'function') {
  process.stdin.setRawMode = () => {};
  process.stdin.isTTY = process.stdin.isTTY || false;
}
```

```bash
NODE_OPTIONS='--require ./stdin-shim.js' pnpm dev:rn
```

人工交互场景不需要 shim，保持原命令即可。

## 证据

- 后台启动两次均复现 `setRawMode is not a function`，进程退出、端口无监听。
- 加 shim 后 8081 正常监听，`/status` 返回 `packager-status:running`。
- 同一命令在交互终端不加 shim 也能正常运行，证明只与 TTY 有关。

## 教训

- 「交互能跑、后台必崩」先看 TTY 相关 API：`setRawMode`、`isTTY`、`columns`。
- 优先用注入式 shim，不要为了跑通去改第三方源码（升级后会被覆盖）。
- 把 shim 固化进后台启动脚本，比每次临时加参数可靠。

## 适用边界

- 适用：Node CLI / dev server 在 CI、容器、Agent 后台运行；任何非 TTY 环境。
- 不适用：需要真实键盘输入的交互式工具（shim 会掩盖真实需求）。
