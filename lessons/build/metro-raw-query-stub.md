---
id: GEN-BUILD-0007
title: webpack 的 ?raw 查询串在 metro 下无法解析，用空桩模块接管
domain: build
tags: [metro, webpack, raw-loader, resolver, stub]
status: verified
scope: generic
applies_to: "React Native 0.7x metro；从 Web 工程复用的代码"
summary: xxx?raw 是 webpack 语法，metro 会把查询串当模块名解析，需在 resolveRequest 里映射为桩。
first_seen: 2026-10-18
last_verified: 2026-10-26
related: [GEN-RN-0006]
---

## 现象

RN 构建报模块解析失败：

```
Unable to resolve module .../katex.min.css?raw
```

H5 端同一代码正常，因为 webpack 认识该语法。

## 根因

`xxx?raw` 是 webpack 的 `asset/source` 查询串，语义是「把文件内容当字符串引入」。metro **不识别查询串**，会把整条 `xxx?raw` 当作模块名进入静态依赖图，解析自然失败。

## 处置

在 `metro.config.js` 的 `resolver.resolveRequest` 里接管含 `?raw` 的请求，映射到空字符串桩：

```js
// metro-raw-stub.js
module.exports = '';
```

```js
// metro.config.js
resolveRequest: (context, moduleName, platform) => {
  if (moduleName.includes('?raw')) {
    return { filePath: require.resolve('./metro-raw-stub.js'), type: 'sourceFile' };
  }
  return originalResolveRequest(context, moduleName, platform);  // 其余原样委派
}
```

关键点：**其余请求必须委派给 Taro/RN 自己的 `resolveRequest`**，它负责虚拟文件等特例，不能整体替换。

## 证据

- 修复前：构建报 `Unable to resolve module ...?raw`。
- 修复后：RN 构建通过；因 RN 端不使用该文本内容，空串桩不影响功能。
- H5 产物无变化（仍由 webpack 处理 `?raw`）。

## 教训

- 跨端复用代码时，**构建器特有语法**要单独列出，别指望另一个打包器兼容。
- 接管 resolver 时保留原实现，只对目标模式短路，避免引入新的特例失败。
- 桩模块内容要与「该端是否需要真实内容」对齐：不需要就用空串，最省成本。

## 适用边界

- 适用：metro 打包的 RN 工程中复用含 `?raw`、`?inline` 等 webpack 查询串的代码。
- 不适用：H5 / webpack 工程；RN 端确实需要文件原文的场景（此时应改为读取真实文件而不是桩）。
