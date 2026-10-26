---
id: GEN-RN-0021
title: bundle 语法错误的取证方法：Compiling JS failed 与 has not been registered 必须合看
domain: frontend/rn
tags: [rn, bundle, syntax, logcat, diagnosis]
status: verified
scope: generic
applies_to: "React Native Android；metro 产物排查"
summary: 白屏时先找 Compiling JS failed 的行列号，再把 bundle 拉到 PC 用 node --check 定位。
first_seen: 2026-10-18
last_verified: 2026-10-26
related: [GEN-RN-0009, GEN-BUILD-0001]
---

## 现象

JS 完全无法启动，界面白屏或红屏。`logcat` 里同时出现两条看似无关的信息：

```
E unknown:ReactNative: com.facebook.jni.CppException: Compiling JS failed: 1:190:';' expected
E ReactNativeJS: Invariant Violation: "app" has not been registered.
```

如果只看第二条，很容易得出「metro 目录不对 / 入口路径配错」的错误结论，然后去翻 `app.config` 或入口文件，浪费大量时间。

## 根因

两条信息描述的是同一条因果链：

- `Compiling JS failed: <行>:<列>` → bundle 在 Hermes 编译阶段就失败，**语法**不合法。
- `has not been registered` → 入口模块**未能执行**，因此没有完成注册。

语法错误在前，未注册在后。`1:190` 是定位到具体行列的直接线索，比反复重启真机有效得多。

## 处置

1. 用一条命令过滤关键日志：

   ```bash
   adb logcat -v time | grep -E 'ReactNativeJS|ReactNative|CppException|Invariant|FATAL|AndroidRuntime'
   ```

2. 从 PC 侧拉取**同一个 URL** 的 bundle 落地成文件：

   ```bash
   curl -s 'http://127.0.0.1:8081/index.bundle?platform=android&dev=true&minify=false' -o /tmp/index.bundle
   cp /tmp/index.bundle /tmp/index.js   # node 不认 .bundle 扩展名
   node --check /tmp/index.js
   ```

3. 按报错行列号直接看该行内容（语法问题通常在 prelude 或模块包装处，见 GEN-BUILD-0002 的 `globalPrefix` 一类原因）。

## 证据

- 上述两条日志在修复前成对出现；修复后两者同时归零。
- `node --check` 对同一 bundle 返回非 0 退出码并给出行列，与 logcat 的行列号一致。
- 拉包比对可确认「真机加载的就是这份产物」，排除缓存与版本错位。

## 教训

- 白屏排查顺序：先看有没有 `Compiling JS failed`，有则直接查语法；再看 `has not been registered`。
- 真机反复重启不产生新信息，把 bundle 拉到 PC 做静态检查才是收敛路径。
- `.bundle` 扩展名 node 不识别，复制成 `.js` 是必要一步，别因此误判「文件损坏」。

## 适用边界

- 适用：RN / Hermes 的 bundle 启动失败、白屏、红屏初筛。
- 不适用：运行期逻辑错误（此时 bundle 能编译，`has not been registered` 不会出现）；纯样式问题（无编译期报错）。
