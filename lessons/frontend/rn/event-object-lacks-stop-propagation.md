---
id: GEN-RN-0008
title: RN 事件对象没有 stopPropagation，裸调用直接红屏
domain: frontend/rn
tags: [rn, event, stopPropagation, cross-platform]
status: verified
scope: generic
applies_to: "Taro RN 合成事件；从 H5 迁移的事件处理代码"
summary: RN 按压事件不冒泡且事件对象无 stopPropagation，改用存在性守卫统一处理。
first_seen: 2026-10-19
last_verified: 2026-10-26
related: []
---

## 现象

在列表项右侧点「更多」按钮，真机红屏：

```
Uncaught Error: e.stopPropagation is not a function (it is undefined)
```

堆栈指向事件处理函数里的 `e.stopPropagation()`。H5 与小程序端同一代码正常。

## 根因

Taro RN 的合成事件对象**不提供** `stopPropagation`。RN 的按压事件本身**不向父级冒泡**，「拦截冒泡」在 RN 上是无意义操作，因此框架没有实现该方法。沿用 H5 写法直接调用即抛错。

同类方法还有 `preventDefault`，在 RN 上同样不可依赖。

## 处置

统一改为**存在性守卫**，并抽到公共模块复用，避免各文件各写一份：

```ts
export function stopPropagation(e: any) {
  if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
}
```

把所有裸调用替换为 `stopPropagation(e)`，并全仓扫描确保没有遗漏：

```bash
grep -rn "e\.stopPropagation()" src/
# 期望只剩公共模块内的实现
```

## 证据

- 修复后 bundle 中守卫函数命中 2 处（两个引用模块），真机点击不再红屏。
- 全仓扫平后 `e.stopPropagation()` 裸调用点归零，仅剩工具模块自身实现。
- 前端 `81` 个套件 / `681` 个用例全部通过。

## 教训

- 跨端事件处理 **MUST NOT 直接调用 DOM 专有方法**。判断方式：RN 事件不冒泡，凡「阻断冒泡」的调用要么无意义、要么抛错。
- 守卫只写一处，全仓引用；否则同一坑会在第 N 个文件重复出现。
- 迁移 H5 代码到 RN 时，事件对象的方法可用性要先列清单，不要逐个踩。

## 适用边界

- 适用：Taro RN / React Native 的合成手势事件，尤其是从 Web 迁移的组件。
- 不适用：React DOM 事件（`stopPropagation` 正常可用）；原生 RN 需要阻止父子手势冲突时应改用 `onStartShouldSetResponder` 等 responder 机制。
