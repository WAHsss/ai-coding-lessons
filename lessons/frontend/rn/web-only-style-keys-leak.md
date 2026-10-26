---
id: GEN-RN-0020
title: Web 专有样式键被透传给 RN，触发 Invalid props.style 警告
domain: frontend/rn
tags: [rn, style, c2rn, warning, compat]
status: verified
scope: generic
applies_to: "Taro RN 样式管线；复用 Web SCSS 的跨端项目"
summary: box-sizing/white-space/text-overflow 等 Web 键会原样透传成 RN 属性，需在编译期剔除。
first_seen: 2026-10-21
last_verified: 2026-10-26
related: [GEN-RN-0006]
---

## 现象

LogBox 反复弹出，文案形态固定：

```
Warning: Failed prop type: Invalid props.style key 'boxSizing' supplied to 'TextInput'
Warning: Failed prop type: Invalid props.style key 'whiteSpace' supplied to 'Text'
Warning: Failed prop type: Invalid props.style key 'textOverflow' supplied to 'Text'
Warning: Failed prop type: Invalid prop 'display' of value 'inline-block' supplied to 'Text',
  expected one of ['flex','none']
```

功能通常还能跑，但每次进页面都刷警告，掩盖了真正需要关注的问题。

## 根因

c2rn（`taro-css-to-react-native`）会把 SCSS 声明转成驼峰属性后**原样透传**，不做「该属性在 RN 是否存在」的校验：

| SCSS 写法 | 透传结果 | RN 实际 |
|---|---|---|
| `box-sizing: border-box` | `boxSizing` | 不存在（RN 默认 border-box 语义） |
| `white-space` / `word-break` | `whiteSpace` / `wordBreak` | 不存在 |
| `text-overflow: ellipsis` | `textOverflow` | 不存在，应用 `numberOfLines` + `ellipsizeMode` |
| `outline` / `vertical-align` | 同名驼峰 | 不存在 |
| `display: inline-block` | `inline-block` | 仅支持 `flex` / `none` |

## 处置

在样式兼容插件里统一**剔除**（而不是逐文件改写 SCSS）：

```js
// postcss 兼容插件规则示例
const DROP = new Set(['box-sizing', 'white-space', 'word-break', 'text-overflow', 'outline', 'vertical-align']);
// display: inline / inline-block → 剔除；inline-flex → flex
```

单行省略需求改为组件层处理：

```tsx
<Text numberOfLines={1} ellipsizeMode="tail">...</Text>
```

## 证据

- 修复后重启 Metro，bundle 内不再出现 `boxSizing` / `whiteSpace` / `textOverflow` key。
- 真机进入登录页与管理首页，`adb shell logcat -d` 过滤 `Invalid props.style` 无命中。
- LogBox 不再弹出上述三类警告，后续排查其他警告时不再被噪声干扰。

## 教训

- 跨端复用 Web SCSS 时，**属性可用性差异**要在编译期统一处理，别指望逐个文件改。
- 警告也是证据：`Invalid props.style key 'x'` 直接给出了需要剔除的键名列表。
- `display` 在 RN 只有 `flex` / `none`，`inline-block` 是无效值而非降级值。

## 适用边界

- 适用：Taro RN / react-native-web 之外的 RN 样式转译；大规模复用 Web 样式的项目。
- 不适用：纯 H5 / 小程序；原生 `StyleSheet.create` 手写对象（不会产生这些键）。
