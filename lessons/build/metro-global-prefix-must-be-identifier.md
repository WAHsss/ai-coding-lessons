---
id: GEN-BUILD-0002
title: metro transformer.globalPrefix 必须是合法 JS 标识符，否则 bundle 语法非法
domain: build
tags: [metro, globalPrefix, prelude, syntax, bundle]
status: verified
scope: generic
applies_to: "React Native 0.7x + metro；自定义 transformer.globalPrefix 的项目"
summary: globalPrefix 会被原样拼进 prelude 与模块包装，只能用字母数字下划线美元符。
first_seen: 2026-10-18
last_verified: 2026-10-26
related: [GEN-BUILD-0003, GEN-RN-0021]
---

## 现象

真机启动即失败：

```
E unknown:ReactNative: com.facebook.jni.CppException: Compiling JS failed: 1:190:';' expected
   Buffer size ... starts with: 76617220...
E unknown:ReactNative: Attempting to call JS function on a bad application bundle: HMRClient.setup()
```

从 PC 拉取同一 bundle，第 1 行含：

```
app-rn-prd|http://<internal-host>/api__requireCycleIgnorePatterns=[...]
```

即环境签名（含 `|`、`:`、`/`）被直接当作前缀拼进了代码。

## 根因

metro 把 `globalPrefix` 当**标识符前缀**原样拼接：

- `metro/src/lib/getPreludeCode.js` 生成 `__METRO_GLOBAL_PREFIX__='<prefix>'` 与 `${prefix}__requireCycleIgnorePatterns`；
- `ModuleGraph/worker/JsFileWrapping.js` 生成 `${prefix}__d(...)` 与 require 重命名的 `${prefix}__r`。

前缀里出现非标识符字符，拼出的 prelude 与模块包装就是非法 JS。

**隐蔽性**：dev 侧签名若含 `|`，`|` 恰好是合法二元运算符，`node --check` 竟然能通过，问题被掩盖；只有含 `:` `/` 的环境会爆。

## 处置

取值只允许 `[A-Za-z0-9_$]`。推荐组合「环境 slug（仅字母数字）+ 签名哈希前 8 位」：

```js
// 例：apprn_prd_5b8a5942_
const prefix = `${slug.replace(/[^A-Za-z0-9]/g, '')}_${env}_${sha1(signature).slice(0, 8)}_`;
```

改完必须重新校验 bundle 语法（前缀变化会自动触发全量重转）。

## 证据

- 修复后 prd bundle `node --check` 退出码 0。
- prelude 第 1 行为 `...__METRO_GLOBAL_PREFIX__='apprn_prd_5b8a5942_';...`，旧的非法前缀残留 0 处。
- dev 侧同时通过校验，说明该约束对所有环境成立。

## 教训

- 任何「被拼进代码」的配置值都要按**标识符**校验，而不是按字符串校验。
- 只在 dev 验证是危险的：`|` 在 dev 恰好合法，掩盖了问题。多环境各验一次。
- 前缀同时承担缓存分区职责（见 GEN-BUILD-0003），两者要一起设计。

## 适用边界

- 适用：metro 的 `transformer.globalPrefix`；任何被拼入生成代码的命名前缀。
- 不适用：只作为缓存键使用、不进入产物的配置值（可含任意字符）。
