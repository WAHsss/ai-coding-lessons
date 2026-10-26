---
id: GEN-H5-0002
title: 输入框对齐要拆成宿主层与内层两段，内边距只放一层
domain: frontend/h5
tags: [h5, input, alignment, padding, box-model]
status: verified
scope: generic
applies_to: "H5 自定义输入框；带图标的搜索框/表单行"
summary: 宿主容器负责高度与垂直居中，内层 input 负责文字基线，padding 只加在其中一层。
first_seen: 2026-10-18
last_verified: 2026-10-26
related: [GEN-H5-0001, GEN-RN-0015]
---

## 现象

搜索框内的文字、图标、光标三者对不齐：文字偏上/偏下，图标与文字不在同一视觉中线，光标高度异常。反复调 `line-height`、`padding` 只会让另一处更歪。

## 根因

一个输入框实际是**三层结构**：

1. 宿主容器（div）
2. 内层 `input`（浏览器原生控件，有自己的盒模型与基线）
3. 装饰元素（图标、清除按钮）

抖动来源是：高度由宿主控制、垂直位置由 `input` 基线决定，而 `padding` 同时加在两层时，两套内边距互相叠加，任何一处调整都会破坏另一端。

## 处置

明确分工，只改一层：

```css
/* 宿主：负责高度与垂直居中 */
.field { display: flex; align-items: center; height: 44px; padding: 0 12px; }

/* 内层：负责文字与光标，去掉自身竖向内边距 */
.field input { height: 100%; padding: 0; border: 0; line-height: normal; }
```

要点：

- `padding` **只放一层**（推荐宿主层放横向，内层清零）。
- 内层高度用 `100%` 撑满宿主，不再单独设 `line-height`。
- 图标用 `align-items: center` 对齐，不靠 margin 微调。

## 证据

- 修复前：文字与图标基线不一致，光标偏高；调整内层 padding 会让整体偏移。
- 按分层设置后三者对齐，不同字号下保持稳定。
- RN 端同类问题由 `textAlignVertical` 解决，说明「宿主位置」与「文字位置」必须分开处理。

## 教训

- 输入框对齐问题的本质是**盒模型分层**，不是某个魔法数值。
- 内边距只加一层，是最省事的稳定做法；两层叠加必然进入互相抵消的循环。
- 与 RN 对照能更快定性：Web 用 flex + 高度，RN 用 `textAlignVertical`。

## 适用边界

- 适用：自定义 H5 输入框、带图标的表单行、多字号场景。
- 不适用：原生 `<input>` 默认样式未改造的简单表单；RN / 小程序（另有对齐机制）。
