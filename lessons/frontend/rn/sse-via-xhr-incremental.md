---
id: GEN-RN-0017
title: RN 流式响应不能照搬 Web Stream，需用原生 XHR 增量事件
domain: frontend/rn
tags: [rn, sse, streaming, xhr, fetch]
status: verified
scope: generic
applies_to: "React Native 0.7x；SSE / 流式文本渲染"
summary: RN 的 fetch 不暴露 ReadableStream，改监听 XHR progress 取增量，并只替换传输层。
first_seen: 2026-10-19
last_verified: 2026-10-26
related: [GEN-RN-0018]
---

## 现象

同一套 SSE 实现，H5 正常，RN 端发消息后 AI 气泡**瞬间**变成「重新生成」失败态，且抓不到任何网络请求。开发期若该能力被实现为直接 reject 的桩，表现为 `SSE_UNSUPPORTED`。

## 根因

H5 实现走 `fetch` + `resp.body.getReader()`。RN 的 fetch polyfill **不暴露 `ReadableStream`**，整条链路无法照搬。

RN 的增量能力在宿主原生层：Android `NetworkingModule` 通过 `incrementalUpdates` 回传文本块，入口是 `XMLHttpRequest` 的事件。

## 处置

新增 RN 专用传输层，**只替换传输，解析逻辑共享**：

```ts
const xhr = new XMLHttpRequest();
xhr.open('POST', url);
// 关键：监听 readystatechange 或 progress 会把 _incrementalEvents 置为 true
xhr.addEventListener('progress', () => {
  const chunk = xhr.responseText.slice(lastLength);
  lastLength = xhr.responseText.length;
  parser.feed(chunk);
});
xhr.addEventListener('load', () => parser.end());
xhr.send(body);
```

四个要点：

1. `readystatechange` 或 `progress` 任一监听都会开启 `incrementalUpdates`。
2. `setReadyState(LOADING)` **只在首次**派发 `readystatechange`，后续块靠 `progress` —— 所以 **`progress` 监听器必需**，只挂 `readystatechange` 会丢掉第 2 块之后的全部数据。
3. 每次只取 `responseText` 相对上次的**新增后缀**喂解析器，避免重复喂帧。
4. Android 侧按 UTF-8 边界切分（`ProgressiveStringDecoder`），中文不会跨块截断。

帧切分与业务协议复用平台无关的解析器，保证三端行为一致、单测共用 Mock 帧。

## 证据

- 真机实发一条消息：AI 气泡先出现流式光标 `▋` 与「深度思考」块，随后逐步补全正文。
- `uiautomator dump` 依次读到完整回复内容；取帧体积 `302970 → 303487` 递增。
- bundle 侧：旧桩调用命中 0，新模块独有标识命中 1。
- 全程未再出现「重新生成」失败态。

## 教训

- RN 的「流式」只能走原生 XHR 增量事件（或 EventSource 类 polyfill），不要照搬 Web Stream API。
- **适配层只替换传输层**，解析协议共享；否则三端行为会分叉，测试也无法复用。
- 只挂 `readystatechange` 是典型错误：首块能收到，之后静默丢数据，表现为「流到一半停住」。

## 适用边界

- 适用：RN / Taro RN 中的 SSE、逐字输出、长响应流式渲染。
- 不适用：H5 / 小程序（可用 fetch + ReadableStream 或原生分块 API）；一次性请求无需增量。
