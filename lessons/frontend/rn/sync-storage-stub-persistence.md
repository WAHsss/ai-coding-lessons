---
id: GEN-RN-0005
title: 同步存储桩只做内存实现会导致冷启动丢态
domain: frontend/rn
tags: [rn, storage, persistence, cold-start, taro-compat]
status: draft
scope: generic
applies_to: "Taro RN（taro-rn 存储 API 为「暂不支持」错误桩时）"
summary: 用内存实现顶替同步存储会丢登录态，需内存+落盘+启动回灌+就绪屏障四件套，尚未落地验证。
first_seen: 2026-10-18
last_verified: 2026-10-26
related: [GEN-RN-0001]
---

## 现象

taro-rn 未实现同步存储，`getStorageSync` / `setStorageSync` / `removeStorageSync` 是直接抛错的桩。用一个**会话级内存对象**顶替后：

- 应用内读写正常，登录态、开关状态都「看起来对」。
- **进程被系统回收或用户彻底退出后重启**，所有状态回到初始值，需要重新登录。
- 无任何报错，属纯功能缺失，验收脚本（只测同会话内读写）发现不了。

## 根因

内存实现的生命周期与 JS 运行实例绑定，进程结束即丢失。同步 API 要求「调用返回即已持久化」，而内存对象只满足「调用返回」。两者语义差在冷启动时才暴露。

此外，覆盖必须**双目标**：`Taro` 对象，以及底层 `@tarojs/taro-rn/dist/lib/unsupportedApi` 模块。因为 babel 插件会把 `Taro.getStorageSync(...)` 在**编译期**重写为对子模块的直接引用，只补上层对象对这类调用点无效。

另注：识别错误桩不能用 `Function.prototype.toString()`（见 GEN-RN-0001），Hermes 下恒为 false。

## 处置

四件套，缺一件都会在冷启动暴露：

1. **内存缓存**：读写先走内存，保证同步语义与速度。
2. **落盘**：每次写操作同步写入 `AsyncStorage` / 原生 KV（对调用方仍是同步返回，落盘走异步）。
3. **启动回灌**：应用启动早期把所有 key 从持久层读回内存，且必须在**首个业务读**之前完成。
4. **就绪屏障**：提供 `await storageReady` 一类信号，首屏渲染逻辑等待它，避免「回灌未完成就读到空值」。

```js
// 伪代码
let readyResolve;
const storageReady = new Promise((r) => { readyResolve = r; });
async function init() {
  const all = await AsyncStorage.getAllKeys();
  const pairs = await AsyncStorage.multiGet(all);
  for (const [k, v] of pairs) memory.set(k, v);
  readyResolve();
}
```

## 证据

- 现状记录（本项目）：同步存储为**会话级内存实现**，冷启动不恢复上次登录态，已列为二期改造，未落地验证。
- 已证实的部分：错误桩存在，真机日志输出 `RN 端暂不支持 API getStorageSync`；双目标覆盖与运行时探针判定均已生效（见 GEN-RN-0001）。
- 待补证据：加入落盘 + 回灌后，`force-stop` 再启动仍保持登录态；且首屏无「闪一下未登录」。

## 教训

- 「会话内正常」不足以证明存储实现正确，必须专门测一次**进程被杀后重启**。
- 同步语义的实现要显式处理「首次读早于回灌完成」，否则会出现偶发未登录，且难以复现。
- 覆盖第三方桩时先确认调用点是否被编译期重写，只改入口对象会漏一半。

## 适用边界

- 适用：RN 上以内存顶替同步存储 API 的兼容层；任何「同步 API + 异步后端」的桥接实现。
- 不适用：小程序 / H5（原生提供持久化同/异步存储）；纯内存缓存且明确接受易失语义的场景。
