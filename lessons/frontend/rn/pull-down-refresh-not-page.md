---
id: GEN-RN-0016
title: 页面级下拉刷新 hook 写在内嵌组件里永远不会触发
domain: frontend/rn
tags: [rn, pull-to-refresh, page, scrollview, lifecycle]
status: verified
scope: generic
applies_to: "Taro 3.x 跨端；usePullDownRefresh 与 ScrollView refresher"
summary: usePullDownRefresh 只对注册页面生效，内嵌列表要用容器原生下拉（RN 用 RefreshControl）。
first_seen: 2026-10-19
last_verified: 2026-10-26
related: []
---

## 现象

列表组件内写了 `Taro.usePullDownRefresh(...)`，页面配置也开了 `enablePullDownRefresh`，但真机下拉**没有任何刷新动作**。「配置看起来齐全」是这类问题最典型的误判起点。

## 根因

`usePullDownRefresh` 注册的是**页面实例**的生命周期回调。如果该组件没有在 `app.config.ts` 里注册为页面，只是作为普通组件内嵌在别的页面中，回调就注册到了一个不存在的页面上下文，永远不会被派发。

另一层混淆：内嵌 `ScrollView` 的原生下拉与页级下拉是两套机制。

- 小程序：`refresherEnabled` / `refresherTriggered` / `onRefresherRefresh`。
- RN：`refreshControl={<RefreshControl />}`。
- H5：页级下拉，需要页面把信号转发给列表。

## 处置

先判断形态，再选机制：**注册页面**用页级下拉，**内嵌列表**用容器原生下拉。三端分治：

```tsx
// index.rn.tsx
<ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
  {children}
</ScrollView>
```

页面级下拉若需要驱动内嵌列表，用「刷新信号 + 已消费游标」转发，避免切 tab 重挂时重放历史信号：

```tsx
const [refreshSignal, setRefreshSignal] = useState(0);
// 列表侧
const consumed = useRef(refreshSignal);
if (consumed.current !== refreshSignal) { consumed.current = refreshSignal; onRefresh(); }
```

## 证据

- bundle 内命中的是 `PullRefreshScrollView/index.rn.tsx`（非通用实现），模块内 `refreshControl` 已挂到原生 ScrollView。
- 真机下拉后进程存活、无 JS 报错，列表数据刷新。
- 相关 Jest 用例 `16` 例通过。

## 教训

- 看到「下拉刷新不生效」先问一句：**这个组件是不是页面**。不是页面就不要用 `usePullDownRefresh`。
- 跨端下拉必须三端分治，不要指望一套配置通吃。
- 信号转发要记录已消费游标，否则重挂载会重放历史刷新。

## 适用边界

- 适用：Taro / RN 中内嵌列表的下拉刷新；需要页面驱动子列表刷新的场景。
- 不适用：真正的页面级下拉（直接用 `usePullDownRefresh` 即可）；非滚动容器下的下拉手势需求。
