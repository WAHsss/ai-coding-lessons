---
id: GEN-BUILD-0003
title: metro transform 缓存键不含 defineConstants：切环境后静默复用旧 bundle
domain: build
tags: [metro, cache, babel, defineConstants, environment]
status: verified
scope: generic
applies_to: "React Native 0.7x + metro；babel-plugin-global-define 一类编译期常量注入"
summary: 编译期常量不参与 transform 缓存键，切环境前必须隔离缓存（独立 globalPrefix）或显式清缓存。
first_seen: 2026-10-18
last_verified: 2026-10-26
related: [GEN-BUILD-0001, GEN-BUILD-0006]
---

## 现象

先构建 dev 再构建 prod，prod 包里**仍然是 dev 的地址**，页面表现为「线上包连不上后端」或「连到了本地后端」：

- prod bundle 内线上地址命中 0 次，本地地址命中 2 次。
- 构建全程**没有任何报错**，退出码 0，体积正常。

## 根因

`API_BASE` 一类常量由 babel 插件在 transform 阶段内联，属于**编译时**结果。而 metro 的 transform 缓存键只由三样东西构成：

```
transformer 文件哈希 + metro 版本 + transformer.globalPrefix
```

（见 `metro/src/DeltaBundler/getTransformCacheKey.js`）

**不含 `defineConstants`**。两个环境共用同一缓存键，先构建环境的 transform 产物被后一个环境直接复用，常量值也一并沿用。

## 处置

二选一，优先第一种：

1. **按环境隔离缓存键**：把环境签名放进 `transformer.globalPrefix`，每个环境各持一份缓存。取值必须只含 `[A-Za-z0-9_$]`，例如 `app_prd_<sha1 前 8 位>_`。
2. **切环境时显式清缓存**：删除 `%TEMP%\\metro-cache`（或在 CI 里做等价清理）再构建。

选方案 1 后，同环境重复构建仍能命中缓存，不必每次全量重转。

## 证据

- 修复前：`AFTER_PRD` 包内线上地址 0 次、本地地址 2 次，无报错。
- 修复后连跑 dev → prd：`AFTER_DEV` 线上 0 / 本地 2，前缀 `app_dev_...`；紧随其后的 `AFTER_PRD` 线上 2 / 本地 0，前缀 `app_prd_...`；两次 `node --check` 均退出码 0。

## 教训

- 「切了环境变量就生效」是错误直觉：凡编译期注入的值，都要先问它是否参与缓存键。
- 这类问题最贵的地方是**静默**——没有报错、没有日志，只能靠产物内容检索发现。回归动作应固化为「dev → prd 连跑 + 常量命中数对比」。
- 用 `--reset-cache` 能绕过，但每次全量重转，开发体验差；按环境分缓存键更可持续。

## 适用边界

- 适用：metro + babel 编译期常量注入（`defineConstants`、`babel-plugin-transform-inline-environment-variables` 等）。
- 不适用：运行时读取的环境变量（如 `process.env.X` 未被静态替换的场景）——此类在运行期求值，不受缓存影响。
