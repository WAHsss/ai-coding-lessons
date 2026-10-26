---
id: GEN-RN-0002
title: RN 绝对定位弹层被祖先裁剪，z-index 无效
domain: frontend/rn
tags: [rn, layout, absolute, clipping, z-index, popup]
status: verified
scope: generic
applies_to: "React Native 0.7x（Yoga 布局）"
summary: 绝对定位的弹出层无法逃逸祖先视图边界，z-index 只管同级，改文档流展开或独立层级。
first_seen: 2026-10-18
last_verified: 2026-10-26
related: [GEN-RN-0004]
---

## 现象

列表行的「更多菜单」用 `position: absolute; top: 88px; right: 24px; z-index: 102` 实现，真机上**只露出下边缘一条细边**（约 26px，能看到字符顶端）。换成列表**最后一项**同样如此。

排查中先怀疑 `overflow: hidden`，但产物里该行样式对象只有 `position / display / flexDirection / alignItems / padding / borderBottomWidth`，**没有任何 overflow 字段**，该假设被证伪。

## 根因

RN 的 `View` 是真实原生视图，`position: absolute` 的子树**不能**像 Web 那样逃逸祖先视图的绘制与裁剪边界；`z-index` 只在**同级**视图之间有效，无法越过祖先的裁剪。

补充判据：`uiautomator dump` 报出**倒置 bounds**（例：`[768,972][969,860]`，即 `y1 > y2`），这是元素可见区被祖先裁剪后与外框相交的典型特征。

## 处置

两条路，按交互复杂度选：

1. **回到文档流内展开**（最稳）：行容器 `flex-wrap: wrap`，菜单改为

   ```css
   position: relative;
   width: 100%;
   flex-grow: 0;
   flex-shrink: 0;
   flex-basis: 100%;
   ```

   独占一行，任何祖先都不再存在可裁的内容。

2. **放到不会被裁剪的层级**：抽屉 / 页面根级覆盖层，配合测量定位；或用原生 `Modal` 独立窗口（见 GEN-RN-0004）。

按平台分支：RN 走文档流展开，H5 / 小程序保持悬浮菜单，互不影响。

## 证据

- bundle 内命中 `"...-menu--rn-inline": { ... "flexBasis": "100%" ... }`。
- 真机取帧：三项菜单完整列出，下方会话项被顺次下推。
- `uiautomator dump` 中该元素 bounds 由倒置变为正常（`y1 < y2`）。

## 教训

- 判别「裁剪」还是「遮挡」的快捷办法：把目标元素放到**列表末尾**再观察。仍只露一条边 → 裁剪；恢复正常 → 遮挡。
- RN 里凡「悬浮 / 下拉 / 气泡」类弹层，要么进文档流，要么进独立层级；不要用 `z-index` 硬顶。
- Web 的层叠直觉在 RN 上不成立，排查第一步应先确认「有没有 overflow」，再做遮挡与裁剪的二分。

## 适用边界

- 适用：RN / Yoga 下所有 `position: absolute` 的浮层、气泡、下拉菜单。
- 不适用：Web 与小程序（真实 DOM 层叠上下文，`z-index` + `position: fixed` 可用）。
