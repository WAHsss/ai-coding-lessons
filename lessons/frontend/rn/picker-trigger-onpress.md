---
id: GEN-RN-0013
title: Picker 在 RN 端点不开：触发依赖唯一子节点的 onPress，Taro View 不认
domain: frontend/rn
tags: [rn, picker, antd, onPress, trigger]
status: verified
scope: generic
applies_to: "Taro RN 的 Picker（@ant-design/react-native 实现）"
summary: Picker 把弹出挂到唯一子节点的 onPress 上，子节点是 Taro View 时永不触发，需显式映射手势。
first_seen: 2026-10-19
last_verified: 2026-10-26
related: [GEN-RN-0011]
---

## 现象

筛选胶囊、表单里的下拉选择在真机**点了完全没反应**，选择器不弹出；H5 与小程序正常。同一模式在表单中可能有多处 Picker 同时失效。

## 根因

Taro RN 的 Picker 基于 `@ant-design/react-native` 的 picker。其 `PopupMixin.getRender()` 用：

```js
cloneElement(child, { [props.triggerType]: this.onTriggerClick })
```

把「弹出选择器」挂到**唯一子节点**上，默认 `triggerType: 'onPress'`。

而子节点是 Taro 的 `View`：`useClickable` 只识别 `onClick / onLongPress / onTouchStart / onTouchEnd`，`onPress` 会被原样透传给 react-native 原生 `View`，**原生 View 不支持 `onPress`** → 点击没有任何回调，选择器永不弹出。

Picker 自身的弹层由根部 antd `Provider`（Portal.Host）承载，渲染链路本身没问题，问题只在触发。

## 处置

给 Picker 加一个专用触发子组件，显式接住 `onPress` 并映射到 RN 支持的手势：

```tsx
function PickerTrigger(props: any) {
  return <View onTouchEnd={props.onPress}>{props.children}</View>;
}

<Picker>
  <PickerTrigger>{/* 展示内容 */}</PickerTrigger>
</Picker>
```

用 `onTouchEnd` 而非 `onClick`，可避开 350ms 长按判定（见 GEN-RN-0011）。weapp / H5 不注入 `onPress`，行为不变。

排查同类问题的方法：`grep "<Picker"` 后看唯一子节点是不是 Taro `View`——是则 RN 端必然点不开。

## 证据

- bundle（`14,005,250` 字节）内命中 `PickerTrigger` 19 处、`onTouchEnd: onPress` 1 处。
- 真机复验：点击筛选项弹出选择器，选择后列表刷新。
- Jest `83` 套件 / `693` 例通过，含新增用例：注入 `onPress` 时绑定手势，未注入时不绑定。

## 教训

- RN 端 Picker 的「可点区域」是**子节点**，不是 Picker 自身；跨端触发器必须显式转手感。
- 这类问题无报错、无警告，只能靠真机点击发现；组件库封装越深，越要验证触发链路。
- 统一封装一个 `PickerTrigger`，避免在每处 Picker 重复处理。

## 适用边界

- 适用：Taro RN 中所有以子节点为触发器的组件（Picker、Popup、Trigger 类）。
- 不适用：H5 / 小程序（原生支持 `onPress` 或点击继承）；直接调用命令式 API 打开选择器的场景。
