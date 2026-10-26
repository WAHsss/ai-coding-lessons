---
id: GEN-RN-0010
title: debug 包默认连 metro 而不是内置 bundle，装到真机白屏
domain: frontend/rn
tags: [rn, android, debug, bundle, metro, apk]
status: verified
scope: generic
applies_to: "React Native 0.7x Android 壳工程；debuggableVariants 配置"
summary: debug 包优先连 8081 取 bundle，内置 bundle 存在也不用；独立测试包需关掉 developer support。
first_seen: 2026-10-18
last_verified: 2026-10-26
related: [GEN-BUILD-0006]
---

## 现象

APK 安装启动后真机显示 `could not connect to development server`，即使 APK 内**已经有** `assets/index.android.bundle`（约 3.7MB）。

推论时刻意验证过：把手机与电脑断开也不影响现象——因为它根本不读内置 bundle。

## 根因

壳工程里：

```kotlin
override fun getUseDeveloperSupport(): Boolean = BuildConfig.DEBUG
android { ... react { debuggableVariants = ["debug", "release"] } }
```

两处叠加：`debuggableVariants` 让 Gradle **不重打 JS**，`getUseDeveloperSupport()` 让运行时**优先连 8081** 取 bundle。于是 debug 形态本质上是「壳 + dev server」，离开电脑就不能跑。

这不是构建失败，是**产品形态**的默认选择。

## 处置

按用途二选一：

1. **开发调试形态**：保留默认行为，用隧道把设备接到本机 metro：

   ```bash
   adb reverse tcp:8081 tcp:8081
   adb shell am force-stop <package>
   adb shell am start -n <package>/.MainActivity
   ```

2. **可独立运行的测试包**：让 `getUseDeveloperSupport()` 返回 `false`，并把目标变体从 `debuggableVariants` 移除，使 JS 被打进 assets，运行时加载内置 bundle。

选择 2 会改变调试体验（热更新、远程调试不可用），属于需要明确拍板的形态决策，不要默默改。

## 证据

- APK 内 `assets/index.android.bundle` 存在但不被优先使用（3.7MB）。
- 关闭 developer support 重新出包后，断网启动仍能进入首屏。
- 隧道形态下，metro 日志可见设备拉取 bundle 请求。

## 教训

- 「装了包却白屏」先确认包在找谁要 JS：dev server 还是内置 assets。
- 出包前明确这次要的是「调试包」还是「可离线验证包」，两者的构建参数不同。
- 用 `adb reverse` 时注意它依赖 adb server 存活，进程被回收则隧道失效（见 GEN-TEST-0001）。

## 适用边界

- 适用：RN Android debug 构建、CI 产物用于手工验收的场景。
- 不适用：release 包（默认加载内置 bundle）；iOS 的同类开关为 `RCT_DEV` 相关配置。
