---
id: GEN-BUILD-0009
title: Gradle composite includeBuild 需要三处声明镜像，只改一处仍会连 Google
domain: build
tags: [gradle, maven, mirror, composite, android]
status: verified
scope: generic
applies_to: "Android Gradle 构建；受限网络环境；含 includeBuild 的 RN 工程"
summary: 镜像要同时落在 init.gradle、settings.pluginManagement 与 allprojects，缺一处就失败。
first_seen: 2026-10-18
last_verified: 2026-10-26
related: []
---

## 现象

只在 `android/build.gradle` 里声明了 Maven 镜像，构建仍然失败：`@react-native/gradle-plugin` 的 `includeBuild` 依旧去连 Google 源，表现为解析依赖超时或 TLS 握手被中断。

## 根因

Gradle 的仓库声明是**分层**的，不同阶段使用不同的仓库集合：

1. **插件解析阶段**（`settings.gradle` 的 `pluginManagement`）——决定插件类路径从哪下载。
2. **项目依赖阶段**（`allprojects.repositories`）——决定模块依赖从哪下载。
3. **composite build**（`includeBuild`）——被包含的构建**有自己的仓库配置**，不受主构建影响，需要用户级 `init.gradle` 兜底。

只改第 2 层，第 1、3 层仍走默认源，构建照样卡在下载阶段。

## 处置

三处同时声明，缺一不可：

```groovy
// 1) 用户级 ~/.gradle/init.gradle —— 兜住 includeBuild
beforeSettings { settings ->
  settings.pluginManagement.repositories { maven { url '<mirror>' } }
}
allprojects { repositories { maven { url '<mirror>' } } }
```

```groovy
// 2) android/settings.gradle
pluginManagement {
  repositories { maven { url '<mirror>' }; google(); mavenCentral() }
}
```

```groovy
// 3) android/build.gradle
allprojects {
  repositories { maven { url '<mirror>' }; google(); mavenCentral() }
}
```

保留 `google()` / `mavenCentral()` 作为后备：镜像缺构件时仍可回落，比只配镜像更稳。

## 证据

- 仅声明一处时：`includeBuild` 阶段仍报连 Google 源失败（超时 / TLS 中断）。
- 三处齐备后：依赖与插件均从镜像解析，构建通过；`~/.gradle/init.gradle` 存在性检查返回 `True`。
- 本机受限网络下，`sdkmanager` 与 Gradle 长期无法直连 Google 源，走镜像后稳定。

## 教训

- 「明明配了镜像却还连 Google」先数层：插件、依赖、composite 是三套仓库配置。
- 用户级 `init.gradle` 是唯一能兜住 `includeBuild` 的位置，值得优先落地。
- 镜像配置同时保留官方源，避免镜像不全导致新的失败。

## 适用边界

- 适用：Android / Gradle 项目在受限网络下构建；含 `includeBuild` 或 composite 的工程。
- 不适用：网络可直连官方源的 CI；纯 JavaScript 构建（不涉及 Gradle 仓库分层）。
