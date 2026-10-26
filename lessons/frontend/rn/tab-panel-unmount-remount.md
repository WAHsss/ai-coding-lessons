---
id: GEN-RN-0012
title: 条件渲染切换 tab 会卸载重挂，每次闪「加载中」并丢失滚动位置
domain: frontend/rn
tags: [rn, tab, unmount, state, scroll, performance]
status: verified
scope: generic
applies_to: "React / RN / Taro 的 tab 面板切换"
summary: 用条件渲染切换面板会重建组件，改为访问后常驻 + display:none 隐藏。
first_seen: 2026-10-19
last_verified: 2026-10-26
related: [GEN-RN-0011]
---

## 现象

切到某个列表 tab 时，每次都先闪一下「加载中」，滚动位置回到顶部；切回来的 tab 也要重新请求数据。

代码形态：

```tsx
{tab === 'list' && <List />}
```

## 根因

`tab === 'list' && <List />` 在切换时**卸载 → 重挂**组件：

- 重挂触发新的数据请求（`useEffect` 重新执行）→ 空白 + 加载态。
- 组件内部状态（滚动位置、已展开项、分页游标）随卸载丢失。
- 频繁重挂还带来额外渲染开销，切换体感变卡。

## 处置

首次访问后让面板**常驻**，用 `display: none` 隐藏而不是卸载：

```tsx
const [visited, setVisited] = useState<Record<string, boolean>>({});

useEffect(() => {
  if (!visited[tab]) setVisited((v) => ({ ...v, [tab]: true }));
}, [tab]);

<View className={`panel ${tab !== 'list' ? 'panel--hidden' : ''}`} style={{ display: tab !== 'list' ? 'none' : 'flex' }}>
  {visited.list && <List />}
</View>
```

容器需要 `flex: 1` 与 `min-height: 0`，避免隐藏/显示切换时把纵向布局撑破。

## 证据

- bundle 内命中 `panel--hidden` 类与对应样式对象。
- 真机复验：反复切换 tab，列表不再出现「加载中」，滚动位置保持。
- Jest 全量 `82` 个套件 / `690` 例通过，含新增的面板常驻断言。

## 教训

- 列表类 tab 想「切得顺」，应让面板常驻隐藏，而不是优化重挂速度。
- 判断是否在卸载，看请求次数与滚动位置这两个副作用即可，不需要读框架源码。
- 常驻会提高内存占用，面板数量很多的场景要评估是否需要 LRU 回收。

## 适用边界

- 适用：RN / React 中 tab 面板、底部导航、分段切换；需要保留状态的子页面。
- 不适用：面板内容极重且数量多（常驻成本高于重建）；表单类页面需要每次进入重置状态的场景。
