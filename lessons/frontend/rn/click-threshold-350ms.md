---
id: GEN-RN-0011
title: RN 点击判定有 350ms/3px 阈值，慢按会丢失点击，静止控件改用 onTouchEnd
domain: frontend/rn
tags: [rn, touch, click, gesture, taro]
status: verified
scope: generic
applies_to: "Taro RN（@tarojs/components-rn useClickable / PanResponder）"
summary: 按压超过 350ms 或位移超过 3px 就不算点击，静止控件在 RN 端改用 onTouchEnd。
first_seen: 2026-10-19
last_verified: 2026-10-26
related: [GEN-RN-0012]
---

## 现象

底部 tab 栏「按得稍慢一点就没反应」：图标状态不变、页面不切换。快速点击正常，按住半秒再抬手则完全无响应。H5 与小程序端没有该现象。

## 根因

Taro RN 的 `View.onClick` 由 `@tarojs/components-rn` 的 `useClickable`（基于 PanResponder）在**抬手**时判定，源码写死：

```
按下时长 ≤ 350ms 且位移 < 3px 才算点击，否则按长按处理
```

长按只派发 `onLongPress`，不派发点击。静止的 tab 栏没有位移问题，但**慢按超过 350ms 就直接丢失点击**。

## 处置

对静止控件（tab、按钮、列表项），在 RN 端改用 `onTouchEnd`，抬手即派发，不受阈值约束：

```tsx
const pressProps =
  process.env.TARO_ENV === 'rn'
    ? { onTouchEnd: handlePress }
    : { onClick: handlePress };

<View {...pressProps}>...</View>
```

其余平台保留 `onClick`，用编译期分支区分，不做运行期判断。

注意：`onTouchEnd` 不处理「按下后滑走」的取消语义。若控件需要拖拽或长按菜单，应改用 responder 机制而不是简单替换。

## 证据

- 修复后 bundle 内 `tabPressProps` 编译为 `onTouchEnd` 分支（`return true ? { onTouchEnd: ... } : ...`）。
- 真机复验：慢速点击 tab 正常切换，图标与文字同步更新。
- 放大热区并非解法：该 tab 项本就占满 1/4 宽 × 100px 高，问题在时间阈值不在面积。

## 教训

- RN 端「点击不灵」先查 Taro 的点击判定阈值（350ms / 3px），再考虑热区、层级、事件拦截。
- 静止控件换 `onTouchEnd` 比调大热区更有效，也更贴近用户预期。
- 这类问题在真机手工测试里表现为「偶发」，容易被归因为设备卡顿。

## 适用边界

- 适用：Taro RN 中不涉及滑动的点击控件；需要快速响应的 tab、按钮。
- 不适用：H5 / 小程序（无此阈值）；需要区分点击、长按、滑动的复杂手势，应使用 GestureHandler 或 responder 机制。
