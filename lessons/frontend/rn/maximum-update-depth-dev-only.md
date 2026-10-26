---
id: GEN-RN-0018
title: dev 期 Maximum update depth exceeded 是渲染器计数，不等于真实死循环
domain: frontend/rn
tags: [rn, react, logbox, useeffect, streaming, dev-only]
status: verified
scope: generic
applies_to: "React Native 0.7x dev 产物（ReactNativeRenderer-dev）"
summary: 该警告由被动 effect 内连续调度更新触发，只在 dev 存在，优先把更新延后到微任务。
first_seen: 2026-10-22
last_verified: 2026-10-26
related: [GEN-RN-0017]
---

## 现象

流式输出页出现 LogBox 黄条：

```
Maximum update depth exceeded. This can happen when a component calls setState inside useEffect,
but useEffect either doesn't have a dependency array, or one of the dependencies changes on every render.
```

特点：流式期间与页面停留期间**间歇复现**，间隔 5~8 秒；离开该页即消失，回到该页又不必然复现。**生产环境不会出现**。

## 根因

该警告只存在于 React 的 **dev renderer**（`ReactNativeRenderer-dev.js`）：

```
checkForNestedUpdates: nestedPassiveUpdateCount > NESTED_PASSIVE_UPDATE_LIMIT (= 50) → 打印
```

计数规则：每次 `flushPassiveEffectsImpl` 结束时，若该次 flush 期间有更新被调度（`didScheduleUpdateDuringPassiveEffects`），计数 +1，否则归零；`commitRootImpl` 中 `rootDoesHavePassiveEffects === false` 的提交也会归零。

本页流式管线持续满足「每次提交都在被动 effect 内再调度更新」：

- 两个自动滚底 effect 依赖 `[contentLength]` 与 `[messages.length, tailSig]`；
- token 到达时**每次提交都会 setScrollTop**；
- token 经 120ms 节流 → 约每 120ms 计数 +1 → 51 格约 6.1 秒触发一次。

所以它是**计数累积**，不是无界递归。

## 处置

把更新移出被动 effect 的同步阶段，延后到下一微任务，并加取消守卫：

```ts
useEffect(() => {
  let cancelled = false;
  Promise.resolve().then(() => {
    if (!cancelled) setScrollTop(next);
  });
  return () => { cancelled = true; };
}, [contentLength]);
```

本次提交的被动 effect 不再同步调度更新 → 计数每次提交即归零。滚动与通知只延后一拍，视觉与交互不变。对应单元测试改为 `await act(async () => ...)` 以冲洗微任务。

## 证据

- 修复前：真机持续观察，约每 6 秒一条 `Maximum update depth`。
- 修复后：重启 dev server，连续观察 28 秒，`logcat -d` 过滤该关键字计数为 0。
- 单测：假定时器用例改为 `await act(async () => ...)` 后全部通过。

## 教训

- 先判断三件事再决定是否改动：是否只在 dev 出现、是否满足「连续 50+ 次提交都在被动 effect 内调度更新」、是否有真实无界递归。
- 计数型警告用「延后一拍」即可消除，不必重写数据流。
- 生产构建不含该检查，把它当线上风险会浪费时间。

## 适用边界

- 适用：RN / React dev 产物中由高频流式更新触发的同类黄条。
- 不适用：真正在 render 内 setState 或依赖数组每次变化导致的死循环（此时计数会持续增长且页面卡死），需要修数据流本身。
