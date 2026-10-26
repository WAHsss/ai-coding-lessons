---
id: GEN-RN-0007
title: 子组件未 import 自己的 scss 时 className 解析为 undefined，元素零样式
domain: frontend/rn
tags: [rn, taro, scss, stylesheet, module-scope]
status: verified
scope: generic
applies_to: "Taro 3.x 编译到 RN；按模块注入 _styleSheet 的实现"
summary: Taro RN 类名解析是模块级的，子组件必须各自 import 自己的 scss，否则样式静默失效。
first_seen: 2026-10-19
last_verified: 2026-10-26
related: [GEN-RN-0006]
---

## 现象

页面 UI 完全错乱：外层容器（顶栏、输入栏、tabbar）正常，但中间的欢迎区、列表等元素**失去定位、间距、尺寸**，像纯文本一样从上往下堆叠。无报错、无红屏、无警告。

## 根因

Taro 的 babel 插件为**每个模块**注入 `_styleSheet`，取值分两种：

```js
// 文件自己 import 了 scss
var _styleSheet = _mergeStyles([_app.default, ""], [_index.default, ""]);
// 文件没有 import
var _styleSheet = _app.default;   // 只有 app.scss 的类
```

`className` 静态取值被编译为查表 `_styleSheet["x"]`（动态拼接走 `_getStyle(expr)` 按空格拆名查表）。因此模块**只能使用本模块直接 import 的 scss** 里的类名。用了兄弟文件定义的共享类名 → 查表得 `undefined` → `Object.assign(style, undefined)` **静默忽略** → 该元素零样式。

## 处置

凡使用共享类名的子组件模块，各自补一行 import：

```tsx
import './index.scss';
```

把「组件各自 import 自己的样式」定为约定，新组件创建时检查一次。共享样式文件被多个子组件使用时，允许重复 import（模块级注入，不产生冲突）。

## 证据

- 修复前 bundle `14,036,894`：8 个子组件模块的 deps **不含**样式模块（`1403`）。
- 修复后 bundle `14,045,300`：8 个模块 deps **均含** `1403`（即 `index.scss`）。
- 真机取帧：版式恢复正常，间距与定位与 H5 一致。

## 教训

- RN 端 class 解析是**模块级**的，不是全局 CSS：没有 webpack 那种「样式全局生效」。
- 这类缺陷最贵在于**无报错**——样式写了、类名也写了，只是查不到。
- 加一条「新子组件必须 import 自己样式」的 review 检查点，比事后逐帧比对便宜。

## 适用边界

- 适用：Taro 编译到 RN 的组件树，尤其是拆分子组件多的页面。
- 不适用：H5 / 小程序（全局样式表，类名可跨模块使用）；原生 RN 的 `StyleSheet.create` 手写对象。
