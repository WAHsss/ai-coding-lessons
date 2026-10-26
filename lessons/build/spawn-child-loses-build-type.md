---
id: GEN-BUILD-0004
title: 子进程 argv 里没有 --type rn，按 argv 推断的构建类型会退化
domain: build
tags: [taro, build-type, argv, config, rn]
status: verified
scope: generic
applies_to: "Taro 3.x 构建配置；spawn 子进程重新加载配置的构建链"
summary: 被 spawn 的子进程会重新加载配置但 argv 不含 --type，按 argv 门控的配置要改成无条件求值。
first_seen: 2026-10-18
last_verified: 2026-10-26
related: [GEN-BUILD-0001]
---

## 现象

RN 专用配置（如样式 token 注入）在 Taro 构建中「莫名不生效」，改配置、重启都不起作用，也没有报错。

## 根因

`taro build --type rn` 会 spawn `npx react-native bundle` 子进程，**子进程会重新加载同一份配置文件**，但它的 argv 里**没有** `--type rn`。

于是配置里按 `process.argv` 推断出的 `buildType` 退化成默认值（如 `weapp`），所有「只在 rn 分支生效」的配置在该子进程里被跳过——真正执行打包的就是这个子进程。

## 处置

区分两类配置：

- **只被 rn 段消费的配置** → **无条件求值**，不要按 `buildType` 门控。
- **产物路径分流** → 保留按 `buildType` 判断（子进程不需要它）。

```js
// 无条件求值：无论 buildType 推断成什么，都要算
const rnTokenRoot = buildTokens();

// 按类型分流：只在主进程有意义
outputPath = buildType === 'rn' ? 'dist/rn' : 'dist';
```

## 证据

- 修复前：token 注入在 RN 产物中缺失，且无任何报错。
- 修复后：RN 产物内命中注入的 token 内容，H5 / 小程序产物无变化。
- 佐证：子进程日志显示其 argv 不含 `--type rn`，配置被二次求值。

## 教训

- 「配置不生效」先问：这份配置被**求值了几次**、在哪个进程里求值。
- 凡 `--type`、`NODE_ENV` 一类由 CLI 传入的信号，在 spawn 子进程时都会丢；依赖它们的配置要显式传递或改为无条件。
- 把配置写成「求值即生效」的纯函数，比依赖 argv 更稳。

## 适用边界

- 适用：Taro / 自研 CLI 中「主进程 spawn 子进程并重新加载配置」的构建链。
- 不适用：单进程构建、配置只求值一次的场景；子进程显式透传了 `--type` 的情况。
