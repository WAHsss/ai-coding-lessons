---
id: GEN-RN-0015
title: RN 多行 TextInput 文字不居中：用 textAlignVertical，flex 居中无效
domain: frontend/rn
tags: [rn, textinput, textarea, textAlignVertical, layout]
status: verified
scope: generic
applies_to: "React Native Android；Taro Textarea 的 RN 实现"
summary: 组件整体位置靠 flex，文字在输入框内的位置靠 textAlignVertical: center。
first_seen: 2026-10-19
last_verified: 2026-10-26
related: []
---

## 现象

多行输入框的 placeholder 与输入文字在 RN 真机上**偏上**，不垂直居中；H5 端已居中。给容器加 `align-items: center` 没有任何效果。

## 根因

`TextInput`（Taro `Textarea` 的 RN 实现）是**叶子组件**，不是容器：

- `align-items: center` 只影响它在父布局中的位置，对**组件内部文字**无效。
- Android 多行 `TextInput` 的文字默认顶部对齐。

所以「整体居中」和「文字居中」是两个不同层级的问题，混为一谈就会一直调错属性。

## 处置

加 `textAlignVertical`：

```scss
.chat-input-bar-textarea {
  text-align-vertical: center;   /* kebab 写法，编译为 textAlignVertical */
}
```

该属性在 c2rn 的 `TextStylePropTypes` 白名单内，可直接写在跨端 scss 里；H5 / 小程序不识别该属性，**安全忽略**，无需拆 `.rn.scss`。

## 证据

- 真机重载后 placeholder 垂直居中，与 H5 视觉一致（用户确认）。
- 无需额外平台文件，H5 / 小程序产物与行为不变。

## 教训

- RN 端「文字没居中」先分层：组件整体位置（flex） vs 文字在组件内位置（`textAlignVertical`）。
- 叶子组件不要当容器调：调的是它自己的文字属性。
- Taro scss 可以直接写 RN 专有属性，其他端会忽略，比维护多份样式文件成本低。

## 适用边界

- 适用：Android 多行 `TextInput` / `Textarea` 的垂直对齐；单行输入框通常默认居中，不需要该属性。
- 不适用：iOS（该属性默认 `auto` 行为不同，需单独确认）；H5 / 小程序（用 `line-height` 或 flex 居中）。
