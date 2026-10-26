---
id: GEN-RN-0009
title: Hermes 缺 atob/btoa，依赖库在模块加载期调用会让入口注册失败
domain: frontend/rn
tags: [hermes, polyfill, atob, startup, globals]
status: verified
scope: generic
applies_to: "React Native 0.7x + Hermes；依赖浏览器全局 API 的第三方库"
summary: Hermes 无 atob/btoa，需在入口第一条 import 的零 import 模块里安装全局。
first_seen: 2026-10-18
last_verified: 2026-10-26
related: [GEN-RN-0001]
---

## 现象

metro 已连通、bundle 已加载，仍然启动失败：

```
E ReactNativeJS: ReferenceError: Property 'atob' doesn't exist, js engine: hermes
I ReactNativeJS: Running "app" with {"rootTag":11}
E ReactNativeJS: Invariant Violation: "app" has not been registered.
```

注意顺序：`ReferenceError` 出现在 `Running ...` **之前**，说明失败点在入口依赖链的更早处，而不是应用组件本身。

## 根因

`atob` / `btoa` 是浏览器 DOM API，Hermes 不提供。触发链是：

1. 某第三方库（如 markdown 渲染器的预打包产物）内联了 `entities`；
2. 其 `decodeBase64` 在**模块加载期**调用全局 `atob`；
3. 业务模块顶层就实例化了该库，被启动链路 `require`；
4. 求值期抛错，入口模块未完成注册 → `has not been registered`。

## 处置

在根入口**第一条 import** 加载一个**零 import** 的全局补齐模块：

```js
// globals.ts —— 顶层直接安装，不导出函数
if (typeof global.atob !== 'function') {
  global.atob = (input) => Buffer.from(input, 'base64').toString('binary');
}
if (typeof global.btoa !== 'function') {
  global.btoa = (input) => Buffer.from(input, 'binary').toString('base64');
}
```

```js
// index.js —— 必须是第一条 import
import './src/platform/rn/globals';
```

两个约束缺一不可：

- **零 import**：否则它自己的依赖会先求值，副作用被抢先。
- **顶层副作用安装**：MUST NOT 写成「导出 `install()` + 入口调用」，因为 ESM import 会被编译期提升，调用语句必然晚于依赖求值。

## 证据

- 修复前真机 logcat：`Property 'atob' doesn't exist` 与 `has not been registered` 同时出现。
- 修复后两者均归零，`Running ...` 正常完成，首屏渲染成功（2026-10-18 实测）。

## 教训

- 看到 `has not been registered` 不要先怀疑入口路径：往上找更早的 `ReferenceError`，两者要合看（同类取证见 GEN-RN-0021）。
- 补齐宿主缺失的全局 API，正确位置是**入口第一条 import**，不是组件内部。
- 「导出函数 + 入口调用」在 ESM 下不成立，这是最容易写错的一步。

## 适用边界

- 适用：Hermes / 任何缺少浏览器全局的 JS 宿主；依赖库在模块求值期使用全局 API 的场景。
- 不适用：JSC 或 Web 环境（`atob` / `btoa` 原生存在）；依赖在运行期（调用时）才使用 API 的场景，可在更晚位置延迟补齐。
