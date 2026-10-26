---
id: GEN-RN-0003
title: RN 的 Text 不继承父 View 的 color，选中色必须写在 Text 自身
domain: frontend/rn
tags: [rn, text, style, color, inherit]
status: verified
scope: generic
applies_to: "React Native 0.7x；Taro RN 跨端样式"
summary: 颜色/字重写在容器 View 上只有 H5 和小程序生效，RN 必须写在 Text 自身的 class 上。
first_seen: 2026-10-18
last_verified: 2026-10-26
related: [GEN-RN-0002]
---

## 现象

底部 tab 选中态：图标变蓝，**文字仍是默认黑色**。同一样式在 H5 与小程序端正常，只有 RN 端不生效。

样式写在容器上：

```css
.tabbar-item-active { color: #1677ff; }
```

## 根因

RN 的 `Text` **不继承**父 `View` 的 `color`（只继承祖先 `Text` 的文本样式）。而 Taro 编译到 RN 时，`.tabbar-item-active` 落在 `View` 节点上，`color` 对 View 无意义，原生侧直接忽略；H5 / 小程序走 CSS 继承，所以表现正常。

同类不继承的属性还包括 `font-size`、`font-weight`、`line-height` 等文本类属性。

## 处置

把文本类属性拆到 `Text` 节点自身的 class 上，与容器类分开命名：

```tsx
<View className={`tab-item ${active ? 'tab-item-active' : ''}`}>
  <Text className={`tab-text ${active ? 'tab-text-active' : ''}`}>首页</Text>
</View>
```

```css
/* 容器只放布局 */
.tab-item-active { /* 背景、边框等视觉容器属性 */ }
/* 文本属性落在 Text 上 */
.tab-text-active { color: #1677ff; font-weight: 600; }
```

跨端组件里，凡是「选中变色 / 高亮字重」，都按这个模式拆一次。

## 证据

- 重启 dev server 后拉取 bundle，命中 `...-text-active` 样式对象且含 `color`。
- 单元测试新增断言「选中 tab 文字带 active 类且仅一个」，全量 `82` 个套件 / `690` 例通过。
- 真机复验：切换 tab 时图标与文字同步变色。

## 教训

- 跨端样式先分清「布局属性」与「文本属性」。文本属性一律下沉到 `Text`。
- 不要在容器上写 `color` 然后指望跨端一致：H5 能过、RN 静默失败，属于最容易漏测的一类。
- 选中态测试应断言「类落在 Text 上」，只断言容器类会漏掉这个缺陷。

## 适用边界

- 适用：RN / Taro RN 中的文本样式（颜色、字号、字重、行高）。
- 不适用：纯 Web / 小程序环境（CSS 继承正常工作）；但为保持一套代码跨端一致，仍建议统一按 Text 落样式。
