---
id: GEN-RN-0006
title: RN 样式管线只认 c2rn 子集：flex 简写、rpx、calc、CSS 变量都会中断编译
domain: frontend/rn
tags: [rn, scss, css-to-react-native, style, compile]
status: verified
scope: generic
applies_to: "Taro RN 样式管线（taro-css-to-react-native / postcss-pxtransform）"
summary: 跨端 SCSS 只能落在 c2rn 子集内，flex 简写、rpx、calc 残留与 CSS 变量需在构建期归一。
first_seen: 2026-10-19
last_verified: 2026-10-26
related: [GEN-RN-0014, GEN-RN-0020]
---

## 现象

样式写法在 H5 正常，RN 端要么**编译期中断**，要么字段静默失效：

```
TransformError ... index.scss: Unexpected token type: word
Failed to parse declaration "flex: 0 0 100%"
```

```
Unexpected token type: word/function
```

运行时表现还有：字号保留 `calc(24px * 1)` 导致无效；`var(--x)` 在本文件未定义时被替换成 `undefined`，元素无样式。

## 根因

RN 样式由 `taro-css-to-react-native` 转成 Yoga 子集对象，对已知属性用**严格 token 语法**解析。四类常见失配：

1. **CSS 自定义属性**：RN 无此机制；`postcss-css-variables` 在变量缺失时把整段 `var()` 替换为 `undefined`。
2. **`rpx`**：`postcss-pxtransform` 的 rn 分支 `transUnits` 硬编码 `['px']`，不认 `rpx`。
3. **`calc()`**：变量内联后残留 `calc(24px * 1)`，RN 侧无效。
4. **简写与 DOM 语义**：`flex: 0 0 100%`、`border: none`、`background: currentColor`、渐变、逗号多字族 `font-family`、`calc(Npx + env(safe-area-inset-bottom))`、百分比 `translate` 均可能抛错。

## 处置

在不改存量 SCSS 的前提下，构建期做归一：

1. **变量注入**：sass 阶段按需注入 `:root { --token-*: ... }` 块，保证变量在编译期可解析；数值仍以单一文件为唯一来源。
2. **单位转换**：让 `rpx` 走支持它的分支（`targetUnit: 'px'`），而不是 rn 分支。
3. **折叠 calc**：用 `postcss-calc` 在编译期算出数值。
4. **兜底插件**：对剩余写法做等价替换或降级（`flex` 简写拆成长写、`border: none` 转 `border-width: 0` 等）。

```scss
/* RN 兼容写法 */
flex-grow: 0;
flex-shrink: 0;
flex-basis: 100%;
```

## 证据

- 修复前：`TransformError ... Failed to parse declaration "flex: 0 0 100%"`，打包中断。
- 改长写法后同一 bundle 请求返回成功（`size=14,046,662`）。
- 四类归一规则落地后 RN 构建成功，H5 产物无变化。

## 教训

- 写完跨端 SCSS **先拉一次 bundle 验证能否编译**，不要等真机才发现。
- 「H5 能跑」不代表写法合法；c2rn 的接受集是子集，判据是编译期，不是浏览器。
- 新增写法时优先考虑是否需要在兼容插件里补一条规则，避免同类问题第三次出现。

## 适用边界

- 适用：Taro RN / react-native-web 之外的 RN 样式管线，尤其是复用 Web SCSS 的跨端项目。
- 不适用：纯 H5 / 小程序；原生 StyleSheet 手写对象（不存在 SCSS 转译这一层）。
